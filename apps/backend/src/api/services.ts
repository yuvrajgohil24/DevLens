import { Request, Response } from 'express';
import { getAllServices, getServiceById } from '../services/serviceService';
import prisma from '../db/prisma';
import { sendError } from '../utils/httpErrors';
import { parseIdParam } from '../utils/query';
import { latestRiskScoreByService } from '../services/riskScoreQueries';

export async function listServices(_req: Request, res: Response) {
  try {
    // 3 queries in total, however many services there are (was 1 + 2 per service)
    const [services, latestRisk, openCveGroups] = await Promise.all([
      getAllServices(),
      latestRiskScoreByService(),
      prisma.vulnerability.groupBy({
        by: ['serviceId'],
        where: { isResolved: false },
        _count: { id: true },
      }),
    ]);
    const openCves = new Map(openCveGroups.map((g) => [g.serviceId, g._count.id]));

    const enriched = services.map((svc) => ({
      ...svc,
      latestRiskScore: latestRisk.get(svc.id) ?? 0,
      openCVEs: openCves.get(svc.id) ?? 0,
    }));

    return res.json({ data: enriched });
  } catch (err) {
    return sendError(res, err, 'List services error');
  }
}

export async function getService(req: Request, res: Response) {
  const id = parseIdParam(req, res);
  if (!id) return;
  try {
    const service = await getServiceById(id);
    if (!service) return res.status(404).json({ error: 'Service not found' });
    return res.json(service);
  } catch (err) {
    return sendError(res, err, 'Get service error');
  }
}

export async function getServiceRiskHistory(req: Request, res: Response) {
  const id = parseIdParam(req, res);
  if (!id) return;
  try {
    const history = await prisma.riskScore.findMany({
      where: { serviceId: id },
      orderBy: { calculatedAt: 'asc' },
      take: 30,
      include: {
        deployment: { select: { commitSha: true, branch: true, triggeredAt: true } },
      },
    });
    return res.json({ data: history });
  } catch (err) {
    return sendError(res, err, 'Risk history error');
  }
}
