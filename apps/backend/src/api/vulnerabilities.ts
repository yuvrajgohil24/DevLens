import { Request, Response } from 'express';
import prisma from '../db/prisma';
import { BY_SEVERITY } from '../utils/severity';
import { sendError } from '../utils/httpErrors';
import { z } from 'zod';
import { booleanParam, idParam, limitParam, offsetParam, parseIdParam, parseQuery, scannerParam, severityParam } from '../utils/query';

const ListVulnerabilitiesQuery = z.object({
  severity: severityParam.optional(),
  service: idParam.optional(),
  scanner: scannerParam.optional(),
  resolved: booleanParam,
  limit: limitParam(100),
  offset: offsetParam,
});

export async function listVulnerabilities(req: Request, res: Response) {
  const query = parseQuery(ListVulnerabilitiesQuery, req, res);
  if (!query) return;
  const { severity, service, scanner, resolved, limit, offset } = query;

  try {
    const where = {
      ...(severity && { severity }),
      ...(service && { serviceId: service }),
      ...(scanner && { scannerSource: scanner }),
      ...(resolved !== undefined && { isResolved: resolved }),
    };

    const [vulnerabilities, total] = await Promise.all([
      prisma.vulnerability.findMany({
        where,
        include: {
          service: { select: { id: true, name: true } },
          deployment: { select: { id: true, commitSha: true, branch: true, environment: true } },
          scan: { select: { isMock: true } },
        },
        orderBy: [BY_SEVERITY, { cvssScore: 'desc' }, { detectedAt: 'desc' }],
        take: limit,
        skip: offset,
      }),
      prisma.vulnerability.count({ where }),
    ]);

    return res.json({ data: vulnerabilities, total });
  } catch (err) {
    return sendError(res, err, 'List vulnerabilities error');
  }
}

export async function resolveVulnerability(req: Request, res: Response) {
  const id = parseIdParam(req, res);
  if (!id) return;
  try {
    const vuln = await prisma.vulnerability.update({
      where: { id },
      data: { isResolved: true, resolvedAt: new Date() },
    });
    return res.json(vuln);
  } catch (err) {
    return sendError(res, err, 'Resolve vulnerability error');
  }
}
