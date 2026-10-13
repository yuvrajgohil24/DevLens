'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2 } from 'lucide-react';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/$/, '');

/**
 * "Continue as Guest" — signs the visitor into the shared, read-only demo
 * account using a Clerk sign-in token (ticket) minted by the backend.
 *
 * The ticket flow creates a fully authenticated session and bypasses password
 * + MFA entirely, so it's immune to per-user second-factor state. No demo
 * password is ever shipped to the browser.
 */
export function GuestButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hovered, setHovered] = useState(false);

  // Poll until window.Clerk is available and loaded
  useEffect(() => {
    const check = () => {
      if ((window as any).Clerk?.loaded) {
        setReady(true);
      }
    };
    check(); // check immediately
    const interval = setInterval(check, 150);
    return () => clearInterval(interval);
  }, []);

  async function handleGuest() {
    const clerk = (window as any).Clerk;
    if (!clerk) {
      setError('Clerk not initialized yet. Please wait and try again.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // 1) Ask the backend to mint a short-lived Clerk sign-in token for the demo user.
      const resp = await fetch(`${API_BASE}/api/demo/session`, { method: 'POST' });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        setError(body.message || `Demo unavailable (HTTP ${resp.status}). Is the backend running?`);
        return;
      }
      const { token } = await resp.json();
      if (!token) {
        setError('Demo session token missing from server response.');
        return;
      }

      // 2) Consume the ticket — creates a complete session, bypassing password + MFA.
      const signIn = await clerk.client.signIn.create({ strategy: 'ticket', ticket: token });

      if (signIn.status === 'complete') {
        await clerk.setActive({ session: signIn.createdSessionId });
        router.push('/dashboard');
        return;
      }

      console.error('Guest sign-in did not complete. status =', signIn.status, signIn);
      setError(`Sign-in did not complete (status: ${signIn.status ?? 'unknown'}).`);
    } catch (err: unknown) {
      console.error('Guest sign-in error:', err);
      const msg = (err as any)?.errors?.[0]?.longMessage || (err as any)?.errors?.[0]?.message;
      setError(msg || 'Demo login failed — is the backend running? (see console)');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ width: '100%' }}>
      <button
        type="button"
        onClick={handleGuest}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        disabled={loading}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '11px 16px',
          borderRadius: 8,
          border: hovered 
            ? '1.5px solid rgba(251, 191, 36, 0.9)'
            : '1.5px solid rgba(251, 191, 36, 0.6)',
          background: hovered 
            ? 'rgba(251, 191, 36, 0.16)'
            : 'rgba(251, 191, 36, 0.08)',
          color: '#fbbf24',
          fontSize: '0.9rem',
          fontWeight: 600,
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.6 : 1,
          transition: 'all 0.2s ease',
          boxShadow: '0 0 12px rgba(251, 191, 36, 0.15)',
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          transform: hovered && !loading ? 'translateX(3px)' : 'none',
          transition: 'transform 0.2s ease',
        }}>
          {loading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <ArrowRight
              size={16}
              style={{
                transform: hovered ? 'translateX(3px)' : 'none',
                transition: 'transform 0.2s ease',
              }}
            />
          )}
          {loading ? 'Starting demo…' : !ready ? 'Loading…' : 'Continue as Guest'}
        </div>
      </button>
      <p style={{ marginTop: 8, fontSize: '0.72rem', color: 'var(--text-muted, #8a8a8a)', textAlign: 'center' }}>
        Read-only demo · no sign-up required
      </p>
      {error && (
        <p style={{ marginTop: 6, fontSize: '0.72rem', color: 'var(--danger, #f87171)', textAlign: 'center' }}>
          {error}
        </p>
      )}
    </div>
  );
}
