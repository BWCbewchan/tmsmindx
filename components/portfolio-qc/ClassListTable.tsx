'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { PortfolioQCClass } from '@/lib/portfolio-qc/types';
import SubmissionProgressBar from './SubmissionProgressBar';
import StudentDetailPanel from './StudentDetailPanel';

interface ClassListTableProps {
  classes: PortfolioQCClass[];
  isLoading?: boolean;
  total?: number;
  pageIndex?: number;
  itemsPerPage?: number;
  onPageChange?: (page: number) => void;
}

function QCStatusBadge({ status }: { status: PortfolioQCClass['qcStatus'] }) {
  switch (status) {
    case 'completed':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Đạt yêu cầu
        </span>
      );
    case 'partial':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          Đang xử lý
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-600 border border-red-200 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
          Chưa nộp SP
        </span>
      );
  }
}

function CourseLineTag({ tag }: { tag: string }) {
  if (!tag) return null;

  const colorMap: Record<string, string> = {
    C4K: 'bg-amber-100 text-amber-800 border-amber-300',
    XART: 'bg-violet-100 text-violet-800 border-violet-300',
    DSA: 'bg-blue-100 text-blue-800 border-blue-300',
    WEB: 'bg-cyan-100 text-cyan-800 border-cyan-300',
    CS: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    GAME: 'bg-pink-100 text-pink-800 border-pink-300',
    AI: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    ROB: 'bg-orange-100 text-orange-800 border-orange-300',
    IOT: 'bg-teal-100 text-teal-800 border-teal-300',
  };

  const colorClass =
    colorMap[tag] || 'bg-neutral-100 text-neutral-700 border-neutral-300';

  return (
    <span
      className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border whitespace-nowrap ${colorClass}`}
    >
      {tag}
    </span>
  );
}

export default function ClassListTable({
  classes,
  isLoading = false,
  total = 0,
  pageIndex = 0,
  itemsPerPage = 100,
  onPageChange,
}: ClassListTableProps) {
  const [expandedClassId, setExpandedClassId] = useState<string | null>(null);

  const toggleExpand = (classId: string) => {
    setExpandedClassId((prev) => (prev === classId ? null : classId));
  };

  if (isLoading) {
    return (
      <div className="bg-white border border-neutral-200 rounded-xl shadow-sm overflow-hidden p-4 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 px-5 py-4 border-b border-neutral-100 animate-pulse"
          >
            <div className="w-4 h-4 bg-neutral-200 rounded" />
            <div className="w-44 h-6 bg-neutral-200 rounded-md" />
            <div className="w-32 h-4 bg-neutral-200 rounded" />
            <div className="w-28 h-4 bg-neutral-200 rounded" />
            <div className="w-16 h-4 bg-neutral-200 rounded" />
            <div className="flex-1 h-4 bg-neutral-200 rounded" />
            <div className="w-24 h-6 bg-neutral-200 rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  if (classes.length === 0) {
    return (
      <div className="bg-white border border-neutral-200 rounded-xl shadow-sm p-12 text-center">
        <div className="text-4xl mb-3">📋</div>
        <h3 className="text-lg font-semibold text-neutral-700 mb-1">
          Không tìm thấy lớp nào
        </h3>
        <p className="text-sm text-neutral-500">
          Thử thay đổi bộ lọc để tìm kết quả phù hợp
        </p>
      </div>
    );
  }

  const totalPages = Math.ceil(total / itemsPerPage);

  return (
    <div className="bg-white border border-neutral-200 rounded-xl shadow-sm overflow-hidden">
      {/* Table Column Headers */}
      <div className="hidden md:grid grid-cols-[36px_minmax(220px,1.2fr)_1fr_1fr_65px_180px_150px] items-center px-4 py-3 bg-neutral-100/90 border-b border-neutral-200 text-xs font-semibold text-neutral-600 uppercase tracking-wider gap-2">
        <div></div>
        <div className="whitespace-nowrap">Mã Lớp</div>
        <div className="whitespace-nowrap">Cơ sở</div>
        <div className="whitespace-nowrap">Giáo viên</div>
        <div className="text-center whitespace-nowrap">Buổi</div>
        <div className="whitespace-nowrap">Tiến độ nộp SP</div>
        <div className="whitespace-nowrap">Trạng thái</div>
      </div>

      {/* Class Rows */}
      <div className="divide-y divide-neutral-100">
        {classes.map((cls) => {
          const isExpanded = expandedClassId === cls.id;

          return (
            <div key={cls.id}>
              {/* Class Row */}
              <div
                className={`grid grid-cols-1 md:grid-cols-[36px_minmax(220px,1.2fr)_1fr_1fr_65px_180px_150px] items-center 
                            px-4 py-3 cursor-pointer transition-colors gap-2
                            ${isExpanded ? 'bg-red-50/50' : 'hover:bg-neutral-50/80'}`}
                onClick={() => toggleExpand(cls.id)}
              >
                {/* Expand Icon */}
                <div className="hidden md:flex items-center justify-center">
                  {isExpanded ? (
                    <ChevronDown
                      size={16}
                      className="text-mindx-red font-bold"
                    />
                  ) : (
                    <ChevronRight
                      size={16}
                      className="text-neutral-400"
                    />
                  )}
                </div>

                {/* Class Code & Tag — Always Single Line, Clean & Whole */}
                <div className="flex items-center gap-2 min-w-0">
                  <span className="whitespace-nowrap font-mono text-sm font-bold text-neutral-900 bg-neutral-100/90 px-2.5 py-1 rounded-md border border-neutral-200/80 shadow-2xs tracking-tight">
                    {cls.name}
                  </span>
                  <CourseLineTag tag={cls.courseLineTag} />
                </div>

                {/* Centre */}
                <div className="text-sm text-neutral-700 truncate font-medium">
                  {cls.centreName}
                </div>

                {/* Teacher */}
                <div className="text-sm text-neutral-700 truncate font-medium">
                  {cls.teacherName || (
                    <span className="text-neutral-400 italic">Chưa phân công</span>
                  )}
                </div>

                {/* Session Count */}
                <div className="text-center font-semibold text-sm text-neutral-700">
                  {cls.totalSessions}
                  <span className="text-[11px] font-normal text-neutral-400 ml-0.5">
                    b
                  </span>
                </div>

                {/* Progress */}
                <div>
                  <SubmissionProgressBar
                    submitted={cls.submittedCount}
                    total={cls.totalStudents}
                  />
                </div>

                {/* Status Badge */}
                <div>
                  <QCStatusBadge status={cls.qcStatus} />
                </div>
              </div>

              {/* Student Details Panel */}
              {isExpanded && (
                <StudentDetailPanel
                  classId={cls.id}
                  className={cls.name}
                  centreName={cls.centreName}
                  courseLine={cls.courseLineTag}
                  courseName={cls.courseName}
                  teacherName={cls.teacherName}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-neutral-200 bg-neutral-50">
          <div className="text-xs text-neutral-500">
            Hiển thị {pageIndex * itemsPerPage + 1}–
            {Math.min((pageIndex + 1) * itemsPerPage, total)} / {total} lớp (2 trang LMS/trang)
          </div>
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(totalPages, 10) }).map((_, i) => (
              <button
                key={i}
                onClick={(e) => {
                  e.stopPropagation();
                  onPageChange?.(i);
                }}
                className={`w-8 h-8 rounded-lg text-xs font-medium transition-all
                  ${
                    i === pageIndex
                      ? 'bg-mindx-red text-white shadow-sm'
                      : 'text-neutral-600 hover:bg-neutral-100'
                  }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
