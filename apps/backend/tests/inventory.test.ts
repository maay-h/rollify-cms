import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';
import { seedDatabase } from '../src/db/seed.js';
import { inventoryService } from '../src/services/inventoryService.js';

const app = createApp();

beforeAll(async () => {
  await seedDatabase();
  await db.query('DELETE FROM day_closings');
  await db.query('DELETE FROM payments');
  await db.query('DELETE FROM bills');
  await db.query('DELETE FROM order_items');
  await db.query('DELETE FROM order_timeline');
  await db.query('DELETE FROM orders');
  await db.query("DELETE FROM menu_item_recipes WHERE ingredient_id = 'ing-jalapeno-slice'");
  await db.query("DELETE FROM stock_movements WHERE reference_id NOT LIKE 'INITIAL%' OR ingredient_id = 'ing-jalapeno-slice'");
  await db.query("DELETE FROM ingredients WHERE id = 'ing-jalapeno-slice'");
});

afterAll(async () => {
  await db.close();
});

describe('Phase 4 - Inventory, Recipe Deductions, Ledger & Low-Stock Alerts', () => {
  let adminToken = '';
  let managerToken = '';
  let waiterToken = '';
  let kitchenToken = '';
  let testOrderId = '';

  it('Authenticates Admin, Manager, Waiter and Kitchen staff', async () => {
    const aRes = await request(app).post('/api/auth/pin-login').send({ pin: '1111' });
    expect(aRes.status).toBe(200);
    adminToken = aRes.body.data.token;

    const mRes = await request(app).post('/api/auth/pin-login').send({ pin: '2222' });
    expect(mRes.status).toBe(200);
    managerToken = mRes.body.data.token;

    const wRes = await request(app).post('/api/auth/pin-login').send({ pin: '4444' });
    expect(wRes.status).toBe(200);
    waiterToken = wRes.body.data.token;

    const kRes = await request(app).post('/api/auth/pin-login').send({ pin: '5555' });
    expect(kRes.status).toBe(200);
    kitchenToken = kRes.body.data.token;
  });

  it('Fetches all inventory ingredients with valuations and stock status', async () => {
    const res = await request(app)
      .get('/api/inventory/ingredients')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.summary.totalIngredients).toBeGreaterThanOrEqual(15);
    expect(res.body.summary.totalValuation).toBeGreaterThan(0);
    expect(res.body.data.length).toBeGreaterThanOrEqual(15);

    const chicken = res.body.data.find((i: any) => i.id === 'ing-chicken');
    expect(chicken).toBeDefined();
    expect(chicken.name).toBe('Fresh Boneless Chicken');
    expect(Number(chicken.current_stock)).toBe(60.0);
    expect(Number(chicken.cost_per_unit)).toBe(240.0);
  });

  it('Allows Manager to create a new raw ingredient with initial stock', async () => {
    const res = await request(app)
      .post('/api/inventory/ingredients')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        id: 'ing-jalapeno-slice',
        name: 'Pickled Jalapeno Slices',
        unit: 'kg',
        initialStock: 15.0,
        minThreshold: 3.0,
        costPerUnit: 180.0,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('ing-jalapeno-slice');
    expect(res.body.data.current_stock).toBe(15.0);
  });

  it('Updates ingredient threshold and cost per unit', async () => {
    const res = await request(app)
      .patch('/api/inventory/ingredients/ing-jalapeno-slice')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        minThreshold: 4.5,
        costPerUnit: 195.0,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Number(res.body.data.min_threshold)).toBe(4.5);
    expect(Number(res.body.data.cost_per_unit)).toBe(195.0);
  });

  it('Records stock restock (Purchase) and updates stock balance in ledger', async () => {
    const res = await request(app)
      .post('/api/inventory/restock')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        ingredientId: 'ing-chicken',
        quantity: 25.0,
        costPerUnit: 245.0,
        reference: 'INV-VEN-2026-089',
        notes: 'Weekly fresh poultry delivery',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.addedQuantity).toBe(25.0);
    expect(res.body.data.currentStock).toBe(85.0); // 60 + 25 = 85
  });

  it('Records kitchen spoilage / wastage and logs audit', async () => {
    const res = await request(app)
      .post('/api/inventory/wastage')
      .set('Authorization', `Bearer ${kitchenToken}`)
      .send({
        ingredientId: 'ing-chicken',
        quantity: 3.0,
        reason: 'Freezer temperature anomaly over weekend',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.wastedQuantity).toBe(3.0);
    expect(res.body.data.remainingStock).toBe(82.0); // 85 - 3 = 82
  });

  it('Reconciles physical stock count and records variance in ledger', async () => {
    const res = await request(app)
      .post('/api/inventory/reconcile')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        ingredientId: 'ing-chicken',
        actualCount: 80.0, // System has 82.0, count is 80.0 -> variance -2.0
        reason: 'Weekly physical weigh-in audit',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.actualCount).toBe(80.0);
    expect(res.body.data.variance).toBe(-2.0);
  });

  it('Retrieves the stock movement audit ledger', async () => {
    const res = await request(app)
      .get('/api/inventory/ledger?ingredientId=ing-chicken')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.total).toBeGreaterThanOrEqual(3);
    const types = res.body.data.map((m: any) => m.movement_type);
    expect(types).toContain('PURCHASE');
    expect(types).toContain('WASTAGE');
    expect(types).toContain('ADJUSTMENT');
  });

  it('Automatically deducts recipe ingredients when order enters PREPARING', async () => {
    // 1. Check current chicken and flour wrap stocks
    const chickenBefore = await db.query('SELECT current_stock FROM ingredients WHERE id = $1', ['ing-chicken']);
    const wrapsBefore = await db.query('SELECT current_stock FROM ingredients WHERE id = $1', ['ing-flour-wrap']);
    const initialChicken = Number(chickenBefore.rows[0].current_stock);
    const initialWraps = Number(wrapsBefore.rows[0].current_stock);

    // 2. Create order for Rollify Signature Chicken Roll (rnv-05: 0.12kg chicken, 1 wrap) x 2
    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({
        orderType: 'DINE_IN',
        tableId: 'tbl-01',
        customerName: 'Aarav Patel',
        items: [
          {
            menuItemId: 'rnv-05',
            quantity: 2,
            unitPrice: 139.0,
          },
        ],
      });

    expect(orderRes.status).toBe(201);
    testOrderId = orderRes.body.data.orderId || orderRes.body.data.id;

    // Send to Kitchen
    await request(app)
      .post(`/api/orders/${testOrderId}/send-to-kitchen`)
      .set('Authorization', `Bearer ${waiterToken}`);

    // Transition to PREPARING -> Triggers recipe consumption!
    const prepRes = await request(app)
      .patch(`/api/orders/${testOrderId}/status`)
      .set('Authorization', `Bearer ${kitchenToken}`)
      .send({
        status: 'PREPARING',
        notes: 'Wok heated, starting assembly',
      });

    expect(prepRes.status).toBe(200);
    expect(prepRes.body.data.status).toBe('PREPARING');
    expect(prepRes.body.data.inventoryImpact).toBeDefined();
    expect(prepRes.body.data.inventoryImpact.deducted).toBe(true);

    // 3. Verify stock was correctly deducted: 2 rolls * 0.12kg = 0.24kg chicken, 2 wraps
    const chickenAfter = await db.query('SELECT current_stock FROM ingredients WHERE id = $1', ['ing-chicken']);
    const wrapsAfter = await db.query('SELECT current_stock FROM ingredients WHERE id = $1', ['ing-flour-wrap']);
    
    expect(Number(chickenAfter.rows[0].current_stock)).toBe(Math.round((initialChicken - 0.24) * 1000) / 1000);
    expect(Number(wrapsAfter.rows[0].current_stock)).toBe(initialWraps - 2);

    // Verify CONSUMPTION ledger entries exist
    const movements = await db.query(
      `SELECT * FROM stock_movements WHERE reference_id = $1 AND movement_type = 'CONSUMPTION'`,
      [testOrderId]
    );
    expect(movements.rows.length).toBeGreaterThanOrEqual(2);
  });

  it('Enforces idempotency: does not double-deduct ingredients for the same order', async () => {
    const chickenBefore = await db.query('SELECT current_stock FROM ingredients WHERE id = $1', ['ing-chicken']);

    // Attempt direct deduction again
    const result = await inventoryService.deductOrderStock(testOrderId, 'usr-admin-01');
    expect(result.deducted).toBe(false);
    expect(result.reason).toBe('ALREADY_DEDUCTED');

    const chickenAfter = await db.query('SELECT current_stock FROM ingredients WHERE id = $1', ['ing-chicken']);
    expect(Number(chickenAfter.rows[0].current_stock)).toBe(Number(chickenBefore.rows[0].current_stock));
  });

  it('Reverses stock when an order is cancelled without food waste', async () => {
    const chickenBefore = await db.query('SELECT current_stock FROM ingredients WHERE id = $1', ['ing-chicken']);
    const wrapsBefore = await db.query('SELECT current_stock FROM ingredients WHERE id = $1', ['ing-flour-wrap']);

    const cancelRes = await request(app)
      .patch(`/api/orders/${testOrderId}/status`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        status: 'CANCELLED',
        notes: 'Customer changed mind before ingredients were cooked',
        isWasted: false,
      });

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.status).toBe('CANCELLED');
    expect(cancelRes.body.data.inventoryImpact.reversed).toBe(true);

    // Stock should be restored
    const chickenAfter = await db.query('SELECT current_stock FROM ingredients WHERE id = $1', ['ing-chicken']);
    const wrapsAfter = await db.query('SELECT current_stock FROM ingredients WHERE id = $1', ['ing-flour-wrap']);

    expect(Number(chickenAfter.rows[0].current_stock)).toBe(
      Math.round((Number(chickenBefore.rows[0].current_stock) + 0.24) * 1000) / 1000
    );
    expect(Number(wrapsAfter.rows[0].current_stock)).toBe(Number(wrapsBefore.rows[0].current_stock) + 2);

    // Verify REVERSAL ledger entry
    const revRes = await db.query(
      `SELECT * FROM stock_movements WHERE reference_id = $1 AND movement_type = 'REVERSAL'`,
      [testOrderId]
    );
    expect(revRes.rows.length).toBeGreaterThanOrEqual(1);
  });

  it('Logs kitchen wastage without restoring stock when food was already cooked', async () => {
    // Create new order and move to PREPARING
    const oRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({
        orderType: 'TAKEAWAY',
        customerName: 'Vikram Singh',
        items: [{ menuItemId: 'rnv-01', quantity: 1, unitPrice: 119.0 }], // Crispy Chicken Roll (0.10kg chicken, 1 wrap)
      });
    const wastedOrderId = oRes.body.data.orderId || oRes.body.data.id;

    await request(app).patch(`/api/orders/${wastedOrderId}/status`).set('Authorization', `Bearer ${kitchenToken}`).send({
      status: 'SENT_TO_KITCHEN',
    });
    await request(app).patch(`/api/orders/${wastedOrderId}/status`).set('Authorization', `Bearer ${kitchenToken}`).send({
      status: 'PREPARING',
    });

    const chickenBeforeCancel = await db.query('SELECT current_stock FROM ingredients WHERE id = $1', ['ing-chicken']);

    // Cancel order as WASTED (e.g. food burnt during preparation)
    const cancelRes = await request(app)
      .patch(`/api/orders/${wastedOrderId}/status`)
      .set('Authorization', `Bearer ${kitchenToken}`)
      .send({
        status: 'CANCELLED',
        notes: 'Roll fell off counter during packaging, unsalvageable',
        isWasted: true,
      });

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.inventoryImpact.reversed).toBe(true);
    expect(cancelRes.body.data.inventoryImpact.isWasted).toBe(true);

    // Stock should NOT be increased back
    const chickenAfterCancel = await db.query('SELECT current_stock FROM ingredients WHERE id = $1', ['ing-chicken']);
    expect(Number(chickenAfterCancel.rows[0].current_stock)).toBe(Number(chickenBeforeCancel.rows[0].current_stock));

    // Ledger has WASTAGE entry referencing the order
    const wasteLedger = await db.query(
      `SELECT * FROM stock_movements WHERE reference_id = $1 AND movement_type = 'WASTAGE'`,
      [wastedOrderId]
    );
    expect(wasteLedger.rows.length).toBeGreaterThanOrEqual(1);
  });

  it('Surfaces low-stock alerts when an ingredient falls below threshold', async () => {
    // Artificially lower stock of peri peri seasoning below 2.0 kg threshold
    await db.query(`UPDATE ingredients SET current_stock = 1.2 WHERE id = 'ing-peri-peri'`);

    const alertsRes = await request(app)
      .get('/api/inventory/alerts')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(alertsRes.status).toBe(200);
    expect(alertsRes.body.success).toBe(true);
    expect(alertsRes.body.count).toBeGreaterThanOrEqual(1);

    const periAlert = alertsRes.body.data.find((a: any) => a.id === 'ing-peri-peri');
    expect(periAlert).toBeDefined();
    expect(Number(periAlert.current_stock)).toBe(1.2);
    expect(Number(periAlert.shortage)).toBe(0.8); // 2.0 - 1.2 = 0.8
  });

  it('Retrieves and updates recipes for menu items', async () => {
    // 1. Get recipes list
    const listRes = await request(app)
      .get('/api/inventory/recipes')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.success).toBe(true);
    expect(listRes.body.data.length).toBeGreaterThanOrEqual(5);

    // 2. Configure recipe for rnv-01 (Crispy Chicken Roll)
    const updateRes = await request(app)
      .put('/api/inventory/recipes/rnv-01')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        ingredients: [
          { ingredientId: 'ing-flour-wrap', quantity: 1.0, unit: 'pcs' },
          { ingredientId: 'ing-chicken', quantity: 0.11, unit: 'kg' },
          { ingredientId: 'ing-garlic-mayo', quantity: 0.025, unit: 'l' },
          { ingredientId: 'ing-jalapeno-slice', quantity: 0.015, unit: 'kg' },
        ],
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.success).toBe(true);

    // Verify updated recipe
    const getRes = await request(app)
      .get('/api/inventory/recipes/rnv-01')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.data.length).toBe(4);
    const jalapeno = getRes.body.data.find((r: any) => r.ingredient_id === 'ing-jalapeno-slice');
    expect(jalapeno).toBeDefined();
    expect(Number(jalapeno.quantity)).toBe(0.015);
  });
});
