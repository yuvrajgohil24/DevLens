/**
 * Unit tests for the Slack alert payloads.
 */

const post = jest.fn().mockResolvedValue({});
jest.mock('axios', () => ({ __esModule: true, default: { post } }));

import { sendSlackAlert } from '../services/slackService';

describe('sendSlackAlert', () => {
  const originalUrl = process.env.SLACK_WEBHOOK_URL;

  beforeEach(() => {
    post.mockClear();
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.test/abc';
  });

  afterAll(() => {
    if (originalUrl === undefined) delete process.env.SLACK_WEBHOOK_URL;
    else process.env.SLACK_WEBHOOK_URL = originalUrl;
  });

  it('sends a single structured alert including the policy reason and extra details', async () => {
    await sendSlackAlert({
      serviceName: 'devlens-backend',
      environment: 'production',
      status: 'failed',
      riskScore: 8.9,
      criticalCount: 2,
      commitSha: 'abc1234def',
      branch: 'main',
      reason: 'Deployment blocked: 1 critical CVE(s) and 1 leaked secret(s) detected.',
      details: { 'Total CVEs': '12', 'Leaked Secrets': '1' },
    });

    expect(post).toHaveBeenCalledTimes(1);
    const attachment = post.mock.calls[0][1].attachments[0];
    expect(attachment.title).toBe('🛑 Security scan BLOCKED: devlens-backend');
    expect(attachment.text).toBe('Deployment blocked: 1 critical CVE(s) and 1 leaked secret(s) detected.');
    expect(attachment.fields).toEqual(
      expect.arrayContaining([
        { title: 'Total CVEs', value: '12', short: true },
        { title: 'Leaked Secrets', value: '1', short: true },
        { title: 'Commit', value: '`abc1234`', short: true },
      ])
    );
  });

  it('skips silently when SLACK_WEBHOOK_URL is not set', async () => {
    delete process.env.SLACK_WEBHOOK_URL;
    await sendSlackAlert({ title: 't', message: 'm', level: 'info' });
    expect(post).not.toHaveBeenCalled();
  });
});
