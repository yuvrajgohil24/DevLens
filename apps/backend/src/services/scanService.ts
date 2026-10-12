import prisma from '../db/prisma';
import { severityRank } from '../utils/severity';

export async function createScan(deploymentId: string, scannerType: string = 'trivy') {
  return prisma.scan.create({
    data: {
      deploymentId,
      scannerType,
      status: 'running',
      startedAt: new Date(),
    },
  });
}

export async function completeScan(id: string, rawOutput: unknown, isMock = false) {
  return prisma.scan.update({
    where: { id },
    data: {
      status: 'completed',
      completedAt: new Date(),
      rawOutput: rawOutput as never,
      isMock,
    },
  });
}

export async function skipScan(id: string, reason: string) {
  return prisma.scan.update({
    where: { id },
    data: {
      status: 'skipped',
      completedAt: new Date(),
      rawOutput: { skipped: reason } as never,
    },
  });
}

export async function failScan(id: string, error: string) {
  return prisma.scan.update({
    where: { id },
    data: {
      status: 'failed',
      completedAt: new Date(),
      rawOutput: { error } as never,
    },
  });
}

export async function insertVulnerabilities(
  vulnerabilities: Array<{
    scanId: string;
    deploymentId: string;
    serviceId: string;
    cveId?: string;
    title: string;
    severity?: string;
    cvssScore?: number | any;
    affectedPackage?: string;
    fixedVersion?: string | null;
    scannerSource?: string;
  }>
) {
  if (vulnerabilities.length === 0) return;
  return prisma.vulnerability.createMany({
    data: vulnerabilities.map((v) => ({ ...v, severityRank: severityRank(v.severity) })),
  });
}

export async function insertSecrets(
  secrets: Array<{
    scanId: string;
    deploymentId: string;
    serviceId: string;
    type: string;
    source: string;
    file?: string | null;
    line?: number | null;
    commitSha?: string | null;
    rawFinding?: any;
    isVerified?: boolean;
  }>
) {
  if (secrets.length === 0) return;
  return prisma.secret.createMany({ data: secrets });
}


/**
 * Removes all scan output for a deployment so a retried scan job starts clean
 * (otherwise retries leave duplicate risk scores and policy violations behind).
 */
export async function clearScanResults(deploymentId: string) {
  const where = { deploymentId };
  await prisma.$transaction([
    prisma.vulnerability.deleteMany({ where }),
    prisma.secret.deleteMany({ where }),
    prisma.riskScore.deleteMany({ where }),
    prisma.policyViolation.deleteMany({ where }),
    prisma.scan.deleteMany({ where }),
  ]);
}
