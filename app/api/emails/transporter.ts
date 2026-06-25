import nodemailer from 'nodemailer'

import { ensureEmailLogoInHtml, prepareEmailForSend } from '@/lib/email-branding'
import {
  getEmailAccountConfigurationSummary,
  getEmailSenderAccount,
  getFirstActiveEmailSenderAccount,
  recordEmailAccountVerification,
  selectNextEmailSenderAccount,
  type ResolvedEmailSenderAccount,
} from '@/lib/email-accounts'
import {
  normalizeEmailRecipients,
  recordEmailDelivery,
} from '@/lib/email-delivery-log'

export interface MailPayload {
  to: string | string[]
  cc?: string | string[]
  subject: string
  html: string
  emailType?: string
  source?: string
  metadata?: Record<string, unknown>
  senderAccountId?: number
}

export interface MailSendResult {
  sent: boolean
  warning?: string
  messageId?: string
  response?: string
  durationMs: number
  senderAccountId?: number
  senderEmail?: string
}

function createAccountTransporter(account: ResolvedEmailSenderAccount) {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: account.email,
      pass: account.appPassword,
    },
  })
}

export async function getMailTransportConfiguration() {
  const summary = await getEmailAccountConfigurationSummary()
  return {
    configured: summary.configured,
    userConfigured: summary.configured,
    passwordConfigured: summary.configured,
    senderEmail: summary.senderEmail,
    provider: 'gmail',
    activeAccountCount: summary.activeAccountCount,
    totalAccountCount: summary.totalAccountCount,
  }
}

export async function verifyMailTransport(accountId?: number): Promise<{
  ok: boolean
  durationMs: number
  error?: string
  accountId?: number
  senderEmail?: string
}> {
  const startedAt = Date.now()
  const account = accountId
    ? await getEmailSenderAccount(accountId)
    : await getFirstActiveEmailSenderAccount()
  if (!account) {
    return {
      ok: false,
      durationMs: Date.now() - startedAt,
      error: 'GMAIL_NOT_CONFIGURED',
    }
  }

  try {
    await createAccountTransporter(account).verify()
    await recordEmailAccountVerification(account.id, true)
    return {
      ok: true,
      durationMs: Date.now() - startedAt,
      accountId: account.id,
      senderEmail: account.email,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await recordEmailAccountVerification(account.id, false, message)
    return {
      ok: false,
      durationMs: Date.now() - startedAt,
      error: message,
      accountId: account.id,
      senderEmail: account.email,
    }
  }
}

export async function sendMail(payload: MailPayload): Promise<MailSendResult> {
  const startedAt = Date.now()
  const toRecipients = normalizeEmailRecipients(payload.to)
  const ccRecipients = normalizeEmailRecipients(payload.cc)
  const {
    emailType = 'unknown',
    source = 'app/api/emails',
    metadata,
    senderAccountId,
    ...mailOptions
  } = payload

  let account: ResolvedEmailSenderAccount | null = null
  try {
    account = senderAccountId
      ? await getEmailSenderAccount(senderAccountId)
      : await selectNextEmailSenderAccount()
  } catch (error) {
    const durationMs = Date.now() - startedAt
    await recordEmailDelivery({
      status: 'skipped',
      senderAccountId: senderAccountId || null,
      senderEmail: null,
      toRecipients,
      ccRecipients,
      subject: payload.subject,
      emailType,
      source,
      durationMs,
      error,
      metadata,
    })
    throw error
  }

  if (!account) {
    const durationMs = Date.now() - startedAt
    await recordEmailDelivery({
      status: 'skipped',
      senderEmail: null,
      toRecipients,
      ccRecipients,
      subject: payload.subject,
      emailType,
      source,
      durationMs,
      error: {
        code: 'GMAIL_NOT_CONFIGURED',
        message: 'No active Gmail account is configured',
      },
      metadata,
    })
    return { sent: false, warning: 'GMAIL_NOT_CONFIGURED', durationMs }
  }

  try {
    const html = ensureEmailLogoInHtml(mailOptions.html)
    const { html: preparedHtml, attachments } = prepareEmailForSend(html)
    const info = await createAccountTransporter(account).sendMail({
      from: `"${account.displayName}" <${account.email}>`,
      ...mailOptions,
      html: preparedHtml,
      ...(attachments.length > 0 ? { attachments } : {}),
    })
    const durationMs = Date.now() - startedAt
    const messageId = String(info?.messageId ?? '')
    const response = String(info?.response ?? '')

    await recordEmailDelivery({
      status: 'sent',
      senderAccountId: account.id,
      senderEmail: account.email,
      toRecipients,
      ccRecipients,
      subject: payload.subject,
      emailType,
      source,
      durationMs,
      providerMessageId: messageId,
      smtpResponse: response,
      metadata: {
        ...metadata,
        senderAccountKey: account.accountKey,
        senderAccountSource: account.source,
        accepted: Array.isArray(info?.accepted) ? info.accepted : [],
        rejected: Array.isArray(info?.rejected) ? info.rejected : [],
        pending: Array.isArray(info?.pending) ? info.pending : [],
      },
    })

    return {
      sent: true,
      messageId: messageId || undefined,
      response: response || undefined,
      durationMs,
      senderAccountId: account.id,
      senderEmail: account.email,
    }
  } catch (error) {
    const durationMs = Date.now() - startedAt
    await recordEmailDelivery({
      status: 'failed',
      senderAccountId: account.id,
      senderEmail: account.email,
      toRecipients,
      ccRecipients,
      subject: payload.subject,
      emailType,
      source,
      durationMs,
      error,
      metadata: {
        ...metadata,
        senderAccountKey: account.accountKey,
        senderAccountSource: account.source,
      },
    })
    throw error
  }
}
