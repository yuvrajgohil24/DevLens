import rateLimit, { Options } from 'express-rate-limit';

/**
 * Per-IP rate limits. Counters live in process memory, which is correct for a
 * single API instance; with several replicas, switch to a shared (Redis) store.
 *
 * Client IPs come from X-Forwarded-For, so `trust proxy` must match the number
 * of proxies in front of the app (see TRUST_PROXY in app.ts) — otherwise every
 * request would share the proxy's IP, or clients could spoof theirs.
 */
const base: Partial<Options> = {
  standardHeaders: 'draft-8',
  legacyHeaders: false,
};

const limitResponse = (message: string) => ({ error: 'Too many requests', message });

/** All authenticated API traffic: generous, stops scripted abuse. */
export const apiLimiter = rateLimit({
  ...base,
  windowMs: 60_000,
  limit: Number(process.env.RATE_LIMIT_API_PER_MIN || 300),
  message: limitResponse('API rate limit exceeded — slow down and retry shortly.'),
});

/** CI pipeline webhooks: a few events per pipeline run. */
export const webhookLimiter = rateLimit({
  ...base,
  windowMs: 60_000,
  limit: Number(process.env.RATE_LIMIT_WEBHOOK_PER_MIN || 60),
  message: limitResponse('Webhook rate limit exceeded.'),
});

/** Public demo login mints Clerk sign-in tokens — keep it tight. */
export const demoSessionLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60_000,
  limit: Number(process.env.RATE_LIMIT_DEMO_PER_15MIN || 10),
  message: limitResponse('Too many demo sign-ins from this network — try again in a few minutes.'),
});
