import { NormalizedVulnerability } from './trivy';

export async function runSnyk(targetPath: string): Promise<unknown> {
  console.log(`🔍 [SNYK] Running simulated SCA scan on: ${targetPath}`);
  
  // Simulate scanning delay
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Return mocked Snyk JSON output
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
