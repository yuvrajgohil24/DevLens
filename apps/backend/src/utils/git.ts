import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';

const execAsync = promisify(exec);

export async function cloneRepository(repoUrl: string, targetPath: string, branch?: string, commitSha?: string): Promise<void> {
  const token = process.env.GITHUB_TOKEN;
  
  let authenticatedUrl = repoUrl;
  if (token && repoUrl.startsWith('https://github.com/')) {
    authenticatedUrl = repoUrl.replace('https://github.com/', `https://x-access-token:${token}@github.com/`);
  }

  console.log(`📡 [GIT] Cloning ${repoUrl} to ${targetPath}`);
  
  try {
    // Ensure parent directory exists
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    
    // Determine clone command based on whether we need a specific commit
    if (commitSha) {
      // Need full clone to checkout specific commit (or at least enough depth, full clone is safer)
      await execAsync(`git clone ${authenticatedUrl} ${targetPath}`);
      await execAsync(`git checkout ${commitSha}`, { cwd: targetPath });
    } else if (branch) {
      // Shallow clone of specific branch
      await execAsync(`git clone --branch ${branch} --depth 1 ${authenticatedUrl} ${targetPath}`);
    } else {
      // Shallow clone of default branch
      await execAsync(`git clone --depth 1 ${authenticatedUrl} ${targetPath}`);
    }
    
    console.log(`✅ [GIT] Clone successful${branch ? ` (branch: ${branch})` : ''}${commitSha ? ` (commit: ${commitSha})` : ''}`);
  } catch (err) {
    console.error(`❌ [GIT] Clone failed:`, err);
    throw new Error(`Failed to clone repository: ${repoUrl}`);
  }
}

export async function cleanupDirectory(dirPath: string): Promise<void> {
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
    console.log(`🧹 [GIT] Cleaned up ${dirPath}`);
  } catch (err) {
    console.error(`⚠️ [GIT] Cleanup failed for ${dirPath}:`, err);
  }
}
