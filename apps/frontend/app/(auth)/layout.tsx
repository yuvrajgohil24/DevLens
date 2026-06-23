export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 28,
        padding: 24,
        background: 'var(--background, #0a0a0a)',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <h1
          style={{
            fontSize: '1.6rem',
            fontWeight: 800,
            letterSpacing: '-0.02em',
            color: 'var(--text-primary, #f5f5f5)',
            fontFamily: 'var(--font-heading, "Plus Jakarta Sans", sans-serif)',
          }}
        >
          DevLens
        </h1>
        <p style={{ marginTop: 4, fontSize: '0.82rem', color: 'var(--text-muted, #8a8a8a)' }}>
          Build with Confidence. Deploy with Security. Monitor in Real-time.
        </p>
      </div>
      {children}
    </div>
  );
}
