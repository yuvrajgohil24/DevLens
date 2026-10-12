/**
 * Unit tests for combining CI build status with the security scan outcome.
 */

jest.mock('../db/prisma', () => ({ __esModule: true, default: {} }));

import { combineDeploymentStatus } from '../services/deploymentService';

describe('combineDeploymentStatus', () => {
  it.each([
    // [ciStatus, scanStatus, expected]
    ['running', 'queued', 'running'],
    ['pending', 'queued', 'pending'],
    ['pending', null, 'pending'],
    ['success', 'running', 'running'],   // build done, scan still running
    ['running', 'success', 'running'],   // scan done, build still running
    ['success', 'success', 'success'],
    [null, 'success', 'success'],        // manual DevFlow deploy: scan decides
    [null, 'running', 'running'],
    ['failed', 'success', 'failed'],     // CI failure is never overwritten by a passing scan
    ['success', 'failed', 'failed'],     // policy block
    ['failed', 'queued', 'failed'],
  ])('ci=%s scan=%s → %s', (ci, scan, expected) => {
    expect(combineDeploymentStatus(ci, scan)).toBe(expected);
  });
});
