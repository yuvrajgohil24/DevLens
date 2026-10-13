/**
 * Standalone scan worker entrypoint — runs the BullMQ scan processor without
 * the HTTP/WebSocket server. Deploy it as its own service (`npm run start:worker`)
 * and set RUN_SCAN_WORKER=false on the API service.
 */
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });
import prisma from './db/prisma';
import scanWorker from './jobs/scanWorker';
import { logger } from './utils/logger';

async function bootstrap() {
  await prisma.$connect();
  logger.info('PostgreSQL connected (worker)');

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Finishing active scans and shutting down');
    await scanWorker.close(); // waits for in-flight jobs
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  logger.fatal({ err }, 'Worker bootstrap failed');
  process.exit(1);
});
