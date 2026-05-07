import { Request, Response } from 'express';
import prisma from '../db/prisma';
import { scanQueue } from '../db/redis';
import { getOrCreateService } from '../services/serviceService';
import { createDeployment } from '../services/deploymentService';
import { wsEvents } from '../websocket/index';

// GET /api/devflow/repos
export async function getRepos(req: Request, res: Response) {
  if (process.env.GITHUB_TOKEN) {
    try {
      // Use /user/repos to get repos for the authenticated user, or /users/{owner}/repos if preferred.
      // /user/repos returns all repos the token has access to.
      const response = await fetch(`https://api.github.com/user/repos?per_page=100&sort=updated`, {
        headers: {
          'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'DevLens-Backend'
        }
      });

      if (response.ok) {
        const repos = (await response.json()) as any[];
        const uniqueNames = Array.from(new Set(repos.map((r: any) => r.name)));
        return res.json({ data: uniqueNames });
      } else {
        console.warn(`[GITHUB] Failed to fetch repos: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('[GITHUB] Error fetching repos:', error);
    }
  }

  // Fallback if no token or error
  return res.json({
    data: ['DevLens', 'auth-api', 'payment-service', 'user-service', 'api-gateway', 'notification-service'],
  });
}

// GET /api/devflow/repos/:repoId/branches
export async function getBranches(req: Request, res: Response) {
  const { repoId } = req.params;

  if (process.env.GITHUB_TOKEN) {
    try {
      const owner = process.env.GITHUB_OWNER || 'yuvrajgohil24';
      const targetRepo = repoId === 'DevLens' ? (process.env.GITHUB_REPO || 'DevLens') : repoId;

      const response = await fetch(`https://api.github.com/repos/${owner}/${targetRepo}/branches`, {
        headers: {
          'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'DevLens-Backend'
        }
      });

      if (response.ok) {
        const githubBranches = (await response.json()) as any[];
        
        const formattedBranches = githubBranches.map((b: any) => ({
          name: b.name,
          sha: b.commit.sha.slice(0, 7),
          isDefault: b.name === 'main' || b.name === 'master',
          updatedAt: new Date().toISOString(),
        }));

        return res.json({
          data: formattedBranches,
          repo: repoId,
        });
      } else {
        console.warn(`[GITHUB] Failed to fetch branches: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('[GITHUB] Error fetching real branches:', error);
    }
  }

  // Phase 1: Return simulated branch data
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

  if (process.env.GITHUB_TOKEN) {
    try {
      const owner = process.env.GITHUB_OWNER || 'yuvrajgohil24';
      const targetRepo = repoId === 'DevLens' ? (process.env.GITHUB_REPO || 'DevLens') : repoId;

      const response = await fetch(`https://api.github.com/repos/${owner}/${targetRepo}/commits?sha=${branch}&per_page=15`, {
        headers: {
          'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'DevLens-Backend'
        }
      });

      if (response.ok) {
        const githubCommits = (await response.json()) as any[];
        
        const formattedCommits = githubCommits.map((c: any) => ({
          sha: c.sha.slice(0, 8),
          message: c.commit.message.split('\n')[0],
          author: c.commit.author?.name || c.author?.login || 'unknown',
          date: c.commit.author?.date || new Date().toISOString(),
          branch,
        }));

        return res.json({ data: formattedCommits, repo: repoId, branch });
      } else {
        console.warn(`[GITHUB] Failed to fetch commits: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('[GITHUB] Error fetching real commits:', error);
    }
  }

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
    const { branch = 'main', environment = 'staging', commit_sha, commit_message } = req.body;

    const simulatedSha = commit_sha || Math.random().toString(16).slice(2, 10) + Math.random().toString(16).slice(2, 10);
    
    const owner = process.env.GITHUB_OWNER || 'yuvrajgohil24';
    const targetRepo = repoId === 'DevLens' ? (process.env.GITHUB_REPO || 'DevLens') : repoId;
    let repoUrl = `https://github.com/${owner}/${targetRepo}`;
    let pipelineUrl = `https://github.com/${owner}/${targetRepo}/actions`;

    // Create the service + deployment records (same as webhook)
    const service = await getOrCreateService(repoId, repoUrl);
    const deployment = await createDeployment({
      serviceId: service.id,
      commitSha: simulatedSha,
      commitMessage: commit_message || `Manual deploy: ${branch} → ${environment}`,
      branch,
      author: 'devflow-ui',
      status: 'running',
      environment,
      pipelineUrl,
    });

    let cloneUrl = repoUrl;
    if (process.env.GITHUB_TOKEN) {
      cloneUrl = `https://${process.env.GITHUB_TOKEN}@github.com/${owner}/${targetRepo}.git`;
    }

    // Enqueue scan
    await scanQueue.add('trivy-scan', {
      deployment_id: deployment.id,
      service_id: service.id,
      service_name: repoId,
      repo_url: cloneUrl,
      image_name: `${repoId}:${simulatedSha.slice(0, 7)}`,
      commit_sha: simulatedSha,
      branch,
      environment
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
