import assert from 'node:assert/strict'
import test from 'node:test'

import {
  effectiveCompletionForGroupedLesson,
  effectiveVideoCompletionFromRaw,
  pickBestTrainingScoreRow,
  type TrainingVideoScoreRow,
} from './training-effective-video-completion.ts'

test('prefers watched over in-progress when merging score rows', () => {
  const scores = new Map<number, TrainingVideoScoreRow>([
    [
      1,
      {
        completion_status: 'watched',
        score: 8,
        time_spent_seconds: 0,
        server_time_seconds: 0,
      },
    ],
    [
      2,
      {
        completion_status: 'in_progress',
        score: 0,
        time_spent_seconds: 500,
        server_time_seconds: 500,
      },
    ],
  ])

  assert.equal(
    pickBestTrainingScoreRow([1, 2], scores)?.completion_status,
    'watched',
  )
})

test('keeps imported watched status without requiring a TMS heartbeat', () => {
  assert.deepEqual(
    effectiveVideoCompletionFromRaw({
      rawCompletionStatus: 'watched',
      rawCompletedAt: null,
      mergedWatchedSeconds: 0,
      durationSeconds: 600,
      hasPlatformQuizEvidenceForVideo: false,
      hasTmsWatchHeartbeat: false,
    }),
    {
      completion_status: 'watched',
      completed_at: null,
    },
  )
})

test('unlocks a grouped lesson when any source video has quiz evidence', () => {
  const result = effectiveCompletionForGroupedLesson({
    sourceVideoIds: [10, 11],
    chunkMetasSorted: [
      { id: 10, duration_seconds: 300 },
      { id: 11, duration_seconds: 300 },
    ],
    scoresMap: new Map(),
    quizEvidenceVideoIds: new Set([11]),
  })

  assert.equal(result.completion_status, 'completed')
  assert.ok(result.completed_at)
})
