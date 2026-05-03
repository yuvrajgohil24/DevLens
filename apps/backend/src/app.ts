import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { handlePipelineWebhook } from './webhooks/pipeline';
import { getOverview } from './api/dashboard';
import { listDeployments, getDeployment } from './api/deployments';
import { listVulnerabilities, resolveVulnerability } from './api/vulnerabilities';
import { listServices, getService, getServiceRiskHistory } from './api/services';
import { listPolicyViolations, resolvePolicyViolation } from './api/policyViolations';
import {
  getBranches,
  getCommits,
  triggerDeploy,
  getDeploymentStatus,
  getRepos,
  getLocalGitStatus,
  executeGitAction,
} from './api/devflow';

const app = express();

// ── Middleware ─────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Health ─────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'devlens-backend' });
});

// ── Auth Middleware ──────────────────────────────────────────
import { protectRoute } from './middleware/auth';
app.use((req, res, next) => {
  // Protect all /api/ routes EXCEPT webhooks
  if (req.path.startsWith('/api/') && !req.path.startsWith('/api/webhooks/')) {
    return protectRoute(req, res, next);
  }
  next();
});

// ── Webhooks ───────────────────────────────────────────────
app.post('/api/webhooks/pipeline', handlePipelineWebhook);

// ── Dashboard ──────────────────────────────────────────────
app.get('/api/dashboard/overview', getOverview);

// ── Deployments ────────────────────────────────────────────
app.get('/api/deployments', listDeployments);
app.get('/api/deployments/:id', getDeployment);

// ── Vulnerabilities ────────────────────────────────────────
app.get('/api/vulnerabilities', listVulnerabilities);
app.patch('/api/vulnerabilities/:id/resolve', resolveVulnerability);

// ── Services ───────────────────────────────────────────────
app.get('/api/services', listServices);
app.get('/api/services/:id', getService);
app.get('/api/services/:id/risk-history', getServiceRiskHistory);

// ── Policy Violations ──────────────────────────────────────
app.get('/api/policy-violations', listPolicyViolations);
app.patch('/api/policy-violations/:id/resolve', resolvePolicyViolation);

// ── DevFlow ────────────────────────────────────────────────
app.get('/api/devflow/repos', getRepos);
app.get('/api/devflow/repos/:repoId/branches', getBranches);
app.get('/api/devflow/repos/:repoId/commits', getCommits);
app.post('/api/devflow/repos/:repoId/deploy', triggerDeploy);
app.get('/api/devflow/deployments/:id/status', getDeploymentStatus);
app.get('/api/devflow/repos/:repoId/git/status', getLocalGitStatus);
app.post('/api/devflow/repos/:repoId/git/action', executeGitAction);

// ── 404 ────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ── Error handler ──────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

export default app;
