import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getPushPlatformState,
  isIosUserAgent,
  urlBase64ToUint8Array,
} from '../lib/push-notifications.ts'
import {
  base64UrlEncode,
  encryptWebPushPayload,
  isAllowedPushEndpoint,
} from '../lib/web-push.ts'

test('detects iPhone, iPad and iPad desktop user agents', () => {
  assert.equal(
    isIosUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15',
    ),
    true,
  )
  assert.equal(
    isIosUserAgent(
      'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15',
    ),
    true,
  )
  assert.equal(
    isIosUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15',
      5,
    ),
    true,
  )
  assert.equal(
    isIosUserAgent(
      'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126 Mobile',
    ),
    false,
  )
})

test('requires iOS users to open the installed Home Screen app', () => {
  assert.deepEqual(
    getPushPlatformState({
      notificationSupported: true,
      serviceWorkerSupported: true,
      pushManagerSupported: true,
      secureContext: true,
      ios: true,
      standalone: false,
      configured: true,
    }),
    { supported: false, reason: 'ios-install-required' },
  )

  assert.deepEqual(
    getPushPlatformState({
      notificationSupported: true,
      serviceWorkerSupported: true,
      pushManagerSupported: true,
      secureContext: true,
      ios: true,
      standalone: true,
      configured: true,
    }),
    { supported: true, reason: null },
  )
})

test('reports unsupported and missing configuration states', () => {
  assert.deepEqual(
    getPushPlatformState({
      notificationSupported: true,
      serviceWorkerSupported: true,
      pushManagerSupported: true,
      secureContext: true,
      ios: false,
      standalone: false,
      configured: false,
    }),
    { supported: false, reason: 'not-configured' },
  )

  assert.deepEqual(
    getPushPlatformState({
      notificationSupported: true,
      serviceWorkerSupported: false,
      pushManagerSupported: false,
      secureContext: true,
      ios: false,
      standalone: false,
      configured: true,
    }),
    { supported: false, reason: 'browser-unsupported' },
  )
})

test('converts URL-safe VAPID keys into bytes', () => {
  assert.deepEqual(Array.from(urlBase64ToUint8Array('AQIDBA')), [1, 2, 3, 4])
})

test('only accepts known browser push service endpoints', () => {
  assert.equal(
    isAllowedPushEndpoint('https://fcm.googleapis.com/fcm/send/example'),
    true,
  )
  assert.equal(
    isAllowedPushEndpoint(
      'https://updates.push.services.mozilla.com/wpush/v2/example',
    ),
    true,
  )
  assert.equal(
    isAllowedPushEndpoint('https://web.push.apple.com/QH/example'),
    true,
  )
  assert.equal(
    isAllowedPushEndpoint(
      'https://wns2-bl2p.notify.windows.com/w/?token=x',
    ),
    true,
  )
  assert.equal(
    isAllowedPushEndpoint('https://example.com/internal-callback'),
    false,
  )
})

test('encrypts the RFC 8291 Web Push example', () => {
  const body = encryptWebPushPayload(
    {
      endpoint: 'https://push.example.net/push/example',
      p256dh:
        'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
      auth: 'BTBZMqHH6r4Tts7J_aSIgg',
    },
    Buffer.from('When I grow up, I want to be a watermelon'),
    {
      salt: Buffer.from('DGv6ra1nlYgDCS1FRnbzlw', 'base64url'),
      senderPrivateKey: Buffer.from(
        'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
        'base64url',
      ),
    },
  )

  assert.equal(
    base64UrlEncode(body),
    'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
  )
})
