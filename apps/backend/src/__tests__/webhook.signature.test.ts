/**
 * Unit tests for the pipeline webhook HMAC signature middleware.
 */

import crypto from 'crypto';
import { Request, Response } from 'express';
import { verifyWebhookSignature, SIGNATURE_HEADER } from '../middleware/webhookSignature';

describe('verifyWebhookSignature', () => {
  const secret = 'test-secret';
  const body = Buffer.from(JSON.stringify({ commit_sha: 'abc1234', service_name: 'svc' }));
  const sign = (buf: Buffer, key = secret) => `sha256=${crypto.createHmac('sha256', key).update(buf).digest('hex')}`;

  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;
  let next: jest.Mock;
  const originalEnv = { ...process.env };

  const makeReq = (signature?: string, rawBody: Buffer | undefined = body) =>
    ({
      rawBody,
      header: (name: string) => (name.toLowerCase() === SIGNATURE_HEADER ? signature : undefined),
    }) as unknown as Request;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    next = jest.fn();
    process.env.WEBHOOK_SECRET = secret;
    delete process.env.ALLOW_UNSIGNED_WEBHOOKS;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  const res = () => ({ status: statusMock }) as unknown as Response;

  it('calls next() for a valid signature', () => {
    verifyWebhookSignature(makeReq(sign(body)), res(), next);
    expect(next).toHaveBeenCalled();
    expect(statusMock).not.toHaveBeenCalled();
  });

  it('rejects a missing signature with 401', () => {
    verifyWebhookSignature(makeReq(undefined), res(), next);
    expect(statusMock).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a signature made with the wrong secret', () => {
    verifyWebhookSignature(makeReq(sign(body, 'wrong-secret')), res(), next);
    expect(statusMock).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a valid signature for a tampered body', () => {
    const tampered = Buffer.from(body.toString().replace('svc', 'evil'));
    verifyWebhookSignature(makeReq(sign(body), tampered), res(), next);
    expect(statusMock).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('fails closed with 503 when WEBHOOK_SECRET is not configured', () => {
    delete process.env.WEBHOOK_SECRET;
    verifyWebhookSignature(makeReq(undefined), res(), next);
    expect(statusMock).toHaveBeenCalledWith(503);
    expect(next).not.toHaveBeenCalled();
  });

  it('allows unsigned webhooks only when explicitly opted in', () => {
    delete process.env.WEBHOOK_SECRET;
    process.env.ALLOW_UNSIGNED_WEBHOOKS = 'true';
    verifyWebhookSignature(makeReq(undefined), res(), next);
    expect(next).toHaveBeenCalled();
  });
});
