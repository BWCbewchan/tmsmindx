import type { PoolClient } from 'pg'

import pool from '@/lib/db'
import { decryptEmailCredential, encryptEmailCredential } from '@/lib/email-account-crypto'
import { chooseNextEmailAccountId } from '@/lib/email-account-router'

export type EmailAccountSource = 'env' | 'database'

export interface EmailSenderAccount {
  id: number
  accountKey: string
  email: string
  displayName: string
  source: EmailAccountSource
  encryptedAppPassword: string | null
  isActive: boolean
  dailyToLimit: number
  dailyCcLimit: number
  sortOrder: number
}

export interface ResolvedEmailSenderAccount extends EmailSenderAccount {
  appPassword: string
}

type AccountRow = {
  id: unknown
  account_key: unknown
  email: unknown
  display_name: unknown
  source: unknown
  encrypted_app_password: unknown
  is_active: unknown
  daily_to_limit: unknown
  daily_cc_limit: unknown
  sort_order: unknown
}

type EnvAccountDefinition = {
  accountKey: string
  email: string
  appPassword: string
  displayName: string
  sortOrder: number
}

function getEncryptionSecret(): string {
  const secret = process.env.EMAIL_CREDENTIAL_ENCRYPTION_KEY?.trim()
  if (!secret) {
    throw new Error('EMAIL_CREDENTIAL_ENCRYPTION_KEY chưa được cấu hình.')
  }
  return secret
}

function getEnvAccountDefinitions(): EnvAccountDefinition[] {
  const primaryEmail = (
    process.env.GMAIL_USER ||
    process.env.MAILDEV_INCOMING_USER ||
    ''
  ).trim()
  const primaryPassword = (
    process.env.GMAIL_APP_PASSWORD ||
    process.env.MAILDEV_INCOMING_PASS ||
    ''
  ).trim()
  const secondaryEmail = (process.env.EMAIL_ACCOUNT_2_USER || '').trim()
  const secondaryPassword = (
    process.env.EMAIL_ACCOUNT_2_APP_PASSWORD || ''
  ).trim()

  return [
    {
      accountKey: 'env-primary',
      email: primaryEmail,
      appPassword: primaryPassword,
      displayName: process.env.EMAIL_ACCOUNT_1_NAME?.trim() || 'TPS Teaching',
      sortOrder: 10,
    },
    {
      accountKey: 'env-secondary',
      email: secondaryEmail,
      appPassword: secondaryPassword,
      displayName:
        process.env.EMAIL_ACCOUNT_2_NAME?.trim() || 'TPS HR Teaching',
      sortOrder: 20,
    },
  ].filter((account) => account.email && account.appPassword)
}

function mapAccountRow(row: AccountRow): EmailSenderAccount {
  return {
    id: Number(row.id),
    accountKey: String(row.account_key),
    email: String(row.email),
    displayName: String(row.display_name || 'TPS Teaching'),
    source: row.source === 'env' ? 'env' : 'database',
    encryptedAppPassword: row.encrypted_app_password
      ? String(row.encrypted_app_password)
      : null,
    isActive: Boolean(row.is_active),
    dailyToLimit: Number(row.daily_to_limit || 2000),
    dailyCcLimit: Number(row.daily_cc_limit || 2000),
    sortOrder: Number(row.sort_order || 0),
  }
}

export async function syncEnvEmailAccounts(): Promise<void> {
  const definitions = getEnvAccountDefinitions()
  const configuredKeys = definitions.map((account) => account.accountKey)
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    const settingsResult = await client.query(
      `SELECT default_to_limit, default_cc_limit
       FROM email_monitor_settings
       WHERE id = 1`,
    )
    const defaultToLimit = Number(
      settingsResult.rows[0]?.default_to_limit || 2000,
    )
    const defaultCcLimit = Number(
      settingsResult.rows[0]?.default_cc_limit || 2000,
    )

    for (const account of definitions) {
      await client.query(
        `INSERT INTO email_sender_accounts (
          account_key, email, display_name, source, is_active,
          daily_to_limit, daily_cc_limit, sort_order, updated_at
        ) VALUES ($1, $2, $3, 'env', TRUE, $4, $5, $6, CURRENT_TIMESTAMP)
        ON CONFLICT (account_key) DO UPDATE SET
          email = EXCLUDED.email,
          display_name = EXCLUDED.display_name,
          source = 'env',
          sort_order = EXCLUDED.sort_order,
          updated_at = CURRENT_TIMESTAMP`,
        [
          account.accountKey,
          account.email.toLowerCase(),
          account.displayName,
          defaultToLimit,
          defaultCcLimit,
          account.sortOrder,
        ],
      )
    }

    if (configuredKeys.length > 0) {
      await client.query(
        `UPDATE email_sender_accounts
         SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
         WHERE source = 'env'
           AND NOT (account_key = ANY($1::text[]))`,
        [configuredKeys],
      )
    } else {
      await client.query(
        `UPDATE email_sender_accounts
         SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
         WHERE source = 'env'`,
      )
    }

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

function resolveCredential(account: EmailSenderAccount): string {
  if (account.source === 'env') {
    const definition = getEnvAccountDefinitions().find(
      (candidate) => candidate.accountKey === account.accountKey,
    )
    if (!definition?.appPassword) {
      throw new Error(`Tài khoản ${account.email} thiếu App Password trong env.`)
    }
    return definition.appPassword
  }

  if (!account.encryptedAppPassword) {
    throw new Error(`Tài khoản ${account.email} chưa có App Password.`)
  }
  return decryptEmailCredential(
    account.encryptedAppPassword,
    getEncryptionSecret(),
  )
}

async function getAccountRows(
  client: PoolClient,
  whereSql: string,
  values: unknown[] = [],
): Promise<EmailSenderAccount[]> {
  const result = await client.query<AccountRow>(
    `SELECT
       id, account_key, email, display_name, source,
       encrypted_app_password, is_active,
       daily_to_limit, daily_cc_limit, sort_order
     FROM email_sender_accounts
     WHERE ${whereSql}
     ORDER BY sort_order, id`,
    values,
  )
  return result.rows.map(mapAccountRow)
}

export async function getEmailSenderAccount(
  accountId: number,
): Promise<ResolvedEmailSenderAccount | null> {
  await syncEnvEmailAccounts()
  const client = await pool.connect()
  try {
    const accounts = await getAccountRows(client, 'id = $1', [accountId])
    const account = accounts[0]
    return account
      ? { ...account, appPassword: resolveCredential(account) }
      : null
  } finally {
    client.release()
  }
}

export async function getFirstActiveEmailSenderAccount(): Promise<
  ResolvedEmailSenderAccount | null
> {
  await syncEnvEmailAccounts()
  const client = await pool.connect()
  try {
    const accounts = await getAccountRows(client, 'is_active = TRUE')
    const account = accounts[0]
    return account
      ? { ...account, appPassword: resolveCredential(account) }
      : null
  } finally {
    client.release()
  }
}

export async function selectNextEmailSenderAccount(): Promise<
  ResolvedEmailSenderAccount | null
> {
  await syncEnvEmailAccounts()
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    await client.query(
      `INSERT INTO email_sender_routing_state (id)
       VALUES (1)
       ON CONFLICT (id) DO NOTHING`,
    )
    const stateResult = await client.query(
      `SELECT last_account_id
       FROM email_sender_routing_state
       WHERE id = 1
       FOR UPDATE`,
    )
    const accounts = await getAccountRows(client, 'is_active = TRUE')
    const nextId = chooseNextEmailAccountId(
      accounts.map((account) => account.id),
      stateResult.rows[0]?.last_account_id
        ? Number(stateResult.rows[0].last_account_id)
        : null,
    )

    if (nextId === null) {
      await client.query('COMMIT')
      return null
    }

    const selected = accounts.find((account) => account.id === nextId)
    if (!selected) {
      throw new Error('Không tìm thấy tài khoản email đã được chọn.')
    }

    const resolved = {
      ...selected,
      appPassword: resolveCredential(selected),
    }
    await client.query(
      `UPDATE email_sender_routing_state
       SET last_account_id = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = 1`,
      [selected.id],
    )
    await client.query(
      `UPDATE email_sender_accounts
       SET last_selected_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [selected.id],
    )
    await client.query('COMMIT')
    return resolved
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function getEmailAccountConfigurationSummary(): Promise<{
  configured: boolean
  activeAccountCount: number
  totalAccountCount: number
  senderEmail: string | null
}> {
  await syncEnvEmailAccounts()
  const result = await pool.query(
    `SELECT
       COUNT(*)::int AS total_count,
       COUNT(*) FILTER (WHERE is_active)::int AS active_count,
       (ARRAY_AGG(email ORDER BY sort_order, id)
         FILTER (WHERE is_active))[1] AS sender_email
     FROM email_sender_accounts`,
  )
  const row = result.rows[0] || {}
  const activeAccountCount = Number(row.active_count || 0)
  return {
    configured: activeAccountCount > 0,
    activeAccountCount,
    totalAccountCount: Number(row.total_count || 0),
    senderEmail: row.sender_email ? String(row.sender_email) : null,
  }
}

export async function recordEmailAccountVerification(
  accountId: number,
  ok: boolean,
  error?: string,
): Promise<void> {
  await pool.query(
    `UPDATE email_sender_accounts
     SET
       last_verified_at = CURRENT_TIMESTAMP,
       last_verify_ok = $2,
       last_verify_error = $3,
       updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [accountId, ok, error?.slice(0, 2000) || null],
  )
}

export function isEmailCredentialEncryptionConfigured(): boolean {
  return Boolean(process.env.EMAIL_CREDENTIAL_ENCRYPTION_KEY?.trim())
}

export interface EmailSenderAccountListItem {
  id: number
  accountKey: string
  email: string
  displayName: string
  source: EmailAccountSource
  isActive: boolean
  dailyToLimit: number
  dailyCcLimit: number
  sortOrder: number
  toUsed24h: number
  ccUsed24h: number
  lastSelectedAt: string | null
  lastVerifiedAt: string | null
  lastVerifyOk: boolean | null
  lastVerifyError: string | null
}

type AccountQuotaRow = AccountRow & {
  to_used_24h: unknown
  cc_used_24h: unknown
  last_selected_at: unknown
  last_verified_at: unknown
  last_verify_ok: unknown
  last_verify_error: unknown
}

function mapAccountListRow(row: AccountQuotaRow): EmailSenderAccountListItem {
  const account = mapAccountRow(row)
  return {
    ...account,
    toUsed24h: Number(row.to_used_24h || 0),
    ccUsed24h: Number(row.cc_used_24h || 0),
    lastSelectedAt: row.last_selected_at
      ? String(row.last_selected_at)
      : null,
    lastVerifiedAt: row.last_verified_at
      ? String(row.last_verified_at)
      : null,
    lastVerifyOk:
      row.last_verify_ok === null || row.last_verify_ok === undefined
        ? null
        : Boolean(row.last_verify_ok),
    lastVerifyError: row.last_verify_error
      ? String(row.last_verify_error)
      : null,
  }
}

export async function listEmailSenderAccountsWithQuota(): Promise<
  EmailSenderAccountListItem[]
> {
  await syncEnvEmailAccounts()
  const result = await pool.query<AccountQuotaRow>(
    `SELECT
       a.id, a.account_key, a.email, a.display_name, a.source,
       a.encrypted_app_password, a.is_active,
       a.daily_to_limit, a.daily_cc_limit, a.sort_order,
       a.last_selected_at, a.last_verified_at, a.last_verify_ok,
       a.last_verify_error,
       COALESCE(q.to_used_24h, 0)::int AS to_used_24h,
       COALESCE(q.cc_used_24h, 0)::int AS cc_used_24h
     FROM email_sender_accounts a
     LEFT JOIN (
       SELECT
         sender_account_id,
         COALESCE(SUM(to_recipient_count) FILTER (WHERE status = 'sent'), 0)::int AS to_used_24h,
         COALESCE(SUM(cc_recipient_count) FILTER (WHERE status = 'sent'), 0)::int AS cc_used_24h
       FROM email_delivery_logs
       WHERE created_at >= NOW() - INTERVAL '24 hours'
       GROUP BY sender_account_id
     ) q ON q.sender_account_id = a.id
     ORDER BY a.sort_order, a.id`,
  )
  return result.rows.map(mapAccountListRow)
}

function slugifyAccountKey(email: string): string {
  const base = email
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `db-${base || 'account'}`
}

export async function createDatabaseEmailSenderAccount(input: {
  email: string
  displayName: string
  appPassword: string
  dailyToLimit?: number
  dailyCcLimit?: number
  createdByEmail?: string
}): Promise<EmailSenderAccountListItem> {
  if (!isEmailCredentialEncryptionConfigured()) {
    throw new Error(
      'EMAIL_CREDENTIAL_ENCRYPTION_KEY chưa được cấu hình — không thể lưu tài khoản mới.',
    )
  }

  const email = input.email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Email không hợp lệ.')
  }

  const appPassword = input.appPassword.replace(/\s+/g, '').trim()
  if (!appPassword) {
    throw new Error('App Password không được để trống.')
  }

  await syncEnvEmailAccounts()
  const settingsResult = await pool.query(
    `SELECT default_to_limit, default_cc_limit
     FROM email_monitor_settings WHERE id = 1`,
  )
  const dailyToLimit = Math.max(
    1,
    input.dailyToLimit ??
      Number(settingsResult.rows[0]?.default_to_limit || 2000),
  )
  const dailyCcLimit = Math.max(
    1,
    input.dailyCcLimit ??
      Number(settingsResult.rows[0]?.default_cc_limit || 2000),
  )
  const displayName = input.displayName.trim() || 'TPS Teaching'
  const encrypted = encryptEmailCredential(
    appPassword,
    getEncryptionSecret(),
  )

  const sortResult = await pool.query(
    `SELECT COALESCE(MAX(sort_order), 0) + 10 AS next_order
     FROM email_sender_accounts`,
  )
  const sortOrder = Number(sortResult.rows[0]?.next_order || 30)
  let accountKey = slugifyAccountKey(email)

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const insertResult = await pool.query(
        `INSERT INTO email_sender_accounts (
          account_key, email, display_name, source, encrypted_app_password,
          is_active, daily_to_limit, daily_cc_limit, sort_order,
          created_by_email, updated_at
        ) VALUES ($1, $2, $3, 'database', $4, TRUE, $5, $6, $7, $8, CURRENT_TIMESTAMP)
        RETURNING id`,
        [
          accountKey,
          email,
          displayName,
          encrypted,
          dailyToLimit,
          dailyCcLimit,
          sortOrder,
          input.createdByEmail || null,
        ],
      )
      const accountId = Number(insertResult.rows[0]?.id)
      const accounts = await listEmailSenderAccountsWithQuota()
      const created = accounts.find((item) => item.id === accountId)
      if (!created) {
        throw new Error('Không tải được tài khoản vừa tạo.')
      }
      return created
    } catch (error) {
      const code =
        error && typeof error === 'object' && 'code' in error
          ? String((error as { code?: string }).code)
          : ''
      if (code === '23505') {
        accountKey = `${slugifyAccountKey(email)}-${attempt + 2}`
        continue
      }
      throw error
    }
  }

  throw new Error('Không tạo được tài khoản email.')
}

export async function updateEmailSenderAccount(input: {
  accountId: number
  isActive?: boolean
  displayName?: string
  dailyToLimit?: number
  dailyCcLimit?: number
  appPassword?: string
}): Promise<EmailSenderAccountListItem | null> {
  await syncEnvEmailAccounts()
  const existing = await pool.query<AccountRow>(
    `SELECT
       id, account_key, email, display_name, source,
       encrypted_app_password, is_active,
       daily_to_limit, daily_cc_limit, sort_order
     FROM email_sender_accounts
     WHERE id = $1`,
    [input.accountId],
  )
  const account = existing.rows[0]
  if (!account) return null

  const updates: string[] = []
  const values: unknown[] = []

  if (typeof input.isActive === 'boolean') {
    values.push(input.isActive)
    updates.push(`is_active = $${values.length}`)
  }
  if (input.displayName !== undefined) {
    values.push(input.displayName.trim() || 'TPS Teaching')
    updates.push(`display_name = $${values.length}`)
  }
  if (input.dailyToLimit !== undefined) {
    values.push(Math.max(1, input.dailyToLimit))
    updates.push(`daily_to_limit = $${values.length}`)
  }
  if (input.dailyCcLimit !== undefined) {
    values.push(Math.max(1, input.dailyCcLimit))
    updates.push(`daily_cc_limit = $${values.length}`)
  }
  if (input.appPassword !== undefined) {
    if (account.source !== 'database') {
      throw new Error('Không thể đổi App Password của tài khoản cấu hình từ env.')
    }
    if (!isEmailCredentialEncryptionConfigured()) {
      throw new Error('EMAIL_CREDENTIAL_ENCRYPTION_KEY chưa được cấu hình.')
    }
    const normalized = input.appPassword.replace(/\s+/g, '').trim()
    if (!normalized) {
      throw new Error('App Password không được để trống.')
    }
    values.push(
      encryptEmailCredential(normalized, getEncryptionSecret()),
    )
    updates.push(`encrypted_app_password = $${values.length}`)
  }

  if (updates.length === 0) {
    const accounts = await listEmailSenderAccountsWithQuota()
    return accounts.find((item) => item.id === input.accountId) || null
  }

  values.push(input.accountId)
  await pool.query(
    `UPDATE email_sender_accounts
     SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
     WHERE id = $${values.length}`,
    values,
  )

  const accounts = await listEmailSenderAccountsWithQuota()
  return accounts.find((item) => item.id === input.accountId) || null
}

export async function deleteDatabaseEmailSenderAccount(
  accountId: number,
): Promise<{ deleted: boolean; reason?: string }> {
  await syncEnvEmailAccounts()
  const existing = await pool.query(
    `SELECT id, source FROM email_sender_accounts WHERE id = $1`,
    [accountId],
  )
  const account = existing.rows[0]
  if (!account) {
    return { deleted: false, reason: 'NOT_FOUND' }
  }
  if (account.source !== 'database') {
    return { deleted: false, reason: 'ENV_ACCOUNT' }
  }

  await pool.query(`DELETE FROM email_sender_accounts WHERE id = $1`, [
    accountId,
  ])
  return { deleted: true }
}
