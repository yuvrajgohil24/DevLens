import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SERVICES = [
  { name: 'auth-api', language: 'Node.js', repoUrl: 'https://github.com/devlens/auth-api' },
  { name: 'payment-service', language: 'Go', repoUrl: 'https://github.com/devlens/payment-service' },
  { name: 'user-service', language: 'Python', repoUrl: 'https://github.com/devlens/user-service' },
  { name: 'api-gateway', language: 'Node.js', repoUrl: 'https://github.com/devlens/api-gateway' },
  { name: 'notification-service', language: 'Node.js', repoUrl: 'https://github.com/devlens/notification-service' },
  { name: 'inventory-worker', language: 'Rust', repoUrl: 'https://github.com/devlens/inventory-worker' },
];

const REALISTIC_COMMITS = [
  'feat: implement mfa with totp support',
  'fix: postgres connection pool exhaustion under high load',
  'chore: update dependencies and patch security vulnerabilities',
  'refactor: migrate from Redux to TanStack Query for state management',
  'docs: update api reference for v1.2.0 release',
  'ci: add security scanning to pull request workflow',
  'security: patch critical buffer overflow in image processor',
  'feat: add role-based access control for admin dashboard',
  'fix: resolve race condition in vulnerability scanner worker',
  'perf: optimize database queries for analytics dashboard',
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

const AUTHORS = ['yuvrajgohil24', 'alice.dev', 'bob.ops', 'charlie.sec', 'diana.dev'];

function randomSha(): string {
  return Math.random().toString(16).slice(2, 10) + Math.random().toString(16).slice(2, 10);
}

function randomTimeInPast(hoursAgo: number): Date {
  const jitter = (Math.random() - 0.5) * 2 * 3600 * 1000; // +/- 1 hour
  return new Date(Date.now() - hoursAgo * 3600 * 1000 + jitter);
}

function calcScore(c: number, h: number, m: number, l: number): number {
  const total = c + h + m + l;
  if (total === 0) return 0;
  const w = c * 4 + h * 2 + m * 1 + l * 0.25;
  return Math.min(10, Math.round((w / total) * 2.5 * 10) / 10);
}

async function main() {
  console.log('🌱 Seeding DevLens database with REALISTIC data...');

  // Clear existing data in correct dependency order
  await prisma.secret.deleteMany();
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

    // Create 4-6 deployments per service at different times
    const numDeploys = 4 + Math.floor(Math.random() * 3);
    
    for (let i = 0; i < numDeploys; i++) {
      let sha = randomSha();
      let msg = REALISTIC_COMMITS[Math.floor(Math.random() * REALISTIC_COMMITS.length)];
      let hoursAgo = (i + 1) * 12 + Math.floor(Math.random() * 12); // Spread out every 12h-ish
      let author = AUTHORS[Math.floor(Math.random() * AUTHORS.length)];
      let branch = i === 0 ? 'main' : (Math.random() > 0.7 ? 'develop' : 'feature/update-security');
      let env = branch === 'main' ? 'production' : 'staging';
      let status: 'success' | 'failed' | 'running' = Math.random() > 0.1 ? 'success' : 'failed';

      const triggeredAt = randomTimeInPast(hoursAgo);
      const completedAt = new Date(triggeredAt.getTime() + (2 + Math.random() * 5) * 60 * 1000);

      const deployment = await prisma.deployment.create({
        data: {
          serviceId: service.id,
          commitSha: sha,
          commitMessage: msg,
          branch,
          author,
          status,
          environment: env,
          triggeredAt,
          completedAt: status === 'success' ? completedAt : null,
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

      // Add random vulnerabilities
      const vulnCount = Math.floor(Math.random() * 8);
      const shuffled = [...VULNERABILITY_TEMPLATES].sort(() => 0.5 - Math.random());
      const selectedVulns = shuffled.slice(0, vulnCount);

      let c = 0, h = 0, m = 0, l = 0;

      for (const v of selectedVulns) {
        await prisma.vulnerability.create({
          data: {
            scanId: scan.id,
            deploymentId: deployment.id,
            serviceId: service.id,
            cveId: v.cveId,
            title: v.title,
            severity: v.severity as any,
            cvssScore: v.cvssScore,
            affectedPackage: v.affectedPackage,
            fixedVersion: v.fixedVersion,
            scannerSource: 'trivy',
            isResolved: Math.random() > 0.6,
            detectedAt: triggeredAt,
          },
        });
        if (v.severity === 'critical') c++;
        else if (v.severity === 'high') h++;
        else if (v.severity === 'medium') m++;
        else if (v.severity === 'low') l++;
      }

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

      // Occasionally add a secret or violation
      if (Math.random() > 0.8) {
        await prisma.secret.create({
          data: {
            scanId: scan.id,
            serviceId: service.id,
            deploymentId: deployment.id,
            type: 'AWS Access Key',
            source: 'git history',
            file: 'src/config.js',
            line: 42,
            commitSha: sha,
            isVerified: true,
            detectedAt: triggeredAt,
          }
        });
      }
    }
  }

  const count = await prisma.deployment.count();
  const vulnCount = await prisma.vulnerability.count();
  const riskCount = await prisma.riskScore.count();
  console.log(`\n✅ Realistic Seed complete:`);
  console.log(`   Services: ${SERVICES.length}`);
  console.log(`   Deployments: ${count}`);
  console.log(`   Vulnerabilities: ${vulnCount}`);
  console.log(`   Risk scores: ${riskCount}`);
}

main()
  .catch((e) => { console.error('Seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
