export type EmailErrorCategory =
  | 'authentication'
  | 'configuration'
  | 'network'
  | 'provider'
  | 'quota'
  | 'recipient'
  | 'unknown'

export type EmailHealthStatus =
  | 'healthy'
  | 'warning'
  | 'critical'
  | 'no_data'

export interface EmailMonitoringMetrics {
  attempts: number
  failed: number
  skipped: number
  messages: number
  recipients: number
  avgLatencyMs: number
  p95LatencyMs: number
}

export interface EmailMonitoringSettings {
  dailyMessageLimit: number
  dailyRecipientLimit: number
  warningThresholdPercent: number
  latencyWarningMs: number
  failureRateWarningPercent: number
}

export interface EmailMonitoringConfiguration {
  gmailConfigured: boolean
  internalSecretConfigured: boolean
}

export interface EmailHealthReason {
  code: string
  severity: 'warning' | 'critical'
  message: string
}

export interface EmailHealthResult {
  status: EmailHealthStatus
  reasons: EmailHealthReason[]
  failureRatePercent: number
  messageUsagePercent: number
  recipientUsagePercent: number
}

type EmailLikeError = {
  code?: unknown
  command?: unknown
  message?: unknown
  response?: unknown
  responseCode?: unknown
}

function toSafeString(value: unknown, maxLength = 2000): string {
  return String(value ?? '').trim().slice(0, maxLength)
}

export function classifyEmailError(error: unknown): {
  category: EmailErrorCategory
  code: string
  message: string
  responseCode: number | null
  retryable: boolean
} {
  const candidate =
    error && typeof error === 'object' ? (error as EmailLikeError) : {}
  const code = toSafeString(candidate.code || 'UNKNOWN', 100) || 'UNKNOWN'
  const responseCodeRaw = Number(candidate.responseCode)
  const responseCode = Number.isFinite(responseCodeRaw)
    ? responseCodeRaw
    : null
  const message =
    toSafeString(candidate.response) ||
    toSafeString(candidate.message) ||
    toSafeString(error) ||
    'Unknown email error'
  const normalized = `${code} ${message}`.toLowerCase()

  if (
    normalized.includes('daily user sending limit') ||
    normalized.includes('sending limit exceeded') ||
    normalized.includes('quota exceeded') ||
    normalized.includes('too many messages') ||
    normalized.includes('rate limit') ||
    responseCode === 452
  ) {
    return {
      category: 'quota',
      code,
      message,
      responseCode,
      retryable: true,
    }
  }

  if (
    code === 'EAUTH' ||
    responseCode === 534 ||
    responseCode === 535 ||
    normalized.includes('invalid login') ||
    normalized.includes('username and password not accepted') ||
    normalized.includes('authentication')
  ) {
    return {
      category: 'authentication',
      code,
      message,
      responseCode,
      retryable: false,
    }
  }

  if (
    code === 'ECONNECTION' ||
    code === 'ETIMEDOUT' ||
    code === 'ECONNRESET' ||
    code === 'ENOTFOUND' ||
    normalized.includes('timeout') ||
    normalized.includes('socket') ||
    normalized.includes('connection')
  ) {
    return {
      category: 'network',
      code,
      message,
      responseCode,
      retryable: true,
    }
  }

  if (
    responseCode === 550 &&
    (normalized.includes('5.1.1') ||
      normalized.includes('does not exist') ||
      normalized.includes('user unknown') ||
      normalized.includes('recipient address rejected'))
  ) {
    return {
      category: 'recipient',
      code,
      message,
      responseCode,
      retryable: false,
    }
  }

  if (
    code.startsWith('MISSING_') ||
    normalized.includes('not configured') ||
    normalized.includes('missing credential')
  ) {
    return {
      category: 'configuration',
      code,
      message,
      responseCode,
      retryable: false,
    }
  }

  if (responseCode !== null && responseCode >= 400) {
    return {
      category: 'provider',
      code,
      message,
      responseCode,
      retryable: responseCode < 500,
    }
  }

  return {
    category: 'unknown',
    code,
    message,
    responseCode,
    retryable: false,
  }
}

export function percentile(values: number[], ratio: number): number {
  if (values.length === 0) return 0
  const sorted = values
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b)
  if (sorted.length === 0) return 0
  const clamped = Math.min(1, Math.max(0, ratio))
  const position = (sorted.length - 1) * clamped
  const lower = Math.floor(position)
  const upper = Math.ceil(position)
  if (lower === upper) return sorted[lower]
  const weight = position - lower
  return Math.round(sorted[lower] + (sorted[upper] - sorted[lower]) * weight)
}

function percentage(value: number, total: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) return 0
  return Number(((value / total) * 100).toFixed(2))
}

export function deriveEmailHealth(
  metrics: EmailMonitoringMetrics,
  settings: EmailMonitoringSettings,
  configuration: EmailMonitoringConfiguration,
): EmailHealthResult {
  const failureRatePercent = percentage(metrics.failed, metrics.attempts)
  const messageUsagePercent = percentage(
    metrics.messages,
    settings.dailyMessageLimit,
  )
  const recipientUsagePercent = percentage(
    metrics.recipients,
    settings.dailyRecipientLimit,
  )
  const reasons: EmailHealthReason[] = []

  if (!configuration.gmailConfigured) {
    reasons.push({
      code: 'gmail_not_configured',
      severity: 'critical',
      message: 'Chưa cấu hình đầy đủ tài khoản hoặc mật khẩu Gmail.',
    })
  }
  if (!configuration.internalSecretConfigured) {
    reasons.push({
      code: 'internal_secret_not_configured',
      severity: 'critical',
      message: 'Chưa cấu hình INTERNAL_API_SECRET cho luồng gửi mail nội bộ.',
    })
  }

  if (messageUsagePercent >= 100) {
    reasons.push({
      code: 'message_quota_exceeded',
      severity: 'critical',
      message: 'Số thư trong 24 giờ đã đạt hạn mức vận hành.',
    })
  } else if (messageUsagePercent >= settings.warningThresholdPercent) {
    reasons.push({
      code: 'message_quota_warning',
      severity: 'warning',
      message: 'Số thư trong 24 giờ đang gần hạn mức vận hành.',
    })
  }

  if (recipientUsagePercent >= 100) {
    reasons.push({
      code: 'recipient_quota_exceeded',
      severity: 'critical',
      message: 'Số lượt người nhận trong 24 giờ đã đạt hạn mức vận hành.',
    })
  } else if (recipientUsagePercent >= settings.warningThresholdPercent) {
    reasons.push({
      code: 'recipient_quota_warning',
      severity: 'warning',
      message: 'Số lượt người nhận đang gần hạn mức vận hành.',
    })
  }

  if (
    metrics.attempts > 0 &&
    failureRatePercent >= settings.failureRateWarningPercent * 2
  ) {
    reasons.push({
      code: 'failure_rate_critical',
      severity: 'critical',
      message: 'Tỷ lệ gửi lỗi cao hơn gấp đôi ngưỡng cảnh báo.',
    })
  } else if (
    metrics.attempts > 0 &&
    failureRatePercent >= settings.failureRateWarningPercent
  ) {
    reasons.push({
      code: 'failure_rate_warning',
      severity: 'warning',
      message: 'Tỷ lệ gửi lỗi đã vượt ngưỡng cảnh báo.',
    })
  }

  if (metrics.p95LatencyMs >= settings.latencyWarningMs * 2) {
    reasons.push({
      code: 'latency_critical',
      severity: 'critical',
      message: 'Độ trễ P95 cao hơn gấp đôi ngưỡng cảnh báo.',
    })
  } else if (metrics.p95LatencyMs >= settings.latencyWarningMs) {
    reasons.push({
      code: 'latency_warning',
      severity: 'warning',
      message: 'Độ trễ P95 đã vượt ngưỡng cảnh báo.',
    })
  }

  if (
    metrics.attempts === 0 &&
    reasons.length === 0
  ) {
    return {
      status: 'no_data',
      reasons: [],
      failureRatePercent,
      messageUsagePercent,
      recipientUsagePercent,
    }
  }

  const status: EmailHealthStatus = reasons.some(
    (reason) => reason.severity === 'critical',
  )
    ? 'critical'
    : reasons.length > 0
      ? 'warning'
      : 'healthy'

  return {
    status,
    reasons,
    failureRatePercent,
    messageUsagePercent,
    recipientUsagePercent,
  }
}
