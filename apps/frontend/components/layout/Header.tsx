'use client';

import { useWebSocket } from '@/components/providers/WebSocketProvider';
import { usePathname } from 'next/navigation';
import { Wifi, WifiOff } from 'lucide-react';

const TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/deployments': 'Deployments',
  '/vulnerabilities': 'Vulnerabilities',
  '/services': 'Services',
  '/devflow': 'DevFlow',
  '/policy-violations': 'Policy Violations',
};

export function Header() {
  const { isConnected, lastDeployment, lastScan } = useWebSocket();
  const pathname = usePathname();

  const title = Object.entries(TITLES).find(([k]) => pathname === k || pathname.startsWith(k + '/'))?.[1] ?? 'DevLens';

  return (
    <header style={{
      height: 60,
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 32px',
      background: 'rgba(7,7,17,0.8)',
      backdropFilter: 'blur(12px)',
      position: 'sticky',
      top: 0,
      zIndex: 40,
    }}>
      <h1 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
        {title}
      </h1>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {/* Last event ticker */}
        {lastScan && (
          <div style={{
            fontSize: '0.75rem', color: 'var(--text-muted)',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} className="pulse-dot" />
            Scan complete · Risk {lastScan.riskScore}
          </div>
        )}
        {lastDeployment && !lastScan && (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)', display: 'inline-block' }} className="pulse-dot" />
            {lastDeployment.serviceName} deploying…
          </div>
        )}

        {/* WS indicator */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5,
          fontSize: '0.72rem',
          color: isConnected ? 'var(--success)' : 'var(--text-muted)',
          background: isConnected ? 'var(--success-bg)' : 'rgba(255,255,255,0.05)',
          padding: '4px 10px', borderRadius: 999,
          border: `1px solid ${isConnected ? 'rgba(52,211,153,0.25)' : 'var(--border)'}`,
        }}>
          {isConnected
            ? <><Wifi size={12} /> Live</>
            : <><WifiOff size={12} /> Offline</>}
        </div>
      </div>
    </header>
  );
}
