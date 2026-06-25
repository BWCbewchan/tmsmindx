/**
 * Chuẩn hoá "đã xem xong video": không tin completion_status / time_spent import
 * nếu không có heartbeat TMS hoặc bài nộp kiểm tra.
 *
 * - `completed` nếu đã có bài nộp/chấm trên TMS, hoặc
 *   (đủ ~90% thời lượng hoặc đủ giây tối thiểu khi không có duration) **và** có heartbeat /
 *   `server_time_seconds` từ TMS.
 *
 * Khớp ngưỡng với app/api/training-progress/route.ts (COMPLETION_THRESHOLD = 0.90).
 */
export const TRAINING_WATCH_COMPLETION_RATIO = 0.9

/** Khi DB không có duration — chỉ tin nếu có heartbeat và đủ giây (tránh import time_spent ảo) */
export const TRAINING_WATCH_FALLBACK_MIN_SECONDS = 120

export type EffectiveVideoCompletionInput = {
  rawCompletionStatus: string | null | undefined
  rawCompletedAt: string | Date | null | undefined
  /** Tổng thời gian xem tin cậy (giây), đã gộp chunk nếu cần */
  mergedWatchedSeconds: number
  /** Thời lượng video (giây), > 0 khi tính được từ DB/segment */
  durationSeconds: number
  /** Đã có bài nộp / chấm trên TMS cho video (bất kỳ assignment của video) */
  hasPlatformQuizEvidenceForVideo: boolean
  /** Có ít nhất một dòng điểm video với heartbeat hoặc server_time > 0 (xem qua TMS) */
  hasTmsWatchHeartbeat: boolean
}

function normStatus(s: string | null | undefined): string {
  return (s || 'not_started').toString().trim().toLowerCase()
}

export function effectiveVideoCompletionFromRaw(
  input: EffectiveVideoCompletionInput,
): {
  completion_status: 'not_started' | 'in_progress' | 'watched' | 'completed'
  completed_at: string | null
} {
  const raw = normStatus(input.rawCompletionStatus)
  let completedAtStr: string | null = null
  if (input.rawCompletedAt) {
    const d = new Date(input.rawCompletedAt as string)
    completedAtStr = Number.isNaN(d.getTime()) ? null : d.toISOString()
  }

  // ── CASE 1: Đã có bài nộp kiểm tra trên TMS ─────────────────────────────
  // Ưu tiên cao nhất: nếu giáo viên đã nộp bài → chắc chắn đã xem video
  if (input.hasPlatformQuizEvidenceForVideo) {
    // Nếu DB đã ghi completed → giữ nguyên
    if (raw === 'completed') {
      return { completion_status: 'completed', completed_at: completedAtStr }
    }
    // Đã nộp bài → tính là completed dù không có heartbeat
    // (bài nộp là bằng chứng đủ mạnh nhất, không cần time check)
    return {
      completion_status: 'completed',
      completed_at: completedAtStr ?? new Date().toISOString(),
    }
  }

  // ── CASE 2: DB đã ghi completed/watched (import từ sheet cũ hoặc TMS) ───
  // Tin tưởng trạng thái đã lưu khi không có heartbeat TMS.
  // Lý do: dữ liệu import từ Google Sheet hợp lệ — giáo viên đã học
  // trên edpuzzle trước khi có TMS, không có server_time/heartbeat.
  // Cũng bao gồm: user vừa xem xong và saveCompletion đã lưu 'completed'
  // (hasTmsWatchHeartbeat có thể chưa có nếu đây là lần mở video đầu tiên).
  if (raw === 'completed') {
    return { completion_status: 'completed', completed_at: completedAtStr ?? new Date().toISOString() }
  }
  if (raw === 'watched') {
    return { completion_status: 'watched', completed_at: completedAtStr }
  }

  // ── CASE 3: Không có trạng thái lưu trước — tính từ thời gian xem TMS ───
  // Chỉ áp dụng khi giáo viên đang xem video trực tiếp trên TMS
  // (có heartbeat hoặc server_time từ progress API)
  const dur = Math.max(0, Number(input.durationSeconds) || 0)
  const watched = Math.max(0, Number(input.mergedWatchedSeconds) || 0)
  const cappedWatch = dur > 0 ? Math.min(watched, dur * 1.05) : watched

  const ratioOk =
    dur > 0
      ? cappedWatch >= dur * TRAINING_WATCH_COMPLETION_RATIO
      : cappedWatch >= TRAINING_WATCH_FALLBACK_MIN_SECONDS

  // Cần có bằng chứng heartbeat TMS — tránh nhầm với time_spent import thủ công
  const watchOk = input.hasTmsWatchHeartbeat && ratioOk

  if (watchOk) {
    return { completion_status: 'watched', completed_at: completedAtStr }
  }

  if (watched > 0 && input.hasTmsWatchHeartbeat) {
    return { completion_status: 'in_progress', completed_at: null }
  }

  return { completion_status: 'not_started', completed_at: null }
}

/** Một dòng điểm video (chunk) */
export type TrainingScoreRowLike = {
  time_spent_seconds?: number | null
  server_time_seconds?: number | null
  last_heartbeat_at?: string | Date | null
}

/** Có bằng chứng từng mở lesson trên TMS (heartbeat / server time), không chỉ import time_spent */
export function hasTmsWatchEvidenceForVideoIds(
  videoIds: number[],
  scoresMap: Map<number, TrainingScoreRowLike>,
): boolean {
  for (const id of videoIds) {
    const r = scoresMap.get(id)
    if (!r) continue
    if (Number(r.server_time_seconds) > 0) return true
    if (r.last_heartbeat_at != null && String(r.last_heartbeat_at).trim() !== '')
      return true
  }
  return false
}

export function mergedWatchSecondsForVideoIds(
  videoIds: number[],
  scoresMap: Map<number, TrainingScoreRowLike>,
): number {
  let sum = 0
  for (const id of videoIds) {
    const r = scoresMap.get(id)
    if (!r) continue
    const t = Math.max(
      Number(r.server_time_seconds) || 0,
      Number(r.time_spent_seconds) || 0,
    )
    sum += t
  }
  return sum
}

export function lessonDurationSecondsFromSegments(
  segments: Array<{
    duration_seconds?: number | null
    duration_minutes?: number | null
  }> | undefined,
  fallbackDurationMinutes: number | null | undefined,
  /** Ưu tiên khi không gộp segment (một row training_videos) */
  fallbackDurationSeconds?: number | null,
): number {
  if (segments?.length) {
    let sec = 0
    for (const s of segments) {
      if (s.duration_seconds != null && Number(s.duration_seconds) > 0) {
        sec += Number(s.duration_seconds)
      } else {
        sec += (Number(s.duration_minutes) || 0) * 60
      }
    }
    if (sec > 0) return sec
  }
  if (
    fallbackDurationSeconds != null &&
    Number(fallbackDurationSeconds) > 0
  ) {
    return Number(fallbackDurationSeconds)
  }
  const dm = Number(fallbackDurationMinutes) || 0
  return dm > 0 ? dm * 60 : 0
}

/** Dòng training_teacher_video_scores (đủ field để gộp chunk + effective) */
export type TrainingVideoScoreRow = TrainingScoreRowLike & {
  completion_status?: string | null
  completed_at?: string | Date | null
  score?: number
}

function statusPriorityForPick(status: string | null | undefined): number {
  if (status === 'completed') return 2
  if (status === 'in_progress') return 1
  return 0
}

/** Chọn một dòng điểm “đại diện” giữa các chunk cùng lesson (khớp training-db). */
export function pickBestTrainingScoreRow(
  sourceVideoIds: number[],
  scoresMap: Map<number, TrainingVideoScoreRow>,
): TrainingVideoScoreRow | null {
  const candidates = sourceVideoIds
    .map((id) => scoresMap.get(id))
    .filter(Boolean) as TrainingVideoScoreRow[]
  if (candidates.length === 0) return null
  return candidates.reduce((best, current) => {
    const bp = statusPriorityForPick(best?.completion_status)
    const cp = statusPriorityForPick(current?.completion_status)
    if (cp > bp) return current
    if (cp < bp) return best
    const bt = Number(best?.time_spent_seconds || 0)
    const ct = Number(current?.time_spent_seconds || 0)
    if (ct > bt) return current
    return best
  })
}

/**
 * Hoàn thành video hiệu dụng cho một lesson (một hoặc nhiều chunk training_videos),
 * khớp logic app/api/training-db/route.ts.
 */
export function effectiveCompletionForGroupedLesson(input: {
  sourceVideoIds: number[]
  chunkMetasSorted: Array<{
    id: number
    duration_seconds?: number | null
    duration_minutes?: number | null
  }>
  scoresMap: Map<number, TrainingVideoScoreRow>
  quizEvidenceVideoIds: Set<number>
}): ReturnType<typeof effectiveVideoCompletionFromRaw> {
  const scoreData = pickBestTrainingScoreRow(
    input.sourceVideoIds,
    input.scoresMap,
  )
  const durationSeconds = lessonDurationSecondsFromSegments(
    input.chunkMetasSorted.map((m) => ({
      duration_seconds: m.duration_seconds,
      duration_minutes: m.duration_minutes,
    })),
    undefined,
    undefined,
  )
  const mergedWatchedSeconds = mergedWatchSecondsForVideoIds(
    input.sourceVideoIds,
    input.scoresMap,
  )
  const hasQuizEvidenceForLesson = input.sourceVideoIds.some((id) =>
    input.quizEvidenceVideoIds.has(id),
  )
  const hasTmsWatchHeartbeat = hasTmsWatchEvidenceForVideoIds(
    input.sourceVideoIds,
    input.scoresMap,
  )
  return effectiveVideoCompletionFromRaw({
    rawCompletionStatus: scoreData ? scoreData.completion_status : 'not_started',
    rawCompletedAt: scoreData ? scoreData.completed_at : null,
    mergedWatchedSeconds,
    durationSeconds,
    hasPlatformQuizEvidenceForVideo: hasQuizEvidenceForLesson,
    hasTmsWatchHeartbeat,
  })
}
