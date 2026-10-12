import IORedis, { RedisOptions } from 'ioredis';
import { Queue } from 'bullmq';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const isTls = REDIS_URL.startsWith('rediss://');

const baseOptions: RedisOptions = {
  maxRetriesPerRequest: null, // required for BullMQ
  connectTimeout: 5000, // 5s timeout to prevent hanging the Express server boot
  // rediss:// URLs get TLS with certificate verification. Only disable verification
  // for a provider with a self-signed cert, explicitly: REDIS_TLS_INSECURE=true
  ...(isTls ? { tls: { rejectUnauthorized: process.env.REDIS_TLS_INSECURE !== 'true' } } : {}),
};

/** All Redis connections (queue, worker, pub/sub) share the same URL and TLS settings. */
export function createRedisConnection(options: RedisOptions = {}): IORedis {
  return new IORedis(REDIS_URL, { ...baseOptions, ...options });
}

export const redisConnection = createRedisConnection({ lazyConnect: true });

export const scanQueue = new Queue('scan-queue', {
  connection: createRedisConnection(),
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
