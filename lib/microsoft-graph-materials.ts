import JSZip from 'jszip'

import { MaterialDownloadError } from '@/lib/material-link-download'

type GraphTokenCache = {
  accessToken: string
  expiresAtMs: number
} | null

type GraphDriveItem = {
  id: string
  name: string
  folder?: { childCount?: number }
  file?: { mimeType?: string }
  size?: number
}

type SharePointPersonalFolder = {
  userPrincipalName: string
  drivePath: string
}

const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0'
const MAX_FOLDER_FILES = 200
const MAX_ZIP_SOURCE_BYTES = 300 * 1024 * 1024
const GRAPH_TIMEOUT_MS = 30_000

let tokenCache: GraphTokenCache = null

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new MaterialDownloadError(
      'Chưa cấu hình Microsoft Graph để tải thư mục SharePoint. Vui lòng cấu hình Azure App credentials rồi khởi động lại server.',
      500,
    )
  }
  return value
}

async function getGraphAccessToken(): Promise<string> {
  const now = Date.now()
  if (tokenCache && tokenCache.expiresAtMs > now + 60_000) {
    return tokenCache.accessToken
  }

  const tenantId = getRequiredEnv('MICROSOFT_TENANT_ID')
  const clientId = getRequiredEnv('MICROSOFT_CLIENT_ID')
  const clientSecret = getRequiredEnv('MICROSOFT_CLIENT_SECRET')

  const response = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://graph.microsoft.com/.default',
    }).toString(),
    cache: 'no-store',
    signal: AbortSignal.timeout(GRAPH_TIMEOUT_MS),
  })

  const data = await response.json()
  if (!response.ok) {
    throw new MaterialDownloadError(
      `Không lấy được Microsoft Graph token: ${data?.error_description || data?.error || response.statusText}`,
      500,
    )
  }

  const accessToken = String(data.access_token || '')
  if (!accessToken) throw new MaterialDownloadError('Microsoft Graph token thiếu access_token', 500)

  tokenCache = {
    accessToken,
    expiresAtMs: now + Math.max(60, Number(data.expires_in || 3600) - 60) * 1000,
  }
  return accessToken
}

function userSlugToPrincipalName(slug: string) {
  const parts = slug.split('_').filter(Boolean)
  if (parts.length < 3) {
    throw new MaterialDownloadError('Không đọc được tài khoản OneDrive từ link SharePoint', 400)
  }

  const domainParts = parts.slice(-3)
  const localParts = parts.slice(0, -3)
  return `${localParts.join('_')}@${domainParts.join('.')}`.toLowerCase()
}

export function parseSharePointPersonalFolderUrl(rawUrl: string): SharePointPersonalFolder | null {
  const url = new URL(rawUrl)
  if (!url.hostname.toLowerCase().endsWith('sharepoint.com')) return null

  const segments = url.pathname.split('/').filter(Boolean).map((segment) => decodeURIComponent(segment))
  const personalIndex = segments.findIndex((segment) => segment.toLowerCase() === 'personal')
  if (personalIndex < 0) return null

  const userSlug = segments[personalIndex + 1]
  if (!userSlug) return null

  const pathSegments = segments.slice(personalIndex + 2).filter((segment) => !/^:[a-z]:$/i.test(segment))
  if (pathSegments.length === 0) return null

  return {
    userPrincipalName: userSlugToPrincipalName(userSlug),
    drivePath: pathSegments.join('/'),
  }
}

async function graphJson<T>(pathOrUrl: string, token: string): Promise<T> {
  const url = pathOrUrl.startsWith('https://') ? pathOrUrl : `${GRAPH_BASE_URL}${pathOrUrl}`
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(GRAPH_TIMEOUT_MS),
  })
  const data = await response.json()
  if (!response.ok) {
    throw new MaterialDownloadError(
      `Microsoft Graph lỗi: ${data?.error?.message || response.statusText}`,
      response.status === 403 ? 403 : 502,
    )
  }
  return data as T
}

async function listChildren(userPrincipalName: string, itemId: string, token: string) {
  const children: GraphDriveItem[] = []
  let nextUrl: string | undefined =
    `${GRAPH_BASE_URL}/users/${encodeURIComponent(userPrincipalName)}/drive/items/${encodeURIComponent(itemId)}/children?$top=200`

  while (nextUrl) {
    const data: { value?: GraphDriveItem[]; '@odata.nextLink'?: string } = await graphJson(nextUrl, token)
    children.push(...(data.value || []))
    nextUrl = data['@odata.nextLink']
  }

  return children
}

async function downloadDriveItem(userPrincipalName: string, itemId: string, token: string) {
  const response = await fetch(
    `${GRAPH_BASE_URL}/users/${encodeURIComponent(userPrincipalName)}/drive/items/${encodeURIComponent(itemId)}/content`,
    {
      headers: { Authorization: `Bearer ${token}` },
      redirect: 'follow',
      cache: 'no-store',
      signal: AbortSignal.timeout(GRAPH_TIMEOUT_MS),
    },
  )

  if (!response.ok) {
    throw new MaterialDownloadError(`Không tải được file từ Microsoft Graph: ${response.statusText}`, 502)
  }

  return Buffer.from(await response.arrayBuffer())
}

function zipSafePath(path: string) {
  return path
    .split('/')
    .map((part) => part.replace(/[/\\?%*:|"<>]/g, '-').replace(/[\r\n]/g, ' ').trim() || 'file')
    .join('/')
}

async function addFolderToZip(input: {
  zip: JSZip
  userPrincipalName: string
  folderId: string
  folderPath: string
  token: string
  counters: { files: number; bytes: number }
}) {
  const children = await listChildren(input.userPrincipalName, input.folderId, input.token)

  for (const item of children) {
    if (input.counters.files >= MAX_FOLDER_FILES) {
      throw new MaterialDownloadError(`Thư mục vượt quá giới hạn ${MAX_FOLDER_FILES} file/lần tải`, 413)
    }

    const nextPath = `${input.folderPath}/${item.name}`
    if (item.folder) {
      await addFolderToZip({
        ...input,
        folderId: item.id,
        folderPath: nextPath,
      })
      continue
    }

    if (!item.file) continue

    input.counters.files += 1
    input.counters.bytes += Number(item.size || 0)
    if (input.counters.bytes > MAX_ZIP_SOURCE_BYTES) {
      throw new MaterialDownloadError('Thư mục vượt quá giới hạn 300MB/lần tải', 413)
    }

    const buffer = await downloadDriveItem(input.userPrincipalName, item.id, input.token)
    input.zip.file(zipSafePath(nextPath), buffer)
  }
}

export async function zipSharePointPersonalFolder(rawUrl: string) {
  const parsed = parseSharePointPersonalFolderUrl(rawUrl)
  if (!parsed) {
    throw new MaterialDownloadError('Link SharePoint folder không hợp lệ', 400)
  }

  const token = await getGraphAccessToken()
  const item = await graphJson<GraphDriveItem>(
    `/users/${encodeURIComponent(parsed.userPrincipalName)}/drive/root:/${parsed.drivePath}`,
    token,
  )

  if (!item.folder) {
    throw new MaterialDownloadError('Link SharePoint không phải thư mục', 400)
  }

  const zip = new JSZip()
  const rootName = item.name || 'material'
  const counters = { files: 0, bytes: 0 }
  await addFolderToZip({
    zip,
    userPrincipalName: parsed.userPrincipalName,
    folderId: item.id,
    folderPath: rootName,
    token,
    counters,
  })

  if (counters.files === 0) {
    throw new MaterialDownloadError('Thư mục SharePoint không có file để tải', 404)
  }

  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })

  return {
    buffer,
    fileName: `${rootName}.zip`,
    fileCount: counters.files,
  }
}
