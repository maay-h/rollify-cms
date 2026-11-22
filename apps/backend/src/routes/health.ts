import { Router, Request, Response } from 'express';
import { db } from '../db/index.js';

export const healthRouter = Router();

healthRouter.get('/', async (req: Request, res: Response) => {
  try {
    const dbStart = Date.now();
    const testQuery = await db.query('SELECT NOW() as current_time, 1 as active_flag');
    const latencyMs = Date.now() - dbStart;

    res.json({
      success: true,
      service: 'Rollify POS Core Backend API',
      version: '1.0.0',
      status: 'HEALTHY',
      timestamp: new Date().toISOString(),
      database: {
        engine: db.getEngineType(),
        status: 'CONNECTED',
        latencyMs,
        dbTimestamp: testQuery.rows[0]?.current_time,
      },
      uptimeSeconds: Math.floor(process.uptime()),
    });
  } catch (error: any) {
    res.status(503).json({
      success: false,
      status: 'UNHEALTHY',
      error: error.message,
    });
  }
});
