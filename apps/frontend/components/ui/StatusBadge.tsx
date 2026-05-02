'use client';

interface StatusBadgeProps { status: string; }

const STATUS_MAP: Record<string, { color: string; bg: string; border: string; dot: string }> = {
  success:   { color: 'var(--success)',  bg: 'var(--success-bg)',  border: 'rgba(16,185,129,0.3)',  dot: 'var(--success)' },
  failed:    { color: 'var(--critical)', bg: 'var(--critical-bg)', border: 'rgba(239,68,68,0.3)', dot: 'var(--critical)' },
  running:   { color: 'var(--primary)',  bg: 'var(--primary-glow)', border: 'rgba(59,130,246,0.3)', dot: 'var(--primary)' },
  pending:   { color: 'var(--medium)',   bg: 'var(--medium-bg)',   border: 'rgba(234,179,8,0.3)',  dot: 'var(--medium)' },
  completed: { color: 'var(--success)',  bg: 'var(--success-bg)',  border: 'rgba(16,185,129,0.3)',  dot: 'var(--success)' },
  queued:    { color: 'var(--text-secondary)', bg: 'rgba(255,255,255,0.06)', border: 'var(--border)', dot: 'var(--text-muted)' },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const cfg = STATUS_MAP[status] ?? STATUS_MAP.queued;
  const isPulsing = status === 'running' || status === 'pending';

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: 'transparent', color: cfg.color, border: `1px solid ${cfg.color}50`,
      borderRadius: 2, padding: '2px 8px',
      fontSize: '0.7rem', fontWeight: 500, textTransform: 'uppercase',
      fontFamily: 'var(--font-mono)',
      whiteSpace: 'nowrap',
      letterSpacing: '0.05em',
    }}>
      <span
        style={{ width: 4, height: 4, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }}
      />
      {status}
    </span>
  );
}

interface SeverityBadgeProps { severity: string; }

const SEV_MAP: Record<string, { color: string; bg: string }> = {
  critical: { color: 'var(--critical)', bg: 'var(--critical-bg)' },
  high:     { color: 'var(--high)',     bg: 'var(--high-bg)' },
  medium:   { color: 'var(--medium)',   bg: 'var(--medium-bg)' },
  low:      { color: 'var(--low)',      bg: 'var(--low-bg)' },
};

export function SeverityBadge({ severity }: SeverityBadgeProps) {
  const cfg = SEV_MAP[severity.toLowerCase()] ?? { color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.05)' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      background: 'transparent', color: cfg.color,
      border: `1px solid ${cfg.color}50`,
      borderRadius: 2, padding: '1px 6px',
      fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em',
      fontFamily: 'var(--font-mono)',
    }}>
      {severity}
    </span>
  );
}
