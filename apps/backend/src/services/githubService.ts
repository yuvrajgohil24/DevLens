import axios, { AxiosError } from 'axios';
import { PublicError } from '../utils/httpErrors';
import { logger } from '../utils/logger';

// ── GitHub API client ──────────────────────────────────────────────────────
const github = axios.create({
  baseURL: 'https://api.github.com',
  headers: {
    Authorization: `token ${process.env.GITHUB_TOKEN}`,
    Accept: 'application/vnd.github.v3+json',
    'X-GitHub-Api-Version': '2022-11-28',
  },
  timeout: 10000,
});

const OWNER = process.env.GITHUB_OWNER!;

// ── Types ──────────────────────────────────────────────────────────────────
export interface GitHubBranch {
  name: string;
  sha: string;
  isDefault: boolean;
  updatedAt: string;
}

export interface GitHubCommit {
  sha: string;
  message: string;
  author: string;
  date: string;
  branch: string;
  url: string;
}

export interface GitHubRepo {
  id: number;
  name: string;
  fullName: string;
  description: string | null;
  language: string | null;
  defaultBranch: string;
  visibility: 'public' | 'private';
  stars: number;
  updatedAt: string;
  url: string;
}

// ── Helper ─────────────────────────────────────────────────────────────────
function handleGitHubError(err: unknown, context: string): never {
  const axErr = err as AxiosError;
  const status = axErr.response?.status;
  logger.error({ context, status, err: axErr.message }, 'GitHub API error');

  if (status === 401) {
    throw new PublicError(502, 'GitHub integration is misconfigured (invalid token)');
  }
  if (status === 403 || status === 429) {
    const rateReset = axErr.response?.headers['x-ratelimit-reset'];
    const when = rateReset ? ` after ${new Date(Number(rateReset) * 1000).toISOString()}` : ' later';
    throw new PublicError(503, `GitHub rate limit reached — try again${when}`);
  }
  if (status === 404) {
    throw new PublicError(404, 'Repository not found on GitHub');
  }
  throw new PublicError(502, 'GitHub API request failed');
}

// ── Service functions ──────────────────────────────────────────────────────

/**
 * Fetches all branches for a repository.
 */
export async function getRepoBranches(repoName: string): Promise<GitHubBranch[]> {
  try {
    const { data: repoData } = await github.get(`/repos/${OWNER}/${repoName}`);
    const defaultBranch: string = repoData.default_branch;

    const { data: branches } = await github.get(
      `/repos/${OWNER}/${repoName}/branches`,
      { params: { per_page: 50 } }
    );

    return (branches as Array<Record<string, unknown>>).map((b) => {
      const commit = b['commit'] as Record<string, unknown>;
      const commitData = (commit?.['commit'] as Record<string, unknown>) ?? {};
      const author = (commitData['author'] as Record<string, unknown>) ?? {};
      return {
        name: String(b['name']),
        sha: String(commit?.['sha'] ?? ''),
        isDefault: b['name'] === defaultBranch,
        updatedAt: String(author['date'] ?? new Date().toISOString()),
      };
    });
  } catch (err) {
    handleGitHubError(err, `getRepoBranches(${repoName})`);
  }
}

/**
 * Fetches the latest 20 commits for a branch.
 */
export async function getRepoCommits(
  repoName: string,
  branch: string
): Promise<GitHubCommit[]> {
  try {
    const { data: commits } = await github.get(
      `/repos/${OWNER}/${repoName}/commits`,
      { params: { sha: branch, per_page: 20 } }
    );

    return (commits as Array<Record<string, unknown>>).map((c) => {
      const commitData = (c['commit'] as Record<string, unknown>) ?? {};
      const authorData = (commitData['author'] as Record<string, unknown>) ?? {};
      const ghAuthor = c['author'] as Record<string, unknown> | null;
      return {
        sha: String(c['sha']),
        message: String(commitData['message'] ?? '').split('\n')[0], // first line only
        author: String(ghAuthor?.['login'] ?? authorData['name'] ?? 'unknown'),
        date: String(authorData['date'] ?? new Date().toISOString()),
        branch,
        url: String((c['html_url'] as string | undefined) ?? ''),
      };
    });
  } catch (err) {
    handleGitHubError(err, `getRepoCommits(${repoName}, ${branch})`);
  }
}

/**
 * Fetches all repos for the configured GitHub owner.
 * Useful for future "Connect Repository" feature.
 */
export async function getOwnerRepos(): Promise<GitHubRepo[]> {
  try {
    const { data: repos } = await github.get(`/users/${OWNER}/repos`, {
      params: { per_page: 50, sort: 'updated', type: 'all' },
    });

    return (repos as Array<Record<string, unknown>>).map((r) => ({
      id: Number(r['id']),
      name: String(r['name']),
      fullName: String(r['full_name']),
      description: (r['description'] as string | null) ?? null,
      language: (r['language'] as string | null) ?? null,
      defaultBranch: String(r['default_branch']),
      visibility: (r['visibility'] as 'public' | 'private') ?? 'public',
      stars: Number(r['stargazers_count'] ?? 0),
      updatedAt: String(r['updated_at'] ?? new Date().toISOString()),
      url: String(r['html_url'] ?? ''),
    }));
  } catch (err) {
    handleGitHubError(err, `getOwnerRepos(${OWNER})`);
  }
}

/**
 * Validates that a commit SHA exists in the repo. Used before triggering deploy.
 */
export async function validateCommitSha(repoName: string, sha: string): Promise<boolean> {
  try {
    await github.get(`/repos/${OWNER}/${repoName}/commits/${sha}`);
    return true;
  } catch {
    return false;
  }
}
