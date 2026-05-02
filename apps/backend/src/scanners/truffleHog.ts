import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

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
  // Use the absolute path to our newly installed TruffleHog
  const truffleHogBin = path.resolve(process.cwd(), 'bin', 'trufflehog.exe');
  
  // --json: JSON newline delimited output
  // git: scan git history
  // file://: scan a local git repo
  const command = `"${truffleHogBin}" git "file://${repoPath}" --json --no-update`;
  
  console.log(`🔍 [TRUFFLEHOG] Scanning full git history: ${command}`);
  
  try {
    // TruffleHog returns results in stdout, but if no secrets found, it might return exit code 0 or 1 depending on version.
    // Usually, it emits findings to stdout.
    const { stdout, stderr } = await execAsync(command, { maxBuffer: 1024 * 1024 * 20 }); // 20MB buffer
    
    return stdout;
  } catch (err: any) {
    // TruffleHog often exits with 1 if it finds secrets. We should handle that as success for scanning.
    if (err.stdout) {
      return err.stdout;
    }
    
    // If it's a real error (no binary found, etc.)
    if (!err.stdout && err.stderr) {
       console.error(`❌ [TRUFFLEHOG] Critical error:`, err.stderr);
    }
    
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
