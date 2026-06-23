'use client';

import { useEffect, useState } from 'react';
import { api, Service } from '@/lib/api';
import { RiskScoreBadge } from '@/components/ui/RiskScoreBadge';
import { Server, ShieldAlert, Rocket } from 'lucide-react';
import Link from 'next/link';

export default function ServicesPage() {
  const [services, setServices] = useState<(Service & { latestRiskScore?: number; openCVEs?: number })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.services.list().then(({ data }) => { setServices(data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:16 }}>
      {Array.from({length:5}).map((_,i)=><div key={i} className="glass-card skeleton" style={{height:160}} />)}
    </div>
  );

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      <div>
        <h2 style={{ fontSize:'1.4rem', fontWeight:700, letterSpacing:'-0.02em' }}>Services</h2>
        <p style={{ color:'var(--text-muted)', fontSize:'0.82rem', marginTop:2 }}>{services.length} services monitored</p>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:16 }}>
        {services.map(svc => {
          const risk = Number(svc.latestRiskScore ?? 0);
          const riskColor = risk>=8?'var(--critical)':risk>=6?'var(--high)':risk>=4?'var(--medium)':'var(--low)';
          return (
            <Link key={svc.id} href={`/services/${svc.id}`} style={{ textDecoration:'none' }}>
              <div className="glass-card" style={{ padding:20, cursor:'pointer', position:'relative', overflow:'hidden' }}>
                {/* Gradient bar */}
                <div style={{ position:'absolute', left:0, top:0, bottom:0, width:3, background:riskColor, borderRadius:'10px 0 0 10px' }} />
                <div style={{ marginLeft:8 }}>
                  <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:12 }}>
                    <div>
                      <div style={{ fontWeight:700, fontSize:'0.95rem' }}>{svc.name}</div>
                      <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginTop:2, textTransform:'uppercase', letterSpacing:'0.04em' }}>{svc.language}</div>
                    </div>
                    <div style={{ width:36, height:36, borderRadius:8, background:'var(--surface-2)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <Server size={16} color="var(--text-muted)" />
                    </div>
                  </div>
                  <div style={{ marginBottom:14 }}>
                    <RiskScoreBadge score={risk} size="md" />
                  </div>
                  <div style={{ display:'flex', gap:16 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:'0.78rem', color:'var(--text-muted)' }}>
                      <ShieldAlert size={12}/> {svc.openCVEs ?? 0} open CVEs
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:'0.78rem', color:'var(--text-muted)' }}>
                      <Rocket size={12}/> {svc._count?.deployments ?? 0} deploys
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
