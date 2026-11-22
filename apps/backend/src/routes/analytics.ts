import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../db/index.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

export const analyticsRouter = Router();

// 1. Comprehensive Profit & Loss (P&L) Statement
analyticsRouter.get(
  '/pnl',
  authenticateToken,
  requireRole('ADMIN', 'MANAGER'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { startDate, endDate } = req.query;

      // Date filtering conditions
      let billDateFilter = '1=1';
      let expenseDateFilter = '1=1';
      let stockDateFilter = '1=1';
      const billParams: any[] = [];
      const expenseParams: any[] = [];
      const stockParams: any[] = [];

      if (startDate && typeof startDate === 'string') {
        billParams.push(startDate);
        billDateFilter += ` AND b.created_at::date >= $${billParams.length}::date`;

        expenseParams.push(startDate);
        expenseDateFilter += ` AND e.expense_date >= $${expenseParams.length}::date`;

        stockParams.push(startDate);
        stockDateFilter += ` AND sm.created_at::date >= $${stockParams.length}::date`;
      }

      if (endDate && typeof endDate === 'string') {
        billParams.push(endDate);
        billDateFilter += ` AND b.created_at::date <= $${billParams.length}::date`;

        expenseParams.push(endDate);
        expenseDateFilter += ` AND e.expense_date <= $${expenseParams.length}::date`;

        stockParams.push(endDate);
        stockDateFilter += ` AND sm.created_at::date <= $${stockParams.length}::date`;
      }

      // 1. Revenue Metrics from Bills
      const billsRes = await db.query(
        `SELECT 
          COALESCE(SUM(b.gross_amount), 0) as total_gross,
          COALESCE(SUM(b.discount_amount), 0) as total_discounts,
          COALESCE(SUM(b.tax_amount), 0) as total_gst,
          COALESCE(SUM(b.net_amount), 0) as total_net,
          COALESCE(SUM(b.paid_amount), 0) as total_collected,
          COUNT(b.id) as total_invoices
         FROM bills b
         WHERE ${billDateFilter}`,
        billParams
      );

      const b = billsRes.rows[0];
      const grossRevenue = Number(b.total_gross);
      const discounts = Number(b.total_discounts);
      const taxableSales = Math.max(0, grossRevenue - discounts);
      const gstCollected = Number(b.total_gst);
      const totalCollected = Number(b.total_collected);
      const invoiceCount = parseInt(b.total_invoices, 10);

      // 2. Cost of Goods Sold (COGS) from Recipe-Based Consumption
      const cogsRes = await db.query(
        `SELECT 
          COALESCE(SUM(ABS(sm.quantity) * i.cost_per_unit), 0) as total_cogs
         FROM stock_movements sm
         JOIN ingredients i ON sm.ingredient_id = i.id
         WHERE sm.movement_type = 'CONSUMPTION' AND ${stockDateFilter}`,
        stockParams
      );

      const rawCogs = Number(cogsRes.rows[0].total_cogs);
      const cogs = Math.round(rawCogs * 100) / 100;

      // Kitchen Wastage Loss
      const wastageRes = await db.query(
        `SELECT 
          COALESCE(SUM(ABS(sm.quantity) * i.cost_per_unit), 0) as total_wastage
         FROM stock_movements sm
         JOIN ingredients i ON sm.ingredient_id = i.id
         WHERE sm.movement_type = 'WASTAGE' AND ${stockDateFilter}`,
        stockParams
      );
      const wastageCost = Math.round(Number(wastageRes.rows[0].total_wastage) * 100) / 100;

      // 3. Gross Profit
      const grossProfit = Math.round((taxableSales - cogs) * 100) / 100;
      const grossMarginPercent = taxableSales > 0 ? Math.round((grossProfit / taxableSales) * 1000) / 10 : 0;

      // 4. Operating Expenses Breakdown
      const expensesRes = await db.query(
        `SELECT 
          e.category,
          COALESCE(SUM(e.amount), 0) as category_total
         FROM expenses e
         WHERE e.payment_status = 'PAID' AND ${expenseDateFilter}
         GROUP BY e.category`,
        expenseParams
      );

      const expenseBreakdown: Record<string, number> = {
        RAW_MATERIALS: 0,
        UTILITIES: 0,
        RENT: 0,
        MAINTENANCE: 0,
        PACKAGING: 0,
        SALARY: 0,
        OTHER: 0,
      };

      let totalOperatingExpenses = 0;
      for (const row of expensesRes.rows) {
        const catTotal = Number(row.category_total);
        expenseBreakdown[row.category] = catTotal;
        totalOperatingExpenses += catTotal;
      }
      totalOperatingExpenses = Math.round(totalOperatingExpenses * 100) / 100;

      // 5. Net Operating Profit
      const netOperatingProfit = Math.round((grossProfit - totalOperatingExpenses) * 100) / 100;
      const netMarginPercent = taxableSales > 0 ? Math.round((netOperatingProfit / taxableSales) * 1000) / 10 : 0;

      res.json({
        success: true,
        period: {
          startDate: startDate || 'All-Time',
          endDate: endDate || 'Today',
        },
        data: {
          revenue: {
            grossRevenue,
            discounts,
            taxableSales,
            gstCollected,
            totalCollected,
            invoiceCount,
          },
          costOfSales: {
            cogs,
            wastageCost,
            totalProductionCost: Math.round((cogs + wastageCost) * 100) / 100,
          },
          grossProfit: {
            amount: grossProfit,
            marginPercent: grossMarginPercent,
          },
          operatingExpenses: {
            breakdown: expenseBreakdown,
            totalOperatingExpenses,
          },
          netProfit: {
            amount: netOperatingProfit,
            marginPercent: netMarginPercent,
            isProfitable: netOperatingProfit >= 0,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// 2. Sales Distribution Breakdown (Order Type, Categories, Top Items, Payment Methods)
analyticsRouter.get(
  '/sales-breakdown',
  authenticateToken,
  requireRole('ADMIN', 'MANAGER'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // 1. Sales by Order Type
      const orderTypeRes = await db.query(`
        SELECT 
          order_type,
          COUNT(id) as order_count,
          COALESCE(SUM(total_amount), 0) as total_sales
        FROM orders
        WHERE status NOT IN ('CANCELLED')
        GROUP BY order_type
        ORDER BY total_sales DESC
      `);

      // 2. Sales by Category
      const categoryRes = await db.query(`
        SELECT 
          c.id as category_id,
          c.name as category_name,
          COALESCE(SUM(oi.quantity), 0) as units_sold,
          COALESCE(SUM(oi.subtotal), 0) as total_revenue
        FROM order_items oi
        JOIN menu_items m ON oi.menu_item_id = m.id
        JOIN menu_categories c ON m.category_id = c.id
        JOIN orders o ON oi.order_id = o.id
        WHERE o.status NOT IN ('CANCELLED')
        GROUP BY c.id, c.name, c.display_order
        ORDER BY total_revenue DESC
      `);

      // 3. Top 5 Best-Selling Dishes
      const topDishesRes = await db.query(`
        SELECT 
          m.id as item_id,
          m.name as item_name,
          c.name as category_name,
          m.is_veg,
          COALESCE(SUM(oi.quantity), 0) as total_quantity_sold,
          COALESCE(SUM(oi.subtotal), 0) as total_sales_volume
        FROM order_items oi
        JOIN menu_items m ON oi.menu_item_id = m.id
        JOIN menu_categories c ON m.category_id = c.id
        JOIN orders o ON oi.order_id = o.id
        WHERE o.status NOT IN ('CANCELLED')
        GROUP BY m.id, m.name, c.name, m.is_veg
        ORDER BY total_quantity_sold DESC, total_sales_volume DESC
        LIMIT 5
      `);

      // 4. Payment Methods Share
      const paymentsRes = await db.query(`
        SELECT 
          payment_method,
          COUNT(id) as transaction_count,
          COALESCE(SUM(amount), 0) as total_amount
        FROM payments
        WHERE status = 'SUCCESS'
        GROUP BY payment_method
        ORDER BY total_amount DESC
      `);

      res.json({
        success: true,
        data: {
          byOrderType: orderTypeRes.rows,
          byCategory: categoryRes.rows,
          topSellingDishes: topDishesRes.rows,
          byPaymentMethod: paymentsRes.rows,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// 3. Vendor Liabilities Ledger
analyticsRouter.get(
  '/liabilities',
  authenticateToken,
  requireRole('ADMIN', 'MANAGER'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await db.query(`
        SELECT 
          v.id,
          v.name,
          v.contact_person,
          v.phone,
          v.current_liability,
          COUNT(e.id) as pending_invoices_count,
          COALESCE(SUM(CASE WHEN e.payment_status = 'PENDING_LIABILITY' THEN e.amount ELSE 0 END), 0) as pending_amount
        FROM vendors v
        LEFT JOIN expenses e ON v.id = e.vendor_id AND e.payment_status = 'PENDING_LIABILITY'
        GROUP BY v.id
        ORDER BY v.current_liability DESC
      `);

      let totalLiability = 0;
      for (const row of result.rows) {
        totalLiability += Number(row.current_liability);
      }

      res.json({
        success: true,
        totalOutstandingLiability: Math.round(totalLiability * 100) / 100,
        vendors: result.rows,
      });
    } catch (error) {
      next(error);
    }
  }
);
