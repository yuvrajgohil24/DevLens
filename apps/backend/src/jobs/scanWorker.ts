import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { runTrivy, parseTrivyOutput } from '../scanners/trivy';
import { createScan, completeScan, failScan, insertVulnerabilities } from '../services/scanService';
import { calculateRiskScore } from '../services/riskScoreService';
import { updateDeploymentStatus } from '../services/deploymentService';
import { wsEvents } from '../websocket/index';
import { cloneRepository, cleanupDirectory } from '../utils/git';
import path from 'path';
import os from 'os';


interface ScanJobData {
  deployment_id: string;
  service_id: string;
  service_name: string;
  image_name: string;
  repo_url?: string;
}

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

const worker = new Worker<ScanJobData>(
  'scan-queue',
  async (job: Job<ScanJobData>) => {
    const { deployment_id, service_id, service_name, image_name, repo_url } = job.data;
    console.log(`\n🔬 Starting scan job [${job.id}] for ${image_name}`);

    // 1. Create scan record
    const scan = await createScan(deployment_id, 'trivy');

    try {
      // 2. Update deployment to running
      await updateDeploymentStatus(deployment_id, 'running');

      let scanTargetPath = '';
      let isTemp = false;

      // 3. Clone repository if URL is provided, otherwise scan local (for development)
      if (repo_url) {
        const tempDirName = `devlens-scan-${deployment_id.slice(0, 8)}-${Date.now()}`;
        scanTargetPath = path.join(os.tmpdir(), tempDirName);
        isTemp = true;
        await cloneRepository(repo_url, scanTargetPath);
      } else {
         // Fallback to project root if no repo_url (useful for testing)
         scanTargetPath = path.resolve(__dirname, '../../../../');
      }

      // 4. Run Trivy (Now Real Docker Scan)
      let rawOutput: any;
      try {
        rawOutput = await runTrivy(scanTargetPath);
      } finally {
        // Cleanup ASAP
        if (isTemp) {
          await cleanupDirectory(scanTargetPath);
        }
      }

      // 5. Parse + normalize CVEs
      const parsedVulns = parseTrivyOutput(rawOutput);
      console.log(`   Found ${parsedVulns.length} vulnerabilities`);

      // 5. Bulk insert vulnerabilities
      await insertVulnerabilities(
        parsedVulns.map((v) => ({
          scanId: scan.id,
          deploymentId: deployment_id,
          serviceId: service_id,
          cveId: v.cveId,
          title: v.title,
          severity: v.severity,
          cvssScore: v.cvssScore,
          affectedPackage: v.affectedPackage,
          fixedVersion: v.fixedVersion,
          scannerSource: v.scannerSource,
        }))
      );

      // 6. Mark scan complete
      await completeScan(scan.id, rawOutput);

      // 7. Calculate risk score
      const riskScore = await calculateRiskScore(deployment_id, service_id);

      // 8. Update deployment to success
      await updateDeploymentStatus(deployment_id, 'success', new Date());

      // 9. Emit WebSocket events
      const criticalCount = parsedVulns.filter((v) => v.severity === 'critical').length;

      wsEvents.scanCompleted({
        deploymentId: deployment_id,
        serviceId: service_id,
        criticalCount,
        riskScore: Number(riskScore.score),
      });

      // Alert on critical CVEs
      if (criticalCount > 0) {
        const criticalCve = parsedVulns.find((v) => v.severity === 'critical')!;
        wsEvents.criticalCveDetected({
          deploymentId: deployment_id,
          serviceName: service_name,
          cveId: criticalCve.cveId,
          title: criticalCve.title,
        });
      }

      console.log(`✅ Scan complete for ${image_name} | Risk: ${riskScore.score} | CVEs: ${parsedVulns.length}`);
    } catch (err) {
      await failScan(scan.id, String(err));
      await updateDeploymentStatus(deployment_id, 'failed', new Date());
      throw err; // BullMQ will retry
    }
  },
  {
    connection,
    concurrency: 3,
  }
);

worker.on('completed', (job) => {
  console.log(`✅ Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`❌ Job ${job?.id} failed:`, err.message);
});

worker.on('error', (err) => {
  console.error('Worker error:', err);
});

console.log('🔧 Scan worker started (concurrency: 3)');

export default worker;
