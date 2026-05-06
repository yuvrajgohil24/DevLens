import { Request, Response } from 'express';
import { z } from 'zod';
import { getOrCreateService } from '../services/serviceService';
import { createDeployment } from '../services/deploymentService';
import { scanQueue } from '../db/redis';
import { wsEvents } from '../websocket/index';

const PipelinePayloadSchema = z.object({
  commit_sha: z.string().min(7).max(40),
  service_name: z.string().min(1).max(100),
  branch: z.string().optional().default('main'),
  author: z.string().optional().default('unknown'),
  status: z.enum(['pending', 'running', 'success', 'failed']).default('running'),
  environment: z.enum(['staging', 'production']).default('staging'),
  pipeline_url: z.string().url().optional(),
  commit_message: z.string().optional(),
  language: z.string().optional(),
  repo_url: z.string().optional(),
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

    // 3. Create deployment record
    const deployment = await createDeployment({
      serviceId: service.id,
      commitSha: commit_sha,
      commitMessage: commit_message,
      branch,
      author,
      status,
      environment,
      pipelineUrl: pipeline_url,
    });
    console.log(`🚀 Deployment created: ${deployment.id.slice(0, 8)} [${environment}]`);

    // 4. Enqueue scan job
    await scanQueue.add('trivy-scan', {
      deployment_id: deployment.id,
      service_id: service.id,
      service_name,
      repo_url,
      image_name: `${service_name}:${commit_sha.slice(0, 7)}`,
      commit_sha,
      branch,
    });
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
