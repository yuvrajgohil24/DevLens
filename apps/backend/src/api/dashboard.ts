import { Request, Response } from 'express';
import prisma from '../db/prisma';
import { latestRiskScoreByService } from '../services/riskScoreQueries';
import { sendError } from '../utils/httpErrors';

export async function getOverview(_req: Request, res: Response) {
  try {
    const [
      totalDeployments,
      activeDeployments,
      openCVEs,
      criticalCVEs,
      openViolations,
      servicesCount,
      latestRiskScores,
      recentDeployments,
      detectedSecrets,
    ] = await Promise.all([
      prisma.deployment.count(),
      prisma.deployment.count({ where: { status: { in: ['running', 'pending'] } } }),
      prisma.vulnerability.count({ where: { isResolved: false } }),
      prisma.vulnerability.count({ where: { severity: 'critical', isResolved: false } }),
      prisma.policyViolation.count({ where: { isResolved: false } }),
      prisma.service.count(),
      latestRiskScoreByService(),
      prisma.deployment.findMany({
        take: 5,
        orderBy: { triggeredAt: 'desc' },
        include: {
          service: { select: { name: true } },
          riskScores: { orderBy: { calculatedAt: 'desc' }, take: 1 },
          _count: { select: { vulnerabilities: true } },
        },
      }),
      prisma.secret.count(),
    ]);

    const scores = [...latestRiskScores.values()];
    const avgRiskScore = scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;

    return res.json({
      totalDeployments,
      activeDeployments,
      openCVEs,
      criticalCVEs,
      detectedSecrets,
      openViolations,
      servicesCount,
      avgRiskScore: Math.round(avgRiskScore * 10) / 10,
      recentDeployments,
    });
  } catch (err) {
    return sendError(res, err, 'Dashboard overview error');
  }
}
