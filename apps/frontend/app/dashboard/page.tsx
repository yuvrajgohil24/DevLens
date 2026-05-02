'use client';

import { useEffect, useState, useCallback } from 'react';
import { api, DashboardOverview, Deployment } from '@/lib/api';
import { useWebSocket } from '@/components/providers/WebSocketProvider';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { RiskScoreBadge } from '@/components/ui/RiskScoreBadge';
import {
  Rocket, ShieldAlert, AlertTriangle, TrendingUp,
  Server, Activity, RefreshCw, GitCommit,
} from 'lucide-react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const SEV_COLORS = ['#f87171','#fb923c','#fbbf24','#4ade80'];

function StatCard({ title, value, sub, icon: Icon, color, glow }: {
  title: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string; glow?: boolean;
}) {
  return (
    <div className="glass-card" style={{ padding: '20px 24px', position: 'relative', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', top: -20, right: -15,
        width: 80, height: 80, borderRadius: '50%',
        background: `${color}18`, filter: 'blur(18px)',
      }} />
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</span>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          ...(glow ? { boxShadow: `0 0 12px ${color}40` } : {}),
        }}>
          <Icon size={15} color={color} />
        </div>
      </div>
      <div style={{ fontSize: '2rem', fontWeight: 700, color: glow ? color : 'var(--text-primary)', lineHeight: 1, marginBottom: 6 }} className="count-up font-mono">
        {value}
      </div>
      {sub && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{sub}</div>}
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const { lastDeployment, lastScan } = useWebSocket();

  const load = useCallback(async () => {
    try {
      const overview = await api.dashboard.overview();
      setData(overview);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  // Refresh when a new scan completes
  useEffect(() => { if (lastScan) load(); }, [lastScan, load]);
  useEffect(() => { if (lastDeployment) load(); }, [lastDeployment, load]);

  const sevData = data ? [
    { name: 'Critical', value: data.criticalCVEs },
    { name: 'High',     value: Math.max(0, data.openCVEs - data.criticalCVEs - Math.floor(data.openCVEs * 0.3) - Math.floor(data.openCVEs * 0.2)) },
    { name: 'Medium',   value: Math.floor(data.openCVEs * 0.3) },
    { name: 'Low',      value: Math.floor(data.openCVEs * 0.2) },
  ].filter(d => d.value > 0) : [];

  if (loading) return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
      {Array.from({length:4}).map((_,i) => (
        <div key={i} className="glass-card skeleton" style={{ height: 110 }} />
      ))}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em' }}>Security Overview</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 2 }}>Real-time DevSecOps posture across all services</p>
        </div>
        <button onClick={load} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'var(--card)', border: '1px solid var(--border)',
          color: 'var(--text-secondary)', borderRadius: 7,
          padding: '7px 14px', cursor: 'pointer', fontSize: '0.8rem',
          transition: 'border-color 0.15s',
        }}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
        <StatCard title="Total Deployments" value={data?.totalDeployments ?? 0} sub={`${data?.activeDeployments ?? 0} active`} icon={Rocket} color="#818cf8" />
        <StatCard title="Open CVEs" value={data?.openCVEs ?? 0} sub={`${data?.criticalCVEs ?? 0} critical`} icon={ShieldAlert} color="#f87171" glow={(data?.criticalCVEs ?? 0) > 0} />
        <StatCard title="Policy Violations" value={data?.openViolations ?? 0} sub="unresolved" icon={AlertTriangle} color="#fbbf24" glow={(data?.openViolations ?? 0) > 0} />
        <StatCard title="Avg Risk Score" value={data?.avgRiskScore ?? '—'} sub={`across ${data?.servicesCount ?? 0} services`} icon={TrendingUp} color="#22d3ee" />
      </div>

      {/* Middle row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
        {/* Recent deployments */}
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Activity size={15} color="var(--primary)" />
              <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Recent Deployments</span>
            </div>
            <Link href="/deployments" style={{ fontSize: '0.75rem', color: 'var(--primary)', textDecoration: 'none' }}>View all →</Link>
          </div>
          <div>
            {(data?.recentDeployments ?? []).map((dep: Deployment) => {
              const risk = dep.riskScores?.[0]?.score;
              return (
                <Link key={dep.id} href={`/deployments/${dep.id}`} style={{ textDecoration: 'none' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 20px', borderBottom: '1px solid var(--border)',
                    transition: 'background 0.15s', cursor: 'pointer',
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--card-hover)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                  >
                    <div style={{
                      width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                      background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <GitCommit size={15} color="var(--text-muted)" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {dep.service?.name ?? 'unknown'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        {dep.commitSha.slice(0,7)} · {dep.branch}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                      <StatusBadge status={dep.status} />
                      {risk !== undefined && <RiskScoreBadge score={Number(risk)} size="sm" />}
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {formatDistanceToNow(new Date(dep.triggeredAt), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
            {(data?.recentDeployments?.length ?? 0) === 0 && (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No deployments yet. Send a webhook to get started.
              </div>
            )}
          </div>
        </div>

        {/* Severity breakdown */}
        <div className="glass-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <ShieldAlert size={15} color="var(--critical)" />
            <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>CVE Severity</span>
          </div>
          {sevData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={sevData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                  {sevData.map((_, idx) => <Cell key={idx} fill={SEV_COLORS[idx % SEV_COLORS.length]} strokeWidth={0} />)}
                </Pie>
                <Tooltip contentStyle={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, fontSize:'0.8rem' }} />
                <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No CVE data yet
            </div>
          )}
          <div style={{ marginTop: 8 }}>
            <Link href="/vulnerabilities" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: '0.78rem', color: 'var(--primary)', textDecoration: 'none' }}>
              View all vulnerabilities →
            </Link>
          </div>
        </div>
      </div>

      {/* Services grid */}
      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Server size={15} color="var(--accent)" />
          <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Services</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 1, padding: 1 }}>
          {(data?.recentDeployments ?? [])
            .filter((d,i,a) => a.findIndex(x => x.service?.id === d.service?.id) === i)
            .map(dep => {
              const risk = dep.riskScores?.[0]?.score ?? 0;
              return (
                <Link key={dep.service?.id} href={`/services/${dep.service?.id}`} style={{ textDecoration: 'none' }}>
                  <div style={{
                    padding: '16px', background: 'var(--surface)',
                    transition: 'background 0.15s', cursor: 'pointer',
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}
                  >
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 6 }}>{dep.service?.name}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 10 }}>{dep.service?.language}</div>
                    <RiskScoreBadge score={Number(risk)} size="sm" />
                  </div>
                </Link>
              );
            })}
        </div>
      </div>
    </div>
  );
}
