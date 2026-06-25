import assert from 'node:assert/strict'
import test from 'node:test'

import {
  appendSafeAuthRedirect,
  buildBrowserLoginRedirectPath,
  buildLoginRedirectPath,
  getSafeNextFromBrowser,
  resolveSafeAuthRedirect,
} from './auth-redirect.ts'

const ORIGIN = 'https://www.tpsmindx.com'
const ARTICLE_PATH =
  '/user/truyenthong/recap-tps-training-launching-tram-trung-tam?source=share#comments'

test('accepts internal callback paths with query and hash', () => {
  assert.equal(
    resolveSafeAuthRedirect(ARTICLE_PATH, ORIGIN),
    ARTICLE_PATH,
  )
  assert.equal(
    resolveSafeAuthRedirect(`${ORIGIN}${ARTICLE_PATH}`, ORIGIN),
    ARTICLE_PATH,
  )
})

test('rejects external and authentication infrastructure redirects', () => {
  const unsafeValues = [
    'https://evil.example/phishing',
    '//evil.example/phishing',
    '/\\evil.example/phishing',
    '/login?next=/user/truyenthong',
    '/login/continue',
    '/api/auth/me',
    '/_next/static/file.js',
  ]

  for (const value of unsafeValues) {
    assert.equal(resolveSafeAuthRedirect(value, ORIGIN), null, value)
  }
})

test('builds a login URL that preserves the requested page', () => {
  const loginPath = buildLoginRedirectPath(ARTICLE_PATH, ORIGIN)
  const loginUrl = new URL(loginPath, ORIGIN)

  assert.equal(loginUrl.pathname, '/login')
  assert.equal(loginUrl.searchParams.get('next'), ARTICLE_PATH)
})

test('reads the callback from the browser location', () => {
  const loginPath = buildLoginRedirectPath(ARTICLE_PATH, ORIGIN)
  const loginUrl = new URL(loginPath, ORIGIN)

  assert.equal(
    getSafeNextFromBrowser({
      origin: loginUrl.origin,
      pathname: loginUrl.pathname,
      search: loginUrl.search,
      hash: loginUrl.hash,
    }),
    ARTICLE_PATH,
  )
})

test('keeps callback through the datasource gate', () => {
  const datasourcePath = appendSafeAuthRedirect(
    '/checkdatasource',
    ARTICLE_PATH,
    ORIGIN,
  )
  const datasourceUrl = new URL(datasourcePath, ORIGIN)

  assert.equal(datasourceUrl.pathname, '/checkdatasource')
  assert.equal(datasourceUrl.searchParams.get('next'), ARTICLE_PATH)
})

test('browser login redirect includes the complete current location', () => {
  const loginPath = buildBrowserLoginRedirectPath({
    origin: ORIGIN,
    pathname:
      '/user/truyenthong/recap-tps-training-launching-tram-trung-tam',
    search: '?source=share',
    hash: '#comments',
  })
  const loginUrl = new URL(loginPath, ORIGIN)

  assert.equal(loginUrl.searchParams.get('next'), ARTICLE_PATH)
})
