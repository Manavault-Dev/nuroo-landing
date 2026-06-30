'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Bell, Check, BellOff } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { apiClient, type NotificationItem } from '@/lib/b2b/api'

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(date: Date | string | null): string {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  const diff = Date.now() - d.getTime()
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  return `${day}d ago`
}

// ── Component ─────────────────────────────────────────────────────────────────

export function NotificationBell() {
  const t = useTranslations('b2b.notifications')
  const [open, setOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // ── Load unread count ───────────────────────────────────────────────────────

  const fetchUnread = useCallback(async () => {
    try {
      const res = await apiClient.getUnreadCount()
      setUnreadCount(res.count)
    } catch {
      // silent
    }
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(fetchUnread, 3000)
    const interval = setInterval(fetchUnread, 60_000)
    return () => {
      window.clearTimeout(timeout)
      clearInterval(interval)
    }
  }, [fetchUnread])

  // ── Load notifications when opening ────────────────────────────────────────

  const openDropdown = useCallback(async () => {
    setOpen(true)
    if (notifications.length === 0) {
      setLoading(true)
      try {
        const res = await apiClient.getNotifications({ limit: 10 })
        setNotifications(res.notifications)
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }
  }, [notifications.length])

  // ── Outside click ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // ── Actions ─────────────────────────────────────────────────────────────────

  const handleNotificationClick = async (item: NotificationItem) => {
    if (!item.read) {
      try {
        await apiClient.markNotificationRead(item.id)
        setNotifications((prev) => prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)))
        setUnreadCount((c) => Math.max(0, c - 1))
      } catch {
        // silent
      }
    }
    if (item.metadata?.deepLink) {
      setOpen(false)
    }
  }

  const handleMarkAllRead = async () => {
    try {
      await apiClient.markAllNotificationsRead()
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
      setUnreadCount(0)
    } catch {
      // silent
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div ref={containerRef} className="relative">
      {/* Bell button */}
      <button
        onClick={() => (open ? setOpen(false) : openDropdown())}
        className="relative p-2 sm:p-2.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center"
        aria-label={t('title')}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-[380px] max-w-[calc(100vw-2rem)] bg-white border border-gray-200 rounded-2xl shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-900">{t('title')}</span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium transition-colors"
              >
                <Check className="w-3 h-3" />
                {t('markAllRead')}
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[400px] overflow-y-auto">
            {loading ? (
              <div className="px-4 py-8 text-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500 mx-auto" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <BellOff className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">{t('noNotifications')}</p>
              </div>
            ) : (
              notifications.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleNotificationClick(item)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex items-start gap-3 border-b border-gray-50 last:border-0 ${
                    !item.read ? 'bg-primary-50/40' : ''
                  }`}
                >
                  {/* Dot */}
                  <span
                    className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${
                      !item.read ? 'bg-primary-500' : 'bg-gray-200'
                    }`}
                  />
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm leading-snug ${
                        !item.read ? 'font-medium text-gray-900' : 'text-gray-600'
                      }`}
                    >
                      {item.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">
                      {item.body}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">{timeAgo(item.createdAt)}</p>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-100">
            <Link
              href="/b2b/notifications"
              onClick={() => setOpen(false)}
              className="block text-center text-sm text-primary-600 hover:text-primary-700 font-medium py-3 transition-colors"
            >
              {t('viewAll')}
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
