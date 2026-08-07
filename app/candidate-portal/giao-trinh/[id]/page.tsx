'use client'

import { PageContainer } from '@/components/PageContainer'
import { SecureDocViewer } from '@/components/secure-viewer/SecureDocViewer'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useAuth } from '@/lib/auth-context'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

type DocumentMetadata = { id: number; title: string; description: string | null }

export default function CandidateGiaoTrinhDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { user } = useAuth()
  const documentId = Number(params.id)
  const validDocumentId = Number.isInteger(documentId) && documentId > 0 ? documentId : null
  const [metadata, setMetadata] = useState<DocumentMetadata | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!validDocumentId) {
      setMessage('Giáo trình không hợp lệ.')
      return
    }

    let mounted = true
    void (async () => {
      try {
        const response = await fetch(`/api/documents/stream/${validDocumentId}?action=metadata`, { cache: 'no-store' })
        const data = await response.json()
        if (!response.ok || !data.success) throw new Error(data.error || 'Không thể tải thông tin giáo trình')
        if (mounted) {
          setMetadata(data.document)
          setMessage('')
        }
      } catch (error) {
        if (mounted) setMessage(error instanceof Error ? error.message : 'Không thể tải thông tin giáo trình')
      }
    })()

    return () => { mounted = false }
  }, [validDocumentId])

  return (
    <PageContainer
      title={metadata?.title || 'Đang tải giáo trình...'}
      description={message || metadata?.description || 'Giáo trình đã được phát hành cho ứng viên.'}
      maxWidth="full"
      headerActions={<Button type="button" variant="outline" onClick={() => router.back()}><ArrowLeft className="h-4 w-4" />Quay lại</Button>}
    >
      <Card className="rounded-lg border border-slate-200 p-3">
        <div className="mb-3 flex items-center gap-2 rounded-md bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600"><ShieldCheck className="h-4 w-4 text-rose-700" />Tài liệu chỉ được stream qua phiên đăng nhập hiện tại, có watermark và token xem tạm thời.</div>
        {validDocumentId && <SecureDocViewer documentId={validDocumentId} viewerEmail={user?.email} className="min-h-[calc(100vh-220px)]" />}
      </Card>
    </PageContainer>
  )
}
