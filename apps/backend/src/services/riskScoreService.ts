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
  const [vulnGroups, secretCount] = await Promise.all([
    prisma.vulnerability.groupBy({
      by: ['severity'],
      where: { deploymentId, isResolved: false },
      _count: { id: true },
    }),
    prisma.secret.count({
      where: { deploymentId },
    })
  ]);

  const get = (sev: string) => vulnGroups.find((g) => g.severity === sev)?._count.id ?? 0;

  const criticalCount = get('critical');
  const highCount = get('high');
  const mediumCount = get('medium');
  const lowCount = get('low');
  
  // Total issues (CVEs + Secrets)
  const total = criticalCount + highCount + mediumCount + lowCount + secretCount;

  let score = 0;
  if (total > 0) {
    // Secrets are treated as Critical (4 points)
    const weighted = (criticalCount + secretCount) * 4 + highCount * 2 + mediumCount * 1 + lowCount * 0.25;
    score = Math.min(10, (weighted / total) * 2.5);
  }

  score = Math.round(score * 10) / 10;

  const riskScore = await prisma.riskScore.create({
    data: { serviceId, deploymentId, score, criticalCount: criticalCount + secretCount, highCount, mediumCount, lowCount },
  });

  console.log(
    `📊 Risk score [deployment: ${deploymentId.slice(0, 8)}]: ${score} ` +
      `(C:${criticalCount} S:${secretCount} H:${highCount} M:${mediumCount} L:${lowCount})`
  );

  return riskScore;
}
