'use client';

import type { FormEvent, ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Mail,
  Phone,
  UserRound,
} from 'lucide-react';

const REGION_OPTIONS = [
  { value: '1', label: 'Hồ Chí Minh' },
  { value: '2', label: 'Hà Nội' },
  { value: '3', label: 'Tỉnh Nam' },
  { value: '4', label: 'Tỉnh Bắc' },
  { value: '5', label: 'Tỉnh Trung' },
];

const WORK_BLOCK_OPTIONS = [
  'Coding',
  'Robotics',
  'Art',
  'Business',
  'Khác',
];

const GENDER_OPTIONS = ['Nam', 'Nữ', 'Khác'];

const HR_CONTACTS = [
  {
    region: 'Miền Nam',
    name: 'Lê Thị Thảo',
    phone: '(+84) 346 489 435',
    email: 'hr-teaching@mindx.edu.vn',
  },
  {
    region: 'Miền Bắc',
    name: 'Lê Thanh Thảo',
    phone: '(+84) 966 834 885',
    email: 'hr-teachingk12hn@mindx.edu.vn',
  },
];

type CenterOption = {
  id: number;
  name: string;
  address: string;
  mapUrl: string;
  region: string;
};

type ApplicationFormState = {
  full_name: string;
  email: string;
  phone: string;
  region_code: string;
  desired_campus: string;
  work_block: string;
  birth_year: string;
  gender: string;
  current_address: string;
  facebook_url: string;
  teaching_experience: string;
  pedagogy_certificate_url: string;
  website: string;
};

const initialForm: ApplicationFormState = {
  full_name: '',
  email: '',
  phone: '',
  region_code: '',
  desired_campus: '',
  work_block: '',
  birth_year: '',
  gender: '',
  current_address: '',
  facebook_url: '',
  teaching_experience: '',
  pedagogy_certificate_url: '',
  website: '',
};

function FieldLabel({ children, required = false }: { children: ReactNode; required?: boolean }) {
  return (
    <label className="text-sm font-bold text-slate-800">
      {children}
      {required ? <span className="ml-1 text-[#a1001f]">*</span> : null}
    </label>
  );
}

function inputClassName(hasIcon = false) {
  return `h-11 w-full rounded-lg border border-slate-200 bg-white text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#a1001f] focus:ring-4 focus:ring-[#a1001f]/10 ${
    hasIcon ? 'pl-10 pr-3' : 'px-3'
  }`;
}

export default function HrCandidateApplicationPage() {
  const [form, setForm] = useState<ApplicationFormState>(initialForm);
  const [centers, setCenters] = useState<CenterOption[]>([]);
  const [centersLoading, setCentersLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/public/hr-candidate-application/centers', { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success) throw new Error(data.error || 'Không thể tải danh sách cơ sở.');
        if (!cancelled) setCenters(Array.isArray(data.centers) ? data.centers : []);
      })
      .catch(() => {
        if (!cancelled) setCenters([]);
      })
      .finally(() => {
        if (!cancelled) setCentersLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedCenter = useMemo(
    () => centers.find((center) => `${center.name} | ${center.address}` === form.desired_campus) ?? null,
    [centers, form.desired_campus],
  );

  const selectedCenterMapUrl = useMemo(() => {
    if (!selectedCenter) return '';
    if (selectedCenter.mapUrl) return selectedCenter.mapUrl;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      `${selectedCenter.name} ${selectedCenter.address}`.trim(),
    )}`;
  }, [selectedCenter]);
  const hasTeachingExperience = form.teaching_experience.trim().length > 0;

  const updateField = (field: keyof ApplicationFormState, value: string) => {
    setError('');
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError('');
    try {
      const response = await fetch('/api/public/hr-candidate-application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Không thể gửi thông tin lúc này.');
      }
      setSuccess(true);
      setForm(initialForm);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Không thể gửi thông tin lúc này.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f9fc] text-slate-900">
      <main className="mx-auto grid min-h-screen w-full max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[360px_minmax(0,1fr)] lg:px-6">
        <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)]">
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="MindX Technology School" className="h-10 w-auto" />
            <div>
              <p className="text-sm font-black text-slate-950">MindX</p>
              <p className="text-xs font-semibold text-slate-500">Teaching Portal System</p>
            </div>
          </div>

          <div className="mt-8">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#a1001f]">
              Đăng ký ứng viên
            </p>
            <h1 className="mt-3 text-3xl font-black leading-tight text-slate-950">
              Thông tin ứng viên sau phỏng vấn
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Vui lòng điền đầy đủ thông tin để đội HR/TE sắp xếp GEN và lịch đào tạo đầu vào phù hợp.
            </p>
          </div>

          <div className="mt-8 grid gap-3">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
              Thông tin HR
            </p>
            {HR_CONTACTS.map((contact) => (
              <div key={contact.region} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-black text-slate-950">{contact.region}</p>
                <div className="mt-2 space-y-1.5 text-xs font-semibold text-slate-600">
                  <p>HR: <span className="text-slate-900">{contact.name}</span></p>
                  <p>SĐT: <a className="text-[#a1001f] hover:underline" href={`tel:${contact.phone.replace(/[^\d+]/g, '')}`}>{contact.phone}</a></p>
                  <p>Email: <a className="break-all text-[#a1001f] hover:underline" href={`mailto:${contact.email}`}>{contact.email}</a></p>
                </div>
              </div>
            ))}
          </div>
        </aside>

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          {success ? (
            <div className="flex min-h-[620px] flex-col items-center justify-center px-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="h-9 w-9" />
              </div>
              <h2 className="mt-5 text-2xl font-black text-slate-950">Đã ghi nhận thông tin</h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">
                Cảm ơn bạn. Đội ngũ MindX sẽ kiểm tra hồ sơ và liên hệ theo thông tin đã đăng ký.
              </p>
              <button
                type="button"
                onClick={() => setSuccess(false)}
                className="mt-6 inline-flex h-10 items-center justify-center rounded-lg bg-[#a1001f] px-5 text-sm font-bold text-white transition hover:bg-[#870018]"
              >
                Gửi hồ sơ khác
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-5 sm:p-6 lg:p-8">
              <div className="flex flex-col gap-2 border-b border-slate-100 pb-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                    Candidate Intake
                  </p>
                  <h2 className="mt-2 text-2xl font-black text-slate-950">Phiếu thông tin ứng viên</h2>
                </div>
                <p className="text-xs font-bold text-slate-500">
                  <span className="text-[#a1001f]">*</span> Bắt buộc
                </p>
              </div>

              {error ? (
                <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                  {error}
                </div>
              ) : null}

              <div className="mt-6 grid gap-5 lg:grid-cols-2">
                <div className="space-y-2">
                  <FieldLabel required>Họ và tên</FieldLabel>
                  <div className="relative">
                    <UserRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      required
                      value={form.full_name}
                      onChange={(event) => updateField('full_name', event.target.value)}
                      className={inputClassName(true)}
                      placeholder="Nguyễn Văn A"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <FieldLabel required>Email</FieldLabel>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      required
                      type="email"
                      value={form.email}
                      onChange={(event) => updateField('email', event.target.value)}
                      className={inputClassName(true)}
                      placeholder="email@example.com"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <FieldLabel required>Số điện thoại</FieldLabel>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      required
                      value={form.phone}
                      onChange={(event) => updateField('phone', event.target.value)}
                      className={inputClassName(true)}
                      placeholder="09xxxxxxxx"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <FieldLabel required>Khu vực</FieldLabel>
                  <select
                    required
                    value={form.region_code}
                    onChange={(event) => updateField('region_code', event.target.value)}
                    className={inputClassName()}
                  >
                    <option value="">Chọn khu vực</option>
                    {REGION_OPTIONS.map((region) => (
                      <option key={region.value} value={region.value}>
                        {region.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2 lg:col-span-2">
                  <FieldLabel required>Cơ sở mong muốn</FieldLabel>
                  <select
                    required
                    value={form.desired_campus}
                    onChange={(event) => updateField('desired_campus', event.target.value)}
                    disabled={centersLoading}
                    className={inputClassName()}
                  >
                    <option value="">{centersLoading ? 'Đang tải danh sách cơ sở...' : 'Chọn cơ sở mong muốn'}</option>
                    {centers.map((center) => {
                      const label = `${center.name} | ${center.address || 'Chưa cập nhật địa chỉ'}`;
                      return (
                        <option key={center.id} value={label}>
                          {label}
                        </option>
                      );
                    })}
                  </select>
                  {selectedCenter ? (
                    <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-xs font-black text-slate-900">{selectedCenter.name}</p>
                        <p className="mt-1 text-xs font-medium leading-5 text-slate-500">{selectedCenter.address || 'Chưa cập nhật địa chỉ'}</p>
                      </div>
                      <a
                        href={selectedCenterMapUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex shrink-0 items-center gap-1.5 text-xs font-bold text-[#a1001f] hover:underline"
                      >
                        Xem bản đồ
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <FieldLabel required>Khối / môn ứng tuyển</FieldLabel>
                  <select
                    required
                    value={form.work_block}
                    onChange={(event) => updateField('work_block', event.target.value)}
                    className={inputClassName()}
                  >
                    <option value="">Chọn khối / môn</option>
                    {WORK_BLOCK_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <FieldLabel>Năm sinh</FieldLabel>
                  <input
                    inputMode="numeric"
                    value={form.birth_year}
                    onChange={(event) => updateField('birth_year', event.target.value)}
                    className={inputClassName()}
                    placeholder="VD: 2000"
                  />
                </div>

                <div className="space-y-2">
                  <FieldLabel>Giới tính</FieldLabel>
                  <select
                    value={form.gender}
                    onChange={(event) => updateField('gender', event.target.value)}
                    className={inputClassName()}
                  >
                    <option value="">Chọn giới tính</option>
                    {GENDER_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <FieldLabel>Facebook / hồ sơ cá nhân</FieldLabel>
                  <input
                    type="url"
                    value={form.facebook_url}
                    onChange={(event) => updateField('facebook_url', event.target.value)}
                    className={inputClassName()}
                    placeholder="https://facebook.com/..."
                  />
                </div>

                <div className="space-y-2 lg:col-span-2">
                  <FieldLabel>Địa chỉ hiện tại</FieldLabel>
                  <input
                    value={form.current_address}
                    onChange={(event) => updateField('current_address', event.target.value)}
                    className={inputClassName()}
                    placeholder="Quận/huyện, thành phố đang sinh sống"
                  />
                </div>

                <div className="space-y-2 lg:col-span-2">
                  <FieldLabel>Kinh nghiệm giảng dạy</FieldLabel>
                  <textarea
                    value={form.teaching_experience}
                    onChange={(event) => updateField('teaching_experience', event.target.value)}
                    className="min-h-28 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#a1001f] focus:ring-4 focus:ring-[#a1001f]/10"
                    placeholder="Tóm tắt kinh nghiệm, lớp đã dạy, nhóm tuổi học viên..."
                  />
                </div>

                <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4 lg:col-span-2">
                  <div className="space-y-2">
                    <FieldLabel required={hasTeachingExperience}>
                      Văn bằng, chứng chỉ sư phạm (nếu có kinh nghiệm)
                    </FieldLabel>
                    <p className="text-xs font-semibold leading-5 text-slate-500">
                      Nếu có kinh nghiệm, vui lòng gửi link Google Drive/OneDrive chứa văn bằng hoặc một trong các chứng chỉ sau.
                    </p>
                    <ul className="space-y-1 text-xs font-semibold leading-5 text-slate-600">
                      <li>- Chứng chỉ nghiệp vụ sư phạm mầm non.</li>
                      <li>- Chứng chỉ nghiệp vụ sư phạm cấp tiểu học.</li>
                      <li>- Chứng chỉ nghiệp vụ sư phạm cấp THCS&THPT.</li>
                    </ul>
                  </div>
                  <input
                    required={hasTeachingExperience}
                    type="url"
                    value={form.pedagogy_certificate_url}
                    onChange={(event) => updateField('pedagogy_certificate_url', event.target.value)}
                    className={inputClassName()}
                    placeholder="https://drive.google.com/... hoặc https://1drv.ms/..."
                  />
                </div>

                <input
                  tabIndex={-1}
                  autoComplete="off"
                  value={form.website}
                  onChange={(event) => updateField('website', event.target.value)}
                  className="hidden"
                  aria-hidden="true"
                />
              </div>

              <div className="mt-7 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs font-semibold leading-5 text-slate-500">
                  Bằng việc gửi form, bạn xác nhận thông tin cung cấp là chính xác.
                </p>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#a1001f] px-6 text-sm font-black text-white shadow-sm transition hover:bg-[#870018] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {submitting ? 'Đang gửi' : 'Gửi thông tin'}
                  {!submitting ? <ArrowRight className="h-4 w-4" /> : null}
                </button>
              </div>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}
