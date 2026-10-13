import { Worker, Job } from 'bullmq';
import { createRedisConnection } from '../db/redis';
import { runTrivy, parseTrivyOutput } from '../scanners/trivy';
import { runTruffleHog, parseTruffleHogOutput } from '../scanners/truffleHog';
import { runSnyk, parseSnykOutput } from '../scanners/snyk';
import { createScan, completeScan, failScan, skipScan, insertVulnerabilities, insertSecrets, clearScanResults } from '../services/scanService';
import { calculateRiskScore } from '../services/riskScoreService';
import { evaluatePolicy, recordPolicyViolations } from '../services/policyService';
import { applyDeploymentStatus } from '../services/deploymentService';
import { wsEvents } from '../websocket/index';
import { cloneRepository, cleanupDirectory } from '../utils/git';
import { sendSlackAlert } from '../services/slackService';
import path from 'path';
import os from 'os';
import { logger } from '../utils/logger';
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

const SCAN_CONCURRENCY = parseInt(process.env.SCAN_CONCURRENCY || '2', 10);

const worker = new Worker<ScanJobData>(
  'scan-queue',
  async (job: Job<ScanJobData>) => {
    const { deployment_id, service_id, service_name, image_name, repo_url, environment } = job.data;
    // Every log line of this job carries its ids, so one scan can be followed end to end
    const log = logger.child({ jobId: job.id, deploymentId: deployment_id, service: service_name, attempt: job.attemptsMade + 1 });
    log.info({ image: image_name }, 'Scan job started');

    // 0. Idempotency: if this job is a retry, remove everything a previous attempt
    //    may have written for this deployment (atomically, children before scans)
    await clearScanResults(deployment_id);

    // 1. Create scan records
    const trivyScan = await createScan(deployment_id, 'trivy');
    const truffleScan = await createScan(deployment_id, 'trufflehog');
    const snykScan = await createScan(deployment_id, 'snyk');
    try {
      // 2. Update deployment to running
      await applyDeploymentStatus(deployment_id, { scanStatus: 'running' });

      let scanTargetPath = '';
      let isTemp = false;

      // 3. Clone repository if URL is provided
      if (repo_url) {
        const tempDirName = `devlens-scan-${deployment_id.slice(0, 8)}-${Date.now()}`;
        scanTargetPath = path.join(os.tmpdir(), tempDirName);
        isTemp = true;
        await cloneRepository(repo_url, scanTargetPath, job.data.branch, job.data.commit_sha);
      } else {
         scanTargetPath = path.resolve(__dirname, '../../../../');
      }

      try {
        // 4. RUN ALL SCANNERS
        log.info('Running scanners');
        
        // --- TRIVY (CVEs) ---
        const trivy = await runTrivy(scanTargetPath);
        const parsedTrivyVulns = parseTrivyOutput(trivy.output);
        await insertVulnerabilities(
          parsedTrivyVulns.map(v => ({ ...v, scanId: trivyScan.id, deploymentId: deployment_id, serviceId: service_id }))
        );
        await completeScan(trivyScan.id, trivy.output, trivy.isMock);

        // --- SNYK (SCA) ---
        // Real scan with SNYK_TOKEN; otherwise mock data (dev) or skipped (MOCK_SCANNERS=false / production).
        const snyk = await runSnyk(scanTargetPath);
        const parsedSnykVulns = snyk.skipped ? [] : parseSnykOutput(snyk.output);
        if (snyk.skipped) {
          await skipScan(snykScan.id, 'SNYK_TOKEN not configured');
        } else {
          await insertVulnerabilities(
            parsedSnykVulns.map(v => ({ ...v, scanId: snykScan.id, deploymentId: deployment_id, serviceId: service_id }))
          );
          await completeScan(snykScan.id, snyk.output, snyk.isMock);
        }

        // Only real (non-mock) findings decide the policy outcome
        const parsedVulns = [
          ...(trivy.isMock ? [] : parsedTrivyVulns),
          ...(snyk.isMock ? [] : parsedSnykVulns),
        ];
        const usedMockData = trivy.isMock || snyk.isMock;
        if (usedMockData) {
          log.warn({ trivyMock: trivy.isMock, snykMock: snyk.isMock }, 'Mock scanner data used — excluded from policy decision and risk score');
        }

        // --- TRUFFLEHOG (Secrets) ---
        const truffleOutput = await runTruffleHog(scanTargetPath);
        const parsedSecrets = parseTruffleHogOutput(truffleOutput);
        await insertSecrets(
          parsedSecrets.map(s => ({ ...s, scanId: truffleScan.id, deploymentId: deployment_id, serviceId: service_id }))
        );
        // Never persist TruffleHog's raw output — it contains the plaintext secrets
        await completeScan(truffleScan.id, { findingCount: parsedSecrets.length });

        // --- 5. POLICY ENGINE (Guardrails) ---
        log.debug('Evaluating policy');
        const policy = evaluatePolicy(parsedVulns, parsedSecrets);
        await recordPolicyViolations(deployment_id, service_id, policy.violations);
        const finalStatus = policy.passed ? 'success' : 'failed';
        const criticalCveCount = parsedVulns.filter(v => v.severity === 'critical').length;
        const secretCount = parsedSecrets.length;

        // 6. Calculate Risk Score
        const riskScore = await calculateRiskScore(deployment_id, service_id);

        // 7. Update final Deployment status
        // (overall status also depends on the CI build status reported by webhooks)
        const updated = await applyDeploymentStatus(deployment_id, { scanStatus: finalStatus });
        wsEvents.deploymentUpdated({ deploymentId: deployment_id, status: updated.status });

        // 8. Emit Events
        wsEvents.scanCompleted({
          deploymentId: deployment_id,
          serviceId: service_id,
          criticalCount: criticalCveCount + secretCount, // Combined critical issues
          riskScore: Number(riskScore.score),
        });

        if (policy.passed) {
          log.info({ riskScore: Number(riskScore.score), cves: parsedVulns.length }, 'Policy passed');
        } else {
          log.warn({ riskScore: Number(riskScore.score), violations: policy.violations.map((v) => v.violationType) }, policy.reason);
        }

        // 9. Send ONE Slack alert per scan
        await sendSlackAlert({
          serviceName: service_name,
          environment: environment || 'staging',
          status: finalStatus,
          riskScore: Number(riskScore.score),
          criticalCount: criticalCveCount + secretCount,
          pipelineUrl: job.data.pipeline_url || job.data.repo_url || 'https://github.com/yuvrajgohil24/DevLens/actions',
          commitSha: job.data.commit_sha || 'unknown',
          branch: job.data.branch || 'main',
          reason: policy.passed
            ? 'No critical vulnerabilities or leaked secrets detected.'
            : policy.reason,
          details: {
            'Total CVEs': parsedVulns.length.toString(),
            'Leaked Secrets': secretCount.toString(),
            ...(usedMockData && { Note: 'Some scanners were unavailable — mock data was used and ignored' }),
          },
        });

      } finally {
        if (isTemp) await cleanupDirectory(scanTargetPath);
      }
    } catch (err: any) {
      await failScan(trivyScan.id, String(err));
      await failScan(truffleScan.id, String(err));
      await failScan(snykScan.id, String(err));
      // Retries re-run the whole scan; only the final attempt marks the deployment
      // failed and alerts Slack, so one broken scan doesn't send three alerts.
      const isFinalAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
      await applyDeploymentStatus(deployment_id, { scanStatus: isFinalAttempt ? 'failed' : 'queued' });

      if (isFinalAttempt) {
        try {
          await sendSlackAlert({
            title: `❌ Scanner System Error: ${service_name}`,
            message: `Security pipeline failed to execute: ${err.message || 'Unknown error during scan execution.'}`,
            level: 'critical',
            details: {
              'Deployment ID': deployment_id,
              'Job ID': job.id || 'unknown',
              Attempts: String(job.attemptsMade + 1),
            }
          });
        } catch (slackErr) {
          log.error({ err: slackErr }, 'Failed to send scanner error alert to Slack');
        }
      }

      throw err;
    }
  },
  {
    connection: createRedisConnection(),
    concurrency: SCAN_CONCURRENCY,
    // Full clones + scanners can legitimately run for minutes; renew the job lock meanwhile
    lockDuration: 5 * 60 * 1000,
  }
);

worker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Scan job completed');
});

worker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err, attempt: job?.attemptsMade }, 'Scan job failed');
});

worker.on('error', (err) => {
  logger.error({ err }, 'Scan worker error');
});

logger.info({ concurrency: SCAN_CONCURRENCY }, 'Scan worker started');

export default worker;
