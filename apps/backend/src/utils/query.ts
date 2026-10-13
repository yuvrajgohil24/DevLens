import { Request, Response } from 'express';
import { z } from 'zod';

/**
 * Query-string validation for list endpoints. Unknown/invalid values are
 * rejected with 400 instead of reaching Prisma, and page sizes are capped so a
 * client can't request millions of rows (`?limit=1000000`).
 */
export const MAX_PAGE_SIZE = 200;
const MAX_OFFSET = 100_000;

/** `?limit=` — integer 1..MAX_PAGE_SIZE, with a per-endpoint default. */
export const limitParam = (defaultValue: number) =>
  z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(defaultValue);

export const offsetParam = z.coerce.number().int().min(0).max(MAX_OFFSET).default(0);

/** `?resolved=true|false` → boolean | undefined */
export const booleanParam = z
  .enum(['true', 'false'])
  .transform((v) => v === 'true')
  .optional();

/** Ids are UUIDs; anything else can't match a row. */
export const idParam = z.string().uuid();

export const severityParam = z.enum(['critical', 'high', 'medium', 'low']);
export const environmentParam = z.enum(['staging', 'production']);
export const deploymentStatusParam = z.enum(['pending', 'running', 'success', 'failed']);
export const scannerParam = z.enum(['trivy', 'snyk', 'trufflehog']);

/**
 * Parses req.query with the schema. On failure responds 400 with the field
 * errors and returns null — callers just `if (!query) return;`.
 */
export function parseQuery<T extends z.ZodTypeAny>(schema: T, req: Request, res: Response): z.infer<T> | null {
  const result = schema.safeParse(req.query);
  if (!result.success) {
    res.status(400).json({ error: 'Invalid query parameters', details: result.error.flatten().fieldErrors });
    return null;
  }
  return result.data;
}

/** Validates an :id route param; responds 400 and returns null when it isn't a UUID. */
export function parseIdParam(req: Request, res: Response, name = 'id'): string | null {
  const result = idParam.safeParse(req.params[name]);
  if (!result.success) {
    res.status(400).json({ error: `Invalid ${name}` });
    return null;
  }
  return result.data;
}
