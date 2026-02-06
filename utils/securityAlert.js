import { logger } from './logger.js';

const webhook = process.env.SECURITY_ALERT_WEBHOOK_URL;

export const sendSecurityAlert = async (payload) => {
  if (!webhook) {
    logger.warn('Security alert webhook not configured', payload);
    return;
  }

  try {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    logger.error('Failed to send security alert', { error: err?.message || err });
  }
};
