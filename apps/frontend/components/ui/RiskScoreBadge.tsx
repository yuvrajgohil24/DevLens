'use client';

interface RiskScoreBadgeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
}

function getColor(score: number) {
  if (score >= 8) return { color: 'var(--critical)', bg: 'var(--critical-bg)', border: 'rgba(239,68,68,0.3)' };
  if (score >= 6) return { color: 'var(--high)',     bg: 'var(--high-bg)',     border: 'rgba(249,115,22,0.3)' };
  if (score >= 4) return { color: 'var(--medium)',   bg: 'var(--medium-bg)',   border: 'rgba(234,179,8,0.3)' };
  return             { color: 'var(--low)',      bg: 'var(--low-bg)',      border: 'rgba(34,197,94,0.3)' };
}

function getLabel(score: number) {
  if (score >= 8) return 'Critical';
  if (score >= 6) return 'High';
  if (score >= 4) return 'Medium';
  return 'Low';
}

export function RiskScoreBadge({ score, size = 'md' }: RiskScoreBadgeProps) {
  const { color, bg, border } = getColor(score);
  const s = Number(score).toFixed(1);

  const paddings: Record<string, string> = { sm: '2px 7px', md: '4px 10px', lg: '6px 14px' };
  const fontSizes: Record<string, string> = { sm: '0.7rem', md: '0.8rem', lg: '0.9rem' };

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: bg, color, border: `1px solid ${color}40`,
      borderRadius: 2, padding: paddings[size],
      fontSize: fontSizes[size], fontWeight: 500,
      fontFamily: 'var(--font-mono)',
      whiteSpace: 'nowrap',
      textTransform: 'uppercase',
      letterSpacing: '0.02em',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
      {s} · {getLabel(score)}
    </span>
  );
}
