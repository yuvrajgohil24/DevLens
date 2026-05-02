'use client';

import { useState } from 'react';
import { api, Branch, Commit } from '@/lib/api';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  GitBranch, GitCommit, Rocket, CheckCircle2,
  RefreshCw, ChevronDown, Loader2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const SERVICES = ['auth-api', 'payment-service', 'user-service', 'api-gateway', 'notification-service'];
const ENVS = ['staging', 'production'];

export default function DevFlowPage() {
  const [selectedRepo, setSelectedRepo]   = useState(SERVICES[0]);
  const [selectedBranch, setSelectedBranch] = useState('main');
  const [selectedEnv, setSelectedEnv]       = useState('staging');
  const [branches, setBranches]             = useState<Branch[]>([]);
  const [commits, setCommits]               = useState<Commit[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [loadingCommits, setLoadingCommits]   = useState(false);
  const [deploying, setDeploying]             = useState(false);
  const [deployResult, setDeployResult]       = useState<{ id: string; sha: string; msg: string } | null>(null);
  const [deployStatus, setDeployStatus]       = useState<string>('');

  const loadBranches = async () => {
    setLoadingBranches(true);
    const { data } = await api.devflow.branches(selectedRepo);
    setBranches(data);
    setLoadingBranches(false);
  };

  const loadCommits = async () => {
    setLoadingCommits(true);
    const { data } = await api.devflow.commits(selectedRepo, selectedBranch);
    setCommits(data);
    setLoadingCommits(false);
  };

  const handleDeploy = async () => {
    setDeploying(true);
    setDeployResult(null);
    setDeployStatus('Triggering deployment…');
    try {
      const r = await api.devflow.deploy(selectedRepo, { branch: selectedBranch, environment: selectedEnv });
      setDeployResult({ id: r.deployment_id, sha: r.commit_sha, msg: r.message });
      setDeployStatus('Deployment created! Scan enqueued…');

      // Poll status
      let tries = 0;
      const poll = setInterval(async () => {
        tries++;
        const s = await api.devflow.deploymentStatus(r.deployment_id) as { status: string };
        setDeployStatus(`Status: ${s.status} (polling…)`);
        if (s.status === 'success' || s.status === 'failed' || tries > 15) {
          clearInterval(poll);
          setDeployStatus(`Completed: ${s.status}`);
        }
      }, 2000);
    } catch (e) {
      setDeployStatus('Deploy failed.');
    } finally {
      setDeploying(false);
    }
  };

  const selectStyle = {
    background: 'var(--surface-2)', border: '1px solid var(--border)',
    color: 'var(--text-primary)', borderRadius: 7,
    padding: '8px 12px', fontSize: '0.875rem', cursor: 'pointer',
    minWidth: 160, outline: 'none',
    appearance: 'none' as const, WebkitAppearance: 'none' as const,
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:24 }}>
      <div>
        <h2 style={{ fontSize:'1.4rem', fontWeight:700, letterSpacing:'-0.02em' }}>DevFlow</h2>
        <p style={{ color:'var(--text-muted)', fontSize:'0.82rem', marginTop:2 }}>Git operations and one-click deployments</p>
      </div>

      {/* Control panel */}
      <div className="glass-card" style={{ padding:20 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
          <Rocket size={15} color="var(--primary)" />
          <span style={{ fontWeight:600, fontSize:'0.875rem' }}>Deploy</span>
        </div>

        <div style={{ display:'flex', alignItems:'flex-end', gap:12, flexWrap:'wrap' }}>
          <div>
            <div style={{ fontSize:'0.7rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:5 }}>Service</div>
            <div style={{ position:'relative' }}>
              <select value={selectedRepo} onChange={e=>setSelectedRepo(e.target.value)} style={selectStyle}>
                {SERVICES.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
              <ChevronDown size={13} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)', pointerEvents:'none' }} />
            </div>
          </div>

          <div>
            <div style={{ fontSize:'0.7rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:5 }}>Branch</div>
            <div style={{ display:'flex', gap:6 }}>
              <div style={{ position:'relative' }}>
                <select value={selectedBranch} onChange={e=>setSelectedBranch(e.target.value)} style={selectStyle}>
                  {['main','develop','feature/auth-refresh','fix/payment-race'].map(b=><option key={b} value={b}>{b}</option>)}
                </select>
                <ChevronDown size={13} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)', pointerEvents:'none' }} />
              </div>
            </div>
          </div>

          <div>
            <div style={{ fontSize:'0.7rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:5 }}>Environment</div>
            <div style={{ display:'flex', gap:6 }}>
              {ENVS.map(e=>(
                <button key={e} onClick={()=>setSelectedEnv(e)} style={{
                  padding:'8px 16px', borderRadius:7, fontSize:'0.875rem', fontWeight:500,
                  border:`1px solid ${selectedEnv===e?'var(--primary)':'var(--border)'}`,
                  background: selectedEnv===e?'rgba(129,140,248,0.15)':'transparent',
                  color: selectedEnv===e?'var(--primary)':'var(--text-secondary)',
                  cursor:'pointer', textTransform:'capitalize', transition:'all 0.15s',
                }}>{e}</button>
              ))}
            </div>
          </div>

          <button
            onClick={handleDeploy}
            disabled={deploying}
            style={{
              display:'flex', alignItems:'center', gap:8,
              background: deploying ? 'rgba(129,140,248,0.1)' : 'linear-gradient(135deg,var(--primary),var(--accent))',
              color: '#fff', border:'none', borderRadius:8,
              padding:'9px 20px', cursor: deploying ? 'not-allowed' : 'pointer',
              fontSize:'0.875rem', fontWeight:700,
              boxShadow: deploying ? 'none' : '0 0 20px var(--primary-glow)',
              transition:'all 0.2s', opacity: deploying ? 0.7 : 1,
            }}
          >
            {deploying ? <Loader2 size={15} style={{ animation:'spin 1s linear infinite' }} /> : <Rocket size={15} />}
            {deploying ? 'Deploying…' : 'Deploy'}
          </button>
        </div>

        {/* Deploy status */}
        {deployStatus && (
          <div style={{ marginTop:14, padding:'10px 14px', borderRadius:7, background:'var(--surface-2)', border:'1px solid var(--border)', fontSize:'0.82rem' }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, color: deployStatus.includes('Completed') && deployStatus.includes('success') ? 'var(--success)' : 'var(--text-secondary)' }}>
              {deploying ? <Loader2 size={12} style={{ animation:'spin 1s linear infinite' }} /> : <CheckCircle2 size={12} />}
              {deployStatus}
            </div>
            {deployResult && (
              <div style={{ marginTop:6, fontSize:'0.78rem', color:'var(--text-muted)', fontFamily:'monospace' }}>
                Deployment ID: {deployResult.id.slice(0,8)} · SHA: {deployResult.sha.slice(0,7)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Branches + Commits */}
      <div style={{ display:'grid', gridTemplateColumns:'280px 1fr', gap:16 }}>
        {/* Branches */}
        <div className="glass-card" style={{ overflow:'hidden', padding:0 }}>
          <div style={{ padding:'14px 16px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ display:'flex', alignItems:'center', gap:7 }}>
              <GitBranch size={14} color="var(--primary)" />
              <span style={{ fontWeight:600, fontSize:'0.875rem' }}>Branches</span>
            </div>
            <button onClick={loadBranches} disabled={loadingBranches} style={{
              background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:5,
              color:'var(--text-muted)', padding:'4px 8px', cursor:'pointer', display:'flex', alignItems:'center', gap:4, fontSize:'0.75rem',
            }}>
              {loadingBranches ? <Loader2 size={11} style={{animation:'spin 1s linear infinite'}}/> : <RefreshCw size={11}/>}
              Load
            </button>
          </div>
          <div>
            {branches.length === 0 ? (
              <div style={{ padding:'24px 16px', textAlign:'center', color:'var(--text-muted)', fontSize:'0.8rem' }}>
                Click Load to fetch branches
              </div>
            ) : branches.map(b => (
              <div key={b.name}
                onClick={()=>setSelectedBranch(b.name)}
                style={{
                  padding:'10px 16px', borderBottom:'1px solid var(--border)', cursor:'pointer',
                  background: selectedBranch===b.name ? 'rgba(129,140,248,0.08)' : 'transparent',
                  display:'flex', alignItems:'center', justifyContent:'space-between',
                  transition:'background 0.15s',
                }}>
                <div>
                  <div style={{ fontSize:'0.82rem', fontWeight:500, color: selectedBranch===b.name?'var(--primary)':'var(--text-primary)' }}>{b.name}</div>
                  <div className="font-mono" style={{ fontSize:'0.7rem', color:'var(--text-muted)', marginTop:2 }}>{b.sha}</div>
                </div>
                {b.isDefault && <span style={{ fontSize:'0.65rem', background:'var(--primary-glow)', color:'var(--primary)', padding:'2px 6px', borderRadius:4, fontWeight:600 }}>default</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Commits */}
        <div className="glass-card" style={{ overflow:'hidden', padding:0 }}>
          <div style={{ padding:'14px 16px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ display:'flex', alignItems:'center', gap:7 }}>
              <GitCommit size={14} color="var(--accent)" />
              <span style={{ fontWeight:600, fontSize:'0.875rem' }}>Commits · {selectedBranch}</span>
            </div>
            <button onClick={loadCommits} disabled={loadingCommits} style={{
              background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:5,
              color:'var(--text-muted)', padding:'4px 8px', cursor:'pointer', display:'flex', alignItems:'center', gap:4, fontSize:'0.75rem',
            }}>
              {loadingCommits ? <Loader2 size={11} style={{animation:'spin 1s linear infinite'}}/> : <RefreshCw size={11}/>}
              Load
            </button>
          </div>
          <div>
            {commits.length === 0 ? (
              <div style={{ padding:'24px 16px', textAlign:'center', color:'var(--text-muted)', fontSize:'0.8rem' }}>
                Click Load to fetch commits
              </div>
            ) : commits.map(c => (
              <div key={c.sha} style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'flex-start', gap:12 }}>
                <div style={{ width:32, height:32, borderRadius:7, background:'var(--surface-2)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:2 }}>
                  <GitCommit size={14} color="var(--accent)" />
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:'0.85rem', fontWeight:500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{c.message}</div>
                  <div style={{ display:'flex', gap:12, marginTop:4, fontSize:'0.75rem', color:'var(--text-muted)' }}>
                    <span className="font-mono" style={{ color:'var(--accent)' }}>{c.sha}</span>
                    <span>{c.author}</span>
                    <span>{formatDistanceToNow(new Date(c.date), {addSuffix:true})}</span>
                  </div>
                </div>
                <button
                  onClick={async ()=>{ setSelectedBranch(c.sha); await handleDeploy(); }}
                  style={{
                    flexShrink:0, display:'flex', alignItems:'center', gap:4,
                    background:'rgba(129,140,248,0.1)', color:'var(--primary)',
                    border:'1px solid rgba(129,140,248,0.25)', borderRadius:5,
                    padding:'5px 10px', cursor:'pointer', fontSize:'0.75rem', fontWeight:600,
                  }}
                >
                  <Rocket size={11}/> Deploy
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
