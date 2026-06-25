import fs from 'fs';
import path from 'path';

/** Logo gốc (Google CDN) — dùng khi tải/cập nhật file local. */
export const MINDX_EMAIL_LOGO_URL =
  'https://lh4.googleusercontent.com/QL0TlbW3b2hcxZLahie7MPahzqxqvyO8mw36RDPdUGzJ4DapWLV0qOtm--jK_ioq7rtNt3EfG_xvIvZ9VVHvjLHIUDx1wKRxppsPqBTDoqDq65eSWPTBnYTe-LTmH24v35KVpsnxv8aO_44n5o2BZjxDU_xaiCvJ5Mj-kvytVGyjK-0UZNzFIuIeud82zg';

/** CID inline — Outlook/Gmail hiển thị ổn định (không bị strip src URL ngoài). */
export const MINDX_EMAIL_LOGO_CID = 'mindxlogo';

const LOGO_WIDTH = 160;
const LOGO_HEIGHT = 54;
const LOGO_FILENAME = 'mindx-logo-google.png';

export function getMindxEmailLogoPath(): string {
  const preferred = path.join(process.cwd(), 'public', 'email', LOGO_FILENAME);
  if (fs.existsSync(preferred)) return preferred;
  return path.join(process.cwd(), 'public', 'email', 'mindx-logo-email.png');
}

export function getEmailLogoSrc(): string {
  return `cid:${MINDX_EMAIL_LOGO_CID}`;
}

export function getStaticEmailLogoUrl(): string {
  return MINDX_EMAIL_LOGO_URL;
}

export function getEmailBrandingVars(): Record<string, string> {
  return {
    logo_url: getEmailLogoSrc(),
    brand_primary: '#d0021b',
    brand_name: 'Teaching K12 - MindX',
    brand_tagline: 'Be extraordinary',
  };
}

export function getEmailLogoHtml(): string {
  return `<img class="email-logo" src="cid:${MINDX_EMAIL_LOGO_CID}" width="${LOGO_WIDTH}" height="${LOGO_HEIGHT}" alt="MindX" border="0" style="display:block;width:${LOGO_WIDTH}px;height:${LOGO_HEIGHT}px;max-width:${LOGO_WIDTH}px;margin:0 auto 16px auto;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;" />`;
}

export type InlineLogoAttachment = {
  filename: string;
  path: string;
  cid: string;
  contentDisposition: 'inline';
  contentType: string;
};

export function getMindxLogoAttachment(): InlineLogoAttachment | null {
  const logoPath = getMindxEmailLogoPath();
  if (!fs.existsSync(logoPath)) return null;
  return {
    filename: 'mindx-logo.png',
    path: logoPath,
    cid: MINDX_EMAIL_LOGO_CID,
    contentDisposition: 'inline',
    contentType: 'image/png',
  };
}

function htmlNeedsInlineLogo(html: string): boolean {
  return (
    html.includes(`cid:${MINDX_EMAIL_LOGO_CID}`) ||
    html.includes('class="email-logo"') ||
    html.includes("class='email-logo'")
  );
}

/** Đính kèm logo inline khi HTML có thẻ logo. */
export function prepareEmailForSend(html: string): {
  html: string;
  attachments: InlineLogoAttachment[];
} {
  if (!htmlNeedsInlineLogo(html)) {
    return { html, attachments: [] };
  }
  const attachment = getMindxLogoAttachment();
  if (!attachment) {
    return { html, attachments: [] };
  }
  return { html, attachments: [attachment] };
}

/** Gắn logo CID vào đầu HTML nếu chưa có. */
export function ensureEmailLogoInHtml(html: string): string {
  if (htmlNeedsInlineLogo(html)) {
    return html;
  }
  return `${getEmailLogoHtml()}${html}`;
}
