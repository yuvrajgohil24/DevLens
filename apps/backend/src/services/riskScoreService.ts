import prisma from '../db/prisma';

/**
 * Weighted risk score formula:
 *   raw = (critical×4 + high×2 + medium×1 + low×0.25) / total
 *   score = min(10, raw × 2.5)
 *
 * Examples:
 *   5 critical only    → raw=4   → score=10.0
 *   10 high only       → raw=2   → score=5.0
 *   0 vulns            → score=0.0
 */
export async function calculateRiskScore(deploymentId: string, serviceId: string) {
  const groups = await prisma.vulnerability.groupBy({
    by: ['severity'],
    where: { deploymentId, isResolved: false },
    _count: { id: true },
  });

  const get = (sev: string) => groups.find((g) => g.severity === sev)?._count.id ?? 0;

  const criticalCount = get('critical');
  const highCount = get('high');
  const mediumCount = get('medium');
  const lowCount = get('low');
  const total = criticalCount + highCount + mediumCount + lowCount;

  let score = 0;
  if (total > 0) {
    const weighted = criticalCount * 4 + highCount * 2 + mediumCount * 1 + lowCount * 0.25;
    score = Math.min(10, (weighted / total) * 2.5);
  }

  score = Math.round(score * 10) / 10;

  const riskScore = await prisma.riskScore.create({
    data: { serviceId, deploymentId, score, criticalCount, highCount, mediumCount, lowCount },
  });

  console.log(
    `📊 Risk score [deployment: ${deploymentId.slice(0, 8)}]: ${score} ` +
      `(C:${criticalCount} H:${highCount} M:${mediumCount} L:${lowCount})`
  );

  return riskScore;
}
