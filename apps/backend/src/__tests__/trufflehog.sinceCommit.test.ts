/**
 * TRUFFLEHOG_SINCE_COMMIT: skip known old history, but only in repos that contain the commit.
 * Uses this repository's real git history (CI checks out with enough depth for HEAD).
 */

import { execFileSync } from 'child_process';
import path from 'path';

// Capture the TruffleHog command instead of running a binary; keep real execFile for git
const execCalls: string[] = [];
jest.mock('child_process', () => {
  const actual = jest.requireActual('child_process');
  return {
    ...actual,
    exec: (cmd: string, _opts: unknown, cb: (err: Error | null, out?: { stdout: string; stderr: string }) => void) => {
      execCalls.push(cmd);
      cb(null, { stdout: '', stderr: '' });
    },
  };
});

import { resolveSinceCommit, runTruffleHog } from '../scanners/truffleHog';

const repoRoot = path.resolve(__dirname, '../../../..');
const headSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot }).toString().trim();

describe('resolveSinceCommit', () => {
  const original = process.env.TRUFFLEHOG_SINCE_COMMIT;
  afterEach(() => {
    if (original === undefined) delete process.env.TRUFFLEHOG_SINCE_COMMIT;
    else process.env.TRUFFLEHOG_SINCE_COMMIT = original;
  });

  it('is off when the env var is not set', async () => {
    delete process.env.TRUFFLEHOG_SINCE_COMMIT;
    expect(await resolveSinceCommit(repoRoot)).toBeUndefined();
  });

  it('expands a commit that exists in the repo to its full SHA', async () => {
    process.env.TRUFFLEHOG_SINCE_COMMIT = headSha.slice(0, 10);
    expect(await resolveSinceCommit(repoRoot)).toBe(headSha);
  });

  it('falls back to a full scan when the commit is not in this repo', async () => {
    process.env.TRUFFLEHOG_SINCE_COMMIT = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef';
    expect(await resolveSinceCommit(repoRoot)).toBeUndefined();
  });

  it('ignores values that are not commit SHAs (never reach the shell)', async () => {
    process.env.TRUFFLEHOG_SINCE_COMMIT = 'HEAD; rm -rf /';
    expect(await resolveSinceCommit(repoRoot)).toBeUndefined();
  });

  it('does not apply to remote URLs', async () => {
    process.env.TRUFFLEHOG_SINCE_COMMIT = headSha;
    expect(await resolveSinceCommit('https://github.com/yuvrajgohil24/DevLens')).toBeUndefined();
  });
});

describe('runTruffleHog command', () => {
  beforeEach(() => {
    execCalls.length = 0;
    process.env.TRUFFLEHOG_BIN = 'trufflehog';
  });
  afterAll(() => {
    delete process.env.TRUFFLEHOG_SINCE_COMMIT;
    delete process.env.TRUFFLEHOG_BIN;
  });

  it('passes --since-commit when the commit is in the scanned repo', async () => {
    process.env.TRUFFLEHOG_SINCE_COMMIT = headSha;
    await runTruffleHog(repoRoot);
    expect(execCalls[0]).toContain(`--since-commit ${headSha}`);
  });

  it('scans full history otherwise', async () => {
    delete process.env.TRUFFLEHOG_SINCE_COMMIT;
    await runTruffleHog(repoRoot);
    expect(execCalls[0]).not.toContain('--since-commit');
  });
});
