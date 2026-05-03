import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });
import http from 'http';
import app from './app';
import { initializeWebSocket } from './websocket/index';
import { redisConnection } from './db/redis';
import prisma from './db/prisma';

// Import worker to register BullMQ processor
import './jobs/scanWorker';

const PORT = parseInt(process.env.PORT || '4000', 10);

async function bootstrap() {
  // 1. Test DB connection
  try {
    await prisma.$connect();
    console.log('✅ PostgreSQL connected');
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
    console.log(`🔗 Health check: http://localhost:${PORT}/health\n`);
  });

  // 6. Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received — shutting down gracefully...`);
    httpServer.close(async () => {
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
