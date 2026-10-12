import { exec } from 'child_process';
import { promisify } from 'util';
import { NormalizedVulnerability } from './trivy';
import { mockScannersAllowed, ScannerResult, SCANNER_TIMEOUT_MS } from './mock';

const execAsync = promisify(exec);

export async function runSnyk(targetPath: string): Promise<ScannerResult> {
  const snykToken = process.env.SNYK_TOKEN;

  if (!snykToken) {
    if (mockScannersAllowed()) {
      console.warn('⚠️ [SNYK] SNYK_TOKEN not set — using MOCK data (results are labelled as mock)');
      return { output: await getMockSnykData(), isMock: true };
    }
    // Snyk is optional: without a token it simply doesn't run
    console.warn('⚠️ [SNYK] SNYK_TOKEN not set — skipping Snyk scan');
    return { output: null, isMock: false, skipped: true };
  }

  // Use npx to run the locally installed Snyk CLI
  const command = `npx snyk test --json --all-projects "${targetPath}"`;

  try {
    console.log(`🔍 [SNYK] Running real SCA scan on: ${targetPath}`);
    // Passing the SNYK_TOKEN via environment variables
    const { stdout } = await execAsync(command, {
      maxBuffer: 1024 * 1024 * 10,
      timeout: SCANNER_TIMEOUT_MS,
      env: { ...process.env, SNYK_TOKEN: snykToken }
    });

    console.log(`✅ [SNYK] Real scan complete (No vulnerabilities found)`);
    return { output: JSON.parse(stdout), isMock: false };
  } catch (err: any) {
    // Snyk CLI exits with code 1 if vulnerabilities are found, and code 2 for errors.
    // However, stdout will still contain the JSON payload if it's code 1.
    if (err.stdout) {
      try {
        const parsed = JSON.parse(err.stdout);
        console.log(`✅ [SNYK] Real scan complete (Vulnerabilities found)`);
        return { output: parsed, isMock: false };
      } catch (parseErr) {
        console.error('⚠️ [SNYK] Failed to parse Snyk JSON output from error:', parseErr);
      }
    }

    console.error(`❌ [SNYK] Real scan execution failed:`, err.message);
    if (!mockScannersAllowed()) {
      throw new Error(`Snyk scan failed and mock data is disabled (MOCK_SCANNERS): ${String(err.message).slice(0, 500)}`);
    }
    console.warn('⚠️ [SNYK] Falling back to MOCK data due to execution error.');
    return { output: await getMockSnykData(), isMock: true };
  }
}

function getMockSnykData() {
  // Simulate delay for mock
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        vulnerabilities: [
          {
            id: "SNYK-JS-AXIOS-6165243",
            title: "Server-Side Request Forgery (SSRF)",
            severity: "high",
            cvssScore: 7.5,
            packageName: "axios",
            version: "1.6.0",
            fixedIn: ["1.6.1"],
          },
          {
            id: "SNYK-JS-EXPRESS-12345",
            title: "Cross-Site Scripting (XSS)",
            severity: "medium",
            cvssScore: 6.1,
            packageName: "express",
            version: "4.19.1",
            fixedIn: ["4.19.2"],
          },
          {
            id: "SNYK-JS-LODASH-6080780",
            title: "Prototype Pollution",
            severity: "high",
            cvssScore: 7.4,
            packageName: "lodash",
            version: "4.17.20",
            fixedIn: ["4.17.21"],
          }
        ]
      });
    }, 2000);
  });
}

export function parseSnykOutput(rawOutput: unknown): NormalizedVulnerability[] {
  try {
    if (!rawOutput) return [];
    
    // Snyk CLI can output a single object or an array of objects (if multiple manifests are found)
    const projects = Array.isArray(rawOutput) ? rawOutput : [rawOutput];
    const results: NormalizedVulnerability[] = [];

    for (const project of projects) {
      const vulns = project?.vulnerabilities;
      if (!Array.isArray(vulns)) continue;

      for (const vuln of vulns) {
        results.push({
          cveId: vuln.id,
          title: vuln.title,
          severity: vuln.severity,
          cvssScore: vuln.cvssScore || 0,
          affectedPackage: `${vuln.packageName}@${vuln.version}`,
          fixedVersion: vuln.fixedIn && vuln.fixedIn.length > 0 ? vuln.fixedIn[0] : null,
          scannerSource: 'snyk',
        });
      }
    }
    
    return results;
  } catch (err) {
    console.error('Failed to parse Snyk output:', err);
    return [];
  }
}
