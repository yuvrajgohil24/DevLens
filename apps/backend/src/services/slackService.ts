import axios from 'axios';

interface SlackAlertProps {
  title: string;
  message: string;
  level: 'info' | 'warning' | 'critical';
  details?: Record<string, string>;
}

export async function sendSlackAlert({ title, message, level, details }: SlackAlertProps) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  
  if (!webhookUrl) {
    console.warn('⚠️ SLACK_WEBHOOK_URL is not set. Skipping Slack notification.');
    return;
  }

  const colorMap = {
    info: '#3b82f6',     // Blue
    warning: '#f59e0b',  // Yellow
    critical: '#ef4444', // Red
  };

  // Build the block kit message
  const payload = {
    attachments: [
      {
        color: colorMap[level],
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: title,
              emoji: true,
            },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: message,
            },
          },
          ...(details ? [
            {
              type: 'section',
              fields: Object.entries(details).map(([key, value]) => ({
                type: 'mrkdwn',
                text: `*${key}:*\n${value}`,
              })),
            }
          ] : [])
        ],
      },
    ],
  };

  try {
    await axios.post(webhookUrl, payload);
    console.log(`✅ Slack alert sent: ${title}`);
  } catch (error: any) {
    console.error('❌ Failed to send Slack alert:', error.message);
  }
}
