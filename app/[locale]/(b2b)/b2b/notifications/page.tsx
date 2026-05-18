'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Bell, ChevronRight, Settings } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { usePageAuth } from '@/lib/b2b/usePageAuth'
import { apiClient, type NotificationItem } from '@/lib/b2b/api'
import { PageSpinner } from '@/components/ui/Spinner'

function timeAgo(date: Date | string | null): string {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return ''
  const diff = Date.now() - d.getTime()
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  return `${Math.floor(hr / 24)}d ago`
}

type Tab = 'all' | 'unread'

export default function NotificationsPage() {
  const t = useTranslations('b2b.notifications')
  const { isLoading } = usePageAuth()

  const [tab, setTab] = useState<Tab>('all')
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loadingList, setLoadingList] = useState(false)

  const fetchNotifications = useCallback(async (unreadOnly: boolean) => {
    setLoadingList(true)
    try {
      const res = await apiClient.getNotifications({ limit: 50, unreadOnly })
      setNotifications(res.notifications ?? [])
    } catch {
      setNotifications([])
    } finally {
      setLoadingList(false)
    }
  }, [])

  useEffect(() => {
    fetchNotifications(tab === 'unread')
  }, [tab, fetchNotifications])

  const handleClick = async (item: NotificationItem) => {
    if (!item.read) {
      try {
        await apiClient.markNotificationRead(item.id)
        setNotifications((prev) => prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)))
      } catch {
        // silent
      }
    }
    if (item.metadata?.deepLink) {
      window.location.href = item.metadata.deepLink
    }
  }

  const handleMarkAllRead = async () => {
    try {
      await apiClient.markAllNotificationsRead()
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    } catch {
      // silent
    }
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  if (isLoading) return <PageSpinner />

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Page header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Bell className="w-7 h-7 text-primary-600" />
            {t('title')}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium transition-colors"
            >
              {t('markAllRead')}
            </button>
          )}
          <Link
            href="/b2b/notifications/preferences"
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            <Settings className="w-4 h-4" />
            {t('preferences')}
          </Link>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {(['all', 'unread'] as Tab[]).map((tabKey) => (
          <button
            key={tabKey}
            type="button"
            onClick={() => setTab(tabKey)}
            className={[
              'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === tabKey
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700',
            ].join(' ')}
          >
            {t(tabKey)}
          </button>
        ))}
      </div>

      {/* List */}
      {loadingList ? (
        <div className="flex items-center justify-center py-16 text-sm text-gray-400">
          {t('loading')}
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Bell className="w-12 h-12 text-gray-300" />
          <p className="text-gray-500 text-sm">
            {tab === 'unread' ? t('noUnread') : t('noNotifications')}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
          {notifications.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleClick(item)}
              className={[
                'w-full text-left px-5 py-4 flex items-start gap-4 hover:bg-gray-50 transition-colors',
                !item.read ? 'bg-primary-50/30' : '',
              ].join(' ')}
            >
              <span
                className={[
                  'mt-2 w-2.5 h-2.5 rounded-full flex-shrink-0',
                  item.read ? 'bg-gray-300' : 'bg-primary-500',
                ].join(' ')}
              />
              <div className="flex-1 min-w-0">
                <p
                  className={[
                    'text-sm',
                    item.read ? 'font-normal text-gray-600' : 'font-semibold text-gray-900',
                  ].join(' ')}
                >
                  {item.title}
                </p>
                {item.body && (
                  <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{item.body}</p>
                )}
                {item.createdAt && (
                  <p className="text-xs text-gray-400 mt-1">{timeAgo(item.createdAt)}</p>
                )}
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0 mt-1" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
