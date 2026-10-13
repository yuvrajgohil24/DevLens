import prisma from '../db/prisma';

/**
 * Latest risk score per service, in ONE query (Postgres DISTINCT ON, served by
 * the risk_scores(service_id, calculated_at) index). Prisma's `distinct` would
 * load every risk score row and de-duplicate in memory.
 */
export async function latestRiskScoreByService(): Promise<Map<string, number>> {
  const rows = await prisma.$queryRaw<Array<{ service_id: string; score: unknown }>>`
    SELECT DISTINCT ON (service_id) service_id, score
    FROM risk_scores
    ORDER BY service_id, calculated_at DESC`;
  return new Map(rows.map((r) => [r.service_id, Number(r.score)]));
}
