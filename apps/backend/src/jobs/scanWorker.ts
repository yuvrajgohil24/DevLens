import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { runTrivy, parseTrivyOutput } from '../scanners/trivy';
import { runTruffleHog, parseTruffleHogOutput } from '../scanners/truffleHog';
import { runSnyk, parseSnykOutput } from '../scanners/snyk';
import { createScan, completeScan, failScan, insertVulnerabilities, insertSecrets } from '../services/scanService';
import { calculateRiskScore } from '../services/riskScoreService';
import { updateDeploymentStatus } from '../services/deploymentService';
import { wsEvents } from '../websocket/index';
import { cloneRepository, cleanupDirectory } from '../utils/git';
import { sendSlackAlert } from '../services/slackService';
import prisma from '../db/prisma';
import path from 'path';
import os from 'os';
interface ScanJobData {
  deployment_id: string;
  service_id: string;
  service_name: string;
  image_name: string;
  repo_url?: string;
  commit_sha?: string;
  branch?: string;
  author?: string;
  environment: string;
  pipeline_url?: string;
}

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

const worker = new Worker<ScanJobData>(
  'scan-queue',
  async (job: Job<ScanJobData>) => {
    const { deployment_id, service_id, service_name, image_name, repo_url, environment } = job.data;
    console.log(`\n🔬 Starting scan job [${job.id}] for ${image_name}`);

    // 1. Create scan records
    const trivyScan = await createScan(deployment_id, 'trivy');
    const truffleScan = await createScan(deployment_id, 'trufflehog');
    const snykScan = await createScan(deployment_id, 'snyk');

    try {
      // 2. Update deployment to running
      await updateDeploymentStatus(deployment_id, 'running');

      let scanTargetPath = '';
      let isTemp = false;

      // 3. Clone repository if URL is provided
      if (repo_url) {
        const tempDirName = `devlens-scan-${deployment_id.slice(0, 8)}-${Date.now()}`;
        scanTargetPath = path.join(os.tmpdir(), tempDirName);
        isTemp = true;
        await cloneRepository(repo_url, scanTargetPath);
      } else {
         scanTargetPath = path.resolve(__dirname, '../../../../');
      }

      try {
        // 4. RUN ALL SCANNERS
        console.log(`📡 [WORKER] Orchestrating Scans for ${service_name}...`);
        
        // --- TRIVY (CVEs) ---
        const trivyOutput = await runTrivy(scanTargetPath);
        const parsedTrivyVulns = parseTrivyOutput(trivyOutput);
        await insertVulnerabilities(
          parsedTrivyVulns.map(v => ({ ...v, scanId: trivyScan.id, deploymentId: deployment_id, serviceId: service_id }))
        );
        await completeScan(trivyScan.id, trivyOutput);

        // --- SNYK (SCA) ---
        // runSnyk() will use SNYK_TOKEN if available, otherwise fallback to mock data.
        const snykOutput = await runSnyk(scanTargetPath);
        const parsedSnykVulns = parseSnykOutput(snykOutput);
        await insertVulnerabilities(
          parsedSnykVulns.map(v => ({ ...v, scanId: snykScan.id, deploymentId: deployment_id, serviceId: service_id }))
        );
        await completeScan(snykScan.id, snykOutput);

        // Combine vulnerabilities
        const parsedVulns = [...parsedTrivyVulns, ...parsedSnykVulns];

        // --- TRUFFLEHOG (Secrets) ---
        const truffleOutput = await runTruffleHog(scanTargetPath);
        const parsedSecrets = parseTruffleHogOutput(truffleOutput);
        await insertSecrets(
          parsedSecrets.map(s => ({ ...s, scanId: truffleScan.id, deploymentId: deployment_id, serviceId: service_id }))
        );
        await completeScan(truffleScan.id, truffleOutput);

        // --- 5. POLICY ENGINE (Guardrails) ---
        console.log(`⚖️ [POLICY] Evaluating results...`);
        const criticalCveCount = parsedVulns.filter(v => v.severity === 'critical').length;
        const secretCount = parsedSecrets.length;

        // Rule: FAIL on Critical CVEs OR ANY Secrets (User request)
        let finalStatus = 'success';
        let failureReason = '';

        if (criticalCveCount > 0) {
          finalStatus = 'failed';
          failureReason = `Deployment blocked: ${criticalCveCount} Critical CVEs detected.`;
        } else if (secretCount > 0) {
          finalStatus = 'failed';
          failureReason = `Deployment blocked: ${secretCount} Leaked Secrets detected in history.`;
        }

        // 6. Calculate Risk Score
        const riskScore = await calculateRiskScore(deployment_id, service_id);

        // 7. Update final Deployment status
        await updateDeploymentStatus(deployment_id, finalStatus, new Date());

        // 8. Emit Events
        wsEvents.scanCompleted({
          deploymentId: deployment_id,
          serviceId: service_id,
          criticalCount: criticalCveCount + secretCount, // Combined critical issues
          riskScore: Number(riskScore.score),
        });

        if (finalStatus === 'failed') {
          console.warn(`🛑 [POLICY FAIL] ${failureReason}`);
          await sendSlackAlert({
            title: `🚨 Security Alert: ${service_name}`,
            message: failureReason,
            level: 'critical',
            details: {
              'Deployment ID': deployment_id,
              'Risk Score': riskScore.score.toString(),
              'Critical CVEs': criticalCveCount.toString(),
              'Exposed Secrets': secretCount.toString(),
            }
          });
        } else {
          console.log(`✅ [POLICY PASS] Deployment successful for ${service_name}`);
          await sendSlackAlert({
            title: `✅ Security Scan Passed: ${service_name}`,
            message: `Deployment verified. No critical vulnerabilities or leaked secrets detected.`,
            level: 'info',
            details: {
              'Deployment ID': deployment_id,
              'Risk Score': riskScore.score.toString(),
              'Total CVEs': parsedVulns.length.toString()
            }
          });
        }

        // 9. Send Slack Alert
        await sendSlackAlert({
          serviceName: service_name,
          environment: environment || 'staging',
          status: finalStatus as 'success' | 'failed',
          riskScore: Number(riskScore.score),
          criticalCount: criticalCveCount + secretCount,
          pipelineUrl: job.data.pipeline_url || job.data.repo_url || 'https://github.com/yuvrajgohil24/DevLens/actions',
          commitSha: job.data.commit_sha || 'unknown',
          branch: job.data.branch || 'main'
        });

      } finally {
        if (isTemp) await cleanupDirectory(scanTargetPath);
      }
    } catch (err: any) {
      await failScan(trivyScan.id, String(err));
      await failScan(truffleScan.id, String(err));
      await failScan(snykScan.id, String(err));
      await updateDeploymentStatus(deployment_id, 'failed', new Date());

      // Notify Slack about system failure
      try {
        await sendSlackAlert({
          title: `❌ Scanner System Error: ${service_name}`,
          message: `Security pipeline failed to execute: ${err.message || 'Unknown error during scan execution.'}`,
          level: 'critical',
          details: {
            'Deployment ID': deployment_id,
            'Job ID': job.id || 'unknown'
          }
        });
      } catch (slackErr) {
        console.error('Failed to send error alert to Slack:', slackErr);
      }

      throw err;
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
