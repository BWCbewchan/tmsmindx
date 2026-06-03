'use client';

import { PageContainer } from '@/components/PageContainer';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { authHeaders } from '@/lib/auth-headers';
import { formatTimestamp } from '@/lib/format-timestamp';
import { Bell, BellOff, CheckCheck, Clock, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import useSWR from 'swr';

interface Notification {
  id: number;
  title: string;
  content: string;
  type: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export default function NotificationCenterPage() {
  const { token, user } = useAuth();
  const router = useRouter();

  const fetcher = useMemo(
    () => (url: string) =>
      fetch(url, { headers: authHeaders(token) }).then((r) => r.json()),
    [token]
  );

  const { data: notificationsData, mutate } = useSWR(
    user?.email ? '/api/notifications' : null,
    fetcher
  );

  const notifications: Notification[] = notificationsData?.data || [];

  const handleMarkAsRead = async (id: number, link: string | null) => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(token),
        },
        body: JSON.stringify({ id }),
      });
      mutate();
      if (link) {
        router.push(link);
      }
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(token),
        },
        body: JSON.stringify({ all: true }),
      });
      mutate();
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  };

  const getTypeStyles = (type: string) => {
    switch (type) {
      case 'exam_result':
      case 'exam':
        return {
          bg: 'bg-red-50 border-red-100 dark:bg-red-950/20 dark:border-red-900/30',
          iconBg: 'bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400',
        };
      case 'leave_request':
      case 'leave':
        return {
          bg: 'bg-emerald-50 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/30',
          iconBg: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400',
        };
      case 'salary_deal':
      case 'salary':
        return {
          bg: 'bg-amber-50 border-amber-100 dark:bg-amber-950/20 dark:border-amber-900/30',
          iconBg: 'bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400',
        };
      default:
        return {
          bg: 'bg-blue-50 border-blue-100 dark:bg-blue-950/20 dark:border-blue-900/30',
          iconBg: 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400',
        };
    }
  };

  const hasUnread = notifications.some((n) => !n.is_read);

  return (
    <PageContainer
      title="Trung tâm thông báo"
      description="Xem và quản lý các cập nhật quan trọng về lịch làm việc, kiểm tra chuyên môn, và lương thưởng của bạn."
      headerActions={
        hasUnread && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllAsRead}
            className="flex items-center gap-2 hover:bg-[#a1001f] hover:text-white transition-colors"
          >
            <CheckCheck className="h-4 w-4" />
            Đánh dấu tất cả đã đọc
          </Button>
        )
      }
    >
      <div className="max-w-4xl mx-auto space-y-4">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 bg-white border border-gray-100 rounded-2xl shadow-sm text-center">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
              <BellOff className="h-8 w-8 text-gray-400 animate-pulse" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Không có thông báo nào</h3>
            <p className="text-sm text-gray-500 max-w-sm">
              Bạn chưa nhận được thông báo nào vào lúc này. Chúng tôi sẽ báo cho bạn khi có cập nhật mới.
            </p>
          </div>
        ) : (
          <div className="bg-white border border-gray-150 rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-100">
            {notifications.map((notification) => {
              const styles = getTypeStyles(notification.type);
              return (
                <div
                  key={notification.id}
                  onClick={() => !notification.is_read && handleMarkAsRead(notification.id, null)}
                  className={`flex gap-4 p-5 transition-all duration-200 cursor-pointer ${
                    !notification.is_read
                      ? 'bg-blue-50/30 hover:bg-blue-50/50 font-medium'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${styles.iconBg}`}>
                    <Bell className="h-5 w-5" />
                  </div>
                  
                  <div className="flex-1 space-y-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <h4 className={`text-sm ${!notification.is_read ? 'font-bold text-gray-950' : 'text-gray-800'}`}>
                        {notification.title}
                      </h4>
                      <span className="shrink-0 flex items-center gap-1 text-[11px] text-gray-400 font-normal">
                        <Clock className="h-3 w-3" />
                        {formatTimestamp(notification.created_at)}
                      </span>
                    </div>
                    
                    <p className={`text-xs ${!notification.is_read ? 'text-gray-700' : 'text-gray-500'} leading-relaxed break-words`}>
                      {notification.content}
                    </p>

                    {notification.link && (
                      <div className="pt-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkAsRead(notification.id, notification.link);
                          }}
                          className="inline-flex items-center gap-1.5 text-xs text-[#a1001f] font-bold hover:underline"
                        >
                          Xem chi tiết <ExternalLink className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
