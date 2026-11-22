import { Router } from 'express';
import { authRouter } from './auth.js';
import { tablesRouter } from './tables.js';
import { menuRouter } from './menu.js';
import { usersRouter } from './users.js';
import { healthRouter } from './health.js';
import { ordersRouter } from './orders.js';
import { billingRouter } from './billing.js';
import { inventoryRouter } from './inventory.js';
import { expensesRouter } from './expenses.js';
import { shiftsRouter } from './shifts.js';
import { analyticsRouter } from './analytics.js';

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/tables', tablesRouter);
apiRouter.use('/menu', menuRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/orders', ordersRouter);
apiRouter.use('/billing', billingRouter);
apiRouter.use('/inventory', inventoryRouter);
apiRouter.use('/expenses', expensesRouter);
apiRouter.use('/shifts', shiftsRouter);
apiRouter.use('/analytics', analyticsRouter);
