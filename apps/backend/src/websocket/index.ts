import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';

let _io: SocketIOServer | null = null;

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

  console.log('✅ WebSocket server initialized');
  return _io;
}

export function getIO(): SocketIOServer {
  if (!_io) throw new Error('WebSocket server not initialized. Call initializeWebSocket() first.');
  return _io;
}

// Typed emit helpers
export const wsEvents = {
  deploymentCreated: (data: { deploymentId: string; serviceName: string; status: string }) =>
    getIO().emit('deployment_created', data),

  deploymentUpdated: (data: { deploymentId: string; status: string }) =>
    getIO().emit('deployment_updated', data),

  scanCompleted: (data: { deploymentId: string; serviceId: string; criticalCount: number; riskScore: number }) =>
    getIO().emit('scan_completed', data),

  criticalCveDetected: (data: { deploymentId: string; serviceName: string; cveId: string; title: string }) =>
    getIO().emit('critical_cve_detected', data),
};
