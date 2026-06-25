import assert from 'node:assert/strict'
import test from 'node:test'

import {
  classifyEmailError,
  deriveEmailHealth,
  percentile,
} from './email-monitoring.ts'

test('classifies Gmail daily limit errors as quota and retryable', () => {
  const result = classifyEmailError({
    code: 'EENVELOPE',
    responseCode: 550,
    response: '550 5.4.5 Daily user sending limit exceeded',
  })

  assert.equal(result.category, 'quota')
  assert.equal(result.retryable, true)
  assert.equal(result.code, 'EENVELOPE')
})

test('classifies authentication errors separately', () => {
  const result = classifyEmailError({
    code: 'EAUTH',
    responseCode: 535,
    message: 'Invalid login: Username and Password not accepted',
  })

  assert.equal(result.category, 'authentication')
  assert.equal(result.retryable, false)
})

test('classifies invalid recipients as recipient errors', () => {
  const result = classifyEmailError({
    code: 'EENVELOPE',
    responseCode: 550,
    response: '550 5.1.1 The email account that you tried to reach does not exist',
  })

  assert.equal(result.category, 'recipient')
  assert.equal(result.retryable, false)
})

test('classifies missing leave-email routing data as configuration errors', () => {
  const result = classifyEmailError({
    code: 'MISSING_CAMPUS_BU_EMAIL',
    message: 'Không có email BU/CS cơ sở để gửi mail xin nghỉ.',
  })

  assert.equal(result.category, 'configuration')
  assert.equal(result.retryable, false)
})

test('calculates interpolated percentile', () => {
  assert.equal(percentile([100, 200, 300, 400], 0.95), 385)
  assert.equal(percentile([], 0.95), 0)
})

test('returns no_data when there are no attempts', () => {
  const health = deriveEmailHealth(
    {
      attempts: 0,
      failed: 0,
      skipped: 0,
      messages: 0,
      recipients: 0,
      avgLatencyMs: 0,
      p95LatencyMs: 0,
    },
    {
      dailyMessageLimit: 2000,
      dailyRecipientLimit: 10000,
      warningThresholdPercent: 80,
      latencyWarningMs: 5000,
      failureRateWarningPercent: 5,
    },
    { gmailConfigured: true, internalSecretConfigured: true },
  )

  assert.equal(health.status, 'no_data')
})

test('returns critical when Gmail is not configured', () => {
  const health = deriveEmailHealth(
    {
      attempts: 1,
      failed: 0,
      skipped: 1,
      messages: 0,
      recipients: 0,
      avgLatencyMs: 0,
      p95LatencyMs: 0,
    },
    {
      dailyMessageLimit: 2000,
      dailyRecipientLimit: 10000,
      warningThresholdPercent: 80,
      latencyWarningMs: 5000,
      failureRateWarningPercent: 5,
    },
    { gmailConfigured: false, internalSecretConfigured: true },
  )

  assert.equal(health.status, 'critical')
  assert.ok(health.reasons.some((reason) => reason.code === 'gmail_not_configured'))
})

test('returns warning when latency or quota crosses configured thresholds', () => {
  const health = deriveEmailHealth(
    {
      attempts: 100,
      failed: 2,
      skipped: 0,
      messages: 1650,
      recipients: 3000,
      avgLatencyMs: 1200,
      p95LatencyMs: 6200,
    },
    {
      dailyMessageLimit: 2000,
      dailyRecipientLimit: 10000,
      warningThresholdPercent: 80,
      latencyWarningMs: 5000,
      failureRateWarningPercent: 5,
    },
    { gmailConfigured: true, internalSecretConfigured: true },
  )

  assert.equal(health.status, 'warning')
  assert.ok(health.reasons.some((reason) => reason.code === 'message_quota_warning'))
  assert.ok(health.reasons.some((reason) => reason.code === 'latency_warning'))
})
