import http from 'http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { initSocketIO } from './socket/index.js';
import { runMigrations } from './db/migrate.js';
import { db } from './db/index.js';

async function bootstrap() {
  console.log('----------------------------------------------------');
  console.log('🚀 ROLLIFY POS - Production Real-Time Backend API');
  console.log('----------------------------------------------------');

  // Verify and auto-migrate DB schema if needed
  try {
    await runMigrations();
  } catch (err) {
    console.error('[Bootstrap] Failed to verify database schema:', err);
    process.exit(1);
  }

  const app = createApp();
  const server = http.createServer(app);

  // Initialize Socket.io
  initSocketIO(server);

  server.listen(env.PORT, () => {
    console.log(`[Server] Rollify POS API is listening on port ${env.PORT}`);
    console.log(`[Server] Environment: ${env.NODE_ENV}`);
    console.log(`[Server] Database Engine: ${db.getEngineType()}`);
    console.log(`[Server] Health Endpoint: http://localhost:${env.PORT}/api/health`);
    console.log('----------------------------------------------------');
  });

  // Graceful shutdown handling
  const shutdown = async () => {
    console.log('\n[Server] Shutting down gracefully...');
    server.close(async () => {
      await db.close();
      console.log('[Server] Connections closed. Goodbye!');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch((err) => {
  console.error('[Bootstrap] Unhandled startup error:', err);
  process.exit(1);
});
