'use client';

import { useUser } from '@clerk/nextjs';

/** Email of the shared public demo account. Used to detect demo sessions on the client. */
export const DEMO_EMAIL = (process.env.NEXT_PUBLIC_DEMO_EMAIL || '').toLowerCase();

/**
 * Returns true when the current session belongs to the public demo account.
 * Detection is by primary email (NEXT_PUBLIC_DEMO_EMAIL) or a `role: 'demo'`
 * entry in the Clerk user's publicMetadata.
 */
export function useDemoMode(): boolean {
  const { user, isLoaded } = useUser();
  if (!isLoaded || !user) return false;

  const emails = user.emailAddresses?.map((e) => e.emailAddress.toLowerCase()) ?? [];
  if (DEMO_EMAIL && emails.includes(DEMO_EMAIL)) return true;
  if ((user.publicMetadata as { role?: string } | undefined)?.role === 'demo') return true;

  return false;
}
