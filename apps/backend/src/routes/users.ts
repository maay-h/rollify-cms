import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '../db/index.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validate.js';
import { logAudit } from '../middleware/audit.js';

export const usersRouter = Router();

const createUserSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['ADMIN', 'MANAGER', 'CASHIER', 'WAITER', 'KITCHEN']),
  pinCode: z.string().length(4).optional(),
  fullName: z.string().min(2),
  phone: z.string().optional(),
});

// List all users (Admin & Manager)
usersRouter.get('/', authenticateToken, requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await db.query(
      `SELECT id, username, email, role, pin_code, full_name, phone, is_active, created_at
       FROM users
       ORDER BY role, full_name ASC`
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

// Create new user (Admin only)
usersRouter.post(
  '/',
  authenticateToken,
  requireRole('ADMIN'),
  validateRequest({ body: createUserSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { username, email, password, role, pinCode, fullName, phone } = req.body;

      // Check unique
      const existing = await db.query(
        'SELECT id FROM users WHERE username = $1 OR email = $2',
        [username.trim().toLowerCase(), email.trim().toLowerCase()]
      );

      if (existing.rows.length > 0) {
        return res.status(409).json({
          success: false,
          error: 'Username or email already exists',
        });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const id = `usr-${Date.now()}`;

      await db.query(
        `INSERT INTO users (id, username, email, password_hash, role, pin_code, full_name, phone)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [id, username.trim().toLowerCase(), email.trim().toLowerCase(), passwordHash, role, pinCode || null, fullName, phone || null]
      );

      await logAudit({
        userId: req.user!.id,
        action: 'USER_CREATED',
        entityType: 'USER',
        entityId: id,
        details: { username, role, fullName },
      });

      res.status(201).json({
        success: true,
        message: 'User created successfully',
        data: { id, username, email, role, fullName },
      });
    } catch (error) {
      next(error);
    }
  }
);
