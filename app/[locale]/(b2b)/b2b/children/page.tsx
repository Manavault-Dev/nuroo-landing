'use client'

import { useEffect, useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import { useSearchParams } from 'next/navigation'
import { Link } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { getCurrentUser, getIdToken } from '@/lib/b2b/authClient'
import { apiClient, type ChildSummary, type SpecialistProfile } from '@/lib/b2b/api'
import { Users, ChevronRight, CheckCircle2, Clock, Search, Trash2, Loader2 } from 'lucide-react'
import { useAlert } from '@/components/ui/AlertDialog'

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function daysSince(dateStr?: string): number | null {
  if (!dateStr) return null
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

type Status = 'active' | 'inactive' | 'new'
function getStatus(child: ChildSummary): Status {
  const d = daysSince(child.lastActiveDate)
  if (d === null) return 'new'
  if (d <= 7) return 'active'
  return 'inactive'
}

function StatusPill({ status, label }: { status: Status; label: string }) {
  const map = {
    active: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    inactive: 'bg-amber-50 text-amber-700 ring-amber-200',
    new: 'bg-sky-50 text-sky-700 ring-sky-200',
  }
  const dots = { active: 'bg-emerald-500', inactive: 'bg-amber-400', new: 'bg-sky-400' }
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ring-1 ${map[status]}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dots[status]}`} />
      {label}
    </span>
  )
}

export default function ChildrenPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations('b2b.pages.children')
  const [profile, setProfile] = useState<SpecialistProfile | null>(null)
  const [children, setChildren] = useState<ChildSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [removingChildId, setRemovingChildId] = useState<string | null>(null)

  const { alert, confirm } = useAlert()

  const orgId = searchParams.get('orgId') || profile?.organizations?.[0]?.orgId || undefined

  useEffect(() => {
    const load = async () => {
      const user = getCurrentUser()
      if (!user) {
        router.push('/b2b/login')
        return
      }
      try {
        const idToken = await getIdToken()
        if (!idToken) {
          router.push('/b2b/login')
          return
        }
        apiClient.setToken(idToken)
        const profileData = await apiClient.getMe()
        setProfile(profileData)
        const effectiveOrgId = searchParams.get('orgId') || profileData.organizations?.[0]?.orgId
        if (!effectiveOrgId) {
          router.push('/b2b/onboarding')
          return
        }
        const childrenData = await apiClient.getChildren(effectiveOrgId)
        setChildren(childrenData)
      } catch {
        // fail silently
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router, searchParams])

  const handleRemove = async (childId: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const ok = await confirm(t('removeConfirm'))
    if (!ok) return
    setRemovingChildId(childId)
    try {
      if (!orgId) return
      const idToken = await getIdToken()
      if (!idToken) return
      apiClient.setToken(idToken)
      await apiClient.removeChild(orgId, childId)
      setChildren((prev) => prev.filter((c) => c.id !== childId))
    } catch (err) {
      alert(err instanceof Error ? err.message : t('removeFailed'), { type: 'error' })
    } finally {
      setRemovingChildId(null)
    }
  }

  if (loading) {
    return (
      <div className="p-6 lg:p-8 space-y-3 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-32" />
        <div className="h-10 bg-gray-100 rounded-xl w-full" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 bg-gray-100 rounded-xl" />
        ))}
      </div>
    )
  }

  const filtered = query.trim()
    ? children.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))
    : children

  const activeCount = children.filter((c) => (daysSince(c.lastActiveDate) ?? 99) <= 7).length
  const inactiveCount = children.filter((c) => getStatus(c) === 'inactive').length
  const statusLabels: Record<Status, string> = {
    active: t('statusActive'),
    inactive: t('statusInactive'),
    new: t('statusNew'),
  }

  return (
    <div className="p-6 lg:p-8 w-full">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{t('title')}</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {children.length} {children.length === 1 ? t('childAssigned') : t('childrenAssigned')}
          </p>
        </div>
      </div>

      {/* Stats row */}
      {children.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            {
              label: t('statTotal'),
              value: children.length,
              icon: Users,
              color: 'text-gray-500',
            },
            {
              label: t('statActiveThisWeek'),
              value: activeCount,
              icon: CheckCircle2,
              color: 'text-emerald-500',
            },
            {
              label: t('statNeedsAttention'),
              value: inactiveCount,
              icon: Clock,
              color: 'text-amber-500',
            },
          ].map((s) => (
            <div
              key={s.label}
              className="bg-white border border-gray-100 rounded-xl p-4 flex items-center gap-3"
            >
              <s.icon className={`w-4 h-4 ${s.color} shrink-0`} />
              <div>
                <p className="text-lg font-bold text-gray-900 leading-none">{s.value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      {children.length > 0 && (
        <div className="relative mb-4">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 placeholder:text-gray-400"
          />
        </div>
      )}

      {/* Column headers */}
      {children.length > 0 && (
        <div className="hidden sm:flex items-center gap-3 px-4 mb-1">
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wide flex-1 min-w-0">
            {t('columnStudent')}
          </span>
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wide w-16 text-center">
            {t('columnStatus')}
          </span>
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wide w-16 text-right">
            {t('columnTasks')}
          </span>
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wide w-20 text-right">
            {t('columnLastActive')}
          </span>
          <span className="w-10 shrink-0" />
          <span className="w-4 shrink-0" />
        </div>
      )}

      {/* List */}
      {children.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-xl p-16 text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Users className="w-6 h-6 text-gray-400" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900 mb-1">{t('noChildrenAssigned')}</h3>
          <p className="text-sm text-gray-400 max-w-xs mx-auto">{t('assignedToOrg')}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-xl p-12 text-center">
          <p className="text-sm text-gray-500">{t('noStudentsMatch', { query })}</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden divide-y divide-gray-50">
          {filtered.map((child) => {
            const status = getStatus(child)
            const days = daysSince(child.lastActiveDate)
            return (
              <div
                key={child.id}
                className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors group"
              >
                <Link
                  href={`/b2b/children/${child.id}${orgId ? `?orgId=${orgId}` : ''}`}
                  className="flex items-center gap-3 flex-1 min-w-0"
                >
                  <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 text-sm font-semibold flex items-center justify-center shrink-0">
                    {getInitials(child.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {child.name}
                      </span>
                      {child.age !== undefined && (
                        <span className="text-xs text-gray-400 shrink-0">{child.age}y</span>
                      )}
                    </div>
                    <div className="sm:hidden mt-1">
                      <StatusPill status={status} label={statusLabels[status]} />
                    </div>
                  </div>

                  <div className="hidden sm:flex items-center gap-4 shrink-0">
                    <div className="w-16 flex justify-center">
                      <StatusPill status={status} label={statusLabels[status]} />
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-500 w-16 justify-end">
                      <CheckCircle2 className="w-3.5 h-3.5 text-gray-300" />
                      {child.completedTasksCount}
                    </div>
                    <span className="text-xs text-gray-400 w-20 text-right">
                      {days === null
                        ? t('dash')
                        : days === 0
                          ? t('todayLabel')
                          : t('lastActiveDaysAgo', { days })}
                    </span>
                  </div>

                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-400 transition-colors shrink-0" />
                </Link>

                <button
                  onClick={(e) => handleRemove(child.id, e)}
                  disabled={removingChildId === child.id}
                  className="shrink-0 p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
                  title={t('removeChild')}
                >
                  {removingChildId === child.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
