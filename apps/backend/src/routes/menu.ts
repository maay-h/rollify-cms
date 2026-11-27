import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validate.js';

export const menuRouter = Router();

// Get all categories
menuRouter.get('/categories', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await db.query(
      `SELECT id, name, slug, description, display_order, is_active
       FROM menu_categories
       WHERE is_active = TRUE
       ORDER BY display_order ASC`
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

// Get menu items with optional category filtering and loaded variants
menuRouter.get('/items', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { categoryId, vegOnly, search } = req.query;

    let query = `
      SELECT 
        m.id, 
        m.category_id, 
        c.name as category_name,
        m.name, 
        m.description, 
        m.price, 
        m.tax_rate, 
        m.is_veg, 
        m.is_available, 
        m.is_chef_special,
        m.is_spicy,
        m.image_url,
        m.prep_time_minutes,
        m.display_order
      FROM menu_items m
      JOIN menu_categories c ON m.category_id = c.id
      WHERE m.is_available = TRUE
    `;
    const params: any[] = [];

    if (categoryId) {
      params.push(categoryId);
      query += ` AND m.category_id = $${params.length}`;
    }

    if (vegOnly === 'true') {
      params.push(true);
      query += ` AND m.is_veg = $${params.length}`;
    }

    if (search && typeof search === 'string' && search.trim().length > 0) {
      params.push(`%${search.trim().toLowerCase()}%`);
      query += ` AND LOWER(m.name) LIKE $${params.length}`;
    }

    query += ' ORDER BY c.display_order, m.display_order, m.name ASC';

    const itemsResult = await db.query(query, params);

    // Fetch variants for all items
    const variantsResult = await db.query(
      `SELECT id, menu_item_id, variant_name, price, is_available 
       FROM menu_item_variants 
       WHERE is_available = TRUE 
       ORDER BY price ASC`
    );

    const variantsByItem: Record<string, any[]> = {};
    for (const v of variantsResult.rows) {
      if (!variantsByItem[v.menu_item_id]) {
        variantsByItem[v.menu_item_id] = [];
      }
      variantsByItem[v.menu_item_id].push(v);
    }

    const itemsWithVariants = itemsResult.rows.map((item) => ({
      ...item,
      variants: variantsByItem[item.id] || [],
    }));

    res.json({
      success: true,
      data: itemsWithVariants,
    });
  } catch (error) {
    next(error);
  }
});

// Get single menu item with its recipe configuration and variants
menuRouter.get('/items/:id', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const itemRes = await db.query(
      `SELECT m.*, c.name as category_name
       FROM menu_items m
       JOIN menu_categories c ON m.category_id = c.id
       WHERE m.id = $1`,
      [id]
    );

    if (itemRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Menu item not found' });
    }

    const recipeRes = await db.query(
      `SELECT r.id, r.quantity, r.unit, i.name as ingredient_name, i.current_stock, i.unit as ingredient_unit
       FROM menu_item_recipes r
       JOIN ingredients i ON r.ingredient_id = i.id
       WHERE r.menu_item_id = $1`,
      [id]
    );

    const variantsRes = await db.query(
      `SELECT id, variant_name, price, is_available
       FROM menu_item_variants
       WHERE menu_item_id = $1
       ORDER BY price ASC`,
      [id]
    );

    res.json({
      success: true,
      data: {
        ...itemRes.rows[0],
        variants: variantsRes.rows,
        recipe: recipeRes.rows,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Toggle menu item availability (86ing items when out of stock)
menuRouter.patch(
  '/items/:id/availability',
  authenticateToken,
  requireRole('ADMIN', 'MANAGER', 'KITCHEN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { isAvailable } = req.body;

      await db.query(
        'UPDATE menu_items SET is_available = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [isAvailable, id]
      );

      res.json({
        success: true,
        message: `Menu item availability updated`,
        data: { id, isAvailable },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Create new menu item (Admin / Manager)
const itemPayloadSchema = z.object({
  name: z.string().min(1, 'Item name is required'),
  categoryId: z.string().min(1, 'Category is required'),
  description: z.string().optional().default(''),
  price: z.number().min(0, 'Price must be positive'),
  taxRate: z.number().default(5.0),
  isVeg: z.boolean().default(true),
  isChefSpecial: z.boolean().default(false),
  isSpicy: z.boolean().default(false),
  prepTimeMinutes: z.number().default(10),
  imageUrl: z.string().optional(),
  isAvailable: z.boolean().default(true),
  variants: z
    .array(
      z.object({
        id: z.string().optional(),
        variantName: z.string().min(1),
        price: z.number().min(0),
        isAvailable: z.boolean().default(true),
      })
    )
    .optional(),
});

menuRouter.post(
  '/items',
  authenticateToken,
  requireRole('ADMIN', 'MANAGER'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const payload = itemPayloadSchema.parse(req.body);
      const itemId = `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

      await db.query(
        `INSERT INTO menu_items (
          id, category_id, name, description, price, tax_rate,
          is_veg, is_available, is_chef_special, is_spicy, image_url, prep_time_minutes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          itemId,
          payload.categoryId,
          payload.name,
          payload.description || '',
          payload.price,
          payload.taxRate || 5.0,
          payload.isVeg,
          payload.isAvailable,
          payload.isChefSpecial,
          payload.isSpicy,
          payload.imageUrl || null,
          payload.prepTimeMinutes || 10,
        ]
      );

      const insertedVariants: any[] = [];
      if (payload.variants && payload.variants.length > 0) {
        for (const v of payload.variants) {
          const varId = `var-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
          await db.query(
            `INSERT INTO menu_item_variants (id, menu_item_id, variant_name, price, is_available)
             VALUES ($1, $2, $3, $4, $5)`,
            [varId, itemId, v.variantName, v.price, v.isAvailable]
          );
          insertedVariants.push({
            id: varId,
            menu_item_id: itemId,
            variant_name: v.variantName,
            price: v.price,
            is_available: v.isAvailable,
          });
        }
      }

      // Fetch category name
      const catRes = await db.query('SELECT name FROM menu_categories WHERE id = $1', [payload.categoryId]);
      const categoryName = catRes.rows[0]?.name || 'General';

      res.status(201).json({
        success: true,
        message: 'Menu item created successfully',
        data: {
          id: itemId,
          category_id: payload.categoryId,
          category_name: categoryName,
          name: payload.name,
          description: payload.description,
          price: String(payload.price),
          tax_rate: String(payload.taxRate),
          is_veg: payload.isVeg,
          is_available: payload.isAvailable,
          is_chef_special: payload.isChefSpecial,
          is_spicy: payload.isSpicy,
          prep_time_minutes: payload.prepTimeMinutes,
          variants: insertedVariants,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Alter / Edit existing menu item (Admin / Manager)
menuRouter.put(
  '/items/:id',
  authenticateToken,
  requireRole('ADMIN', 'MANAGER'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const payload = itemPayloadSchema.parse(req.body);

      const updateRes = await db.query(
        `UPDATE menu_items 
         SET category_id = $1, name = $2, description = $3, price = $4,
             tax_rate = $5, is_veg = $6, is_available = $7, is_chef_special = $8,
             is_spicy = $9, prep_time_minutes = $10, updated_at = CURRENT_TIMESTAMP
         WHERE id = $11
         RETURNING *`,
        [
          payload.categoryId,
          payload.name,
          payload.description || '',
          payload.price,
          payload.taxRate || 5.0,
          payload.isVeg,
          payload.isAvailable,
          payload.isChefSpecial,
          payload.isSpicy,
          payload.prepTimeMinutes || 10,
          id,
        ]
      );

      if (updateRes.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Menu item not found' });
      }

      // Sync variants: Delete existing and re-insert
      await db.query('DELETE FROM menu_item_variants WHERE menu_item_id = $1', [id]);
      const insertedVariants: any[] = [];
      if (payload.variants && payload.variants.length > 0) {
        for (const v of payload.variants) {
          const varId = v.id || `var-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
          await db.query(
            `INSERT INTO menu_item_variants (id, menu_item_id, variant_name, price, is_available)
             VALUES ($1, $2, $3, $4, $5)`,
            [varId, id, v.variantName, v.price, v.isAvailable]
          );
          insertedVariants.push({
            id: varId,
            menu_item_id: id,
            variant_name: v.variantName,
            price: v.price,
            is_available: v.isAvailable,
          });
        }
      }

      const catRes = await db.query('SELECT name FROM menu_categories WHERE id = $1', [payload.categoryId]);
      const categoryName = catRes.rows[0]?.name || '';

      res.json({
        success: true,
        message: 'Menu item altered successfully',
        data: {
          ...updateRes.rows[0],
          category_name: categoryName,
          variants: insertedVariants,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Delete menu item (Admin)
menuRouter.delete(
  '/items/:id',
  authenticateToken,
  requireRole('ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      // Soft-delete or hard delete
      try {
        await db.query('DELETE FROM menu_item_variants WHERE menu_item_id = $1', [id]);
        await db.query('DELETE FROM menu_item_recipes WHERE menu_item_id = $1', [id]);
        await db.query('DELETE FROM menu_items WHERE id = $1', [id]);
      } catch (err) {
        // If referenced in order_items foreign key, mark unavailable and inactive
        await db.query('UPDATE menu_items SET is_available = FALSE WHERE id = $1', [id]);
      }

      res.json({
        success: true,
        message: 'Menu item deleted successfully',
        data: { id },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Create new category
menuRouter.post(
  '/categories',
  authenticateToken,
  requireRole('ADMIN', 'MANAGER'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, description } = req.body;
      if (!name || typeof name !== 'string') {
        return res.status(400).json({ success: false, error: 'Category name is required' });
      }

      const id = `cat-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

      const result = await db.query(
        `INSERT INTO menu_categories (id, name, slug, description, display_order, is_active)
         VALUES ($1, $2, $3, $4, (SELECT COALESCE(MAX(display_order), 0) + 1 FROM menu_categories), TRUE)
         RETURNING *`,
        [id, name.trim(), slug, description || '']
      );

      res.status(201).json({
        success: true,
        message: 'Category created',
        data: result.rows[0],
      });
    } catch (error) {
      next(error);
    }
  }
);
