/**
 * request-cache.ts
 * ─────────────────────────────────────────────────────────────
 * Per-request in-memory cache dùng AsyncLocalStorage.
 * Mỗi request có 1 Map riêng — tự động GC khi request kết thúc.
 * 
 * Dùng để tránh gọi DB nhiều lần trong cùng 1 request:
 *   - resolveAppUserAccessForEmail → chỉ 1 lần/request
 *   - getAccessibleCenters → chỉ 1 lần/request
 *   - checkTeacherExistsByEmail → chỉ 1 lần/request
 * 
 * Vercel Fluid Compute: nhiều requests có thể chạy trên cùng 1 instance
 * → AsyncLocalStorage đảm bảo cách ly hoàn toàn giữa các requests.
 */

import { AsyncLocalStorage } from 'async_hooks';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyMap = Map<string, any>;

const _requestStorage = new AsyncLocalStorage<AnyMap>();

/**
 * Chạy handler trong context của 1 request.
 * Mỗi request sẽ có 1 cache Map riêng biệt.
 */
export function withRequestCache<T>(handler: () => Promise<T>): Promise<T> {
  return _requestStorage.run(new Map(), handler);
}

/**
 * Lấy hoặc tạo giá trị trong cache của request hiện tại.
 * Nếu không có context (chạy ngoài request) → luôn gọi factory.
 */
export async function getOrSetRequestCache<T>(
  key: string,
  factory: () => Promise<T>,
): Promise<T> {
  const store = _requestStorage.getStore();
  if (!store) return factory(); // Không có context → bypass cache

  if (store.has(key)) return store.get(key) as T;

  const value = await factory();
  store.set(key, value);
  return value;
}

/**
 * Đặt thẳng giá trị vào cache (khi đã có sẵn, tránh gọi lại DB).
 */
export function setRequestCache<T>(key: string, value: T): void {
  const store = _requestStorage.getStore();
  if (store) store.set(key, value);
}

/**
 * Lấy giá trị từ cache nếu có.
 */
export function getRequestCache<T>(key: string): T | undefined {
  return _requestStorage.getStore()?.get(key) as T | undefined;
}
