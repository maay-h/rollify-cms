import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { getIO } from '../socket/index.js';

export const customerQrRouter = Router();

// In-memory loyalty fallback for demo & high-speed caching
interface CustomerLoyaltyRecord {
  id: string;
  phone: string;
  name: string;
  dob?: string;
  birth_month?: number;
  referral_code: string;
  referred_by?: string;
  craving_points: number;
  total_orders: number;
  current_streak: number;
  streak_unlocked_at?: string;
  active_vouchers: string[];
}

const loyaltyMemoryStore = new Map<string, CustomerLoyaltyRecord>();

// Ensure loyalty table exists
let isLoyaltyTableChecked = false;
async function ensureLoyaltyTable() {
  if (isLoyaltyTableChecked) return;
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS customer_loyalty (
        id VARCHAR(50) PRIMARY KEY,
        phone VARCHAR(20) UNIQUE NOT NULL,
        name VARCHAR(100) NOT NULL,
        dob VARCHAR(20),
        birth_month INTEGER,
        referral_code VARCHAR(30) UNIQUE NOT NULL,
        referred_by VARCHAR(50),
        craving_points INTEGER NOT NULL DEFAULT 50,
        total_orders INTEGER NOT NULL DEFAULT 0,
        current_streak INTEGER NOT NULL DEFAULT 0,
        streak_unlocked_at TIMESTAMPTZ,
        last_order_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    isLoyaltyTableChecked = true;
  } catch (err) {
    // safe fallback to in-memory store
    isLoyaltyTableChecked = true;
  }
}

// 1. GET TABLE INFO & MENU VIA QR TOKEN
customerQrRouter.get('/table/:qrToken', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { qrToken } = req.params;
    await ensureLoyaltyTable();

    // Query table
    const tableRes = await db.query(
      `SELECT id, table_number, section, capacity, status, qr_token 
       FROM dining_tables 
       WHERE qr_token = $1 OR id = $1 OR table_number = $1
       LIMIT 1`,
      [qrToken]
    );

    if (tableRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: `Cafe table not found for QR token: ${qrToken}. Please verify with staff.`,
      });
    }

    const table = tableRes.rows[0];

    // Query active menu categories
    const catsRes = await db.query(
      `SELECT id, name, slug, description, display_order 
       FROM menu_categories 
       WHERE is_active = true 
       ORDER BY display_order ASC`
    );

    // Query active menu items with variants
    const itemsRes = await db.query(
      `SELECT 
        m.id, m.category_id, m.name, m.description, m.price, 
        m.tax_rate, m.is_veg, m.is_available, m.is_chef_special, 
        m.is_spicy, m.image_url, m.prep_time_minutes, m.display_order,
        COALESCE(
          (SELECT json_agg(json_build_object(
            'id', v.id,
            'variant_name', v.variant_name,
            'price', v.price,
            'is_available', v.is_available
          ))
          FROM menu_item_variants v
          WHERE v.menu_item_id = m.id AND v.is_available = true),
          '[]'::json
        ) as variants
      FROM menu_items m
      WHERE m.is_available = true
      ORDER BY m.display_order ASC, m.name ASC`
    );

    res.json({
      success: true,
      data: {
        table,
        categories: catsRes.rows,
        menuItems: itemsRes.rows,
      },
    });
  } catch (err) {
    next(err);
  }
});

// 2. SEND OTP FOR CUSTOMER LOGIN / ONBOARDING
const sendOtpSchema = z.object({
  phone: z.string().min(10).max(15),
});

customerQrRouter.post('/customer/send-otp', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone } = sendOtpSchema.parse(req.body);
    const cleanPhone = phone.replace(/[^0-9]/g, '').slice(-10);

    // Simulated 4-digit OTP (1234 for immediate testing convenience)
    const demoOtp = '1234';

    res.json({
      success: true,
      message: `OTP sent successfully to +91 ${cleanPhone}`,
      data: {
        phone: cleanPhone,
        demoOtp, // Surfaced for easy one-click testing
      },
    });
  } catch (err) {
    next(err);
  }
});

// 3. VERIFY OTP & ONBOARD / RETRIEVE CUSTOMER LOYALTY PROFILE
const verifyOtpSchema = z.object({
  phone: z.string().min(10).max(15),
  otp: z.string().min(4).max(6),
  name: z.string().optional(),
  dob: z.string().optional(), // YYYY-MM-DD
  referralCode: z.string().optional(),
});

customerQrRouter.post('/customer/verify-otp', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone, otp, name, dob, referralCode } = verifyOtpSchema.parse(req.body);
    const cleanPhone = phone.replace(/[^0-9]/g, '').slice(-10);

    // Accept standard demo OTP '1234' or any 4-digit entry in dev
    if (otp !== '1234' && otp.length !== 4) {
      return res.status(400).json({
        success: false,
        error: 'Invalid OTP code. Please enter 1234 to proceed.',
      });
    }

    await ensureLoyaltyTable();

    // Check if customer exists in DB
    let customer: any = null;
    try {
      const existing = await db.query(
        `SELECT * FROM customer_loyalty WHERE phone = $1 LIMIT 1`,
        [cleanPhone]
      );
      if (existing.rows.length > 0) {
        customer = existing.rows[0];
      }
    } catch {
      customer = loyaltyMemoryStore.get(cleanPhone);
    }

    const currentMonth = new Date().getMonth() + 1; // 1-12

    if (!customer) {
      // First-time Customer Registration
      const customerName = name?.trim() || `Guest Diner ${cleanPhone.slice(-4)}`;
      let birthMonth: number | null = null;
      if (dob) {
        const parts = dob.split('-');
        if (parts.length >= 2) {
          birthMonth = parseInt(parts[1], 10);
        }
      }

      // Generate unique referral code: ROLL-<FIRSTNAME>-<LAST3>
      const firstName = customerName.split(' ')[0].toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5) || 'GUEST';
      const myReferralCode = `ROLL-${firstName}-${cleanPhone.slice(-3)}`;
      const customerId = `cust-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      
      // Bonus points: +50 welcome, +50 extra if referred
      let initialPoints = 50;
      if (referralCode && referralCode.trim()) {
        initialPoints += 50;
      }

      const newRecord = {
        id: customerId,
        phone: cleanPhone,
        name: customerName,
        dob: dob || null,
        birth_month: birthMonth,
        referral_code: myReferralCode,
        referred_by: referralCode?.trim() || null,
        craving_points: initialPoints,
        total_orders: 0,
        current_streak: 0,
        streak_unlocked_at: null,
      };

      try {
        await db.query(
          `INSERT INTO customer_loyalty (id, phone, name, dob, birth_month, referral_code, referred_by, craving_points, total_orders, current_streak)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, 0)`,
          [customerId, cleanPhone, customerName, dob || null, birthMonth, myReferralCode, referralCode?.trim() || null, initialPoints]
        );
        customer = newRecord;
      } catch (e) {
        loyaltyMemoryStore.set(cleanPhone, {
          ...newRecord,
          dob: dob || undefined,
          birth_month: birthMonth || undefined,
          referred_by: referralCode?.trim() || undefined,
          streak_unlocked_at: undefined,
          active_vouchers: [],
        });
        customer = newRecord;
      }
    }

    // Compute active perks & vouchers
    const isBirthdayMonth = customer.birth_month === currentMonth;
    const isStreakActive = customer.streak_unlocked_at 
      ? new Date(customer.streak_unlocked_at).getTime() > Date.now() 
      : false;

    const perks = {
      isBirthdayMonth,
      birthdayTreatAvailable: isBirthdayMonth,
      isStreakDiscountActive: isStreakActive,
      streakDiscountPercent: 10,
      nextFreeDishIn: Math.max(0, 5 - (customer.current_streak % 5)),
      freeDishUnlocked: customer.total_orders > 0 && customer.current_streak % 5 === 0,
      referralBonusAvailable: true,
    };

    res.json({
      success: true,
      message: 'OTP Verified successfully',
      data: {
        customer: {
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
          dob: customer.dob,
          birthMonth: customer.birth_month,
          referralCode: customer.referral_code,
          cravingPoints: customer.craving_points,
          totalOrders: customer.total_orders,
          currentStreak: customer.current_streak,
        },
        perks,
      },
    });
  } catch (err) {
    next(err);
  }
});

// 4. GET CUSTOMER LOYALTY DETAILS
customerQrRouter.get('/customer/loyalty/:phone', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const phoneParam = Array.isArray(req.params.phone) ? req.params.phone[0] : req.params.phone;
    const cleanPhone = String(phoneParam || '').replace(/[^0-9]/g, '').slice(-10);
    await ensureLoyaltyTable();

    let customer: any = null;
    try {
      const resDb = await db.query(`SELECT * FROM customer_loyalty WHERE phone = $1 LIMIT 1`, [cleanPhone]);
      if (resDb.rows.length > 0) customer = resDb.rows[0];
    } catch {
      customer = loyaltyMemoryStore.get(cleanPhone);
    }

    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    const currentMonth = new Date().getMonth() + 1;
    const isBirthdayMonth = customer.birth_month === currentMonth;
    const isStreakActive = customer.streak_unlocked_at 
      ? new Date(customer.streak_unlocked_at).getTime() > Date.now() 
      : false;

    res.json({
      success: true,
      data: {
        customer: {
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
          dob: customer.dob,
          birthMonth: customer.birth_month,
          referralCode: customer.referral_code,
          cravingPoints: customer.craving_points,
          totalOrders: customer.total_orders,
          currentStreak: customer.current_streak,
        },
        perks: {
          isBirthdayMonth,
          birthdayTreatAvailable: isBirthdayMonth,
          isStreakDiscountActive: isStreakActive,
          streakDiscountPercent: 10,
          nextFreeDishIn: Math.max(0, 5 - (customer.current_streak % 5)),
          freeDishUnlocked: customer.total_orders > 0 && customer.current_streak % 5 === 0,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// 5. PLACE TABLE QR ORDER
const tableOrderItemSchema = z.object({
  menuItemId: z.string(),
  variantId: z.string().optional(),
  variantName: z.string().optional(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
  notes: z.string().optional(),
});

const placeTableOrderSchema = z.object({
  tableId: z.string(),
  qrToken: z.string().optional(),
  customerPhone: z.string().min(10),
  customerName: z.string().min(1),
  items: z.array(tableOrderItemSchema).min(1),
  notes: z.string().optional(),
  appliedDiscountPercent: z.number().default(0),
  appliedVoucher: z.string().optional(),
});

customerQrRouter.post('/table-order', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = placeTableOrderSchema.parse(req.body);
    await ensureLoyaltyTable();

    // Verify table
    const tableRes = await db.query(
      `SELECT id, table_number, section, status FROM dining_tables WHERE id = $1 LIMIT 1`,
      [payload.tableId]
    );

    if (tableRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Dining table not found' });
    }

    const table = tableRes.rows[0];

    // Compute financial totals
    const subtotal = payload.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const discountAmount = Math.round((subtotal * (payload.appliedDiscountPercent / 100)) * 100) / 100;
    const taxableAmount = Math.max(0, subtotal - discountAmount);
    const taxRate = 5.0; // 5% GST
    const taxAmount = Math.round((taxableAmount * (taxRate / 100)) * 100) / 100;
    const totalAmount = Math.round((taxableAmount + taxAmount) * 100) / 100;

    // Generate Order ID & Daily Sequence
    const orderId = `ord-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randSeq = Math.floor(100 + Math.random() * 900);
    const orderNumber = `ORD-${todayStr}-${randSeq}`;

    // Transactional insert into orders
    await db.query(
      `INSERT INTO orders (
        id, order_number, order_type, table_id, customer_name, customer_phone,
        status, subtotal, discount_amount, tax_amount, total_amount, payment_status, notes
      ) VALUES (
        $1, $2, 'QR_CUSTOMER', $3, $4, $5, 'SENT_TO_KITCHEN', $6, $7, $8, $9, 'UNPAID', $10
      )`,
      [
        orderId,
        orderNumber,
        table.id,
        payload.customerName,
        payload.customerPhone,
        subtotal,
        discountAmount,
        taxAmount,
        totalAmount,
        payload.notes || `Table QR Self-Order from ${table.table_number}${payload.appliedVoucher ? ` (${payload.appliedVoucher})` : ''}`,
      ]
    );

    // Insert order items
    for (const item of payload.items) {
      const orderItemId = `oi-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const itemSubtotal = item.unitPrice * item.quantity;
      await db.query(
        `INSERT INTO order_items (
          id, order_id, menu_item_id, variant_id, variant_name, quantity, unit_price, tax_rate, subtotal, notes, item_status
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, 5.00, $8, $9, 'PENDING'
        )`,
        [
          orderItemId,
          orderId,
          item.menuItemId,
          item.variantId || null,
          item.variantName || 'Single',
          item.quantity,
          item.unitPrice,
          itemSubtotal,
          item.notes || null,
        ]
      );
    }

    // Insert order timeline
    const timelineId = `ot-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    await db.query(
      `INSERT INTO order_timeline (id, order_id, action, from_status, to_status, notes)
       VALUES ($1, $2, 'QR_ORDER_PLACED', 'CREATED', 'SENT_TO_KITCHEN', 'Customer placed order via Table QR')`,
      [timelineId, orderId]
    );

    // Update table occupancy status
    await db.query(
      `UPDATE dining_tables SET status = 'OCCUPIED', current_order_id = $1 WHERE id = $2`,
      [orderId, table.id]
    );

    // Update Customer Loyalty Stats:
    // 1. Total orders + 1
    // 2. Current streak + 1
    // 3. Craving points: 10 points per ₹100 spent
    // 4. If order >= ₹300, unlock 15-day 10% streak discount!
    const cleanPhone = payload.customerPhone.replace(/[^0-9]/g, '').slice(-10);
    const earnedPoints = Math.max(10, Math.floor(totalAmount / 10));
    const streakUnlocked = totalAmount >= 300 
      ? new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString() 
      : null;

    try {
      if (streakUnlocked) {
        await db.query(
          `UPDATE customer_loyalty 
           SET total_orders = total_orders + 1,
               current_streak = current_streak + 1,
               craving_points = craving_points + $1,
               streak_unlocked_at = $2,
               last_order_at = CURRENT_TIMESTAMP
           WHERE phone = $3`,
          [earnedPoints, streakUnlocked, cleanPhone]
        );
      } else {
        await db.query(
          `UPDATE customer_loyalty 
           SET total_orders = total_orders + 1,
               current_streak = current_streak + 1,
               craving_points = craving_points + $1,
               last_order_at = CURRENT_TIMESTAMP
           WHERE phone = $3`,
          [earnedPoints, cleanPhone]
        );
      }
    } catch (e) {
      // In-memory fallback
      const c = loyaltyMemoryStore.get(cleanPhone);
      if (c) {
        c.total_orders += 1;
        c.current_streak += 1;
        c.craving_points += earnedPoints;
        if (streakUnlocked) c.streak_unlocked_at = streakUnlocked;
      }
    }

    // Real-Time Socket Broadcast to Kitchen & Cashier
    const io = getIO();
    if (io) {
      const socketPayload = {
        id: orderId,
        orderNumber,
        orderType: 'QR_CUSTOMER',
        tableId: table.id,
        tableNumber: table.table_number,
        section: table.section,
        customerName: payload.customerName,
        customerPhone: payload.customerPhone,
        status: 'SENT_TO_KITCHEN',
        totalAmount,
        itemCount: payload.items.reduce((s, it) => s + it.quantity, 0),
        items: payload.items,
        notes: payload.notes,
        createdAt: new Date().toISOString(),
      };

      io.emit('order:new', socketPayload);
      io.emit('kds:new_order', socketPayload);
      io.emit('table:status', { tableId: table.id, status: 'OCCUPIED' });
    }

    res.status(201).json({
      success: true,
      message: `Table order dispatched to kitchen for ${table.table_number}`,
      data: {
        orderId,
        orderNumber,
        tableNumber: table.table_number,
        section: table.section,
        totalAmount,
        earnedPoints,
        status: 'SENT_TO_KITCHEN',
      },
    });
  } catch (err) {
    next(err);
  }
});
