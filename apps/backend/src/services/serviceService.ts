import prisma from '../db/prisma';
import { isAllowedRepoUrl, parseGitHubRepoUrl, REPO_NAME_REGEX } from '../utils/validation';

/**
 * Returns the service with this name, creating it if needed. `name` is unique,
 * so concurrent webhooks for a new service can't create duplicates: the upsert
 * is atomic, and if two creates still race, the loser re-reads the winner's row.
 * A missing repoUrl/language is filled in from later events.
 */
export async function getOrCreateService(name: string, repoUrl?: string, language?: string) {
  let service;
  try {
    service = await prisma.service.upsert({
      where: { name },
      create: { name, repoUrl: repoUrl ?? null, language: language ?? null },
      update: {},
    });
  } catch (err) {
    if ((err as { code?: string }).code !== 'P2002') throw err; // unique violation from a concurrent create
    service = await prisma.service.findUniqueOrThrow({ where: { name } });
  }

  if ((repoUrl && !service.repoUrl) || (language && !service.language)) {
    service = await prisma.service.update({
      where: { id: service.id },
      data: {
        ...(repoUrl && !service.repoUrl && { repoUrl }),
        ...(language && !service.language && { language }),
      },
    });
  }

  return service;
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

/**
 * Maps a DevFlow :repoId to the GitHub repository it refers to.
 *
 *   1. A DevLens service with that name and a saved (allowed) GitHub repoUrl →
 *      that repo. E.g. service "devlens-backend-main" → repo "DevLens".
 *   2. Otherwise the id is taken as a repo name owned by GITHUB_OWNER (this is
 *      what the DevFlow UI sends, from the GitHub repo list).
 *
 * Returns null for ids that are neither — never a different, default repo.
 */
export async function resolveGitHubRepo(repoId: string): Promise<string | null> {
  const service = await prisma.service.findUnique({ where: { name: repoId }, select: { repoUrl: true } });
  if (service?.repoUrl && isAllowedRepoUrl(service.repoUrl)) {
    return parseGitHubRepoUrl(service.repoUrl)!.repo;
  }
  return REPO_NAME_REGEX.test(repoId) ? repoId : null;
}
