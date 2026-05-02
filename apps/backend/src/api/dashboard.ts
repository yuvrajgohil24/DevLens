import { Request, Response } from 'express';
import prisma from '../db/prisma';

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
    ] = await Promise.all([
      prisma.deployment.count(),
      prisma.deployment.count({ where: { status: { in: ['running', 'pending'] } } }),
      prisma.vulnerability.count({ where: { isResolved: false } }),
      prisma.vulnerability.count({ where: { severity: 'critical', isResolved: false } }),
      prisma.policyViolation.count({ where: { isResolved: false } }),
      prisma.service.count(),
      prisma.riskScore.findMany({
        distinct: ['serviceId'],
        orderBy: { calculatedAt: 'desc' },
        select: { score: true },
      }),
      prisma.deployment.findMany({
        take: 5,
        orderBy: { triggeredAt: 'desc' },
        include: {
          service: { select: { name: true } },
          riskScores: { orderBy: { calculatedAt: 'desc' }, take: 1 },
          _count: { select: { vulnerabilities: true } },
        },
      }),
    ]);

    const avgRiskScore =
      latestRiskScores.length > 0
        ? latestRiskScores.reduce((sum, r) => sum + Number(r.score), 0) / latestRiskScores.length
        : 0;

    return res.json({
      totalDeployments,
      activeDeployments,
      openCVEs,
      criticalCVEs,
      openViolations,
      servicesCount,
      avgRiskScore: Math.round(avgRiskScore * 10) / 10,
      recentDeployments,
    });
  } catch (err) {
    console.error('Dashboard overview error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
