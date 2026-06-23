import { Request, Response, NextFunction } from 'express';

/**
 * Read-only guard for the public demo account.
 *
 * The DevLens live demo signs recruiters in as a shared "guest" Clerk user so they
 * can explore the dashboard without credentials. To keep that data pristine, this
 * middleware blocks any mutating request (POST/PUT/PATCH/DELETE) made by the demo
 * user. Set DEMO_USER_ID to the Clerk user id of the demo account to enable it.
 */
const DEMO_USER_ID = process.env.DEMO_USER_ID;
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function blockDemoWrites(req: Request, res: Response, next: NextFunction) {
  const userId = (req as any).auth?.userId as string | undefined;

  if (DEMO_USER_ID && userId === DEMO_USER_ID && WRITE_METHODS.has(req.method)) {
    return res.status(403).json({
      error: 'Read-only demo',
      message: 'You are signed in to the public demo account — write actions are disabled.',
    });
  }

  next();
}
