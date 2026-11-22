import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validate.js';
import { logAudit } from '../middleware/audit.js';
import { realTime } from '../socket/index.js';

export const billingRouter = Router();

// Validation Schemas
const generateBillSchema = z.object({
  discountType: z.enum(['NONE', 'PERCENTAGE', 'FLAT']).default('NONE'),
  discountValue: z.number().min(0).default(0),
  discountReason: z.string().optional(),
});

const addPaymentSchema = z.object({
  paymentMethod: z.enum(['CASH', 'UPI', 'CARD', 'SPLIT']),
  amount: z.number().positive('Payment amount must be greater than 0'),
  transactionReference: z.string().optional(),
  tenderedCash: z.number().optional(), // For cash change calculation
});

const refundSchema = z.object({
  amount: z.number().positive(),
  reason: z.string().min(3, 'Refund reason is mandatory'),
});

const dayCloseSchema = z.object({
  openingCash: z.number().min(0).default(0),
  actualCashCounted: z.number().min(0),
  notes: z.string().optional(),
});

// Helper: Generate unique invoice number (e.g. INV-20261122-0001)
async function generateBillNumber(): Promise<string> {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const countRes = await db.query(
    `SELECT COUNT(*) as count FROM bills WHERE bill_number LIKE $1`,
    [`INV-${dateStr}-%`]
  );
  const nextSeq = (parseInt(countRes.rows[0].count, 10) + 1).toString().padStart(4, '0');
  return `INV-${dateStr}-${nextSeq}`;
}

// 1. Generate Bill / Invoice from Order
billingRouter.post(
  '/generate/:orderId',
  authenticateToken,
  requireRole('ADMIN', 'MANAGER', 'CASHIER'),
  validateRequest({ body: generateBillSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orderId = req.params.orderId as string;
      const { discountType, discountValue, discountReason } = req.body;

      // Check if bill already exists for this order
      const existingBill = await db.query('SELECT * FROM bills WHERE order_id = $1', [orderId]);
      if (existingBill.rows.length > 0) {
        return res.status(200).json({
          success: true,
          message: 'Bill already generated for this order',
          data: existingBill.rows[0],
        });
      }

      // Fetch order
      const orderRes = await db.query(
        'SELECT * FROM orders WHERE id = $1',
        [orderId]
      );

      if (orderRes.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Order not found' });
      }

      const order = orderRes.rows[0];
      if (order.status === 'CANCELLED') {
        return res.status(400).json({ success: false, error: 'Cannot generate bill for cancelled order' });
      }

      const grossAmount = Number(order.subtotal);
      let discountAmount = 0;

      if (discountType === 'PERCENTAGE' && discountValue > 0) {
        discountAmount = Math.round((grossAmount * (discountValue / 100)) * 100) / 100;
      } else if (discountType === 'FLAT' && discountValue > 0) {
        discountAmount = Math.min(discountValue, grossAmount);
      }

      if (discountAmount > 0 && (!discountReason || discountReason.trim().length === 0)) {
        return res.status(400).json({
          success: false,
          error: 'Discount reason is required when applying a discount',
        });
      }

      const taxableAmount = Math.max(0, grossAmount - discountAmount);
      // 5% GST
      const taxAmount = Math.round((taxableAmount * 0.05) * 100) / 100;
      const parcelCharge = (order.order_type === 'TAKEAWAY' || order.order_type === 'DELIVERY') ? 10.0 : 0.0;
      const netAmount = Math.round((taxableAmount + taxAmount + parcelCharge) * 100) / 100;

      const billId = `bill-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const billNumber = await generateBillNumber();

      await db.transaction(async (client) => {
        // Insert into bills
        await client.query(
          `INSERT INTO bills (
            id, bill_number, order_id, gross_amount, discount_amount, discount_reason,
            taxable_amount, tax_amount, net_amount, paid_amount, payment_status, created_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0.00, 'UNPAID', $10)`,
          [
            billId,
            billNumber,
            orderId,
            grossAmount,
            discountAmount,
            discountReason || null,
            taxableAmount,
            taxAmount,
            netAmount,
            req.user!.id,
          ]
        );

        // Update order total amounts with final discount
        await client.query(
          `UPDATE orders SET 
            subtotal = $1, discount_amount = $2, tax_amount = $3, total_amount = $4, updated_at = CURRENT_TIMESTAMP
           WHERE id = $5`,
          [grossAmount, discountAmount, taxAmount, netAmount, orderId]
        );

        // Record timeline entry
        await client.query(
          `INSERT INTO order_timeline (id, order_id, action, from_status, to_status, notes, performed_by)
           VALUES ($1, $2, 'BILL_GENERATED', $3, $3, $4, $5)`,
          [
            `ot-${Date.now()}-bill`,
            orderId,
            order.status,
            `Bill ${billNumber} generated. Net amount: ₹${netAmount}`,
            req.user!.id,
          ]
        );
      });

      await logAudit({
        userId: req.user!.id,
        action: 'BILL_GENERATED',
        entityType: 'PAYMENT',
        entityId: billId,
        details: { billNumber, orderNumber: order.order_number, grossAmount, discountAmount, netAmount },
      });

      const billData = {
        id: billId,
        bill_number: billNumber,
        order_id: orderId,
        gross_amount: grossAmount,
        discount_amount: discountAmount,
        discount_reason: discountReason,
        taxable_amount: taxableAmount,
        tax_amount: taxAmount,
        parcel_charge: parcelCharge,
        net_amount: netAmount,
        paid_amount: 0,
        balance_due: netAmount,
        payment_status: 'UNPAID',
      };

      res.status(201).json({
        success: true,
        message: `Invoice ${billNumber} generated successfully`,
        data: billData,
      });
    } catch (error) {
      next(error);
    }
  }
);

// 2. Process Payment (Cash, UPI, Card, or Split Payment)
billingRouter.post(
  '/:billId/payments',
  authenticateToken,
  requireRole('ADMIN', 'MANAGER', 'CASHIER'),
  validateRequest({ body: addPaymentSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const billId = req.params.billId as string;
      const { paymentMethod, amount, transactionReference, tenderedCash } = req.body;

      const billRes = await db.query(
        `SELECT b.*, o.order_number, o.table_id, o.status as order_status
         FROM bills b
         JOIN orders o ON b.order_id = o.id
         WHERE b.id = $1`,
        [billId]
      );

      if (billRes.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Bill not found' });
      }

      const bill = billRes.rows[0];
      const netAmount = Number(bill.net_amount);
      const previouslyPaid = Number(bill.paid_amount);
      const remainingBalance = Math.round((netAmount - previouslyPaid) * 100) / 100;

      if (remainingBalance <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Bill is already fully paid',
        });
      }

      // Prevent overpayment beyond balance due (allow rounded 1 cent variance)
      if (amount > remainingBalance + 0.05) {
        return res.status(400).json({
          success: false,
          error: `Payment amount ₹${amount} exceeds balance due ₹${remainingBalance}`,
        });
      }

      const paymentId = `pay-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const newPaidTotal = Math.round((previouslyPaid + amount) * 100) / 100;
      const newBalanceDue = Math.max(0, Math.round((netAmount - newPaidTotal) * 100) / 100);
      const newStatus = newBalanceDue <= 0.05 ? 'PAID' : 'PARTIALLY_PAID';

      // Cash change calculation
      let changeToReturn = 0;
      if (paymentMethod === 'CASH' && tenderedCash && tenderedCash > amount) {
        changeToReturn = Math.round((tenderedCash - amount) * 100) / 100;
      }

      await db.transaction(async (client) => {
        // Insert Payment Record
        await client.query(
          `INSERT INTO payments (
            id, bill_id, order_id, amount, payment_method, transaction_reference, status, received_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, 'SUCCESS', $7)`,
          [
            paymentId,
            billId,
            bill.order_id,
            amount,
            paymentMethod,
            transactionReference || null,
            req.user!.id,
          ]
        );

        // Update Bill Status
        await client.query(
          `UPDATE bills SET paid_amount = $1, payment_status = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
          [newPaidTotal, newStatus, billId]
        );

        // If Fully Paid: Complete Order & Release Dining Table
        if (newStatus === 'PAID') {
          await client.query(
            `UPDATE orders SET status = 'COMPLETED', payment_status = 'PAID', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [bill.order_id]
          );

          if (bill.table_id) {
            await client.query(
              `UPDATE dining_tables SET status = 'AVAILABLE', current_order_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
              [bill.table_id]
            );
          }

          // Record Completed Timeline
          await client.query(
            `INSERT INTO order_timeline (id, order_id, action, from_status, to_status, notes, performed_by)
             VALUES ($1, $2, 'ORDER_COMPLETED', $3, 'COMPLETED', $4, $5)`,
            [
              `ot-${Date.now()}-comp`,
              bill.order_id,
              bill.order_status,
              `Payment of ₹${amount} received via ${paymentMethod}. Order fully settled.`,
              req.user!.id,
            ]
          );
        } else {
          // Record Partial Payment Timeline
          await client.query(
            `INSERT INTO order_timeline (id, order_id, action, from_status, to_status, notes, performed_by)
             VALUES ($1, $2, 'PARTIAL_PAYMENT_RECEIVED', $3, $3, $4, $5)`,
            [
              `ot-${Date.now()}-partpay`,
              bill.order_id,
              bill.order_status,
              `Partial payment of ₹${amount} received via ${paymentMethod}. Remaining: ₹${newBalanceDue}`,
              req.user!.id,
            ]
          );
        }
      });

      await logAudit({
        userId: req.user!.id,
        action: 'PAYMENT_RECEIVED',
        entityType: 'PAYMENT',
        entityId: paymentId,
        details: {
          billNumber: bill.bill_number,
          paymentMethod,
          amount,
          newStatus,
          balanceDue: newBalanceDue,
        },
      });

      // Real-time broadcast
      realTime.emitToStaff('payment:received', {
        billId,
        orderId: bill.order_id,
        billNumber: bill.bill_number,
        paymentMethod,
        amount,
        paymentStatus: newStatus,
        balanceDue: newBalanceDue,
      });

      res.status(201).json({
        success: true,
        message: newStatus === 'PAID' ? 'Bill fully paid & settled' : `Partial payment of ₹${amount} recorded`,
        data: {
          paymentId,
          billId,
          amountPaid: amount,
          paymentMethod,
          tenderedCash,
          changeToReturn,
          totalPaid: newPaidTotal,
          balanceDue: newBalanceDue,
          paymentStatus: newStatus,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// 3. Get Bill Details with Order Items & Payments (For Receipt / Thermal Print)
billingRouter.get('/:id', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;

    const billRes = await db.query(
      `SELECT 
        b.*,
        o.order_number,
        o.order_type,
        o.customer_name,
        o.customer_phone,
        o.notes as order_notes,
        t.table_number,
        t.section as table_section,
        u.full_name as cashier_name
       FROM bills b
       JOIN orders o ON b.order_id = o.id
       LEFT JOIN dining_tables t ON o.table_id = t.id
       LEFT JOIN users u ON b.created_by = u.id
       WHERE b.id = $1 OR b.bill_number = $1 OR b.order_id = $1`,
      [id]
    );

    if (billRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Bill not found' });
    }

    const bill = billRes.rows[0];

    // Fetch order items
    const itemsRes = await db.query(
      `SELECT oi.*, m.name as item_name, m.is_veg
       FROM order_items oi
       JOIN menu_items m ON oi.menu_item_id = m.id
       WHERE oi.order_id = $1
       ORDER BY oi.created_at ASC`,
      [bill.order_id]
    );

    // Fetch payment records
    const paymentsRes = await db.query(
      `SELECT p.*, u.full_name as received_by_name
       FROM payments p
       LEFT JOIN users u ON p.received_by = u.id
       WHERE p.bill_id = $1
       ORDER BY p.created_at ASC`,
      [bill.id]
    );

    res.json({
      success: true,
      data: {
        ...bill,
        balance_due: Math.max(0, Math.round((Number(bill.net_amount) - Number(bill.paid_amount)) * 100) / 100),
        items: itemsRes.rows,
        payments: paymentsRes.rows,
      },
    });
  } catch (error) {
    next(error);
  }
});

// 4. List All Invoices / Bills
billingRouter.get('/', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, limit = 50 } = req.query;

    let query = `
      SELECT 
        b.*,
        o.order_number,
        o.order_type,
        o.customer_name,
        t.table_number,
        u.full_name as cashier_name,
        ROUND((b.net_amount - b.paid_amount)::numeric, 2) as balance_due
      FROM bills b
      JOIN orders o ON b.order_id = o.id
      LEFT JOIN dining_tables t ON o.table_id = t.id
      LEFT JOIN users u ON b.created_by = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (status && typeof status === 'string' && status !== 'ALL') {
      params.push(status);
      query += ` AND b.payment_status = $${params.length}`;
    }

    query += ` ORDER BY b.created_at DESC LIMIT $${params.length + 1}`;
    params.push(Number(limit));

    const result = await db.query(query, params);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

// 5. Issue Refund (Immutable Reversal Entry)
billingRouter.post(
  '/:billId/refund',
  authenticateToken,
  requireRole('ADMIN', 'MANAGER'),
  validateRequest({ body: refundSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const billId = req.params.billId as string;
      const { amount, reason } = req.body;

      const billRes = await db.query('SELECT * FROM bills WHERE id = $1', [billId]);
      if (billRes.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Bill not found' });
      }

      const bill = billRes.rows[0];
      const currentlyPaid = Number(bill.paid_amount);

      if (amount > currentlyPaid) {
        return res.status(400).json({
          success: false,
          error: `Refund amount ₹${amount} exceeds total paid ₹${currentlyPaid}`,
        });
      }

      const refundId = `ref-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const newPaidAmount = Math.max(0, Math.round((currentlyPaid - amount) * 100) / 100);
      const newStatus = newPaidAmount === 0 ? 'REFUNDED' : 'PARTIALLY_PAID';

      await db.transaction(async (client) => {
        // Record negative/reversal payment entry
        await client.query(
          `INSERT INTO payments (
            id, bill_id, order_id, amount, payment_method, transaction_reference, status, received_by
          )
          VALUES ($1, $2, $3, $4, 'CASH', $5, 'REFUNDED', $6)`,
          [refundId, billId, bill.order_id, amount, `REFUND: ${reason}`, req.user!.id]
        );

        // Update bill paid amount and status
        await client.query(
          `UPDATE bills SET paid_amount = $1, payment_status = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
          [newPaidAmount, newStatus, billId]
        );

        // Timeline entry
        await client.query(
          `INSERT INTO order_timeline (id, order_id, action, from_status, to_status, notes, performed_by)
           VALUES ($1, $2, 'REFUND_ISSUED', 'COMPLETED', 'COMPLETED', $3, $4)`,
          [
            `ot-${Date.now()}-ref`,
            bill.order_id,
            `Refund of ₹${amount} processed. Reason: ${reason}`,
            req.user!.id,
          ]
        );
      });

      await logAudit({
        userId: req.user!.id,
        action: 'PAYMENT_REFUNDED',
        entityType: 'PAYMENT',
        entityId: refundId,
        details: { billNumber: bill.bill_number, amount, reason },
      });

      res.json({
        success: true,
        message: `Refund of ₹${amount} recorded successfully`,
        data: { refundId, refundedAmount: amount, newPaidAmount, status: newStatus },
      });
    } catch (error) {
      next(error);
    }
  }
);

// 6. Day Closing Preview (Live Reconciliation Calculation)
billingRouter.get(
  '/day-close/preview',
  authenticateToken,
  requireRole('ADMIN', 'MANAGER', 'CASHIER'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const today = new Date().toISOString().slice(0, 10);

      // Total payments broken down by method today
      const paymentsRes = await db.query(
        `SELECT 
          payment_method,
          status,
          COALESCE(SUM(amount), 0) as total_amount
         FROM payments
         WHERE created_at::date = $1::date
         GROUP BY payment_method, status`,
        [today]
      );

      let cashSales = 0;
      let upiSales = 0;
      let cardSales = 0;
      let refunds = 0;

      for (const row of paymentsRes.rows) {
        const amt = Number(row.total_amount);
        if (row.status === 'REFUNDED') {
          refunds += amt;
        } else {
          if (row.payment_method === 'CASH') cashSales += amt;
          else if (row.payment_method === 'UPI') upiSales += amt;
          else if (row.payment_method === 'CARD') cardSales += amt;
        }
      }

      // Total bills gross & discounts
      const billsRes = await db.query(
        `SELECT 
          COALESCE(SUM(gross_amount), 0) as total_gross,
          COALESCE(SUM(discount_amount), 0) as total_discounts,
          COALESCE(SUM(tax_amount), 0) as total_gst,
          COALESCE(SUM(net_amount), 0) as total_net,
          COUNT(id) as total_bills
         FROM bills
         WHERE created_at::date = $1::date`,
        [today]
      );

      const b = billsRes.rows[0];

      res.json({
        success: true,
        data: {
          businessDate: today,
          totalBills: parseInt(b.total_bills, 10),
          totalGross: Number(b.total_gross),
          totalDiscounts: Number(b.total_discounts),
          totalGST: Number(b.total_gst),
          totalNet: Number(b.total_net),
          cashSales,
          upiSales,
          cardSales,
          refunds,
          totalSettledSales: cashSales + upiSales + cardSales - refunds,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// 7. Submit Shift Day Closing
billingRouter.post(
  '/day-close',
  authenticateToken,
  requireRole('ADMIN', 'MANAGER', 'CASHIER'),
  validateRequest({ body: dayCloseSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { openingCash, actualCashCounted, notes } = req.body;
      const today = new Date().toISOString().slice(0, 10);

      // Check if already closed today
      const existing = await db.query('SELECT id FROM day_closings WHERE business_date = $1', [today]);
      if (existing.rows.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Day closing for business date ${today} has already been submitted`,
        });
      }

      // Calculate totals
      const paymentsRes = await db.query(
        `SELECT 
          payment_method,
          status,
          COALESCE(SUM(amount), 0) as total_amount
         FROM payments
         WHERE created_at::date = $1::date
         GROUP BY payment_method, status`,
        [today]
      );

      let cashSales = 0;
      let upiSales = 0;
      let cardSales = 0;
      let refunds = 0;

      for (const row of paymentsRes.rows) {
        const amt = Number(row.total_amount);
        if (row.status === 'REFUNDED') refunds += amt;
        else if (row.payment_method === 'CASH') cashSales += amt;
        else if (row.payment_method === 'UPI') upiSales += amt;
        else if (row.payment_method === 'CARD') cardSales += amt;
      }

      // Expected Cash in Drawer = Opening Cash + Cash Sales - Cash Refunds
      const expectedCash = Math.round((openingCash + cashSales - refunds) * 100) / 100;
      const cashVariance = Math.round((actualCashCounted - expectedCash) * 100) / 100;

      const closingId = `dc-${Date.now()}`;

      await db.query(
        `INSERT INTO day_closings (
          id, business_date, opening_cash, total_cash_sales, total_upi_sales, total_card_sales,
          total_discounts, total_refunds, total_expenses_cash, expected_cash_in_drawer,
          actual_cash_counted, cash_variance, notes, closed_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, 0.00, $7, 0.00, $8, $9, $10, $11, $12)`,
        [
          closingId,
          today,
          openingCash,
          cashSales,
          upiSales,
          cardSales,
          refunds,
          expectedCash,
          actualCashCounted,
          cashVariance,
          notes || null,
          req.user!.id,
        ]
      );

      await logAudit({
        userId: req.user!.id,
        action: 'DAY_CLOSING_SUBMITTED',
        entityType: 'DAY_CLOSE',
        entityId: closingId,
        details: { businessDate: today, expectedCash, actualCashCounted, cashVariance },
      });

      res.status(201).json({
        success: true,
        message: 'Day closing registered successfully',
        data: {
          closingId,
          businessDate: today,
          openingCash,
          cashSales,
          upiSales,
          cardSales,
          expectedCash,
          actualCashCounted,
          cashVariance,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);
