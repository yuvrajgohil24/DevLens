/**
 * One-off cleanup: removes plaintext secrets that older versions stored in the DB.
 *
 *   - secrets.raw_finding   → replaced with the sanitized allowlist (see sanitizeTruffleHogFinding)
 *   - scans.raw_output      → replaced with a finding count for completed TruffleHog scans
 *
 * Safe to run multiple times. Usage: npm run db:redact-secrets
 */
import 'dotenv/config';
import prisma from '../db/prisma';
import { sanitizeTruffleHogFinding } from '../scanners/truffleHog';

async function main() {
  const secrets = await prisma.secret.findMany({ select: { id: true, rawFinding: true } });
  for (const secret of secrets) {
    await prisma.secret.update({
      where: { id: secret.id },
      data: { rawFinding: sanitizeTruffleHogFinding(secret.rawFinding) as never },
    });
  }
  console.log(`✅ Redacted ${secrets.length} secret findings`);

  const scans = await prisma.scan.findMany({
    where: { scannerType: 'trufflehog', status: 'completed' },
    select: { id: true, _count: { select: { secrets: true } } },
  });
  for (const scan of scans) {
    await prisma.scan.update({
      where: { id: scan.id },
      data: { rawOutput: { findingCount: scan._count.secrets } as never },
    });
  }
  console.log(`✅ Redacted raw output of ${scans.length} TruffleHog scans`);
}

main()
  .catch((err) => {
    console.error('❌ Secret redaction failed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
