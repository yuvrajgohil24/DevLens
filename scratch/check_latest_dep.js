
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDeployment() {
  const depId = "79e2471c-c4f3-40bb-abd3-e38fe7345ff8";
  try {
    const dep = await prisma.deployment.findUnique({
      where: { id: depId },
      include: {
        scans: true,
        riskScores: true,
        vulnerabilities: {
          where: { severity: 'critical' }
        },
        secrets: true
      }
    });

    console.log('--- Deployment Analysis ---');
    console.log(`ID: ${dep.id}`);
    console.log(`Status: ${dep.status}`);
    console.log(`Critical CVEs: ${dep.vulnerabilities.length}`);
    console.log(`Secrets Found: ${dep.secrets.length}`);
    
    if (dep.riskScores.length > 0) {
      const rs = dep.riskScores[0];
      console.log(`Risk Score: ${rs.score}`);
      console.log(`Breakdown: C:${rs.criticalCount} H:${rs.highCount} M:${rs.mediumCount} L:${rs.lowCount}`);
    }

    if (dep.status === 'failed') {
      console.log('\nPotential Failure Reasons:');
      if (dep.vulnerabilities.length > 0) {
        console.log(`- Blocked by ${dep.vulnerabilities.length} Critical CVE(s).`);
      }
      if (dep.secrets.length > 0) {
        console.log(`- Blocked by ${dep.secrets.length} Leaked Secret(s).`);
      }
    }

  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

checkDeployment();
