'use client';

interface StatusBadgeProps { status: string; }

const STATUS_MAP: Record<string, { color: string; bg: string; border: string; dot: string }> = {
  success:   { color: 'var(--success)',  bg: 'var(--success-bg)',  border: 'rgba(52,211,153,0.3)',  dot: 'var(--success)' },
  failed:    { color: 'var(--critical)', bg: 'var(--critical-bg)', border: 'rgba(248,113,113,0.3)', dot: 'var(--critical)' },
  running:   { color: 'var(--primary)',  bg: 'var(--primary-glow)', border: 'rgba(129,140,248,0.3)', dot: 'var(--primary)' },
  pending:   { color: 'var(--medium)',   bg: 'var(--medium-bg)',   border: 'rgba(251,191,36,0.3)',  dot: 'var(--medium)' },
  completed: { color: 'var(--success)',  bg: 'var(--success-bg)',  border: 'rgba(52,211,153,0.3)',  dot: 'var(--success)' },
  queued:    { color: 'var(--text-secondary)', bg: 'rgba(255,255,255,0.06)', border: 'var(--border)', dot: 'var(--text-muted)' },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const cfg = STATUS_MAP[status] ?? STATUS_MAP.queued;
  const isPulsing = status === 'running' || status === 'pending';

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
      borderRadius: 999, padding: '3px 9px',
      fontSize: '0.72rem', fontWeight: 600, textTransform: 'capitalize',
      whiteSpace: 'nowrap',
    }}>
      <span
        className={isPulsing ? 'pulse-dot' : ''}
        style={{ width: 5, height: 5, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }}
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
      background: cfg.bg, color: cfg.color,
      borderRadius: 4, padding: '2px 8px',
      fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
    }}>
      {severity}
    </span>
  );
}
