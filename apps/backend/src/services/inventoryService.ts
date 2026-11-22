import { db } from '../db/index.js';
import { realTime } from '../socket/index.js';
import { logAudit } from '../middleware/audit.js';

export interface DeductStockResult {
  deducted: boolean;
  reason?: string;
  orderNumber?: string;
  itemsProcessed?: number;
  ingredientsDeducted?: Array<{
    ingredientId: string;
    ingredientName: string;
    quantityDeducted: number;
    unit: string;
    remainingStock: number;
    isLowStock: boolean;
  }>;
}

export interface ReverseStockResult {
  reversed: boolean;
  reason?: string;
  orderNumber?: string;
  movementsCount?: number;
  isWasted?: boolean;
}

export const inventoryService = {
  /**
   * Deducts raw ingredients based on recipes when an order is being prepared.
   * Idempotent: Skips deduction if already deducted for this order.
   */
  async deductOrderStock(orderId: string, performedByUserId: string): Promise<DeductStockResult> {
    // 1. Check idempotency: Have we already deducted for this order?
    const existingCheck = await db.query(
      `SELECT id FROM stock_movements WHERE reference_id = $1 AND movement_type = 'CONSUMPTION' LIMIT 1`,
      [orderId]
    );

    if (existingCheck.rows.length > 0) {
      return {
        deducted: false,
        reason: 'ALREADY_DEDUCTED',
      };
    }

    // 2. Fetch order and its items
    const orderRes = await db.query(
      `SELECT o.id, o.order_number, o.status FROM orders o WHERE o.id = $1`,
      [orderId]
    );

    if (orderRes.rows.length === 0) {
      return { deducted: false, reason: 'ORDER_NOT_FOUND' };
    }

    const order = orderRes.rows[0];

    const itemsRes = await db.query(
      `SELECT oi.id, oi.menu_item_id, oi.variant_name, oi.quantity, m.name as item_name
       FROM order_items oi
       JOIN menu_items m ON oi.menu_item_id = m.id
       WHERE oi.order_id = $1`,
      [orderId]
    );

    if (itemsRes.rows.length === 0) {
      return { deducted: false, reason: 'NO_ITEMS_IN_ORDER' };
    }

    // 3. Collect ingredient requirements across all items
    // (menu_item_id + variant multiplier)
    const ingredientDeductionsMap = new Map<
      string,
      {
        ingredientId: string;
        ingredientName: string;
        unit: string;
        totalQty: number;
        itemBreakdown: string[];
      }
    >();

    for (const item of itemsRes.rows) {
      const recipesRes = await db.query(
        `SELECT r.ingredient_id, r.quantity as recipe_qty, r.unit as recipe_unit, 
                i.name as ingredient_name, i.unit as ingredient_unit, i.current_stock, i.min_threshold
         FROM menu_item_recipes r
         JOIN ingredients i ON r.ingredient_id = i.id
         WHERE r.menu_item_id = $1`,
        [item.menu_item_id]
      );

      // Large variant uses 1.5x portion multiplier
      const portionMultiplier = item.variant_name === 'LRG' ? 1.5 : 1.0;

      for (const recipe of recipesRes.rows) {
        const requiredQty = Math.round(Number(recipe.recipe_qty) * Number(item.quantity) * portionMultiplier * 1000) / 1000;
        const ingId = recipe.ingredient_id;

        if (ingredientDeductionsMap.has(ingId)) {
          const cur = ingredientDeductionsMap.get(ingId)!;
          cur.totalQty = Math.round((cur.totalQty + requiredQty) * 1000) / 1000;
          cur.itemBreakdown.push(`${item.item_name} x${item.quantity}`);
        } else {
          ingredientDeductionsMap.set(ingId, {
            ingredientId: ingId,
            ingredientName: recipe.ingredient_name,
            unit: recipe.ingredient_unit,
            totalQty: requiredQty,
            itemBreakdown: [`${item.item_name} x${item.quantity}`],
          });
        }
      }
    }

    if (ingredientDeductionsMap.size === 0) {
      return {
        deducted: true,
        orderNumber: order.order_number,
        itemsProcessed: itemsRes.rows.length,
        ingredientsDeducted: [],
      };
    }

    const deductedList: DeductStockResult['ingredientsDeducted'] = [];

    // 4. Atomically apply stock deductions in a transaction
    await db.transaction(async (client) => {
      for (const [ingId, req] of ingredientDeductionsMap.entries()) {
        const movementId = `sm-cons-${orderId}-${ingId}`;

        // Deduct from ingredients table
        const updateRes = await client.query(
          `UPDATE ingredients 
           SET current_stock = GREATEST(0, current_stock - $1), updated_at = CURRENT_TIMESTAMP
           WHERE id = $2
           RETURNING current_stock, min_threshold, name`,
          [req.totalQty, ingId]
        );

        const newStock = Number(updateRes.rows[0].current_stock);
        const threshold = Number(updateRes.rows[0].min_threshold);
        const isLowStock = newStock <= threshold;

        // Insert into stock movement ledger
        const notes = `Order #${order.order_number}: ${req.itemBreakdown.join(', ')}`;
        await client.query(
          `INSERT INTO stock_movements (
            id, ingredient_id, movement_type, quantity, balance_after, reference_id, notes, created_by
          )
          VALUES ($1, $2, 'CONSUMPTION', $3, $4, $5, $6, $7)`,
          [
            movementId,
            ingId,
            -req.totalQty, // negative indicates stock outflow
            newStock,
            orderId,
            notes,
            performedByUserId,
          ]
        );

        deductedList.push({
          ingredientId: ingId,
          ingredientName: req.ingredientName,
          quantityDeducted: req.totalQty,
          unit: req.unit,
          remainingStock: newStock,
          isLowStock,
        });

        // Trigger real-time low-stock alert if below threshold
        if (isLowStock) {
          realTime.emitToStaff('inventory:low_stock', {
            ingredientId: ingId,
            name: req.ingredientName,
            currentStock: newStock,
            minThreshold: threshold,
            unit: req.unit,
          });
        }
      }
    });

    // Real-time notification of stock update
    realTime.emitToStaff('inventory:stock_updated', {
      orderId,
      orderNumber: order.order_number,
      deductionsCount: deductedList.length,
    });

    return {
      deducted: true,
      orderNumber: order.order_number,
      itemsProcessed: itemsRes.rows.length,
      ingredientsDeducted: deductedList,
    };
  },

  /**
   * Reverses or writes off stock deductions when an order is cancelled.
   * If isWasted is true, raw ingredients were already cooked and thrown away,
   * so they are recorded as WASTAGE rather than returning stock.
   */
  async reverseOrderStock(
    orderId: string,
    performedByUserId: string,
    reason: string,
    isWasted: boolean = false
  ): Promise<ReverseStockResult> {
    // 1. Check if order had consumption movements
    const consRes = await db.query(
      `SELECT sm.*, i.name as ingredient_name
       FROM stock_movements sm
       JOIN ingredients i ON sm.ingredient_id = i.id
       WHERE sm.reference_id = $1 AND sm.movement_type = 'CONSUMPTION'`,
      [orderId]
    );

    if (consRes.rows.length === 0) {
      return { reversed: false, reason: 'NO_CONSUMPTION_RECORD' };
    }

    // 2. Check if already reversed or marked as wasted
    const revCheck = await db.query(
      `SELECT id FROM stock_movements WHERE reference_id = $1 AND movement_type IN ('REVERSAL', 'WASTAGE') LIMIT 1`,
      [orderId]
    );

    if (revCheck.rows.length > 0) {
      return { reversed: false, reason: 'ALREADY_REVERSED' };
    }

    const orderRes = await db.query(`SELECT order_number FROM orders WHERE id = $1`, [orderId]);
    const orderNumber = orderRes.rows[0]?.order_number || orderId;

    await db.transaction(async (client) => {
      for (const sm of consRes.rows) {
        const qtyToReverse = Math.abs(Number(sm.quantity));
        const revId = `sm-rev-${orderId}-${sm.ingredient_id}`;

        if (isWasted) {
          // Food was prepared and discarded: stock is NOT restored
          const currentRes = await client.query(`SELECT current_stock FROM ingredients WHERE id = $1`, [sm.ingredient_id]);
          const currentStock = Number(currentRes.rows[0]?.current_stock || 0);

          await client.query(
            `INSERT INTO stock_movements (
              id, ingredient_id, movement_type, quantity, balance_after, reference_id, notes, created_by
            )
            VALUES ($1, $2, 'WASTAGE', $3, $4, $5, $6, $7)`,
            [
              revId,
              sm.ingredient_id,
              -qtyToReverse,
              currentStock,
              orderId,
              `Kitchen Wastage for Cancelled Order #${orderNumber}: ${reason}`,
              performedByUserId,
            ]
          );
        } else {
          // Ingredients were not yet prepared or returned to stock: restore balance
          const updateRes = await client.query(
            `UPDATE ingredients 
             SET current_stock = current_stock + $1, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2
             RETURNING current_stock`,
            [qtyToReverse, sm.ingredient_id]
          );

          const newStock = Number(updateRes.rows[0].current_stock);

          await client.query(
            `INSERT INTO stock_movements (
              id, ingredient_id, movement_type, quantity, balance_after, reference_id, notes, created_by
            )
            VALUES ($1, $2, 'REVERSAL', $3, $4, $5, $6, $7)`,
            [
              revId,
              sm.ingredient_id,
              qtyToReverse, // positive indicates stock restoration
              newStock,
              orderId,
              `Stock Reversal for Cancelled Order #${orderNumber}: ${reason}`,
              performedByUserId,
            ]
          );
        }
      }
    });

    realTime.emitToStaff('inventory:stock_updated', {
      orderId,
      orderNumber,
      action: isWasted ? 'WASTAGE_RECORDED' : 'STOCK_REVERSED',
    });

    await logAudit({
      userId: performedByUserId,
      action: isWasted ? 'ORDER_STOCK_WASTED' : 'ORDER_STOCK_REVERSED',
      entityType: 'ORDER',
      entityId: orderId,
      details: { orderNumber, reason, isWasted, count: consRes.rows.length },
    });

    return {
      reversed: true,
      orderNumber,
      movementsCount: consRes.rows.length,
      isWasted,
    };
  },

  /**
   * Records purchase / restocking of an ingredient.
   */
  async restockIngredient(params: {
    ingredientId: string;
    quantity: number;
    costPerUnit?: number;
    reference?: string;
    notes?: string;
    userId: string;
  }) {
    const { ingredientId, quantity, costPerUnit, reference, notes, userId } = params;

    const ingRes = await db.query(`SELECT * FROM ingredients WHERE id = $1`, [ingredientId]);
    if (ingRes.rows.length === 0) {
      throw new Error(`Ingredient ${ingredientId} not found`);
    }

    const ing = ingRes.rows[0];
    const movementId = `sm-pur-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    let newStock = 0;
    await db.transaction(async (client) => {
      const updateRes = await client.query(
        `UPDATE ingredients 
         SET current_stock = current_stock + $1,
             cost_per_unit = COALESCE($2, cost_per_unit),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING current_stock, cost_per_unit`,
        [quantity, costPerUnit !== undefined ? costPerUnit : null, ingredientId]
      );

      newStock = Number(updateRes.rows[0].current_stock);

      await client.query(
        `INSERT INTO stock_movements (
          id, ingredient_id, movement_type, quantity, balance_after, reference_id, notes, created_by
        )
        VALUES ($1, $2, 'PURCHASE', $3, $4, $5, $6, $7)`,
        [
          movementId,
          ingredientId,
          quantity,
          newStock,
          reference || 'RESTOCK-MANUAL',
          notes || `Restocked ${quantity} ${ing.unit}`,
          userId,
        ]
      );
    });

    realTime.emitToStaff('inventory:stock_updated', {
      ingredientId,
      name: ing.name,
      newStock,
      movementType: 'PURCHASE',
    });

    await logAudit({
      userId,
      action: 'INVENTORY_RESTOCKED',
      entityType: 'INVENTORY',
      entityId: ingredientId,
      details: { ingredientName: ing.name, quantity, newStock, reference, costPerUnit },
    });

    return {
      ingredientId,
      name: ing.name,
      addedQuantity: quantity,
      currentStock: newStock,
      unit: ing.unit,
    };
  },

  /**
   * Records kitchen spoilage or physical wastage.
   */
  async recordWastage(params: {
    ingredientId: string;
    quantity: number;
    reason: string;
    userId: string;
  }) {
    const { ingredientId, quantity, reason, userId } = params;

    const ingRes = await db.query(`SELECT * FROM ingredients WHERE id = $1`, [ingredientId]);
    if (ingRes.rows.length === 0) {
      throw new Error(`Ingredient ${ingredientId} not found`);
    }

    const ing = ingRes.rows[0];
    const movementId = `sm-wst-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    let newStock = 0;
    await db.transaction(async (client) => {
      const updateRes = await client.query(
        `UPDATE ingredients 
         SET current_stock = GREATEST(0, current_stock - $1),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING current_stock, min_threshold`,
        [quantity, ingredientId]
      );

      newStock = Number(updateRes.rows[0].current_stock);
      const threshold = Number(updateRes.rows[0].min_threshold);

      await client.query(
        `INSERT INTO stock_movements (
          id, ingredient_id, movement_type, quantity, balance_after, reference_id, notes, created_by
        )
        VALUES ($1, $2, 'WASTAGE', $3, $4, $5, $6, $7)`,
        [
          movementId,
          ingredientId,
          -quantity,
          newStock,
          `WASTE-${Date.now()}`,
          reason,
          userId,
        ]
      );

      if (newStock <= threshold) {
        realTime.emitToStaff('inventory:low_stock', {
          ingredientId,
          name: ing.name,
          currentStock: newStock,
          minThreshold: threshold,
          unit: ing.unit,
        });
      }
    });

    realTime.emitToStaff('inventory:stock_updated', {
      ingredientId,
      name: ing.name,
      newStock,
      movementType: 'WASTAGE',
    });

    await logAudit({
      userId,
      action: 'INVENTORY_WASTAGE_RECORDED',
      entityType: 'INVENTORY',
      entityId: ingredientId,
      details: { ingredientName: ing.name, quantityWasted: quantity, remainingStock: newStock, reason },
    });

    return {
      ingredientId,
      name: ing.name,
      wastedQuantity: quantity,
      remainingStock: newStock,
      unit: ing.unit,
    };
  },

  /**
   * Reconciles physical stock count against system records (inventory adjustment).
   */
  async reconcileStock(params: {
    ingredientId: string;
    actualCount: number;
    reason: string;
    userId: string;
  }) {
    const { ingredientId, actualCount, reason, userId } = params;

    const ingRes = await db.query(`SELECT * FROM ingredients WHERE id = $1`, [ingredientId]);
    if (ingRes.rows.length === 0) {
      throw new Error(`Ingredient ${ingredientId} not found`);
    }

    const ing = ingRes.rows[0];
    const previousStock = Number(ing.current_stock);
    const variance = Math.round((actualCount - previousStock) * 1000) / 1000;
    const movementId = `sm-adj-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    await db.transaction(async (client) => {
      await client.query(
        `UPDATE ingredients 
         SET current_stock = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [actualCount, ingredientId]
      );

      await client.query(
        `INSERT INTO stock_movements (
          id, ingredient_id, movement_type, quantity, balance_after, reference_id, notes, created_by
        )
        VALUES ($1, $2, 'ADJUSTMENT', $3, $4, $5, $6, $7)`,
        [
          movementId,
          ingredientId,
          variance,
          actualCount,
          `ADJ-${Date.now()}`,
          `Inventory Reconciliation: ${reason} (System: ${previousStock}, Counted: ${actualCount}, Variance: ${variance > 0 ? '+' : ''}${variance})`,
          userId,
        ]
      );
    });

    realTime.emitToStaff('inventory:stock_updated', {
      ingredientId,
      name: ing.name,
      newStock: actualCount,
      movementType: 'ADJUSTMENT',
    });

    await logAudit({
      userId,
      action: 'INVENTORY_RECONCILED',
      entityType: 'INVENTORY',
      entityId: ingredientId,
      details: { ingredientName: ing.name, previousStock, actualCount, variance, reason },
    });

    return {
      ingredientId,
      name: ing.name,
      previousStock,
      actualCount,
      variance,
      unit: ing.unit,
    };
  },
};
