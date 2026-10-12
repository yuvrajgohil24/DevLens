/** Marks findings that came from sample data (scanner unavailable / seeded demo), not a real scan. */
export function MockBadge() {
  return (
    <span
      title="Sample data — the scanner was unavailable, so these are not real scan results"
      style={{
        fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.04em',
        padding: '1px 6px', borderRadius: 4,
        color: 'var(--warning, #f59e0b)', background: 'rgba(245,158,11,0.12)',
        border: '1px solid rgba(245,158,11,0.3)',
      }}
    >
      MOCK
    </span>
  );
}
