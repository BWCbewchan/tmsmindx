export const TRAINING_HEARTBEAT_MAX_GAP_SECONDS = 20
export const TRAINING_HEARTBEAT_MAX_CREDIT_SECONDS = 15
export const TRAINING_POSITION_DRIFT_SECONDS = 2
export const TRAINING_POSITION_COMPLETION_RATIO = 0.95
export const TRAINING_SERVER_TIME_COMPLETION_RATIO = 0.95

export type TrainingProgressEvent =
  | 'start'
  | 'heartbeat'
  | 'pause'
  | 'ended'

export type SecureTrainingProgressInput = {
  previousPositionSeconds: number
  previousServerTimeSeconds: number
  previousStatus?: string | null
  lastHeartbeatAt?: string | Date | null
  reportedPositionSeconds: number
  durationSeconds: number
  eventType: TrainingProgressEvent
  now?: Date
}

function finiteNonNegative(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0
}

export function calculateSecureTrainingProgress(
  input: SecureTrainingProgressInput,
): {
  acceptedPositionSeconds: number
  serverTimeSeconds: number
  creditedSeconds: number
  completionStatus: 'not_started' | 'in_progress' | 'watched' | 'completed'
  completionAccepted: boolean
  positionJumpRejected: boolean
} {
  const now = input.now ?? new Date()
  const previousPosition = Math.floor(
    finiteNonNegative(input.previousPositionSeconds),
  )
  const previousServerTime = Math.floor(
    finiteNonNegative(input.previousServerTimeSeconds),
  )
  const reportedPosition = Math.floor(
    finiteNonNegative(input.reportedPositionSeconds),
  )
  const duration = finiteNonNegative(input.durationSeconds)
  const previousStatus = String(input.previousStatus || 'not_started')
    .trim()
    .toLowerCase()

  let creditedSeconds = 0
  if (input.eventType !== 'start' && input.lastHeartbeatAt) {
    const lastHeartbeat = new Date(input.lastHeartbeatAt)
    const elapsedSeconds =
      (now.getTime() - lastHeartbeat.getTime()) / 1000

    if (
      Number.isFinite(elapsedSeconds) &&
      elapsedSeconds >= 1 &&
      elapsedSeconds <= TRAINING_HEARTBEAT_MAX_GAP_SECONDS
    ) {
      creditedSeconds = Math.min(
        Math.floor(elapsedSeconds),
        TRAINING_HEARTBEAT_MAX_CREDIT_SECONDS,
      )
    }
  }

  const maximumAcceptedPosition =
    previousPosition + creditedSeconds + TRAINING_POSITION_DRIFT_SECONDS
  const clampedReportedPosition =
    duration > 0
      ? Math.min(reportedPosition, Math.ceil(duration))
      : reportedPosition
  const acceptedPositionSeconds = Math.max(
    previousPosition,
    Math.min(clampedReportedPosition, maximumAcceptedPosition),
  )

  const maximumServerTime =
    duration > 0 ? Math.ceil(duration) : previousServerTime + creditedSeconds
  const serverTimeSeconds = Math.min(
    previousServerTime + creditedSeconds,
    maximumServerTime,
  )

  const positionJumpRejected =
    clampedReportedPosition > maximumAcceptedPosition

  if (previousStatus === 'completed') {
    return {
      acceptedPositionSeconds,
      serverTimeSeconds,
      creditedSeconds,
      completionStatus: 'completed',
      completionAccepted: true,
      positionJumpRejected,
    }
  }

  if (previousStatus === 'watched') {
    return {
      acceptedPositionSeconds,
      serverTimeSeconds,
      creditedSeconds,
      completionStatus: 'watched',
      completionAccepted: true,
      positionJumpRejected,
    }
  }

  const positionRatio =
    duration > 0 ? acceptedPositionSeconds / duration : 0
  const serverTimeRatio =
    duration > 0 ? serverTimeSeconds / duration : 0
  const completionAccepted =
    input.eventType === 'ended' &&
    duration > 0 &&
    positionRatio >= TRAINING_POSITION_COMPLETION_RATIO &&
    serverTimeRatio >= TRAINING_SERVER_TIME_COMPLETION_RATIO

  return {
    acceptedPositionSeconds,
    serverTimeSeconds,
    creditedSeconds,
    completionStatus: completionAccepted
      ? 'watched'
      : acceptedPositionSeconds > 0 || serverTimeSeconds > 0
        ? 'in_progress'
        : 'not_started',
    completionAccepted,
    positionJumpRejected,
  }
}
