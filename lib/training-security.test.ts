import assert from 'node:assert/strict'
import test from 'node:test'

import { gradeTrainingAssignment } from './training-assignment-grading.ts'
import { calculateSecureTrainingProgress } from './training-progress-security.ts'

test('does not credit the first heartbeat or trust a forged completed position', () => {
  const result = calculateSecureTrainingProgress({
    previousPositionSeconds: 0,
    previousServerTimeSeconds: 0,
    previousStatus: 'not_started',
    lastHeartbeatAt: null,
    reportedPositionSeconds: 600,
    durationSeconds: 600,
    eventType: 'ended',
    now: new Date('2026-06-22T00:00:00.000Z'),
  })

  assert.equal(result.serverTimeSeconds, 0)
  assert.equal(result.completionAccepted, false)
  assert.equal(result.positionJumpRejected, true)
})

test('does not credit time after a stale heartbeat gap', () => {
  const result = calculateSecureTrainingProgress({
    previousPositionSeconds: 30,
    previousServerTimeSeconds: 30,
    previousStatus: 'in_progress',
    lastHeartbeatAt: '2026-06-22T00:00:00.000Z',
    reportedPositionSeconds: 300,
    durationSeconds: 600,
    eventType: 'heartbeat',
    now: new Date('2026-06-22T00:01:00.000Z'),
  })

  assert.equal(result.creditedSeconds, 0)
  assert.equal(result.acceptedPositionSeconds, 32)
  assert.equal(result.serverTimeSeconds, 30)
})

test('accepts completion only after trusted wall-clock and position evidence', () => {
  const result = calculateSecureTrainingProgress({
    previousPositionSeconds: 570,
    previousServerTimeSeconds: 555,
    previousStatus: 'in_progress',
    lastHeartbeatAt: '2026-06-22T00:09:05.000Z',
    reportedPositionSeconds: 600,
    durationSeconds: 600,
    eventType: 'ended',
    now: new Date('2026-06-22T00:09:20.000Z'),
  })

  assert.equal(result.completionAccepted, true)
  assert.equal(result.completionStatus, 'watched')
})

test('missing answers count as wrong and cannot produce a forged 10/10', () => {
  const result = gradeTrainingAssignment(
    [
      { id: 1, question_type: 'multiple_choice', correct_answer: 'A', points: 1 },
      { id: 2, question_type: 'multiple_choice', correct_answer: 'B', points: 1 },
      { id: 3, question_type: 'multiple_choice', correct_answer: 'C', points: 1 },
    ],
    [{ question_id: 1, answer_text: 'A' }],
  )

  assert.equal(result.normalizedScore, 3.33)
  assert.equal(result.isPassed, false)
})

test('duplicate submitted answers cannot increase the score denominator or numerator', () => {
  const result = gradeTrainingAssignment(
    [
      { id: 1, question_type: 'multiple_choice', correct_answer: 'A', points: 1 },
      { id: 2, question_type: 'multiple_choice', correct_answer: 'B', points: 1 },
    ],
    [
      { question_id: 1, answer_text: 'A' },
      { question_id: 1, answer_text: 'A' },
      { question_id: 1, answer_text: 'A' },
    ],
  )

  assert.equal(result.normalizedScore, 5)
  assert.equal(result.correctCount, 1)
})
