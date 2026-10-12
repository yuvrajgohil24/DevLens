/**
 * Unit tests for the MTTR calculation (computeMttr).
 */

jest.mock('../db/prisma', () => ({ __esModule: true, default: {} }));

import { computeMttr } from '../api/analytics';

describe('computeMttr', () => {
  const now = new Date(Date.UTC(2026, 9, 15)); // 15 Oct 2026
  const vuln = (detected: string, hours: number) => {
    const detectedAt = new Date(detected);
    return { detectedAt, resolvedAt: new Date(detectedAt.getTime() + hours * 3600_000) };
  };

  it('returns an empty series when nothing was resolved', () => {
    expect(computeMttr([], now)).toEqual({ data: [], current: 0, unit: 'hours', trend: 0 });
  });

  it('averages remediation hours per month of resolution and computes the trend', () => {
    const result = computeMttr(
      [
        vuln('2026-09-02T00:00:00Z', 40),
        vuln('2026-09-10T00:00:00Z', 20), // Sep avg 30h
        vuln('2026-10-01T00:00:00Z', 15), // Oct avg 15h
      ],
      now
    );
    expect(result.data).toEqual([
      { month: 'Sep', mttrHours: 30 },
      { month: 'Oct', mttrHours: 15 },
    ]);
    expect(result.current).toBe(15);
    expect(result.trend).toBe(-50);
  });

  it('ignores vulnerabilities resolved outside the 6-month window or not resolved', () => {
    const result = computeMttr(
      [vuln('2025-01-01T00:00:00Z', 10), { detectedAt: new Date('2026-10-01'), resolvedAt: null }],
      now
    );
    expect(result.data).toEqual([]);
  });
});
