import { Request, Response } from 'express';
import prisma from '../db/prisma';
import { sendError } from '../utils/httpErrors';
import { z } from 'zod';
import { booleanParam, idParam, limitParam, parseIdParam, parseQuery } from '../utils/query';

const ListPolicyViolationsQuery = z.object({
  service: idParam.optional(),
  resolved: booleanParam,
  limit: limitParam(50),
});

export async function listPolicyViolations(req: Request, res: Response) {
  const query = parseQuery(ListPolicyViolationsQuery, req, res);
  if (!query) return;
  const { service, resolved, limit } = query;

  try {
    const violations = await prisma.policyViolation.findMany({
      where: {
        ...(service && { serviceId: service }),
        ...(resolved !== undefined && { isResolved: resolved }),
      },
      include: {
        service: { select: { id: true, name: true } },
        deployment: { select: { id: true, commitSha: true, branch: true } },
      },
      orderBy: { detectedAt: 'desc' },
      take: limit,
    });

    return res.json({ data: violations, count: violations.length });
  } catch (err) {
    return sendError(res, err, 'Policy violations error');
  }
}

export async function resolvePolicyViolation(req: Request, res: Response) {
  const id = parseIdParam(req, res);
  if (!id) return;
  try {
    const violation = await prisma.policyViolation.update({
      where: { id },
      data: { isResolved: true },
    });
    return res.json(violation);
  } catch (err) {
    return sendError(res, err, 'Resolve violation error');
  }
}
