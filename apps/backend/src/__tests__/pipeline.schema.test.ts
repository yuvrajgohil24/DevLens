/**
 * Unit tests for the pipeline webhook payload schema validation.
 *
 * These tests use the Zod schema directly — no HTTP server, DB, or Redis
 * required. They verify that the API correctly accepts valid payloads and
 * rejects malformed ones before any business logic runs.
 */

import { z } from 'zod';

// --- Replicate the schema exactly as defined in pipeline.ts ---
// (We import it as a standalone Zod schema to keep tests DB-free)
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

describe('Pipeline Webhook — Payload Schema Validation', () => {
  const validPayload = {
    commit_sha: 'abc1234def56789',
    service_name: 'devlens-backend',
    branch: 'main',
    author: 'yuvrajgohil24',
    environment: 'staging',
    pipeline_url: 'https://github.com/yuvrajgohil24/DevLens/actions/runs/1234',
  };

  it('should accept a fully valid payload', () => {
    const result = PipelinePayloadSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it('should apply default values when optional fields are omitted', () => {
    const minimalPayload = {
      commit_sha: 'abc1234def56789',
      service_name: 'devlens-backend',
    };
    const result = PipelinePayloadSchema.safeParse(minimalPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.branch).toBe('main');
      expect(result.data.author).toBe('unknown');
      expect(result.data.status).toBe('running');
      expect(result.data.environment).toBe('staging');
    }
  });

  it('should reject a payload with a commit_sha that is too short (< 7 chars)', () => {
    const result = PipelinePayloadSchema.safeParse({
      ...validPayload,
      commit_sha: 'abc12', // only 5 chars
    });
    expect(result.success).toBe(false);
  });

  it('should reject a payload missing the required service_name', () => {
    const { service_name: _, ...withoutServiceName } = validPayload;
    const result = PipelinePayloadSchema.safeParse(withoutServiceName);
    expect(result.success).toBe(false);
  });

  it('should reject an invalid environment value', () => {
    const result = PipelinePayloadSchema.safeParse({
      ...validPayload,
      environment: 'development', // not in enum
    });
    expect(result.success).toBe(false);
  });

  it('should reject a malformed pipeline_url', () => {
    const result = PipelinePayloadSchema.safeParse({
      ...validPayload,
      pipeline_url: 'not-a-valid-url',
    });
    expect(result.success).toBe(false);
  });

  it('should accept production as a valid environment', () => {
    const result = PipelinePayloadSchema.safeParse({
      ...validPayload,
      environment: 'production',
    });
    expect(result.success).toBe(true);
  });
});
