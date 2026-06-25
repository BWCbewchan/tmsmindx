import fs from 'fs';
import path from 'path';
import { getEmailBrandingVars, getEmailLogoHtml } from '@/lib/email-branding';

const TEMPLATE_DIR = path.join(process.cwd(), 'app', 'api', 'emails', 'templates');

function readSharedEmailStyles(): string {
  const stylesPath = path.join(TEMPLATE_DIR, '_email-styles.html');
  return fs.readFileSync(stylesPath, 'utf-8');
}

export function renderTemplate(
  templateName: string,
  vars: Record<string, string | undefined>,
): string {
  const templatePath = path.join(TEMPLATE_DIR, `${templateName}.html`);
  let html = fs.readFileSync(templatePath, 'utf-8');

  const mergedVars: Record<string, string | undefined> = {
    ...getEmailBrandingVars(),
    email_logo_html: getEmailLogoHtml(),
    email_styles: readSharedEmailStyles(),
    ...vars,
  };

  for (const [key, value] of Object.entries(mergedVars)) {
    const replacement = value ?? '';
    html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), () => replacement);
  }

  html = html.replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_match, varName, block) => {
    const replacement = mergedVars[varName] ?? '';
    return mergedVars[varName]
      ? block.replace(new RegExp(`\\{\\{${varName}\\}\\}`, 'g'), () => replacement)
      : '';
  });

  return html;
}
