// Phase 2: Real Trivy scanner using Docker
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

// Phase 2: Replace runTrivy() with real child_process exec of trivy CLI

export interface NormalizedVulnerability {
  cveId: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  cvssScore: number;
  affectedPackage: string;
  fixedVersion: string | null;
  scannerSource: string;
}

// Realistic CVE pool — Phase 1 mock data
const CVE_POOL: NormalizedVulnerability[] = [
  {
    cveId: 'CVE-2024-21626',
    title: 'runc: container breakout via internal file descriptor leak',
    severity: 'critical',
    cvssScore: 8.6,
    affectedPackage: 'runc@1.1.11',
    fixedVersion: '1.1.12',
    scannerSource: 'trivy',
  },
  {
    cveId: 'CVE-2023-44487',
    title: 'HTTP/2 Rapid Reset Attack allows DoS',
    severity: 'high',
    cvssScore: 7.5,
    affectedPackage: 'golang.org/x/net@0.14.0',
    fixedVersion: '0.17.0',
    scannerSource: 'trivy',
  },
  {
    cveId: 'CVE-2023-52425',
    title: 'libexpat: XML_ResumeParser denial of service',
    severity: 'high',
    cvssScore: 7.5,
    affectedPackage: 'libexpat@2.5.0',
    fixedVersion: '2.6.0',
    scannerSource: 'trivy',
  },
  {
    cveId: 'CVE-2023-4911',
    title: 'glibc: buffer overflow in ld.so leading to privilege escalation (Looney Tunables)',
    severity: 'high',
    cvssScore: 7.8,
    affectedPackage: 'glibc@2.38',
    fixedVersion: '2.38-r1',
    scannerSource: 'trivy',
  },
  {
    cveId: 'CVE-2024-0727',
    title: 'OpenSSL: denial of service via malformed PKCS12 files',
    severity: 'medium',
    cvssScore: 5.5,
    affectedPackage: 'openssl@3.1.4',
    fixedVersion: '3.1.5',
    scannerSource: 'trivy',
  },
  {
    cveId: 'CVE-2023-5752',
    title: 'pip: Mercurial config injection via repo name',
    severity: 'medium',
    cvssScore: 5.5,
    affectedPackage: 'pip@23.0.1',
    fixedVersion: '23.3',
    scannerSource: 'trivy',
  },
  {
    cveId: 'CVE-2023-40217',
    title: 'Python: ssl.SSLSocket rebind allows bypass of TLS handshake',
    severity: 'medium',
    cvssScore: 5.3,
    affectedPackage: 'python3@3.11.4',
    fixedVersion: '3.11.5',
    scannerSource: 'trivy',
  },
  {
    cveId: 'CVE-2024-24795',
    title: 'Apache httpd: HTTP Response Splitting in multiple modules',
    severity: 'medium',
    cvssScore: 6.1,
    affectedPackage: 'apache2@2.4.57',
    fixedVersion: '2.4.59',
    scannerSource: 'trivy',
  },
  {
    cveId: 'CVE-2023-29659',
    title: 'libpng: null pointer dereference in png_read_buffer',
    severity: 'low',
    cvssScore: 3.3,
    affectedPackage: 'libpng@1.6.39',
    fixedVersion: '1.6.40',
    scannerSource: 'trivy',
  },
  {
    cveId: 'CVE-2022-41409',
    title: 'PCRE2: denial of service via integer overflow',
    severity: 'low',
    cvssScore: 2.5,
    affectedPackage: 'pcre2@10.40',
    fixedVersion: '10.42',
    scannerSource: 'trivy',
  },
];

export async function runTrivy(targetPath: string): Promise<unknown> {
  const trivyPath = String.raw`C:\Users\YUVRAJ SINGH\AppData\Local\Microsoft\WinGet\Packages\AquaSecurity.Trivy_Microsoft.Winget.Source_8wekyb3d8bbwe\trivy.exe`;
  const command = `"${trivyPath}" fs --format json --scanners vuln --skip-dirs "**/node_modules" --skip-dirs "**/.next" --skip-dirs "**/dist" --skip-dirs "**/.git" --skip-dirs "**/pkg" --skip-dirs "**/tmp" "${path.resolve(targetPath)}"`;
  
  console.log(`🔍 [TRIVY] Running real scan: ${command}`);
  
  try {
    const { stdout, stderr } = await execAsync(command, { maxBuffer: 1024 * 1024 * 10 }); // 10MB buffer
    
    if (stderr && !stdout) {
      console.warn(`⚠️ [TRIVY] Warnings: ${stderr}`);
    }

    return JSON.parse(stdout);
  } catch (err: any) {
    console.error(`❌ [TRIVY] Scan execution failed:`, err.message);
    throw new Error(`Trivy scan execution failed: ${err.message}`);
  }
}

export function parseTrivyOutput(rawOutput: unknown): NormalizedVulnerability[] {
  try {
    const output = rawOutput as { Results?: Array<{ Vulnerabilities?: Array<Record<string, unknown>> }> };
    if (!output?.Results) return [];

    const results: NormalizedVulnerability[] = [];

    for (const result of output.Results) {
      if (!result.Vulnerabilities) continue;

      for (const vuln of result.Vulnerabilities) {
        const severity = String(vuln['Severity'] ?? '').toLowerCase() as NormalizedVulnerability['severity'];
        if (!['critical', 'high', 'medium', 'low'].includes(severity)) continue;

        const cvss = vuln['CVSS'] as Record<string, Record<string, number>> | undefined;
        const cvssScore = cvss?.nvd?.V3Score ?? cvss?.redhat?.V3Score ?? 0;

        results.push({
          cveId: String(vuln['VulnerabilityID'] ?? ''),
          title: String(vuln['Title'] ?? 'Unknown vulnerability'),
          severity,
          cvssScore,
          affectedPackage: `${vuln['PkgName']}@${vuln['InstalledVersion']}`,
          fixedVersion: vuln['FixedVersion'] ? String(vuln['FixedVersion']) : null,
          scannerSource: 'trivy',
        });
      }
    }

    return results;
  } catch (err) {
    console.error('Failed to parse Trivy output:', err);
    return [];
  }
}
