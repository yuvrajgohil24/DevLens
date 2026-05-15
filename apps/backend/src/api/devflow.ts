import { Request, Response } from 'express';
import prisma from '../db/prisma';
import { scanQueue } from '../db/redis';
import { getOrCreateService } from '../services/serviceService';
import { createDeployment } from '../services/deploymentService';
import { wsEvents } from '../websocket/index';
import {
  getRepoBranches as ghGetBranches,
  getRepoCommits as ghGetCommits,
  getOwnerRepos,
  resolveRepo,
} from '../services/githubService';

// GET /api/devflow/repos
export async function getRepos(_req: Request, res: Response) {
  try {
    if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_OWNER) {
      return res.status(503).json({ error: 'GitHub credentials not configured. Set GITHUB_TOKEN and GITHUB_OWNER in .env' });
    }
    const repos = await getOwnerRepos();
    return res.json({ data: repos });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('❌ [DevFlow] getRepos failed:', msg);
    return res.status(500).json({ error: msg });
  }
}

// GET /api/devflow/repos/:repoId/branches
export async function getBranches(req: Request, res: Response) {
  const { repoId } = req.params;
  if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_OWNER) {
    return res.status(503).json({ error: 'GitHub credentials not configured.' });
  }
  try {
    const repoName = resolveRepo(repoId);
    console.log(`🌿 [DevFlow] Fetching real branches for ${process.env.GITHUB_OWNER}/${repoName}`);
    const branches = await ghGetBranches(repoName);
    return res.json({ data: branches, repo: repoId, source: 'github' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('❌ [DevFlow] getBranches failed:', msg);
    return res.status(500).json({ error: msg });
  }
}

// GET /api/devflow/repos/:repoId/commits
export async function getCommits(req: Request, res: Response) {
  const { repoId } = req.params;
  const { branch = 'main' } = req.query;
  if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_OWNER) {
    return res.status(503).json({ error: 'GitHub credentials not configured.' });
  }
  try {
    const repoName = resolveRepo(repoId);
    console.log(`📝 [DevFlow] Fetching real commits for ${process.env.GITHUB_OWNER}/${repoName}@${branch}`);
    const commits = await ghGetCommits(repoName, String(branch));
    return res.json({ data: commits, repo: repoId, branch, source: 'github' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('❌ [DevFlow] getCommits failed:', msg);
    return res.status(500).json({ error: msg });
  }
}

// POST /api/devflow/repos/:repoId/deploy
export async function triggerDeploy(req: Request, res: Response) {
  try {
    const { repoId } = req.params;
    const { branch = 'main', environment = 'staging', commit_sha, commit_message } = req.body;

    const repoName = resolveRepo(repoId);
    const owner = process.env.GITHUB_OWNER || 'unknown';

    // Use provided SHA (from real commit list) or generate one for manual deploys
    const finalSha = commit_sha || Math.random().toString(16).slice(2, 10) + Math.random().toString(16).slice(2, 10);

    const service = await getOrCreateService(repoId, `https://github.com/${owner}/${repoName}`);
    const deployment = await createDeployment({
      serviceId: service.id,
      commitSha: finalSha,
      commitMessage: commit_message || `Manual deploy: ${branch} → ${environment}`,
      branch,
      author: 'devflow-ui',
      status: 'running',
      environment,
      pipelineUrl: `https://github.com/${owner}/${repoName}/commit/${finalSha}`,
    });

    // Enqueue security scan — pass repo_url so worker clones the remote repo
    await scanQueue.add('trivy-scan', {
      deployment_id: deployment.id,
      service_id: service.id,
      service_name: repoId,
      image_name: `${repoName}:${finalSha.slice(0, 7)}`,
      repo_url: `https://github.com/${owner}/${repoName}.git`,
      commit_sha: finalSha,
      branch,
      author: 'devflow-ui',
      environment,
      pipeline_url: `https://github.com/${owner}/${repoName}/commit/${finalSha}`,
    });

    try {
      wsEvents.deploymentCreated({ deploymentId: deployment.id, serviceName: service.name, status: 'running' });
    } catch { /* non-fatal */ }

    console.log(`🚀 [DevFlow] Deploy triggered: ${owner}/${repoName}@${branch} (${finalSha.slice(0, 7)}) → ${environment}`);

    return res.status(201).json({
      success: true,
      deployment_id: deployment.id,
      commit_sha: finalSha,
      message: `Deployment triggered for ${repoId}@${branch} → ${environment}`,
      github_url: `https://github.com/${owner}/${repoName}/commit/${finalSha}`,
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

// ── Local Git Operations ──────────────────────────────────────────────────

import { getGitStatus, gitFetch, gitPull, gitPush } from '../services/gitService';

// GET /api/devflow/repos/:repoId/git/status
export async function getLocalGitStatus(req: Request, res: Response) {
  try {
    const { repoId } = req.params;
    const repoName = resolveRepo(repoId);
    
    const status = await getGitStatus(repoName);
    return res.json({ success: true, data: status });
  } catch (err: any) {
    console.error(`❌ [DevFlow] Git status error for ${req.params.repoId}:`, err.message);
    return res.status(500).json({ error: err.message });
  }
}

// POST /api/devflow/repos/:repoId/git/action
export async function executeGitAction(req: Request, res: Response) {
  try {
    const { repoId } = req.params;
    const { action } = req.body;
    const repoName = resolveRepo(repoId);

    let result;
    switch (action) {
      case 'fetch':
        result = await gitFetch(repoName);
        break;
      case 'pull':
        result = await gitPull(repoName);
        break;
      case 'push':
        result = await gitPush(repoName);
        break;
      default:
        return res.status(400).json({ error: 'Invalid git action. Must be fetch, pull, or push.' });
    }

    if (!result.success) {
      return res.status(500).json({ error: result.error || 'Git command failed', output: result.output });
    }

    return res.json({ success: true, message: `Git ${action} successful`, output: result.output });
  } catch (err: any) {
    console.error(`❌ [DevFlow] Git action error:`, err.message);
    return res.status(500).json({ error: err.message });
  }
}
