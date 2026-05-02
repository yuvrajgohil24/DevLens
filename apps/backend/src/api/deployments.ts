import { Request, Response } from 'express';
import { getDeployments, getDeploymentById } from '../services/deploymentService';

export async function listDeployments(req: Request, res: Response) {
  try {
    const { service, env, status, limit, offset } = req.query;
    const deployments = await getDeployments({
      serviceId: service as string | undefined,
      environment: env as string | undefined,
      status: status as string | undefined,
      limit: limit ? parseInt(limit as string, 10) : 50,
      offset: offset ? parseInt(offset as string, 10) : 0,
    });
    return res.json({ data: deployments, count: deployments.length });
  } catch (err) {
    console.error('List deployments error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getDeployment(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const deployment = await getDeploymentById(id);
    if (!deployment) return res.status(404).json({ error: 'Deployment not found' });
    return res.json(deployment);
  } catch (err) {
    console.error('Get deployment error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
