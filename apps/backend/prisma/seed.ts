import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SERVICES = [
  { name: 'auth-api', language: 'Node.js', repoUrl: 'https://github.com/devlens/auth-api' },
  { name: 'payment-service', language: 'Go', repoUrl: 'https://github.com/devlens/payment-service' },
  { name: 'user-service', language: 'Python', repoUrl: 'https://github.com/devlens/user-service' },
  { name: 'api-gateway', language: 'Node.js', repoUrl: 'https://github.com/devlens/api-gateway' },
  { name: 'notification-service', language: 'Node.js', repoUrl: 'https://github.com/devlens/notification-service' },
];

const VULNERABILITY_TEMPLATES = [
  { cveId: 'CVE-2024-21626', title: 'runc: container breakout via fd leak', severity: 'critical', cvssScore: 8.6, affectedPackage: 'runc@1.1.11', fixedVersion: '1.1.12' },
  { cveId: 'CVE-2023-44487', title: 'HTTP/2 Rapid Reset DoS attack', severity: 'high', cvssScore: 7.5, affectedPackage: 'golang.org/x/net@0.14.0', fixedVersion: '0.17.0' },
  { cveId: 'CVE-2023-52425', title: 'libexpat: XML_ResumeParser DoS', severity: 'high', cvssScore: 7.5, affectedPackage: 'libexpat@2.5.0', fixedVersion: '2.6.0' },
  { cveId: 'CVE-2023-4911', title: 'glibc: Looney Tunables privilege escalation', severity: 'high', cvssScore: 7.8, affectedPackage: 'glibc@2.38', fixedVersion: '2.38-r1' },
  { cveId: 'CVE-2024-0727', title: 'OpenSSL: PKCS12 denial of service', severity: 'medium', cvssScore: 5.5, affectedPackage: 'openssl@3.1.4', fixedVersion: '3.1.5' },
  { cveId: 'CVE-2023-5752', title: 'pip: Mercurial config injection', severity: 'medium', cvssScore: 5.5, affectedPackage: 'pip@23.0.1', fixedVersion: '23.3' },
  { cveId: 'CVE-2023-40217', title: 'Python ssl.SSLSocket TLS bypass', severity: 'medium', cvssScore: 5.3, affectedPackage: 'python3@3.11.4', fixedVersion: '3.11.5' },
  { cveId: 'CVE-2024-24795', title: 'Apache httpd HTTP Response Splitting', severity: 'medium', cvssScore: 6.1, affectedPackage: 'apache2@2.4.57', fixedVersion: '2.4.59' },
  { cveId: 'CVE-2023-29659', title: 'libpng: null pointer dereference', severity: 'low', cvssScore: 3.3, affectedPackage: 'libpng@1.6.39', fixedVersion: '1.6.40' },
  { cveId: 'CVE-2022-41409', title: 'PCRE2: integer overflow DoS', severity: 'low', cvssScore: 2.5, affectedPackage: 'pcre2@10.40', fixedVersion: '10.42' },
];

function randomSha(): string {
  return Math.random().toString(16).slice(2, 10) + Math.random().toString(16).slice(2, 10);
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 3600 * 1000);
}

function calcScore(c: number, h: number, m: number, l: number): number {
  const total = c + h + m + l;
  if (total === 0) return 0;
  const w = c * 4 + h * 2 + m * 1 + l * 0.25;
  return Math.min(10, Math.round((w / total) * 2.5 * 10) / 10);
}

async function main() {
  console.log('🌱 Seeding DevLens database...');

  // Clear existing data
  await prisma.policyViolation.deleteMany();
  await prisma.riskScore.deleteMany();
  await prisma.vulnerability.deleteMany();
  await prisma.scan.deleteMany();
  await prisma.deployment.deleteMany();
  await prisma.service.deleteMany();
  console.log('🗑  Cleared existing data');

  for (const svcData of SERVICES) {
    const service = await prisma.service.create({ data: svcData });
    console.log(`  ✅ Service: ${service.name}`);

    // Create 4 deployments per service at different times
    const depConfigs = [
      { daysAgo: 1, env: 'production', status: 'success', branch: 'main', vulnCount: 6 },
      { daysAgo: 3, env: 'staging', status: 'success', branch: 'develop', vulnCount: 8 },
      { daysAgo: 7, env: 'production', status: 'success', branch: 'main', vulnCount: 10 },
      { daysAgo: 14, env: 'staging', status: 'failed', branch: 'feature/new-auth', vulnCount: 4 },
    ];

    for (const cfg of depConfigs) {
      const sha = randomSha();
      const triggeredAt = daysAgo(cfg.daysAgo);
      const completedAt = new Date(triggeredAt.getTime() + 3 * 60 * 1000);

      const deployment = await prisma.deployment.create({
        data: {
          serviceId: service.id,
          commitSha: sha,
          commitMessage: `deploy: ${cfg.branch} to ${cfg.env}`,
          branch: cfg.branch,
          author: ['yuvraj.singh', 'alice.dev', 'bob.ops'][Math.floor(Math.random() * 3)],
          status: cfg.status,
          environment: cfg.env,
          triggeredAt,
          completedAt,
          pipelineUrl: `https://github.com/devlens/${service.name}/actions/runs/${Math.floor(Math.random() * 9999999)}`,
        },
      });

      // Create scan
      const scan = await prisma.scan.create({
        data: {
          deploymentId: deployment.id,
          scannerType: 'trivy',
          status: 'completed',
          startedAt: triggeredAt,
          completedAt,
          rawOutput: { mock: true } as never,
        },
      });

      // Add vulnerabilities (subset of templates)
      const vulnSubset = VULNERABILITY_TEMPLATES.slice(0, cfg.vulnCount);
      for (const v of vulnSubset) {
        await prisma.vulnerability.create({
          data: {
            scanId: scan.id,
            deploymentId: deployment.id,
            serviceId: service.id,
            cveId: v.cveId,
            title: v.title,
            severity: v.severity,
            cvssScore: v.cvssScore,
            affectedPackage: v.affectedPackage,
            fixedVersion: v.fixedVersion,
            scannerSource: 'trivy',
            isResolved: Math.random() > 0.7,
            detectedAt: triggeredAt,
          },
        });
      }

      // Calculate and store risk score
      const severityCounts = vulnSubset.reduce(
        (acc, v) => { acc[v.severity] = (acc[v.severity] || 0) + 1; return acc; },
        {} as Record<string, number>
      );
      const c = severityCounts['critical'] || 0;
      const h = severityCounts['high'] || 0;
      const m = severityCounts['medium'] || 0;
      const l = severityCounts['low'] || 0;

      await prisma.riskScore.create({
        data: {
          serviceId: service.id,
          deploymentId: deployment.id,
          score: calcScore(c, h, m, l),
          criticalCount: c,
          highCount: h,
          mediumCount: m,
          lowCount: l,
          calculatedAt: completedAt,
        },
      });
    }

    // Add policy violations to some services
    if (['auth-api', 'api-gateway'].includes(service.name)) {
      const dep = await prisma.deployment.findFirst({ where: { serviceId: service.id } });
      if (dep) {
        await prisma.policyViolation.createMany({
          data: [
            {
              deploymentId: dep.id,
              serviceId: service.id,
              violationType: 'secret_detected',
              severity: 'critical',
              detail: 'Hardcoded API key detected in environment variables: STRIPE_SECRET_KEY',
              isResolved: false,
              detectedAt: daysAgo(1),
            },
            {
              deploymentId: dep.id,
              serviceId: service.id,
              violationType: 'unsigned_image',
              severity: 'high',
              detail: 'Docker image is not signed with Cosign — cannot verify image integrity',
              isResolved: false,
              detectedAt: daysAgo(2),
            },
          ],
        });
      }
    }
  }

  const count = await prisma.deployment.count();
  const vulnCount = await prisma.vulnerability.count();
  const riskCount = await prisma.riskScore.count();
  console.log(`\n✅ Seed complete:`);
  console.log(`   Services: ${SERVICES.length}`);
  console.log(`   Deployments: ${count}`);
  console.log(`   Vulnerabilities: ${vulnCount}`);
  console.log(`   Risk scores: ${riskCount}`);
}

main()
  .catch((e) => { console.error('Seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
