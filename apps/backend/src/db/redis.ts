import IORedis from 'ioredis';
import { Queue } from 'bullmq';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const isTls = REDIS_URL.startsWith('rediss://');

const baseOptions = {
  maxRetriesPerRequest: null, // required for BullMQ
  connectTimeout: 5000, // 5s timeout to prevent hanging the Express server boot
  ...(isTls ? { tls: { rejectUnauthorized: false } } : {}), // Auto-TLS for Upstash
};

export const redisConnection = new IORedis(REDIS_URL, {
  ...baseOptions,
  lazyConnect: true,
});

export const scanQueue = new Queue('scan-queue', {
  connection: new IORedis(REDIS_URL, baseOptions),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

redisConnection.on('connect', () => console.log('✅ Redis connected'));
redisConnection.on('error', (err) => console.error('❌ Redis error:', err.message));

export default redisConnection;
