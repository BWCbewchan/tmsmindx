const LOGIN_PATH = '/login'
const BLOCKED_REDIRECT_PREFIXES = ['/api', '/_next']

type BrowserLocationLike = {
  pathname: string
  search: string
  hash: string
  origin: string
}

export function resolveSafeAuthRedirect(
  rawRedirect: string | null | undefined,
  origin: string,
): string | null {
  const value = rawRedirect?.trim()
  if (!value) return null
  if (value.includes('\\') || /[\u0000-\u001F\u007F]/.test(value)) return null

  let normalizedOrigin: string
  try {
    normalizedOrigin = new URL(origin).origin
  } catch {
    return null
  }

  const isSameOriginCandidate =
    (value.startsWith('/') && !value.startsWith('//')) ||
    value.toLowerCase().startsWith(`${normalizedOrigin.toLowerCase()}/`)
  if (!isSameOriginCandidate) return null

  try {
    const url = new URL(value, normalizedOrigin)
    if (url.origin !== normalizedOrigin) return null
    if (
      url.pathname === LOGIN_PATH ||
      url.pathname.startsWith(`${LOGIN_PATH}/`) ||
      BLOCKED_REDIRECT_PREFIXES.some(
        (prefix) =>
          url.pathname === prefix || url.pathname.startsWith(`${prefix}/`),
      )
    ) {
      return null
    }

    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return null
  }
}

export function buildLoginRedirectPath(
  requestedPath: string,
  origin: string,
): string {
  const safeRequestedPath = resolveSafeAuthRedirect(requestedPath, origin)
  const loginUrl = new URL(LOGIN_PATH, origin)

  if (safeRequestedPath) {
    loginUrl.searchParams.set('next', safeRequestedPath)
  }

  return `${loginUrl.pathname}${loginUrl.search}`
}

export function appendSafeAuthRedirect(
  basePath: string,
  requestedPath: string | null | undefined,
  origin: string,
): string {
  const normalizedOrigin = new URL(origin).origin
  const safeBasePath =
    resolveSafeAuthRedirect(basePath, normalizedOrigin) || LOGIN_PATH
  const safeRequestedPath = resolveSafeAuthRedirect(
    requestedPath,
    normalizedOrigin,
  )
  const destination = new URL(safeBasePath, normalizedOrigin)

  if (
    safeRequestedPath &&
    safeRequestedPath !==
      `${destination.pathname}${destination.search}${destination.hash}`
  ) {
    destination.searchParams.set('next', safeRequestedPath)
  }

  return `${destination.pathname}${destination.search}${destination.hash}`
}

export function getBrowserPath(location: BrowserLocationLike): string {
  return `${location.pathname}${location.search}${location.hash}`
}

export function buildBrowserLoginRedirectPath(
  location: BrowserLocationLike,
): string {
  return buildLoginRedirectPath(getBrowserPath(location), location.origin)
}

export function getSafeNextFromBrowser(
  location: BrowserLocationLike,
): string | null {
  const rawRedirect = new URLSearchParams(location.search).get('next')
  return resolveSafeAuthRedirect(rawRedirect, location.origin)
}
