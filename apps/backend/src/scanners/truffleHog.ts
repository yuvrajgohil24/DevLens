import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
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
 * Runs TruffleHog scanner on the provided git repository path.
 */
export async function runTruffleHog(repoPath: string): Promise<string> {
  const truffleHogBin = path.resolve(process.cwd(), 'bin', 'trufflehog.exe');

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
      cwd: repoPath.startsWith('http') ? undefined : repoPath,
    });
    return stdout;
  } catch (err: any) {
    // TruffleHog exits with code 1 when secrets ARE found — that's normal!
    // stdout will contain the JSON findings in this case.
    if (err.stdout) {
      console.log(`✅ [TRUFFLEHOG] Scan complete (secrets found in output)`);
      return err.stdout;
    }
    // Real error — binary missing, permissions, etc.
    console.error(`❌ [TRUFFLEHOG] Critical error:`, err.stderr || err.message);
    return '';
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
        file: data.SourceMetadata?.Data?.Filesystem?.file || null,
        line: data.SourceMetadata?.Data?.Filesystem?.line || null,
        commitSha: data.SourceMetadata?.Data?.Git?.commit || null,
        rawFinding: data,
        isVerified: data.Verified === true,
      });
    } catch (e) {
      console.warn(`⚠️ [TRUFFLEHOG] Failed to parse line:`, line.slice(0, 50));
    }
  }

  return findings;
}
