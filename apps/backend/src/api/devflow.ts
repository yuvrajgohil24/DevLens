import { Request, Response } from 'express';
import prisma from '../db/prisma';
import { scanQueue } from '../db/redis';
import { getOrCreateService } from '../services/serviceService';
import { createDeployment } from '../services/deploymentService';
import { wsEvents } from '../websocket/index';

// GET /api/devflow/repos/:repoId/branches
export async function getBranches(req: Request, res: Response) {
  // Phase 1: Return simulated branch data
  const { repoId } = req.params;
  return res.json({
    data: [
      { name: 'main', sha: 'a1b2c3d4e5f6', isDefault: true, updatedAt: new Date().toISOString() },
      { name: 'develop', sha: 'b2c3d4e5f6a1', isDefault: false, updatedAt: new Date(Date.now() - 3600000).toISOString() },
      { name: 'feature/auth-refresh', sha: 'c3d4e5f6a1b2', isDefault: false, updatedAt: new Date(Date.now() - 7200000).toISOString() },
      { name: 'fix/payment-race', sha: 'd4e5f6a1b2c3', isDefault: false, updatedAt: new Date(Date.now() - 86400000).toISOString() },
    ],
    repo: repoId,
  });
}

// GET /api/devflow/repos/:repoId/commits
export async function getCommits(req: Request, res: Response) {
  const { repoId } = req.params;
  const { branch = 'main' } = req.query;

  const commits = Array.from({ length: 10 }, (_, i) => ({
    sha: Math.random().toString(16).slice(2, 10),
    message: [
      'feat: add JWT refresh token rotation',
      'fix: resolve race condition in payment processor',
      'chore: update dependencies to latest',
      'feat: implement rate limiting middleware',
      'fix: correct CORS headers for mobile clients',
      'refactor: extract auth service to separate module',
      'feat: add request tracing with correlation IDs',
      'fix: handle null pointer in user lookup',
      'chore: add health check endpoint',
      'feat: implement circuit breaker pattern',
    ][i],
    author: ['yuvraj.singh', 'alice.dev', 'bob.ops', 'carol.infra'][i % 4],
    date: new Date(Date.now() - i * 3600000 * 6).toISOString(),
    branch,
  }));

  return res.json({ data: commits, repo: repoId, branch });
}

// POST /api/devflow/repos/:repoId/deploy
export async function triggerDeploy(req: Request, res: Response) {
  try {
    const { repoId } = req.params;
    const { branch = 'main', environment = 'staging', commit_sha } = req.body;

    const simulatedSha = commit_sha || Math.random().toString(16).slice(2, 10) + Math.random().toString(16).slice(2, 10);

    // Create the service + deployment records (same as webhook)
    const service = await getOrCreateService(repoId);
    const deployment = await createDeployment({
      serviceId: service.id,
      commitSha: simulatedSha,
      commitMessage: `Manual deploy from DevFlow UI (branch: ${branch})`,
      branch,
      author: 'devflow-ui',
      status: 'running',
      environment,
      pipelineUrl: `https://github.com/placeholder/actions/runs/simulated`,
    });

    // Enqueue scan
    await scanQueue.add('trivy-scan', {
      deployment_id: deployment.id,
      service_id: service.id,
      service_name: repoId,
      image_name: `${repoId}:${simulatedSha.slice(0, 7)}`,
    });

    try {
      wsEvents.deploymentCreated({ deploymentId: deployment.id, serviceName: service.name, status: 'running' });
    } catch { /* non-fatal */ }

    return res.status(201).json({
      success: true,
      deployment_id: deployment.id,
      commit_sha: simulatedSha,
      message: `Deployment triggered for ${repoId}@${branch} → ${environment}`,
    });
  } catch (err) {
    console.error('Deploy trigger error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// GET /api/devflow/deployments/:id/status
export async function getDeploymentStatus(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const deployment = await prisma.deployment.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        triggeredAt: true,
        completedAt: true,
        riskScores: { orderBy: { calculatedAt: 'desc' }, take: 1 },
        _count: { select: { vulnerabilities: true } },
      },
    });
    if (!deployment) return res.status(404).json({ error: 'Deployment not found' });
    return res.json(deployment);
  } catch (err) {
    console.error('Deployment status error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
