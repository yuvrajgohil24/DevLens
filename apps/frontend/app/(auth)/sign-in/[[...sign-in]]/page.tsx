import { SignIn } from '@clerk/nextjs';
import { GuestButton } from '@/components/auth/GuestButton';

export default function SignInPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, width: '100%', maxWidth: 400 }}>
      <SignIn signUpUrl="/sign-up" fallbackRedirectUrl="/dashboard" />

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
