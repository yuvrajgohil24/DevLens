import 'dotenv/config';
/**
 * DevLens Backend - Main Application Entry
 * Triggered by: Smart CI Pipeline Test
 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { randomUUID } from 'crypto';

import { handlePipelineWebhook } from './webhooks/pipeline';
import { getOverview } from './api/dashboard';
import { listDeployments, getDeployment } from './api/deployments';
import { listVulnerabilities, resolveVulnerability } from './api/vulnerabilities';
import { listServices, getService, getServiceRiskHistory } from './api/services';
import { listPolicyViolations, resolvePolicyViolation } from './api/policyViolations';
import {
  getRepos,
  getBranches,
  getCommits,
  triggerDeploy,
  getDeploymentStatus,
  getLocalGitStatus,
  executeGitAction,
} from './api/devflow';
import { getRiskTrends, getMttr } from './api/analytics';
import { createDemoSession } from './api/demo';
import { toErrorResponse } from './utils/httpErrors';
import { logger, reqLogger } from './utils/logger';
import { getUserId } from './middleware/auth';

const app = express();

// Number of reverse proxies in front of the app (Railway: 1), so req.ip is the
// real client IP for rate limiting. Default 0 locally: never trust a client-sent
// X-Forwarded-For when nothing sits in front of the server.
app.set('trust proxy', Number(process.env.TRUST_PROXY ?? (process.env.NODE_ENV === 'production' ? 1 : 0)));

// ── Middleware ─────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
// Request logging with a request id per request: taken from an incoming
// X-Request-Id (if sane) or generated, echoed back in the response header and
// attached to every log line written for that request (req.log).
app.use(
  pinoHttp({
    logger,
    genReqId: (req, res) => {
      const incoming = req.headers['x-request-id'];
      const id = typeof incoming === 'string' && /^[\w-]{1,64}$/.test(incoming) ? incoming : randomUUID();
      res.setHeader('X-Request-Id', id);
      return id;
    },
    autoLogging: { ignore: (req) => req.url === '/health' },
    customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
    // Keep request logs small: method, url, status, duration, user
    serializers: {
      req: (req) => ({ id: req.id, method: req.method, url: req.url }),
      res: (res) => ({ statusCode: res.statusCode }),
    },
    customProps: (req) => ({ userId: getUserId(req as express.Request) }),
  })
);
app.use(
  express.json({
    // Keep the exact request bytes so webhook HMAC signatures can be verified
    verify: (req, _res, buf) => {
      (req as any).rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true }));

// ── Health ─────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'devlens-backend' });
});

// ── Auth Middleware ──────────────────────────────────────────
import { protectRoute } from './middleware/auth';
import { blockDemoWrites } from './middleware/demoGuard';
import { verifyWebhookSignature } from './middleware/webhookSignature';
import { requireAdminForWrites, getCurrentUser } from './middleware/roles';
import { apiLimiter, webhookLimiter, demoSessionLimiter } from './middleware/rateLimit';

// Public /api/ routes that must NOT require a Clerk session.
const isPublicApi = (path: string) =>
  path.startsWith('/api/webhooks/') || path.startsWith('/api/demo/');

// Rate limits run before auth, so unauthenticated floods are cut off cheaply.
// Public routes get their own (stricter) limiters below.
app.use((req, res, next) =>
  req.path.startsWith('/api/') && !isPublicApi(req.path) ? apiLimiter(req, res, next) : next()
);

app.use((req, res, next) => {
  // Protect all /api/ routes except the public ones above
  if (req.path.startsWith('/api/') && !isPublicApi(req.path)) {
    return protectRoute(req, res, next);
  }
  next();
});

// Read-only enforcement for the public demo account (runs after auth populates req.auth)
app.use((req, res, next) => {
  if (req.path.startsWith('/api/') && !isPublicApi(req.path)) {
    return blockDemoWrites(req, res, next);
  }
  next();
});

// Write actions require the admin role; everyone else is read-only
app.use((req, res, next) => {
  if (req.path.startsWith('/api/') && !isPublicApi(req.path)) {
    return requireAdminForWrites(req, res, next);
  }
  next();
});

// ── Webhooks ───────────────────────────────────────────────
app.post('/api/webhooks/pipeline', webhookLimiter, verifyWebhookSignature, handlePipelineWebhook);

// ── Demo / Guest session (public) ──────────────────────────
app.post('/api/demo/session', demoSessionLimiter, createDemoSession);

// ── Current user / permissions ─────────────────────────────
app.get('/api/me', getCurrentUser);

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

// ── Analytics ──────────────────────────────────────────────
app.get('/api/analytics/risk-trends', getRiskTrends);
app.get('/api/analytics/mttr', getMttr);

// ── 404 ────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ── Error handler ──────────────────────────────────────────
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const { status, body } = toErrorResponse(err);
  // Log server errors in full; client errors (bad JSON etc.) only briefly
  if (status >= 500) reqLogger(req).error({ err }, 'Unhandled error');
  else reqLogger(req).warn({ status, reason: err.message }, 'Client error');
  res.status(status).json(status >= 500 ? { ...body, requestId: req.id } : body);
});

export default app;