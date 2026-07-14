import { lookup } from 'dns/promises'
import net from 'net'

const MAX_REDIRECTS = 10
const DOWNLOAD_TIMEOUT_MS = 30_000
const HTML_SNIFF_BYTES = 512

export class MaterialDownloadError extends Error {
  status: number

  constructor(message: string, status = 422) {
    super(message)
    this.name = 'MaterialDownloadError'
    this.status = status
  }
}

function isPrivateIpv4(address: string) {
  const parts = address.split('.').map((part) => Number(part))
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true
  }

  const [a, b] = parts
  return (
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  )
}

function isPrivateIpv6(address: string) {
  const value = address.toLowerCase()
  return (
    value === '::1' ||
    value === '::' ||
    value.startsWith('fc') ||
    value.startsWith('fd') ||
    value.startsWith('fe80:') ||
    value.startsWith('::ffff:127.') ||
    value.startsWith('::ffff:10.') ||
    value.startsWith('::ffff:192.168.')
  )
}

async function assertPublicHttpsUrl(url: URL) {
  if (url.protocol !== 'https:') {
    throw new MaterialDownloadError('Link Material phải sử dụng HTTPS', 400)
  }

  const host = url.hostname.toLowerCase()
  if (host === 'localhost' || host.endsWith('.localhost')) {
    throw new MaterialDownloadError('Link Material không được trỏ về localhost', 400)
  }

  const directIpType = net.isIP(host)
  if (directIpType === 4 && isPrivateIpv4(host)) {
    throw new MaterialDownloadError('Link Material không được trỏ về IP nội bộ', 400)
  }
  if (directIpType === 6 && isPrivateIpv6(host)) {
    throw new MaterialDownloadError('Link Material không được trỏ về IP nội bộ', 400)
  }

  const addresses = await lookup(host, { all: true, verbatim: true })
  if (addresses.length === 0) {
    throw new MaterialDownloadError('Không thể xác thực host của link Material', 400)
  }

  const hasPrivateAddress = addresses.some((entry) => {
    if (entry.family === 4) return isPrivateIpv4(entry.address)
    if (entry.family === 6) return isPrivateIpv6(entry.address)
    return true
  })

  if (hasPrivateAddress) {
    throw new MaterialDownloadError('Link Material không được trỏ về mạng nội bộ', 400)
  }
}

function withDownloadHint(url: URL) {
  const hinted = new URL(url.toString())
  const host = hinted.hostname.toLowerCase()

  if (host.endsWith('sharepoint.com') && hinted.pathname.includes('/:')) {
    hinted.pathname = hinted.pathname.replace(/\/:([a-z]):\//i, '/:$1:/download.aspx/')
  }

  if (
    (host.includes('sharepoint.com') || host.includes('onedrive.live.com') || host === '1drv.ms') &&
    !hinted.searchParams.has('download')
  ) {
    hinted.searchParams.set('download', '1')
  }
  return hinted
}

export async function fetchMaterialLinkForDownload(rawUrl: string) {
  let currentUrl = withDownloadHint(new URL(rawUrl))

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    await assertPublicHttpsUrl(currentUrl)

    if (currentUrl.hostname.toLowerCase().endsWith('sharepoint.com') && /\/:f:\//i.test(currentUrl.pathname)) {
      throw new MaterialDownloadError(
        'Link Material hiện là thư mục SharePoint. Tải ngầm thư mục cần Microsoft Graph/OAuth để đóng gói zip; vui lòng dùng link file tải trực tiếp hoặc cấu hình Graph.',
      )
    }

    const response = await fetch(currentUrl, {
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
      headers: {
        Accept: 'application/octet-stream,*/*;q=0.8',
        'User-Agent': 'TPS-Material-Downloader/1.0',
      },
    })

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location')
      if (!location) throw new MaterialDownloadError('Link Material chuyển hướng nhưng thiếu địa chỉ đích', 400)
      currentUrl = withDownloadHint(new URL(location, currentUrl))
      continue
    }

    return { response, finalUrl: currentUrl }
  }

  throw new MaterialDownloadError('Link Material chuyển hướng quá nhiều lần', 400)
}

function looksLikeHtml(bytes: Uint8Array) {
  const text = Buffer.from(bytes.slice(0, HTML_SNIFF_BYTES)).toString('utf8').trimStart().toLowerCase()
  return (
    text.startsWith('<!doctype html') ||
    text.startsWith('<html') ||
    text.includes('<title>sign in') ||
    text.includes('login.microsoftonline.com') ||
    text.includes('microsoft account')
  )
}

export async function ensureDownloadableMaterialResponse(response: Response) {
  if (!response.body) return response

  const reader = response.body.getReader()
  const firstRead = await reader.read()
  if (firstRead.done || !firstRead.value) {
    return new Response(null, response)
  }

  const contentType = response.headers.get('content-type')?.toLowerCase() || ''
  if (contentType.includes('text/html') || looksLikeHtml(firstRead.value)) {
    await reader.cancel().catch(() => undefined)
    throw new MaterialDownloadError(
      'Link Material đang trả về trang web/đăng nhập, chưa phải file tải trực tiếp. Vui lòng dùng link chia sẻ có quyền tải trực tiếp hoặc cấu hình Microsoft Graph OAuth.',
    )
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(firstRead.value)
    },
    async pull(controller) {
      const next = await reader.read()
      if (next.done) {
        controller.close()
        return
      }
      controller.enqueue(next.value)
    },
    cancel(reason) {
      return reader.cancel(reason)
    },
  })

  return new Response(stream, response)
}

export function filenameFromMaterialResponse(response: Response, fallbackName: string, finalUrl: URL) {
  const disposition = response.headers.get('content-disposition') || ''
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].trim().replace(/^"|"$/g, ''))
    } catch {
      return utf8Match[1].trim().replace(/^"|"$/g, '')
    }
  }

  const plainMatch = disposition.match(/filename="?([^";]+)"?/i)
  if (plainMatch?.[1]) return plainMatch[1].trim()

  const urlName = decodeURIComponent(finalUrl.pathname.split('/').filter(Boolean).pop() || '')
  return urlName || fallbackName || 'material'
}

export function safeAttachmentName(name: string) {
  return (
    name
      .replace(/[/\\?%*:|"<>]/g, '-')
      .replace(/[\r\n]/g, ' ')
      .trim()
      .slice(0, 160) || 'material'
  )
}
