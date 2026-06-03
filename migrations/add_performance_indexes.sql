-- =============================================================
-- Migration: Performance Indexes
-- Mô tả: Thêm các index còn thiếu để tối ưu hiệu năng truy vấn
--        đặc biệt trong luồng đăng nhập và bảo mật.
-- Ngày: 2026-06-03
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. app_users — Tìm kiếm theo email/username khi đăng nhập
-- ─────────────────────────────────────────────────────────────

-- Index case-insensitive trên email (chỉ user đang active)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_app_users_email_lower_active
  ON public.app_users (LOWER(email))
  WHERE is_active = true;

-- Index case-insensitive trên username
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_app_users_username_lower_active
  ON public.app_users (LOWER(username))
  WHERE is_active = true;

-- ─────────────────────────────────────────────────────────────
-- 2. security_threat_tracking — Kiểm tra IP bị block
-- ─────────────────────────────────────────────────────────────

-- Query phổ biến nhất: WHERE ip = ? AND is_blocked = true AND blocked_until > NOW()
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_security_threat_ip_blocked
  ON public.security_threat_tracking (ip_address, blocked_until)
  WHERE is_blocked = true;

-- ─────────────────────────────────────────────────────────────
-- 3. session_tracking — Đếm session active trong 15 phút qua
-- ─────────────────────────────────────────────────────────────

-- Query: WHERE last_activity > NOW() - INTERVAL '15 minutes'
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_session_tracking_last_activity
  ON public.session_tracking (last_activity DESC);

-- Index thêm để đếm distinct user_email hiệu quả hơn
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_session_tracking_email_activity
  ON public.session_tracking (user_email, last_activity DESC);

-- ─────────────────────────────────────────────────────────────
-- 4. security_audit_logs — Tra cứu log theo thời gian và action
-- ─────────────────────────────────────────────────────────────

-- Query: ORDER BY created_at DESC (dùng cho /summary, /status)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_security_audit_logs_created_at
  ON public.security_audit_logs (created_at DESC);

-- Query: WHERE action = 'EXCESSIVE_LOGIN_TRAFFIC' AND created_at > NOW() - INTERVAL '15 minutes'
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_security_audit_logs_action_created
  ON public.security_audit_logs (action, created_at DESC);

-- Query: WHERE severity IN ('HIGH', 'CRITICAL') (dùng cho alert system)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_security_audit_logs_severity_created
  ON public.security_audit_logs (severity, created_at DESC)
  WHERE severity IN ('HIGH', 'CRITICAL');

-- Query: WHERE user_email = ? (dùng cho log theo user)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_security_audit_logs_user_email
  ON public.security_audit_logs (user_email, created_at DESC)
  WHERE user_email IS NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- 5. app_permissions — Tra cứu quyền theo user_id
-- ─────────────────────────────────────────────────────────────

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_app_permissions_user_active
  ON public.app_permissions (user_id)
  WHERE can_access = true;

-- ─────────────────────────────────────────────────────────────
-- 6. user_roles — Tra cứu role theo user_id
-- ─────────────────────────────────────────────────────────────

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_roles_user_id
  ON public.user_roles (user_id);

-- ─────────────────────────────────────────────────────────────
-- 7. ai_rate_limits — Rate limit check theo user+feature+ngày
-- ─────────────────────────────────────────────────────────────

-- Đảm bảo unique constraint + index cho upsert hiệu quả
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_rate_limits_user_feature_reset
  ON public.ai_rate_limits (user_email, feature, reset_at)
  WHERE reset_at > NOW();

-- ─────────────────────────────────────────────────────────────
-- 8. Partial index cleanup để lọc old session_tracking records
--    (giúp COUNT() nhanh hơn trên bảng lớn)
-- ─────────────────────────────────────────────────────────────

-- Xóa các session records cũ hơn 24h (cleanup job helper)
-- Đây là index để DELETE hiệu quả
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_session_tracking_cleanup
  ON public.session_tracking (last_activity)
  WHERE last_activity < NOW() - INTERVAL '24 hours';

-- =============================================================
-- Verify: Liệt kê tất cả indexes vừa tạo
-- =============================================================
-- SELECT indexname, tablename, indexdef
-- FROM pg_indexes
-- WHERE schemaname = 'public'
--   AND indexname LIKE 'idx_%'
-- ORDER BY tablename, indexname;
