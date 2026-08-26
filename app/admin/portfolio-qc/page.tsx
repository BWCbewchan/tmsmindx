'use client';

import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import ClassFilterToolbar, {
  type FilterState,
} from '@/components/portfolio-qc/ClassFilterToolbar';
import ClassListTable from '@/components/portfolio-qc/ClassListTable';
import type { PortfolioQCClass } from '@/lib/portfolio-qc/types';
import { Sparkles } from 'lucide-react';

interface CentreOption {
  id: number;
  full_name: string;
  short_code: string | null;
}

function normalizeVietnamese(str: string): string {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

export default function PortfolioQCPage() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<PortfolioQCClass[]>([]);
  const [centres, setCentres] = useState<CentreOption[]>([]);
  const [teacherOptions, setTeacherOptions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [pagination, setPagination] = useState({
    total: 0,
    pageIndex: 0,
    itemsPerPage: 50,
  });
  const [error, setError] = useState<string | null>(null);
  const [currentFilters, setCurrentFilters] = useState<FilterState | null>(
    null,
  );

  // Fetch classes from API
  const fetchClasses = useCallback(
    async (filters: FilterState, pageIndex = 0) => {
      setIsLoading(true);
      setError(null);
      setCurrentFilters(filters);

      try {
        const params = new URLSearchParams();

        if (filters.selectedCentres.length > 0) {
          params.set('centres', filters.selectedCentres.join(','));
        }
        if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
        if (filters.dateTo) params.set('dateTo', filters.dateTo);
        const searchQuery = filters.classSearch || filters.teacherSearch;
        if (searchQuery) params.set('search', searchQuery);
        if (filters.qcStatus) params.set('qcStatus', filters.qcStatus);
        params.set('pageIndex', String(pageIndex));
        params.set('itemsPerPage', '50');

        const res = await fetch(
          `/api/admin/portfolio-qc/classes?${params.toString()}`,
        );
        const responseText = await res.text();
        let data: {
          success?: boolean;
          error?: string;
          data?: PortfolioQCClass[];
          pagination?: { total?: number; pageIndex?: number; itemsPerPage?: number };
          accessibleCenters?: CentreOption[];
        };

        try {
          data = JSON.parse(responseText);
        } catch {
          throw new Error(responseText || `HTTP ${res.status}`);
        }

        if (data.success) {
          const rawClasses: PortfolioQCClass[] = data.data || [];

          // Collect unique teacher options
          const teachersSet = new Set<string>();
          rawClasses.forEach((cls) => {
            if (cls.teacherName) teachersSet.add(cls.teacherName.trim());
          });
          setTeacherOptions((prev) => Array.from(new Set([...prev, ...Array.from(teachersSet)])));

          let filteredClasses = rawClasses;

          // Client-side filter by teacher name if provided using accent-insensitive normalization
          if (filters.teacherSearch) {
            const searchNorm = normalizeVietnamese(filters.teacherSearch);
            filteredClasses = filteredClasses.filter((cls: PortfolioQCClass) => {
              const tNorm = normalizeVietnamese(cls.teacherName);
              return tNorm.includes(searchNorm);
            });
          }

          // Client-side filter by QC status
          if (filters.qcStatus) {
            filteredClasses = filteredClasses.filter(
              (cls: PortfolioQCClass) => cls.qcStatus === filters.qcStatus,
            );
          }

          setClasses(filteredClasses);
          const rawTotal = data.pagination?.total || filteredClasses.length;
          const displayTotal = (filters.qcStatus || filters.teacherSearch) ? filteredClasses.length : rawTotal;
          setPagination({
            total: displayTotal,
            pageIndex: data.pagination?.pageIndex || 0,
            itemsPerPage: data.pagination?.itemsPerPage || 100,
          });

          // Store accessible centres if returned
          if (data.accessibleCenters) {
            setCentres(data.accessibleCenters);
          }
        } else {
          let msg = data.error || 'Không thể tải dữ liệu';
          if (msg.includes('Authentication token is missing') || msg.includes('token LMS')) {
            msg = 'Tài khoản chưa có token kết nối LMS hoặc phiên kết nối LMS đã hết hạn. Vui lòng đăng xuất và đăng nhập lại bằng tài khoản LMS/Firebase.';
          }
          setError(msg);
          setClasses([]);
        }

        setHasSearched(true);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Lỗi kết nối tới server';
        setError(message || 'Lỗi kết nối tới server');
        setClasses([]);
        setHasSearched(true);
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  // Load centres and auto-fetch classes on mount
  useEffect(() => {
    const initialFilter: FilterState = {
      selectedCentres: [],
      dateFrom: '',
      dateTo: '',
      qcStatus: '',
      teacherSearch: '',
      classSearch: '',
    };
    fetchClasses(initialFilter, 0);
  }, [fetchClasses]);

  const handleFilter = useCallback(
    (filters: FilterState) => {
      fetchClasses(filters, 0);
    },
    [fetchClasses],
  );

  const handlePageChange = useCallback(
    (page: number) => {
      if (currentFilters) {
        fetchClasses(currentFilters, page);
      }
    },
    [currentFilters, fetchClasses],
  );

  // Stats summary
  const totalStudents = classes.reduce((sum, c) => sum + c.totalStudents, 0);
  const totalSubmitted = classes.reduce((sum, c) => sum + c.submittedCount, 0);
  const completedClasses = classes.filter(
    (c) => c.qcStatus === 'completed',
  ).length;

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-5">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-gradient-to-br from-mindx-red to-mindx-red-dark rounded-xl flex items-center justify-center shadow-sm">
            <Sparkles size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-neutral-800">
              Kiểm Soát Portfolio (QC)
            </h1>
            <p className="text-xs text-neutral-500 mt-0.5">
              Quản lý tiến độ sản phẩm cuối khoá
            </p>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <ClassFilterToolbar
        centres={centres}
        teacherOptions={teacherOptions}
        onFilter={handleFilter}
        isLoading={isLoading}
      />

      {/* Stats Summary — only show when classes loaded */}
      {hasSearched && classes.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-sm">
            <div className="text-2xl font-bold text-neutral-800">
              {classes.length}
            </div>
            <div className="text-xs text-neutral-500 mt-0.5">Tổng lớp</div>
          </div>
          <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-sm">
            <div className="text-2xl font-bold text-neutral-800">
              {totalStudents}
            </div>
            <div className="text-xs text-neutral-500 mt-0.5">Tổng học viên</div>
          </div>
          <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-sm">
            <div className="text-2xl font-bold text-emerald-600">
              {totalSubmitted}
              <span className="text-sm font-normal text-neutral-400">
                /{totalStudents}
              </span>
            </div>
            <div className="text-xs text-neutral-500 mt-0.5">
              Đã nộp sản phẩm
            </div>
          </div>
          <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-sm">
            <div className="text-2xl font-bold text-emerald-600">
              {completedClasses}
              <span className="text-sm font-normal text-neutral-400">
                /{classes.length}
              </span>
            </div>
            <div className="text-xs text-neutral-500 mt-0.5">
              Lớp đạt yêu cầu
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          <strong>Lỗi:</strong> {error}
        </div>
      )}

      {/* Class List */}
      <ClassListTable
        classes={classes}
        isLoading={isLoading}
        total={pagination.total}
        pageIndex={pagination.pageIndex}
        itemsPerPage={pagination.itemsPerPage}
        onPageChange={handlePageChange}
      />
    </div>
  );
}
