// Phase 3: Real Snyk CLI integration is planned for Phase 3 (Managed Cloud Deployment).
// Until then, this scanner returns hardcoded mock data so the scan pipeline
// remains exercisable end-to-end without a Snyk token / CLI binary.
import { NormalizedVulnerability } from './trivy';

// Mock - Phase 3: Replace this function body with real Snyk CLI execution, e.g.:
//   const { stdout } = await execAsync(`snyk test --json "${targetPath}"`);
//   return JSON.parse(stdout);
export async function runSnyk(targetPath: string): Promise<unknown> {
  console.log(`🔍 [SNYK] Running simulated SCA scan on: ${targetPath} (Mock - Phase 3)`);
  
  // Mock - Phase 3: Simulated delay mimics real Snyk CLI execution time
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Mock - Phase 3: Hardcoded vulnerability data — replace with real snyk JSON output
  return {
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
  };
}

export function parseSnykOutput(rawOutput: unknown): NormalizedVulnerability[] {
  try {
    const output = rawOutput as { vulnerabilities?: Array<any> };
    if (!output?.vulnerabilities) return [];

    return output.vulnerabilities.map(vuln => ({
      cveId: vuln.id,
      title: vuln.title,
      severity: vuln.severity,
      cvssScore: vuln.cvssScore || 0,
      affectedPackage: `${vuln.packageName}@${vuln.version}`,
      fixedVersion: vuln.fixedIn && vuln.fixedIn.length > 0 ? vuln.fixedIn[0] : null,
      scannerSource: 'snyk',
    }));
  } catch (err) {
    console.error('Failed to parse Snyk output:', err);
    return [];
  }
}
