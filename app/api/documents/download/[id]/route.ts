import { NextRequest, NextResponse } from 'next/server'

import { resolveAppUserAccessForEmail } from '@/lib/app-user-access'
import { requireBearerOrSessionCookie } from '@/lib/datasource-api-auth'
import {
  ensureDownloadableMaterialResponse,
  fetchMaterialLinkForDownload,
  filenameFromMaterialResponse,
  MaterialDownloadError,
  safeAttachmentName,
} from '@/lib/material-link-download'
import { parseSharePointPersonalFolderUrl, zipSharePointPersonalFolder } from '@/lib/microsoft-graph-materials'
import { clientIpFromRequest, rateLimitOr429 } from '@/lib/rate-limit-memory'
import { TPS_SESSION_COOKIE, verifySessionCookieValue } from '@/lib/session-cookie'
import { findTeachingDocument, getTeachingDocumentObject } from '@/lib/teaching-documents'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ id: string }>
}

type DownloadAuth = {
  ok: true
  sessionEmail: string
  privileged: boolean
} | {
  ok: false
  response: NextResponse
}

async function requireDownloadAuth(request: NextRequest): Promise<DownloadAuth> {
  const strictAuth = await requireBearerOrSessionCookie(request)
  if (strictAuth.ok) {
    return {
      ok: true,
      sessionEmail: strictAuth.sessionEmail,
      privileged: strictAuth.privileged,
    }
  }

  const rawSession = request.cookies.get(TPS_SESSION_COOKIE)?.value
  const session = rawSession ? await verifySessionCookieValue(rawSession) : null
  if (!session?.email) return strictAuth

  const access = await resolveAppUserAccessForEmail(session.email)
  return {
    ok: true,
    sessionEmail: session.email,
    privileged: access.role === 'super_admin',
  }
}

function downloadHeaders(fileName: string, contentType: string, contentLength?: string | null) {
  const headers = new Headers({
    'Cache-Control': 'no-store, private, max-age=0',
    'Content-Type': contentType || 'application/octet-stream',
    'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(safeAttachmentName(fileName))}`,
    'X-Content-Type-Options': 'nosniff',
  })

  if (contentLength) headers.set('Content-Length', contentLength)
  return headers
}

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireDownloadAuth(request)
  if (!auth.ok) return auth.response
  const wantsJsonMode = request.nextUrl.searchParams.get('mode') === 'json'

  const { id: rawId } = await context.params
  const documentId = Number(rawId)
  if (!Number.isInteger(documentId) || documentId <= 0) {
    return NextResponse.json({ success: false, error: 'Mã tài liệu không hợp lệ' }, { status: 400 })
  }

  const rl = rateLimitOr429(
    `teaching-doc-download:${auth.sessionEmail}:${clientIpFromRequest(request)}`,
    30,
    60_000,
  )
  if (rl) return rl

  try {
    const document = await findTeachingDocument(documentId)
    if (!document) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy tài liệu' }, { status: 404 })
    }

    if (!auth.privileged && document.document_status !== 'published') {
      return NextResponse.json({ success: false, error: 'Không có quyền tải tài liệu này' }, { status: 403 })
    }

    if (document.source_type === 'material_link') {
      if (!document.material_url) {
        return NextResponse.json({ success: false, error: 'Tài liệu Material chưa có link tải' }, { status: 400 })
      }

      if (parseSharePointPersonalFolderUrl(document.material_url)) {
        const zip = await zipSharePointPersonalFolder(document.material_url)
        return new NextResponse(new Uint8Array(zip.buffer), {
          status: 200,
          headers: downloadHeaders(zip.fileName, 'application/zip', String(zip.buffer.length)),
        })
      }

      const { response, finalUrl } = await fetchMaterialLinkForDownload(document.material_url)
      if (!response.ok || !response.body) {
        return NextResponse.json(
          {
            success: false,
            error:
              response.status === 401 || response.status === 403
                ? 'Link Material cần quyền truy cập. Vui lòng dùng link chia sẻ có quyền tải hoặc cấu hình Microsoft Graph OAuth.'
                : 'Không thể tải Material từ link đã cấp',
          },
          { status: response.status || 502 },
        )
      }

      const downloadableResponse = await ensureDownloadableMaterialResponse(response)
      const contentType = downloadableResponse.headers.get('content-type') || 'application/octet-stream'
      const fileName = filenameFromMaterialResponse(downloadableResponse, document.title, finalUrl)
      return new NextResponse(downloadableResponse.body, {
        status: 200,
        headers: downloadHeaders(fileName, contentType, downloadableResponse.headers.get('content-length')),
      })
    }

    const object = await getTeachingDocumentObject(document.s3_bucket, document.s3_key)
    return new NextResponse(object.buffer, {
      status: 200,
      headers: downloadHeaders(document.file_name, document.file_type || object.contentType, String(object.buffer.length)),
    })
  } catch (error: any) {
    if (error instanceof MaterialDownloadError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: wantsJsonMode ? 200 : error.status },
      )
    }

    return NextResponse.json(
      { success: false, error: error?.message || 'Không thể tải tài liệu' },
      { status: 500 },
    )
  }
}
