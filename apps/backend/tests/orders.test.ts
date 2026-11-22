import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';
import { seedDatabase } from '../src/db/seed.js';

const app = createApp();

beforeAll(async () => {
  await seedDatabase();
});

afterAll(async () => {
  await db.close();
});

describe('Phase 2 - Complete Order Lifecycle & KDS API', () => {
  let waiterToken = '';
  let kitchenToken = '';
  let cashierToken = '';
  let createdOrderId = '';

  it('Authenticates Waiter, Kitchen, and Cashier staff', async () => {
    const wRes = await request(app).post('/api/auth/pin-login').send({ pin: '4444' });
    expect(wRes.status).toBe(200);
    waiterToken = wRes.body.data.token;

    const kRes = await request(app).post('/api/auth/pin-login').send({ pin: '5555' });
    expect(kRes.status).toBe(200);
    kitchenToken = kRes.body.data.token;

    const cRes = await request(app).post('/api/auth/pin-login').send({ pin: '3333' });
    expect(cRes.status).toBe(200);
    cashierToken = cRes.body.data.token;
  });

  it('Creates a new Dine-in Order with items and size variants, correctly calculating 5% GST', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({
        orderType: 'DINE_IN',
        tableId: 'tbl-01',
        customerName: 'Aditya Rao',
        customerPhone: '+91 9988776655',
        notes: 'Make rolls spicy',
        autoSendToKitchen: false,
        items: [
          {
            menuItemId: 'rnv-05', // Rollify Signature Chicken Roll
            variantName: 'Single',
            quantity: 2,
            unitPrice: 139.00,
            notes: 'Extra toum garlic mayo',
          },
          {
            menuItemId: 'snv-01', // Chicken Popcorn
            variantName: 'LRG',
            quantity: 1,
            unitPrice: 159.00,
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.orderNumber).toBeDefined();
    expect(res.body.data.status).toBe('CREATED');

    // Expected subtotal = (2 * 139) + (1 * 159) = 278 + 159 = 437
    expect(res.body.data.subtotal).toBe(437);
    // 5% GST = 437 * 0.05 = 21.85
    expect(res.body.data.taxAmount).toBe(21.85);
    // Grand total = 437 + 21.85 = 458.85
    expect(res.body.data.totalAmount).toBe(458.85);

    createdOrderId = res.body.data.orderId;

    // Verify table tbl-01 is marked OCCUPIED
    const tableRes = await request(app)
      .get('/api/tables/tbl-01')
      .set('Authorization', `Bearer ${waiterToken}`);
    expect(tableRes.body.data.status).toBe('OCCUPIED');
    expect(tableRes.body.data.current_order_id).toBe(createdOrderId);
  });

  it('Dispatches order to Kitchen Display System (CREATED -> SENT_TO_KITCHEN)', async () => {
    const res = await request(app)
      .post(`/api/orders/${createdOrderId}/send-to-kitchen`)
      .set('Authorization', `Bearer ${waiterToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('SENT_TO_KITCHEN');
  });

  it('Kitchen Display System (KDS) queries active tickets and receives the order', async () => {
    const res = await request(app)
      .get('/api/orders/kitchen/active')
      .set('Authorization', `Bearer ${kitchenToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const myTicket = res.body.data.find((t: any) => t.id === createdOrderId);
    expect(myTicket).toBeDefined();
    expect(myTicket.status).toBe('SENT_TO_KITCHEN');
    expect(myTicket.items.length).toBe(2);
    expect(myTicket.table_number).toBe('T-01');
  });

  it('Kitchen starts preparing the order (SENT_TO_KITCHEN -> PREPARING)', async () => {
    const res = await request(app)
      .patch(`/api/orders/${createdOrderId}/status`)
      .set('Authorization', `Bearer ${kitchenToken}`)
      .send({
        status: 'PREPARING',
        notes: 'Chef Suresh started rolling wraps',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('PREPARING');
  });

  it('Diner adds additional items to active order (e.g. 1 Nutella Shake)', async () => {
    const res = await request(app)
      .post(`/api/orders/${createdOrderId}/items`)
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({
        items: [
          {
            menuItemId: 'shk-01', // Classic Vanilla Thick Shake
            variantName: 'Single',
            quantity: 1,
            unitPrice: 119.00,
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // Previous subtotal: 437 + 119 = 556
    expect(res.body.data.newSubtotal).toBe(556);
    // New total: 556 + 5% GST (27.80) = 583.80
    expect(res.body.data.newTotal).toBe(583.8);
  });

  it('Kitchen marks the order READY for waiter pickup', async () => {
    const res = await request(app)
      .patch(`/api/orders/${createdOrderId}/status`)
      .set('Authorization', `Bearer ${kitchenToken}`)
      .send({
        status: 'READY',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('READY');
  });

  it('Waiter serves the order to the dining table (READY -> SERVED)', async () => {
    const res = await request(app)
      .patch(`/api/orders/${createdOrderId}/status`)
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({
        status: 'SERVED',
        notes: 'Delivered hot to table T-01',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('SERVED');
  });

  it('Order audit timeline tracks the complete chronological lifecycle', async () => {
    const res = await request(app)
      .get(`/api/orders/${createdOrderId}`)
      .set('Authorization', `Bearer ${cashierToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('SERVED');
    expect(res.body.data.items.length).toBe(3); // 2 initial + 1 added
    expect(res.body.data.timeline.length).toBeGreaterThanOrEqual(5);

    const actions = res.body.data.timeline.map((t: any) => t.action);
    expect(actions).toContain('ORDER_CREATED');
    expect(actions).toContain('SENT_TO_KITCHEN');
    expect(actions).toContain('STARTED_PREPARING');
    expect(actions).toContain('ITEM_ADDED');
    expect(actions).toContain('MARKED_READY');
    expect(actions).toContain('ORDER_SERVED');
  });

  it('Cancelling an order automatically frees the dining table back to AVAILABLE', async () => {
    // Create a temporary order on table tbl-02
    const createRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({
        orderType: 'DINE_IN',
        tableId: 'tbl-02',
        items: [
          {
            menuItemId: 'fry-01',
            quantity: 1,
            unitPrice: 89.00,
          },
        ],
      });

    const tempOrderId = createRes.body.data.orderId;

    // Verify table is OCCUPIED
    const tOccupied = await request(app)
      .get('/api/tables/tbl-02')
      .set('Authorization', `Bearer ${waiterToken}`);
    expect(tOccupied.body.data.status).toBe('OCCUPIED');

    // Cancel order
    const cancelRes = await request(app)
      .patch(`/api/orders/${tempOrderId}/status`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        status: 'CANCELLED',
        notes: 'Customer changed mind before preparation',
      });

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.status).toBe('CANCELLED');

    // Verify table is now AVAILABLE
    const tFreed = await request(app)
      .get('/api/tables/tbl-02')
      .set('Authorization', `Bearer ${waiterToken}`);
    expect(tFreed.body.data.status).toBe('AVAILABLE');
  });
});
