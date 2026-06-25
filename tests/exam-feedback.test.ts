import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  isValidExamFeedbackStatusTransition,
  normalizeExamFeedbackInput,
  normalizeQuestionIds,
} from '../lib/exam-feedback.ts'

test('exam feedback accepts an omitted rating and integer ratings from 1 to 5', () => {
  assert.equal(normalizeExamFeedbackInput({ systemComment: 'Trang hơi chậm' }).rating, null)

  for (const rating of [1, 2, 3, 4, 5]) {
    assert.equal(normalizeExamFeedbackInput({ rating }).rating, rating)
  }
})

test('exam feedback rejects invalid ratings', () => {
  for (const rating of [0, 1.5, 6, Number.NaN]) {
    assert.throws(
      () => normalizeExamFeedbackInput({ rating, systemComment: 'Có lỗi' }),
      /rating/i,
    )
  }
})

test('exam feedback requires rating or at least one comment', () => {
  assert.throws(
    () =>
      normalizeExamFeedbackInput({
        rating: null,
        systemComment: '   ',
        subjectComment: '',
      }),
    /nội dung đánh giá/i,
  )

  assert.doesNotThrow(() => normalizeExamFeedbackInput({ rating: 4 }))
  assert.doesNotThrow(() =>
    normalizeExamFeedbackInput({ subjectComment: 'Câu hỏi thiếu hình ảnh' }),
  )
})

test('question ids are normalized to unique positive integers', () => {
  assert.deepEqual(normalizeQuestionIds([3, '2', 3, -1, 0, 'abc', 4.8]), [3, 2])
})

test('feedback status transitions only move forward one step', () => {
  assert.equal(isValidExamFeedbackStatusTransition('new', 'new'), true)
  assert.equal(isValidExamFeedbackStatusTransition('new', 'in_progress'), true)
  assert.equal(isValidExamFeedbackStatusTransition('in_progress', 'done'), true)
  assert.equal(isValidExamFeedbackStatusTransition('done', 'done'), true)

  assert.equal(isValidExamFeedbackStatusTransition('new', 'done'), false)
  assert.equal(isValidExamFeedbackStatusTransition('in_progress', 'new'), false)
  assert.equal(isValidExamFeedbackStatusTransition('done', 'in_progress'), false)
})

test('feedback resolves the exact set from a saved exam submission', () => {
  const routeSource = readFileSync(
    new URL('../app/api/exam-feedback/route.ts', import.meta.url),
    'utf8',
  )
  const assignmentsSource = readFileSync(
    new URL('../app/api/exam-assignments/route.ts', import.meta.url),
    'utf8',
  )

  assert.match(
    routeSource,
    /COALESCE\(r\.id_de_thi, submission\.id_de_thi, monthly_set\.id_de\)/,
  )
  assert.match(
    assignmentsSource,
    /COALESCE\(csr\.id_de_thi, submission_set\.id_de_thi, fallback_chonde\.id_de\)/,
  )
})

test('starting and submitting an exam persist the resolved set on the result', () => {
  const submissionSource = readFileSync(
    new URL('../app/api/exam-submissions/route.ts', import.meta.url),
    'utf8',
  )

  assert.equal(
    submissionSource.match(/id_de_thi\s+= COALESCE\(id_de_thi, \$[23]\)/g)
      ?.length,
    2,
  )
})
