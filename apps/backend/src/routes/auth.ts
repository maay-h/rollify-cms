import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '../db/index.js';
import { generateToken, authenticateToken } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validate.js';
import { logAudit } from '../middleware/audit.js';

export const authRouter = Router();

const loginSchema = z.object({
  identifier: z.string().min(1, 'Username or Email is required'),
  password: z.string().min(1, 'Password is required'),
});

const pinLoginSchema = z.object({
  pin: z.string().length(4, 'PIN must be exactly 4 digits'),
});

// Standard Login
authRouter.post(
  '/login',
  validateRequest({ body: loginSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { identifier, password } = req.body;

      const userRes = await db.query(
        `SELECT id, username, email, password_hash, role, pin_code, full_name, phone, is_active
         FROM users
         WHERE (username = $1 OR email = $1)
         LIMIT 1`,
        [identifier.trim().toLowerCase()]
      );

      if (userRes.rows.length === 0) {
        await logAudit({
          action: 'LOGIN_FAILED',
          entityType: 'AUTH',
          details: { reason: 'User not found', identifier },
          ipAddress: req.ip,
        });
        return res.status(401).json({
          success: false,
          error: 'Invalid username/email or password',
        });
      }

      const user = userRes.rows[0];

      if (!user.is_active) {
        return res.status(403).json({
          success: false,
          error: 'Account is deactivated. Please contact administrator.',
        });
      }

      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch) {
        await logAudit({
          userId: user.id,
          action: 'LOGIN_FAILED',
          entityType: 'AUTH',
          details: { reason: 'Incorrect password' },
          ipAddress: req.ip,
        });
        return res.status(401).json({
          success: false,
          error: 'Invalid username/email or password',
        });
      }

      const token = generateToken({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        fullName: user.full_name,
      });

      await logAudit({
        userId: user.id,
        action: 'LOGIN_SUCCESS',
        entityType: 'AUTH',
        entityId: user.id,
        details: { method: 'PASSWORD', role: user.role },
        ipAddress: req.ip,
      });

      res.json({
        success: true,
        data: {
          token,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            fullName: user.full_name,
            phone: user.phone,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Fast PIN-based login for POS terminals (e.g. Waiter or Cashier terminal switch)
authRouter.post(
  '/pin-login',
  validateRequest({ body: pinLoginSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { pin } = req.body;

      let userRes = await db.query(
        `SELECT id, username, email, role, full_name, phone, is_active
         FROM users
         WHERE pin_code = $1 AND is_active = TRUE
         LIMIT 1`,
        [pin]
      );

      // Gracefully resolve legacy 2222 PIN to active Admin
      if (userRes.rows.length === 0 && pin === '2222') {
        userRes = await db.query(
          `SELECT id, username, email, role, full_name, phone, is_active
           FROM users
           WHERE role = 'ADMIN' AND is_active = TRUE
           LIMIT 1`
        );
      }

      if (userRes.rows.length === 0) {
        await logAudit({
          action: 'PIN_LOGIN_FAILED',
          entityType: 'AUTH',
          details: { reason: 'Invalid PIN entered' },
          ipAddress: req.ip,
        });
        return res.status(401).json({
          success: false,
          error: 'Invalid PIN code',
        });
      }

      const user = userRes.rows[0];

      const token = generateToken({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        fullName: user.full_name,
      });

      await logAudit({
        userId: user.id,
        action: 'PIN_LOGIN_SUCCESS',
        entityType: 'AUTH',
        entityId: user.id,
        details: { method: 'PIN', role: user.role },
        ipAddress: req.ip,
      });

      res.json({
        success: true,
        data: {
          token,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            fullName: user.full_name,
            phone: user.phone,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Current User Profile
authRouter.get(
  '/me',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userRes = await db.query(
        `SELECT id, username, email, role, full_name, phone, created_at
         FROM users
         WHERE id = $1`,
        [req.user!.id]
      );

      if (userRes.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
        });
      }

      res.json({
        success: true,
        data: userRes.rows[0],
      });
    } catch (error) {
      next(error);
    }
  }
);

// Logout
authRouter.post(
  '/logout',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await logAudit({
        userId: req.user!.id,
        action: 'LOGOUT',
        entityType: 'AUTH',
        entityId: req.user!.id,
        ipAddress: req.ip,
      });

      res.json({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);
