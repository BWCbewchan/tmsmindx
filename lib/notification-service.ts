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
 * Creates an in-app notification for all active users.
 */
export async function createNotificationForEveryone(payload: Omit<NotificationPayload, 'recipientEmail'>): Promise<void> {
  const { title, content, type, link } = payload;
  let client;
  try {
    client = await pool.connect();
    // Get all active users
    const usersResult = await client.query('SELECT email FROM app_users WHERE is_active = true');
    const emails = usersResult.rows
      .map((row: any) => row.email?.trim().toLowerCase())
      .filter(Boolean);
    
    if (emails.length === 0) return;

    // Batch insert notifications in chunks of 100 to avoid parameter limit in query (though 65535 is high, batching is safer)
    const chunkSize = 100;
    for (let i = 0; i < emails.length; i += chunkSize) {
      const chunk = emails.slice(i, i + chunkSize);
      const values: any[] = [];
      const placeholders: string[] = [];
      let index = 1;
      
      for (const email of chunk) {
        placeholders.push(`($${index}, $${index + 1}, $${index + 2}, $${index + 3}, $${index + 4}, FALSE, NOW())`);
        values.push(email, title, content, type, link || null);
        index += 5;
      }
      
      const queryText = `
        INSERT INTO notifications (recipient_email, title, content, type, link, is_read, created_at)
        VALUES ${placeholders.join(', ')}
      `;
      await client.query(queryText, values);
    }
  } catch (err) {
    console.error('[NotificationService] Failed to create notifications for everyone:', err);
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
