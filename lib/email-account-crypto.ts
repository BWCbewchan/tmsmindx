import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto'

const CIPHER = 'aes-256-gcm'
const PAYLOAD_VERSION = 'v1'

function deriveKey(secret: string): Buffer {
  const normalized = secret.trim()
  if (normalized.length < 24) {
    throw new Error(
      'EMAIL_CREDENTIAL_ENCRYPTION_KEY phải có ít nhất 24 ký tự.',
    )
  }
  return createHash('sha256').update(normalized, 'utf8').digest()
}

export function encryptEmailCredential(
  credential: string,
  encryptionSecret: string,
): string {
  const normalized = credential.trim()
  if (!normalized) {
    throw new Error('App Password không được để trống.')
  }

  const iv = randomBytes(12)
  const cipher = createCipheriv(CIPHER, deriveKey(encryptionSecret), iv)
  const encrypted = Buffer.concat([
    cipher.update(normalized, 'utf8'),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()

  return [
    PAYLOAD_VERSION,
    iv.toString('base64url'),
    authTag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.')
}

export function decryptEmailCredential(
  payload: string,
  encryptionSecret: string,
): string {
  const [version, ivValue, authTagValue, encryptedValue] = payload.split('.')
  if (
    version !== PAYLOAD_VERSION ||
    !ivValue ||
    !authTagValue ||
    !encryptedValue
  ) {
    throw new Error('Credential email mã hóa không hợp lệ.')
  }

  const decipher = createDecipheriv(
    CIPHER,
    deriveKey(encryptionSecret),
    Buffer.from(ivValue, 'base64url'),
  )
  decipher.setAuthTag(Buffer.from(authTagValue, 'base64url'))

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}
