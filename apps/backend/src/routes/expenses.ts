import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validate.js';
import { logAudit } from '../middleware/audit.js';

export const expensesRouter = Router();

// Validation Schemas
const createExpenseSchema = z.object({
  vendorId: z.string().optional().nullable(),
  category: z.enum(['RAW_MATERIALS', 'UTILITIES', 'RENT', 'MAINTENANCE', 'PACKAGING', 'SALARY', 'OTHER']),
  amount: z.number().positive('Expense amount must be greater than 0'),
  paymentStatus: z.enum(['PAID', 'PENDING_LIABILITY']).default('PAID'),
  paymentMethod: z.enum(['CASH', 'UPI', 'BANK_TRANSFER']).optional().nullable(),
  description: z.string().min(3, 'Description is required'),
  receiptUrl: z.string().optional().nullable(),
  expenseDate: z.string().optional(), // YYYY-MM-DD
});

const settleLiabilitySchema = z.object({
  paymentMethod: z.enum(['CASH', 'UPI', 'BANK_TRANSFER']),
  transactionReference: z.string().optional(),
  notes: z.string().optional(),
});

const createVendorSchema = z.object({
  id: z.string().min(2).max(50),
  name: z.string().min(2).max(150),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  initialLiability: z.number().min(0).default(0),
});

// 1. List Expenses
expensesRouter.get(
  '/',
  authenticateToken,
  requireRole('ADMIN', 'MANAGER'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { category, paymentStatus, vendorId, startDate, endDate, limit = 50, offset = 0 } = req.query;

      let query = `
        SELECT 
          e.*,
          v.name as vendor_name,
          u.full_name as created_by_name
        FROM expenses e
        LEFT JOIN vendors v ON e.vendor_id = v.id
        LEFT JOIN users u ON e.created_by = u.id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (category && typeof category === 'string') {
        params.push(category);
        query += ` AND e.category = $${params.length}`;
      }

      if (paymentStatus && typeof paymentStatus === 'string') {
        params.push(paymentStatus);
        query += ` AND e.payment_status = $${params.length}`;
      }

      if (vendorId && typeof vendorId === 'string') {
        params.push(vendorId);
        query += ` AND e.vendor_id = $${params.length}`;
      }

      if (startDate && typeof startDate === 'string') {
        params.push(startDate);
        query += ` AND e.expense_date >= $${params.length}::date`;
      }

      if (endDate && typeof endDate === 'string') {
        params.push(endDate);
        query += ` AND e.expense_date <= $${params.length}::date`;
      }

      query += ` ORDER BY e.expense_date DESC, e.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(Number(limit), Number(offset));

      const result = await db.query(query, params);

      // Category breakdown & totals
      const totalsRes = await db.query(`
        SELECT 
          category,
          payment_status,
          COALESCE(SUM(amount), 0) as total_amount
        FROM expenses
        GROUP BY category, payment_status
      `);

      let totalPaid = 0;
      let totalPendingLiability = 0;
      const categoryTotals: Record<string, number> = {};

      for (const row of totalsRes.rows) {
        const amt = Number(row.total_amount);
        if (row.payment_status === 'PAID') totalPaid += amt;
        if (row.payment_status === 'PENDING_LIABILITY') totalPendingLiability += amt;

        categoryTotals[row.category] = (categoryTotals[row.category] || 0) + amt;
      }

      res.json({
        success: true,
        summary: {
          totalPaid: Math.round(totalPaid * 100) / 100,
          totalPendingLiability: Math.round(totalPendingLiability * 100) / 100,
          categoryTotals,
        },
        data: result.rows,
      });
    } catch (error) {
      next(error);
    }
  }
);

// 2. Record New Expense (Distinguishing Paid Outflows vs Pending Vendor Liabilities)
expensesRouter.post(
  '/',
  authenticateToken,
  requireRole('ADMIN', 'MANAGER'),
  validateRequest({ body: createExpenseSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        vendorId,
        category,
        amount,
        paymentStatus,
        paymentMethod,
        description,
        receiptUrl,
        expenseDate,
      } = req.body;

      const expenseId = `exp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const dateToUse = expenseDate || new Date().toISOString().slice(0, 10);

      await db.transaction(async (client) => {
        // 1. Insert expense record
        await client.query(
          `INSERT INTO expenses (
            id, vendor_id, category, amount, payment_status, payment_method,
            description, receipt_url, expense_date, created_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            expenseId,
            vendorId || null,
            category,
            amount,
            paymentStatus,
            paymentStatus === 'PAID' ? paymentMethod || 'CASH' : null,
            description,
            receiptUrl || null,
            dateToUse,
            req.user!.id,
          ]
        );

        // 2. If it's a pending liability to a vendor, atomically increment vendor liability
        if (paymentStatus === 'PENDING_LIABILITY' && vendorId) {
          await client.query(
            `UPDATE vendors 
             SET current_liability = current_liability + $1, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [amount, vendorId]
          );
        }
      });

      await logAudit({
        userId: req.user!.id,
        action: 'EXPENSE_RECORDED',
        entityType: 'EXPENSE',
        entityId: expenseId,
        details: { category, amount, paymentStatus, vendorId, description },
      });

      res.status(201).json({
        success: true,
        message: `Expense of ₹${amount} recorded (${paymentStatus})`,
        data: {
          id: expenseId,
          category,
          amount,
          paymentStatus,
          vendorId,
          description,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// 3. Settle Pending Vendor Liability
expensesRouter.post(
  '/:id/settle-liability',
  authenticateToken,
  requireRole('ADMIN', 'MANAGER'),
  validateRequest({ body: settleLiabilitySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const { paymentMethod, transactionReference, notes } = req.body;

      const expRes = await db.query('SELECT * FROM expenses WHERE id = $1', [id]);
      if (expRes.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Expense record not found' });
      }

      const expense = expRes.rows[0];
      if (expense.payment_status === 'PAID') {
        return res.status(400).json({ success: false, error: 'Expense liability is already settled' });
      }

      const amount = Number(expense.amount);

      await db.transaction(async (client) => {
        // Mark expense as PAID
        await client.query(
          `UPDATE expenses 
           SET payment_status = 'PAID', payment_method = $1, description = description || $2, updated_at = CURRENT_TIMESTAMP
           WHERE id = $3`,
          [paymentMethod, transactionReference ? ` [Settled Ref: ${transactionReference}]` : ' [Liability Settled]', id]
        );

        // Decrement vendor's outstanding liability
        if (expense.vendor_id) {
          await client.query(
            `UPDATE vendors 
             SET current_liability = GREATEST(0, current_liability - $1), updated_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [amount, expense.vendor_id]
          );
        }
      });

      await logAudit({
        userId: req.user!.id,
        action: 'VENDOR_LIABILITY_SETTLED',
        entityType: 'EXPENSE',
        entityId: id,
        details: { amount, vendorId: expense.vendor_id, paymentMethod, transactionReference, notes },
      });

      res.json({
        success: true,
        message: `Vendor liability of ₹${amount} settled via ${paymentMethod}`,
        data: { id, amount, paymentMethod, paymentStatus: 'PAID' },
      });
    } catch (error) {
      next(error);
    }
  }
);

// 4. List Vendors & Outstanding Balances
expensesRouter.get(
  '/vendors',
  authenticateToken,
  requireRole('ADMIN', 'MANAGER'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await db.query(`
        SELECT 
          v.*,
          COALESCE(SUM(e.amount), 0) as total_business_volume,
          COUNT(e.id) as total_invoices
        FROM vendors v
        LEFT JOIN expenses e ON v.id = e.vendor_id
        GROUP BY v.id
        ORDER BY v.current_liability DESC, v.name ASC
      `);

      let totalOutstandingDebt = 0;
      for (const row of result.rows) {
        totalOutstandingDebt += Number(row.current_liability);
      }

      res.json({
        success: true,
        summary: {
          totalVendors: result.rows.length,
          totalOutstandingDebt: Math.round(totalOutstandingDebt * 100) / 100,
        },
        data: result.rows,
      });
    } catch (error) {
      next(error);
    }
  }
);

// 5. Create Vendor
expensesRouter.post(
  '/vendors',
  authenticateToken,
  requireRole('ADMIN', 'MANAGER'),
  validateRequest({ body: createVendorSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id, name, contactPerson, phone, email, address, initialLiability } = req.body;

      const existing = await db.query('SELECT id FROM vendors WHERE id = $1', [id]);
      if (existing.rows.length > 0) {
        return res.status(400).json({ success: false, error: `Vendor with ID '${id}' already exists` });
      }

      await db.query(
        `INSERT INTO vendors (id, name, contact_person, phone, email, address, current_liability)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id, name, contactPerson || null, phone || null, email || null, address || null, initialLiability]
      );

      await logAudit({
        userId: req.user!.id,
        action: 'VENDOR_CREATED',
        entityType: 'EXPENSE',
        entityId: id,
        details: { name, contactPerson, initialLiability },
      });

      res.status(201).json({
        success: true,
        message: `Vendor '${name}' registered successfully`,
        data: { id, name, contactPerson, phone, email, current_liability: initialLiability },
      });
    } catch (error) {
      next(error);
    }
  }
);
