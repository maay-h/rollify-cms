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

describe('Rollify POS Authentication & RBAC API', () => {
  let adminToken = '';
  let cashierToken = '';
  let waiterToken = '';

  it('Healthcheck endpoint returns HEALTHY and connected database info', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.status).toBe('HEALTHY');
    expect(res.body.database.status).toBe('CONNECTED');
  });

  it('Successfully authenticates Admin user with username & password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        identifier: 'admin',
        password: 'admin123',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.role).toBe('ADMIN');
    expect(res.body.data.user.username).toBe('admin');
    adminToken = res.body.data.token;
  });

  it('Rejects login attempt with incorrect password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        identifier: 'admin',
        password: 'wrong_password_999',
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('Supports quick 4-digit PIN login for POS terminals (Cashier PIN: 3333)', async () => {
    const res = await request(app)
      .post('/api/auth/pin-login')
      .send({
        pin: '3333',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.role).toBe('CASHIER');
    cashierToken = res.body.data.token;
  });

  it('Rejects invalid 4-digit PIN', async () => {
    const res = await request(app)
      .post('/api/auth/pin-login')
      .send({
        pin: '9999',
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('Supports quick 4-digit PIN login for Waiter (PIN: 4444)', async () => {
    const res = await request(app)
      .post('/api/auth/pin-login')
      .send({
        pin: '4444',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.role).toBe('WAITER');
    waiterToken = res.body.data.token;
  });

  it('Fetches authenticated user profile via /api/auth/me with Bearer token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${cashierToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.role).toBe('CASHIER');
  });

  it('Rejects /api/auth/me without Bearer token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('Enforces backend RBAC: Cashier cannot access Admin-only /api/users (403 Forbidden)', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${cashierToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('Forbidden');
  });

  it('Allows Admin to access /api/users (200 OK)', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(5);
  });

  it('Authenticated user can list dining tables with real-time occupancy status', async () => {
    const res = await request(app)
      .get('/api/tables')
      .set('Authorization', `Bearer ${waiterToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(10);
  });

  it('Authenticated user can list menu categories and items', async () => {
    const res = await request(app)
      .get('/api/menu/items')
      .set('Authorization', `Bearer ${waiterToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(10);
  });
});
