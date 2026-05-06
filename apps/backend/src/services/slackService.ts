import axios from 'axios';

interface SlackAlertData {
  serviceName: string;
  environment: string;
  status: 'success' | 'failed';
  riskScore: number;
  criticalCount: number;
  pipelineUrl?: string;
  commitSha: string;
  branch: string;
}

export async function sendSlackAlert(data: SlackAlertData) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    console.warn('⚠️ SLACK_WEBHOOK_URL is not set. Skipping Slack notification.');
    return;
  }

  const isFailed = data.status === 'failed';
  const color = isFailed ? '#FF0000' : '#36a64f';
  const emoji = isFailed ? '🛑' : '✅';

  const payload = {
    attachments: [
      {
        color: color,
        title: `${emoji} Deployment ${data.status.toUpperCase()}: ${data.serviceName}`,
        title_link: data.pipelineUrl,
        fields: [
          {
            title: 'Service',
            value: data.serviceName,
            short: true,
          },
          {
            title: 'Environment',
            value: data.environment,
            short: true,
          },
          {
            title: 'Branch',
            value: data.branch,
            short: true,
          },
          {
            title: 'Risk Score',
            value: `*${data.riskScore}*`,
            short: true,
          },
          {
            title: 'Critical Issues',
            value: `*${data.criticalCount}*`,
            short: true,
          },
          {
            title: 'Commit',
            value: `\`${data.commitSha.slice(0, 7)}\``,
            short: true,
          },
        ],
        footer: 'DevLens Security Platform',
        ts: Math.floor(Date.now() / 1000),
      },
    ],
  };

  try {
    await axios.post(webhookUrl, payload);
    console.log('✅ Slack alert sent successfully');
  } catch (err: any) {
    console.error('❌ Failed to send Slack alert:', err.response?.data || err.message);
  }
}
