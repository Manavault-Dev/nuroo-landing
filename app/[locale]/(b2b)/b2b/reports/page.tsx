'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { getCurrentUser, getIdToken } from '@/lib/b2b/authClient'
import { apiClient, type SpecialistProfile } from '@/lib/b2b/api'
import { BarChart3, Users, UserX, Loader2, TrendingUp, Target, BookOpen } from 'lucide-react'

type ReportData = Awaited<ReturnType<typeof apiClient.getReports>>

const REPORTS_TIMEOUT_MS = 15000

function ReportsSpinner() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 flex items-center justify-center min-h-[40vh]">
      <Loader2 className="w-10 h-10 animate-spin text-primary-600" />
    </div>
  )
}

function ReportsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations('b2b.pages.reports')
  const [profile, setProfile] = useState<SpecialistProfile | null>(null)
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [days, setDays] = useState(30)

  const orgIdFromUrl = searchParams.get('orgId') ?? ''
  const currentOrgId = orgIdFromUrl || profile?.organizations?.[0]?.orgId || undefined
  const currentOrg =
    profile?.organizations?.find((org) => org.orgId === currentOrgId) || profile?.organizations?.[0]

  useEffect(() => {
    let cancelled = false

    async function load() {
      const user = getCurrentUser()
      if (!user) {
        setLoading(false)
        router.push('/b2b/login')
        return
      }

      let idToken: string | null = null
      try {
        idToken = await getIdToken()
      } catch {
        if (!cancelled) setLoading(false)
        router.push('/b2b/login')
        return
      }
      if (!idToken) {
        setLoading(false)
        router.push('/b2b/login')
        return
      }

      apiClient.setToken(idToken)

      let profileData: SpecialistProfile
      try {
        profileData = await apiClient.getMe()
      } catch {
        if (!cancelled) setLoading(false)
        router.push('/b2b/login')
        return
      }

      if (!cancelled) setProfile(profileData)

      const orgId = orgIdFromUrl || profileData.organizations?.[0]?.orgId
      if (!orgId) {
        if (!cancelled) {
          setData(null)
          setLoading(false)
        }
        return
      }

      if (!cancelled) setError('')

      const timeoutId = setTimeout(() => {
        if (!cancelled) {
          setError('Request timed out. Check your connection and try again.')
          setLoading(false)
        }
      }, REPORTS_TIMEOUT_MS)

      try {
        const res = await apiClient.getReports(orgId, days)
        clearTimeout(timeoutId)
        if (cancelled) return
        if (res.ok) {
          setData(res)
        } else {
          setError('Failed to load reports')
        }
      } catch (err) {
        clearTimeout(timeoutId)
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load reports')
          setData(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [router, days, orgIdFromUrl])

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-10 h-10 animate-spin text-primary-600" />
      </div>
    )
  }

  if (!profile?.organizations?.length) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg">
          {t('noOrg')}
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <BarChart3 className="w-7 h-7 text-primary-600" />
          {t('title')}
        </h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">{t('period')}</span>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value={7}>7 {t('days')}</option>
            <option value={30}>30 {t('days')}</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {data && (
        <div className="space-y-8">
          <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Target className="w-5 h-5 text-primary-600" />
              {t('childCompletion')}
            </h2>
            {data.childCompletion.length === 0 ? (
              <p className="text-gray-500">{t('noChildren')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-gray-600">
                      <th className="py-2 pr-4">{t('child')}</th>
                      <th className="py-2 pr-4">{t('parent')}</th>
                      <th className="py-2 pr-4 text-right">{t('tasks')}</th>
                      <th className="py-2 pr-4 text-right">{t('percent')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.childCompletion.map((row) => (
                      <tr key={row.childId} className="border-b border-gray-100">
                        <td className="py-3 font-medium text-gray-900">{row.childName}</td>
                        <td className="py-3 text-gray-600">{row.parentName ?? '—'}</td>
                        <td className="py-3 text-right text-gray-600">
                          {row.completedTasks} / {row.totalTasks}
                        </td>
                        <td className="py-3 text-right">
                          <span
                            className={
                              row.percent >= 70
                                ? 'text-green-600 font-medium'
                                : row.percent >= 40
                                  ? 'text-amber-600'
                                  : 'text-red-600 font-medium'
                            }
                          >
                            {row.percent}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-primary-600" />
              {t('groupCompletion')}
            </h2>
            {data.groupCompletion.length === 0 ? (
              <div className="text-gray-500 space-y-1">
                <p>{t('noGroups')}</p>
                <p className="text-sm">{t('noGroupsHint')}</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {data.groupCompletion.map((g) => (
                  <div
                    key={g.ownerId ? `${g.ownerId}_${g.groupId}` : g.groupId}
                    className="border border-gray-200 rounded-lg p-4 bg-gray-50/50"
                  >
                    <div className="font-medium text-gray-900">{g.groupName}</div>
                    {g.specialistName && (
                      <div className="text-xs text-gray-500 mt-0.5">
                        {t('specialist')}: {g.specialistName}
                      </div>
                    )}
                    <div className="text-sm text-gray-600 mt-1">
                      {t('childrenCount')}: {g.childCount}
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-sm text-gray-600">
                        {g.completedTasks} / {g.totalTasks} {t('tasks')}
                      </span>
                      <span
                        className={
                          g.percent >= 70
                            ? 'text-green-600 font-semibold'
                            : g.percent >= 40
                              ? 'text-amber-600'
                              : 'text-red-600 font-semibold'
                        }
                      >
                        {g.percent}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary-600" />
              {t('topParents')}
            </h2>
            {data.topParents.length === 0 ? (
              <p className="text-gray-500">{t('noActivity')}</p>
            ) : (
              <ul className="space-y-3">
                {data.topParents.map((p, i) => (
                  <li
                    key={p.parentUserId}
                    className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold">
                        {i + 1}
                      </span>
                      <span className="font-medium text-gray-900">{p.parentName}</span>
                    </span>
                    <span className="text-sm text-gray-600">
                      {t('completed')}: {p.completedLast7} (7d) / {p.completedLast30} (30d)
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <UserX className="w-5 h-5 text-amber-600" />
              {t('lowActivity')}
            </h2>
            {data.lowActivity.length === 0 ? (
              <p className="text-green-600">{t('noLowActivity')}</p>
            ) : (
              <>
                <p className="text-sm text-gray-600 mb-3">{t('lowActivityDesc')}</p>
                <ul className="space-y-2">
                  {data.lowActivity.map((p) => (
                    <li
                      key={p.parentUserId}
                      className="flex items-center justify-between py-2 px-3 rounded-lg bg-amber-50 border border-amber-100"
                    >
                      <span className="font-medium text-gray-900">{p.parentName}</span>
                      <span className="text-sm text-amber-700">
                        {t('completed')}: 0 (7d) / {p.completedLast30} (30d)
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          {data.contentActivity && (
            <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-primary-600" />
                {t('contentActivity')}
              </h2>
              <div className="grid gap-4 sm:grid-cols-3 mb-4">
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-primary-600">
                    {data.contentActivity.totalCompleted}
                  </div>
                  <div className="text-sm text-gray-600">{t('totalCompleted')}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {data.contentActivity.completedLast7Days}
                  </div>
                  <div className="text-sm text-gray-600">{t('last7Days')}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {data.contentActivity.completedLast30Days}
                  </div>
                  <div className="text-sm text-gray-600">{t('last30Days')}</div>
                </div>
              </div>
              {data.contentActivity.byChild.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">{t('byChild')}</h3>
                  <div className="space-y-2">
                    {data.contentActivity.byChild.slice(0, 10).map((item) => (
                      <div
                        key={item.childId}
                        className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50"
                      >
                        <span className="text-sm text-gray-700">{item.childId}</span>
                        <span className="text-sm font-medium text-primary-600">
                          {item.count} {t('tasks')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  )
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<ReportsSpinner />}>
      <ReportsContent />
    </Suspense>
  )
}
