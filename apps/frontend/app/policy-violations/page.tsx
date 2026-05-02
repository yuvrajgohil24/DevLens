'use client';

import { useEffect, useState } from 'react';
import { api, PolicyViolation } from '@/lib/api';
import { useWebSocket } from '@/components/providers/WebSocketProvider';
import { AlertTriangle, CheckCircle2, ShieldX, KeyRound, Package } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const TYPE_ICONS: Record<string, React.ElementType> = {
  secret_detected: KeyRound,
  unsigned_image: ShieldX,
  unscanned_dep: Package,
};

const TYPE_COLORS: Record<string, string> = {
  secret_detected: 'var(--critical)',
  unsigned_image:  'var(--high)',
  unscanned_dep:   'var(--medium)',
};

export default function PolicyViolationsPage() {
  const [violations, setViolations] = useState<PolicyViolation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showResolved, setShowResolved] = useState(false);
  const { lastScan } = useWebSocket();

  const load = async () => {
    setLoading(true);
    const { data } = await api.policyViolations.list({ resolved: showResolved ? undefined : 'false' });
    setViolations(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, [showResolved]);
  useEffect(() => { if (lastScan) load(); }, [lastScan]);

  const handleResolve = async (id: string) => {
    await api.policyViolations.resolve(id);
    load();
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <h2 style={{ fontSize:'1.4rem', fontWeight:700, letterSpacing:'-0.02em' }}>Policy Violations</h2>
          <p style={{ color:'var(--text-muted)', fontSize:'0.82rem', marginTop:2 }}>{violations.length} violations</p>
        </div>
        <button onClick={()=>setShowResolved(p=>!p)} style={{
          padding:'7px 14px', borderRadius:7, fontSize:'0.8rem',
          border:`1px solid ${showResolved?'var(--primary)':'var(--border)'}`,
          background: showResolved?'rgba(129,140,248,0.1)':'transparent',
          color: showResolved?'var(--primary)':'var(--text-secondary)',
          cursor:'pointer', transition:'all 0.15s',
        }}>
          {showResolved?'Showing All':'Show Resolved'}
        </button>
      </div>

      {loading ? (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {Array.from({length:3}).map((_,i)=><div key={i} className="glass-card skeleton" style={{height:80}} />)}
        </div>
      ) : violations.length === 0 ? (
        <div className="glass-card" style={{ padding:48, textAlign:'center' }}>
          <CheckCircle2 size={40} color="var(--success)" style={{ margin:'0 auto 12px' }} />
          <div style={{ fontWeight:600 }}>No active policy violations</div>
          <div style={{ color:'var(--text-muted)', fontSize:'0.85rem', marginTop:4 }}>All policies are passing.</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {violations.map(v => {
            const Icon = TYPE_ICONS[v.violationType||''] ?? AlertTriangle;
            const color = TYPE_COLORS[v.violationType||''] ?? 'var(--text-muted)';
            return (
              <div key={v.id} className="glass-card" style={{ padding:'16px 20px', display:'flex', alignItems:'flex-start', gap:14, opacity: v.isResolved ? 0.55 : 1 }}>
                <div style={{ width:38, height:38, borderRadius:8, background:`${color}15`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <Icon size={18} color={color} />
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                    <span style={{ fontWeight:700, fontSize:'0.875rem', color }}>{v.violationType?.replace(/_/g,' ').toUpperCase()}</span>
                    <span style={{
                      fontSize:'0.68rem', fontWeight:700, padding:'2px 7px', borderRadius:4,
                      background:`${color}15`, color, textTransform:'uppercase',
                    }}>{v.severity}</span>
                    {v.isResolved && <span style={{ fontSize:'0.72rem', color:'var(--success)' }}>✓ Resolved</span>}
                  </div>
                  <div style={{ fontSize:'0.85rem', color:'var(--text-primary)', marginBottom:6 }}>{v.detail}</div>
                  <div style={{ display:'flex', gap:16, fontSize:'0.75rem', color:'var(--text-muted)' }}>
                    <span>{v.service?.name}</span>
                    <span className="font-mono">{v.deployment?.commitSha?.slice(0,7)}</span>
                    <span>{formatDistanceToNow(new Date(v.detectedAt),{addSuffix:true})}</span>
                  </div>
                </div>
                {!v.isResolved && (
                  <button onClick={()=>handleResolve(v.id)} style={{
                    display:'flex', alignItems:'center', gap:4,
                    background:'var(--success-bg)', color:'var(--success)',
                    border:'1px solid rgba(52,211,153,0.25)', borderRadius:6,
                    padding:'6px 12px', cursor:'pointer', fontSize:'0.78rem', fontWeight:600, flexShrink:0,
                  }}>
                    <CheckCircle2 size={12}/> Resolve
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
