import { Request, Response } from 'express';
import { z } from 'zod';
import { getOrCreateService } from '../services/serviceService';
import {
  createDeployment,
  findDeploymentForCommit,
  applyDeploymentStatus,
  combineDeploymentStatus,
} from '../services/deploymentService';
import { scanQueue } from '../db/redis';
import { wsEvents } from '../websocket/index';
import { branchSchema, commitShaSchema, repoUrlSchema } from '../utils/validation';

export const PipelinePayloadSchema = z.object({
  commit_sha: commitShaSchema,
  service_name: z.string().regex(/^[A-Za-z0-9._\/-]{1,100}$/, 'Invalid service_name'),
  branch: branchSchema.optional().default('main'),
  author: z.string().max(100).optional().default('unknown'),
  status: z.enum(['pending', 'running', 'success', 'failed']).default('running'),
  environment: z.enum(['staging', 'production']).default('staging'),
  pipeline_url: z.string().url().startsWith('https://').optional(),
  commit_message: z.string().max(1000).optional(),
  language: z.string().max(50).optional(),
  repo_url: repoUrlSchema.optional(),
});

export async function handlePipelineWebhook(req: Request, res: Response) {
  try {
    // 1. Validate payload
    const parseResult = PipelinePayloadSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid payload', details: parseResult.error.flatten() });
    }

    const {
      commit_sha,
      service_name,
      branch,
      author,
      status,
      environment,
      pipeline_url,
      commit_message,
      language,
      repo_url,
    } = parseResult.data;

    // 2. Upsert service
    const service = await getOrCreateService(service_name, repo_url, language);
    console.log(`📦 Service: ${service.name} (${service.id.slice(0, 8)})`);

    // 3. CI sends several events per run (running → success/failed). Later events
    //    update the existing deployment instead of creating (and scanning) a duplicate.
    const existing = await findDeploymentForCommit(service.id, commit_sha, environment);
    if (existing) {
      const updated = await applyDeploymentStatus(
        existing.id,
        { ciStatus: status },
        { pipelineUrl: pipeline_url, commitMessage: commit_message }
      );
      console.log(`🔁 CI status '${status}' recorded for deployment ${existing.id.slice(0, 8)} → ${updated.status}`);
      try {
        wsEvents.deploymentUpdated({ deploymentId: updated.id, status: updated.status });
      } catch {
        // WebSocket might not be ready in tests — non-fatal
      }
      return res.status(200).json({
        received: true,
        deployment_id: updated.id,
        service_id: service.id,
        duplicate: true,
        message: `CI status updated for ${service_name}`,
      });
    }

    // 4. First event for this commit: create the deployment and enqueue a scan
    const deployment = await createDeployment({
      serviceId: service.id,
      commitSha: commit_sha,
      commitMessage: commit_message,
      branch,
      author,
      ciStatus: status,
      scanStatus: 'queued',
      status: combineDeploymentStatus(status, 'queued'),
      environment,
      pipelineUrl: pipeline_url,
    });
    console.log(`🚀 Deployment created: ${deployment.id.slice(0, 8)} [${environment}]`);

    // Later CI events may omit repo_url — fall back to the URL stored on the service
    const scanRepoUrl = repo_url ?? service.repoUrl ?? undefined;
    await scanQueue.add(
      'trivy-scan',
      {
        deployment_id: deployment.id,
        service_id: service.id,
        service_name,
        repo_url: scanRepoUrl,
        image_name: `${service_name}:${commit_sha.slice(0, 7)}`,
        commit_sha,
        branch,
        author,
        environment,
        pipeline_url,
      },
      { jobId: deployment.id } // BullMQ ignores a second job with the same id
    );
    console.log(`📋 Scan enqueued for deployment ${deployment.id.slice(0, 8)}`);

    // 5. Notify frontend via WebSocket
    try {
      wsEvents.deploymentCreated({
        deploymentId: deployment.id,
        serviceName: service.name,
        status: deployment.status,
      });
    } catch {
      // WebSocket might not be ready in tests — non-fatal
    }

    return res.status(201).json({
      received: true,
      deployment_id: deployment.id,
      service_id: service.id,
      message: `Deployment recorded and scan enqueued for ${service_name}`,
    });
  } catch (err) {
    console.error('Webhook handler error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
