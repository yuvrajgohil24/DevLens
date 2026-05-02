import { Request, Response } from 'express';
import prisma from '../db/prisma';

export async function listPolicyViolations(req: Request, res: Response) {
  try {
    const { service, resolved, limit } = req.query;

    const violations = await prisma.policyViolation.findMany({
      where: {
        ...(service && { serviceId: service as string }),
        ...(resolved !== undefined && { isResolved: resolved === 'true' }),
      },
      include: {
        service: { select: { id: true, name: true } },
        deployment: { select: { id: true, commitSha: true, branch: true } },
      },
      orderBy: { detectedAt: 'desc' },
      take: limit ? parseInt(limit as string, 10) : 50,
    });

    return res.json({ data: violations, count: violations.length });
  } catch (err) {
    console.error('Policy violations error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function resolvePolicyViolation(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const violation = await prisma.policyViolation.update({
      where: { id },
      data: { isResolved: true },
    });
    return res.json(violation);
  } catch (err) {
    console.error('Resolve violation error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
