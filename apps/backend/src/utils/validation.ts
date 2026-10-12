import { z } from 'zod';

/**
 * Shared input validators for anything that ends up in a git/scanner command
 * or a filesystem path. Values that pass these checks contain no shell
 * metacharacters and cannot be mistaken for command-line options.
 */

// Full or abbreviated git commit SHA (hex only)
export const COMMIT_SHA_REGEX = /^[0-9a-f]{7,40}$/i;

// Conservative subset of valid git ref names: no leading '-', no '..', no trailing '/', '.' or '.lock'
export const BRANCH_REGEX = /^(?!-)(?!.*\.\.)(?!.*\/\/)(?!.*(?:\/|\.|\.lock)$)[A-Za-z0-9._\/-]{1,100}$/;

// GitHub repository name (no path separators, not just dots)
export const REPO_NAME_REGEX = /^(?!\.+$)[A-Za-z0-9._-]{1,100}$/;

// https://github.com/<owner>/<repo>[.git]
const GITHUB_REPO_URL_REGEX = /^https:\/\/github\.com\/([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\/((?!\.+(?:\.git)?$)[A-Za-z0-9._-]{1,100}?)(?:\.git)?\/?$/;

export function parseGitHubRepoUrl(url: string): { owner: string; repo: string } | null {
  const match = GITHUB_REPO_URL_REGEX.exec(url);
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}

/**
 * A repo URL is allowed if it is a plain https GitHub URL and, when GITHUB_OWNER
 * is configured, belongs to that owner. This stops the scanner (which clones
 * with GITHUB_TOKEN) from being pointed at arbitrary repositories.
 */
export function isAllowedRepoUrl(url: string): boolean {
  const parsed = parseGitHubRepoUrl(url);
  if (!parsed) return false;
  const allowedOwner = process.env.GITHUB_OWNER;
  return !allowedOwner || parsed.owner.toLowerCase() === allowedOwner.toLowerCase();
}

export const commitShaSchema = z.string().regex(COMMIT_SHA_REGEX, 'commit_sha must be a 7-40 character hex SHA');
export const branchSchema = z.string().regex(BRANCH_REGEX, 'Invalid branch name');
export const repoNameSchema = z.string().regex(REPO_NAME_REGEX, 'Invalid repository name');
export const repoUrlSchema = z
  .string()
  .refine(isAllowedRepoUrl, 'repo_url must be https://github.com/<owner>/<repo> for the configured GITHUB_OWNER');
