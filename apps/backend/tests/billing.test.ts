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
});

afterAll(async () => {
  await db.close();
});

describe('Phase 3 - Billing, Split Payments & Financial Reconciliation', () => {
  let cashierToken = '';
  let managerToken = '';
  let waiterToken = '';
  let testOrderId = '';
  let testBillId = '';

  it('Authenticates Cashier, Manager and Waiter staff', async () => {
    const cRes = await request(app).post('/api/auth/pin-login').send({ pin: '3333' });
    expect(cRes.status).toBe(200);
    cashierToken = cRes.body.data.token;

    const mRes = await request(app).post('/api/auth/pin-login').send({ pin: '2222' });
    expect(mRes.status).toBe(200);
    managerToken = mRes.body.data.token;

    const wRes = await request(app).post('/api/auth/pin-login').send({ pin: '4444' });
    expect(wRes.status).toBe(200);
    waiterToken = wRes.body.data.token;
  });

  it('Creates and prepares an order for billing', async () => {
    const oRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({
        orderType: 'DINE_IN',
        tableId: 'tbl-03',
        customerName: 'Priya Sharma',
        items: [
          {
            menuItemId: 'rnv-05', // Rollify Signature Chicken Roll @ 139
            quantity: 2,
            unitPrice: 139.00,
          },
          {
            menuItemId: 'fry-02', // Peri Peri Fries @ 99
            quantity: 1,
            unitPrice: 99.00,
          },
        ],
      });

    expect(oRes.status).toBe(201);
    testOrderId = oRes.body.data.orderId;
    // Gross = (2 * 139) + 99 = 278 + 99 = 377
  });

  it('Rejects bill generation with discount when reason is missing', async () => {
    const res = await request(app)
      .post(`/api/billing/generate/${testOrderId}`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        discountType: 'PERCENTAGE',
        discountValue: 10,
        discountReason: '', // Empty reason
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('reason is required');
  });

  it('Generates official tax invoice with 10% discount and 5% GST', async () => {
    const res = await request(app)
      .post(`/api/billing/generate/${testOrderId}`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        discountType: 'PERCENTAGE',
        discountValue: 10,
        discountReason: 'Happy Hours Promo 10%',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.bill_number).toBeDefined();

    // Gross = 377
    expect(res.body.data.gross_amount).toBe(377);
    // 10% Discount = 37.70
    expect(res.body.data.discount_amount).toBe(37.7);
    // Taxable = 377 - 37.7 = 339.30
    expect(res.body.data.taxable_amount).toBe(339.3);
    // 5% GST on 339.30 = 16.97
    expect(res.body.data.tax_amount).toBe(16.97);
    // Net = 339.30 + 16.97 = 356.27
    expect(res.body.data.net_amount).toBe(356.27);
    expect(res.body.data.balance_due).toBe(356.27);
    expect(res.body.data.payment_status).toBe('UNPAID');

    testBillId = res.body.data.id;
  });

  it('Processes Split Payment Part 1: ₹200 via UPI (Status -> PARTIALLY_PAID)', async () => {
    const res = await request(app)
      .post(`/api/billing/${testBillId}/payments`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        paymentMethod: 'UPI',
        amount: 200.00,
        transactionReference: 'UPI-REF-99441188',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.paymentStatus).toBe('PARTIALLY_PAID');
    expect(res.body.data.totalPaid).toBe(200);
    // Remaining balance = 356.27 - 200 = 156.27
    expect(res.body.data.balanceDue).toBe(156.27);
  });

  it('Rejects overpayment attempt exceeding balance due', async () => {
    const res = await request(app)
      .post(`/api/billing/${testBillId}/payments`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        paymentMethod: 'CASH',
        amount: 500.00, // Balance due is only 156.27
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('exceeds balance due');
  });

  it('Processes Split Payment Part 2: Remaining ₹156.27 via Cash (Status -> PAID)', async () => {
    const res = await request(app)
      .post(`/api/billing/${testBillId}/payments`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        paymentMethod: 'CASH',
        amount: 156.27,
        tenderedCash: 200.00, // Customer handed ₹200 cash note
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.paymentStatus).toBe('PAID');
    expect(res.body.data.changeToReturn).toBe(43.73); // 200 - 156.27 = 43.73
    expect(res.body.data.balanceDue).toBe(0);

    // Verify order is now COMPLETED and dining table tbl-03 is released to AVAILABLE
    const tableRes = await request(app)
      .get('/api/tables/tbl-03')
      .set('Authorization', `Bearer ${waiterToken}`);
    expect(tableRes.body.data.status).toBe('AVAILABLE');
  });

  it('Retrieves detailed invoice breakdown for receipt printing', async () => {
    const res = await request(app)
      .get(`/api/billing/${testBillId}`)
      .set('Authorization', `Bearer ${cashierToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.payment_status).toBe('PAID');
    expect(res.body.data.payments.length).toBe(2); // 1 UPI + 1 Cash
    expect(res.body.data.items.length).toBe(2);
  });

  it('Processes manager-authorized partial refund with immutable reversal entry', async () => {
    const res = await request(app)
      .post(`/api/billing/${testBillId}/refund`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        amount: 50.00,
        reason: 'Customer goodwill discount post-payment',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.refundedAmount).toBe(50.00);
  });

  it('Calculates shift day closing preview with reconciliation metrics', async () => {
    const res = await request(app)
      .get('/api/billing/day-close/preview')
      .set('Authorization', `Bearer ${cashierToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totalBills).toBeGreaterThanOrEqual(1);
    expect(res.body.data.upiSales).toBeGreaterThanOrEqual(200);
    expect(res.body.data.cashSales).toBeGreaterThanOrEqual(156.27);
    expect(res.body.data.refunds).toBeGreaterThanOrEqual(50);
  });

  it('Submits shift day closing and calculates cash drawer variance', async () => {
    const res = await request(app)
      .post('/api/billing/day-close')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        openingCash: 500.00,
        actualCashCounted: 606.27, // Counted cash in drawer
        notes: 'End of evening shift closing',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.expectedCash).toBeDefined();
    expect(res.body.data.cashVariance).toBeDefined();
  });
});
