const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function buildQuery(params?: Record<string, string | number | boolean | undefined | null>): string {
  if (!params) return '';
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  });
  const str = q.toString();
  return str ? `?${str}` : '';
}

async function waitForClerk(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if ((window as any).Clerk?.isReady) return true;

  return new Promise((resolve) => {
    const interval = setInterval(() => {
      if ((window as any).Clerk?.isReady) {
        clearInterval(interval);
        resolve(true);
      }
    }, 50);
    setTimeout(() => { clearInterval(interval); resolve(false); }, 3000); // 3s timeout
  });
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  
  if (typeof window !== 'undefined') {
    await waitForClerk();
    const clerk = (window as any).Clerk;
    if (clerk?.session) {
      try {
        const token = await clerk.session.getToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;
      } catch (err) {
        console.warn('⚠️ [API] Token retrieval failed:', err);
      }
    }
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...headers, ...options?.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `API error ${res.status}`);
  }
  return res.json();
}

// ── Dashboard ──────────────────────────────────────────────
export const api = {
  dashboard: {
    overview: () => apiFetch<DashboardOverview>('/api/dashboard/overview'),
  },

  deployments: {
    list: (params?: { service?: string; env?: string; status?: string; limit?: number }) => {
      return apiFetch<{ data: Deployment[]; count: number }>(`/api/deployments${buildQuery(params)}`);
    },
    get: (id: string) => apiFetch<Deployment>(`/api/deployments/${id}`),
  },

  vulnerabilities: {
    list: (params?: { severity?: string; service?: string; resolved?: string; limit?: number }) => {
      return apiFetch<{ data: Vulnerability[]; total: number }>(`/api/vulnerabilities${buildQuery(params)}`);
    },
    resolve: (id: string) => apiFetch(`/api/vulnerabilities/${id}/resolve`, { method: 'PATCH' }),
  },

  services: {
    list: () => apiFetch<{ data: Service[] }>('/api/services'),
    get: (id: string) => apiFetch<Service>(`/api/services/${id}`),
    riskHistory: (id: string) => apiFetch<{ data: RiskScore[] }>(`/api/services/${id}/risk-history`),
  },

  policyViolations: {
    list: (params?: { service?: string; resolved?: string }) => {
      return apiFetch<{ data: PolicyViolation[]; count: number }>(`/api/policy-violations${buildQuery(params)}`);
    },
    resolve: (id: string) => apiFetch(`/api/policy-violations/${id}/resolve`, { method: 'PATCH' }),
  },

  devflow: {
    repos: () => apiFetch<{ data: any[] }>('/api/devflow/repos'),
    branches: (repoId: string) => apiFetch<{ data: Branch[]; repo: string }>(`/api/devflow/repos/${repoId}/branches`),
    commits: (repoId: string, branch?: string) =>
      apiFetch<{ data: Commit[] }>(`/api/devflow/repos/${repoId}/commits${branch ? `?branch=${branch}` : ''}`),
    deploy: (repoId: string, body: { branch: string; environment: string; commit_sha?: string; commit_message?: string }) =>
      apiFetch<{ success: boolean; deployment_id: string; commit_sha: string; message: string; github_url?: string }>(
        `/api/devflow/repos/${repoId}/deploy`,
        { method: 'POST', body: JSON.stringify(body) }
      ),
    deploymentStatus: (id: string) => apiFetch(`/api/devflow/deployments/${id}/status`),
    gitStatus: (repoId: string) => apiFetch<{ success: boolean; data: any }>(`/api/devflow/repos/${repoId}/git/status`),
    gitAction: (repoId: string, action: 'push' | 'pull' | 'fetch') =>
      apiFetch<{ success: boolean; message: string; output: string }>(
        `/api/devflow/repos/${repoId}/git/action`,
        { method: 'POST', body: JSON.stringify({ action }) }
      ),
  },

  analytics: {
    riskTrends: (serviceId?: string) => apiFetch<{ data: Array<{ date: string; score: number; service: string }> }>(`/api/analytics/risk-trends${buildQuery({ serviceId })}`),
    mttr: () => apiFetch<{ data: Array<{ month: string; mttrHours: number }>; current: number; unit: string; trend: number }>('/api/analytics/mttr'),
  },
};

// ── Types ──────────────────────────────────────────────────
export interface DashboardOverview {
  totalDeployments: number;
  activeDeployments: number;
  openCVEs: number;
  criticalCVEs: number;
  detectedSecrets: number;
  openViolations: number;
  servicesCount: number;
  avgRiskScore: number;
  recentDeployments: Deployment[];
}

export interface Service {
  id: string;
  name: string;
  language: string | null;
  repoUrl: string | null;
  createdAt: string;
  latestRiskScore?: number;
  openCVEs?: number;
  _count?: { deployments: number; vulnerabilities: number };
}

export interface Deployment {
  id: string;
  serviceId: string;
  commitSha: string;
  commitMessage: string | null;
  branch: string | null;
  author: string | null;
  status: 'pending' | 'running' | 'success' | 'failed';
  environment: string | null;
  triggeredAt: string;
  completedAt: string | null;
  pipelineUrl: string | null;
  service?: { id: string; name: string; language: string | null };
  riskScores?: RiskScore[];
  _count?: { vulnerabilities: number; scans: number };
}

export interface Vulnerability {
  id: string;
  cveId: string | null;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  cvssScore: number | null;
  affectedPackage: string | null;
  fixedVersion: string | null;
  scannerSource: string | null;
  isResolved: boolean;
  detectedAt: string;
  service?: { id: string; name: string };
  deployment?: { id: string; commitSha: string; branch: string | null; environment: string | null };
}

export interface RiskScore {
  id: string;
  score: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  calculatedAt: string;
  deployment?: { commitSha: string; branch: string | null; triggeredAt: string };
}

export interface PolicyViolation {
  id: string;
  violationType: string | null;
  severity: string | null;
  detail: string | null;
  isResolved: boolean;
  detectedAt: string;
  service?: { id: string; name: string };
  deployment?: { id: string; commitSha: string; branch: string | null };
}

export interface Secret {
  id: string;
  type: string;
  source: string;
  file: string | null;
  line: number | null;
  commitSha: string | null;
  isVerified: boolean;
  detectedAt: string;
  service?: { id: string; name: string };
  deployment?: { id: string; commitSha: string; branch: string | null };
}

export interface Branch {
  name: string;
  sha: string;
  isDefault: boolean;
  updatedAt: string;
}

export interface Commit {
  sha: string;
  message: string;
  author: string;
  date: string;
  branch: string | string[];
}
