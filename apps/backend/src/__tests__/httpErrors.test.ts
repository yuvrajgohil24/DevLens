/**
 * Unit tests for safe error responses (no internal details reach clients).
 */

import { Response } from 'express';
import { PublicError, sendError, toErrorResponse } from '../utils/httpErrors';

const mockRes = () => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  return { res: { status } as unknown as Response, status, json };
};

describe('sendError', () => {
  beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  it('hides internal error messages behind a generic 500', () => {
    const { res, status, json } = mockRes();
    sendError(res, new Error('connect ECONNREFUSED 10.0.0.5:5432 at /app/dist/db.js'), 'ctx');
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });

  it('passes PublicError messages and status through', () => {
    const { res, status, json } = mockRes();
    sendError(res, new PublicError(503, 'GitHub rate limit reached'), 'ctx');
    expect(status).toHaveBeenCalledWith(503);
    expect(json).toHaveBeenCalledWith({ error: 'GitHub rate limit reached' });
  });

  it('maps Prisma "record not found" to 404', () => {
    const { res, status, json } = mockRes();
    sendError(res, Object.assign(new Error('Record to update not found.'), { code: 'P2025' }), 'ctx');
    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({ error: 'Not found' });
  });
});

describe('toErrorResponse', () => {
  it('turns malformed JSON into a 400 without echoing the parser message', () => {
    const err = Object.assign(new SyntaxError('Unexpected token } in JSON at position 12'), { status: 400, type: 'entity.parse.failed' });
    expect(toErrorResponse(err)).toEqual({ status: 400, body: { error: 'Malformed JSON body' } });
  });

  it('turns oversized bodies into 413', () => {
    const err = Object.assign(new Error('request entity too large'), { status: 413, type: 'entity.too.large' });
    expect(toErrorResponse(err)).toEqual({ status: 413, body: { error: 'Request body too large' } });
  });

  it('never exposes unexpected errors', () => {
    expect(toErrorResponse(new Error('secret internals'))).toEqual({ status: 500, body: { error: 'Internal server error' } });
  });
});
