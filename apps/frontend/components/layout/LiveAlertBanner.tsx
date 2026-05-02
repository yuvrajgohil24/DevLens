'use client';

import { useWebSocket } from '@/components/providers/WebSocketProvider';
import { AlertTriangle, X, ExternalLink } from 'lucide-react';

export function LiveAlertBanner() {
  const { criticalAlert, dismissAlert } = useWebSocket();

  if (!criticalAlert) return null;

  return (
    <div className="slide-down" style={{
      position: 'fixed', top: 0, left: 0, right: 0,
      zIndex: 100,
      background: 'linear-gradient(90deg, rgba(239,68,68,0.95) 0%, rgba(220,38,38,0.95) 100%)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid rgba(248,113,113,0.4)',
      padding: '12px 24px',
      display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: '0 4px 24px rgba(239,68,68,0.4)',
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        background: 'rgba(255,255,255,0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <AlertTriangle size={15} color="#fff" />
      </div>

      <div style={{ flex: 1 }}>
        <span style={{ fontWeight: 700, color: '#fff', fontSize: '0.875rem', marginRight: 8 }}>
          CRITICAL CVE DETECTED
        </span>
        <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.875rem' }}>
          [{criticalAlert.cveId}] {criticalAlert.title}
        </span>
        <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem', marginLeft: 8 }}>
          · {criticalAlert.serviceName}
        </span>
      </div>

      <a href={`/vulnerabilities`} style={{
        display: 'flex', alignItems: 'center', gap: 4,
        color: 'rgba(255,255,255,0.85)', fontSize: '0.8rem',
        textDecoration: 'none', whiteSpace: 'nowrap',
      }}>
        View CVEs <ExternalLink size={12} />
      </a>

      <button onClick={dismissAlert} style={{
        background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer',
        borderRadius: '50%', width: 26, height: 26,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', flexShrink: 0,
        transition: 'background 0.15s',
      }}>
        <X size={14} />
      </button>
    </div>
  );
}
