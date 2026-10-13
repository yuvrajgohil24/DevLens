import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../db/prisma';
import { scanQueue } from '../db/redis';
import { getOrCreateService, resolveGitHubRepo } from '../services/serviceService';
import { createDeployment } from '../services/deploymentService';
import { wsEvents } from '../websocket/index';
import {
  getRepoBranches as ghGetBranches,
  getRepoCommits as ghGetCommits,
  getOwnerRepos,
} from '../services/githubService';
import { branchSchema, commitShaSchema, REPO_NAME_REGEX } from '../utils/validation';
import { localGitActionsEnabled } from '../middleware/roles';
import { parseIdParam } from '../utils/query';

const TriggerDeploySchema = z.object({
  branch: branchSchema.default('main'),
  environment: z.enum(['staging', 'production']).default('staging'),
  commit_sha: commitShaSchema.optional(),
  commit_message: z.string().max(1000).optional(),
});

/** Resolves :repoId to a GitHub repo name, or responds 400 and returns null. */
async function resolveRepoParam(req: Request, res: Response): Promise<string | null> {
  const { repoId } = req.params;
  const repoName = REPO_NAME_REGEX.test(repoId) ? await resolveGitHubRepo(repoId) : null;
  if (!repoName) {
    res.status(400).json({ error: 'Invalid repository id' });
    return null;
  }
  return repoName;
}

// GET /api/devflow/repos
export async function getRepos(_req: Request, res: Response) {
  try {
    if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_OWNER) {
      return res.status(503).json({ error: 'GitHub credentials not configured. Set GITHUB_TOKEN and GITHUB_OWNER in .env' });
    }
    const repos = await getOwnerRepos();
    return res.json({ data: repos });
  } catch (err) {
    return sendError(res, err, '[DevFlow] getRepos failed');
  }
}

// GET /api/devflow/repos/:repoId/branches
export async function getBranches(req: Request, res: Response) {
  const { repoId } = req.params;
  if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_OWNER) {
    return res.status(503).json({ error: 'GitHub credentials not configured.' });
  }
  const repoName = await resolveRepoParam(req, res);
  if (!repoName) return;
  try {
    logger.debug({ repo: `${process.env.GITHUB_OWNER}/${repoName}` }, 'DevFlow: fetching branches');
    const branches = await ghGetBranches(repoName);
    return res.json({ data: branches, repo: repoId, source: 'github' });
  } catch (err) {
    return sendError(res, err, '[DevFlow] getBranches failed');
  }
}

// GET /api/devflow/repos/:repoId/commits
export async function getCommits(req: Request, res: Response) {
  const { repoId } = req.params;
  const { branch = 'main' } = req.query;
  if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_OWNER) {
    return res.status(503).json({ error: 'GitHub credentials not configured.' });
  }
  const repoName = await resolveRepoParam(req, res);
  if (!repoName) return;
  if (!branchSchema.safeParse(branch).success) {
    return res.status(400).json({ error: 'Invalid branch name' });
  }
  try {
    logger.debug({ repo: `${process.env.GITHUB_OWNER}/${repoName}`, branch }, 'DevFlow: fetching commits');
    const commits = await ghGetCommits(repoName, String(branch));
    return res.json({ data: commits, repo: repoId, branch, source: 'github' });
  } catch (err) {
    return sendError(res, err, '[DevFlow] getCommits failed');
  }
}

// POST /api/devflow/repos/:repoId/deploy
export async function triggerDeploy(req: Request, res: Response) {
  try {
    const { repoId } = req.params;
    const repoName = await resolveRepoParam(req, res);
    if (!repoName) return;

    const parseResult = TriggerDeploySchema.safeParse(req.body ?? {});
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid payload', details: parseResult.error.flatten() });
    }
    const { branch, environment, commit_sha, commit_message } = parseResult.data;

    const owner = process.env.GITHUB_OWNER;
    if (!owner) {
      return res.status(503).json({ error: 'GitHub credentials not configured. Set GITHUB_TOKEN and GITHUB_OWNER.' });
    }

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
      scanStatus: 'queued', // manual deploys have no CI status — the scan decides the outcome
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
    }, { jobId: deployment.id });

    try {
      wsEvents.deploymentCreated({ deploymentId: deployment.id, serviceName: service.name, status: 'running' });
    } catch { /* non-fatal */ }

    logger.info({ repo: `${owner}/${repoName}`, branch, commitSha: finalSha, environment, deploymentId: deployment.id }, 'DevFlow: deploy triggered');

    return res.status(201).json({
      success: true,
      deployment_id: deployment.id,
      commit_sha: finalSha,
      message: `Deployment triggered for ${repoId}@${branch} → ${environment}`,
      github_url: `https://github.com/${owner}/${repoName}/commit/${finalSha}`,
    });
  } catch (err) {
    return sendError(res, err, 'Deploy trigger error');
  }
}

// GET /api/devflow/deployments/:id/status
export async function getDeploymentStatus(req: Request, res: Response) {
  const id = parseIdParam(req, res);
  if (!id) return;
  try {
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
    return sendError(res, err, 'Deployment status error');
  }
}

// ── Local Git Operations ──────────────────────────────────────────────────

import { getGitStatus, gitFetch, gitPull, gitPush } from '../services/gitService';
import { sendError } from '../utils/httpErrors';
import { logger } from '../utils/logger';

// GET /api/devflow/repos/:repoId/git/status
export async function getLocalGitStatus(req: Request, res: Response) {
  if (!localGitActionsEnabled()) {
    return res.json({ success: false, message: 'Local git features are disabled on this server (LOCAL_GIT_ACTIONS).' });
  }
  try {
    const repoName = await resolveRepoParam(req, res);
    if (!repoName) return;

    const status = await getGitStatus(repoName);
    return res.json({ success: true, data: status });
  } catch (err: any) {
    if (err.message && err.message.includes('Repository not found locally')) {
      // In cloud environments (Render, Railway), local git repos won't exist.
      // Return 200 instead of 500 to avoid scary frontend errors for a completely expected state.
      return res.json({ success: false, message: 'Local git features are disabled in cloud environments.' });
    }
    return sendError(res, err, `[DevFlow] Git status error for ${req.params.repoId}`);
  }
}

// POST /api/devflow/repos/:repoId/git/action
export async function executeGitAction(req: Request, res: Response) {
  if (!localGitActionsEnabled()) {
    return res.status(403).json({ error: 'Local git actions are disabled on this server. Set LOCAL_GIT_ACTIONS=true for local development only.' });
  }
  try {
    const { action } = req.body;
    const repoName = await resolveRepoParam(req, res);
    if (!repoName) return;

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
    return sendError(res, err, '[DevFlow] Git action error');
  }
}
