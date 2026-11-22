import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validate.js';
import { logAudit } from '../middleware/audit.js';

export const shiftsRouter = Router();

// Validation Schemas
const clockInSchema = z.object({
  userId: z.string().optional(),
  hourlyRate: z.number().min(0).optional(),
  notes: z.string().optional(),
});

const clockOutSchema = z.object({
  userId: z.string().optional(),
  notes: z.string().optional(),
});

const adjustShiftSchema = z.object({
  shiftId: z.string().min(1),
  totalHours: z.number().min(0, 'Total hours cannot be negative'),
  hourlyRate: z.number().min(0, 'Hourly rate cannot be negative'),
  notes: z.string().min(3, 'Reason for adjustment is mandatory'),
});

// 1. List Shifts (with staff name and role)
shiftsRouter.get(
  '/',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, date, status, limit = 50 } = req.query;

      let query = `
        SELECT 
          s.*,
          u.full_name,
          u.username,
          u.role,
          u.phone
        FROM staff_shifts s
        JOIN users u ON s.user_id = u.id
        WHERE 1=1
      `;
      const params: any[] = [];

      // Non-managers can only view their own shifts
      if (!['ADMIN', 'MANAGER'].includes(req.user!.role)) {
        params.push(req.user!.id);
        query += ` AND s.user_id = $${params.length}`;
      } else if (userId && typeof userId === 'string') {
        params.push(userId);
        query += ` AND s.user_id = $${params.length}`;
      }

      if (date && typeof date === 'string') {
        params.push(date);
        query += ` AND s.shift_date = $${params.length}::date`;
      }

      if (status && typeof status === 'string') {
        params.push(status);
        query += ` AND s.status = $${params.length}`;
      }

      query += ` ORDER BY s.clock_in DESC LIMIT $${params.length + 1}`;
      params.push(Number(limit));

      const result = await db.query(query, params);

      res.json({
        success: true,
        data: result.rows,
      });
    } catch (error) {
      next(error);
    }
  }
);

// 2. Clock In Staff
shiftsRouter.post(
  '/clock-in',
  authenticateToken,
  validateRequest({ body: clockInSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const targetUserId = req.body.userId && ['ADMIN', 'MANAGER'].includes(req.user!.role)
        ? req.body.userId
        : req.user!.id;

      // Check for already active shift
      const activeRes = await db.query(
        `SELECT id FROM staff_shifts WHERE user_id = $1 AND status = 'ACTIVE'`,
        [targetUserId]
      );

      if (activeRes.rows.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Staff member is already clocked in to an active shift',
        });
      }

      // Fetch user profile for default hourly rate
      const userRes = await db.query('SELECT full_name, role, hourly_rate FROM users WHERE id = $1', [targetUserId]);
      if (userRes.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      const staff = userRes.rows[0];
      const rate = req.body.hourlyRate !== undefined ? req.body.hourlyRate : Number(staff.hourly_rate || 120);
      const shiftId = `shf-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const today = new Date().toISOString().slice(0, 10);

      await db.query(
        `INSERT INTO staff_shifts (id, user_id, shift_date, clock_in, hourly_rate, status, notes)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4, 'ACTIVE', $5)`,
        [shiftId, targetUserId, today, rate, req.body.notes || 'Normal floor shift']
      );

      await logAudit({
        userId: req.user!.id,
        action: 'STAFF_CLOCKED_IN',
        entityType: 'USER',
        entityId: targetUserId,
        details: { staffName: staff.full_name, shiftId, rate },
      });

      res.status(201).json({
        success: true,
        message: `${staff.full_name} (${staff.role}) clocked in successfully`,
        data: {
          shiftId,
          userId: targetUserId,
          staffName: staff.full_name,
          clockInTime: new Date().toISOString(),
          hourlyRate: rate,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// 3. Clock Out Staff (Computes Duration & Shift Wages)
shiftsRouter.post(
  '/clock-out',
  authenticateToken,
  validateRequest({ body: clockOutSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const targetUserId = req.body.userId && ['ADMIN', 'MANAGER'].includes(req.user!.role)
        ? req.body.userId
        : req.user!.id;

      // Find active shift
      const shiftRes = await db.query(
        `SELECT s.*, u.full_name 
         FROM staff_shifts s
         JOIN users u ON s.user_id = u.id
         WHERE s.user_id = $1 AND s.status = 'ACTIVE'
         ORDER BY s.clock_in DESC LIMIT 1`,
        [targetUserId]
      );

      if (shiftRes.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'No active clock-in found for this staff member',
        });
      }

      const shift = shiftRes.rows[0];
      const clockIn = new Date(shift.clock_in).getTime();
      const clockOut = Date.now();
      
      // Minimum duration 0.1 hour (6 minutes) for testing / brief shifts
      const rawHours = (clockOut - clockIn) / (1000 * 60 * 60);
      const totalHours = Math.max(0.1, Math.round(rawHours * 100) / 100);
      const hourlyRate = Number(shift.hourly_rate);
      const shiftWage = Math.round((totalHours * hourlyRate) * 100) / 100;

      await db.query(
        `UPDATE staff_shifts 
         SET clock_out = CURRENT_TIMESTAMP,
             total_hours = $1,
             shift_wage = $2,
             status = 'COMPLETED',
             notes = COALESCE($3, notes)
         WHERE id = $4`,
        [totalHours, shiftWage, req.body.notes || shift.notes, shift.id]
      );

      await logAudit({
        userId: req.user!.id,
        action: 'STAFF_CLOCKED_OUT',
        entityType: 'USER',
        entityId: targetUserId,
        details: { staffName: shift.full_name, shiftId: shift.id, totalHours, shiftWage },
      });

      res.json({
        success: true,
        message: `${shift.full_name} clocked out. Total time: ${totalHours} hrs | Wage: ₹${shiftWage}`,
        data: {
          shiftId: shift.id,
          userId: targetUserId,
          staffName: shift.full_name,
          totalHours,
          hourlyRate,
          shiftWage,
          status: 'COMPLETED',
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// 4. Payroll & Hours Summary (Weekly / Monthly)
shiftsRouter.get(
  '/payroll-summary',
  authenticateToken,
  requireRole('ADMIN', 'MANAGER'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { month } = req.query; // YYYY-MM
      const currentMonth = month || new Date().toISOString().slice(0, 7);

      const result = await db.query(
        `SELECT 
          u.id as user_id,
          u.full_name,
          u.username,
          u.role,
          u.hourly_rate,
          u.monthly_salary,
          COUNT(s.id) as total_shifts,
          COALESCE(SUM(s.total_hours), 0) as total_hours_worked,
          COALESCE(SUM(s.shift_wage), 0) as total_accumulated_wage
        FROM users u
        LEFT JOIN staff_shifts s ON u.id = s.user_id AND TO_CHAR(s.shift_date, 'YYYY-MM') = $1 AND s.status = 'COMPLETED'
        GROUP BY u.id, u.full_name, u.username, u.role, u.hourly_rate, u.monthly_salary
        ORDER BY total_accumulated_wage DESC, u.full_name ASC`,
        [currentMonth]
      );

      let grandTotalWages = 0;
      let grandTotalHours = 0;

      for (const row of result.rows) {
        grandTotalWages += Number(row.total_accumulated_wage);
        grandTotalHours += Number(row.total_hours_worked);
      }

      res.json({
        success: true,
        month: currentMonth,
        summary: {
          totalStaff: result.rows.length,
          grandTotalHours: Math.round(grandTotalHours * 100) / 100,
          grandTotalWages: Math.round(grandTotalWages * 100) / 100,
        },
        data: result.rows,
      });
    } catch (error) {
      next(error);
    }
  }
);

// 5. Manager Manual Adjustment
shiftsRouter.post(
  '/adjust',
  authenticateToken,
  requireRole('ADMIN', 'MANAGER'),
  validateRequest({ body: adjustShiftSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shiftId, totalHours, hourlyRate, notes } = req.body;

      const shiftRes = await db.query('SELECT * FROM staff_shifts WHERE id = $1', [shiftId]);
      if (shiftRes.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Shift record not found' });
      }

      const shift = shiftRes.rows[0];
      const newWage = Math.round((totalHours * hourlyRate) * 100) / 100;

      await db.query(
        `UPDATE staff_shifts 
         SET total_hours = $1,
             hourly_rate = $2,
             shift_wage = $3,
             notes = notes || ' [Adjusted: ' || $4 || ']',
             status = 'COMPLETED'
         WHERE id = $5`,
        [totalHours, hourlyRate, newWage, notes, shiftId]
      );

      await logAudit({
        userId: req.user!.id,
        action: 'SHIFT_HOURS_ADJUSTED',
        entityType: 'USER',
        entityId: shift.user_id,
        details: { shiftId, previousHours: shift.total_hours, newHours: totalHours, newWage, notes },
      });

      res.json({
        success: true,
        message: `Shift adjusted: ${totalHours} hrs @ ₹${hourlyRate}/hr = ₹${newWage}`,
        data: { shiftId, totalHours, hourlyRate, shiftWage: newWage },
      });
    } catch (error) {
      next(error);
    }
  }
);
