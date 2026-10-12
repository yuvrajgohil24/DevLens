/**
 * Risk score (0.0 – 10.0) for a set of open findings.
 *
 *   W     = critical×10 + secrets×10 + high×4 + medium×1 + low×0.25
 *   score = 10 × (1 − e^(−W/10)), then floored by the worst finding:
 *           any critical/secret → ≥ 7.0, any high → ≥ 4.0, any medium → ≥ 1.0
 *
 * Properties:
 *   - Monotonic: adding a finding never lowers the score (the old average-based
 *     formula scored 1 critical + 50 lows *lower* than 1 critical alone).
 *   - Saturating: approaches 10 as findings pile up, never exceeds it.
 *
 * Examples: 1 critical → 7.0 · 2 critical → 8.6 · 1 high → 4.0 · 10 high → 9.8
 *           1 critical + 50 low → 8.9 · 0 findings → 0.0
 */
export interface SeverityCounts {
  critical: number;
  high: number;
  medium: number;
  low: number;
  secrets?: number;
}

const WEIGHTS = { critical: 10, high: 4, medium: 1, low: 0.25 };

export function computeRiskScore({ critical, high, medium, low, secrets = 0 }: SeverityCounts): number {
  const weighted =
    (critical + secrets) * WEIGHTS.critical + high * WEIGHTS.high + medium * WEIGHTS.medium + low * WEIGHTS.low;
  if (weighted <= 0) return 0;

  let score = 10 * (1 - Math.exp(-weighted / 10));
  if (critical + secrets > 0) score = Math.max(score, 7);
  else if (high > 0) score = Math.max(score, 4);
  else if (medium > 0) score = Math.max(score, 1);

  return Math.min(10, Math.round(score * 10) / 10);
}
