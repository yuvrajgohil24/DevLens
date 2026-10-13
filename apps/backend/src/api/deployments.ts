import { Request, Response } from 'express';
import { getDeployments, getDeploymentById } from '../services/deploymentService';
import { sendError } from '../utils/httpErrors';
import { z } from 'zod';
import { deploymentStatusParam, environmentParam, idParam, limitParam, offsetParam, parseIdParam, parseQuery } from '../utils/query';

const ListDeploymentsQuery = z.object({
  service: idParam.optional(),
  env: environmentParam.optional(),
  status: deploymentStatusParam.optional(),
  limit: limitParam(50),
  offset: offsetParam,
});

export async function listDeployments(req: Request, res: Response) {
  const query = parseQuery(ListDeploymentsQuery, req, res);
  if (!query) return;
  try {
    const deployments = await getDeployments({
      serviceId: query.service,
      environment: query.env,
      status: query.status,
      limit: query.limit,
      offset: query.offset,
    });
    return res.json({ data: deployments, count: deployments.length });
  } catch (err) {
    return sendError(res, err, 'List deployments error');
  }
}

export async function getDeployment(req: Request, res: Response) {
  const id = parseIdParam(req, res);
  if (!id) return;
  try {
    const deployment = await getDeploymentById(id);
    if (!deployment) return res.status(404).json({ error: 'Deployment not found' });
    return res.json(deployment);
  } catch (err) {
    return sendError(res, err, 'Get deployment error');
  }
}
