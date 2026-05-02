import prisma from '../db/prisma';

export async function upsertService(name: string, repoUrl?: string, language?: string) {
  return prisma.service.upsert({
    where: { name } as never, // prisma upsert by name (add @@unique in schema if needed — using findFirst pattern below)
    create: { name, repoUrl, language },
    update: { repoUrl: repoUrl ?? undefined, language: language ?? undefined },
  });
}

// Since name doesn't have @@unique constraint, use findFirst + create pattern
export async function getOrCreateService(name: string, repoUrl?: string, language?: string) {
  const existing = await prisma.service.findFirst({ where: { name } });
  if (existing) {
    return existing;
  }
  return prisma.service.create({
    data: { name, repoUrl: repoUrl ?? null, language: language ?? null },
  });
}

export async function getAllServices() {
  return prisma.service.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: { deployments: true, vulnerabilities: true },
      },
    },
  });
}

export async function getServiceById(id: string) {
  return prisma.service.findUnique({
    where: { id },
    include: {
      deployments: { orderBy: { triggeredAt: 'desc' }, take: 10 },
      riskScores: { orderBy: { calculatedAt: 'desc' }, take: 30 },
      _count: { select: { vulnerabilities: true } },
    },
  });
}
