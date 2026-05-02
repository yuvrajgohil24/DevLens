import prisma from '../db/prisma';

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

export async function completeScan(id: string, rawOutput: unknown) {
  return prisma.scan.update({
    where: { id },
    data: {
      status: 'completed',
      completedAt: new Date(),
      rawOutput: rawOutput as never,
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
  return prisma.vulnerability.createMany({ data: vulnerabilities });
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

