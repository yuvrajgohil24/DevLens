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

interface GenericSlackAlert {
  title: string;
  message: string;
  level: 'info' | 'warning' | 'critical';
  details?: Record<string, string>;
}

export async function sendSlackAlert(data: SlackAlertData | GenericSlackAlert) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    console.warn('⚠️ SLACK_WEBHOOK_URL is not set. Skipping Slack notification.');
    return;
  }

  let payload: any;

  if ('serviceName' in data) {
    // Structured Deployment Alert
    const isFailed = data.status === 'failed';
    const color = isFailed ? '#FF0000' : '#36a64f';
    const emoji = isFailed ? '🛑' : '✅';

    payload = {
      attachments: [
        {
          color: color,
          title: `${emoji} Deployment ${data.status.toUpperCase()}: ${data.serviceName}`,
          title_link: data.pipelineUrl,
          fields: [
            { title: 'Service', value: data.serviceName, short: true },
            { title: 'Environment', value: data.environment, short: true },
            { title: 'Branch', value: data.branch, short: true },
            { title: 'Risk Score', value: `*${data.riskScore}*`, short: true },
            { title: 'Critical Issues', value: `*${data.criticalCount}*`, short: true },
            { title: 'Commit', value: `\`${data.commitSha.slice(0, 7)}\``, short: true },
          ],
          footer: 'DevLens Security Platform',
          ts: Math.floor(Date.now() / 1000),
        },
      ],
    };
  } else {
    // Generic System/Security Alert
    const colors = { info: '#36a64f', warning: '#FFA500', critical: '#FF0000' };
    payload = {
      attachments: [
        {
          color: colors[data.level] || '#808080',
          title: data.title,
          text: data.message,
          fields: data.details ? Object.entries(data.details).map(([k, v]) => ({ title: k, value: v, short: true })) : [],
          footer: 'DevLens System Monitor',
          ts: Math.floor(Date.now() / 1000),
        },
      ],
    };
  }

  try {
    await axios.post(webhookUrl, payload);
    console.log('✅ Slack alert sent successfully');
  } catch (err: any) {
    console.error('❌ Failed to send Slack alert:', err.response?.data || err.message);
  }
}
