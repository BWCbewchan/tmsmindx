'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ClipboardCheck,
  Download,
  Plus,
  Save,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import { PageContainer } from '@/components/PageContainer';
import { toast } from '@/lib/app-toast';
import {
  INPUT_ASSESSMENT_CRITERIA,
  INPUT_ASSESSMENT_PROFILES,
  type AssessmentCriterion,
  type AssessmentProfile,
  type AssessmentProfileId,
} from '@/lib/hr-input-assessment';

type EditableCriterion = AssessmentCriterion & {
  id: string;
};

const STORAGE_KEY = 'hr-input-assessment-rubric-v2';

const DEFAULT_CRITERIA: EditableCriterion[] = INPUT_ASSESSMENT_CRITERIA.map((item) => ({
  ...item,
  id: item.key,
}));

function makeCriterion(): EditableCriterion {
  const id = `criteria_${Date.now()}`;
  return {
    id,
    key: id,
    group: 'Nhóm tiêu chí mới',
    label: 'Tiêu chí mới',
    description: '',
    scoreScale: '',
    eliminationRule: '',
    weights: { ta_trial_review: 0 },
  };
}

function toCsv(criteria: EditableCriterion[], profiles: AssessmentProfile[]) {
  const rows = [
    [
      'Nhóm tiêu chí',
      'Tiêu chí',
      'Cách tính',
      'Điểm liệt',
      ...profiles.map((profile) => `${profile.label} (%)`),
    ],
    ...criteria.map((item) => [
      item.group,
      item.label,
      item.scoreScale,
      item.eliminationRule,
      ...profiles.map((profile) => String(item.weights[profile.id] ?? 0)),
    ]),
  ];

  return rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

export default function InputAssessmentSetupPage() {
  const [criteria, setCriteria] = useState<EditableCriterion[]>(DEFAULT_CRITERIA);
  const [profiles, setProfiles] = useState<AssessmentProfile[]>(INPUT_ASSESSMENT_PROFILES);
  const [templateName, setTemplateName] = useState('Bảng đánh giá đầu vào theo GEN');

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.criteria)) setCriteria(parsed.criteria);
      if (Array.isArray(parsed.profiles)) setProfiles(parsed.profiles);
      if (typeof parsed.templateName === 'string') setTemplateName(parsed.templateName);
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const profileTotals = useMemo(() => {
    return profiles.map((profile) => ({
      ...profile,
      totalWeight: criteria.reduce((sum, item) => sum + (Number(item.weights[profile.id]) || 0), 0),
    }));
  }, [criteria, profiles]);

  const updateCriterion = (id: string, patch: Partial<EditableCriterion>) => {
    setCriteria((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const updateWeight = (id: string, profileId: AssessmentProfileId, value: number) => {
    setCriteria((current) =>
      current.map((item) =>
        item.id === id
          ? { ...item, weights: { ...item.weights, [profileId]: value } }
          : item,
      ),
    );
  };

  const updateProfile = (profileId: AssessmentProfileId, patch: Partial<AssessmentProfile>) => {
    setProfiles((current) => current.map((profile) => (profile.id === profileId ? { ...profile, ...patch } : profile)));
  };

  const saveTemplate = () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ templateName, profiles, criteria }),
    );
    toast.success('Đã lưu cấu hình đánh giá đầu vào.');
  };

  const resetTemplate = () => {
    setCriteria(DEFAULT_CRITERIA);
    setProfiles(INPUT_ASSESSMENT_PROFILES);
    setTemplateName('Bảng đánh giá đầu vào theo GEN');
    window.localStorage.removeItem(STORAGE_KEY);
    toast.success('Đã khôi phục cấu hình theo mẫu CSV hiện tại.');
  };

  const exportCsv = () => {
    const blob = new Blob([toCsv(criteria, profiles)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'tieu-chi-danh-gia-dau-vao.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <PageContainer
      title="Quản lý đánh giá đầu vào"
      description="Thiết lập trọng số, tiêu chí và bảng điểm đánh giá theo từng GEN."
      maxWidth="full"
      padding="md"
    >
      <div className="space-y-5 pb-20">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/admin/hr-candidates/gen-planner"
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 shadow-sm hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Quay lại GEN Planner
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={resetTemplate}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 shadow-sm hover:bg-gray-50"
            >
              Khôi phục mẫu
            </button>
            <button
              type="button"
              onClick={exportCsv}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 shadow-sm hover:bg-gray-50"
            >
              <Download className="h-4 w-4" />
              Xuất CSV
            </button>
            <button
              type="button"
              onClick={saveTemplate}
              className="inline-flex items-center gap-2 rounded-xl bg-[#a1001f] px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-[#880019]"
            >
              <Save className="h-4 w-4" />
              Lưu cấu hình
            </button>
          </div>
        </div>

        <section className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 p-5">
              <div className="grid min-w-0 grid-cols-1 gap-4 2xl:grid-cols-[minmax(320px,420px)_minmax(0,1fr)] 2xl:items-end">
                <div className="min-w-0 space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-gray-500">
                    Tên bảng đánh giá
                  </label>
                  <input
                    value={templateName}
                    onChange={(event) => setTemplateName(event.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-bold text-gray-900 outline-none focus:border-[#a1001f]"
                  />
                </div>

                <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-3">
                  {profileTotals.map((profile) => (
                    <div key={profile.id} className="min-w-0 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                      <div className="flex min-w-0 items-center justify-between gap-3 md:block">
                        <p className="truncate text-[11px] font-black uppercase text-gray-500">{profile.label}</p>
                        <p className={`shrink-0 text-xl font-black md:mt-1 md:text-2xl ${profile.totalWeight === 100 ? 'text-emerald-700' : 'text-red-700'}`}>
                          {profile.totalWeight}%
                        </p>
                      </div>
                      <p className="mt-1 text-[11px] font-bold text-gray-400">Ngưỡng {profile.passingScore}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] text-left text-sm">
                <thead className="bg-gray-50 text-[11px] font-black uppercase tracking-widest text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Nhóm</th>
                    <th className="px-4 py-3">Tiêu chí</th>
                    <th className="px-4 py-3">Cách tính</th>
                    <th className="w-32 px-4 py-3">Điểm liệt</th>
                    {profiles.map((profile) => (
                      <th key={profile.id} className="w-28 px-4 py-3 text-center">
                        {profile.label}
                      </th>
                    ))}
                    <th className="w-16 px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {criteria.map((item) => (
                    <tr key={item.id} className="align-top">
                      <td className="px-4 py-3">
                        <input
                          value={item.group}
                          onChange={(event) => updateCriterion(item.id, { group: event.target.value })}
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 font-semibold outline-none focus:border-[#a1001f]"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          value={item.label}
                          onChange={(event) => updateCriterion(item.id, { label: event.target.value })}
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 font-bold outline-none focus:border-[#a1001f]"
                        />
                        <textarea
                          value={item.description}
                          onChange={(event) => updateCriterion(item.id, { description: event.target.value })}
                          rows={2}
                          placeholder="Mô tả nội bộ..."
                          className="mt-2 w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-xs outline-none focus:border-[#a1001f]"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <textarea
                          value={item.scoreScale}
                          onChange={(event) => updateCriterion(item.id, { scoreScale: event.target.value })}
                          rows={3}
                          className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[#a1001f]"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          value={item.eliminationRule}
                          onChange={(event) => updateCriterion(item.id, { eliminationRule: event.target.value })}
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 font-bold outline-none focus:border-[#a1001f]"
                          placeholder="Không có"
                        />
                      </td>
                      {profiles.map((profile) => (
                        <td key={profile.id} className="px-4 py-3">
                          <input
                            type="number"
                            value={item.weights[profile.id] ?? 0}
                            min={0}
                            max={100}
                            onChange={(event) => updateWeight(item.id, profile.id, Number(event.target.value) || 0)}
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-right font-black outline-none focus:border-[#a1001f]"
                          />
                        </td>
                      ))}
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setCriteria((current) => current.filter((criterion) => criterion.id !== item.id))}
                          className="rounded-lg border border-red-100 p-2 text-red-600 hover:bg-red-50"
                          aria-label="Xóa tiêu chí"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-t border-gray-100 p-5">
              <button
                type="button"
                onClick={() => setCriteria((current) => [...current, makeCriterion()])}
                className="inline-flex items-center gap-2 rounded-xl bg-[#a1001f] px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-[#880019]"
              >
                <Plus className="h-4 w-4" />
                Thêm tiêu chí
              </button>
            </div>
          </div>

          <aside className="min-w-0 space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-[#a1001f]">
                  <SlidersHorizontal className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-black text-gray-900">Luồng trạng thái</p>
                  <p className="text-xs font-semibold text-gray-500">Mapping theo file tiêu chí hiện tại.</p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {profiles.map((profile) => (
                  <div key={profile.id} className="rounded-xl border border-gray-200 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-gray-900">{profile.label}</p>
                        <p className="mt-0.5 text-xs font-semibold text-gray-500">{profile.capability}</p>
                      </div>
                      <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-black text-gray-700">
                        {profile.passingScore}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-2 text-xs font-bold text-gray-500">
                      <input
                        value={profile.currentStatus}
                        onChange={(event) => updateProfile(profile.id, { currentStatus: event.target.value })}
                        className="rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[#a1001f]"
                      />
                      <input
                        value={profile.nextStatus}
                        onChange={(event) => updateProfile(profile.id, { nextStatus: event.target.value })}
                        className="rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[#a1001f]"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                  <ClipboardCheck className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-black text-gray-900">Cấu trúc bảng Gen</p>
                  <p className="text-xs font-semibold text-gray-500">Theo mẫu bảng đánh giá từng Gen.</p>
                </div>
              </div>

              <div className="space-y-2 text-xs font-bold text-gray-600">
                <p className="rounded-xl bg-gray-50 p-3">Thông tin ứng viên: STT, Mã UV, Họ tên, Cơ sở, Khối, TE quản lý, email, SĐT, Facebook.</p>
                <p className="rounded-xl bg-gray-50 p-3">Training tập trung: Điểm danh và Test theo từng Lesson.</p>
                <p className="rounded-xl bg-gray-50 p-3">Training cơ sở: Observe, Tập Huấn Sư Phạm, Entrance Technical Test, Duyệt giảng Leader/Hội đồng.</p>
                <p className="rounded-xl bg-gray-900 p-3 text-white">Tổng điểm được quy đổi theo trọng số của từng năng lực và so với ngưỡng pass.</p>
              </div>
            </div>
          </aside>
        </section>
      </div>
    </PageContainer>
  );
}
