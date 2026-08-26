// ============================================================
// Types for Portfolio QC (Kiểm Soát Portfolio)
// ============================================================

/** Filter params for fetching classes */
export interface PortfolioQCFilter {
  centres?: string[];       // LMS centre IDs
  centreNames?: string[];   // Centre full_names (for matching)
  courses?: string[];       // Course IDs
  courseLines?: string[];    // Course line IDs
  dateFrom?: string;        // ISO date string
  dateTo?: string;          // ISO date string
  qcStatus?: string;        // 'completed' | 'partial' | 'none'
  status?: string;          // Class status
  teacherId?: string;       // LMS teacher ID
  search?: string;          // Text search
  pageIndex?: number;
  itemsPerPage?: number;
}

/** A class row in the QC list */
export interface PortfolioQCClass {
  id: string;
  name: string;
  status: string;
  startDate: string;
  endDate: string;
  courseName: string;
  courseShortName: string;
  courseLineTag: string;     // e.g. "C4K", "XART"
  centreName: string;
  centreShortName: string;
  teacherName: string;
  totalSessions: number;    // Total number of slots
  /** How many students have a submission in session 13 or 14 */
  submittedCount: number;
  /** Total active students in this class */
  totalStudents: number;
  /** Submission ratio (0–100) */
  submissionRatio: number;
  /** Overall class status for QC */
  qcStatus: 'completed' | 'partial' | 'none';
}

/** A student row inside the expanded class detail */
export interface PortfolioQCStudent {
  studentId: string;
  studentName: string;
  /** Whether the student has a submission in session 13 or 14 */
  hasSubmission: boolean;
  /** Which session the submission was found (13 or 14), or null */
  submissionSession: number | null;
  /** Submission ratio text, e.g. "1" or "0" */
  submissionCount: number;
  /** Ratio as percentage (0 or 100) */
  submissionRatio: number;
  /** Title of final product submission if available */
  submissionTitle?: string | null;
  /** URL / link of final product submission if available */
  submissionLink?: string | null;
  /** Portfolio status from DB */
  portfolioStatus: 'none' | 'draft' | 'published';
  /** Portfolio ID in DB if exists */
  portfolioId: number | null;
  /** Portfolio public slug if exists */
  portfolioSlug: string | null;
}

/** Response from the classes API */
export interface PortfolioQCClassesResponse {
  success: boolean;
  data: PortfolioQCClass[];
  pagination: {
    total: number;
    pageIndex: number;
    itemsPerPage: number;
  };
}

/** Response from the students API */
export interface PortfolioQCStudentsResponse {
  success: boolean;
  className: string;
  students: PortfolioQCStudent[];
}
