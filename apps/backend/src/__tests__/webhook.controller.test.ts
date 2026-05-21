/**
 * Unit tests for the Webhook Controller logic.
 */

import { Request, Response } from 'express';
import { handlePipelineWebhook } from '../webhooks/pipeline';
import { getOrCreateService } from '../services/serviceService';
import { createDeployment } from '../services/deploymentService';
import { scanQueue } from '../db/redis';
import { wsEvents } from '../websocket/index';

// Mock dependencies
jest.mock('../services/serviceService');
jest.mock('../services/deploymentService');
jest.mock('../db/redis', () => ({
  scanQueue: {
    add: jest.fn(),
  },
}));
jest.mock('../websocket/index', () => ({
  wsEvents: {
    deploymentCreated: jest.fn(),
  },
}));

describe('handlePipelineWebhook', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    
    req = {
      body: {},
    };
    res = {
      status: statusMock,
    } as Partial<Response>;

    jest.clearAllMocks();

    (getOrCreateService as jest.Mock).mockResolvedValue({ id: 'service-123', name: 'devlens-test' });
    (createDeployment as jest.Mock).mockResolvedValue({ id: 'deploy-456', status: 'running' });
  });

  it('should return 400 for invalid payload', async () => {
    req.body = {
      // missing required fields
    };

    await handlePipelineWebhook(req as Request, res as Response);

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Invalid payload' })
    );
    expect(getOrCreateService).not.toHaveBeenCalled();
  });

  it('should process a valid payload and return 201', async () => {
    req.body = {
      commit_sha: 'abc1234def56789',
      service_name: 'devlens-test',
      branch: 'main',
      author: 'yuvraj',
      environment: 'production',
      pipeline_url: 'https://github.com/yuvrajgohil24/DevLens/actions/runs/1',
      repo_url: 'https://github.com/yuvrajgohil24/DevLens',
    };

    await handlePipelineWebhook(req as Request, res as Response);

    // 1. Validated and Upserted Service
    expect(getOrCreateService).toHaveBeenCalledWith('devlens-test', 'https://github.com/yuvrajgohil24/DevLens', undefined);
    
    // 2. Created Deployment
    expect(createDeployment).toHaveBeenCalledWith(expect.objectContaining({
      serviceId: 'service-123',
      commitSha: 'abc1234def56789',
      branch: 'main',
      environment: 'production',
    }));

    // 3. Enqueued Scan
    expect(scanQueue.add).toHaveBeenCalledWith('trivy-scan', expect.objectContaining({
      deployment_id: 'deploy-456',
      service_id: 'service-123',
      image_name: 'devlens-test:abc1234',
    }));

    // 4. Emitted WebSocket Event
    expect(wsEvents.deploymentCreated).toHaveBeenCalledWith({
      deploymentId: 'deploy-456',
      serviceName: 'devlens-test',
      status: 'running',
    });

    // 5. Response
    expect(statusMock).toHaveBeenCalledWith(201);
    expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
      received: true,
      deployment_id: 'deploy-456',
    }));
  });

  it('should return 500 if an internal error occurs during processing', async () => {
    req.body = {
      commit_sha: 'abc1234def56789',
      service_name: 'devlens-test',
    };

    // Force an error
    (getOrCreateService as jest.Mock).mockRejectedValue(new Error('Database connection failed'));

    await handlePipelineWebhook(req as Request, res as Response);

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith({ error: 'Internal server error' });
  });
});
