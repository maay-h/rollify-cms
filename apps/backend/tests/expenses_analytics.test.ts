import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';
import { seedDatabase } from '../src/db/seed.js';

const app = createApp();

beforeAll(async () => {
  await seedDatabase();
  await db.query('DELETE FROM day_closings');
  await db.query('DELETE FROM payments');
  await db.query('DELETE FROM bills');
  await db.query('DELETE FROM order_items');
  await db.query('DELETE FROM order_timeline');
  await db.query('DELETE FROM orders');
  await db.query('DELETE FROM staff_shifts');
  await db.query("DELETE FROM expenses WHERE id NOT LIKE 'exp-0%'");
  await db.query("DELETE FROM vendors WHERE id NOT LIKE 'ven-0%'");
});

afterAll(async () => {
  await db.close();
});

describe('Phase 5 - Expenses, Vendor Liabilities, Staff Shifts & Financial Analytics', () => {
  let adminToken = '';
  let managerToken = '';
  let waiterToken = '';
  let testExpenseLiabilityId = '';
  let testShiftId = '';

  it('Authenticates Admin, Manager, and Waiter staff', async () => {
    const aRes = await request(app).post('/api/auth/pin-login').send({ pin: '1111' });
    expect(aRes.status).toBe(200);
    adminToken = aRes.body.data.token;

    const mRes = await request(app).post('/api/auth/pin-login').send({ pin: '2222' });
    expect(mRes.status).toBe(200);
    managerToken = mRes.body.data.token;

    const wRes = await request(app).post('/api/auth/pin-login').send({ pin: '4444' });
    expect(wRes.status).toBe(200);
    waiterToken = wRes.body.data.token;
  });

  it('Retrieves operating expenses with category totals and payment status', async () => {
    const res = await request(app)
      .get('/api/expenses')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(5);
    expect(res.body.summary.totalPaid).toBeGreaterThan(0);
    expect(res.body.summary.totalPendingLiability).toBeGreaterThan(0);
    expect(res.body.summary.categoryTotals.RENT).toBe(45000);
  });

  it('Records a paid operating expense', async () => {
    const res = await request(app)
      .post('/api/expenses')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        category: 'UTILITIES',
        amount: 3200.00,
        paymentStatus: 'PAID',
        paymentMethod: 'UPI',
        description: 'Internet broadband and CCTV cloud backup',
        expenseDate: new Date().toISOString().slice(0, 10),
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.amount).toBe(3200.00);
    expect(res.body.data.paymentStatus).toBe('PAID');
  });

  it('Records a pending liability expense and atomically increments vendor debt', async () => {
    // 1. Check vendor initial liability
    const vBefore = await db.query('SELECT current_liability FROM vendors WHERE id = $1', ['ven-01']);
    const initLiability = Number(vBefore.rows[0].current_liability);

    // 2. Record pending supplier bill of ₹7,500
    const res = await request(app)
      .post('/api/expenses')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        vendorId: 'ven-01',
        category: 'RAW_MATERIALS',
        amount: 7500.00,
        paymentStatus: 'PENDING_LIABILITY',
        description: 'Wholesale chicken & egg batch #PV-9902',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    testExpenseLiabilityId = res.body.data.id;

    // 3. Verify vendor liability increased
    const vAfter = await db.query('SELECT current_liability FROM vendors WHERE id = $1', ['ven-01']);
    expect(Number(vAfter.rows[0].current_liability)).toBe(initLiability + 7500.00);
  });

  it('Settles pending vendor liability and decreases vendor debt balance', async () => {
    const vBefore = await db.query('SELECT current_liability FROM vendors WHERE id = $1', ['ven-01']);
    const liabilityBefore = Number(vBefore.rows[0].current_liability);

    const res = await request(app)
      .post(`/api/expenses/${testExpenseLiabilityId}/settle-liability`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        paymentMethod: 'BANK_TRANSFER',
        transactionReference: 'NEFT-AXIS-2993847',
        notes: 'Cleared wholesale poultry invoice',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.paymentStatus).toBe('PAID');

    // Verify vendor liability decreased back
    const vAfter = await db.query('SELECT current_liability FROM vendors WHERE id = $1', ['ven-01']);
    expect(Number(vAfter.rows[0].current_liability)).toBe(liabilityBefore - 7500.00);
  });

  it('Lists vendors with business volumes and current liabilities', async () => {
    const res = await request(app)
      .get('/api/expenses/vendors')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.summary.totalVendors).toBeGreaterThanOrEqual(5);
    expect(res.body.summary.totalOutstandingDebt).toBeGreaterThanOrEqual(0);
  });

  it('Allows registering a new supplier vendor', async () => {
    const res = await request(app)
      .post('/api/expenses/vendors')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        id: 'ven-spice-01',
        name: 'Sunrise Spices & Seasonings',
        contactPerson: 'Karan Mehra',
        phone: '+91 98450 99887',
        email: 'spices@sunrisetraders.in',
        address: 'Yeshwanthpur Wholesale Yard',
        initialLiability: 0.00,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('ven-spice-01');
  });

  it('Clocks in a staff member and starts an active shift', async () => {
    const res = await request(app)
      .post('/api/shifts/clock-in')
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({
        notes: 'Morning shift opening check',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.shiftId).toBeDefined();
    expect(res.body.data.userId).toBe('usr-waiter-01');
    testShiftId = res.body.data.shiftId;
  });

  it('Prevents duplicate clock-in while already on active shift', async () => {
    const res = await request(app)
      .post('/api/shifts/clock-in')
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('already clocked in');
  });

  it('Clocks out staff member, calculates duration and shift wages', async () => {
    const res = await request(app)
      .post('/api/shifts/clock-out')
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({
        notes: 'Shift completed smoothly',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('COMPLETED');
    expect(res.body.data.totalHours).toBeGreaterThanOrEqual(0.1);
    expect(res.body.data.shiftWage).toBeGreaterThan(0);
  });

  it('Fetches payroll summary and hours worked across staff', async () => {
    const res = await request(app)
      .get('/api/shifts/payroll-summary')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.summary.totalStaff).toBeGreaterThanOrEqual(5);
  });

  it('Allows manager to adjust shift hours and wage', async () => {
    const res = await request(app)
      .post('/api/shifts/adjust')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        shiftId: testShiftId,
        totalHours: 7.5,
        hourlyRate: 120.00,
        notes: 'Adjusted for overtime during lunch rush',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totalHours).toBe(7.5);
    expect(res.body.data.shiftWage).toBe(900.00); // 7.5 * 120 = 900
  });

  it('Generates comprehensive Profit & Loss (P&L) statement with COGS and margins', async () => {
    const res = await request(app)
      .get('/api/analytics/pnl')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.revenue).toBeDefined();
    expect(res.body.data.costOfSales).toBeDefined();
    expect(res.body.data.grossProfit).toBeDefined();
    expect(res.body.data.operatingExpenses).toBeDefined();
    expect(res.body.data.operatingExpenses.totalOperatingExpenses).toBeGreaterThan(0);
    expect(res.body.data.netProfit).toBeDefined();
  });

  it('Provides sales distribution breakdown across order types, categories, and payment methods', async () => {
    const res = await request(app)
      .get('/api/analytics/sales-breakdown')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.byOrderType).toBeDefined();
    expect(res.body.data.byCategory).toBeDefined();
    expect(res.body.data.topSellingDishes).toBeDefined();
    expect(res.body.data.byPaymentMethod).toBeDefined();
  });

  it('Retrieves vendor liabilities summary', async () => {
    const res = await request(app)
      .get('/api/analytics/liabilities')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.totalOutstandingLiability).toBeGreaterThanOrEqual(0);
    expect(res.body.vendors.length).toBeGreaterThanOrEqual(5);
  });
});
