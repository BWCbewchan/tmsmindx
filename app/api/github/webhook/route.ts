import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const TELEGRAM_BOT_TOKEN = process.env.GITHUB_TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.GITHUB_TELEGRAM_CHAT_ID;


function verifySignature(bodyText: string, signature: string, secret: string): boolean {
  try {
    const hmac = crypto.createHmac('sha256', secret);
    const digest = 'sha256=' + hmac.update(bodyText).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  } catch (err) {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      console.error('[GitHubWebhook] GITHUB_TELEGRAM_BOT_TOKEN or GITHUB_TELEGRAM_CHAT_ID is missing in env');
      return NextResponse.json({ error: 'Telegram credentials not configured' }, { status: 500 });
    }

    const rawBody = await request.text();

    const signature = request.headers.get('x-hub-signature-256') || '';

    // Verify signature if secret is configured in env
    const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
    if (webhookSecret && !verifySignature(rawBody, signature, webhookSecret)) {
      console.error('[GitHubWebhook] Invalid signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);

    // Only process push events (default event sent by GitHub webhook when configured for push)
    if (!payload.ref) {
      return NextResponse.json({ success: true, message: 'Event ignored: No ref found' });
    }

    const ref = payload.ref;
    const repoName = payload.repository?.full_name || 'BWCbewchan/tpsmindx';
    const repoUrl = payload.repository?.html_url || '';
    const pusher = payload.pusher?.name || 'unknown';
    
    let branch = '';
    if (ref.startsWith('refs/heads/')) {
      branch = ref.replace('refs/heads/', '');
    } else if (ref.startsWith('refs/tags/')) {
      branch = `Tag: ${ref.replace('refs/tags/', '')}`;
    } else {
      branch = ref;
    }

    let messageText = '';

    if (payload.deleted) {
      messageText = `🗑️ <b>[GitHub]</b> Nhánh <code>${branch}</code> đã bị <b>XÓA</b> khỏi repository <a href="${repoUrl}">${repoName}</a> bởi <b>${pusher}</b>`;
    } else if (payload.created && (!payload.commits || payload.commits.length === 0)) {
      messageText = `🌿 <b>[GitHub]</b> Nhánh mới <code>${branch}</code> đã được <b>TẠO</b> trong repository <a href="${repoUrl}">${repoName}</a> bởi <b>${pusher}</b>`;
    } else {
      const commits = payload.commits || [];
      const commitCount = commits.length;
      
      if (commitCount === 0) {
        return NextResponse.json({ success: true, message: 'No commits in push event' });
      }

      messageText = `⚙️ <b>[GitHub]</b> Đã push <b>${commitCount}</b> commit${commitCount > 1 ? 's' : ''} lên nhánh <code>${branch}</code> của repository <a href="${repoUrl}">${repoName}</a> bởi <b>${pusher}</b>\n\n`;
      messageText += `<b>Danh sách commit:</b>\n`;

      // Limit to max 5 commits to avoid huge messages
      const displayedCommits = commits.slice(0, 5);
      displayedCommits.forEach((commit: any) => {
        const shortSha = commit.id.substring(0, 7);
        const commitMsg = commit.message.split('\n')[0]; // First line only
        const author = commit.author?.name || 'unknown';
        messageText += `• <a href="${commit.url}"><code>${shortSha}</code></a>: ${commitMsg} (bởi <i>${author}</i>)\n`;
      });

      if (commitCount > 5) {
        const remaining = commitCount - 5;
        const compareUrl = payload.compare || '';
        messageText += `• ...và <a href="${compareUrl}">${remaining} commit${remaining > 1 ? 's' : ''} khác</a>`;
      }
    }

    // Send to Telegram
    const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const response = await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: messageText,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[GitHubWebhook] Failed to send Telegram message:', errorText);
      return NextResponse.json({ error: 'Failed to notify Telegram' }, { status: 502 });
    }

    return NextResponse.json({ success: true, message: 'Telegram notification sent successfully' });
  } catch (error: any) {
    console.error('[GitHubWebhook] Error handling payload:', error);
    return NextResponse.json({ error: 'Server error processing webhook' }, { status: 500 });
  }
}
