/**
 * Mock scanner data policy.
 *
 * When a scanner binary/token is unavailable, scanners can fall back to sample
 * data so the pipeline can be demoed locally. Such results are always flagged
 * `isMock` (stored on the Scan, shown in the UI) and never decide whether a
 * deployment passes or fails.
 *
 * MOCK_SCANNERS=true|false controls the fallback. If unset, mocks are allowed
 * everywhere except NODE_ENV=production, where a missing scanner fails the scan.
 */
export function mockScannersAllowed(): boolean {
  const setting = process.env.MOCK_SCANNERS;
  if (setting === 'true') return true;
  if (setting === 'false') return false;
  return process.env.NODE_ENV !== 'production';
}

export interface ScannerResult<T = unknown> {
  output: T;
  /** Sample data was returned because the real scanner was unavailable */
  isMock: boolean;
  /** The scanner is not configured (e.g. no SNYK_TOKEN) and did not run */
  skipped?: boolean;
}
