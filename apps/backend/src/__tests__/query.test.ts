/**
 * Unit tests for query-string validation of list endpoints.
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { booleanParam, idParam, limitParam, MAX_PAGE_SIZE, offsetParam, parseIdParam, parseQuery, severityParam } from '../utils/query';

const schema = z.object({
  severity: severityParam.optional(),
  service: idParam.optional(),
  resolved: booleanParam,
  limit: limitParam(100),
  offset: offsetParam,
});

const mockRes = () => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  return { res: { status } as unknown as Response, status, json };
};
const req = (query: Record<string, string>, params: Record<string, string> = {}) => ({ query, params }) as unknown as Request;

describe('parseQuery', () => {
  it('applies defaults and coerces types', () => {
    const { res } = mockRes();
    expect(parseQuery(schema, req({ resolved: 'false' }), res)).toEqual({ resolved: false, limit: 100, offset: 0 });
    expect(parseQuery(schema, req({ limit: '25', offset: '50' }), res)).toMatchObject({ limit: 25, offset: 50 });
  });

  it.each([
    ['huge limit', { limit: '1000000' }],
    ['non-numeric limit', { limit: 'abc' }],
    ['zero limit', { limit: '0' }],
    ['negative offset', { offset: '-5' }],
    ['unknown severity', { severity: 'urgent' }],
    ['non-uuid service id', { service: "1' OR '1'='1" }],
    ['bad boolean', { resolved: 'yes' }],
  ])('rejects %s with 400', (_label, query) => {
    const { res, status } = mockRes();
    expect(parseQuery(schema, req(query), res)).toBeNull();
    expect(status).toHaveBeenCalledWith(400);
  });

  it(`caps page size at ${MAX_PAGE_SIZE}`, () => {
    const { res } = mockRes();
    expect(parseQuery(schema, req({ limit: String(MAX_PAGE_SIZE) }), res)).toMatchObject({ limit: MAX_PAGE_SIZE });
    expect(parseQuery(schema, req({ limit: String(MAX_PAGE_SIZE + 1) }), mockRes().res)).toBeNull();
  });
});

describe('parseIdParam', () => {
  it('accepts a UUID', () => {
    const id = '6f1c2a3e-1b2c-4d5e-8f9a-0b1c2d3e4f5a';
    expect(parseIdParam(req({}, { id }), mockRes().res)).toBe(id);
  });

  it('rejects anything else with 400', () => {
    const { res, status } = mockRes();
    expect(parseIdParam(req({}, { id: '../../etc' }), res)).toBeNull();
    expect(status).toHaveBeenCalledWith(400);
  });
});
