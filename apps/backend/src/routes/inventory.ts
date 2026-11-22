import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validate.js';
import { logAudit } from '../middleware/audit.js';
import { inventoryService } from '../services/inventoryService.js';

export const inventoryRouter = Router();

// Validation Schemas
const createIngredientSchema = z.object({
  id: z.string().min(2).max(50),
  name: z.string().min(2).max(150),
  unit: z.enum(['kg', 'g', 'l', 'ml', 'pcs', 'portion']),
  initialStock: z.number().min(0).default(0),
  minThreshold: z.number().min(0).default(5),
  costPerUnit: z.number().min(0).default(0),
});

const updateIngredientSchema = z.object({
  name: z.string().min(2).max(150).optional(),
  unit: z.enum(['kg', 'g', 'l', 'ml', 'pcs', 'portion']).optional(),
  minThreshold: z.number().min(0).optional(),
  costPerUnit: z.number().min(0).optional(),
  isActive: z.boolean().optional(),
});

const restockSchema = z.object({
  ingredientId: z.string().min(1),
  quantity: z.number().positive('Quantity must be greater than 0'),
  costPerUnit: z.number().min(0).optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

const wastageSchema = z.object({
  ingredientId: z.string().min(1),
  quantity: z.number().positive('Quantity must be greater than 0'),
  reason: z.string().min(3, 'Please specify a reason for wastage'),
});

const reconcileSchema = z.object({
  ingredientId: z.string().min(1),
  actualCount: z.number().min(0, 'Physical count cannot be negative'),
  reason: z.string().min(3, 'Please specify a reason for reconciliation'),
});

const updateRecipeSchema = z.object({
  ingredients: z.array(
    z.object({
      ingredientId: z.string().min(1),
      quantity: z.number().positive('Recipe quantity must be greater than 0'),
      unit: z.string().min(1),
    })
  ),
});

// 1. List All Ingredients with Stock Valuations & Alerts
inventoryRouter.get(
  '/ingredients',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { lowStockOnly, search } = req.query;

      let query = `
        SELECT 
          i.*,
          ROUND((i.current_stock * i.cost_per_unit)::numeric, 2) as stock_valuation,
          CASE 
            WHEN i.current_stock <= 0 THEN 'OUT_OF_STOCK'
            WHEN i.current_stock <= i.min_threshold THEN 'LOW_STOCK'
            ELSE 'OPTIMAL'
          END as stock_status
        FROM ingredients i
        WHERE 1=1
      `;
      const params: any[] = [];

      if (lowStockOnly === 'true') {
        query += ` AND i.current_stock <= i.min_threshold`;
      }

      if (search && typeof search === 'string') {
        params.push(`%${search}%`);
        query += ` AND (i.name ILIKE $${params.length} OR i.id ILIKE $${params.length})`;
      }

      query += ` ORDER BY stock_status DESC, i.name ASC`;

      const result = await db.query(query, params);

      // Summary statistics
      let totalValuation = 0;
      let lowStockCount = 0;
      let outOfStockCount = 0;

      for (const row of result.rows) {
        totalValuation += Number(row.stock_valuation || 0);
        if (row.stock_status === 'LOW_STOCK') lowStockCount++;
        if (row.stock_status === 'OUT_OF_STOCK') outOfStockCount++;
      }

      res.json({
        success: true,
        summary: {
          totalIngredients: result.rows.length,
          lowStockCount,
          outOfStockCount,
          totalValuation: Math.round(totalValuation * 100) / 100,
        },
        data: result.rows,
      });
    } catch (error) {
      next(error);
    }
  }
);

// 2. Create New Raw Ingredient
inventoryRouter.post(
  '/ingredients',
  authenticateToken,
  requireRole('ADMIN', 'MANAGER'),
  validateRequest({ body: createIngredientSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id, name, unit, initialStock, minThreshold, costPerUnit } = req.body;

      const existing = await db.query('SELECT id FROM ingredients WHERE id = $1', [id]);
      if (existing.rows.length > 0) {
        return res.status(400).json({ success: false, error: `Ingredient with ID '${id}' already exists` });
      }

      await db.transaction(async (client) => {
        await client.query(
          `INSERT INTO ingredients (id, name, unit, current_stock, min_threshold, cost_per_unit)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [id, name, unit, initialStock, minThreshold, costPerUnit]
        );

        if (initialStock > 0) {
          await client.query(
            `INSERT INTO stock_movements (
              id, ingredient_id, movement_type, quantity, balance_after, reference_id, notes, created_by
            )
            VALUES ($1, $2, 'PURCHASE', $3, $3, 'INITIAL-STOCK', 'Initial ingredient creation', $4)`,
            [`sm-init-${id}`, id, initialStock, req.user!.id]
          );
        }
      });

      await logAudit({
        userId: req.user!.id,
        action: 'INGREDIENT_CREATED',
        entityType: 'INVENTORY',
        entityId: id,
        details: { name, unit, initialStock, minThreshold, costPerUnit },
      });

      res.status(201).json({
        success: true,
        message: `Ingredient '${name}' created successfully`,
        data: { id, name, unit, current_stock: initialStock, min_threshold: minThreshold, cost_per_unit: costPerUnit },
      });
    } catch (error) {
      next(error);
    }
  }
);

// 3. Update Ingredient
inventoryRouter.patch(
  '/ingredients/:id',
  authenticateToken,
  requireRole('ADMIN', 'MANAGER'),
  validateRequest({ body: updateIngredientSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const { name, unit, minThreshold, costPerUnit, isActive } = req.body;

      const ingRes = await db.query('SELECT * FROM ingredients WHERE id = $1', [id]);
      if (ingRes.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Ingredient not found' });
      }

      const updates: string[] = [];
      const values: any[] = [];

      if (name !== undefined) {
        values.push(name);
        updates.push(`name = $${values.length}`);
      }
      if (unit !== undefined) {
        values.push(unit);
        updates.push(`unit = $${values.length}`);
      }
      if (minThreshold !== undefined) {
        values.push(minThreshold);
        updates.push(`min_threshold = $${values.length}`);
      }
      if (costPerUnit !== undefined) {
        values.push(costPerUnit);
        updates.push(`cost_per_unit = $${values.length}`);
      }
      if (isActive !== undefined) {
        values.push(isActive);
        updates.push(`is_active = $${values.length}`);
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(id);

      const updateQuery = `UPDATE ingredients SET ${updates.join(', ')} WHERE id = $${values.length} RETURNING *`;
      const result = await db.query(updateQuery, values);

      await logAudit({
        userId: req.user!.id,
        action: 'INGREDIENT_UPDATED',
        entityType: 'INVENTORY',
        entityId: id,
        details: req.body,
      });

      res.json({
        success: true,
        message: 'Ingredient updated successfully',
        data: result.rows[0],
      });
    } catch (error) {
      next(error);
    }
  }
);

// 4. Low-Stock Alerts Endpoint
inventoryRouter.get(
  '/alerts',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await db.query(`
        SELECT 
          i.*,
          (i.min_threshold - i.current_stock) as shortage,
          ROUND((i.current_stock * i.cost_per_unit)::numeric, 2) as stock_valuation
        FROM ingredients i
        WHERE i.current_stock <= i.min_threshold AND i.is_active = TRUE
        ORDER BY (i.min_threshold - i.current_stock) DESC
      `);

      res.json({
        success: true,
        count: result.rows.length,
        data: result.rows,
      });
    } catch (error) {
      next(error);
    }
  }
);

// 5. Stock Movement Ledger (Audit Log of all Purchases, Consumptions, Wastage, Adjustments)
inventoryRouter.get(
  '/ledger',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { ingredientId, movementType, limit = 50, offset = 0 } = req.query;

      let query = `
        SELECT 
          sm.*,
          i.name as ingredient_name,
          i.unit as ingredient_unit,
          u.full_name as created_by_name,
          u.role as created_by_role
        FROM stock_movements sm
        JOIN ingredients i ON sm.ingredient_id = i.id
        LEFT JOIN users u ON sm.created_by = u.id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (ingredientId && typeof ingredientId === 'string') {
        params.push(ingredientId);
        query += ` AND sm.ingredient_id = $${params.length}`;
      }

      if (movementType && typeof movementType === 'string') {
        params.push(movementType);
        query += ` AND sm.movement_type = $${params.length}`;
      }

      query += ` ORDER BY sm.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(Number(limit), Number(offset));

      const result = await db.query(query, params);

      // Also get count
      let countQuery = `SELECT COUNT(sm.id) as total FROM stock_movements sm WHERE 1=1`;
      const countParams: any[] = [];
      if (ingredientId && typeof ingredientId === 'string') {
        countParams.push(ingredientId);
        countQuery += ` AND sm.ingredient_id = $${countParams.length}`;
      }
      if (movementType && typeof movementType === 'string') {
        countParams.push(movementType);
        countQuery += ` AND sm.movement_type = $${countParams.length}`;
      }
      const countRes = await db.query(countQuery, countParams);

      res.json({
        success: true,
        total: parseInt(countRes.rows[0].total, 10),
        limit: Number(limit),
        offset: Number(offset),
        data: result.rows,
      });
    } catch (error) {
      next(error);
    }
  }
);

// 6. Restock / Purchase Stock Inflow
inventoryRouter.post(
  '/restock',
  authenticateToken,
  requireRole('ADMIN', 'MANAGER'),
  validateRequest({ body: restockSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { ingredientId, quantity, costPerUnit, reference, notes } = req.body;

      const result = await inventoryService.restockIngredient({
        ingredientId,
        quantity,
        costPerUnit,
        reference,
        notes,
        userId: req.user!.id,
      });

      res.status(201).json({
        success: true,
        message: `Restocked ${quantity} ${result.unit} of ${result.name}`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

// 7. Record Spoilage / Wastage
inventoryRouter.post(
  '/wastage',
  authenticateToken,
  requireRole('ADMIN', 'MANAGER', 'KITCHEN'),
  validateRequest({ body: wastageSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { ingredientId, quantity, reason } = req.body;

      const result = await inventoryService.recordWastage({
        ingredientId,
        quantity,
        reason,
        userId: req.user!.id,
      });

      res.status(201).json({
        success: true,
        message: `Recorded wastage of ${quantity} ${result.unit} for ${result.name}`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

// 8. Reconcile / Stock Take Adjustment
inventoryRouter.post(
  '/reconcile',
  authenticateToken,
  requireRole('ADMIN', 'MANAGER'),
  validateRequest({ body: reconcileSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { ingredientId, actualCount, reason } = req.body;

      const result = await inventoryService.reconcileStock({
        ingredientId,
        actualCount,
        reason,
        userId: req.user!.id,
      });

      res.json({
        success: true,
        message: `Reconciled ${result.name}: stock adjusted to ${actualCount} ${result.unit} (Variance: ${result.variance})`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

// 9. Get All Recipes with Ingredients
inventoryRouter.get(
  '/recipes',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await db.query(`
        SELECT 
          r.id as recipe_id,
          r.menu_item_id,
          m.name as item_name,
          m.category_id,
          c.name as category_name,
          r.ingredient_id,
          i.name as ingredient_name,
          r.quantity,
          r.unit,
          ROUND((r.quantity * i.cost_per_unit)::numeric, 2) as ingredient_cost
        FROM menu_item_recipes r
        JOIN menu_items m ON r.menu_item_id = m.id
        JOIN menu_categories c ON m.category_id = c.id
        JOIN ingredients i ON r.ingredient_id = i.id
        ORDER BY c.display_order ASC, m.name ASC, i.name ASC
      `);

      // Group by menu item
      const recipesByItem: Record<string, any> = {};
      for (const row of result.rows) {
        if (!recipesByItem[row.menu_item_id]) {
          recipesByItem[row.menu_item_id] = {
            menu_item_id: row.menu_item_id,
            item_name: row.item_name,
            category_name: row.category_name,
            total_recipe_cost: 0,
            ingredients: [],
          };
        }
        recipesByItem[row.menu_item_id].ingredients.push({
          recipe_id: row.recipe_id,
          ingredient_id: row.ingredient_id,
          ingredient_name: row.ingredient_name,
          quantity: Number(row.quantity),
          unit: row.unit,
          ingredient_cost: Number(row.ingredient_cost),
        });
        recipesByItem[row.menu_item_id].total_recipe_cost = 
          Math.round((recipesByItem[row.menu_item_id].total_recipe_cost + Number(row.ingredient_cost)) * 100) / 100;
      }

      res.json({
        success: true,
        data: Object.values(recipesByItem),
      });
    } catch (error) {
      next(error);
    }
  }
);

// 10. Get Recipe for Single Menu Item
inventoryRouter.get(
  '/recipes/:menuItemId',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const menuItemId = req.params.menuItemId as string;

      const result = await db.query(
        `SELECT 
          r.id as recipe_id,
          r.ingredient_id,
          i.name as ingredient_name,
          i.current_stock,
          i.cost_per_unit,
          r.quantity,
          r.unit,
          ROUND((r.quantity * i.cost_per_unit)::numeric, 2) as ingredient_cost
        FROM menu_item_recipes r
        JOIN ingredients i ON r.ingredient_id = i.id
        WHERE r.menu_item_id = $1`,
        [menuItemId]
      );

      res.json({
        success: true,
        data: result.rows,
      });
    } catch (error) {
      next(error);
    }
  }
);

// 11. Configure / Update Recipe for Menu Item
inventoryRouter.put(
  '/recipes/:menuItemId',
  authenticateToken,
  requireRole('ADMIN', 'MANAGER'),
  validateRequest({ body: updateRecipeSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const menuItemId = req.params.menuItemId as string;
      const { ingredients } = req.body;

      const itemRes = await db.query('SELECT name FROM menu_items WHERE id = $1', [menuItemId]);
      if (itemRes.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Menu item not found' });
      }

      await db.transaction(async (client) => {
        // Clear previous recipe definitions for this item
        await client.query('DELETE FROM menu_item_recipes WHERE menu_item_id = $1', [menuItemId]);

        // Insert new recipe mappings
        for (let i = 0; i < ingredients.length; i++) {
          const ing = ingredients[i];
          const recipeId = `rcp-${menuItemId}-${ing.ingredientId}`;

          await client.query(
            `INSERT INTO menu_item_recipes (id, menu_item_id, ingredient_id, quantity, unit)
             VALUES ($1, $2, $3, $4, $5)`,
            [recipeId, menuItemId, ing.ingredientId, ing.quantity, ing.unit]
          );
        }
      });

      await logAudit({
        userId: req.user!.id,
        action: 'RECIPE_CONFIGURED',
        entityType: 'INVENTORY',
        entityId: menuItemId,
        details: { itemName: itemRes.rows[0].name, ingredientsCount: ingredients.length },
      });

      res.json({
        success: true,
        message: `Recipe for '${itemRes.rows[0].name}' updated with ${ingredients.length} ingredient(s)`,
      });
    } catch (error) {
      next(error);
    }
  }
);
