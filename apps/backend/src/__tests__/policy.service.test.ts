/**
 * Unit tests for the deployment policy engine.
 */

const createMany = jest.fn();
jest.mock('../db/prisma', () => ({ __esModule: true, default: { policyViolation: { createMany } } }));

import { evaluatePolicy, recordPolicyViolations } from '../services/policyService';

describe('evaluatePolicy', () => {
  it('passes when there are no critical CVEs or secrets', () => {
    const result = evaluatePolicy([{ cveId: 'CVE-1', severity: 'high' }], []);
    expect(result).toEqual({ passed: true, violations: [], reason: '' });
  });

  it('creates a critical_cve violation listing the CVEs', () => {
    const result = evaluatePolicy(
      [
        { cveId: 'CVE-2024-21626', severity: 'critical', affectedPackage: 'runc@1.1.11' },
        { cveId: 'CVE-2', severity: 'low' },
      ],
      []
    );
    expect(result.passed).toBe(false);
    expect(result.violations).toEqual([
      { violationType: 'critical_cve', severity: 'critical', detail: '1 critical CVE(s): CVE-2024-21626 in runc@1.1.11' },
    ]);
    expect(result.reason).toBe('Deployment blocked: 1 critical CVE(s) detected.');
  });

  it('reports BOTH rules when both are broken (old code only reported the first)', () => {
    const result = evaluatePolicy(
      [{ cveId: 'CVE-1', severity: 'critical' }],
      [{ type: 'AWS', file: '.env', line: 3 }]
    );
    expect(result.violations.map((v) => v.violationType)).toEqual(['critical_cve', 'secret_detected']);
    expect(result.violations[1].detail).toBe('1 leaked secret(s): AWS in .env:3');
    expect(result.reason).toBe('Deployment blocked: 1 critical CVE(s) and 1 leaked secret(s) detected.');
  });

  it('truncates long lists and de-duplicates entries', () => {
    const vulns = Array.from({ length: 8 }, (_, i) => ({ cveId: `CVE-${i}`, severity: 'critical' }));
    vulns.push({ cveId: 'CVE-0', severity: 'critical' });
    const { violations } = evaluatePolicy(vulns, []);
    expect(violations[0].detail).toBe('9 critical CVE(s): CVE-0, CVE-1, CVE-2, CVE-3, CVE-4 (+3 more)');
  });
});

describe('recordPolicyViolations', () => {
  beforeEach(() => createMany.mockReset());

  it('stores violations against the deployment and service', async () => {
    const { violations } = evaluatePolicy([], [{ type: 'GitHub', file: null, line: null }]);
    await recordPolicyViolations('dep-1', 'svc-1', violations);
    expect(createMany).toHaveBeenCalledWith({
      data: [
        {
          violationType: 'secret_detected',
          severity: 'critical',
          detail: '1 leaked secret(s): GitHub',
          deploymentId: 'dep-1',
          serviceId: 'svc-1',
        },
      ],
    });
  });

  it('does nothing when the policy passed', async () => {
    await recordPolicyViolations('dep-1', 'svc-1', []);
    expect(createMany).not.toHaveBeenCalled();
  });
});
