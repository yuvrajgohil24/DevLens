import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execAsync = promisify(exec);

export interface GitStatus {
  branch: string;
  isClean: boolean;
  ahead: number;
  behind: number;
  modifiedFiles: number;
}

export interface GitCommandResult {
  success: boolean;
  output: string;
  error?: string;
}

/**
 * Resolves the absolute local path for a given repository.
 */
function getLocalRepoPath(repoName: string): string {
  // Allow explicit override via .env (e.g., LOCAL_REPO_PATH_DevLens=d:\AI_Agents\DevFlow)
  const envOverride = process.env[`LOCAL_REPO_PATH_${repoName}`];
  if (envOverride && fs.existsSync(envOverride)) {
    return envOverride;
  }

  const workspaceDir = process.env.LOCAL_WORKSPACE_DIR || process.cwd();
  let fullPath = path.join(workspaceDir, repoName);
  
  // Fallback specifically for DevLens since the local folder is often named DevFlow
  if (!fs.existsSync(fullPath) && repoName === 'DevLens') {
    const devFlowPath = path.join(workspaceDir, 'DevFlow');
    if (fs.existsSync(devFlowPath)) {
      fullPath = devFlowPath;
    }
  }

  if (!fs.existsSync(fullPath)) {
    throw new Error(`Repository not found locally at ${fullPath}. Please ensure LOCAL_WORKSPACE_DIR or LOCAL_REPO_PATH_${repoName} is set correctly.`);
  }
  
  return fullPath;
}

/**
 * Runs a generic git command safely.
 */
async function runGitCommand(repoPath: string, command: string): Promise<GitCommandResult> {
  try {
    const { stdout, stderr } = await execAsync(`git ${command}`, { cwd: repoPath, timeout: 30000 });
    return {
      success: true,
      output: (stdout || stderr).trim(),
    };
  } catch (err: any) {
    return {
      success: false,
      output: err.stdout?.trim() || '',
      error: err.stderr?.trim() || err.message,
    };
  }
}

/**
 * Gets the current Git status of the repository.
 */
export async function getGitStatus(repoName: string): Promise<GitStatus> {
  const repoPath = getLocalRepoPath(repoName);

  // git status --porcelain -b
  // output example:
  // ## main...origin/main [ahead 1]
  //  M file.ts
  const result = await runGitCommand(repoPath, 'status --porcelain -b');
  if (!result.success) {
    throw new Error(`Failed to get git status: ${result.error}`);
  }

  const lines = result.output.split('\n');
  const branchInfo = lines[0]; // e.g. ## main...origin/main [ahead 1]
  
  const branchMatch = branchInfo.match(/^## ([^\s.]+)/);
  const branch = branchMatch ? branchMatch[1] : 'unknown';

  let ahead = 0;
  let behind = 0;
  
  const aheadMatch = branchInfo.match(/ahead (\d+)/);
  if (aheadMatch) ahead = parseInt(aheadMatch[1], 10);
  
  const behindMatch = branchInfo.match(/behind (\d+)/);
  if (behindMatch) behind = parseInt(behindMatch[1], 10);

  const modifiedFilesCount = lines.length - 1; // All lines except the branch info
  const isClean = modifiedFilesCount === 0;

  return {
    branch,
    isClean,
    ahead,
    behind,
    modifiedFiles: modifiedFilesCount,
  };
}

/**
 * Performs a git fetch on the local repo.
 */
export async function gitFetch(repoName: string): Promise<GitCommandResult> {
  const repoPath = getLocalRepoPath(repoName);
  return runGitCommand(repoPath, 'fetch --prune');
}

/**
 * Performs a git pull on the local repo.
 */
export async function gitPull(repoName: string): Promise<GitCommandResult> {
  const repoPath = getLocalRepoPath(repoName);
  return runGitCommand(repoPath, 'pull --rebase');
}

/**
 * Performs a git push on the local repo.
 */
export async function gitPush(repoName: string): Promise<GitCommandResult> {
  const repoPath = getLocalRepoPath(repoName);
  return runGitCommand(repoPath, 'push');
}
