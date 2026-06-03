const RESERVED_IDENTITY_VALUES = new Set([
  'anonymous',
  '_anonymous_',
  'unknown',
  'system/unknown',
  'null',
  'undefined',
]);

const EMAIL_LIKE_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeAuthenticatedEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const normalized = value.trim().toLowerCase();
  if (!normalized || RESERVED_IDENTITY_VALUES.has(normalized)) return null;
  if (!EMAIL_LIKE_PATTERN.test(normalized)) return null;

  return normalized;
}

export function isAuthenticatedEmail(value: unknown): boolean {
  return normalizeAuthenticatedEmail(value) !== null;
}

