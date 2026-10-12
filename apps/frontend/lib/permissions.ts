'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { api, CurrentUser } from './api';

const READ_ONLY: CurrentUser = { userId: '', role: 'viewer', canWrite: false, localGitEnabled: false };

// One /api/me request per signed-in user per page load, shared by every component
let cached: { userId: string; promise: Promise<CurrentUser> } | null = null;

/**
 * Returns what the signed-in user is allowed to do, as reported by the backend.
 * Defaults to read-only until the answer arrives (or if the request fails) —
 * the backend enforces the same rules, this only hides buttons that would 403.
 */
export function usePermissions(): CurrentUser {
  const { userId, isLoaded } = useAuth();
  const [permissions, setPermissions] = useState<CurrentUser>(READ_ONLY);

  useEffect(() => {
    if (!isLoaded || !userId) return;
    if (!cached || cached.userId !== userId) {
      cached = { userId, promise: api.me().catch(() => READ_ONLY) };
    }
    let active = true;
    cached.promise.then((p) => active && setPermissions(p));
    return () => { active = false; };
  }, [isLoaded, userId]);

  return permissions;
}
