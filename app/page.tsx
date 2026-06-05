'use client'

import { PageSkeleton } from '@/components/skeletons/PageSkeleton'
import { useAuth } from '@/lib/auth-context'
import { authHeaders } from '@/lib/auth-headers'
import { logger } from '@/lib/logger'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function Home() {
  const router = useRouter()
  const { user, token, isLoading } = useAuth()

  useEffect(() => {
    // 1. Kiểm tra nhanh localStorage để redirect đến login ngay lập tức cho guest user
    try {
      const storedUser = localStorage.getItem('user')
      if (!storedUser) {
        logger.info('Root: No cached user in localStorage, redirecting to login immediately')
        router.replace('/login')
        return
      }
    } catch (err) {
      router.replace('/login')
      return
    }

    // 2. Chờ tải thông tin phiên đăng nhập nếu đã có dữ liệu cache trong localStorage
    if (isLoading) {
      logger.info('Root: Waiting for auth context to load...')
      return
    }

    // 3. Dự phòng: Nếu đã load xong auth context mà vẫn không có user hợp lệ
    if (!user) {
      logger.info('Root: No auth found, redirecting to login')
      router.replace('/login')
      return
    }

    // Đã đăng nhập → kiểm tra quyền và redirect
    logger.info('Root: User authenticated, checking admin status', {
      email: user.email,
      role: user.role,
      isAdmin: user.isAdmin,
    })

    // Ưu tiên admin dashboard nếu là admin
    if (user.isAdmin) {
      logger.success('Root: Redirecting to admin dashboard')
      router.replace('/admin/dashboard')
      return
    }

    // Không phải GV — không cần kiểm tra bảng teachers
    if (user.role !== 'teacher') {
      logger.info('Root: Non-teacher user, redirecting to user area')
      router.replace('/user/thongtingv')
      return
    }

    const currentUserEmail = (user.email || '').trim().toLowerCase()

    // GV: luôn hỏi DB (localStorage có thể cũ nếu bản ghi đã bị xóa)
    const run = async () => {
      try {
        const res = await fetch(
          `/api/checkdatasource/status?email=${encodeURIComponent(user.email)}&brief=1`,
          { cache: 'no-store', headers: authHeaders(token) },
        )
        
        if (res.status === 401 || res.status === 403) {
          logger.info('Root: Session expired or unauthorized (401/403), redirecting to login')
          router.replace('/login')
          return
        }

        const data = (await res.json()) as {
          success?: boolean
          exists?: boolean
          dbUnavailable?: boolean
        }
        if (res.ok && data.success) {
          if (data.dbUnavailable) {
            logger.warn('Root: DB unavailable, redirecting to user area (degraded)')
            router.replace('/user/thongtingv')
            return
          }
          if (data.exists === true) {
            try {
              localStorage.setItem('tps_profile_check_done_email', currentUserEmail)
            } catch {
              /* ignore */
            }
            logger.success('Root: Teacher found in DB, skipping checkdatasource')
            router.replace('/user/thongtingv')
            return
          }
          try {
            localStorage.removeItem('tps_profile_check_done_email')
          } catch {
            /* ignore */
          }
          logger.info('Root: Teacher missing in DB, redirecting to checkdatasource')
          router.replace('/checkdatasource')
          return
        }
      } catch (err) {
        logger.error('Root: Error checking teacher status', err)
      }
      
      // Fallback: Khi xảy ra lỗi mạng hoặc lỗi server khác (không phải 401/403/teacher_missing),
      // chuyển hướng tới thông tin GV dưới dạng degraded mode thay vì ép vào checkdatasource.
      logger.warn('Root: Unexpected check error, falling back to user area')
      router.replace('/user/thongtingv')
    }

    void run()
  }, [user, token, isLoading, router])

  return <PageSkeleton variant="default" itemCount={6} showHeader={true} />
}
