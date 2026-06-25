export type TrainingGradingQuestion = {
  id: number | string
  question_type?: string | null
  correct_answer?: string | null
  points?: number | string | null
}

export type TrainingSubmittedAnswer = {
  question_id: number | string
  answer_text?: string
  answer?: string
}

function normalizeAnswerValue(value: unknown): string {
  return String(value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function parseAnswerArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(normalizeAnswerValue).filter(Boolean)
  }

  const text = String(value ?? '').trim()
  if (!text) return []

  try {
    const parsed = JSON.parse(text)
    if (Array.isArray(parsed)) {
      return parsed.map(normalizeAnswerValue).filter(Boolean)
    }
  } catch {
    // Pipe-separated legacy format is handled below.
  }

  return text.split('|').map(normalizeAnswerValue).filter(Boolean)
}

function isTrainingAnswerCorrect(
  question: TrainingGradingQuestion,
  userAnswer: unknown,
): boolean {
  const type = String(question.question_type || '').trim().toLowerCase()
  const correctAnswer = question.correct_answer
  if (!correctAnswer || type === 'essay') return false

  if (type === 'multiple_select') {
    const expected = parseAnswerArray(correctAnswer)
    const actual = parseAnswerArray(userAnswer)
    if (expected.length === 0 || actual.length !== expected.length) return false
    const actualSet = new Set(actual)
    return expected.every((item) => actualSet.has(item))
  }

  return normalizeAnswerValue(userAnswer) === normalizeAnswerValue(correctAnswer)
}

export function gradeTrainingAssignment(
  questions: TrainingGradingQuestion[],
  submittedAnswers: TrainingSubmittedAnswer[],
): {
  normalizedScore: number
  percentage: number
  isPassed: boolean
  correctCount: number
  totalQuestions: number
  gradedAnswers: Array<{
    question_id: number
    answer_text: string
    is_correct: boolean
    points_earned: number
  }>
} {
  const answerByQuestionId = new Map<string, TrainingSubmittedAnswer>()
  for (const answer of submittedAnswers) {
    answerByQuestionId.set(String(answer.question_id), answer)
  }

  let earnedPoints = 0
  let maximumPoints = 0
  let correctCount = 0

  const gradedAnswers = questions.map((question) => {
    const answer = answerByQuestionId.get(String(question.id))
    const answerText = answer?.answer_text ?? answer?.answer ?? ''
    const rawPoints = Number(question.points ?? 1)
    const questionPoints =
      Number.isFinite(rawPoints) && rawPoints > 0 ? rawPoints : 0
    maximumPoints += questionPoints

    const isCorrect =
      questionPoints > 0 && isTrainingAnswerCorrect(question, answerText)
    if (isCorrect) {
      correctCount += 1
      earnedPoints += questionPoints
    }

    return {
      question_id: Number(question.id),
      answer_text: String(answerText),
      is_correct: isCorrect,
      points_earned: isCorrect ? questionPoints : 0,
    }
  })

  const ratio = maximumPoints > 0 ? earnedPoints / maximumPoints : 0
  const normalizedScore =
    Math.round(Math.min(Math.max(ratio * 10, 0), 10) * 100) / 100
  const percentage = Math.round(ratio * 10000) / 100

  return {
    normalizedScore,
    percentage,
    isPassed: normalizedScore >= 7,
    correctCount,
    totalQuestions: questions.length,
    gradedAnswers,
  }
}
