import { SignUp } from '@clerk/nextjs';
import { redirect } from 'next/navigation';
import { GuestButton } from '@/components/auth/GuestButton';

// DevLens is invite-only: public sign-up stays off unless explicitly enabled.
// Also enable "Restricted" sign-up mode in the Clerk dashboard — this page
// redirect only hides the UI, Clerk's setting is what actually blocks sign-ups.
const SIGN_UP_ENABLED = process.env.NEXT_PUBLIC_ALLOW_SIGN_UP === 'true';

export default function SignUpPage() {
  if (!SIGN_UP_ENABLED) redirect('/sign-in');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, width: '100%', maxWidth: 400 }}>
      <SignUp signInUrl="/sign-in" fallbackRedirectUrl="/dashboard" />

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', maxWidth: 360 }}>
        <span style={{ flex: 1, height: 1, background: 'var(--border, #2a2a2a)' }} />
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted, #8a8a8a)' }}>or</span>
        <span style={{ flex: 1, height: 1, background: 'var(--border, #2a2a2a)' }} />
      </div>

      <div style={{ width: '100%', maxWidth: 360 }}>
        <GuestButton />
      </div>
    </div>
  );
}
