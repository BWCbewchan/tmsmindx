export type AssessmentProfileId = 'ta_trial_review' | 'lec_review'

export type AssessmentCriterion = {
  key: string
  label: string
  group: string
  description: string
  scoreScale: string
  eliminationRule: string
  weights: Partial<Record<AssessmentProfileId, number>>
}

export type AssessmentProfile = {
  id: AssessmentProfileId
  label: string
  capability: string
  passingScore: number
  currentStatus: string
  nextStatus: string
  description: string
}

export const INPUT_ASSESSMENT_PROFILES: AssessmentProfile[] = [
  {
    id: 'ta_trial_review',
    label: 'TA/Trial',
    capability: 'Năng lực TA/Trial',
    passingScore: 3.5,
    currentStatus: 'Chưa đạt TA',
    nextStatus: 'Đạt TA / Chưa đạt Trial',
    description: 'Bảng điểm đào tạo tập trung và đào tạo cơ sở cho ứng viên TA/Trial.',
  },
  {
    id: 'lec_review',
    label: 'LEC',
    capability: 'Năng lực LEC',
    passingScore: 3.5,
    currentStatus: 'Chưa đạt LEC',
    nextStatus: 'Đạt LEC',
    description: 'Bảng điểm đánh giá năng lực LEC theo tập huấn, technical test và duyệt giảng hội đồng.',
  },
]

export const INPUT_ASSESSMENT_CRITERIA: AssessmentCriterion[] = [
  {
    key: 'attendance',
    label: 'Điểm danh',
    group: 'Đào tạo tập trung',
    description: 'Điểm chuyên cần trong các buổi training tập trung.',
    scoreScale: 'Quy đổi theo số buổi tham gia.',
    eliminationRule: '',
    weights: { ta_trial_review: 10 },
  },
  {
    key: 'lesson_1',
    label: 'Lesson 1',
    group: 'Đào tạo tập trung',
    description: 'Điểm bài test hoặc đánh giá sau Lesson 1.',
    scoreScale: '1: < 7.0; 2: 7.0 - 7.4; 3: 7.5 - 8.0; 4: 8.1 - 8.5; 5: > 8.5',
    eliminationRule: '<= 6',
    weights: { ta_trial_review: 10 },
  },
  {
    key: 'lesson_2',
    label: 'Lesson 2',
    group: 'Đào tạo tập trung',
    description: 'Điểm bài test hoặc đánh giá sau Lesson 2.',
    scoreScale: '1: < 7.0; 2: 7.0 - 7.4; 3: 7.5 - 8.0; 4: 8.1 - 8.5; 5: > 8.5',
    eliminationRule: '<= 6',
    weights: { ta_trial_review: 10 },
  },
  {
    key: 'lesson_3',
    label: 'Lesson 3',
    group: 'Đào tạo tập trung',
    description: 'Điểm bài test hoặc đánh giá sau Lesson 3.',
    scoreScale: '1: < 7.0; 2: 7.0 - 7.4; 3: 7.5 - 8.0; 4: 8.1 - 8.5; 5: > 8.5',
    eliminationRule: '<= 6',
    weights: { ta_trial_review: 10 },
  },
  {
    key: 'observe',
    label: 'Observe',
    group: 'Đào tạo cơ sở',
    description: 'Số buổi observe tại cơ sở.',
    scoreScale: '1: 2 buổi; 2: 3 buổi; 3: 4 buổi; 4: 5 buổi; 5: > 5 buổi',
    eliminationRule: '< 2 buổi',
    weights: { ta_trial_review: 10 },
  },
  {
    key: 'pedagogical_training',
    label: 'Tập Huấn Sư Phạm',
    group: 'Đào tạo cơ sở',
    description: 'Điểm tập huấn sư phạm.',
    scoreScale: '1: < 7.0; 2: 7.0 - 7.4; 3: 7.5 - 8.0; 4: 8.1 - 8.5; 5: > 8.5',
    eliminationRule: '<= 3',
    weights: { ta_trial_review: 15, lec_review: 25 },
  },
  {
    key: 'entrance_technical_test',
    label: 'Entrance Technical Test',
    group: 'Đào tạo cơ sở',
    description: 'Điểm Entrance Technical Test.',
    scoreScale: '1: < 7.0; 2: 7.0 - 7.4; 3: 7.5 - 8.0; 4: 8.1 - 8.5; 5: > 8.5',
    eliminationRule: '<= 6',
    weights: { ta_trial_review: 15, lec_review: 25 },
  },
  {
    key: 'leader_demo',
    label: 'Duyệt giảng Leader',
    group: 'Đào tạo cơ sở',
    description: 'Điểm duyệt giảng bởi Leader.',
    scoreScale: '1: < 3.6; 2: 3.6 - 3.8; 3: 3.8 - 4.0; 4: 4.0 - 4.4; 5: > 4.4',
    eliminationRule: '<= 3.0',
    weights: { ta_trial_review: 20 },
  },
  {
    key: 'committee_demo',
    label: 'Duyệt giảng hội đồng chuyên môn',
    group: 'Đào tạo cơ sở',
    description: 'Điểm duyệt giảng bởi hội đồng chuyên môn.',
    scoreScale: 'Theo rubric hội đồng chuyên môn.',
    eliminationRule: '',
    weights: { lec_review: 50 },
  },
]

export function getAssessmentProfile(profileId: AssessmentProfileId) {
  return INPUT_ASSESSMENT_PROFILES.find((profile) => profile.id === profileId) || INPUT_ASSESSMENT_PROFILES[0]
}

export function normalizeAssessmentProfileId(profileId: string | null | undefined): AssessmentProfileId {
  return INPUT_ASSESSMENT_PROFILES.some((profile) => profile.id === profileId)
    ? profileId as AssessmentProfileId
    : 'ta_trial_review'
}

export function getCriteriaForProfile(profileId: AssessmentProfileId) {
  return INPUT_ASSESSMENT_CRITERIA
    .map((criterion) => ({ ...criterion, weight: criterion.weights[profileId] ?? 0 }))
    .filter((criterion) => criterion.weight > 0)
}

export function calculateInputAssessmentScore(
  profileId: AssessmentProfileId,
  scores: Record<string, number>,
) {
  const criteria = getCriteriaForProfile(profileId)
  return Number(
    criteria
      .reduce((sum, criterion) => sum + (Number(scores[criterion.key]) || 0) * (criterion.weight / 100), 0)
      .toFixed(2),
  )
}
