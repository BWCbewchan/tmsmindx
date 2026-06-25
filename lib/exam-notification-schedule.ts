export const REGISTRATION_OPEN_HOUR = 12
export const EXAM_REMINDER_MINUTES = 10

export type ExamNotificationMilestone =
  | 'registration_open'
  | 'registration_closed'
  | 'exam_reminder'

const MILESTONE_KEY: Record<ExamNotificationMilestone, string> = {
  registration_open: 'registration-open',
  registration_closed: 'registration-closed',
  exam_reminder: 'exam-reminder',
}

export function getExamNotificationDedupePrefix(
  milestone: ExamNotificationMilestone,
): string {
  return `exam-schedule:${MILESTONE_KEY[milestone]}:`
}

export function buildExamNotificationDedupeKey(
  milestone: ExamNotificationMilestone,
  eventId: string,
): string {
  const normalizedEventId = eventId.trim()
  if (!normalizedEventId) {
    throw new Error('Event id is required to build a notification key')
  }

  return `${getExamNotificationDedupePrefix(milestone)}${normalizedEventId}`
}
