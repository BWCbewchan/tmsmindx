import { MapPin, UserCheck, UserX, Users } from 'lucide-react';
import { HrSummary } from '../types';

interface HrCandidateStatsProps {
  summary: HrSummary;
  statusFilter: string;
  onFilterChange: (status: string) => void;
  regionFilter: string;
  onRegionFilterChange: (regionCode: string) => void;
}

const REGION_LABELS: Record<string, string> = {
  '1': 'Hồ Chí Minh', '2': 'Hà Nội', '3': 'Tỉnh Nam', '4': 'Tỉnh Bắc', '5': 'Tỉnh Trung',
};

export default function HrCandidateStats({ summary, statusFilter, onFilterChange, regionFilter, onRegionFilterChange }: HrCandidateStatsProps) {
  const assignedPercent = summary.total > 0 ? Math.round((summary.assigned / summary.total) * 100) : 0;

  return (
    <section className="space-y-4">
      {/* Progress bar */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Tổng quan phân GEN</p>
            <p className="mt-1 text-lg font-extrabold text-gray-900">Tiến độ xếp GEN cho ứng viên</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-right">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Đã xếp GEN</p>
            <p className="mt-1 text-xl font-black text-emerald-700">{assignedPercent}%</p>
          </div>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-100">
          <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all" style={{ width: `${assignedPercent}%` }} />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
            <p className="font-semibold text-gray-500">Chưa có GEN</p>
            <p className="mt-1 text-base font-extrabold text-red-700">{summary.unassigned}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
            <p className="font-semibold text-gray-500">Đã có GEN</p>
            <p className="mt-1 text-base font-extrabold text-emerald-700">{summary.assigned}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
            <p className="font-semibold text-gray-500">Tổng ứng viên</p>
            <p className="mt-1 text-base font-extrabold text-gray-900">{summary.total}</p>
          </div>
        </div>
      </div>



      {/* Region filter */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <MapPin className="h-4 w-4" />
          </span>
          <p className="text-sm font-bold text-gray-900">Thống kê theo khu vực</p>
        </div>
        <div className="grid grid-cols-5 gap-3">
          {(['1', '2', '3', '4', '5'] as const).map((code) => (
            <button key={code} type="button"
              onClick={() => onRegionFilterChange(regionFilter === code ? 'all' : code)}
              className={`cursor-pointer rounded-xl px-3 py-3 text-left transition-all ${
                regionFilter === code
                  ? 'border-2 border-indigo-500 bg-indigo-50 shadow-sm'
                  : 'border border-gray-200 bg-gray-50 hover:border-indigo-300 hover:-translate-y-0.5'
              }`}>
              <p className={`text-[11px] font-bold uppercase tracking-wider ${regionFilter === code ? 'text-indigo-700' : 'text-gray-500'}`}>KV {code}</p>
              <p className={`mt-0.5 text-xs font-semibold ${regionFilter === code ? 'text-indigo-900' : 'text-gray-700'}`}>{REGION_LABELS[code]}</p>
              <p className={`mt-2 text-2xl font-extrabold ${regionFilter === code ? 'text-indigo-900' : 'text-gray-900'}`}>
                {summary.byRegion?.[code] || 0}
              </p>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
