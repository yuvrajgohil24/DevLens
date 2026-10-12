import { exec } from 'child_process';
import crypto from 'crypto';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { SCANNER_TIMEOUT_MS } from './mock';
import { pathToFileURL } from 'url';

const execAsync = promisify(exec);

export interface NormalizedSecret {
  type: string;
  source: string;
  file: string | null;
  line: number | null;
  commitSha: string | null;
  rawFinding: any;
  isVerified: boolean;
}

/**
 * Builds a storage-safe copy of a TruffleHog finding.
 *
 * TruffleHog's JSON includes the plaintext secret (`Raw`, `RawV2`) and partially
 * masked values (`Redacted`, `ExtraData`, `StructuredData`). None of that may be
 * persisted or served by the API, so only an allowlist of metadata is kept,
 * plus a short one-way fingerprint for de-duplicating the same secret.
 */
export function sanitizeTruffleHogFinding(data: any) {
  const raw = `${data?.Raw ?? ''}${data?.RawV2 ?? ''}`;
  return {
    DetectorName: data?.DetectorName ?? null,
    DetectorType: data?.DetectorType ?? null,
    DecoderName: data?.DecoderName ?? null,
    Verified: data?.Verified === true,
    SourceMetadata: data?.SourceMetadata ?? null,
    // Keep an existing fingerprint so re-sanitizing an already-clean finding is a no-op
    fingerprint: raw ? crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16) : (data?.fingerprint ?? null),
  };
}

/**
 * Finds the TruffleHog binary:
 *   1. TRUFFLEHOG_BIN env override
 *   2. A local ./bin/trufflehog(.exe) (Windows dev setup)
 *   3. `trufflehog` on PATH (Docker image installs it to /usr/local/bin)
 */
export function resolveTruffleHogBin(): string {
  if (process.env.TRUFFLEHOG_BIN) return process.env.TRUFFLEHOG_BIN;

  const localBin = path.resolve(process.cwd(), 'bin', process.platform === 'win32' ? 'trufflehog.exe' : 'trufflehog');
  if (fs.existsSync(localBin)) return localBin;

  return 'trufflehog';
}

/**
 * Runs TruffleHog scanner on the provided git repository path.
 */
export async function runTruffleHog(repoPath: string): Promise<string> {
  const truffleHogBin = resolveTruffleHogBin();

  // FIX: TruffleHog's `git` subcommand does NOT accept Windows backslash paths
  // like C:\Users\... It needs either:
  //   1. A remote HTTPS URL: https://github.com/...  (if repoPath is a URL)
  //   2. A file:// URI: file:///C:/Users/...          (if repoPath is a local path)
  let gitUri: string;
  if (repoPath.startsWith('http://') || repoPath.startsWith('https://') || repoPath.startsWith('git@')) {
    // Already a remote URL — pass directly (TruffleHog will clone it)
    gitUri = repoPath;
  } else {
    // Local path — convert Windows backslashes to file:// URI
    // FIX for TruffleHog Windows bug: pathToFileURL generates file:///C:/...
    // but TruffleHog misreads it as file://C:/C:/... 
    // We must manually format it to file://C:/...
    const normalizedPath = repoPath.replace(/\\/g, '/');
    gitUri = normalizedPath.startsWith('/') ? `file://${normalizedPath}` : `file:///${normalizedPath}`;
    
    // Windows specific hack for TruffleHog: if it starts with file:///C:/, change to file://C:/
    if (process.platform === 'win32' && gitUri.match(/^file:\/\/\/[a-zA-Z]:\//)) {
      gitUri = gitUri.replace(/^file:\/\/\//, 'file://');
    }
  }

  // Added --no-verification so it doesn't filter out our fake test secrets
  const command = `"${truffleHogBin}" git "${gitUri}" --json --no-update --no-verification`;
  console.log(`🔍 [TRUFFLEHOG] Scanning git history at URI: ${gitUri}`);

  try {
    const { stdout } = await execAsync(command, {
      maxBuffer: 1024 * 1024 * 20, // 20MB buffer
      timeout: SCANNER_TIMEOUT_MS,
      cwd: repoPath.startsWith('http') ? undefined : repoPath,
    });
    return stdout;
  } catch (err: any) {
    // TruffleHog exits with code 1 when secrets ARE found — that's normal!
    // stdout will contain the JSON findings in this case.
    // A timeout kills the process: partial output is not a complete scan.
    if (err.killed) {
      throw new Error(`TruffleHog scan timed out after ${SCANNER_TIMEOUT_MS}ms`);
    }
    if (err.stdout) {
      console.log(`✅ [TRUFFLEHOG] Scan complete (secrets found in output)`);
      return err.stdout;
    }
    // Real error — binary missing, permissions, etc. Fail the scan instead of
    // returning '' so a broken scanner is never reported as "0 secrets found".
    console.error(`❌ [TRUFFLEHOG] Critical error:`, err.stderr || err.message);
    throw new Error(`TruffleHog scan failed (binary: ${truffleHogBin}): ${String(err.stderr || err.message).slice(0, 500)}`);
  }
}

/**
 * Parses TruffleHog's newline-delimited JSON output.
 */
export function parseTruffleHogOutput(rawOutput: string): NormalizedSecret[] {
  if (!rawOutput) return [];

  const lines = rawOutput.split('\n').filter(l => l.trim());
  const findings: NormalizedSecret[] = [];

  for (const line of lines) {
    try {
      const data = JSON.parse(line);
      
      // Map TruffleHog V3 JSON structure to our normalized format
      findings.push({
        type: data.DetectorName || 'Unknown Secret',
        source: 'git',
        file: data.SourceMetadata?.Data?.Filesystem?.file || data.SourceMetadata?.Data?.Git?.file || null,
        line: data.SourceMetadata?.Data?.Filesystem?.line || data.SourceMetadata?.Data?.Git?.line || null,
        commitSha: data.SourceMetadata?.Data?.Git?.commit || null,
        rawFinding: sanitizeTruffleHogFinding(data),
        isVerified: data.Verified === true,
      });
    } catch (e) {
      // Don't log the line itself — it may contain a plaintext secret
      console.warn(`⚠️ [TRUFFLEHOG] Failed to parse an output line (${line.length} chars)`);
    }
  }

  return findings;
}
