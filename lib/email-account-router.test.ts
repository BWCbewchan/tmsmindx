import assert from 'node:assert/strict'
import test from 'node:test'

import {
  decryptEmailCredential,
  encryptEmailCredential,
} from './email-account-crypto.ts'
import { chooseNextEmailAccountId } from './email-account-router.ts'

test('encrypts and decrypts an email app password', () => {
  const encrypted = encryptEmailCredential(
    'app-password-value',
    'test-encryption-key-with-enough-entropy',
  )

  assert.notEqual(encrypted, 'app-password-value')
  assert.equal(
    decryptEmailCredential(
      encrypted,
      'test-encryption-key-with-enough-entropy',
    ),
    'app-password-value',
  )
})

test('encrypted credential cannot be decrypted with another key', () => {
  const encrypted = encryptEmailCredential(
    'app-password-value',
    'first-test-encryption-key',
  )

  assert.throws(() =>
    decryptEmailCredential(encrypted, 'second-test-encryption-key'),
  )
})

test('round robin selects the first account when state is empty', () => {
  assert.equal(chooseNextEmailAccountId([10, 20, 30], null), 10)
})

test('round robin selects the account after the previous one', () => {
  assert.equal(chooseNextEmailAccountId([10, 20, 30], 10), 20)
  assert.equal(chooseNextEmailAccountId([10, 20, 30], 20), 30)
})

test('round robin wraps and recovers from a removed previous account', () => {
  assert.equal(chooseNextEmailAccountId([10, 20, 30], 30), 10)
  assert.equal(chooseNextEmailAccountId([10, 30], 20), 10)
  assert.equal(chooseNextEmailAccountId([], 20), null)
})
