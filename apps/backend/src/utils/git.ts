import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';

const execAsync = promisify(exec);

export async function cloneRepository(repoUrl: string, targetPath: string): Promise<void> {
  const token = process.env.GITHUB_TOKEN;
  
  let authenticatedUrl = repoUrl;
  if (token && repoUrl.startsWith('https://github.com/')) {
    authenticatedUrl = repoUrl.replace('https://github.com/', `https://x-access-token:${token}@github.com/`);
  }

  console.log(`📡 [GIT] Cloning ${repoUrl} to ${targetPath}`);
  
  try {
    // Ensure parent directory exists
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    
    // Run git clone
    await execAsync(`git clone --depth 1 ${authenticatedUrl} ${targetPath}`);
    console.log(`✅ [GIT] Clone successful`);
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
