import { Response } from 'express';
import { reqLogger } from './logger';

/**
 * An error whose message is safe to show to API clients (written by us, no
 * internal details). Anything else is logged server-side and answered with a
 * generic message, so stack traces, file paths, SQL or upstream API errors
 * never reach the browser.
 */
export class PublicError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'PublicError';
  }
}

/** Maps any thrown value to a safe HTTP response and logs the real cause. */
export function sendError(res: Response, err: unknown, context: string) {
  if (err instanceof PublicError) {
    return res.status(err.status).json({ error: err.message });
  }

  // Prisma "record not found" (e.g. resolving an id that doesn't exist)
  if ((err as { code?: string })?.code === 'P2025') {
    return res.status(404).json({ error: 'Not found' });
  }

  // pino-http's request logger carries the request id; fall back to the base logger
  reqLogger(res.req ?? {}).error({ err }, context);
  return res.status(500).json({ error: 'Internal server error', requestId: res.req?.id });
}

/**
 * Status + message for errors that escape to Express's error middleware.
 * body-parser errors (malformed JSON, payload too large) carry a 4xx status.
 */
export function toErrorResponse(err: unknown): { status: number; body: { error: string } } {
  if (err instanceof PublicError) return { status: err.status, body: { error: err.message } };

  const status = (err as { status?: number; statusCode?: number })?.status ?? (err as { statusCode?: number })?.statusCode;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    const type = (err as { type?: string })?.type;
    const message =
      type === 'entity.parse.failed' ? 'Malformed JSON body'
      : type === 'entity.too.large' ? 'Request body too large'
      : 'Bad request';
    return { status, body: { error: message } };
  }

  return { status: 500, body: { error: 'Internal server error' } };
}
