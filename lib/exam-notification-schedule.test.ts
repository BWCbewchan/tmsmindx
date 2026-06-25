import assert from 'node:assert/strict'
import test from 'node:test'

import {
  EXAM_REMINDER_MINUTES,
  REGISTRATION_OPEN_HOUR,
  buildExamNotificationDedupeKey,
  getExamNotificationDedupePrefix,
} from './exam-notification-schedule.ts'

test('uses the agreed notification times', () => {
  assert.equal(REGISTRATION_OPEN_HOUR, 12)
  assert.equal(EXAM_REMINDER_MINUTES, 10)
})

test('builds stable keys for each event notification milestone', () => {
  const eventId = '5b3038af-4c7a-4481-9e6d-15a1dfc68e35'

  assert.equal(
    getExamNotificationDedupePrefix('registration_open'),
    'exam-schedule:registration-open:',
  )
  assert.equal(
    buildExamNotificationDedupeKey('registration_open', eventId),
    `exam-schedule:registration-open:${eventId}`,
  )
  assert.equal(
    buildExamNotificationDedupeKey('registration_closed', eventId),
    `exam-schedule:registration-closed:${eventId}`,
  )
  assert.equal(
    buildExamNotificationDedupeKey('exam_reminder', eventId),
    `exam-schedule:exam-reminder:${eventId}`,
  )
})

test('rejects an empty event id', () => {
  assert.throws(
    () => buildExamNotificationDedupeKey('exam_reminder', '   '),
    /event id/i,
  )
})
