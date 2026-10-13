import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import IORedis from 'ioredis';
import { verifyToken } from '@clerk/backend';
import { createRedisConnection } from '../db/redis';
import { logger } from '../utils/logger';

let _io: SocketIOServer | null = null;

/**
 * Events from a separate worker process (which has no Socket.io server) travel
 * over this Redis pub/sub channel; the API process re-broadcasts them.
 */
const EVENTS_CHANNEL = 'devlens:ws-events';
let publisher: IORedis | null = null;

/**
 * Socket.io handshake middleware: the client sends its Clerk session token as
 * `auth: { token }`; it is verified the same way as API requests.
 */
export async function authenticateSocket(socket: Socket, next: (err?: Error) => void) {
  const token = socket.handshake.auth?.token;
  if (typeof token !== 'string' || !token) return next(new Error('Unauthorized'));
  try {
    const claims = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
      // Reject tokens minted for other origins (azp claim)
      ...(process.env.FRONTEND_URL && { authorizedParties: [process.env.FRONTEND_URL] }),
    });
    if (!claims.sub) return next(new Error('Unauthorized'));
    socket.data.userId = claims.sub;
    next();
  } catch {
    next(new Error('Unauthorized'));
  }
}

export function initializeWebSocket(httpServer: HTTPServer): SocketIOServer {
  _io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Only signed-in users may connect (see authenticateSocket)
  _io.use(authenticateSocket);

  _io.on('connection', (socket) => {
    logger.debug({ socketId: socket.id, userId: socket.data.userId }, 'WS client connected');

    socket.on('subscribe:service', (serviceId: string) => {
      socket.join(`service:${serviceId}`);
    });

    socket.on('disconnect', (reason) => {
      logger.debug({ socketId: socket.id, reason }, 'WS client disconnected');
    });
  });

  // Relay events published by standalone worker processes
  const subscriber = createRedisConnection();
  subscriber.subscribe(EVENTS_CHANNEL).catch((err) => logger.error({ err }, 'WS relay subscribe failed'));
  subscriber.on('message', (_channel, raw) => {
    try {
      const { event, data } = JSON.parse(raw);
      _io?.emit(event, data);
    } catch (err) {
      logger.warn({ err }, 'Ignoring malformed WS relay message');
    }
  });

  logger.info('WebSocket server initialized');
  return _io;
}

export function getIO(): SocketIOServer {
  if (!_io) throw new Error('WebSocket server not initialized. Call initializeWebSocket() first.');
  return _io;
}

/** Emits directly when this process owns the Socket.io server, otherwise relays via Redis. */
function emit(event: string, data: unknown) {
  if (_io) {
    _io.emit(event, data);
    return;
  }
  publisher ??= createRedisConnection();
  publisher.publish(EVENTS_CHANNEL, JSON.stringify({ event, data })).catch((err) => {
    logger.error({ event, err }, 'Failed to relay WS event');
  });
}

// Typed emit helpers
export const wsEvents = {
  deploymentCreated: (data: { deploymentId: string; serviceName: string; status: string }) =>
    emit('deployment_created', data),

  deploymentUpdated: (data: { deploymentId: string; status: string }) =>
    emit('deployment_updated', data),

  scanCompleted: (data: { deploymentId: string; serviceId: string; criticalCount: number; riskScore: number }) =>
    emit('scan_completed', data),

  criticalCveDetected: (data: { deploymentId: string; serviceName: string; cveId: string; title: string }) =>
    emit('critical_cve_detected', data),
};
