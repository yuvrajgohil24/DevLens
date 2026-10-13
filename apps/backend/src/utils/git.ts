import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import { BRANCH_REGEX, COMMIT_SHA_REGEX, isAllowedRepoUrl } from './validation';
import { logger } from './logger';

const execFileAsync = promisify(execFile);

const CLONE_TIMEOUT_MS = 5 * 60 * 1000;

/** Strips the GitHub token (raw or base64 auth header) from any text before it is logged or thrown. */
function redactToken(text: string): string {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return text;
  const basic = Buffer.from(`x-access-token:${token}`).toString('base64');
  return text.split(token).join('***').split(basic).join('***');
}

/**
 * Runs git with an argument array (no shell), so inputs can never be
 * interpreted as shell syntax.
 */
async function runGit(args: string[], cwd?: string): Promise<void> {
  const token = process.env.GITHUB_TOKEN;
  // Pass the token as a per-command HTTP header instead of embedding it in the
  // clone URL, so it is never written to .git/config or echoed in remote URLs.
  const authArgs = token
    ? ['-c', `http.https://github.com/.extraheader=AUTHORIZATION: basic ${Buffer.from(`x-access-token:${token}`).toString('base64')}`]
    : [];

  await execFileAsync('git', [...authArgs, ...args], {
    cwd,
    timeout: CLONE_TIMEOUT_MS,
    maxBuffer: 1024 * 1024 * 10,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  });
}

export async function cloneRepository(repoUrl: string, targetPath: string, branch?: string, commitSha?: string): Promise<void> {
  // Defense in depth: jobs can be enqueued from several places, so re-validate here.
  if (!isAllowedRepoUrl(repoUrl)) {
    throw new Error(`Refusing to clone disallowed repository URL: ${repoUrl}`);
  }
  if (branch && !BRANCH_REGEX.test(branch)) {
    throw new Error(`Refusing to clone invalid branch name: ${branch}`);
  }
  if (commitSha && !COMMIT_SHA_REGEX.test(commitSha)) {
    throw new Error(`Refusing to checkout invalid commit SHA: ${commitSha}`);
  }

  logger.info({ repoUrl, targetPath, branch, commitSha }, 'Cloning repository');

  try {
    // Ensure parent directory exists
    await fs.mkdir(path.dirname(targetPath), { recursive: true });

    // Determine clone command based on whether we need a specific commit
    if (commitSha) {
      // Need full clone to checkout specific commit (or at least enough depth, full clone is safer)
      await runGit(['clone', '--quiet', '--', repoUrl, targetPath]);
      await runGit(['checkout', '--quiet', commitSha], targetPath);
    } else if (branch) {
      // Shallow clone of specific branch
      await runGit(['clone', '--quiet', '--branch', branch, '--depth', '1', '--', repoUrl, targetPath]);
    } else {
      // Shallow clone of default branch
      await runGit(['clone', '--quiet', '--depth', '1', '--', repoUrl, targetPath]);
    }

    logger.info({ repoUrl }, 'Clone complete');
  } catch (err: any) {
    logger.error({ repoUrl, reason: redactToken(String(err?.stderr || err?.message || err)) }, 'Clone failed');
    throw new Error(`Failed to clone repository: ${repoUrl}`);
  }
}

export async function cleanupDirectory(dirPath: string): Promise<void> {
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
    logger.debug({ dirPath }, 'Cleaned up scan directory');
  } catch (err) {
    logger.warn({ dirPath, err }, 'Scan directory cleanup failed');
  }
}
