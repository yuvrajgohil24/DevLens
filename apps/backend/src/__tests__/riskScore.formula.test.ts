/**
 * Unit tests for the pure risk score formula (computeRiskScore).
 */

import { computeRiskScore } from '../utils/riskScore';

const counts = (critical = 0, high = 0, medium = 0, low = 0, secrets = 0) => ({ critical, high, medium, low, secrets });

describe('computeRiskScore', () => {
  it('is 0 with no findings', () => {
    expect(computeRiskScore(counts())).toBe(0);
  });

  it('matches the documented examples', () => {
    expect(computeRiskScore(counts(1))).toBe(7);
    expect(computeRiskScore(counts(2))).toBe(8.6);
    expect(computeRiskScore(counts(0, 1))).toBe(4);
    expect(computeRiskScore(counts(0, 10))).toBe(9.8);
    expect(computeRiskScore(counts(1, 0, 0, 50))).toBe(8.9);
  });

  it('never decreases when findings are added (old formula did)', () => {
    // Old average-based formula: 1 critical = 10.0, but 1 critical + 50 low = 0.4
    expect(computeRiskScore(counts(1, 0, 0, 50))).toBeGreaterThanOrEqual(computeRiskScore(counts(1)));

    // Add one finding at a time (cycling severities) — score must never drop
    const c = counts();
    let previous = 0;
    const order = ['low', 'low', 'medium', 'low', 'high', 'medium', 'critical', 'secrets'] as const;
    for (let i = 0; i < 80; i++) {
      c[order[i % order.length]] += 1;
      const score = computeRiskScore(c);
      expect(score).toBeGreaterThanOrEqual(previous);
      previous = score;
    }
  });

  it('ranks any critical above any amount of lows', () => {
    expect(computeRiskScore(counts(1))).toBeGreaterThan(computeRiskScore(counts(0, 0, 0, 20)));
  });

  it('treats a leaked secret like a critical', () => {
    expect(computeRiskScore(counts(0, 0, 0, 0, 1))).toBe(computeRiskScore(counts(1)));
  });

  it('never exceeds 10', () => {
    expect(computeRiskScore(counts(100, 100, 100, 100, 100))).toBe(10);
  });
});
