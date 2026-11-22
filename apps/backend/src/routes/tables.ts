import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validate.js';
import { logAudit } from '../middleware/audit.js';

export const tablesRouter = Router();

const statusUpdateSchema = z.object({
  status: z.enum(['AVAILABLE', 'OCCUPIED', 'RESERVED', 'DIRTY']),
});

// List all dining tables with active order summary
tablesRouter.get('/', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = `
      SELECT 
        t.id, 
        t.table_number, 
        t.section, 
        t.capacity, 
        t.status, 
        t.current_order_id, 
        t.qr_token,
        o.order_number,
        o.status AS order_status,
        o.total_amount AS order_total,
        o.created_at AS order_created_at
      FROM dining_tables t
      LEFT JOIN orders o ON t.current_order_id = o.id
      WHERE t.is_active = TRUE
      ORDER BY t.section, t.table_number ASC;
    `;
    const result = await db.query(query);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

// Get table details
tablesRouter.get('/:id', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `SELECT t.*, o.order_number, o.status as order_status, o.total_amount as order_total
       FROM dining_tables t
       LEFT JOIN orders o ON t.current_order_id = o.id
       WHERE t.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Table not found' });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

// Update table status (Waiter, Cashier, Manager, Admin)
tablesRouter.patch(
  '/:id/status',
  authenticateToken,
  requireRole('ADMIN', 'MANAGER', 'CASHIER', 'WAITER'),
  validateRequest({ body: statusUpdateSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const { status } = req.body;

      const current = await db.query('SELECT status, table_number FROM dining_tables WHERE id = $1', [id]);
      if (current.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Table not found' });
      }

      const prevStatus = current.rows[0].status;

      await db.query(
        'UPDATE dining_tables SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [status, id]
      );

      await logAudit({
        userId: req.user!.id,
        action: 'TABLE_STATUS_UPDATED',
        entityType: 'ORDER',
        entityId: id,
        details: {
          tableNumber: current.rows[0].table_number,
          fromStatus: prevStatus,
          toStatus: status,
        },
      });

      res.json({
        success: true,
        message: `Table ${current.rows[0].table_number} status changed to ${status}`,
        data: { id, status },
      });
    } catch (error) {
      next(error);
    }
  }
);
