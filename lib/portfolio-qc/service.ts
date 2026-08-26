import { callLmsApi } from '@/lib/lms-api';
import pool from '@/lib/db';
import type { Class } from '@/lib/student-insights/types';
import type {
  PortfolioQCClass,
  PortfolioQCStudent,
  PortfolioQCFilter,
} from './types';

// ============================================================
// LMS GraphQL Query — lighter version for QC listing
// ============================================================

const GET_CLASSES_QC_QUERY = /* graphql */ `
  query GetClasses(
    $search: String, $centre: String,
    $centres: [String], $courses: [String],
    $courseLines: [String], $startDateFrom: Date, $startDateTo: Date,
    $endDateFrom: Date, $endDateTo: Date,
    $haveSlotFrom: Date, $haveSlotTo: Date,
    $statusNotEquals: String, $status: String,
    $statusIn: [String],
    $pageIndex: Int!, $itemsPerPage: Int!,
    $orderBy: String, $teacherId: String,
    $teacherSlot: [String],
    $haveSlotIn: HaveSlotIn
  ) {
    classes(payload: {
      filter_textSearch: $search, centre_equals: $centre, centre_in: $centres,
      teacher_equals: $teacherId,
      teacherSlots: $teacherSlot, course_in: $courses, courseLine_in: $courseLines,
      startDate_gt: $startDateFrom, startDate_lt: $startDateTo,
      endDate_gt: $endDateFrom, endDate_lt: $endDateTo,
      haveSlot_from: $haveSlotFrom, haveSlot_to: $haveSlotTo,
      status_ne: $statusNotEquals, status_in: $statusIn, status_equals: $status,
      haveSlot_in: $haveSlotIn,
      pageIndex: $pageIndex, itemsPerPage: $itemsPerPage,
      orderBy: $orderBy
    }) {
      data {
        id
        name
        status
        startDate
        endDate
        course { id name shortName courseLine { id name } }
        centre { id name shortName }
        teachers {
          isActive
          teacher { id fullName }
          role { shortName }
        }
        students {
          _id
          activeInClass
          student { id fullName }
        }
        slots {
          _id
          date
        }
      }
      pagination { total }
    }
  }
`;

// ============================================================
// Helpers
// ============================================================

const LMS_TIMEZONE_OFFSET_MS = 7 * 60 * 60 * 1000;

function lmsDateToUtcIso(value: string, endOfDay = false): string {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) {
    const fallback = new Date(value);
    if (endOfDay) fallback.setHours(23, 59, 59, 999);
    else fallback.setHours(0, 0, 0, 0);
    return new Date(fallback.getTime() - LMS_TIMEZONE_OFFSET_MS).toISOString();
  }
  const utcMs = endOfDay
    ? Date.UTC(year, month - 1, day, 23, 59, 59, 999)
    : Date.UTC(year, month - 1, day, 0, 0, 0, 0);
  return new Date(utcMs - LMS_TIMEZONE_OFFSET_MS).toISOString();
}

/**
 * Sort slots chronologically and return them.
 */
function sortSlots(slots: Class['slots']): Class['slots'] {
  return (slots ?? [])
    .filter((s) => !!s.date)
    .slice()
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

/**
 * Extract the course line tag from class name or course data.
 * E.g. "TT-C4K-GI32" → "C4K", "TL-XART-VA819-ONL-HB" → "XART"
 */
function extractCourseLineTag(
  className: string,
  courseLineName?: string,
): string {
  // Try from class name pattern: XX-TAG-...
  const match = className.match(
    /^[A-Z]{2,3}-([A-Z0-9]{2,6})-/i,
  );
  if (match) return match[1].toUpperCase();

  // Fallback to courseLine name
  if (courseLineName) {
    const short = courseLineName.replace(/\s+/g, '').toUpperCase();
    if (short.length <= 6) return short;
  }

  return '';
}

/**
 * Get the primary teacher name from a class.
 */
function getPrimaryTeacher(
  teachers: Class['teachers'],
): string {
  if (!teachers?.length) return '';

  // Prefer active teacher with instructor-like role
  const active = teachers.filter((t) => t.isActive);
  const instructor =
    active.find(
      (t) =>
        t.role?.shortName?.toLowerCase() === 'gv' ||
        t.role?.shortName?.toLowerCase() === 'instructor',
    ) || active[0];

  return instructor?.teacher?.fullName || teachers[0]?.teacher?.fullName || '';
}

/**
 * Check if a student has a submission in session 13 or 14.
 * Returns the session number (13 or 14) if found, or null.
 *
 * Logic:
 * - Sort slots by date
 * - Look at slot index 12 (session 13) and index 13 (session 14) — 0-indexed
 * - If session 14 has a submission → use session 14
 * - Else if session 13 has a submission → use session 13
 * - Else → no submission
 *
 * A "submission" means the student has an attendance record with non-empty
 * commentByAreas containing at least one entry with type that includes
 * evaluation/final content, OR simply has any attendance record at all
 * in that session (presence = had the chance to submit).
 */
const FIND_ALL_STUDENT_WORKS_QUERY = /* graphql */ `
  query findAllStudentWorks($classIds: [String]) {
    findAllStudentWorks(payload: { classId_in: $classIds }) {
      data {
        id
        status
        studentId
        classSessionId
        classId
        latestData {
          title
          thumbnail
          comment
          relatedUrls {
            name
            url
          }
        }
      }
    }
  }
`;

export interface StudentWorkItem {
  id: string;
  status: string;
  studentId: string;
  classSessionId: string;
  classId: string;
  latestData?: {
    title?: string;
    thumbnail?: string;
    comment?: string;
    relatedUrls?: Array<{ name?: string; url?: string }>;
  };
}

/**
 * Check if a student has a submission in session 13 or 14 using findAllStudentWorks data and attendance fallbacks.
 */
function checkStudentSubmissionInFinalSessions(
  sortedSlots: Class['slots'],
  studentObj: { id?: string; _id?: string } | string | null | undefined,
  studentWorksMap?: Map<string, StudentWorkItem[]>,
): {
  hasSubmission: boolean;
  session: number | null;
  workTitle?: string | null;
  workLink?: string | null;
} {
  if (!sortedSlots?.length || sortedSlots.length < 13 || !studentObj) {
    return { hasSubmission: false, session: null };
  }

  // Get candidate student IDs to match
  const candidateIds: string[] = [];
  if (typeof studentObj === 'string') {
    candidateIds.push(studentObj);
  } else {
    if (studentObj.id) candidateIds.push(studentObj.id);
    if (studentObj._id) candidateIds.push(studentObj._id);
  }

  const session14Slot = sortedSlots.length >= 14 ? sortedSlots[13] : null;
  const session13Slot = sortedSlots[12]; // index 12 = session 13

  const session14Ids = new Set<string>();
  if (session14Slot?._id) session14Ids.add(session14Slot._id);
  if ((session14Slot as any)?.id) session14Ids.add((session14Slot as any).id);

  const session13Ids = new Set<string>();
  if (session13Slot?._id) session13Ids.add(session13Slot._id);
  if ((session13Slot as any)?.id) session13Ids.add((session13Slot as any).id);

  // 1. Authoritative check via findAllStudentWorks LMS data
  if (studentWorksMap !== undefined) {
    let studentWorks: StudentWorkItem[] = [];
    for (const id of candidateIds) {
      if (studentWorksMap.has(id)) {
        studentWorks = studentWorksMap.get(id)!;
        break;
      }
    }

    if (studentWorks.length > 0) {
      // Check session 14 first
      const work14 = studentWorks.find((w) => session14Ids.has(w.classSessionId));
      if (work14) {
        const link = work14.latestData?.relatedUrls?.[0]?.url || null;
        return {
          hasSubmission: true,
          session: 14,
          workTitle: work14.latestData?.title || null,
          workLink: link,
        };
      }

      // Check session 13 second
      const work13 = studentWorks.find((w) => session13Ids.has(w.classSessionId));
      if (work13) {
        const link = work13.latestData?.relatedUrls?.[0]?.url || null;
        return {
          hasSubmission: true,
          session: 13,
          workTitle: work13.latestData?.title || null,
          workLink: link,
        };
      }

    }

    // Any student without a submission in Session 13 or Session 14 has NO final course product submission.
    return { hasSubmission: false, session: null };
  }

  // 2. Fallback check: check attendance record areas/comments
  const hasSubmissionInSlot = (
    slot: Class['slots'][number] | null,
  ): boolean => {
    if (!slot || !slot.studentAttendance) return false;
    const sa = slot.studentAttendance.find((a) => {
      const sId = a.student?.id;
      const sMongoId = (a.student as { id?: string; _id?: string })?._id;
      return candidateIds.some((id) => id === sId || id === sMongoId);
    });
    if (!sa) return false;

    // Must have an actual final product submission item in commentByAreas
    // (Excluding generic ATTENDANCE / BEHAVIOR area types)
    if (sa.commentByAreas && sa.commentByAreas.length > 0) {
      const hasProductArea = sa.commentByAreas.some((area) => {
        const typeUpper = (area.type || '').toUpperCase();
        const isGenericType =
          typeUpper === 'ATTENDANCE' ||
          typeUpper === 'BEHAVIOR' ||
          typeUpper === 'DIEM_DANH';

        const hasContent = Boolean(area.content && area.content.trim().length > 0);
        const hasGrade = area.grade !== undefined && area.grade !== null;
        const hasFinalTitle = Boolean(
          area.courseProcessFinalEvaluationTitle &&
            area.courseProcessFinalEvaluationTitle.trim().length > 0,
        );

        if (hasContent || hasGrade || hasFinalTitle) {
          return true;
        }

        if (
          !isGenericType &&
          Boolean(area.type) &&
          ['FINAL', 'PRODUCT', 'PROJECT', 'SUBMISSION', 'HOMELINK', 'EVALUATION'].some(
            (t) => typeUpper.includes(t),
          )
        ) {
          return true;
        }

        return false;
      });

      if (hasProductArea) return true;
    }

    // Or if comment contains an explicit product link or submission keyword
    if (sa.comment && sa.comment.trim().length > 0) {
      const text = sa.comment.toLowerCase();
      const isGenericAttendanceComment =
        (text.includes('nhận xét học sinh') || text.includes('auto approved')) &&
        !text.includes('http') &&
        !text.includes('drive') &&
        !text.includes('link') &&
        !text.includes('sản phẩm') &&
        !text.includes('bài nộp');

      if (!isGenericAttendanceComment) {
        return true;
      }
    }

    return false;
  };

  // Priority: Check session 14 first, then session 13
  if (hasSubmissionInSlot(session14Slot)) {
    return { hasSubmission: true, session: 14 };
  }
  if (hasSubmissionInSlot(session13Slot)) {
    return { hasSubmission: true, session: 13 };
  }

  return { hasSubmission: false, session: null };
}

// Allowed statuses: Preparing, Running, Finished
const ALLOWED_CLASS_STATUSES = new Set(['preparing', 'running', 'finished']);

// ============================================================
// Main Service Functions
// ============================================================

/**
 * Fetch classes from LMS with filters, then enrich with portfolio status from DB.
 * Fetches 2 LMS pages (50 items each) in parallel per TPS page request to return 100 classes per page.
 * Only returns classes in Preparing, Running, or Finished status that have at least 13 sessions.
 */
export async function fetchClassesForQC(
  filter: PortfolioQCFilter,
  authHeader?: string,
): Promise<{
  data: PortfolioQCClass[];
  pagination: { total: number; pageIndex: number; itemsPerPage: number };
}> {
  const pageIndex = filter.pageIndex ?? 0;
  const itemsPerPage = 50; // Each LMS query page size

  // TPS page 0 -> LMS pages 0 & 1
  // TPS page 1 -> LMS pages 2 & 3
  const lmsPage1Index = pageIndex * 4;
  const lmsPage2Index = lmsPage1Index + 1;
  const lmsPage3Index = lmsPage1Index + 2;
  const lmsPage4Index = lmsPage1Index + 3;

  const baseVariables: Record<string, unknown> = {
    itemsPerPage,
    orderBy: 'createdAt_desc',
  };

  if (filter.search) baseVariables.search = filter.search;
  if (filter.teacherId) baseVariables.teacherSlot = [filter.teacherId];

  if (filter.dateFrom) {
    baseVariables.haveSlotIn = {
      from: lmsDateToUtcIso(filter.dateFrom),
      to: filter.dateTo
        ? lmsDateToUtcIso(filter.dateTo, true)
        : lmsDateToUtcIso(filter.dateFrom, true),
    };
  }

  // Fetch 4 pages from LMS in parallel (200 classes concurrently)
  const [response1, response2, response3, response4] = await Promise.all([
    callLmsApi<{
      data: { classes: { data: Class[]; pagination: { total: number } } };
    }>(
      {
        query: GET_CLASSES_QC_QUERY,
        operationName: 'GetClasses',
        variables: { ...baseVariables, pageIndex: lmsPage1Index },
      },
      authHeader,
    ).catch(() => ({ data: { classes: { data: [], pagination: { total: 0 } } } })),
    callLmsApi<{
      data: { classes: { data: Class[]; pagination: { total: number } } };
    }>(
      {
        query: GET_CLASSES_QC_QUERY,
        operationName: 'GetClasses',
        variables: { ...baseVariables, pageIndex: lmsPage2Index },
      },
      authHeader,
    ).catch(() => ({ data: { classes: { data: [], pagination: { total: 0 } } } })),
    callLmsApi<{
      data: { classes: { data: Class[]; pagination: { total: number } } };
    }>(
      {
        query: GET_CLASSES_QC_QUERY,
        operationName: 'GetClasses',
        variables: { ...baseVariables, pageIndex: lmsPage3Index },
      },
      authHeader,
    ).catch(() => ({ data: { classes: { data: [], pagination: { total: 0 } } } })),
    callLmsApi<{
      data: { classes: { data: Class[]; pagination: { total: number } } };
    }>(
      {
        query: GET_CLASSES_QC_QUERY,
        operationName: 'GetClasses',
        variables: { ...baseVariables, pageIndex: lmsPage4Index },
      },
      authHeader,
    ).catch(() => ({ data: { classes: { data: [], pagination: { total: 0 } } } })),
  ]);

  const raw1 = response1.data?.classes?.data || [];
  const raw2 = response2.data?.classes?.data || [];
  const raw3 = response3.data?.classes?.data || [];
  const raw4 = response4.data?.classes?.data || [];
  const rawTotal = response1.data?.classes?.pagination?.total || (raw1.length + raw2.length + raw3.length + raw4.length);

  // Filter: Preparing/Running/Finished status AND at least 13 sessions AND centre name filter
  const lmsClasses = [...raw1, ...raw2, ...raw3, ...raw4].filter((c) => {
    if (!c || !c.status) return false;
    if (!ALLOWED_CLASS_STATUSES.has(c.status.toLowerCase())) return false;
    const sortedSlots = sortSlots(c.slots);
    if (sortedSlots.length < 13) return false;

    // Robust Centre filter
    if (filter.centreNames?.length || filter.centres?.length) {
      const targets = filter.centreNames?.length ? filter.centreNames : filter.centres!;
      const cName = (c.centre?.name || '').toLowerCase();
      const cShort = (c.centre?.shortName || '').toLowerCase();

      const matches = targets.some((t) => {
        const tLower = t.toLowerCase();
        return (
          cName === tLower ||
          cShort === tLower ||
          cName.includes(tLower) ||
          tLower.includes(cName)
        );
      });
      if (!matches) return false;
    }

    return true;
  });

  // Get all class IDs to check portfolio status in DB and fetch student works from LMS
  const classIds = lmsClasses.map((c) => c.id);
  let portfolioCounts: Record<string, number> = {};

  if (classIds.length > 0) {
    try {
      const dbResult = await pool.query(
        `SELECT class_lms_id::text as class_lms_id, COUNT(*)::int as count 
         FROM portfolios 
         WHERE class_lms_id::text = ANY($1::text[])
         GROUP BY class_lms_id::text`,
        [classIds],
      );
      portfolioCounts = Object.fromEntries(
        dbResult.rows.map((r: { class_lms_id: string; count: number }) => [
          r.class_lms_id,
          r.count,
        ]),
      );
    } catch {
      // DB might not have portfolios table yet, silently continue
    }
  }

  // Fetch student works via LMS GraphQL operation `findAllStudentWorks`
  const studentWorksMap = new Map<string, StudentWorkItem[]>();
  if (classIds.length > 0) {
    try {
      const worksRes = await callLmsApi<{
        data: { findAllStudentWorks: { data: StudentWorkItem[] } };
      }>(
        {
          query: FIND_ALL_STUDENT_WORKS_QUERY,
          operationName: 'findAllStudentWorks',
          variables: { classIds },
        },
        authHeader,
      );
      const worksList = worksRes.data?.findAllStudentWorks?.data || [];
      worksList.forEach((w) => {
        if (w.studentId) {
          if (!studentWorksMap.has(w.studentId)) {
            studentWorksMap.set(w.studentId, []);
          }
          studentWorksMap.get(w.studentId)!.push(w);
        }
      });
    } catch (e) {
      console.warn('[portfolio-qc] findAllStudentWorks query failed:', e);
    }
  }

  // Transform LMS data to QC format
  const data: PortfolioQCClass[] = lmsClasses.map((cls) => {
    const sortedSlots = sortSlots(cls.slots);
    const activeStudents = (cls.students ?? []).filter(
      (s) => s.activeInClass !== false,
    );
    const totalStudents = activeStudents.length;

    // Count students with submissions in session 13/14
    let submittedCount = 0;
    for (const student of activeStudents) {
      const result = checkStudentSubmissionInFinalSessions(
        sortedSlots,
        student.student || { id: student._id, _id: student._id },
        studentWorksMap,
      );
      if (result.hasSubmission) submittedCount++;
    }

    const submissionRatio =
      totalStudents > 0 ? Math.round((submittedCount / totalStudents) * 100) : 0;

    let qcStatus: 'completed' | 'partial' | 'none' = 'none';
    if (submittedCount === totalStudents && totalStudents > 0) {
      qcStatus = 'completed';
    } else if (submittedCount > 0) {
      qcStatus = 'partial';
    }

    const courseLineTag = extractCourseLineTag(
      cls.name,
      cls.course?.courseLine?.name,
    );

    return {
      id: cls.id,
      name: cls.name,
      status: cls.status,
      startDate: cls.startDate,
      endDate: cls.endDate,
      courseName: cls.course?.name || '',
      courseShortName: cls.course?.shortName || '',
      courseLineTag,
      centreName: cls.centre?.name || '',
      centreShortName: cls.centre?.shortName || '',
      teacherName: getPrimaryTeacher(cls.teachers),
      totalSessions: sortedSlots.length,
      submittedCount,
      totalStudents,
      submissionRatio,
      qcStatus,
    };
  });

  // Filter by QC status if requested
  let filteredData = data;
  if (filter.qcStatus) {
    filteredData = filteredData.filter((cls) => cls.qcStatus === filter.qcStatus);
  }

  return {
    data: filteredData,
    pagination: { total: rawTotal, pageIndex, itemsPerPage: 100 },
  };
}

/**
 * Get detailed student list for a specific class, including submission status.
 */
export async function getClassStudentDetails(
  classId: string,
  className?: string,
  authHeader?: string,
): Promise<{
  className: string;
  students: PortfolioQCStudent[];
}> {
  // Fetch class detail from LMS using className or searching recent classes
  const searchTerm = className || classId;
  const response = await callLmsApi<{
    data: { classes: { data: Class[] } };
  }>(
    {
      query: GET_CLASSES_QC_QUERY,
      operationName: 'GetClasses',
      variables: {
        search: searchTerm,
        pageIndex: 0,
        itemsPerPage: 30,
      },
    },
    authHeader,
  );

  let cls = (response.data?.classes?.data || []).find(
    (c) => c.id === classId || c.name === className || c.name === classId,
  );

  // If not found by search term, query recent classes without search filter to locate by ID
  if (!cls) {
    const fallbackResponse = await callLmsApi<{
      data: { classes: { data: Class[] } };
    }>(
      {
        query: GET_CLASSES_QC_QUERY,
        operationName: 'GetClasses',
        variables: {
          pageIndex: 0,
          itemsPerPage: 100,
        },
      },
      authHeader,
    );
    cls = (fallbackResponse.data?.classes?.data || []).find(
      (c) => c.id === classId || c.name === className,
    );
  }

  if (!cls) {
    return { className: className || '', students: [] };
  }

  const sortedSlots = sortSlots(cls.slots);
  const activeStudents = (cls.students ?? []).filter(
    (s) => s.activeInClass !== false,
  );

  // Fetch student works via LMS GraphQL operation `findAllStudentWorks`
  const studentWorksMap = new Map<string, StudentWorkItem[]>();
  try {
    const worksRes = await callLmsApi<{
      data: { findAllStudentWorks: { data: StudentWorkItem[] } };
    }>(
      {
        query: FIND_ALL_STUDENT_WORKS_QUERY,
        operationName: 'findAllStudentWorks',
        variables: { classIds: [cls.id] },
      },
      authHeader,
    );
    const worksList = worksRes.data?.findAllStudentWorks?.data || [];
    worksList.forEach((w) => {
      if (w.studentId) {
        if (!studentWorksMap.has(w.studentId)) {
          studentWorksMap.set(w.studentId, []);
        }
        studentWorksMap.get(w.studentId)!.push(w);
      }
    });
  } catch (e) {
    console.warn('[portfolio-qc] single class findAllStudentWorks failed:', e);
  }

  // Get portfolio status from DB
  let portfolioMap: Record<
    string,
    { id: string | number; status: string; slug: string | null }
  > = {};
  try {
    const dbResult = await pool.query(
      `SELECT id::text as id, student_lms_id::text as student_lms_id, status, public_slug
       FROM portfolios
       WHERE class_lms_id::text = $1`,
      [classId],
    );
    portfolioMap = Object.fromEntries(
      dbResult.rows.map(
        (r: {
          id: string | number;
          student_lms_id: string;
          status: string;
          public_slug: string | null;
        }) => [
          r.student_lms_id,
          { id: r.id, status: r.status, slug: r.public_slug },
        ],
      ),
    );
  } catch {
    // portfolios table might not exist yet
  }

  const students: PortfolioQCStudent[] = activeStudents.map((s) => {
    const studentId = s.student?.id || (s.student as any)?._id || s._id;
    const result = checkStudentSubmissionInFinalSessions(
      sortedSlots,
      s.student || { id: studentId, _id: s._id },
      studentWorksMap,
    );
    const portfolio = portfolioMap[studentId];

    return {
      studentId,
      studentName: s.student?.fullName || '',
      hasSubmission: result.hasSubmission,
      submissionSession: result.session,
      submissionCount: result.hasSubmission ? 1 : 0,
      submissionRatio: result.hasSubmission ? 100 : 0,
      submissionTitle: result.workTitle || null,
      submissionLink: result.workLink || null,
      portfolioStatus: portfolio
        ? (portfolio.status as 'draft' | 'published')
        : 'none',
      portfolioId: portfolio?.id ?? null,
      portfolioSlug: portfolio?.slug ?? null,
    };
  });

  // Sort: students with submissions first, then alphabetically
  students.sort((a, b) => {
    if (a.hasSubmission !== b.hasSubmission)
      return a.hasSubmission ? -1 : 1;
    return a.studentName.localeCompare(b.studentName);
  });

  return {
    className: cls.name,
    students,
  };
}
