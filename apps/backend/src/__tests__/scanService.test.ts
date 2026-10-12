/**
 * Unit tests for retry cleanup (clearScanResults).
 */

const mockPrisma = {
  vulnerability: { deleteMany: jest.fn(() => 'vulnerability.deleteMany') },
  secret: { deleteMany: jest.fn(() => 'secret.deleteMany') },
  riskScore: { deleteMany: jest.fn(() => 'riskScore.deleteMany') },
  policyViolation: { deleteMany: jest.fn(() => 'policyViolation.deleteMany') },
  scan: { deleteMany: jest.fn(() => 'scan.deleteMany') },
  $transaction: jest.fn(),
};
jest.mock('../db/prisma', () => ({ __esModule: true, default: mockPrisma }));

import { clearScanResults } from '../services/scanService';

describe('clearScanResults', () => {
  it('deletes every per-deployment scan artifact in one transaction, scans last', async () => {
    await clearScanResults('dep-1');

    for (const model of ['vulnerability', 'secret', 'riskScore', 'policyViolation', 'scan'] as const) {
      expect(mockPrisma[model].deleteMany).toHaveBeenCalledWith({ where: { deploymentId: 'dep-1' } });
    }
    expect(mockPrisma.$transaction).toHaveBeenCalledWith([
      'vulnerability.deleteMany',
      'secret.deleteMany',
      'riskScore.deleteMany',
      'policyViolation.deleteMany',
      'scan.deleteMany',
    ]);
  });
});
