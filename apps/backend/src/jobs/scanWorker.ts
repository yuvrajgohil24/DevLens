import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { runTrivy, parseTrivyOutput } from '../scanners/trivy';
import { createScan, completeScan, failScan, insertVulnerabilities } from '../services/scanService';
import { calculateRiskScore } from '../services/riskScoreService';
import { updateDeploymentStatus } from '../services/deploymentService';
import { wsEvents } from '../websocket/index';

interface ScanJobData {
  deployment_id: string;
  service_id: string;
  service_name: string;
  image_name: string;
}

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

const worker = new Worker<ScanJobData>(
  'scan-queue',
  async (job: Job<ScanJobData>) => {
    const { deployment_id, service_id, service_name, image_name } = job.data;
    console.log(`\n🔬 Starting scan job [${job.id}] for ${image_name}`);

    // 1. Create scan record
    const scan = await createScan(deployment_id, 'trivy');

    try {
      // 2. Update deployment to running
      await updateDeploymentStatus(deployment_id, 'running');

      // 3. Run Trivy (mock in Phase 1)
      const rawOutput = await runTrivy(image_name);

      // 4. Parse + normalize CVEs
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
