import axios, { AxiosError } from 'axios';

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
  if (axErr.response?.status === 401) {
    throw new Error(`GitHub: Unauthorized — check GITHUB_TOKEN (${context})`);
  }
  if (axErr.response?.status === 403) {
    const rateReset = axErr.response.headers['x-ratelimit-reset'];
    const resetTime = rateReset ? new Date(Number(rateReset) * 1000).toISOString() : 'unknown';
    throw new Error(`GitHub: Rate limit hit — resets at ${resetTime} (${context})`);
  }
  if (axErr.response?.status === 404) {
    throw new Error(`GitHub: Repository not found (${context})`);
  }
  throw new Error(`GitHub API error in ${context}: ${axErr.message}`);
}

// ── Service functions ──────────────────────────────────────────────────────

/**
 * Resolves a repo name from a DevLens service name.
 * Falls back to GITHUB_REPO env variable if no match found.
 * Future: could query DB to look up `repoUrl` on the Service record.
 */
export function resolveRepo(serviceName: string): string {
  const envRepo = process.env.GITHUB_REPO;
  // If service name looks like a real repo (contains known-repo name), use it directly.
  // Otherwise fallback to the configured default repo.
  if (envRepo && serviceName.toLowerCase() === envRepo.toLowerCase()) {
    return envRepo;
  }
  // Default: use the configured repo; allows DevFlow to work with a single repo
  return envRepo || serviceName;
}

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
