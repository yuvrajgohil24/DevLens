'use client';

import { useEffect, useState, use } from 'react';
import { api, Deployment } from '@/lib/api';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { RiskScoreBadge } from '@/components/ui/RiskScoreBadge';
import { SeverityBadge } from '@/components/ui/StatusBadge';
import { ArrowLeft, GitCommit, Rocket, Shield, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';

export default function DeploymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [dep, setDep] = useState<Deployment & { scans?: { id:string; scannerType:string; status:string; vulnerabilities:{severity:string;cveId:string;title:string;cvssScore:number;affectedPackage:string}[] }[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.deployments.get(id).then(d => { setDep(d as typeof dep); }).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div style={{ padding:40, color:'var(--text-muted)' }}>Loading…</div>;
  if (!dep) return <div style={{ padding:40, color:'var(--critical)' }}>Deployment not found.</div>;

  const risk = dep.riskScores?.[0]?.score;
  const scansList = (dep as { scans?: { id:string; scannerType:string; status:string; vulnerabilities:{severity:string;cveId:string;title:string;cvssScore:number|null;affectedPackage:string|null}[] }[] }).scans ?? [];

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:24 }}>
      <Link href="/deployments" style={{ color:'var(--text-muted)', display:'inline-flex', alignItems:'center', gap:4, textDecoration:'none', fontSize:'0.85rem' }}>
        <ArrowLeft size={14}/> Deployments
      </Link>

      {/* Header */}
      <div className="glass-card" style={{ padding:20 }}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:16 }}>
          <div>
            <div style={{ fontSize:'0.75rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>Deployment</div>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
              <GitCommit size={16} color="var(--accent)" />
              <span className="font-mono" style={{ fontSize:'1.1rem', fontWeight:700, color:'var(--accent)' }}>{dep.commitSha.slice(0,7)}</span>
              <StatusBadge status={dep.status} />
            </div>
            <div style={{ color:'var(--text-secondary)', fontSize:'0.875rem' }}>{dep.commitMessage}</div>
          </div>
          {risk !== undefined && <RiskScoreBadge score={Number(risk)} size="lg" />}
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16 }}>
          {[
            { label:'Service',     val: dep.service?.name ?? '—' },
            { label:'Branch',      val: dep.branch ?? '—' },
            { label:'Environment', val: dep.environment ?? '—' },
            { label:'Author',      val: dep.author ?? '—' },
          ].map(({ label, val }) => (
            <div key={label}>
              <div style={{ fontSize:'0.68rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:3 }}>{label}</div>
              <div style={{ fontSize:'0.875rem', fontWeight:500 }}>{val}</div>
            </div>
          ))}
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:16, marginTop:16, paddingTop:16, borderTop:'1px solid var(--border)' }}>
          <div>
            <div style={{ fontSize:'0.68rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:3 }}>Triggered</div>
            <div style={{ fontSize:'0.85rem' }}>{format(new Date(dep.triggeredAt), 'PPpp')}</div>
          </div>
          {dep.pipelineUrl && (
            <div>
              <div style={{ fontSize:'0.68rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:3 }}>Pipeline</div>
              <a href={dep.pipelineUrl} target="_blank" rel="noopener noreferrer" style={{ color:'var(--primary)', fontSize:'0.85rem', display:'flex', alignItems:'center', gap:4, textDecoration:'none' }}>
                View on GitHub <ExternalLink size={12} />
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Scans */}
      {scansList.map(scan => (
        <div key={scan.id} className="glass-card" style={{ overflow:'hidden', padding:0 }}>
          <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10 }}>
            <Shield size={14} color="var(--primary)" />
            <span style={{ fontWeight:600, fontSize:'0.875rem' }}>{scan.scannerType?.toUpperCase()} Scan</span>
            <StatusBadge status={scan.status} />
            <span style={{ fontSize:'0.78rem', color:'var(--text-muted)', marginLeft:'auto' }}>{scan.vulnerabilities?.length ?? 0} findings</span>
          </div>
          {scan.vulnerabilities?.length > 0 && (
            <table style={{ width:'100%', borderCollapse:'collapse' }} className="devlens-table">
              <thead><tr>
                <th style={{textAlign:'left'}}>CVE</th>
                <th style={{textAlign:'left'}}>Title</th>
                <th style={{textAlign:'left'}}>Severity</th>
                <th style={{textAlign:'left'}}>CVSS</th>
                <th style={{textAlign:'left'}}>Package</th>
              </tr></thead>
              <tbody>
                {scan.vulnerabilities.map((v, i) => (
                  <tr key={i}>
                    <td><span className="font-mono" style={{ fontSize:'0.78rem', color:'var(--accent)' }}>{v.cveId}</span></td>
                    <td><span style={{ fontSize:'0.84rem' }}>{v.title}</span></td>
                    <td><SeverityBadge severity={v.severity} /></td>
                    <td><span className="font-mono" style={{ fontSize:'0.82rem' }}>{Number(v.cvssScore).toFixed(1)}</span></td>
                    <td><span style={{ fontSize:'0.78rem', fontFamily:'monospace', color:'var(--text-secondary)' }}>{v.affectedPackage}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </div>
  );
}
