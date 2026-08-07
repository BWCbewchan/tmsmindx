'use client'

import { PageContainer } from '@/components/PageContainer'
import { SkeletonList } from '@/components/skeletons'
import { Button } from '@/components/ui/button'
import { SecureTrainingDocumentViewer } from '@/components/training/SecureTrainingDocumentViewer'
import { toast } from '@/lib/app-toast'
import { authHeaders } from '@/lib/auth-headers'
import { useAuth } from '@/lib/auth-context'
import { TRAINING_DOCUMENT_STAGES, type TrainingDocumentRow, type TrainingDocumentStage, type TrainingDocumentStatus } from '@/lib/hr-training-documents'
import { Edit2, FileText, Plus, Save, ShieldCheck, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

type FormState = {
  id: number | null
  title: string
  description: string
  document_url: string
  stage: TrainingDocumentStage
  session_number: string
  sort_order: string
  status: TrainingDocumentStatus
}

const emptyForm: FormState = {
  id: null,
  title: '',
  description: '',
  document_url: '',
  stage: 'centralized_training',
  session_number: '',
  sort_order: '100',
  status: 'draft',
}

export default function TrainingDocumentsAdminPage() {
  const { token, user } = useAuth()
  const [documents, setDocuments] = useState<TrainingDocumentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const selectedDocument = useMemo(
    () => documents.find((item) => item.id === selectedId) || documents[0] || null,
    [documents, selectedId],
  )

  const fetchDocuments = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/hr/onboarding/training-documents?status=all', {
        headers: authHeaders(token),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Không thể tải tài liệu đào tạo.')
      setDocuments(Array.isArray(data.data) ? data.data : [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể tải tài liệu đào tạo.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void fetchDocuments()
  }, [fetchDocuments])

  const resetForm = () => setForm(emptyForm)

  const editDocument = (item: TrainingDocumentRow) => {
    setForm({
      id: item.id,
      title: item.title,
      description: item.description || '',
      document_url: item.document_url,
      stage: item.stage,
      session_number: item.session_number ? String(item.session_number) : '',
      sort_order: String(item.sort_order ?? 100),
      status: item.status,
    })
    setSelectedId(item.id)
  }

  const saveDocument = async () => {
    setSaving(true)
    try {
      const method = form.id ? 'PATCH' : 'POST'
      const res = await fetch('/api/hr/onboarding/training-documents', {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(token),
        },
        body: JSON.stringify({
          id: form.id,
          title: form.title,
          description: form.description,
          document_url: form.document_url,
          stage: form.stage,
          session_number: form.session_number ? Number(form.session_number) : null,
          sort_order: Number(form.sort_order || 100),
          status: form.status,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Không thể lưu tài liệu đào tạo.')
      toast.success(form.id ? 'Đã cập nhật tài liệu đào tạo.' : 'Đã thêm tài liệu đào tạo.')
      setSelectedId(data.data?.id || form.id)
      resetForm()
      await fetchDocuments()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể lưu tài liệu đào tạo.')
    } finally {
      setSaving(false)
    }
  }

  const deleteDocument = async (id: number) => {
    if (!confirm('Xóa tài liệu đào tạo này?')) return
    try {
      const res = await fetch(`/api/hr/onboarding/training-documents?id=${id}`, {
        method: 'DELETE',
        headers: authHeaders(token),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Không thể xóa tài liệu.')
      toast.success('Đã xóa tài liệu đào tạo.')
      if (selectedId === id) setSelectedId(null)
      await fetchDocuments()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể xóa tài liệu.')
    }
  }

  if (loading) {
    return (
      <PageContainer title="Tài liệu đào tạo" description="Quản lý slide/tài liệu đào tạo đầu vào">
        <SkeletonList items={6} />
      </PageContainer>
    )
  }

  return (
    <PageContainer
      title="Tài liệu đào tạo"
      description="Gắn link Google Drive/Docs/Slides để ứng viên xem lại nội dung đào tạo theo buổi"
      headerActions={
        <Button variant="mindx" onClick={resetForm}>
          <Plus className="h-4 w-4" />
          Thêm tài liệu
        </Button>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <section className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-black text-slate-950">{form.id ? 'Cập nhật tài liệu' : 'Thêm tài liệu mới'}</h2>
                <p className="mt-1 text-xs font-semibold text-slate-500">Link Drive nên để quyền xem phù hợp nội bộ.</p>
              </div>
              {form.id && (
                <button type="button" onClick={resetForm} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Tiêu đề</span>
                <input value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-[#a1001f]" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Link Google Drive/Docs/Slides</span>
                <input value={form.document_url} onChange={(e) => setForm((prev) => ({ ...prev, document_url: e.target.value }))} className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-[#a1001f]" placeholder="https://drive.google.com/..." />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Nhóm đào tạo</span>
                  <select value={form.stage} onChange={(e) => setForm((prev) => ({ ...prev, stage: e.target.value as TrainingDocumentStage }))} className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-[#a1001f]">
                    {Object.entries(TRAINING_DOCUMENT_STAGES).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Buổi</span>
                  <input type="number" min={1} value={form.session_number} onChange={(e) => setForm((prev) => ({ ...prev, session_number: e.target.value }))} className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-[#a1001f]" placeholder="VD: 1" />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Thứ tự</span>
                  <input type="number" value={form.sort_order} onChange={(e) => setForm((prev) => ({ ...prev, sort_order: e.target.value }))} className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-[#a1001f]" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Trạng thái</span>
                  <select value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as TrainingDocumentStatus }))} className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-[#a1001f]">
                    <option value="draft">Nháp</option>
                    <option value="active">Hiển thị cho ứng viên</option>
                  </select>
                </label>
              </div>
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Mô tả</span>
                <textarea value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} className="min-h-20 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-[#a1001f]" />
              </label>
              <Button variant="mindx" className="w-full" loading={saving} onClick={saveDocument}>
                {!saving && <Save className="h-4 w-4" />}
                {form.id ? 'Cập nhật tài liệu' : 'Lưu tài liệu'}
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
            <div className="flex gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <p>TPS hiển thị tài liệu trong viewer có watermark. Quyền chia sẻ gốc của Google Drive vẫn cần được cấu hình đúng ở Drive.</p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            {documents.length === 0 ? (
              <div className="col-span-full rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
                <FileText className="mx-auto h-10 w-10 text-slate-300" />
                <p className="mt-3 font-bold text-slate-800">Chưa có tài liệu đào tạo</p>
              </div>
            ) : documents.map((item) => (
              <article key={item.id} className={`rounded-xl border bg-white p-4 shadow-sm transition ${selectedDocument?.id === item.id ? 'border-[#a1001f]' : 'border-slate-200'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className={`rounded-full px-2 py-1 text-[11px] font-black ${item.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {item.status === 'active' ? 'Đang hiển thị' : 'Nháp'}
                    </span>
                    <h3 className="mt-3 line-clamp-2 font-black text-slate-950">{item.title}</h3>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      {TRAINING_DOCUMENT_STAGES[item.stage]}{item.session_number ? ` / Buổi ${item.session_number}` : ''}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setSelectedId(item.id)}>Xem</Button>
                  <Button variant="outline" size="sm" onClick={() => editDocument(item)}><Edit2 className="h-3.5 w-3.5" /> Sửa</Button>
                  <Button variant="destructive" size="sm" onClick={() => deleteDocument(item.id)}><Trash2 className="h-3.5 w-3.5" /> Xóa</Button>
                </div>
              </article>
            ))}
          </div>

          {selectedDocument && (
            <SecureTrainingDocumentViewer
              title={selectedDocument.title}
              sourceUrl={selectedDocument.document_url}
              viewerEmail={user?.email}
            />
          )}
        </section>
      </div>
    </PageContainer>
  )
}
