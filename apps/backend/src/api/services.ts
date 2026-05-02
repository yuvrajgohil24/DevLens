import { Request, Response } from 'express';
import { getAllServices, getServiceById } from '../services/serviceService';
import prisma from '../db/prisma';

export async function listServices(_req: Request, res: Response) {
  try {
    const services = await getAllServices();

    // Attach latest risk score + open CVE count to each service
    const enriched = await Promise.all(
      services.map(async (svc) => {
        const latestRisk = await prisma.riskScore.findFirst({
          where: { serviceId: svc.id },
          orderBy: { calculatedAt: 'desc' },
        });
        const openCVEs = await prisma.vulnerability.count({
          where: { serviceId: svc.id, isResolved: false },
        });
        return { ...svc, latestRiskScore: latestRisk?.score ?? 0, openCVEs };
      })
    );

    return res.json({ data: enriched });
  } catch (err) {
    console.error('List services error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getService(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const service = await getServiceById(id);
    if (!service) return res.status(404).json({ error: 'Service not found' });
    return res.json(service);
  } catch (err) {
    console.error('Get service error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getServiceRiskHistory(req: Request, res: Response) {
  try {
    const { id } = req.params;
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
    console.error('Risk history error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
