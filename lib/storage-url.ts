/**
 * Normalize storage URLs through the authenticated storage endpoint.
 *
 * The endpoint normally responds with a short-lived signed redirect so large
 * image/video bodies do not pass through the application server.
 */

const SUPABASE_STORAGE_PATTERN =
  /https?:\/\/[^/]+\.supabase\.co\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)/;

function decodeStorageKey(key: string): string {
  const pathOnly = key.split(/[?#]/, 1)[0]
  try {
    return decodeURIComponent(pathOnly)
  } catch {
    return pathOnly
  }
}

function makeStorageProxyUrl(bucket: string, key: string): string {
  const params = new URLSearchParams({ bucket, key: decodeStorageKey(key) });
  return `/api/storage-image?${params.toString()}`;
}

function normalizeLegacyProxyUrl(url: string): string {
  try {
    const parsed = new URL(url, 'http://localhost');
    if (parsed.pathname !== '/api/storage-image') return url;

    parsed.searchParams.delete('proxy');
    const normalized = `${parsed.pathname}?${parsed.searchParams.toString()}`;
    return url.startsWith('/') ? normalized : parsed.toString();
  } catch {
    return url;
  }
}

/** Parse s3://bucket/key to the authenticated storage endpoint. */
function s3UriToProxyUrl(url: string): string | null {
  const match = url.match(/^s3:\/\/([^/]+)\/(.+)$/);
  if (!match) return null;
  return makeStorageProxyUrl(match[1], match[2]);
}

/**
 * Normalize an image/video URL:
 * - Supabase URLs use the authenticated storage endpoint.
 * - Legacy proxy=1 parameters are removed so the endpoint can redirect.
 * - Other URLs are left unchanged.
 */
export function normalizeStorageUrl(url: string | null | undefined): string {
  if (!url) return '/placeholder.svg';

  if (url.startsWith('/api/storage-image')) {
    return normalizeLegacyProxyUrl(url);
  }

  if (url.startsWith('s3://')) {
    return s3UriToProxyUrl(url) ?? url;
  }

  const match = url.match(SUPABASE_STORAGE_PATTERN);
  if (match) {
    return makeStorageProxyUrl(match[1], match[2]);
  }

  return url;
}

export function isSupabaseStorageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return SUPABASE_STORAGE_PATTERN.test(url);
}
