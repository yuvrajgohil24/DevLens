import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import IORedis from 'ioredis';
import { createRedisConnection } from '../db/redis';

let _io: SocketIOServer | null = null;

/**
 * Events from a separate worker process (which has no Socket.io server) travel
 * over this Redis pub/sub channel; the API process re-broadcasts them.
 */
const EVENTS_CHANNEL = 'devlens:ws-events';
let publisher: IORedis | null = null;

export function initializeWebSocket(httpServer: HTTPServer): SocketIOServer {
  _io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  _io.on('connection', (socket) => {
    console.log(`🔌 WS client connected: ${socket.id}`);

    socket.on('subscribe:service', (serviceId: string) => {
      socket.join(`service:${serviceId}`);
    });

    socket.on('disconnect', (reason) => {
      console.log(`🔌 WS client disconnected: ${socket.id} (${reason})`);
    });
  });

  // Relay events published by standalone worker processes
  const subscriber = createRedisConnection();
  subscriber.subscribe(EVENTS_CHANNEL).catch((err) => console.error('❌ WS relay subscribe failed:', err.message));
  subscriber.on('message', (_channel, raw) => {
    try {
      const { event, data } = JSON.parse(raw);
      _io?.emit(event, data);
    } catch (err) {
      console.error('⚠️ Ignoring malformed WS relay message:', (err as Error).message);
    }
  });

  console.log('✅ WebSocket server initialized');
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
    console.error(`⚠️ Failed to relay WS event ${event}:`, err.message);
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
