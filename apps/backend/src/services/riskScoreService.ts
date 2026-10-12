import prisma from '../db/prisma';
import { computeRiskScore } from '../utils/riskScore';

/**
 * Calculates and stores the risk score for a deployment's open, real (non-mock) findings.
 * See utils/riskScore.ts for the formula.
 */
export async function calculateRiskScore(deploymentId: string, serviceId: string) {
  const [vulnGroups, secretCount] = await Promise.all([
    prisma.vulnerability.groupBy({
      by: ['severity'],
      // Mock (sample) findings never count towards a real risk score
      where: { deploymentId, isResolved: false, scan: { isMock: false } },
      _count: { id: true },
    }),
    prisma.secret.count({
      where: { deploymentId, scan: { isMock: false } },
    })
  ]);

  const get = (sev: string) => vulnGroups.find((g) => g.severity === sev)?._count.id ?? 0;

  const criticalCount = get('critical');
  const highCount = get('high');
  const mediumCount = get('medium');
  const lowCount = get('low');
  
  const score = computeRiskScore({
    critical: criticalCount,
    high: highCount,
    medium: mediumCount,
    low: lowCount,
    secrets: secretCount,
  });

  const riskScore = await prisma.riskScore.create({
    data: { serviceId, deploymentId, score, criticalCount: criticalCount + secretCount, highCount, mediumCount, lowCount },
  });

  console.log(
    `📊 Risk score [deployment: ${deploymentId.slice(0, 8)}]: ${score} ` +
      `(C:${criticalCount} S:${secretCount} H:${highCount} M:${mediumCount} L:${lowCount})`
  );

  return riskScore;
}
