/**
 * Applies database migrations safely on startup (replaces `prisma db push --accept-data-loss`).
 *
 * Databases created by the old `db push` start command have tables but no
 * `_prisma_migrations` history. For those, the baseline migration (0_init) is
 * marked as already applied first, so `migrate deploy` only runs the newer,
 * idempotent migrations instead of trying to re-create existing tables.
 *
 * Usage: node dist/scripts/migrate.js   (or: npm run db:deploy)
 */
import 'dotenv/config';
import { execFileSync } from 'child_process';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const BASELINE_MIGRATION = '0_init';
const SCHEMA = path.resolve(__dirname, '../../prisma/schema.prisma');
const PRISMA_CLI = require.resolve('prisma/build/index.js');

function prisma(...args: string[]) {
  execFileSync(process.execPath, [PRISMA_CLI, ...args, `--schema=${SCHEMA}`], { stdio: 'inherit' });
}

async function needsBaseline(): Promise<boolean> {
  const client = new PrismaClient();
  try {
    // Unqualified names resolve via search_path, i.e. the schema from DATABASE_URL (default: public)
    const [row] = await client.$queryRaw<Array<{ has_history: boolean; has_tables: boolean }>>`
      SELECT
        to_regclass('_prisma_migrations') IS NOT NULL AS has_history,
        to_regclass('deployments') IS NOT NULL AS has_tables`;
    return !row.has_history && row.has_tables;
  } finally {
    await client.$disconnect();
  }
}

async function main() {
  if (await needsBaseline()) {
    console.log(`📦 Existing database without migration history — baselining ${BASELINE_MIGRATION}`);
    prisma('migrate', 'resolve', '--applied', BASELINE_MIGRATION);
  }
  prisma('migrate', 'deploy');
  console.log('✅ Database migrations up to date');
}

main().catch((err) => {
  console.error('❌ Database migration failed:', err);
  process.exit(1);
});
