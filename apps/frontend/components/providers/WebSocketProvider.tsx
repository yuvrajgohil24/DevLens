'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4000';

// ── Event types ────────────────────────────────────────────
export interface DeploymentCreatedEvent {
  deploymentId: string;
  serviceName: string;
  status: string;
}
export interface ScanCompletedEvent {
  deploymentId: string;
  serviceId: string;
  criticalCount: number;
  riskScore: number;
}
export interface CriticalCveEvent {
  deploymentId: string;
  serviceName: string;
  cveId: string;
  title: string;
}

interface WebSocketContextValue {
  socket: Socket | null;
  isConnected: boolean;
  lastDeployment: DeploymentCreatedEvent | null;
  lastScan: ScanCompletedEvent | null;
  criticalAlert: CriticalCveEvent | null;
  dismissAlert: () => void;
}

const WebSocketContext = createContext<WebSocketContextValue>({
  socket: null,
  isConnected: false,
  lastDeployment: null,
  lastScan: null,
  criticalAlert: null,
  dismissAlert: () => {},
});

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastDeployment, setLastDeployment] = useState<DeploymentCreatedEvent | null>(null);
  const [lastScan, setLastScan] = useState<ScanCompletedEvent | null>(null);
  const [criticalAlert, setCriticalAlert] = useState<CriticalCveEvent | null>(null);

  useEffect(() => {
    const socket = io(WS_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      console.log('🔌 WebSocket connected:', socket.id);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('deployment_created', (data: DeploymentCreatedEvent) => {
      setLastDeployment(data);
    });

    socket.on('deployment_updated', (data: DeploymentCreatedEvent) => {
      setLastDeployment(data);
    });

    socket.on('scan_completed', (data: ScanCompletedEvent) => {
      setLastScan(data);
    });

    socket.on('critical_cve_detected', (data: CriticalCveEvent) => {
      setCriticalAlert(data);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <WebSocketContext.Provider
      value={{
        socket: socketRef.current,
        isConnected,
        lastDeployment,
        lastScan,
        criticalAlert,
        dismissAlert: () => setCriticalAlert(null),
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
}

export const useWebSocket = () => useContext(WebSocketContext);
