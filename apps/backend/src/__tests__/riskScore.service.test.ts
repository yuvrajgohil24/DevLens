/**
 * Unit tests for the risk score calculation logic.
 */

import { calculateRiskScore } from '../services/riskScoreService';
import prisma from '../db/prisma';

// Mock the Prisma client
jest.mock('../db/prisma', () => ({
  vulnerability: {
    groupBy: jest.fn(),
  },
  secret: {
    count: jest.fn(),
  },
  riskScore: {
    create: jest.fn(),
  },
}));

describe('Risk Score Service', () => {
  const deploymentId = 'deploy-123';
  const serviceId = 'service-123';

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock returns
    (prisma.riskScore.create as jest.Mock).mockImplementation(async (args) => args.data);
  });

  it('should calculate a score of 0 when there are no vulnerabilities and no secrets', async () => {
    (prisma.vulnerability.groupBy as jest.Mock).mockResolvedValue([]);
    (prisma.secret.count as jest.Mock).mockResolvedValue(0);

    const result = await calculateRiskScore(deploymentId, serviceId);

    expect(result.score).toBe(0);
    expect(result.criticalCount).toBe(0);
    expect(result.highCount).toBe(0);
  });

  it('should treat secrets as critical and calculate a high score', async () => {
    (prisma.vulnerability.groupBy as jest.Mock).mockResolvedValue([]);
    // 2 secrets -> W = 2*10 = 20 -> 10 * (1 - e^-2) = 8.65 -> 8.6
    (prisma.secret.count as jest.Mock).mockResolvedValue(2);

    const result = await calculateRiskScore(deploymentId, serviceId);

    expect(result.score).toBe(8.6);
    expect(result.criticalCount).toBe(2); 
  });

  it('should correctly calculate a mixed severity score', async () => {
    // 1 Critical, 2 High, 1 Medium, 0 Low
    (prisma.vulnerability.groupBy as jest.Mock).mockResolvedValue([
      { severity: 'critical', _count: { id: 1 } },
      { severity: 'high', _count: { id: 2 } },
      { severity: 'medium', _count: { id: 1 } },
    ]);
    (prisma.secret.count as jest.Mock).mockResolvedValue(0);

    // W = 1*10 + 2*4 + 1*1 = 19 -> 10 * (1 - e^-1.9) = 8.50 -> 8.5
    const result = await calculateRiskScore(deploymentId, serviceId);

    expect(result.score).toBe(8.5);
    expect(result.criticalCount).toBe(1);
    expect(result.highCount).toBe(2);
    expect(result.mediumCount).toBe(1);
  });

  it('should not exceed a maximum score of 10.0', async () => {
    // 10 Criticals
    (prisma.vulnerability.groupBy as jest.Mock).mockResolvedValue([
      { severity: 'critical', _count: { id: 10 } },
    ]);
    (prisma.secret.count as jest.Mock).mockResolvedValue(5);

    const result = await calculateRiskScore(deploymentId, serviceId);

    expect(result.score).toBe(10);
    expect(result.criticalCount).toBe(15);
  });
});
