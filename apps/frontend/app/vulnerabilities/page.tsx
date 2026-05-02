'use client';

import { useEffect, useState, useCallback } from 'react';
import { api, Vulnerability } from '@/lib/api';
import { useWebSocket } from '@/components/providers/WebSocketProvider';
import { SeverityBadge } from '@/components/ui/StatusBadge';
import { ShieldAlert, CheckCircle2, Filter } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const SEVERITIES = ['all','critical','high','medium','low'];
const RESOLVED   = ['all','open','resolved'];

export default function VulnerabilitiesPage() {
  const [vulns, setVulns]       = useState<Vulnerability[]>([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(true);
  const [severity, setSeverity] = useState('all');
  const [resolved, setResolved] = useState('open');
  const { lastScan } = useWebSocket();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, total: t } = await api.vulnerabilities.list({
        severity: severity !== 'all' ? severity : undefined,
        resolved: resolved === 'all' ? undefined : resolved === 'resolved' ? 'true' : 'false',
        limit: 100,
      });
      setVulns(data); setTotal(t);
    } finally { setLoading(false); }
  }, [severity, resolved]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (lastScan) load(); }, [lastScan, load]);

  const handleResolve = async (id: string) => {
    await api.vulnerabilities.resolve(id);
    load();
  };

  const filterBtn = (opts: string[], val: string, set: (v:string)=>void, labels?: Record<string,string>) => (
    <div style={{ display:'flex', gap:4 }}>
      {opts.map(o=>(
        <button key={o} onClick={()=>set(o)} style={{
          padding:'5px 12px', borderRadius:6, fontSize:'0.75rem', fontWeight:500,
          border:`1px solid ${val===o?'var(--primary)':'var(--border)'}`,
          background:val===o?'rgba(129,140,248,0.12)':'transparent',
          color:val===o?'var(--primary)':'var(--text-secondary)',
          cursor:'pointer', textTransform:'capitalize', transition:'all 0.15s',
        }}>{labels?.[o]??o}</button>
      ))}
    </div>
  );

  const counts = SEVERITIES.slice(1).map(s=>({ s, n: vulns.filter(v=>v.severity===s).length }));

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      <div>
        <h2 style={{ fontSize:'1.4rem', fontWeight:700, letterSpacing:'-0.02em' }}>Vulnerabilities</h2>
        <p style={{ color:'var(--text-muted)', fontSize:'0.82rem', marginTop:2 }}>{total} total CVEs across all services</p>
      </div>

      {/* Sev summary chips */}
      <div style={{ display:'flex', gap:10 }}>
        {counts.map(({s,n})=>(
          <div key={s} className="glass-card" style={{ padding:'10px 16px', flex:1, textAlign:'center', cursor:'pointer' }}
            onClick={()=>setSeverity(severity===s?'all':s)}>
            <div style={{ fontSize:'1.3rem', fontWeight:700, color:
              s==='critical'?'var(--critical)':s==='high'?'var(--high)':s==='medium'?'var(--medium)':'var(--low)'
            }} className="font-mono">{n}</div>
            <div style={{ fontSize:'0.7rem', color:'var(--text-muted)', textTransform:'uppercase', fontWeight:600, letterSpacing:'0.05em' }}>{s}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="glass-card" style={{ padding:'14px 18px', display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
        <div style={{ display:'flex',alignItems:'center',gap:6,color:'var(--text-muted)',fontSize:'0.8rem' }}><Filter size={13}/> Filters</div>
        <div style={{ display:'flex',alignItems:'center',gap:8 }}>
          <span style={{ fontSize:'0.72rem',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.06em' }}>Severity</span>
          {filterBtn(SEVERITIES, severity, setSeverity)}
        </div>
        <div style={{ display:'flex',alignItems:'center',gap:8 }}>
          <span style={{ fontSize:'0.72rem',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.06em' }}>Status</span>
          {filterBtn(RESOLVED, resolved, setResolved, {all:'All',open:'Open',resolved:'Resolved'})}
        </div>
      </div>

      {/* Table */}
      <div className="glass-card" style={{ overflow:'hidden', padding:0 }}>
        {loading ? (
          <div style={{ padding:40, textAlign:'center', color:'var(--text-muted)' }}>Loading…</div>
        ) : vulns.length === 0 ? (
          <div style={{ padding:40, textAlign:'center', color:'var(--text-muted)', fontSize:'0.875rem' }}>
            No vulnerabilities found.
          </div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse' }} className="devlens-table">
            <thead>
              <tr>
                <th style={{textAlign:'left',width:110}}>CVE ID</th>
                <th style={{textAlign:'left'}}>Title</th>
                <th style={{textAlign:'left',width:90}}>Severity</th>
                <th style={{textAlign:'left',width:70}}>CVSS</th>
                <th style={{textAlign:'left'}}>Package</th>
                <th style={{textAlign:'left'}}>Service</th>
                <th style={{textAlign:'left',width:90}}>Detected</th>
                <th style={{textAlign:'left',width:80}}>Action</th>
              </tr>
            </thead>
            <tbody>
              {vulns.map(v=>(
                <tr key={v.id} style={{ opacity: v.isResolved ? 0.55 : 1 }}>
                  <td>
                    <span className="font-mono" style={{ fontSize:'0.78rem', color:'var(--accent)' }}>
                      {v.cveId||'N/A'}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontSize:'0.85rem', fontWeight:500, maxWidth:320, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                      {v.title}
                    </div>
                  </td>
                  <td><SeverityBadge severity={v.severity||'low'}/></td>
                  <td>
                    <span className="font-mono" style={{ fontSize:'0.82rem', color: Number(v.cvssScore)>=7?'var(--critical)':Number(v.cvssScore)>=4?'var(--medium)':'var(--low)' }}>
                      {v.cvssScore ? Number(v.cvssScore).toFixed(1) : '—'}
                    </span>
                  </td>
                  <td><span style={{ fontSize:'0.78rem', color:'var(--text-secondary)', fontFamily:'monospace' }}>{v.affectedPackage}</span></td>
                  <td><span style={{ fontSize:'0.8rem', color:'var(--text-secondary)' }}>{v.service?.name}</span></td>
                  <td><span style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>{formatDistanceToNow(new Date(v.detectedAt),{addSuffix:true})}</span></td>
                  <td>
                    {!v.isResolved ? (
                      <button onClick={()=>handleResolve(v.id)} style={{
                        display:'flex',alignItems:'center',gap:4,
                        background:'var(--success-bg)',color:'var(--success)',
                        border:'1px solid rgba(52,211,153,0.25)',borderRadius:5,
                        padding:'4px 8px',cursor:'pointer',fontSize:'0.72rem',fontWeight:600,
                      }}>
                        <CheckCircle2 size={11}/> Resolve
                      </button>
                    ) : (
                      <span style={{ fontSize:'0.72rem', color:'var(--success)' }}>✓ Resolved</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
