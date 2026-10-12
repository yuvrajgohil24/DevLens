/**
 * Severity is stored as a string, which sorts alphabetically
 * (critical, high, LOW, medium). `severityRank` is a numeric shadow column used
 * for ordering: higher = more severe, 0 = unknown.
 */
export const SEVERITY_RANK: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

export function severityRank(severity?: string | null): number {
  return (severity && SEVERITY_RANK[severity.toLowerCase()]) || 0;
}

/** Most severe first — use this instead of ordering by `severity`. */
export const BY_SEVERITY = { severityRank: 'desc' } as const;
