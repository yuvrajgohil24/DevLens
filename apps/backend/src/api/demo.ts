import { Request, Response } from 'express';
import { clerkClient } from '@clerk/express';
import { logger } from '../utils/logger';

const DEMO_USER_ID = process.env.DEMO_USER_ID;

/**
 * Issues a short-lived Clerk sign-in token (ticket) for the public demo user.
 *
 * The frontend "Continue as Guest" button consumes this with
 * `signIn.create({ strategy: 'ticket', ticket })`, which creates a fully
 * authenticated session and BYPASSES password + MFA entirely. This is the
 * robust way to do programmatic demo logins — no shared password in the
 * browser, no second-factor friction.
 *
 * Public (unauthenticated) by design; it only ever mints a token for the
 * single configured demo account, which is read-only via demoGuard.
 */
export async function createDemoSession(_req: Request, res: Response) {
  if (!DEMO_USER_ID) {
    return res.status(500).json({ error: 'Demo not configured', message: 'DEMO_USER_ID is not set.' });
  }

  try {
    const signInToken = await clerkClient.signInTokens.createSignInToken({
      userId: DEMO_USER_ID,
      expiresInSeconds: 600, // 10 minutes
    });
    return res.json({ token: signInToken.token });
  } catch (err) {
    logger.error({ err }, 'Failed to create demo sign-in token');
    return res.status(502).json({
      error: 'Demo unavailable',
      message: 'Could not create a demo session. Check CLERK_SECRET_KEY and DEMO_USER_ID.',
    });
  }
}
