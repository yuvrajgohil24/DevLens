import { Request, Response } from 'express';
import prisma from '../db/prisma';

export async function listVulnerabilities(req: Request, res: Response) {
  try {
    const { severity, service, scanner, resolved, limit, offset } = req.query;

    const vulnerabilities = await prisma.vulnerability.findMany({
      where: {
        ...(severity && { severity: severity as string }),
        ...(service && { serviceId: service as string }),
        ...(scanner && { scannerSource: scanner as string }),
        ...(resolved !== undefined && { isResolved: resolved === 'true' }),
      },
      include: {
        service: { select: { id: true, name: true } },
        deployment: { select: { id: true, commitSha: true, branch: true, environment: true } },
      },
      orderBy: [{ severity: 'asc' }, { cvssScore: 'desc' }, { detectedAt: 'desc' }],
      take: limit ? parseInt(limit as string, 10) : 100,
      skip: offset ? parseInt(offset as string, 10) : 0,
    });

    const total = await prisma.vulnerability.count({
      where: {
        ...(severity && { severity: severity as string }),
        ...(service && { serviceId: service as string }),
        ...(scanner && { scannerSource: scanner as string }),
        ...(resolved !== undefined && { isResolved: resolved === 'true' }),
      },
    });

    return res.json({ data: vulnerabilities, total });
  } catch (err) {
    console.error('List vulnerabilities error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function resolveVulnerability(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const vuln = await prisma.vulnerability.update({
      where: { id },
      data: { isResolved: true },
    });
    return res.json(vuln);
  } catch (err) {
    console.error('Resolve vulnerability error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
