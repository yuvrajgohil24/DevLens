import { clerkMiddleware, getAuth } from '@clerk/express';
import { Request, Response, NextFunction } from 'express';
import { reqLogger } from '../utils/logger';

/**
 * Verifies the Clerk session token (Bearer header) and attaches the auth state
 * to the request. It never blocks on its own — protectRoute does that.
 * The frontend's NEXT_PUBLIC_ key is accepted as a fallback so a shared .env works.
 */
const clerkAuth = clerkMiddleware({
  publishableKey: process.env.CLERK_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
});

/** The signed-in Clerk user id, or undefined if the request is not authenticated. */
export function getUserId(req: Request): string | undefined {
  try {
    return getAuth(req).userId ?? undefined;
  } catch {
    return undefined; // clerkMiddleware did not run for this request
  }
}

/** Authenticates the request and responds 401 (JSON, no redirect) when there is no valid session. */
export const protectRoute = (req: Request, res: Response, next: NextFunction) => {
  clerkAuth(req, res, (err?: unknown) => {
    if (err) {
      reqLogger(req).warn({ err }, 'Clerk authentication error');
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid session' });
    }
    if (!getUserId(req)) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Sign in required' });
    }
    next();
  });
};
