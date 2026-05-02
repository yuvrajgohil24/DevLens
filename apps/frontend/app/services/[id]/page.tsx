'use client';

import { useEffect, useState } from 'react';
import { api, RiskScore } from '@/lib/api';
import { RiskScoreBadge } from '@/components/ui/RiskScoreBadge';
import { ArrowLeft, TrendingUp, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { format } from 'date-fns';
import { use } from 'react';

export default function ServiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [service, setService]     = useState<{ name: string; language: string; riskScores: RiskScore[] } | null>(null);
  const [history, setHistory]     = useState<RiskScore[]>([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    Promise.all([
      api.services.get(id),
      api.services.riskHistory(id),
    ]).then(([svc, hist]) => {
      setService(svc as unknown as { name: string; language: string; riskScores: RiskScore[] });
      setHistory(hist.data);
    }).finally(() => setLoading(false));
  }, [id]);

  const chartData = history.map(h => ({
    date: format(new Date(h.calculatedAt), 'MMM d'),
    score: Number(h.score),
    critical: h.criticalCount,
    high: h.highCount,
  }));

  const latest = history[history.length - 1];

  if (loading) return <div style={{ color:'var(--text-muted)', padding:40 }}>Loading…</div>;
  if (!service) return <div style={{ color:'var(--critical)', padding:40 }}>Service not found.</div>;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:24 }}>
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <Link href="/services" style={{ color:'var(--text-muted)', display:'flex', alignItems:'center', gap:4, textDecoration:'none', fontSize:'0.85rem' }}>
          <ArrowLeft size={14}/> Services
        </Link>
      </div>

      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
        <div>
          <h2 style={{ fontSize:'1.5rem', fontWeight:700 }}>{service.name}</h2>
          <p style={{ color:'var(--text-muted)', fontSize:'0.82rem', marginTop:2 }}>{service.language}</p>
        </div>
        {latest && <RiskScoreBadge score={Number(latest.score)} size="lg" />}
      </div>

      {/* Risk trend chart */}
      <div className="glass-card" style={{ padding:20 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
          <TrendingUp size={15} color="var(--primary)" />
          <span style={{ fontWeight:600, fontSize:'0.875rem' }}>Risk Score Trend</span>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="date" tick={{ fontSize:11, fill:'var(--text-muted)' }} axisLine={false} tickLine={false} />
            <YAxis domain={[0,10]} tick={{ fontSize:11, fill:'var(--text-muted)' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, fontSize:'0.8rem' }} />
            <Line type="monotone" dataKey="score" stroke="var(--primary)" strokeWidth={2} dot={{ fill:'var(--primary)', r:3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Severity breakdown */}
      {latest && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
          {[
            { label:'Critical', val:latest.criticalCount, color:'var(--critical)', bg:'var(--critical-bg)' },
            { label:'High',     val:latest.highCount,     color:'var(--high)',     bg:'var(--high-bg)' },
            { label:'Medium',   val:latest.mediumCount,   color:'var(--medium)',   bg:'var(--medium-bg)' },
            { label:'Low',      val:latest.lowCount,      color:'var(--low)',      bg:'var(--low-bg)' },
          ].map(({ label, val, color, bg }) => (
            <div key={label} className="glass-card" style={{ padding:'16px 20px', textAlign:'center' }}>
              <div style={{ fontSize:'2rem', fontWeight:700, color, fontFamily:'monospace' }}>{val}</div>
              <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginTop:4 }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display:'flex', gap:12 }}>
        <Link href={`/vulnerabilities?service=${id}`} style={{
          display:'flex', alignItems:'center', gap:6,
          background:'var(--critical-bg)', color:'var(--critical)',
          border:'1px solid rgba(248,113,113,0.25)', borderRadius:8,
          padding:'10px 18px', textDecoration:'none', fontSize:'0.85rem', fontWeight:600,
        }}>
          <ShieldAlert size={14}/> View CVEs for this service
        </Link>
      </div>
    </div>
  );
}
