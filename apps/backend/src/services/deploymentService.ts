import prisma from '../db/prisma';

interface CreateDeploymentInput {
  serviceId: string;
  commitSha: string;
  commitMessage?: string;
  branch?: string;
  author?: string;
  status: string;
  environment?: string;
  pipelineUrl?: string;
}

export async function createDeployment(input: CreateDeploymentInput) {
  return prisma.deployment.create({ data: input });
}

export async function updateDeploymentStatus(
  id: string,
  status: string,
  completedAt?: Date
) {
  return prisma.deployment.update({
    where: { id },
    data: { status, completedAt: completedAt ?? undefined },
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
      scans: {
        include: {
          vulnerabilities: true,
        },
        orderBy: { startedAt: 'desc' },
      },
      vulnerabilities: { orderBy: { severity: 'asc' } },
      riskScores: { orderBy: { calculatedAt: 'desc' }, take: 1 },
      policyViolations: true,
    },
  });
}
