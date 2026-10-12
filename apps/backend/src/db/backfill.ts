import prisma from './prisma';
import { SEVERITY_RANK } from '../utils/severity';

/**
 * Fills severityRank for rows created before the column existed. Idempotent and
 * cheap after the first run (only touches rows still at 0), so it runs on boot.
 */
export async function backfillSeverityRanks(): Promise<void> {
  let updated = 0;
  for (const [severity, rank] of Object.entries(SEVERITY_RANK)) {
    const result = await prisma.vulnerability.updateMany({
      where: { severity, severityRank: 0 },
      data: { severityRank: rank },
    });
    updated += result.count;
  }
  if (updated > 0) console.log(`✅ Backfilled severity rank for ${updated} vulnerabilities`);
}
