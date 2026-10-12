/**
 * Unit tests for the mock-scanner policy: sample data must be flagged, and
 * must not be used at all when MOCK_SCANNERS=false / NODE_ENV=production.
 */

// Simulate "scanner binary not installed" so tests never run a real scan
jest.mock('child_process', () => ({
  exec: (_cmd: string, _opts: unknown, cb: (err: Error) => void) => cb(Object.assign(new Error('command not found'), { stderr: 'not found' })),
}));

import { mockScannersAllowed } from '../scanners/mock';
import { runTrivy } from '../scanners/trivy';
import { runSnyk } from '../scanners/snyk';

describe('mock scanner policy', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.MOCK_SCANNERS;
    delete process.env.SNYK_TOKEN;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('allows mocks by default outside production', () => {
    process.env.NODE_ENV = 'development';
    expect(mockScannersAllowed()).toBe(true);
  });

  it('disallows mocks by default in production', () => {
    process.env.NODE_ENV = 'production';
    expect(mockScannersAllowed()).toBe(false);
  });

  it('lets MOCK_SCANNERS override the default', () => {
    process.env.NODE_ENV = 'production';
    process.env.MOCK_SCANNERS = 'true';
    expect(mockScannersAllowed()).toBe(true);
    process.env.NODE_ENV = 'development';
    process.env.MOCK_SCANNERS = 'false';
    expect(mockScannersAllowed()).toBe(false);
  });

  it('flags Trivy fallback data as mock when allowed', async () => {
    process.env.MOCK_SCANNERS = 'true';
    const result = await runTrivy('/tmp/repo');
    expect(result.isMock).toBe(true);
    expect((result.output as { Results: unknown[] }).Results).toHaveLength(1);
  });

  it('throws instead of returning mock Trivy data when mocks are disabled', async () => {
    process.env.MOCK_SCANNERS = 'false';
    await expect(runTrivy('/tmp/repo')).rejects.toThrow(/mock data is disabled/);
  });

  it('throws instead of mock Snyk data when the scan fails and mocks are disabled', async () => {
    process.env.MOCK_SCANNERS = 'false';
    process.env.SNYK_TOKEN = 'test-token';
    await expect(runSnyk('/tmp/repo')).rejects.toThrow(/mock data is disabled/);
  });

  it('skips Snyk (no mock) when there is no token and mocks are disabled', async () => {
    process.env.MOCK_SCANNERS = 'false';
    const result = await runSnyk(process.cwd());
    expect(result).toEqual({ output: null, isMock: false, skipped: true });
  });
});
