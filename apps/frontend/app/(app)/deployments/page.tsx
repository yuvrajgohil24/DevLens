'use client';

import { useEffect, useState, useCallback } from 'react';
import { api, Deployment } from '@/lib/api';
import { useWebSocket } from '@/components/providers/WebSocketProvider';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { RiskScoreBadge } from '@/components/ui/RiskScoreBadge';
import { GitCommit, Filter } from 'lucide-react';
import Link from 'next/link';
import { formatDistanceToNow, format } from 'date-fns';

const ENVS    = ['all','staging','production'];
const STATUSES = ['all','success','failed','running','pending'];

export default function DeploymentsPage() {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [env, setEnv]= useState('all');
  const [status, setStatus] = useState('all');
  const { lastDeployment, lastScan } = useWebSocket();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.deployments.list({
        env: env !== 'all' ? env : undefined,
        status: status !== 'all' ? status : undefined,
        limit: 50,
      });
      setDeployments(data);
    } finally { setLoading(false); }
  }, [env, status]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (lastDeployment || lastScan) load(); }, [lastDeployment, lastScan, load]);

  const filterBtn = (opts: string[], val: string, set: (v:string)=>void) => (
    <div style={{ display:'flex', gap: 4 }}>
      {opts.map(o => (
        <button key={o} onClick={() => set(o)} style={{
          padding: '5px 12px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 500,
          border: `1px solid ${val===o ? 'var(--primary)' : 'var(--border)'}`,
          background: val===o ? 'rgba(129,140,248,0.12)' : 'transparent',
          color: val===o ? 'var(--primary)' : 'var(--text-secondary)',
          cursor: 'pointer', textTransform: 'capitalize', transition: 'all 0.15s',
        }}>{o}</button>
      ))}
    </div>
  );

  return (
    <div style={{ display:'flex', flexDirection:'column', gap: 20 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <h2 style={{ fontSize:'1.4rem', fontWeight:700, letterSpacing:'-0.02em' }}>Deployment Timeline</h2>
          <p style={{ color:'var(--text-muted)', fontSize:'0.82rem', marginTop:2 }}>{deployments.length} deployments</p>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card" style={{ padding:'14px 18px', display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
        <div style={{ display:'flex',alignItems:'center',gap:6, color:'var(--text-muted)', fontSize:'0.8rem' }}>
          <Filter size={13}/> Filters
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:'0.72rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>Env</span>
          {filterBtn(ENVS, env, setEnv)}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:'0.72rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>Status</span>
          {filterBtn(STATUSES, status, setStatus)}
        </div>
      </div>

      {/* Table */}
      <div className="glass-card" style={{ overflow:'hidden', padding:0 }}>
        {loading ? (
          <div style={{ padding:40, textAlign:'center', color:'var(--text-muted)' }}>Loading…</div>
        ) : deployments.length === 0 ? (
          <div style={{ padding:40, textAlign:'center', color:'var(--text-muted)', fontSize:'0.875rem' }}>
            No deployments found. <Link href="/devflow" style={{ color:'var(--primary)' }}>Trigger one from DevFlow →</Link>
          </div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse' }} className="devlens-table">
            <thead>
              <tr>
                <th style={{textAlign:'left'}}>Service</th>
                <th style={{textAlign:'left'}}>Commit</th>
                <th style={{textAlign:'left'}}>Branch</th>
                <th style={{textAlign:'left'}}>Environment</th>
                <th style={{textAlign:'left'}}>Status</th>
                <th style={{textAlign:'left'}}>Risk</th>
                <th style={{textAlign:'left'}}>CVEs</th>
                <th style={{textAlign:'left'}}>Triggered</th>
              </tr>
            </thead>
            <tbody>
              {deployments.map(dep => {
                const risk   = dep.riskScores?.[0]?.score;
                const cveCount = dep._count?.vulnerabilities ?? 0;
                return (
                  <tr key={dep.id} style={{ cursor:'pointer' }}
                    onClick={() => window.location.href = `/deployments/${dep.id}`}>
                    <td>
                      <div style={{ fontWeight:600, fontSize:'0.85rem', color: 'var(--text-primary)' }}>{dep.commitMessage ?? dep.service?.name}</div>
                      <div style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>{dep.service?.name} • {dep.service?.language}</div>
                    </td>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                        <GitCommit size={12} color="var(--text-muted)" />
                        <span className="font-mono" style={{ fontSize:'0.8rem', color:'var(--accent)' }}>{dep.commitSha.slice(0,7)}</span>
                      </div>
                    </td>
                    <td><span style={{ fontSize:'0.8rem', color:'var(--text-secondary)' }}>{dep.branch}</span></td>
                    <td>
                      <span style={{
                        fontSize:'0.72rem', fontWeight:600, padding:'2px 8px', borderRadius:4,
                        background: dep.environment === 'production' ? 'rgba(129,140,248,0.12)' : 'rgba(34,211,238,0.08)',
                        color: dep.environment === 'production' ? 'var(--primary)' : 'var(--accent)',
                      }}>{dep.environment}</span>
                    </td>
                    <td><StatusBadge status={dep.status} /></td>
                    <td>{risk !== undefined ? <RiskScoreBadge score={Number(risk)} size="sm" /> : <span style={{ color:'var(--text-muted)' }}>—</span>}</td>
                    <td><span style={{ fontSize:'0.8rem', color: cveCount > 0 ? 'var(--critical)' : 'var(--text-muted)' }}>{cveCount}</span></td>
                    <td>
                      <div style={{ fontSize:'0.78rem', color:'var(--text-muted)' }}>
                        {formatDistanceToNow(new Date(dep.triggeredAt), {addSuffix:true})}
                      </div>
                      <div style={{ fontSize:'0.68rem', color:'var(--text-muted)', opacity:0.7 }}>
                        {format(new Date(dep.triggeredAt),'MMM d, HH:mm')}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
