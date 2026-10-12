import prisma from '../db/prisma';

/**
 * Deployment guardrails. A deployment is blocked when its (real, non-mock)
 * scan results break any rule; each broken rule is stored as a PolicyViolation.
 *
 *   critical_cve     — any open CVE with severity "critical"
 *   secret_detected  — any leaked secret found in the git history
 */
export interface PolicyViolationInput {
  violationType: 'critical_cve' | 'secret_detected';
  severity: 'critical';
  detail: string;
}

export interface PolicyResult {
  passed: boolean;
  violations: PolicyViolationInput[];
  /** One-line summary for logs and alerts ('' when passed) */
  reason: string;
}

const MAX_LISTED = 5;

function list(items: string[]): string {
  const unique = [...new Set(items)];
  const shown = unique.slice(0, MAX_LISTED).join(', ');
  return unique.length > MAX_LISTED ? `${shown} (+${unique.length - MAX_LISTED} more)` : shown;
}

export function evaluatePolicy(
  vulns: Array<{ cveId: string; severity: string; affectedPackage?: string | null }>,
  secrets: Array<{ type: string; file: string | null; line: number | null }>
): PolicyResult {
  const violations: PolicyViolationInput[] = [];

  const criticals = vulns.filter((v) => v.severity === 'critical');
  if (criticals.length > 0) {
    violations.push({
      violationType: 'critical_cve',
      severity: 'critical',
      detail: `${criticals.length} critical CVE(s): ${list(criticals.map((v) => (v.affectedPackage ? `${v.cveId} in ${v.affectedPackage}` : v.cveId)))}`,
    });
  }

  if (secrets.length > 0) {
    violations.push({
      violationType: 'secret_detected',
      severity: 'critical',
      // Location only — never the secret value
      detail: `${secrets.length} leaked secret(s): ${list(
        secrets.map((s) => `${s.type}${s.file ? ` in ${s.file}${s.line ? `:${s.line}` : ''}` : ''}`)
      )}`,
    });
  }

  const reasons: string[] = [];
  if (criticals.length > 0) reasons.push(`${criticals.length} critical CVE(s)`);
  if (secrets.length > 0) reasons.push(`${secrets.length} leaked secret(s)`);

  return {
    passed: violations.length === 0,
    violations,
    reason: reasons.length > 0 ? `Deployment blocked: ${reasons.join(' and ')} detected.` : '',
  };
}

export async function recordPolicyViolations(deploymentId: string, serviceId: string, violations: PolicyViolationInput[]) {
  if (violations.length === 0) return;
  await prisma.policyViolation.createMany({
    data: violations.map((v) => ({ ...v, deploymentId, serviceId })),
  });
}
