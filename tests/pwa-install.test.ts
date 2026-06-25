import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { getPwaInstallState } from '../lib/pwa-install.ts'

test('reports installed before checking platform capabilities', () => {
  assert.equal(
    getPwaInstallState({
      installed: true,
      ios: true,
      promptAvailable: false,
    }),
    'installed',
  )
})

test('uses the browser install prompt when it is available', () => {
  assert.equal(
    getPwaInstallState({
      installed: false,
      ios: false,
      promptAvailable: true,
    }),
    'prompt',
  )
})

test('shows iOS Home Screen instructions when not installed', () => {
  assert.equal(
    getPwaInstallState({
      installed: false,
      ios: true,
      promptAvailable: false,
    }),
    'ios-manual',
  )
})

test('falls back to browser menu instructions', () => {
  assert.equal(
    getPwaInstallState({
      installed: false,
      ios: false,
      promptAvailable: false,
    }),
    'manual',
  )
})

test('login exposes the shared installer and hides it in standalone mode', () => {
  const loginSource = readFileSync(
    new URL('../app/login/page.tsx', import.meta.url),
    'utf8',
  )
  const installerSource = readFileSync(
    new URL(
      '../components/notifications/InstallTpsApp.tsx',
      import.meta.url,
    ),
    'utf8',
  )
  const providerSource = readFileSync(
    new URL('../components/pwa/PwaInstallProvider.tsx', import.meta.url),
    'utf8',
  )

  assert.match(loginSource, /<InstallTpsApp compact hideWhenInstalled \/>/)
  assert.match(
    installerSource,
    /hideWhenInstalled && \(!ready \|\| installState === 'installed'\)/,
  )
  assert.doesNotMatch(installerSource, /showGuide/)
  assert.match(installerSource, /toast\.info\('Cài TPS từ menu trình duyệt'/)
  assert.match(installerSource, /toast\.info\('Cài TPS trên iPhone\/iPad'/)
  assert.match(
    providerSource,
    /navigator\.serviceWorker\.register\('\/sw\.js', \{ scope: '\/' \}\)/,
  )
})
