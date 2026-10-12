import { Request, Response } from 'express';
import prisma from '../db/prisma';

export async function getRiskTrends(req: Request, res: Response) {
  try {
    const { serviceId } = req.query;
    
    const whereClause = serviceId ? { serviceId: String(serviceId) } : {};
    
    // Fetch last 30 risk scores across the system or specific service
    const riskScores = await prisma.riskScore.findMany({
      where: whereClause,
      orderBy: { calculatedAt: 'asc' },
      take: 30,
      include: {
        service: { select: { name: true } },
      }
    });

    // Format for Recharts
    const data = riskScores.map(rs => ({
      date: rs.calculatedAt.toISOString().split('T')[0],
      score: Number(rs.score),
      service: rs.service.name,
      critical: rs.criticalCount,
      high: rs.highCount,
    }));

    return res.json({ data });
  } catch (err) {
    console.error('Failed to get risk trends:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

const MTTR_MONTHS = 6;
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Mean time to remediate: average hours between detectedAt and resolvedAt for
 * vulnerabilities resolved in each of the last MTTR_MONTHS calendar months.
 */
export function computeMttr(
  resolved: Array<{ detectedAt: Date; resolvedAt: Date | null }>,
  now = new Date()
) {
  const buckets = new Map<string, { label: string; totalHours: number; count: number }>();
  for (let i = MTTR_MONTHS - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    buckets.set(`${d.getUTCFullYear()}-${d.getUTCMonth()}`, { label: MONTH_LABELS[d.getUTCMonth()], totalHours: 0, count: 0 });
  }

  for (const v of resolved) {
    if (!v.resolvedAt) continue;
    const bucket = buckets.get(`${v.resolvedAt.getUTCFullYear()}-${v.resolvedAt.getUTCMonth()}`);
    if (!bucket) continue;
    bucket.totalHours += Math.max(0, v.resolvedAt.getTime() - v.detectedAt.getTime()) / 3600_000;
    bucket.count += 1;
  }

  const round1 = (n: number) => Math.round(n * 10) / 10;
  const data = [...buckets.values()]
    .filter((b) => b.count > 0)
    .map((b) => ({ month: b.label, mttrHours: round1(b.totalHours / b.count) }));

  const current = data.length > 0 ? data[data.length - 1].mttrHours : 0;
  const previous = data.length > 1 ? data[data.length - 2].mttrHours : 0;
  const trend = previous > 0 ? round1(((current - previous) / previous) * 100) : 0;

  return { data, current, unit: 'hours', trend };
}

export async function getMttr(_req: Request, res: Response) {
  try {
    const now = new Date();
    const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (MTTR_MONTHS - 1), 1));
    const resolved = await prisma.vulnerability.findMany({
      where: { isResolved: true, resolvedAt: { gte: since } },
      select: { detectedAt: true, resolvedAt: true },
    });

    return res.json(computeMttr(resolved, now));
  } catch (err) {
    console.error('Failed to get MTTR:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
