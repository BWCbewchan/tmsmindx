'use client';

import { useAuth } from '@/lib/auth-context';
import { authHeaders } from '@/lib/auth-headers';
import { toast } from '@/lib/app-toast';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
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

const NOTIFICATION_COUNT_REFRESH_MS = 180_000;
const NOTIFICATION_DEDUPING_MS = 60_000;

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'Vừa xong';
  if (diffMin < 60) return `${diffMin} phút trước`;
  if (diffHr < 24) return `${diffHr} giờ trước`;
  return `${diffDays} ngày trước`;
}

// Clean and format JavaScript Date string representations inside notification content
function formatContentText(text: string): string {
  if (!text) return '';
  
  // Matches "Sun Jun 07 2026 00:00:00 GMT+0000 (Coordinated Universal Time)" or similar GMT representations
  const jsDateRegex = /[A-Z][a-z]{2}\s[A-Z][a-z]{2}\s\d{1,2}\s\d{4}\s\d{2}:\d{2}:\d{2}\sGMT[+-]\d{2,4}(?::\d{2})?(?:\s\([^)]+\))?/g;
  
  let formatted = text.replace(jsDateRegex, (match) => {
    try {
      const d = new Date(match);
      if (isNaN(d.getTime())) return match;
      
      const dayNames = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
      const dayName = dayNames[d.getDay()];
      const dateStr = String(d.getDate()).padStart(2, '0');
      const monthStr = String(d.getMonth() + 1).padStart(2, '0');
      const yearStr = d.getFullYear();
      
      return `${dayName} ${dateStr}/${monthStr}/${yearStr}`;
    } catch {
      return match;
    }
  });

  // Matches ISO strings like "2026-06-07T00:00:00.000Z"
  const isoDateRegex = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/g;
  formatted = formatted.replace(isoDateRegex, (match) => {
    try {
      const d = new Date(match);
      if (isNaN(d.getTime())) return match;
      const dateStr = String(d.getDate()).padStart(2, '0');
      const monthStr = String(d.getMonth() + 1).padStart(2, '0');
      const yearStr = d.getFullYear();
      return `${dateStr}/${monthStr}/${yearStr}`;
    } catch {
      return match;
    }
  });
  
  return formatted;
}

export default function NotificationBell({ className = '' }: { className?: string } = {}) {
  const { user, token } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isAdminArea = pathname.startsWith('/admin');
  const notificationLink = isAdminArea ? '/admin/thong-bao' : '/user/thong-bao';

  const fetcher = useMemo(
    () => (url: string) =>
      fetch(url, { headers: authHeaders(token) }).then((r) => r.json()),
    [token]
  );

  // Chỉ tải danh sách đầy đủ khi người dùng mở chuông. Badge dùng endpoint đếm
  // riêng nên không cần truyền 15 bản ghi và polling danh sách trên mọi trang.
  const { data: notificationsData, mutate: mutateNotifications } = useSWR(
    user?.email && isOpen ? '/api/notifications?limit=15' : null,
    fetcher,
    {
      refreshWhenHidden: false,
      refreshWhenOffline: false,
      revalidateOnFocus: true,
      dedupingInterval: NOTIFICATION_DEDUPING_MS,
    }
  );

  // Fetch unread count (shared SWR key with sidebar)
  const { data: unreadData, mutate: mutateUnread } = useSWR(
    user?.email ? '/api/notifications/unread-count' : null,
    fetcher,
    {
      refreshInterval: NOTIFICATION_COUNT_REFRESH_MS,
      refreshWhenHidden: false,
      refreshWhenOffline: false,
      revalidateOnFocus: true,
      dedupingInterval: NOTIFICATION_DEDUPING_MS,
    }
  );

  const notifications: Notification[] = notificationsData?.data || [];
  const unreadCount = unreadData?.count || 0;

  // Toggle dropdown
  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Mark specific notification as read and navigate
  const handleNotificationClick = async (item: Notification) => {
    setIsOpen(false);
    if (!item.is_read) {
      try {
        await fetch('/api/notifications', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders(token),
          },
          body: JSON.stringify({ id: item.id }),
        });
        void mutateNotifications();
        void mutateUnread();
      } catch (err) {
        console.error('Error marking notification as read:', err);
      }
    }
    if (item.link) {
      let finalLink = item.link;
      if (item.link === '/user/lich-cua-toi') {
        finalLink = '/user/lich-cua-toi?tab=xin-nghi';
      }
      router.push(finalLink);
    }
  };

  // Mark all as read
  const handleMarkAllAsRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(token),
        },
        body: JSON.stringify({ all: true }),
      });
      void mutateNotifications();
      void mutateUnread();
      toast.success('Đã đánh dấu tất cả thông báo là đã đọc');
    } catch (err) {
      console.error('Error marking all as read:', err);
      toast.error('Lỗi khi đánh dấu đã đọc');
    }
  };

  // Open the dedicated cross-platform Web Push settings.
  const handleEnablePushNotifications = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    router.push(`${notificationLink}?settings=device`);
  };

  if (!user) return null;

  return (
    <div className={`NotificationBell-module__doceWq__container ${className}`} ref={containerRef}>
      <button
        className={`NotificationBell-module__doceWq__bellButton ${
          unreadCount > 0 ? 'NotificationBell-module__doceWq__hasUnread' : ''
        }`}
        aria-label="Thông báo"
        onClick={toggleDropdown}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="lucide lucide-bell"
          aria-hidden="true"
        >
          <path d="M10.268 21a2 2 0 0 0 3.464 0"></path>
          <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"></path>
        </svg>
        {unreadCount > 0 && (
          <span className="NotificationBell-module__doceWq__badge">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="NotificationBell-module__doceWq__dropdown">
          <div className="NotificationBell-module__doceWq__dropdownHeader">
            <h3>Thông báo</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                className="NotificationBell-module__doceWq__markAllRead"
                onClick={handleMarkAllAsRead}
              >
                Đánh dấu đã đọc
              </button>
              <button
                className="NotificationBell-module__doceWq__markAllRead"
                title="Cài đặt thông báo thiết bị"
                style={{ color: 'var(--app-muted-foreground)' }}
                onClick={handleEnablePushNotifications}
              >
                Cài đặt thiết bị
              </button>
            </div>
          </div>

          <div className="NotificationBell-module__doceWq__notificationsList custom-scrollbar">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500">
                Không có thông báo nào.
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  className={`NotificationBell-module__doceWq__notificationItem ${
                    !item.is_read ? 'NotificationBell-module__doceWq__unread' : ''
                  }`}
                  onClick={() => handleNotificationClick(item)}
                >
                  <div className="NotificationBell-module__doceWq__notificationContent">
                    <h4>{item.title}</h4>
                    <p>{formatContentText(item.content)}</p>
                    <span className="NotificationBell-module__doceWq__timestamp">
                      {formatRelativeTime(item.created_at)}
                    </span>
                  </div>
                  {!item.is_read && (
                    <div className="NotificationBell-module__doceWq__unreadDot"></div>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="NotificationBell-module__doceWq__dropdownFooter">
            <Link
              href={notificationLink}
              className="NotificationBell-module__doceWq__viewAll"
              onClick={() => setIsOpen(false)}
            >
              Xem tất cả
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
