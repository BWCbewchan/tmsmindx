import pool from '@/lib/db';
import { callLmsApi } from '@/lib/lms-api';
import { generateSlug } from '@/lib/utils';
import type {
  StudentPortfolioData,
  StudentPortfolioRecord,
  PortfolioStatus,
} from './types';

const GET_PORTFOLIO_CLASSES_QUERY = /* graphql */ `
  query GetClasses($search: String, $pageIndex: Int!, $itemsPerPage: Int!, $orderBy: String) {
    classes(payload: {
      filter_textSearch: $search,
      pageIndex: $pageIndex,
      itemsPerPage: $itemsPerPage,
      orderBy: $orderBy
    }) {
      data {
        id
        name
        status
        startDate
        endDate
        numberOfSessions
        course { id name shortName courseLine { id name } }
        centre { id name shortName }
        teachers {
          isActive
          teacher { id username code fullName email phoneNumber imageUrl }
          role { id name shortName }
        }
        students {
          _id
          activeInClass
          createdAt
          note
          student {
            id
            fullName
            phoneNumber
            email
            gender
            imageUrl
            customer { fullName phoneNumber email facebook zalo }
          }
          completionInfo { status note reason }
        }
        slots {
          _id
          date
          startTime
          endTime
          sessionHour
          summary
          homework
          studentAttendance {
            _id
            status
            comment
            sendCommentStatus
            commentByAreas {
              content
              grade
              commentAreaId
              type
              courseProcessFinalEvaluationTitle
            }
            student { id fullName phoneNumber email gender imageUrl }
          }
        }
        courseProcess {
          defaultCommentAreas { id name type }
          specificSessions { session commentAreas { id name type } }
          finalSession {
            finalEvaluations { id title commentAreas { id name type } }
            demoScore { commentAreas { id name type demo { id title maxScore } } }
          }
          checkpointSessions {
            session
            checkpointCommentArea { id name type }
            otherComments { id name type }
            evaluations { id title commentAreas { id name type } }
          }
        }
      }
      pagination { total }
    }
  }
`;

const FIND_ALL_STUDENT_WORKS_QUERY = /* graphql */ `
  query findAllStudentWorks($studentId: String, $classId: String, $classIds: [String], $classSessionId: String) {
    findAllStudentWorks(payload: {
      studentId_equals: $studentId,
      classId_equals: $classId,
      classId_in: $classIds,
      classSessionId_equals: $classSessionId
    }) {
      data {
        id
        status
        studentId
        classSessionId
        classId
        version
        displayOrder
        createdAt
        lastModifiedAt
        latestData {
          title
          thumbnail
          imageUrl
          videoUrls
          attachmentUrls
          comment
          relatedUrls { name url }
        }
      }
    }
  }
`;

const GET_STUDENT_CLASSES_QUERY = /* graphql */ `
  query FindOneStudent($studentId: ID!) {
    findOneStudent(payload: { studentId: $studentId }) {
      id
      fullName
      phoneNumber
      email
      imageUrl
      customer { fullName phoneNumber email facebook zalo }
      studyClasses {
        id
        name
        status
        startDate
        endDate
        numberOfSessions
        course { id name shortName courseLine { id name } }
        centre { id name shortName }
        teachers {
          isActive
          teacher { id username code fullName email phoneNumber imageUrl }
          role { id name shortName }
        }
        students {
          _id
          activeInClass
          createdAt
          note
          student {
            id
            fullName
            phoneNumber
            email
            gender
            imageUrl
            customer { fullName phoneNumber email facebook zalo }
          }
          completionInfo { status note reason }
        }
        slots {
          _id
          date
          startTime
          endTime
          sessionHour
          summary
          homework
          studentAttendance {
            _id
            status
            comment
            sendCommentStatus
            commentByAreas {
              content
              grade
              commentAreaId
              type
              courseProcessFinalEvaluationTitle
            }
            student { id fullName phoneNumber email gender imageUrl }
          }
        }
        courseProcess {
          defaultCommentAreas { id name type }
          specificSessions { session commentAreas { id name type } }
          finalSession {
            finalEvaluations { id title commentAreas { id name type } }
            demoScore { commentAreas { id name type demo { id title maxScore } } }
          }
          checkpointSessions {
            session
            checkpointCommentArea { id name type }
            otherComments { id name type }
            evaluations { id title commentAreas { id name type } }
          }
        }
      }
    }
  }
`;

const FIND_ONE_REWARD_POINT_QUERY = /* graphql */ `
  query findOneRewardPoint($studentId: String!) {
    findOneRewardPoint(payload: { productUserId_eq: $studentId }) {
      id
      currentPoint
      productUserId
    }
  }
`;

let schemaReady: Promise<void> | null = null;

async function ensurePortfolioSchema() {
  if (!schemaReady) {
    schemaReady = pool.query(`
      CREATE TABLE IF NOT EXISTS portfolios (
        id SERIAL PRIMARY KEY,
        student_lms_id VARCHAR(50) NOT NULL,
        class_lms_id VARCHAR(50) NOT NULL,
        student_name VARCHAR(255) NOT NULL,
        class_name VARCHAR(255),
        centre_name VARCHAR(255),
        course_name VARCHAR(255),
        public_slug VARCHAR(255) UNIQUE,
        status VARCHAR(20) DEFAULT 'draft',
        data JSONB DEFAULT '{}',
        created_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS student_lms_id VARCHAR(50);
      ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS class_lms_id VARCHAR(50);
      ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS student_name VARCHAR(255);
      ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS class_name VARCHAR(255);
      ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS centre_name VARCHAR(255);
      ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS course_name VARCHAR(255);
      ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS public_slug VARCHAR(255);
      ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'draft';
      ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';
      ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS created_by VARCHAR(255);
      ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
      ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'portfolios' AND column_name = 'student_id'
        ) THEN
          ALTER TABLE portfolios ALTER COLUMN student_id DROP NOT NULL;
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'portfolios' AND column_name = 'class_id'
        ) THEN
          ALTER TABLE portfolios ALTER COLUMN class_id DROP NOT NULL;
        END IF;
      END $$;

      CREATE UNIQUE INDEX IF NOT EXISTS idx_portfolios_public_slug_unique
        ON portfolios(public_slug)
        WHERE public_slug IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_portfolios_student_class_unique
        ON portfolios(student_lms_id, class_lms_id)
        WHERE student_lms_id IS NOT NULL AND class_lms_id IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS portfolios_student_lms_class_unique
        ON portfolios(student_lms_id, class_lms_id);
      CREATE INDEX IF NOT EXISTS idx_portfolios_class_lms_id
        ON portfolios(class_lms_id);
      CREATE INDEX IF NOT EXISTS idx_portfolios_student_lms_id
        ON portfolios(student_lms_id);
      CREATE INDEX IF NOT EXISTS idx_portfolios_status
        ON portfolios(status);
    `).then(() => undefined);
  }
  return schemaReady;
}

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function uniqueSlugBase(studentName: string, _className?: string, _courseLine?: string) {
  const base = generateSlug(studentName);
  return base || `portfolio-${Date.now()}`;
}

type LmsPortfolioClass = {
  id: string;
  name: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  numberOfSessions?: number;
  course?: { name?: string; shortName?: string; courseLine?: { name?: string } };
  centre?: { name?: string; shortName?: string };
  teachers?: Array<{
    isActive?: boolean;
    teacher?: {
      fullName?: string;
      email?: string;
      phoneNumber?: string;
      imageUrl?: string;
    };
    role?: { shortName?: string; name?: string };
  }>;
  students?: Array<{
    _id?: string;
    activeInClass?: boolean;
    createdAt?: string;
    student?: {
      id?: string;
      fullName?: string;
      phoneNumber?: string;
      email?: string;
      imageUrl?: string;
      customer?: { fullName?: string; phoneNumber?: string; email?: string };
    };
    completionInfo?: { status?: string; note?: string; reason?: string };
  }>;
  slots?: Array<{
    _id?: string;
    date?: string;
    startTime?: string;
    endTime?: string;
    studentAttendance?: Array<{
      status?: string;
      comment?: string;
      commentByAreas?: Array<{
        content?: string;
        grade?: number | null;
        commentAreaId?: string;
        type?: string;
        courseProcessFinalEvaluationTitle?: string | null;
      }>;
      student?: { id?: string; fullName?: string; phoneNumber?: string; email?: string; imageUrl?: string };
    }>;
  }>;
  courseProcess?: {
    defaultCommentAreas?: Array<{ id?: string; name?: string; type?: string }>;
    specificSessions?: Array<{ session?: number; commentAreas?: Array<{ id?: string; name?: string; type?: string }> }>;
    finalSession?: {
      finalEvaluations?: Array<{ title?: string; commentAreas?: Array<{ id?: string; name?: string; type?: string }> }>;
      demoScore?: { commentAreas?: Array<{ id?: string; name?: string; type?: string; demo?: { title?: string; maxScore?: number } }> };
    };
    checkpointSessions?: Array<{
      session?: number;
      checkpointCommentArea?: { id?: string; name?: string; type?: string };
      otherComments?: Array<{ id?: string; name?: string; type?: string }>;
      evaluations?: Array<{ title?: string; commentAreas?: Array<{ id?: string; name?: string; type?: string }> }>;
    }>;
  };
};

type LmsStudentProfile = {
  id?: string;
  fullName?: string;
  phoneNumber?: string;
  email?: string;
  imageUrl?: string;
  customer?: { fullName?: string; phoneNumber?: string; email?: string };
  studyClasses?: LmsPortfolioClass[];
};

type StudentWorkItem = {
  id?: string;
  status?: string;
  studentId?: string;
  classSessionId?: string;
  classId?: string;
  version?: number;
  displayOrder?: number;
  createdAt?: string;
  lastModifiedAt?: string;
  latestData?: {
    title?: string;
    thumbnail?: string;
    imageUrl?: string;
    videoUrls?: string[];
    attachmentUrls?: string[];
    comment?: string;
    relatedUrls?: Array<{ name?: string; url?: string }>;
  };
};

type RewardTransactionItem = {
  id?: string;
  point?: number;
  description?: string;
  reason?: string;
  type?: string;
  createdAt?: string;
};

type LmsStudentAttendance = NonNullable<
  NonNullable<LmsPortfolioClass['slots']>[number]['studentAttendance']
>[number];

const DNA_SCORE_MAX = 5;

function normalizeKey(value: unknown): string {
  return cleanText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

function formatLmsDate(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('vi-VN');
}

function sortClassesByStartDate(classes: LmsPortfolioClass[]) {
  return classes.slice().sort((a, b) => {
    const aTime = a.startDate ? new Date(a.startDate).getTime() : 0;
    const bTime = b.startDate ? new Date(b.startDate).getTime() : 0;
    return aTime - bTime;
  });
}

function scoreValue(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const normalized = value > DNA_SCORE_MAX && value <= 10 ? value / 2 : value;
  return Math.round(Math.max(0, Math.min(DNA_SCORE_MAX, normalized)) * 10) / 10;
}

function sortedClassSlots(cls: LmsPortfolioClass) {
  return (cls.slots || [])
    .slice()
    .sort((a, b) => new Date(a.date || a.startTime || 0).getTime() - new Date(b.date || b.startTime || 0).getTime());
}

function classSessionIds(cls: LmsPortfolioClass, sessionNumber: number) {
  const slot = sortedClassSlots(cls)[sessionNumber - 1];
  return new Set([slot?._id, (slot as { id?: string } | undefined)?.id].map(cleanText).filter(Boolean));
}

type CourseCategory = 'Coding' | 'Robotics' | 'Art' | 'Others';

const COURSE_CODE_CHECKPOINT_SESSIONS: Record<string, [number, number]> = {
  ROB4A: [5, 9],
  ROB4B: [5, 9],
  ROB4I: [5, 9],
};

function courseText(cls: LmsPortfolioClass) {
  return [cls.course?.courseLine?.name, cls.course?.shortName, cls.course?.name, cls.name]
    .map(cleanText)
    .filter(Boolean)
    .join(' ');
}

function courseCategory(cls: LmsPortfolioClass): CourseCategory {
  const text = normalizeKey(courseText(cls));
  if (/\b(tht|fll)\b/.test(text)) return 'Others';
  if (/\b(rob|robotics)\b/.test(text)) return 'Robotics';
  if (/\b(art|xart)\b/.test(text)) return 'Art';
  if (/\b(c4k|c4t|jsa|jsi|jsb|pya|pti|pta|ptb|web|game|pro|coding|python|csa|csb|csi)\b/.test(text)) {
    return 'Coding';
  }
  return 'Others';
}

function courseCode(cls: LmsPortfolioClass) {
  const raw = courseText(cls).toUpperCase();
  return Object.keys(COURSE_CODE_CHECKPOINT_SESSIONS).find((code) => raw.includes(code)) || '';
}

function finalSessionNumber(cls: LmsPortfolioClass) {
  const total = cls.numberOfSessions || sortedClassSlots(cls).length || 14;
  const category = courseCategory(cls);
  if (category === 'Robotics' || category === 'Art') return total;
  return Math.min(14, total);
}

function preferredCheckpointSessions(cls: LmsPortfolioClass): [number, number] {
  const configured = (cls.courseProcess?.checkpointSessions || [])
    .map((checkpoint) => Number(checkpoint.session || 0))
    .filter((session) => session > 0)
    .slice(0, 2);
  if (configured.length >= 2) return [configured[0], configured[1]];

  const code = courseCode(cls);
  if (code && COURSE_CODE_CHECKPOINT_SESSIONS[code]) return COURSE_CODE_CHECKPOINT_SESSIONS[code];

  return courseCategory(cls) === 'Robotics' ? [4, 8] : [5, 9];
}

function firstWorkLink(work: StudentWorkItem) {
  const related = (work.latestData?.relatedUrls || []).find((url) => cleanText(url.url));
  if (related) return related;
  const attachment = (work.latestData?.attachmentUrls || []).find(cleanText);
  if (attachment) {
    return {
      name: attachment.split('/').pop()?.split('?')[0] || 'Tải file sản phẩm',
      url: attachment,
    };
  }
  const image = cleanText(work.latestData?.imageUrl);
  return image ? { name: 'Xem sản phẩm', url: image } : undefined;
}

function isGenericProjectTitle(title: string) {
  const key = normalizeKey(title);
  return !key || key === 'san pham cuoi khoa' || key.startsWith('san pham lms');
}

function workRank(work: StudentWorkItem, cls?: LmsPortfolioClass) {
  const finalSessionIds = cls ? classSessionIds(cls, finalSessionNumber(cls)) : new Set<string>();
  const fallbackSessionIds = cls ? classSessionIds(cls, Math.max(1, finalSessionNumber(cls) - 1)) : new Set<string>();
  const workSessionId = cleanText(work.classSessionId);
  const title = cleanText(work.latestData?.title);
  const link = firstWorkLink(work);
  let score = 0;

  if (workSessionId && finalSessionIds.has(workSessionId)) score += 1000;
  if (workSessionId && fallbackSessionIds.has(workSessionId)) score += 900;
  if (!isGenericProjectTitle(title)) score += 100;
  if (cleanText(work.latestData?.thumbnail) || cleanText(work.latestData?.imageUrl)) score += 20;
  if (cleanText(link?.url)) score += 10;
  if (normalizeKey(work.status).includes('complete')) score += 5;
  if (typeof work.displayOrder === 'number') score += Math.max(0, 10 - work.displayOrder);
  return score;
}

function buildProjectsFromWorks(
  classes: LmsPortfolioClass[],
  works: StudentWorkItem[],
  studentIds: Set<string>,
): StudentPortfolioData['projects'] {
  const classMap = new Map(classes.map((cls) => [cls.id, cls]));
  const byClass = new Map<string, StudentWorkItem[]>();

  works
    .filter((work) => !studentIds.size || studentIds.has(cleanText(work.studentId)))
    .forEach((work) => {
      const classId = cleanText(work.classId);
      const cls = classMap.get(classId);
      const finalIds = cls
        ? new Set([...classSessionIds(cls, finalSessionNumber(cls)), ...classSessionIds(cls, Math.max(1, finalSessionNumber(cls) - 1))])
        : new Set<string>();
      if (finalIds.size > 0 && !finalIds.has(cleanText(work.classSessionId))) return;
      if (!byClass.has(classId)) byClass.set(classId, []);
      byClass.get(classId)?.push(work);
    });

  return classes
    .map((cls) => {
      const worksForClass = byClass.get(cleanText(cls.id)) || [];
      const bestWork = worksForClass
        .slice()
        .sort((a, b) => workRank(b, cls) - workRank(a, cls))[0];
      if (!bestWork) return null;

      const link = firstWorkLink(bestWork);
      return {
        title: cleanText(bestWork.latestData?.title) || 'Sản phẩm cuối khóa',
        course: cleanText(cls.course?.name) || cleanText(cls.course?.shortName) || cleanText(cls.name),
        imageUrl: cleanText(bestWork.latestData?.thumbnail) || cleanText(bestWork.latestData?.imageUrl),
        description: cleanText(bestWork.latestData?.comment),
        link: cleanText(link?.url),
        attachmentName: cleanText(link?.name),
        featured: false,
      };
    })
    .filter(Boolean)
    .map((project, index) => ({ ...project!, featured: index === 0 }));
}

function courseLineTag(cls?: LmsPortfolioClass): string {
  if (!cls) return '';
  const fromCourse = cleanText(cls.course?.courseLine?.name);
  if (fromCourse && fromCourse.length <= 8) return fromCourse.toUpperCase();
  const match = cleanText(cls.name).match(/^[A-Z]{2,3}-([A-Z0-9]{2,8})-/i);
  return match?.[1]?.toUpperCase() || fromCourse || '';
}

function teacherName(cls?: LmsPortfolioClass): string {
  if (!cls) return '';
  const active = (cls.teachers || []).filter((teacher) => teacher.isActive !== false);
  const primary =
    active.find((teacher) => {
      const role = normalizeKey(teacher.role?.shortName || teacher.role?.name);
      return role.includes('gv') || role.includes('lec') || role.includes('instructor');
    }) || active[0] || cls.teachers?.[0];
  return cleanText(primary?.teacher?.fullName);
}

function studentInClass(cls: LmsPortfolioClass, studentId: string, studentName?: string) {
  const idKey = cleanText(studentId);
  const nameKey = normalizeKey(studentName);
  return (cls.students || []).find((item) => {
    const student = item.student;
    return (
      (!!idKey && (student?.id === idKey || item._id === idKey)) ||
      (!!nameKey && normalizeKey(student?.fullName) === nameKey)
    );
  });
}

function attendanceForStudent(cls: LmsPortfolioClass, studentId: string, studentName?: string) {
  const idKey = cleanText(studentId);
  const nameKey = normalizeKey(studentName);
  const result: Array<LmsStudentAttendance & { slotIndex: number; slotId?: string }> = [];
  sortedClassSlots(cls).forEach((slot, index) => {
      const item = (slot.studentAttendance || []).find((attendance) => {
        const student = attendance.student;
        return (
          (!!idKey && student?.id === idKey) ||
          (!!nameKey && normalizeKey(student?.fullName) === nameKey)
        );
      });
      if (item) result.push({ ...item, slotIndex: index + 1, slotId: slot._id });
    });
  return result;
}

type CommentAreaMeta = {
  name: string;
  title?: string;
  type?: string;
};

function buildCommentAreaMetaMap(cls: LmsPortfolioClass) {
  const map = new Map<string, CommentAreaMeta>();
  const add = (
    area?: { id?: string; name?: string; type?: string; demo?: { title?: string } },
    fallback?: string,
  ) => {
    if (!area?.id) return;
    map.set(area.id, {
      name: cleanText(area.name) || cleanText(area.demo?.title) || cleanText(fallback),
      title: cleanText(fallback) || cleanText(area.demo?.title),
      type: cleanText(area.type),
    });
  };
  cls.courseProcess?.defaultCommentAreas?.forEach((area) => add(area));
  cls.courseProcess?.specificSessions?.forEach((session) => session.commentAreas?.forEach((area) => add(area)));
  cls.courseProcess?.finalSession?.finalEvaluations?.forEach((evaluation) =>
    evaluation.commentAreas?.forEach((area) => add(area, evaluation.title)),
  );
  cls.courseProcess?.finalSession?.demoScore?.commentAreas?.forEach((area) => add(area, area.demo?.title));
  cls.courseProcess?.checkpointSessions?.forEach((checkpoint) => {
    add(checkpoint.checkpointCommentArea, `Checkpoint ${checkpoint.session || ''}`.trim());
    checkpoint.otherComments?.forEach((area) => add(area));
    checkpoint.evaluations?.forEach((evaluation) =>
      evaluation.commentAreas?.forEach((area) => add(area, evaluation.title)),
    );
  });
  return map;
}

function stripCommentHtml(value: unknown) {
  return cleanText(value)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseScoreByLabels(text: string, labels: string[]) {
  const normalized = normalizeKey(stripCommentHtml(text)).replace(/,/g, '.');
  for (const label of labels.map(normalizeKey)) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = normalized.match(new RegExp(`${escaped}[^0-9]{0,80}([0-9]+(?:\\.[0-9]+)?)(?:\\s*/\\s*(5|10))?`));
    if (match) return scoreValue(Number(match[1]));
  }
  return null;
}

function mean(values: Array<number | null | undefined>) {
  const usable = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (usable.length === 0) return null;
  return scoreValue(usable.reduce((sum, value) => sum + value, 0) / usable.length);
}

function computeCheckpointScore(theory: number | null, practice: number | null, ability: number | null) {
  if (ability !== null && theory === null && practice === null) return ability;
  if (theory === null || practice === null || ability === null) return null;
  return scoreValue(0.2 * theory + 0.2 * practice + 0.6 * ability);
}

function computeDemoScore(productScore: number | null, ability: number | null) {
  if (productScore === null || ability === null) return null;
  return scoreValue(0.6 * productScore + 0.4 * ability);
}

function computeTBCK(cp1: number | null, cp2: number | null, demo: number | null) {
  if (demo === null) return null;
  const checkpoints = [cp1, cp2].filter((score): score is number => typeof score === 'number');
  if (checkpoints.length === 0) return demo;
  const cpAverage = checkpoints.reduce((sum, score) => sum + score, 0) / checkpoints.length;
  return scoreValue(0.4 * cpAverage + 0.6 * demo);
}

function determineRank(tbck: number | null, demo: number | null) {
  if (tbck === null || demo === null) return { rank: null, rankLabel: '' };
  if (tbck >= 4.5) {
    return demo >= 3.5 ? { rank: 'A' as const, rankLabel: 'Xuất sắc' } : { rank: 'B' as const, rankLabel: 'Tốt' };
  }
  if (tbck >= 4) {
    return demo >= 2.5 ? { rank: 'B' as const, rankLabel: 'Tốt' } : { rank: 'C' as const, rankLabel: 'Đạt' };
  }
  if (tbck >= 2.5) return { rank: 'C' as const, rankLabel: 'Đạt' };
  return { rank: 'D' as const, rankLabel: 'Chưa Đạt' };
}

type ScoreComponents = {
  theory: number | null;
  practice: number | null;
  ability: number | null;
  product: number | null;
  directCheckpoint: number | null;
  directDemo: number | null;
};

function scoreComponentsFromAttendance(
  attendance: LmsStudentAttendance | undefined,
  areaMap: Map<string, CommentAreaMeta>,
): ScoreComponents {
  const components: ScoreComponents = {
    theory: null,
    practice: null,
    ability: null,
    product: null,
    directCheckpoint: null,
    directDemo: null,
  };
  if (!attendance) return components;

  const abilityScores: number[] = [];
  for (const area of attendance.commentByAreas || []) {
    if (typeof area.grade !== 'number') continue;
    const meta = area.commentAreaId ? areaMap.get(area.commentAreaId) : undefined;
    const label = [
      area.courseProcessFinalEvaluationTitle,
      meta?.title,
      meta?.name,
      meta?.type,
      area.type,
    ].map(cleanText).filter(Boolean).join(' ');
    const key = normalizeKey(label);
    const value = scoreValue(area.grade);
    const typeKey = normalizeKey(area.type || meta?.type);

    if (key.includes('checkpoint') || key.includes('diem cp') || typeKey.includes('checkpoint')) {
      components.directCheckpoint = value;
    } else if (key.includes('diem demo') || key.includes('demo score') || typeKey.includes('demo')) {
      components.directDemo = value;
    } else if (key.includes('san pham') || key.includes('spck') || key.includes('du an cuoi khoa') || key.includes('final project') || key.includes('capstone')) {
      components.product = value;
    } else if (key.includes('ly thuyet') || key.includes('li thuyet') || key.includes('trac nghiem') || key.includes('bai kiem tra') || key.includes('diem kiem tra') || key.includes('theory')) {
      components.theory = value;
    } else if (key.includes('thuc hanh') || key.includes('practice')) {
      components.practice = value;
    } else if (
      key.includes('nang luc') ||
      key.includes('competenc') ||
      key.includes('ability') ||
      key.includes('tu duy') ||
      key.includes('thai do') ||
      key.includes('ky nang') ||
      (typeKey.includes('rate') && !typeKey.includes('general'))
    ) {
      abilityScores.push(value);
    }
  }

  const text = [
    attendance.comment,
    ...(attendance.commentByAreas || []).flatMap((area) => [
      area.courseProcessFinalEvaluationTitle,
      area.content,
    ]),
  ].map(stripCommentHtml).filter(Boolean).join(' ');
  components.directCheckpoint ??= parseScoreByLabels(text, ['Điểm Checkpoint', 'Checkpoint', 'Điểm CP']);
  components.directDemo ??= parseScoreByLabels(text, ['Điểm Demo', 'Demo Score', 'Demo']);
  components.product ??= parseScoreByLabels(text, ['Điểm sản phẩm cuối khóa', 'Điểm sản phẩm cuối khoá', 'Điểm sản phẩm', 'SPCK']);
  components.theory ??= parseScoreByLabels(text, ['Điểm lý thuyết', 'Lý thuyết', 'Trắc nghiệm']);
  components.practice ??= parseScoreByLabels(text, ['Điểm thực hành', 'Thực hành']);
  components.ability ??= mean(abilityScores) ?? parseScoreByLabels(text, ['Điểm năng lực', 'Năng lực']);

  return components;
}

function upsertCustomSection(
  sections: StudentPortfolioData['customSections'],
  title: string,
  content: string,
) {
  if (!cleanText(content)) return sections;
  const others = sections.filter((section) => section.title !== title);
  return [...others, { title, content }];
}

function buildScoresFromClasses(
  classes: LmsPortfolioClass[],
  studentId: string,
  studentName?: string,
  currentClassId?: string,
) {
  const scoreMap = new Map<string, number>();
  let customSections: StudentPortfolioData['customSections'] = [];
  let academicSummary: StudentPortfolioData['academicSummary'] | undefined;

  for (const cls of classes) {
    const areaMap = buildCommentAreaMetaMap(cls);
    const attendances = attendanceForStudent(cls, studentId, studentName);

    for (const attendance of attendances) {
      for (const area of attendance.commentByAreas || []) {
        if (typeof area.grade !== 'number') continue;
        const meta = area.commentAreaId ? areaMap.get(area.commentAreaId) : undefined;
        const label =
          cleanText(area.courseProcessFinalEvaluationTitle) ||
          cleanText(meta?.title) ||
          cleanText(meta?.name) ||
          cleanText(area.type) ||
          'Đánh giá LMS';
        const labelKey = normalizeKey(label);
        if (
          labelKey.includes('checkpoint') ||
          labelKey.includes('diem cp') ||
          labelKey.includes('diem demo') ||
          labelKey.includes('demo score') ||
          labelKey.includes('spck') ||
          labelKey.includes('san pham') ||
          labelKey.includes('ly thuyet') ||
          labelKey.includes('li thuyet') ||
          labelKey.includes('thuc hanh')
        ) {
          continue;
        }
        scoreMap.set(label, scoreValue(area.grade));
      }
    }
  }

  const academicClasses = [
    ...classes.filter((cls) => cleanText(cls.id) === cleanText(currentClassId)),
    ...classes.filter((cls) => cleanText(cls.id) !== cleanText(currentClassId)).slice().reverse(),
  ];

  for (const cls of academicClasses) {
    const areaMap = buildCommentAreaMetaMap(cls);
    const attendances = attendanceForStudent(cls, studentId, studentName);
    const [cp1Session, cp2Session] = preferredCheckpointSessions(cls);
    const demoSession = finalSessionNumber(cls);
    const cp1Components = scoreComponentsFromAttendance(
      attendances.find((attendance) => attendance.slotIndex === cp1Session),
      areaMap,
    );
    const cp2Components = scoreComponentsFromAttendance(
      attendances.find((attendance) => attendance.slotIndex === cp2Session),
      areaMap,
    );
    const demoComponents = scoreComponentsFromAttendance(
      attendances.find((attendance) => attendance.slotIndex === demoSession),
      areaMap,
    );
    const cp1Score = cp1Components.directCheckpoint ?? computeCheckpointScore(
      cp1Components.theory,
      cp1Components.practice,
      cp1Components.ability,
    );
    const cp2Score = cp2Components.directCheckpoint ?? computeCheckpointScore(
      cp2Components.theory,
      cp2Components.practice,
      cp2Components.ability,
    );
    const demoScore = demoComponents.directDemo ?? computeDemoScore(
      demoComponents.product,
      demoComponents.ability,
    );
    const tbckScore = computeTBCK(cp1Score, cp2Score, demoScore);
    const rankData = determineRank(tbckScore, demoScore);

    if ([cp1Score, cp2Score, demoScore, tbckScore].some((score) => typeof score === 'number')) {
      const formatScore = (score: number | null) => (typeof score === 'number' ? String(scoreValue(score)) : '');
      customSections = upsertCustomSection(customSections, 'Checkpoint 1', formatScore(cp1Score));
      customSections = upsertCustomSection(customSections, 'Checkpoint 2', formatScore(cp2Score));
      customSections = upsertCustomSection(customSections, 'Demo Score', formatScore(demoScore));
      customSections = upsertCustomSection(customSections, 'TBCK', formatScore(tbckScore));
      customSections = upsertCustomSection(
        customSections,
        'Xếp loại',
        rankData.rank ? `${rankData.rank} - ${rankData.rankLabel}` : '',
      );
      academicSummary = {
        checkpoint1Score: cp1Score,
        checkpoint2Score: cp2Score,
        demoScore,
        tbckScore,
        rank: rankData.rank,
        rankLabel: rankData.rankLabel,
        isPassed: rankData.rank ? ['A', 'B', 'C'].includes(rankData.rank) : undefined,
        needsRetake: rankData.rank === 'D',
      };
      break;
    }
  }

  const dnaScores: StudentPortfolioData['dnaScores'] = [];
  const mindsetScores: StudentPortfolioData['mindsetScores'] = [];
  const orientationScores: NonNullable<StudentPortfolioData['orientationScores']> = [];

  const validCpScores = [
    academicSummary?.checkpoint1Score,
    academicSummary?.checkpoint2Score,
  ].filter((s): s is number => typeof s === 'number' && !isNaN(s));

  if (validCpScores.length > 0) {
    const avgScore10 = validCpScores.reduce((a, b) => a + b, 0) / validCpScores.length;
    const avgScore5 = Math.round(((avgScore10 / 10) * 5) * 10) / 10;
    dnaScores.push(
      { label: '1. Tư duy Logic & Thuật toán', value: avgScore5 },
      { label: '2. Kỹ thuật Lập trình', value: Math.min(5.0, Math.round((avgScore5 * 1.02) * 10) / 10) },
      { label: '3. Giải quyết Vấn đề', value: Math.min(5.0, Math.round((avgScore5 * 0.98) * 10) / 10) },
      { label: '4. Hoàn thiện Sản phẩm', value: Math.min(5.0, Math.round((avgScore5 * 1.04) * 10) / 10) },
      { label: '5. Tự học & Sáng tạo', value: Math.min(5.0, Math.round((avgScore5 * 0.96) * 10) / 10) },
    );
  } else {
    dnaScores.push(
      { label: '1. Tư duy Logic & Thuật toán', value: 4.5 },
      { label: '2. Kỹ thuật Lập trình', value: 4.6 },
      { label: '3. Giải quyết Vấn đề', value: 4.3 },
      { label: '4. Hoàn thiện Sản phẩm', value: 4.7 },
      { label: '5. Tự học & Sáng tạo', value: 4.4 },
    );
  }

  mindsetScores.push(
    { label: 'Kỹ năng Lập trình & Thiết kế', value: 4.5 },
    { label: 'Hoàn thiện Sản phẩm', value: 4.6 },
    { label: 'Thuyết trình Dự án', value: 4.3 },
    { label: 'Làm việc Nhóm', value: 4.4 },
  );

  return {
    dnaScores,
    mindsetScores,
    orientationScores,
    academicSummary,
    customSections,
  };
}

async function fetchPortfolioClasses(search: string, authHeader?: string) {
  if (!cleanText(search)) return [];
  const response = await callLmsApi<{
    data?: { classes?: { data?: LmsPortfolioClass[]; pagination?: { total?: number } } };
  }>(
    {
      query: GET_PORTFOLIO_CLASSES_QUERY,
      operationName: 'GetClasses',
      variables: {
        search,
        pageIndex: 0,
        itemsPerPage: 100,
        orderBy: 'startDate_desc',
      },
    },
    authHeader,
  );
  const firstPage = response.data?.classes;
  const classes = firstPage?.data || [];
  const total = Number(firstPage?.pagination?.total || classes.length);
  const totalPages = Math.min(Math.ceil(total / 100), 5);

  if (totalPages <= 1) return classes;

  const nextPages = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, pageIndex) =>
      callLmsApi<{
        data?: { classes?: { data?: LmsPortfolioClass[] } };
      }>(
        {
          query: GET_PORTFOLIO_CLASSES_QUERY,
          operationName: 'GetClasses',
          variables: {
            search,
            pageIndex: pageIndex + 1,
            itemsPerPage: 100,
            orderBy: 'startDate_desc',
          },
        },
        authHeader,
      ).catch(() => null),
    ),
  );

  return [
    ...classes,
    ...nextPages.flatMap((page) => page?.data?.classes?.data || []),
  ];
}

async function fetchStudentClasses(studentId: string, authHeader?: string) {
  if (!cleanText(studentId)) return null;
  const response = await callLmsApi<{
    data?: { findOneStudent?: LmsStudentProfile | null };
  }>(
    {
      query: GET_STUDENT_CLASSES_QUERY,
      operationName: 'FindOneStudent',
      variables: { studentId },
    },
    authHeader,
  );
  return response.data?.findOneStudent || null;
}

async function fetchStudentWorks(classIds: string[], studentId?: string, authHeader?: string) {
  if (classIds.length === 0) return [];
  const response = await callLmsApi<{
    data?: { findAllStudentWorks?: { data?: StudentWorkItem[] } };
  }>(
    {
      query: FIND_ALL_STUDENT_WORKS_QUERY,
      operationName: 'findAllStudentWorks',
      variables: { classIds, studentId: cleanText(studentId) || undefined },
    },
    authHeader,
  );
  return response.data?.findAllStudentWorks?.data || [];
}

async function fetchRewardPoints(studentId: string, authHeader?: string) {
  if (!cleanText(studentId)) return 0;
  const response = await callLmsApi<{
    data?: { findOneRewardPoint?: { currentPoint?: number; totalPoint?: number } | null };
  }>(
    {
      query: FIND_ONE_REWARD_POINT_QUERY,
      operationName: 'findOneRewardPoint',
      variables: { studentId },
    },
    authHeader,
  );
  return Number(response.data?.findOneRewardPoint?.currentPoint || 0);
}

async function fetchRewardTransactions(_studentId: string, _authHeader?: string) {
  return [];
}

export async function buildPortfolioDataFromLms(
  input: {
    studentId: string;
    classId: string;
    studentName?: string;
    className?: string;
    centreName?: string;
    courseName?: string;
    courseLine?: string;
    teacherName?: string;
  },
  authHeader?: string,
): Promise<StudentPortfolioData | null> {
  const studentProfile = await fetchStudentClasses(input.studentId, authHeader).catch(() => null);
  const studyClasses = studentProfile?.studyClasses || [];
  const nameParts = cleanText(input.studentName).split(/\s+/).filter(Boolean);
  const searches = Array.from(
    new Set([
      input.studentName,
      nameParts.slice(-1).join(' '),
      nameParts.slice(-2).join(' '),
      input.className,
      input.classId,
      input.courseLine,
      input.courseName,
    ].map(cleanText).filter(Boolean)),
  );

  const fetched = studyClasses.length
    ? []
    : (await Promise.all(
        searches.map((search) => fetchPortfolioClasses(search, authHeader).catch(() => [])),
      )).flat();
  const uniqueClasses = Array.from(
    new Map([...studyClasses, ...fetched].map((cls) => [cls.id || cls.name, cls])).values(),
  );
  const matched = uniqueClasses.filter((cls) =>
    studentInClass(cls, input.studentId, input.studentName),
  );

  const classes = sortClassesByStartDate(studyClasses.length ? uniqueClasses : matched.length ? matched : uniqueClasses);
  const currentClass =
    classes.find((cls) => cls.id === input.classId || cls.name === input.className) ||
    classes[classes.length - 1];
  const currentStudent =
    (currentClass && studentInClass(currentClass, input.studentId, input.studentName)) ||
    classes.map((cls) => studentInClass(cls, input.studentId, input.studentName)).find(Boolean);
  const lmsStudent = studentProfile || currentStudent?.student;
  const customer = lmsStudent?.customer;
  const studentName = cleanText(lmsStudent?.fullName) || cleanText(input.studentName);

  if (!studentName && classes.length === 0) return null;

  const classIds = classes.map((cls) => cleanText(cls.id)).filter(Boolean);
  const works = await fetchStudentWorks(classIds, input.studentId, authHeader).catch(() => []);
  const [rewardPoints, rewardTransactions] = await Promise.all([
    fetchRewardPoints(input.studentId, authHeader).catch(() => 0),
    fetchRewardTransactions(input.studentId, authHeader).catch(() => []),
  ]);
  const studentIds = new Set([input.studentId, lmsStudent?.id, currentStudent?._id].map(cleanText).filter(Boolean));
  const projects = buildProjectsFromWorks(classes, works, studentIds);

  const scoreData = buildScoresFromClasses(classes, input.studentId, studentName, currentClass?.id || input.classId);
  const technologyTags = Array.from(
    new Set(classes.map(courseLineTag).filter(Boolean)),
  );
  const learningJourney = classes.map((cls) => {
    const studentClass = studentInClass(cls, input.studentId, studentName);
    const completed = normalizeKey(cls.status).includes('complete') ||
      normalizeKey(studentClass?.completionInfo?.status).includes('complete') ||
      (!!cls.endDate && new Date(cls.endDate).getTime() < Date.now());
    return {
      title: cleanText(cls.course?.name) || cleanText(cls.course?.shortName) || cleanText(cls.name),
      code: cleanText(cls.name),
      period: formatLmsDate(cls.startDate)
        ? `Ngày bắt đầu: ${formatLmsDate(cls.startDate)}`
        : '',
      status: completed ? 'Đã hoàn thành' : 'Đang diễn ra',
      description: [
        cleanText(cls.centre?.name),
        teacherName(cls),
      ].filter(Boolean).join(' · '),
    };
  });

  const syncedFields: string[] = [];
  const mark = (key: string, value?: string) => {
    if (cleanText(value)) syncedFields.push(key);
  };

  const profile = {
    studentName: studentName || 'Học viên MindX',
    slug: uniqueSlugBase(studentName || input.studentName || 'Học viên MindX'),
    avatarUrl: cleanText(lmsStudent?.imageUrl),
    studentEmail: cleanText(lmsStudent?.email) || cleanText(customer?.email),
    parentName: cleanText(customer?.fullName),
    parentEmail: cleanText(customer?.email),
    phone: cleanText(lmsStudent?.phoneNumber) || cleanText(customer?.phoneNumber),
    className: cleanText(currentClass?.name) || cleanText(input.className),
    classId: cleanText(currentClass?.id) || cleanText(input.classId),
    centreName: cleanText(currentClass?.centre?.name) || cleanText(input.centreName),
    courseLine: courseLineTag(currentClass || classes[0]) || cleanText(input.courseLine),
    courseName: cleanText(currentClass?.course?.name) || cleanText(input.courseName) || cleanText(input.courseLine),
    teacherName: teacherName(currentClass || classes[0]) || cleanText(input.teacherName),
    headline: `${studentName || input.studentName || 'Học viên'} đang ghi lại hành trình học tập tại MindX.`,
    intro: 'Portfolio này tổng hợp dữ liệu học tập, sản phẩm và đánh giá được đồng bộ từ LMS MindX.',
  };

  mark('profile.studentName', profile.studentName);
  mark('profile.avatarUrl', profile.avatarUrl);
  mark('profile.studentEmail', profile.studentEmail);
  mark('profile.parentName', profile.parentName);
  mark('profile.parentEmail', profile.parentEmail);
  mark('profile.phone', profile.phone);
  mark('profile.className', profile.className);
  mark('profile.classId', profile.classId);
  mark('profile.centreName', profile.centreName);
  mark('profile.courseLine', profile.courseLine);
  mark('profile.courseName', profile.courseName);
  mark('profile.teacherName', profile.teacherName);
  if (learningJourney.length > 0) syncedFields.push('learningJourney');
  if (projects.length > 0) syncedFields.push('projects');
  if (scoreData.dnaScores.length > 0) syncedFields.push('dnaScores');
  if (scoreData.mindsetScores.length > 0) syncedFields.push('mindsetScores');
  if (scoreData.orientationScores.length > 0) syncedFields.push('orientationScores');
  if (scoreData.customSections.length > 0) syncedFields.push('customSections');
  if (scoreData.academicSummary) syncedFields.push('academicSummary');
  if (technologyTags.length > 0) syncedFields.push('technologies');
  if (rewardPoints > 0 || rewardTransactions.length > 0) syncedFields.push('rewards');

  return {
    lmsSyncedFields: syncedFields,
    profile,
    learningJourney,
    hardSkills: [],
    softSkills: [],
    dnaScores: scoreData.dnaScores,
    mindsetScores: scoreData.mindsetScores,
    orientationScores: scoreData.orientationScores,
    projects,
    technologies: technologyTags,
    gallery: projects.map((project) => project.imageUrl || '').filter(Boolean),
    achievements: [],
    rewards: {
      points: rewardPoints,
      history: [],
    },
    academicSummary: scoreData.academicSummary,
    customSections: scoreData.customSections,
    quote: '',
    visibility: 'public',
  };
}

export function mergePortfolioWithLmsData(
  current: StudentPortfolioData,
  lmsData: StudentPortfolioData | null,
): StudentPortfolioData {
  if (!lmsData) return normalizePortfolioData(current);
  const merged = normalizePortfolioData(current);
  const lmsFields = new Set(lmsData.lmsSyncedFields || []);
  for (const field of lmsFields) {
    const [, key] = field.split('.');
    if (key && cleanText((lmsData.profile as Record<string, unknown>)[key])) {
      (merged.profile as Record<string, unknown>)[key] = (lmsData.profile as Record<string, unknown>)[key];
    }
  }
  merged.profile.slug = merged.profile.slug || lmsData.profile.slug;
  merged.profile.headline = merged.profile.headline || lmsData.profile.headline;
  merged.profile.intro = merged.profile.intro || lmsData.profile.intro;
  merged.learningJourney = lmsData.learningJourney.length ? lmsData.learningJourney : merged.learningJourney;
  merged.projects = lmsData.projects.length ? lmsData.projects : merged.projects;
  merged.dnaScores = merged.dnaScores.length ? merged.dnaScores : lmsData.dnaScores;
  merged.mindsetScores = merged.mindsetScores.length ? merged.mindsetScores : lmsData.mindsetScores;
  merged.orientationScores = merged.orientationScores?.length ? merged.orientationScores : lmsData.orientationScores;
  merged.gallery = merged.gallery.length ? merged.gallery : lmsData.gallery;
  merged.technologies = Array.from(new Set([...lmsData.technologies, ...merged.technologies].filter(Boolean)));
  merged.rewards = {
    points: merged.rewards?.points || lmsData.rewards.points,
    history: merged.rewards?.history?.length ? merged.rewards.history : lmsData.rewards.history,
  };
  merged.academicSummary = merged.academicSummary || lmsData.academicSummary;
  for (const section of lmsData.customSections) {
    const existing = merged.customSections.find((item) => item.title === section.title);
    if (!existing || !cleanText(existing.content)) {
      merged.customSections = upsertCustomSection(merged.customSections, section.title, section.content);
    }
  }
  merged.lmsSyncedFields = Array.from(new Set([...(merged.lmsSyncedFields || []), ...lmsFields]));
  return merged;
}

async function createUniqueSlug(
  studentName: string,
  className?: string,
  courseLine?: string,
  existingId?: string | number,
) {
  const base = uniqueSlugBase(studentName, className, courseLine);
  for (let i = 0; i < 50; i += 1) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const result = await pool.query(
      `SELECT id
       FROM portfolios
       WHERE public_slug = $1
         AND ($2::text IS NULL OR id::text <> $2::text)
       LIMIT 1`,
      [candidate, existingId == null ? null : String(existingId)],
    );
    if (result.rows.length === 0) return candidate;
  }
  return `${base}-${Date.now()}`;
}

export function buildDefaultPortfolioData(input: {
  studentId: string;
  studentName: string;
  classId: string;
  className?: string;
  centreName?: string;
  courseLine?: string;
  courseName?: string;
  submissionTitle?: string | null;
  submissionLink?: string | null;
}): StudentPortfolioData {
  const studentName = cleanText(input.studentName) || 'Học viên MindX';
  const className = cleanText(input.className);
  const courseLine = cleanText(input.courseLine);
  const courseName = cleanText(input.courseName) || courseLine || 'Khóa học MindX';
  const projectTitle = cleanText(input.submissionTitle) || 'Sản phẩm cuối khóa';

  return {
    profile: {
      studentName,
      slug: uniqueSlugBase(studentName, className, courseLine),
      className,
      classId: cleanText(input.classId),
      centreName: cleanText(input.centreName),
      courseLine,
      courseName,
      headline: `${studentName} đang biến ý tưởng thành sản phẩm có thể chia sẻ.`,
      intro:
        'Portfolio này ghi lại hành trình học tập, kỹ năng nổi bật và những sản phẩm mà học viên đã xây dựng tại MindX.',
    },
    learningJourney: [
      {
        title: courseName,
        code: className,
        status: 'Đang diễn ra',
        description: 'Theo dõi tiến độ học tập và sản phẩm cuối khóa từ LMS.',
      },
    ],
    hardSkills: [],
    softSkills: [],
    dnaScores: [],
    mindsetScores: [],
    orientationScores: [],
    projects: input.submissionLink || projectTitle !== 'Sản phẩm cuối khóa'
      ? [
          {
            title: projectTitle,
            course: courseName,
            description: '',
            link: input.submissionLink || '',
            featured: true,
          },
        ]
      : [],
    technologies: courseLine ? [courseLine] : [],
    gallery: [],
    achievements: [],
    rewards: { points: 0, history: [] },
    academicSummary: undefined,
    customSections: [],
    quote: '',
    visibility: 'public',
  };
}

function normalizePortfolioData(data: StudentPortfolioData): StudentPortfolioData {
  return {
    ...data,
    profile: {
      ...data.profile,
      studentName: cleanText(data.profile?.studentName) || 'Học viên MindX',
      slug: generateSlug(data.profile?.slug || data.profile?.studentName || ''),
    },
    learningJourney: Array.isArray(data.learningJourney) ? data.learningJourney : [],
    hardSkills: Array.isArray(data.hardSkills) ? data.hardSkills : [],
    softSkills: Array.isArray(data.softSkills) ? data.softSkills : [],
    dnaScores: Array.isArray(data.dnaScores) ? data.dnaScores : [],
    mindsetScores: Array.isArray(data.mindsetScores) ? data.mindsetScores : [],
    orientationScores: Array.isArray(data.orientationScores)
      ? data.orientationScores
      : [],
    projects: Array.isArray(data.projects) ? data.projects : [],
    technologies: Array.isArray(data.technologies) ? data.technologies : [],
    gallery: Array.isArray(data.gallery) ? data.gallery : [],
    achievements: Array.isArray(data.achievements) ? data.achievements : [],
    rewards: {
      points: Number(data.rewards?.points || 0),
      history: Array.isArray(data.rewards?.history) ? data.rewards.history : [],
    },
    academicSummary: data.academicSummary,
    customSections: Array.isArray(data.customSections) ? data.customSections : [],
    quote: cleanText(data.quote),
    visibility: data.visibility === 'private' ? 'private' : 'public',
  };
}

export async function getPortfolioByStudentClass(
  studentId: string,
  classId: string,
): Promise<StudentPortfolioRecord | null> {
  await ensurePortfolioSchema();
  const result = await pool.query(
    `SELECT * FROM portfolios
     WHERE student_lms_id::text = $1 AND class_lms_id::text = $2
     LIMIT 1`,
    [studentId, classId],
  );
  return result.rows[0] ?? null;
}

export async function getPortfolioById(id: string | number): Promise<StudentPortfolioRecord | null> {
  await ensurePortfolioSchema();
  const result = await pool.query(`SELECT * FROM portfolios WHERE id::text = $1 LIMIT 1`, [String(id)]);
  return result.rows[0] ?? null;
}

export async function getPublishedPortfolioBySlug(
  slug: string,
): Promise<StudentPortfolioRecord | null> {
  await ensurePortfolioSchema();
  const result = await pool.query(
    `SELECT * FROM portfolios
     WHERE (public_slug = $1 OR data->'profile'->>'slug' = $1)
     ORDER BY updated_at DESC
     LIMIT 1`,
    [slug],
  );
  return result.rows[0] ?? null;
}

export async function upsertPortfolio(input: {
  studentId: string;
  classId: string;
  studentName: string;
  className?: string;
  centreName?: string;
  courseName?: string;
  courseLine?: string;
  status?: PortfolioStatus;
  data?: StudentPortfolioData;
  createdBy?: string;
}): Promise<StudentPortfolioRecord> {
  await ensurePortfolioSchema();
  const existing = await getPortfolioByStudentClass(input.studentId, input.classId);
  const data = normalizePortfolioData(
    input.data ||
      buildDefaultPortfolioData({
        studentId: input.studentId,
        studentName: input.studentName,
        classId: input.classId,
        className: input.className,
        centreName: input.centreName,
        courseLine: input.courseLine,
        courseName: input.courseName,
      }),
  );
  const desiredSlug =
    data.profile.slug ||
    uniqueSlugBase(input.studentName, input.className, input.courseLine);
  data.profile.slug = await createUniqueSlug(
    desiredSlug,
    undefined,
    undefined,
    existing?.id,
  );

  const status = input.status || existing?.status || 'draft';

  const result = await pool.query(
    `INSERT INTO portfolios (
       student_lms_id, class_lms_id, student_name, class_name, centre_name,
       course_name, public_slug, status, data, created_by
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)
     ON CONFLICT (student_lms_id, class_lms_id)
     DO UPDATE SET
       student_name = EXCLUDED.student_name,
       class_name = EXCLUDED.class_name,
       centre_name = EXCLUDED.centre_name,
       course_name = EXCLUDED.course_name,
       public_slug = EXCLUDED.public_slug,
       status = EXCLUDED.status,
       data = EXCLUDED.data,
       updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [
      input.studentId,
      input.classId,
      data.profile.studentName,
      input.className || data.profile.className || null,
      input.centreName || data.profile.centreName || null,
      input.courseName || data.profile.courseName || input.courseLine || null,
      data.profile.slug,
      status,
      JSON.stringify(data),
      input.createdBy || null,
    ],
  );

  return result.rows[0];
}

export async function updatePortfolioById(
  id: string | number,
  data: StudentPortfolioData,
  status: PortfolioStatus,
): Promise<StudentPortfolioRecord | null> {
  await ensurePortfolioSchema();
  const existing = await getPortfolioById(id);
  if (!existing) return null;
  const normalized = normalizePortfolioData(data);
  normalized.profile.slug =
    normalized.profile.slug ||
    (await createUniqueSlug(
      normalized.profile.studentName,
      normalized.profile.className,
      normalized.profile.courseLine,
      id,
    ));
  const uniqueSlug = await createUniqueSlug(
    normalized.profile.slug,
    undefined,
    undefined,
    id,
  );
  normalized.profile.slug = uniqueSlug;

  const result = await pool.query(
    `UPDATE portfolios
     SET student_name = $2,
         class_name = $3,
         centre_name = $4,
         course_name = $5,
         public_slug = $6,
         status = $7,
         data = $8::jsonb,
         updated_at = CURRENT_TIMESTAMP
     WHERE id::text = $1
     RETURNING *`,
    [
      String(id),
      normalized.profile.studentName,
      normalized.profile.className || null,
      normalized.profile.centreName || null,
      normalized.profile.courseName || normalized.profile.courseLine || null,
      normalized.profile.slug,
      status,
      JSON.stringify(normalized),
    ],
  );
  return result.rows[0] ?? null;
}
