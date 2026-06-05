import pool from './db';
import { getPublicBaseUrl } from './public-base-url';

interface NotificationPayload {
  recipientEmail: string;
  title: string;
  content: string;
  type: string;
  link?: string;
}

/**
 * Creates an in-app notification for a user.
 */
export async function createNotification(payload: NotificationPayload): Promise<void> {
  const { recipientEmail, title, content, type, link } = payload;
  let client;
  try {
    client = await pool.connect();
    await client.query(
      `INSERT INTO notifications (recipient_email, title, content, type, link, is_read, created_at)
       VALUES ($1, $2, $3, $4, $5, FALSE, NOW())`,
      [recipientEmail.trim().toLowerCase(), title, content, type, link || null]
    );
  } catch (err) {
    console.error('[NotificationService] Failed to create in-app notification:', err);
  } finally {
    client?.release();
  }
}

/**
 * Sends an email notification via the internal /api/emails API.
 * This is ONLY called for leave request results (approvals/rejections/substitute confirmations).
 */
export async function sendEmailNotification(type: string, data: Record<string, unknown>): Promise<void> {
  try {
    const baseUrl = getPublicBaseUrl();
    await fetch(`${baseUrl}/api/emails`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.INTERNAL_API_SECRET
          ? { 'x-internal-api-secret': process.env.INTERNAL_API_SECRET }
          : {}),
      },
      body: JSON.stringify({ type, data }),
    });
  } catch (err) {
    console.error('[NotificationService] Email send failed:', err);
  }
}

/**
 * Sends a Telegram notification to the administrator group.
 * Useful for alerting admins about critical requests (e.g. salary deals or new leave requests).
 */
export async function sendTelegramNotification(message: string): Promise<void> {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) return;
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'Markdown' }),
    });
  } catch (err) {
    console.error('[NotificationService] Telegram send failed:', err);
  }
}
