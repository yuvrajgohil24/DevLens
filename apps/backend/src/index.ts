import dotenv from 'dotenv';
import path from 'path';
// In production (Railway), env vars are injected directly — .env file won't exist
// dotenv will silently skip if file not found
dotenv.config({ path: path.join(__dirname, '../.env') });
import http from 'http';
import app from './app';
import { initializeWebSocket } from './websocket/index';
import { redisConnection } from './db/redis';
import prisma from './db/prisma';
import { backfillSeverityRanks } from './db/backfill';

// By default the scan worker runs inside the API process (simple single-service
// deploy). Set RUN_SCAN_WORKER=false here and run `npm run start:worker` as a
// separate service so long scans can't slow down or OOM the API.
const RUN_SCAN_WORKER = process.env.RUN_SCAN_WORKER !== 'false';
const scanWorker = RUN_SCAN_WORKER ? require('./jobs/scanWorker').default : null;

const PORT = parseInt(process.env.PORT || '4000', 10);

async function bootstrap() {
  // 1. Test DB connection
  try {
    await prisma.$connect();
    console.log('✅ PostgreSQL connected');
    // Best effort: sorting falls back gracefully if this fails, so don't block boot
    await backfillSeverityRanks().catch((err) => console.warn('⚠️ Severity rank backfill skipped:', err.message));
  } catch (err) {
    console.error('❌ Failed to connect to PostgreSQL:', err);
    process.exit(1);
  }

  // 2. Connect Redis
  try {
    await redisConnection.connect();
  } catch (err) {
    console.error('❌ Failed to connect to Redis:', err);
    process.exit(1);
  }

  // 3. Create HTTP server
  const httpServer = http.createServer(app);

  // 4. Attach Socket.io
  initializeWebSocket(httpServer);

  // 5. Start listening
  httpServer.listen(PORT, async () => {
    console.log(`\n🚀 DevLens Backend running at http://localhost:${PORT}`);
    console.log(`📡 WebSocket available at ws://localhost:${PORT}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
    console.log(`🪝 Webhook listener active on /api/webhooks/pipeline\n`);
  });

  // 6. Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received — shutting down gracefully...`);
    httpServer.close(async () => {
      if (scanWorker) await scanWorker.close();
      await prisma.$disconnect();
      await redisConnection.quit();
      console.log('✅ Shutdown complete');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  console.error('Bootstrap failed:', err);
  process.exit(1);
});
