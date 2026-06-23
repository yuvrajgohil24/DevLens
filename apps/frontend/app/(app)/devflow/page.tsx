'use client';

import { useState, useEffect, useCallback } from 'react';
import { api, Branch, Commit } from '@/lib/api';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  GitBranch, GitCommit, Rocket, CheckCircle2,
  RefreshCw, ChevronDown, Loader2, GitPullRequest,
  ExternalLink, AlertCircle, BookOpen, Terminal,
  Download, Upload, Server
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const ENVS = ['staging', 'production'];

interface GitHubRepo {
  id: number;
  name: string;
  fullName: string;
  description: string | null;
  language: string | null;
  defaultBranch: string;
  visibility: 'public' | 'private';
  stars: number;
  updatedAt: string;
  url: string;
}

export default function DevFlowPage() {
  const [repos, setRepos]                   = useState<GitHubRepo[]>([]);
  const [loadingRepos, setLoadingRepos]     = useState(true);
  const [repoError, setRepoError]           = useState<string | null>(null);

  const [selectedRepo, setSelectedRepo]     = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState('main');
  const [selectedEnv, setSelectedEnv]       = useState('staging');

  const [branches, setBranches]             = useState<Branch[]>([]);
  const [commits, setCommits]               = useState<Commit[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [loadingCommits, setLoadingCommits]   = useState(false);
  const [branchError, setBranchError]         = useState<string | null>(null);
  const [commitError, setCommitError]         = useState<string | null>(null);

  const [deploying, setDeploying]             = useState(false);
  const [deployResult, setDeployResult]       = useState<{ id: string; sha: string; msg: string; url?: string } | null>(null);
  const [deployStatus, setDeployStatus]       = useState<string>('');

  // Local Git State
  const [gitStatus, setGitStatus]             = useState<any>(null);
  const [loadingGit, setLoadingGit]           = useState(false);
  const [gitOutput, setGitOutput]             = useState<string | null>(null);

  // ── Load GitHub repos on mount ──────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        setLoadingRepos(true);
        setRepoError(null);
        const { data } = await api.devflow.repos();
        setRepos(data);
        if (data.length > 0) setSelectedRepo(data[0].name);
      } catch (e) {
        setRepoError(e instanceof Error ? e.message : 'Failed to load repositories');
      } finally {
        setLoadingRepos(false);
      }
    })();
  }, []);

  // ── Auto-load branches when selected repo changes ───────────
  const loadBranches = useCallback(async (repoName?: string) => {
    const repo = repoName ?? selectedRepo;
    if (!repo) return;
    setLoadingBranches(true);
    setBranchError(null);
    try {
      const { data } = await api.devflow.branches(repo);
      setBranches(data);
      // Reset branch to default
      const defaultBranch = data.find((b: Branch) => b.isDefault)?.name ?? 'main';
      setSelectedBranch(defaultBranch);
    } catch (e) {
      setBranchError(e instanceof Error ? e.message : 'Failed to load branches');
    } finally {
      setLoadingBranches(false);
    }
  }, [selectedRepo]);

  useEffect(() => {
    if (selectedRepo) loadBranches(selectedRepo);
  }, [selectedRepo]);

  // ── Auto-load commits when branch changes ───────────────────
  const loadCommits = useCallback(async (branch?: string) => {
    if (!selectedRepo) return;
    setLoadingCommits(true);
    setCommitError(null);
    try {
      const { data } = await api.devflow.commits(selectedRepo, branch ?? selectedBranch);
      setCommits(data);
    } catch (e) {
      setCommitError(e instanceof Error ? e.message : 'Failed to load commits');
    } finally {
      setLoadingCommits(false);
    }
  }, [selectedRepo, selectedBranch]);

  const loadGitStatus = useCallback(async () => {
    if (!selectedRepo) return;
    setLoadingGit(true);
    setGitOutput(null);
    try {
      const { data } = await api.devflow.gitStatus(selectedRepo);
      setGitStatus(data);
    } catch (e: any) {
      setGitOutput(`Error fetching git status: ${e.message}`);
    } finally {
      setLoadingGit(false);
    }
  }, [selectedRepo]);

  useEffect(() => {
    if (selectedBranch && selectedRepo) loadCommits(selectedBranch);
  }, [selectedBranch, selectedRepo, loadCommits]);

  useEffect(() => {
    if (selectedRepo) loadGitStatus();
  }, [selectedRepo, loadGitStatus]);

  const handleGitAction = async (action: 'push' | 'pull' | 'fetch') => {
    if (!selectedRepo) return;
    setLoadingGit(true);
    setGitOutput(`Running git ${action}...`);
    try {
      const res = await api.devflow.gitAction(selectedRepo, action);
      setGitOutput(res.output);
      await loadGitStatus();
    } catch (e: any) {
      setGitOutput(`Error: ${e.message}`);
    } finally {
      setLoadingGit(false);
    }
  };

  // ── Deploy handler ──────────────────────────────────────────
  const handleDeploy = async (commitSha?: string, commitMsg?: string) => {
    setDeploying(true);
    setDeployResult(null);
    setDeployStatus('Triggering deployment…');
    try {
      const r = await api.devflow.deploy(selectedRepo, {
        branch: selectedBranch,
        environment: selectedEnv,
        commit_sha: commitSha,
        commit_message: commitMsg,
      });
      setDeployResult({ id: r.deployment_id, sha: r.commit_sha, msg: r.message, url: r.github_url });
      setDeployStatus('Deployment created! Security scan enqueued…');

      // Poll status
      let tries = 0;
      const poll = setInterval(async () => {
        tries++;
        const s = await api.devflow.deploymentStatus(r.deployment_id) as { status: string };
        setDeployStatus(`Scan status: ${s.status}…`);
        if (s.status === 'success' || s.status === 'failed' || tries > 15) {
          clearInterval(poll);
          setDeployStatus(`✅ Completed: ${s.status}`);
        }
      }, 2000);
    } catch (e) {
      setDeployStatus('❌ Deploy failed: ' + (e instanceof Error ? e.message : 'Unknown error'));
    } finally {
      setDeploying(false);
    }
  };

  // ── Styles ──────────────────────────────────────────────────
  const selectStyle = {
    background: 'var(--surface-2)', border: '1px solid var(--border)',
    color: 'var(--text-primary)', borderRadius: 7,
    padding: '8px 12px', fontSize: '0.875rem', cursor: 'pointer',
    minWidth: 180, outline: 'none',
    appearance: 'none' as const, WebkitAppearance: 'none' as const,
  };

  const currentRepo = repos.find(r => r.name === selectedRepo);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <GitPullRequest size={20} color="var(--primary)" />
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, letterSpacing: '-0.02em' }}>DevFlow</h2>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: 2 }}>
            Real-time Git operations and one-click secure deployments
          </p>
        </div>
        {currentRepo && (
          <a
            href={currentRepo.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              color: 'var(--text-muted)', fontSize: '0.8rem',
              textDecoration: 'none', border: '1px solid var(--border)',
              borderRadius: 6, padding: '6px 12px',
              background: 'var(--surface-2)', transition: 'all 0.15s',
            }}
          >
            <ExternalLink size={12} /> View on GitHub
          </a>
        )}
      </div>

      {/* Repo error banner */}
      {repoError && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
          borderRadius: 8, color: 'var(--danger)', fontSize: '0.85rem',
        }}>
          <AlertCircle size={16} />
          <span>{repoError}</span>
        </div>
      )}

      {/* Control Panel */}
      <div className="glass-card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Rocket size={15} color="var(--primary)" />
          <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Deploy Control Panel</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>

          {/* Repository selector */}
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>Repository</div>
            <div style={{ position: 'relative' }}>
              {loadingRepos ? (
                <div style={{ ...selectStyle, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)' }}>
                  <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
                  Loading repos…
                </div>
              ) : (
                <select value={selectedRepo} onChange={e => setSelectedRepo(e.target.value)} style={selectStyle}>
                  {repos.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                </select>
              )}
              {!loadingRepos && <ChevronDown size={13} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />}
            </div>
            {currentRepo?.language && (
              <div style={{ position: 'absolute', fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 4 }}>
                {currentRepo.language} · {currentRepo.visibility}
              </div>
            )}
          </div>

          {/* Branch selector */}
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>Branch</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <div style={{ position: 'relative' }}>
                <select value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)} style={selectStyle} disabled={loadingBranches}>
                  {branches.length > 0
                    ? branches.map(b => <option key={b.name} value={b.name}>{b.name}{b.isDefault ? ' (default)' : ''}</option>)
                    : <option value="main">main</option>}
                </select>
                <ChevronDown size={13} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
              </div>
              <button onClick={() => loadBranches()} disabled={loadingBranches} style={{
                background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 7,
                color: 'var(--text-muted)', padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center',
              }}>
                {loadingBranches ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={13} />}
              </button>
            </div>
          </div>

          {/* Environment selector */}
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>Environment</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {ENVS.map(e => (
                <button key={e} onClick={() => setSelectedEnv(e)} style={{
                  padding: '8px 16px', borderRadius: 7, fontSize: '0.875rem', fontWeight: 500,
                  border: `1px solid ${selectedEnv === e ? 'var(--primary)' : 'var(--border)'}`,
                  background: selectedEnv === e ? 'rgba(129,140,248,0.15)' : 'transparent',
                  color: selectedEnv === e ? 'var(--primary)' : 'var(--text-secondary)',
                  cursor: 'pointer', textTransform: 'capitalize', transition: 'all 0.15s',
                }}>{e}</button>
              ))}
            </div>
          </div>

          {/* Deploy button */}
          <button
            onClick={() => handleDeploy()}
            disabled={deploying || !selectedRepo}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: deploying ? 'rgba(129,140,248,0.1)' : 'linear-gradient(135deg,var(--primary),var(--accent))',
              color: '#fff', border: 'none', borderRadius: 8,
              padding: '9px 20px', cursor: (deploying || !selectedRepo) ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem', fontWeight: 700,
              boxShadow: deploying ? 'none' : '0 0 20px var(--primary-glow)',
              transition: 'all 0.2s', opacity: (deploying || !selectedRepo) ? 0.7 : 1,
            }}
          >
            {deploying ? <Loader2 size={16} className="animate-spin" /> : <Rocket size={16} />}
            Deploy
          </button>
        </div>

        {/* Deploy status */}
        {deployStatus && (
          <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 7, background: 'var(--surface-2)', border: '1px solid var(--border)', fontSize: '0.82rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: deployStatus.includes('✅') ? 'var(--success)' : deployStatus.includes('❌') ? 'var(--danger)' : 'var(--text-secondary)' }}>
              {deploying ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle2 size={12} />}
              {deployStatus}
            </div>
            {deployResult && (
              <div style={{ marginTop: 6, fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'monospace', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <span>ID: {deployResult.id.slice(0, 8)}</span>
                <span>SHA: {deployResult.sha.slice(0, 7)}</span>
                {deployResult.url && (
                  <a href={deployResult.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}>
                    <ExternalLink size={10} /> View commit
                  </a>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Local Git Operations */}
      <div className="glass-card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Terminal size={15} color="var(--primary)" />
          <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Local Git Controls</span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
          
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={() => handleGitAction('fetch')}
              disabled={loadingGit || !selectedRepo}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                color: 'var(--text-primary)', borderRadius: 8, padding: '8px 16px',
                cursor: loadingGit ? 'not-allowed' : 'pointer', fontSize: '0.85rem',
              }}
            >
              <RefreshCw size={14} className={loadingGit ? 'animate-spin' : ''} /> Fetch
            </button>
            <button
              onClick={() => handleGitAction('pull')}
              disabled={loadingGit || !selectedRepo}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)',
                color: '#10b981', borderRadius: 8, padding: '8px 16px',
                cursor: loadingGit ? 'not-allowed' : 'pointer', fontSize: '0.85rem',
              }}
            >
              <Download size={14} /> Pull
            </button>
            <button
              onClick={() => handleGitAction('push')}
              disabled={loadingGit || !selectedRepo}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)',
                color: '#3b82f6', borderRadius: 8, padding: '8px 16px',
                cursor: loadingGit ? 'not-allowed' : 'pointer', fontSize: '0.85rem',
              }}
            >
              <Upload size={14} /> Push
            </button>
          </div>

          <div style={{ flex: 1, background: 'var(--surface-bg)', borderRadius: 8, padding: '12px', border: '1px solid var(--border)', minWidth: 250 }}>
            {loadingGit && !gitStatus && !gitOutput ? (
               <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                 <Loader2 size={14} className="animate-spin" /> Loading git status...
               </div>
            ) : gitStatus ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Local Branch</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary)' }}>{gitStatus.branch}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Sync State</div>
                  <div style={{ fontSize: '0.85rem', color: gitStatus.ahead > 0 || gitStatus.behind > 0 ? 'var(--warning)' : 'var(--text-primary)' }}>
                    ↑ {gitStatus.ahead} · ↓ {gitStatus.behind}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Working Tree</div>
                  <div style={{ fontSize: '0.85rem', color: gitStatus.isClean ? '#10b981' : 'var(--danger)' }}>
                    {gitStatus.isClean ? 'Clean' : `${gitStatus.modifiedFiles} file(s) modified`}
                  </div>
                </div>
              </div>
            ) : null}
            
            {gitOutput && (
              <pre style={{ 
                marginTop: 10, padding: 8, background: '#000', borderRadius: 4, 
                fontSize: '0.75rem', color: '#a3a3a3', overflowX: 'auto',
                maxHeight: 120, whiteSpace: 'pre-wrap'
              }}>
                {gitOutput}
              </pre>
            )}
          </div>
        </div>
      </div>

      {/* Branches + Commits */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16 }}>

        {/* Branches */}
        <div className="glass-card" style={{ overflow: 'hidden', padding: 0 }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <GitBranch size={14} color="var(--primary)" />
              <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Branches</span>
              {branches.length > 0 && (
                <span style={{ fontSize: '0.65rem', background: 'var(--surface-2)', color: 'var(--text-muted)', padding: '1px 6px', borderRadius: 4 }}>
                  {branches.length}
                </span>
              )}
            </div>
            <button onClick={() => loadBranches()} disabled={loadingBranches} style={{
              background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 5,
              color: 'var(--text-muted)', padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem',
            }}>
              {loadingBranches ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={11} />}
              Refresh
            </button>
          </div>
          <div>
            {branchError ? (
              <div style={{ padding: '16px', fontSize: '0.78rem', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertCircle size={12} /> {branchError}
              </div>
            ) : loadingBranches ? (
              <div style={{ padding: '24px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Loading branches…
              </div>
            ) : branches.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                No branches found
              </div>
            ) : branches.map(b => (
              <div key={b.name}
                onClick={() => setSelectedBranch(b.name)}
                style={{
                  padding: '10px 16px', borderBottom: '1px solid var(--border)', cursor: 'pointer',
                  background: selectedBranch === b.name ? 'rgba(129,140,248,0.08)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  transition: 'background 0.15s',
                }}>
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 500, color: selectedBranch === b.name ? 'var(--primary)' : 'var(--text-primary)' }}>{b.name}</div>
                  <div className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>{b.sha.slice(0, 7)}</div>
                </div>
                {b.isDefault && <span style={{ fontSize: '0.65rem', background: 'var(--primary-glow)', color: 'var(--primary)', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>default</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Commits */}
        <div className="glass-card" style={{ overflow: 'hidden', padding: 0 }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <GitCommit size={14} color="var(--accent)" />
              <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Commits · <span style={{ color: 'var(--primary)', fontFamily: 'monospace' }}>{selectedBranch}</span></span>
            </div>
            <button onClick={() => loadCommits()} disabled={loadingCommits} style={{
              background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 5,
              color: 'var(--text-muted)', padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem',
            }}>
              {loadingCommits ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={11} />}
              Refresh
            </button>
          </div>
          <div>
            {commitError ? (
              <div style={{ padding: '16px', fontSize: '0.78rem', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertCircle size={12} /> {commitError}
              </div>
            ) : loadingCommits ? (
              <div style={{ padding: '24px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Fetching commits from GitHub…
              </div>
            ) : commits.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                No commits found
              </div>
            ) : commits.map(c => (
              <div key={c.sha} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 7, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                  <GitCommit size={14} color="var(--accent)" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.message}</div>
                  <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: '0.75rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                    <span className="font-mono" style={{ color: 'var(--accent)' }}>{c.sha.slice(0, 7)}</span>
                    <span>@{c.author}</span>
                    <span>{formatDistanceToNow(new Date(c.date), { addSuffix: true })}</span>
                    {(c as any).url && (
                      <a href={(c as any).url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <ExternalLink size={10} /> GitHub
                      </a>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDeploy(c.sha, c.message)}
                  disabled={deploying}
                  style={{
                    flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4,
                    background: 'rgba(129,140,248,0.1)', color: 'var(--primary)',
                    border: '1px solid rgba(129,140,248,0.25)', borderRadius: 5,
                    padding: '5px 10px', cursor: deploying ? 'not-allowed' : 'pointer',
                    fontSize: '0.75rem', fontWeight: 600, opacity: deploying ? 0.5 : 1,
                    transition: 'all 0.15s',
                  }}
                >
                  <Rocket size={11} /> Deploy
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
