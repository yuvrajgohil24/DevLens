import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

export const SIGNATURE_HEADER = 'x-devlens-signature-256';

/**
 * Verifies the HMAC-SHA256 signature of an incoming pipeline webhook.
 *
 * The sender computes `sha256=<hex hmac of the raw request body>` using the
 * shared WEBHOOK_SECRET and sends it in the `X-DevLens-Signature-256` header
 * (see scripts/notify-devlens.sh). Requires express.json() to be configured
 * with a `verify` hook that stores the raw body on `req.rawBody`.
 *
 * Fails closed: if WEBHOOK_SECRET is not set, every request is rejected unless
 * ALLOW_UNSIGNED_WEBHOOKS=true is explicitly set (local development only).
 */
export function verifyWebhookSignature(req: Request, res: Response, next: NextFunction) {
  const secret = process.env.WEBHOOK_SECRET;

  if (!secret) {
    if (process.env.ALLOW_UNSIGNED_WEBHOOKS === 'true') {
      console.warn('⚠️ WEBHOOK_SECRET is not set — accepting UNSIGNED webhook (ALLOW_UNSIGNED_WEBHOOKS=true)');
      return next();
    }
    console.error('❌ WEBHOOK_SECRET is not set — rejecting webhook');
    return res.status(503).json({ error: 'Webhook not configured' });
  }

  const signature = req.header(SIGNATURE_HEADER);
  const rawBody: Buffer | undefined = (req as any).rawBody;

  if (!signature || !rawBody) {
    return res.status(401).json({ error: 'Missing webhook signature' });
  }

  const expected = `sha256=${crypto.createHmac('sha256', secret).update(rawBody).digest('hex')}`;
  const received = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);

  if (received.length !== expectedBuf.length || !crypto.timingSafeEqual(received, expectedBuf)) {
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  next();
}
