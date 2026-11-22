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
