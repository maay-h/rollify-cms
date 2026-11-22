import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validate.js';
import { logAudit } from '../middleware/audit.js';
import { realTime } from '../socket/index.js';
import { inventoryService } from '../services/inventoryService.js';

export const ordersRouter = Router();

// Validation schemas
const createOrderItemSchema = z.object({
  menuItemId: z.string().min(1),
  variantId: z.string().optional(),
  variantName: z.string().optional(),
  quantity: z.number().int().positive().default(1),
  unitPrice: z.number().positive(),
  notes: z.string().optional(),
});

const createOrderSchema = z.object({
  orderType: z.enum(['DINE_IN', 'TAKEAWAY', 'DELIVERY', 'QR_CUSTOMER']).default('DINE_IN'),
  tableId: z.string().optional().nullable(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(createOrderItemSchema).min(1, 'Order must contain at least one item'),
  autoSendToKitchen: z.boolean().default(false),
});

const addItemsSchema = z.object({
  items: z.array(createOrderItemSchema).min(1),
});

const updateStatusSchema = z.object({
  status: z.enum(['CREATED', 'SENT_TO_KITCHEN', 'PREPARING', 'READY', 'SERVED', 'COMPLETED', 'CANCELLED']),
  notes: z.string().optional(),
  isWasted: z.boolean().optional().default(false),
});

// Helper to generate human-readable unique order numbers (e.g. ROL-20261122-0042)
async function generateOrderNumber(): Promise<string> {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const countRes = await db.query(
    `SELECT COUNT(*) as count FROM orders WHERE order_number LIKE $1`,
    [`ROL-${dateStr}-%`]
  );
  const nextSeq = (parseInt(countRes.rows[0].count, 10) + 1).toString().padStart(4, '0');
  return `ROL-${dateStr}-${nextSeq}`;
}

// 1. Create a new Order (Waiter, Cashier, Admin, Manager)
ordersRouter.post(
  '/',
  authenticateToken,
  validateRequest({ body: createOrderSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        orderType,
        tableId,
        customerName,
        customerPhone,
        notes,
        items,
        autoSendToKitchen,
      } = req.body;

      // Calculate totals
      let subtotal = 0;
      for (const item of items) {
        subtotal += item.unitPrice * item.quantity;
      }
      // Standard 5% GST
      const taxRate = 5.0;
      const taxAmount = Math.round((subtotal * (taxRate / 100)) * 100) / 100;
      // Parcel charge ₹10 if takeaway/delivery
      const parcelCharge = (orderType === 'TAKEAWAY' || orderType === 'DELIVERY') ? 10.0 : 0.0;
      const totalAmount = Math.round((subtotal + taxAmount + parcelCharge) * 100) / 100;

      const orderId = `ord-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const orderNumber = await generateOrderNumber();
      const initialStatus = autoSendToKitchen ? 'SENT_TO_KITCHEN' : 'CREATED';

      const result = await db.transaction(async (client) => {
        // If Dine-in with table, verify table exists and set it to OCCUPIED
        let tableNumber = null;
        if (tableId) {
          const tableCheck = await client.query('SELECT table_number, status FROM dining_tables WHERE id = $1', [tableId]);
          if (tableCheck.rows.length === 0) {
            throw new Error(`Dining table not found: ${tableId}`);
          }
          tableNumber = tableCheck.rows[0].table_number;
          await client.query(
            `UPDATE dining_tables SET status = 'OCCUPIED', current_order_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
            [orderId, tableId]
          );
        }

        // Insert Order
        await client.query(
          `INSERT INTO orders (
            id, order_number, order_type, table_id, customer_name, customer_phone,
            status, subtotal, discount_amount, tax_amount, total_amount, payment_status,
            notes, waiter_id, created_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0.00, $9, $10, 'UNPAID', $11, $12, $12)`,
          [
            orderId,
            orderNumber,
            orderType,
            tableId || null,
            customerName || null,
            customerPhone || null,
            initialStatus,
            subtotal,
            taxAmount,
            totalAmount,
            notes || (parcelCharge > 0 ? 'Parcel charges ₹10 included' : null),
            req.user!.id,
          ]
        );

        // Insert Order Items
        const insertedItems: any[] = [];
        for (let idx = 0; idx < items.length; idx++) {
          const it = items[idx];
          const itemId = `oi-${Date.now()}-${idx + 1}`;
          const itemSubtotal = Math.round((it.unitPrice * it.quantity) * 100) / 100;
          const itemStatus = autoSendToKitchen ? 'COOKING' : 'PENDING';

          await client.query(
            `INSERT INTO order_items (
              id, order_id, menu_item_id, variant_id, variant_name, quantity,
              unit_price, tax_rate, subtotal, notes, item_status
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
              itemId,
              orderId,
              it.menuItemId,
              it.variantId || null,
              it.variantName || null,
              it.quantity,
              it.unitPrice,
              5.00,
              itemSubtotal,
              it.notes || null,
              itemStatus,
            ]
          );

          insertedItems.push({
            id: itemId,
            ...it,
            subtotal: itemSubtotal,
            itemStatus,
          });
        }

        // Record Initial Timeline Event
        await client.query(
          `INSERT INTO order_timeline (id, order_id, action, from_status, to_status, notes, performed_by)
           VALUES ($1, $2, 'ORDER_CREATED', NULL, $3, $4, $5)`,
          [
            `ot-${Date.now()}-1`,
            orderId,
            initialStatus,
            autoSendToKitchen ? 'Order created and sent directly to kitchen' : 'Order placed at terminal',
            req.user!.id,
          ]
        );

        return {
          orderId,
          orderNumber,
          orderType,
          tableId,
          tableNumber,
          status: initialStatus,
          subtotal,
          taxAmount,
          parcelCharge,
          totalAmount,
          items: insertedItems,
        };
      });

      // Audit Log
      await logAudit({
        userId: req.user!.id,
        action: 'ORDER_CREATED',
        entityType: 'ORDER',
        entityId: result.orderId,
        details: {
          orderNumber: result.orderNumber,
          totalAmount: result.totalAmount,
          tableId,
          itemCount: items.length,
        },
      });

      // Real-time broadcast
      realTime.emitToStaff('order:new', result);
      if (autoSendToKitchen) {
        realTime.emitToRole('KITCHEN', 'order:kitchen_ticket', result);
      }

      res.status(201).json({
        success: true,
        message: `Order ${result.orderNumber} created successfully`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

// 2. List Orders (with filters for status, table, active only)
ordersRouter.get('/', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, activeOnly, tableId } = req.query;

    let query = `
      SELECT 
        o.id,
        o.order_number,
        o.order_type,
        o.table_id,
        t.table_number,
        t.section as table_section,
        o.customer_name,
        o.customer_phone,
        o.status,
        o.subtotal,
        o.discount_amount,
        o.tax_amount,
        o.total_amount,
        o.payment_status,
        o.notes,
        o.waiter_id,
        u.full_name as waiter_name,
        o.created_at,
        o.updated_at,
        COUNT(oi.id) as item_count
      FROM orders o
      LEFT JOIN dining_tables t ON o.table_id = t.id
      LEFT JOIN users u ON o.waiter_id = u.id
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (activeOnly === 'true') {
      params.push('COMPLETED', 'CANCELLED');
      query += ` AND o.status NOT IN ($1, $2)`;
    } else if (status && typeof status === 'string') {
      params.push(status);
      query += ` AND o.status = $${params.length}`;
    }

    if (tableId && typeof tableId === 'string') {
      params.push(tableId);
      query += ` AND o.table_id = $${params.length}`;
    }

    query += `
      GROUP BY o.id, t.table_number, t.section, u.full_name
      ORDER BY o.created_at DESC
      LIMIT 100
    `;

    const ordersRes = await db.query(query, params);

    // Fetch items for each active order
    const orderIds = ordersRes.rows.map((o: any) => o.id);
    let itemsByOrder: Record<string, any[]> = {};

    if (orderIds.length > 0) {
      const itemsRes = await db.query(
        `SELECT 
          oi.*, 
          m.name as item_name, 
          m.is_veg, 
          m.is_chef_special,
          m.is_spicy
         FROM order_items oi
         JOIN menu_items m ON oi.menu_item_id = m.id
         WHERE oi.order_id = ANY($1)
         ORDER BY oi.created_at ASC`,
        [orderIds]
      );

      for (const item of itemsRes.rows) {
        if (!itemsByOrder[item.order_id]) {
          itemsByOrder[item.order_id] = [];
        }
        itemsByOrder[item.order_id].push(item);
      }
    }

    const fullOrders = ordersRes.rows.map((o: any) => ({
      ...o,
      items: itemsByOrder[o.id] || [],
    }));

    res.json({
      success: true,
      data: fullOrders,
    });
  } catch (error) {
    next(error);
  }
});

// 3. Active Kitchen Display System (KDS) Tickets
ordersRouter.get('/kitchen/active', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = `
      SELECT 
        o.id,
        o.order_number,
        o.order_type,
        o.table_id,
        t.table_number,
        t.section as table_section,
        o.customer_name,
        o.status,
        o.notes as order_notes,
        o.created_at,
        ROUND(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - o.created_at)) / 60) as elapsed_minutes
      FROM orders o
      LEFT JOIN dining_tables t ON o.table_id = t.id
      WHERE o.status IN ('SENT_TO_KITCHEN', 'PREPARING', 'READY')
      ORDER BY o.created_at ASC;
    `;
    const ordersRes = await db.query(query);

    const orderIds = ordersRes.rows.map((o: any) => o.id);
    let itemsByOrder: Record<string, any[]> = {};

    if (orderIds.length > 0) {
      const itemsRes = await db.query(
        `SELECT 
          oi.id,
          oi.order_id,
          oi.menu_item_id,
          m.name as item_name,
          oi.variant_name,
          oi.quantity,
          oi.notes,
          oi.item_status,
          m.is_veg,
          m.is_chef_special,
          m.is_spicy,
          m.prep_time_minutes
         FROM order_items oi
         JOIN menu_items m ON oi.menu_item_id = m.id
         WHERE oi.order_id = ANY($1)
         ORDER BY oi.created_at ASC`,
        [orderIds]
      );

      for (const item of itemsRes.rows) {
        if (!itemsByOrder[item.order_id]) {
          itemsByOrder[item.order_id] = [];
        }
        itemsByOrder[item.order_id].push(item);
      }
    }

    const tickets = ordersRes.rows.map((o: any) => ({
      ...o,
      items: itemsByOrder[o.id] || [],
    }));

    res.json({
      success: true,
      data: tickets,
    });
  } catch (error) {
    next(error);
  }
});

// 4. Get Order by ID with Timeline
ordersRouter.get('/:id', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;

    const orderRes = await db.query(
      `SELECT 
        o.*,
        t.table_number,
        t.section as table_section,
        u.full_name as waiter_name
       FROM orders o
       LEFT JOIN dining_tables t ON o.table_id = t.id
       LEFT JOIN users u ON o.waiter_id = u.id
       WHERE o.id = $1`,
      [id]
    );

    if (orderRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    const itemsRes = await db.query(
      `SELECT 
        oi.*,
        m.name as item_name,
        m.is_veg,
        m.is_chef_special,
        m.is_spicy
       FROM order_items oi
       JOIN menu_items m ON oi.menu_item_id = m.id
       WHERE oi.order_id = $1
       ORDER BY oi.created_at ASC`,
      [id]
    );

    const timelineRes = await db.query(
      `SELECT 
        ot.*,
        u.full_name as performed_by_name,
        u.role as performed_by_role
       FROM order_timeline ot
       LEFT JOIN users u ON ot.performed_by = u.id
       WHERE ot.order_id = $1
       ORDER BY ot.created_at ASC`,
      [id]
    );

    res.json({
      success: true,
      data: {
        ...orderRes.rows[0],
        items: itemsRes.rows,
        timeline: timelineRes.rows,
      },
    });
  } catch (error) {
    next(error);
  }
});

// 5. Send Order to Kitchen (CREATED -> SENT_TO_KITCHEN)
ordersRouter.post('/:id/send-to-kitchen', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;

    const orderRes = await db.query('SELECT status, order_number, table_id FROM orders WHERE id = $1', [id]);
    if (orderRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    const currentStatus = orderRes.rows[0].status;
    if (currentStatus !== 'CREATED') {
      return res.status(400).json({
        success: false,
        error: `Cannot send order to kitchen from status: ${currentStatus}`,
      });
    }

    await db.transaction(async (client) => {
      await client.query(
        `UPDATE orders SET status = 'SENT_TO_KITCHEN', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [id]
      );

      await client.query(
        `UPDATE order_items SET item_status = 'COOKING' WHERE order_id = $1 AND item_status = 'PENDING'`,
        [id]
      );

      await client.query(
        `INSERT INTO order_timeline (id, order_id, action, from_status, to_status, notes, performed_by)
         VALUES ($1, $2, 'SENT_TO_KITCHEN', 'CREATED', 'SENT_TO_KITCHEN', 'Order ticket dispatched to kitchen display', $3)`,
        [`ot-${Date.now()}-kds`, id, req.user!.id]
      );
    });

    const fullOrder = await db.query(`SELECT o.*, t.table_number FROM orders o LEFT JOIN dining_tables t ON o.table_id = t.id WHERE o.id = $1`, [id]);
    const itemsRes = await db.query(`SELECT oi.*, m.name as item_name FROM order_items oi JOIN menu_items m ON oi.menu_item_id = m.id WHERE oi.order_id = $1`, [id]);
    const ticketData = { ...fullOrder.rows[0], items: itemsRes.rows };

    // Emit live KOT to kitchen display
    realTime.emitToRole('KITCHEN', 'order:kitchen_ticket', ticketData);
    realTime.emitToStaff('order:status_updated', { orderId: id, status: 'SENT_TO_KITCHEN' });

    res.json({
      success: true,
      message: `Order ${orderRes.rows[0].order_number} sent to Kitchen`,
      data: ticketData,
    });
  } catch (error) {
    next(error);
  }
});

// 6. Update Lifecycle Status (PREPARING, READY, SERVED, COMPLETED, CANCELLED)
ordersRouter.patch(
  '/:id/status',
  authenticateToken,
  validateRequest({ body: updateStatusSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const { status: newStatus, notes } = req.body;

      const orderRes = await db.query(
        'SELECT status, order_number, table_id, total_amount FROM orders WHERE id = $1',
        [id]
      );

      if (orderRes.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Order not found' });
      }

      const prevStatus = orderRes.rows[0].status;
      const orderNumber = orderRes.rows[0].order_number;
      const tableId = orderRes.rows[0].table_id;

      // Validate lifecycle transitions
      const validTransitions: Record<string, string[]> = {
        CREATED: ['SENT_TO_KITCHEN', 'CANCELLED'],
        SENT_TO_KITCHEN: ['PREPARING', 'READY', 'CANCELLED'],
        PREPARING: ['READY', 'CANCELLED'],
        READY: ['SERVED', 'CANCELLED'],
        SERVED: ['COMPLETED', 'CANCELLED'],
        COMPLETED: [],
        CANCELLED: [],
      };

      if (!validTransitions[prevStatus]?.includes(newStatus)) {
        return res.status(400).json({
          success: false,
          error: `Invalid transition: cannot move order from ${prevStatus} to ${newStatus}`,
        });
      }

      await db.transaction(async (client) => {
        await client.query(
          'UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [newStatus, id]
        );

        // Update item status accordingly
        if (newStatus === 'READY') {
          await client.query(`UPDATE order_items SET item_status = 'READY' WHERE order_id = $1`, [id]);
        } else if (newStatus === 'SERVED' || newStatus === 'COMPLETED') {
          await client.query(`UPDATE order_items SET item_status = 'SERVED' WHERE order_id = $1`, [id]);
        } else if (newStatus === 'CANCELLED') {
          await client.query(`UPDATE order_items SET item_status = 'CANCELLED' WHERE order_id = $1`, [id]);
          // If cancelled or completed and was on table, free the table
          if (tableId) {
            await client.query(
              `UPDATE dining_tables SET status = 'AVAILABLE', current_order_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
              [tableId]
            );
          }
        }

        // Record Timeline entry
        const actionName =
          newStatus === 'PREPARING'
            ? 'STARTED_PREPARING'
            : newStatus === 'READY'
            ? 'MARKED_READY'
            : newStatus === 'SERVED'
            ? 'ORDER_SERVED'
            : newStatus === 'COMPLETED'
            ? 'ORDER_COMPLETED'
            : 'ORDER_CANCELLED';

        await client.query(
          `INSERT INTO order_timeline (id, order_id, action, from_status, to_status, notes, performed_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [`ot-${Date.now()}-${newStatus.toLowerCase()}`, id, actionName, prevStatus, newStatus, notes || null, req.user!.id]
        );
      });

      // Audit Log for sensitive events (Cancellation or Completion)
      if (newStatus === 'CANCELLED' || newStatus === 'COMPLETED') {
        await logAudit({
          userId: req.user!.id,
          action: `ORDER_${newStatus}`,
          entityType: 'ORDER',
          entityId: id,
          details: { orderNumber, prevStatus, reason: notes },
        });
      }

      // Real-Time event dispatching
      const eventPayload = { orderId: id, orderNumber, prevStatus, status: newStatus, tableId };
      realTime.emitToStaff('order:status_updated', eventPayload);

      // Inventory Recipe Consumption & Reversal Lifecycle Hooks
      let inventoryImpact = null;
      if (newStatus === 'PREPARING' || (newStatus === 'READY' && prevStatus !== 'PREPARING')) {
        inventoryImpact = await inventoryService.deductOrderStock(id, req.user!.id);
      } else if (newStatus === 'CANCELLED') {
        const isWasted = Boolean(req.body.isWasted);
        inventoryImpact = await inventoryService.reverseOrderStock(id, req.user!.id, notes || 'Order cancelled', isWasted);
      }

      if (newStatus === 'READY') {
        // Bell alert for Waiter!
        realTime.emitToRole('WAITER', 'order:ready_alert', {
          orderId: id,
          orderNumber,
          tableId,
          message: `Order ${orderNumber} is READY for pickup!`,
        });
      }

      res.json({
        success: true,
        message: `Order status changed from ${prevStatus} to ${newStatus}`,
        data: { id, orderNumber, status: newStatus, inventoryImpact },
      });
    } catch (error) {
      next(error);
    }
  }
);

// 7. Add More Items to Existing Active Order (e.g. Diner orders extra drinks / sides)
ordersRouter.post(
  '/:id/items',
  authenticateToken,
  validateRequest({ body: addItemsSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const { items } = req.body;

      const orderRes = await db.query(
        'SELECT status, order_number, subtotal, tax_amount, total_amount, order_type FROM orders WHERE id = $1',
        [id]
      );

      if (orderRes.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Order not found' });
      }

      const order = orderRes.rows[0];
      if (['COMPLETED', 'CANCELLED'].includes(order.status)) {
        return res.status(400).json({
          success: false,
          error: `Cannot add items to ${order.status} order`,
        });
      }

      let addedSubtotal = 0;
      for (const item of items) {
        addedSubtotal += item.unitPrice * item.quantity;
      }

      const newSubtotal = Number(order.subtotal) + addedSubtotal;
      const newTax = Math.round((newSubtotal * 0.05) * 100) / 100;
      const parcelCharge = (order.order_type === 'TAKEAWAY' || order.order_type === 'DELIVERY') ? 10.0 : 0.0;
      const newTotal = Math.round((newSubtotal + newTax + parcelCharge) * 100) / 100;

      const insertedItems: any[] = [];
      await db.transaction(async (client) => {
        // Insert new order items
        for (let idx = 0; idx < items.length; idx++) {
          const it = items[idx];
          const itemId = `oi-${Date.now()}-add-${idx + 1}`;
          const itemSubtotal = Math.round((it.unitPrice * it.quantity) * 100) / 100;

          await client.query(
            `INSERT INTO order_items (
              id, order_id, menu_item_id, variant_id, variant_name, quantity,
              unit_price, tax_rate, subtotal, notes, item_status
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'COOKING')`,
            [
              itemId,
              id,
              it.menuItemId,
              it.variantId || null,
              it.variantName || null,
              it.quantity,
              it.unitPrice,
              5.00,
              itemSubtotal,
              it.notes || null,
            ]
          );

          insertedItems.push({ id: itemId, ...it, subtotal: itemSubtotal });
        }

        // Update Order Totals
        await client.query(
          `UPDATE orders SET subtotal = $1, tax_amount = $2, total_amount = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4`,
          [newSubtotal, newTax, newTotal, id]
        );

        // Timeline entry
        await client.query(
          `INSERT INTO order_timeline (id, order_id, action, from_status, to_status, notes, performed_by)
           VALUES ($1, $2, 'ITEM_ADDED', $3, $3, $4, $5)`,
          [
            `ot-${Date.now()}-add`,
            id,
            order.status,
            `Added ${items.length} additional item(s) to order`,
            req.user!.id,
          ]
        );
      });

      // Real-time notification to Kitchen Display for newly added items
      realTime.emitToRole('KITCHEN', 'order:items_added', {
        orderId: id,
        orderNumber: order.order_number,
        newItems: insertedItems,
      });

      res.json({
        success: true,
        message: `Added ${items.length} item(s) to order ${order.order_number}`,
        data: {
          orderId: id,
          newSubtotal,
          newTotal,
          addedItems: insertedItems,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);
