import { clerkClient } from '@clerk/clerk-sdk-node';
import { Request, Response, NextFunction } from 'express';

/**
 * Role-based access control.
 *
 * Every signed-in user can READ. Write actions (POST/PUT/PATCH/DELETE) require
 * the `admin` role. Roles are resolved, in order, from:
 *   1. ADMIN_USER_IDS env (comma-separated Clerk user ids) — bootstrap admins
 *   2. Clerk user `publicMetadata.role === 'admin'` (set in the Clerk dashboard)
 * Anyone else, including the public demo account, is a read-only `viewer`.
 */
export type Role = 'admin' | 'viewer';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const ROLE_CACHE_TTL_MS = 60_000;
const roleCache = new Map<string, { role: Role; expiresAt: number }>();

function adminUserIds(): Set<string> {
  return new Set(
    (process.env.ADMIN_USER_IDS || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
  );
}

export async function getUserRole(userId: string): Promise<Role> {
  if (adminUserIds().has(userId)) return 'admin';

  const cached = roleCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.role;

  let role: Role = 'viewer';
  try {
    const user = await clerkClient.users.getUser(userId);
    role = (user.publicMetadata as { role?: string } | undefined)?.role === 'admin' ? 'admin' : 'viewer';
  } catch (err) {
    // Fail closed: if Clerk can't be reached, treat the user as a viewer (and don't cache it)
    console.error('❌ Failed to resolve user role from Clerk:', (err as Error).message);
    return 'viewer';
  }

  roleCache.set(userId, { role, expiresAt: Date.now() + ROLE_CACHE_TTL_MS });
  return role;
}

/** Blocks write requests from non-admin users. Runs after auth populates req.auth. */
export async function requireAdminForWrites(req: Request, res: Response, next: NextFunction) {
  if (!WRITE_METHODS.has(req.method)) return next();

  const userId = (req as any).auth?.userId as string | undefined;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  if ((await getUserRole(userId)) !== 'admin') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Admin role required for this action. Ask an admin to grant you access.',
    });
  }

  next();
}

/** True only when LOCAL_GIT_ACTIONS=true — never enable this on a shared/cloud server. */
export function localGitActionsEnabled(): boolean {
  return process.env.LOCAL_GIT_ACTIONS === 'true';
}

// GET /api/me — lets the frontend hide actions the user isn't allowed to perform
export async function getCurrentUser(req: Request, res: Response) {
  const userId = (req as any).auth?.userId as string;
  const role = await getUserRole(userId);
  return res.json({
    userId,
    role,
    canWrite: role === 'admin',
    localGitEnabled: localGitActionsEnabled(),
  });
}
