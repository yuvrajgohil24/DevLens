import prisma from '../db/prisma';
import { BY_SEVERITY } from '../utils/severity';

interface CreateDeploymentInput {
  serviceId: string;
  commitSha: string;
  commitMessage?: string;
  branch?: string;
  author?: string;
  status: string;
  ciStatus?: string;
  scanStatus?: string;
  environment?: string;
  pipelineUrl?: string;
}

export async function createDeployment(input: CreateDeploymentInput) {
  return prisma.deployment.create({ data: input });
}

const TERMINAL_STATUSES = new Set(['success', 'failed']);

/**
 * A deployment's overall status combines the CI build status (from webhooks)
 * with the security scan/policy outcome (from the worker):
 *   - either failed                  → failed
 *   - scan passed and CI passed/none → success
 *   - otherwise                      → pending (CI queued, scan not started) or running
 */
export function combineDeploymentStatus(ciStatus: string | null | undefined, scanStatus: string | null | undefined): string {
  if (ciStatus === 'failed' || scanStatus === 'failed') return 'failed';
  if (scanStatus === 'success' && (!ciStatus || ciStatus === 'success')) return 'success';
  if (ciStatus === 'pending' && (!scanStatus || scanStatus === 'queued')) return 'pending';
  return 'running';
}

/** Finds the existing deployment for a commit, so repeated CI webhooks update it instead of duplicating it. */
export async function findDeploymentForCommit(serviceId: string, commitSha: string, environment: string) {
  return prisma.deployment.findFirst({
    where: { serviceId, commitSha, environment },
    orderBy: { triggeredAt: 'desc' },
  });
}

/**
 * Updates the CI and/or scan status of a deployment and recomputes its overall
 * status. The row is locked for the read-modify-write so a CI webhook and the
 * scan worker finishing at the same time can't overwrite each other.
 */
export async function applyDeploymentStatus(
  id: string,
  patch: { ciStatus?: string; scanStatus?: string },
  extra: { pipelineUrl?: string; commitMessage?: string } = {}
) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM deployments WHERE id = ${id} FOR UPDATE`;
    const current = await tx.deployment.findUniqueOrThrow({ where: { id } });

    const ciStatus = patch.ciStatus ?? current.ciStatus;
    const scanStatus = patch.scanStatus ?? current.scanStatus;
    const status = combineDeploymentStatus(ciStatus, scanStatus);

    return tx.deployment.update({
      where: { id },
      data: {
        ciStatus,
        scanStatus,
        status,
        completedAt: TERMINAL_STATUSES.has(status) ? (current.completedAt ?? new Date()) : null,
        ...(extra.pipelineUrl && { pipelineUrl: extra.pipelineUrl }),
        ...(extra.commitMessage && !current.commitMessage && { commitMessage: extra.commitMessage }),
      },
    });
  });
}

export async function getDeployments(filters: {
  serviceId?: string;
  environment?: string;
  status?: string;
  limit?: number;
  offset?: number;
}) {
  const { serviceId, environment, status, limit = 50, offset = 0 } = filters;

  return prisma.deployment.findMany({
    where: {
      ...(serviceId && { serviceId }),
      ...(environment && { environment }),
      ...(status && { status }),
    },
    include: {
      service: { select: { id: true, name: true, language: true } },
      riskScores: { orderBy: { calculatedAt: 'desc' }, take: 1 },
      _count: { select: { vulnerabilities: true, scans: true } },
    },
    orderBy: { triggeredAt: 'desc' },
    take: limit,
    skip: offset,
  });
}

export async function getDeploymentById(id: string) {
  return prisma.deployment.findUnique({
    where: { id },
    include: {
      service: true,
      // Explicit selects: never return scan.rawOutput or secret.rawFinding to clients
      scans: {
        select: {
          id: true,
          scannerType: true,
          status: true,
          isMock: true,
          startedAt: true,
          completedAt: true,
          vulnerabilities: { orderBy: [BY_SEVERITY, { cvssScore: 'desc' }] },
          secrets: {
            select: {
              id: true,
              type: true,
              source: true,
              file: true,
              line: true,
              commitSha: true,
              isVerified: true,
              detectedAt: true,
            },
          },
        },
        orderBy: { startedAt: 'desc' },
      },
      vulnerabilities: { orderBy: [BY_SEVERITY, { cvssScore: 'desc' }] },
      riskScores: { orderBy: { calculatedAt: 'desc' }, take: 1 },
      policyViolations: true,
    },
  });
}
