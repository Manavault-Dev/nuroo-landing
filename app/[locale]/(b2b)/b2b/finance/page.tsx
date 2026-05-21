'use client'

import { useEffect, useState, useCallback } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { usePageAuth } from '@/lib/b2b/usePageAuth'
import { apiClient, type AttendanceRecord, type FeeRecord } from '@/lib/b2b/api'
import { PageSpinner, Spinner } from '@/components/ui/Spinner'
import {
  Wallet,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Save,
  AlertTriangle,
  CalendarDays,
  TrendingUp,
  ChevronDown,
} from 'lucide-react'

type Tab = 'attendance' | 'fees'
type AttendanceStatus = 'present' | 'absent' | 'late' | null
type FeeStatus = 'paid' | 'pending' | 'overdue'
type BillingFilter = 'all' | 'overdue' | 'due_soon' | 'upcoming' | 'paid'

const todayDate = () => new Date().toISOString().split('T')[0]
const currentMonth = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}
const resolveActiveTab = (tab: string | null, isAdmin: boolean): Tab => {
  if (tab === 'attendance') return 'attendance'
  if (tab === 'fees' && isAdmin) return 'fees'
  return 'attendance'
}

export default function FinancePage() {
  const t = useTranslations('b2b.pages.finance')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { orgId, isAdmin, isLoading } = usePageAuth()
  const activeTab = resolveActiveTab(searchParams.get('tab'), isAdmin)
  const visibleTabs = (isAdmin ? ['attendance', 'fees'] : ['attendance']) as Tab[]

  const [attendanceDate, setAttendanceDate] = useState(todayDate)
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([])
  const [loadingAttendance, setLoadingAttendance] = useState(false)
  const [savingAttendance, setSavingAttendance] = useState<string | null>(null)
  const [pendingAttendance, setPendingAttendance] = useState<
    Map<string, { status: AttendanceStatus; note: string }>
  >(new Map())

  const [feesMonth, setFeesMonth] = useState(currentMonth)
  const [feeRecords, setFeeRecords] = useState<FeeRecord[]>([])
  const [loadingFees, setLoadingFees] = useState(false)
  const [savingFee, setSavingFee] = useState<string | null>(null)
  const [pendingFees, setPendingFees] = useState<
    Map<string, { amount: number; status: FeeStatus; note: string }>
  >(new Map())
  const [billingFilter, setBillingFilter] = useState<BillingFilter>('all')
  const [saveError, setSaveError] = useState<string | null>(null)

  const loadAttendance = useCallback(async (oid: string, date: string) => {
    setLoadingAttendance(true)
    try {
      const res = await apiClient.getAttendance(oid, date)
      setAttendanceRecords(res.records ?? [])
      const next = new Map<string, { status: AttendanceStatus; note: string }>()
      for (const r of res.records ?? []) {
        next.set(r.childId, { status: r.status, note: r.note ?? '' })
      }
      setPendingAttendance(next)
    } catch {
      setAttendanceRecords([])
    } finally {
      setLoadingAttendance(false)
    }
  }, [])

  const loadFees = useCallback(async (oid: string, month: string) => {
    setLoadingFees(true)
    try {
      const res = await apiClient.getMonthlyFees(oid, month)
      setFeeRecords(res.records ?? [])
      const next = new Map<string, { amount: number; status: FeeStatus; note: string }>()
      for (const r of res.records ?? []) {
        next.set(r.childId, { amount: r.amount, status: r.status, note: r.note ?? '' })
      }
      setPendingFees(next)
    } catch {
      setFeeRecords([])
    } finally {
      setLoadingFees(false)
    }
  }, [])

  useEffect(() => {
    if (orgId && activeTab === 'attendance') loadAttendance(orgId, attendanceDate)
  }, [orgId, activeTab, attendanceDate, loadAttendance])

  useEffect(() => {
    if (orgId && activeTab === 'fees') loadFees(orgId, feesMonth)
  }, [orgId, activeTab, feesMonth, loadFees])

  const saveAttendance = async (record: AttendanceRecord) => {
    if (!orgId) return
    const pending = pendingAttendance.get(record.childId)
    if (!pending?.status) return
    setSavingAttendance(record.childId)
    setSaveError(null)
    try {
      await apiClient.saveAttendance(orgId, {
        childId: record.childId,
        childName: record.childName,
        date: attendanceDate,
        status: pending.status,
        note: pending.note || undefined,
      })
      await loadAttendance(orgId, attendanceDate)
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to save attendance'
      setSaveError(msg)
    } finally {
      setSavingAttendance(null)
    }
  }

  const saveFee = async (record: FeeRecord) => {
    if (!orgId || !isAdmin) return
    const pending = pendingFees.get(record.childId)
    if (!pending) return
    setSavingFee(record.childId)
    try {
      await apiClient.saveFee(orgId, {
        childId: record.childId,
        childName: record.childName,
        month: feesMonth,
        amount: pending.amount,
        status: pending.status,
        note: pending.note || undefined,
      })
      await loadFees(orgId, feesMonth)
    } finally {
      setSavingFee(null)
    }
  }

  const setAttendancePending = (childId: string, field: 'status' | 'note', value: string) => {
    setPendingAttendance((prev) => {
      const next = new Map(prev)
      const cur = next.get(childId) ?? { status: null, note: '' }
      next.set(childId, {
        ...cur,
        [field]: field === 'status' && value === '' ? null : value,
      })
      return next
    })
  }

  const setFeePending = (childId: string, field: 'amount' | 'status' | 'note', value: string) => {
    setPendingFees((prev) => {
      const next = new Map(prev)
      const cur = next.get(childId) ?? { amount: 0, status: 'pending' as FeeStatus, note: '' }
      next.set(childId, {
        ...cur,
        [field]: field === 'amount' ? Number(value) : value,
      })
      return next
    })
  }

  function AttendanceBadge({ status }: { status: AttendanceStatus }) {
    if (!status)
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
          <AlertCircle className="w-3 h-3" />
          {t('notMarked')}
        </span>
      )
    const cfg = {
      present: {
        cls: 'bg-green-100 text-green-700',
        icon: <CheckCircle className="w-3 h-3" />,
        label: t('present'),
      },
      absent: {
        cls: 'bg-red-100 text-red-700',
        icon: <XCircle className="w-3 h-3" />,
        label: t('absent'),
      },
      late: {
        cls: 'bg-yellow-100 text-yellow-700',
        icon: <Clock className="w-3 h-3" />,
        label: t('late'),
      },
    }[status]
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}
      >
        {cfg.icon}
        {cfg.label}
      </span>
    )
  }

  function DueBadge({ record }: { record: FeeRecord }) {
    const bs = record.billingStatus
    if (!bs || bs === 'paid') return null
    const cfg = {
      overdue: { cls: 'bg-red-50 text-red-700 border border-red-200', label: t('overdue') },
      due_soon: {
        cls: 'bg-orange-50 text-orange-700 border border-orange-200',
        label: t('daysUntilShort', { days: record.daysUntilDue }),
      },
      upcoming: {
        cls: 'bg-blue-50 text-blue-600 border border-blue-200',
        label: record.dueDate
          ? `${t('dueDatePrefix')} ${new Date(record.dueDate + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`
          : '',
      },
    }[bs]
    if (!cfg) return null
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}
      >
        <CalendarDays className="w-3 h-3" />
        {cfg.label}
      </span>
    )
  }

  function FeeBadge({ status }: { status: FeeStatus }) {
    const cfg = {
      paid: { cls: 'bg-green-100 text-green-700', label: t('paid') },
      pending: { cls: 'bg-yellow-100 text-yellow-700', label: t('pendingLabel') },
      overdue: { cls: 'bg-red-100 text-red-700', label: t('overdue') },
    }[status]
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}
      >
        {cfg.label}
      </span>
    )
  }

  const paidCount = feeRecords.filter((r) => r.status === 'paid').length
  const overdueCount = feeRecords.filter((r) => r.billingStatus === 'overdue').length
  const dueSoonCount = feeRecords.filter((r) => r.billingStatus === 'due_soon').length
  const totalAmount = feeRecords.reduce((sum, r) => sum + (r.amount || 0), 0)
  const paidAmount = feeRecords
    .filter((r) => r.status === 'paid')
    .reduce((sum, r) => sum + (r.amount || 0), 0)

  const filteredFeeRecords =
    billingFilter === 'all'
      ? feeRecords
      : feeRecords.filter((r) => {
          if (billingFilter === 'paid') return r.status === 'paid'
          return r.billingStatus === billingFilter
        })

  const handleTabChange = (tab: Tab) => {
    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.set('tab', tab)
    router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false })
  }

  if (isLoading) return <PageSpinner />

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex items-center gap-3">
        {isAdmin ? (
          <Wallet className="w-7 h-7 text-primary-600" />
        ) : (
          <Users className="w-7 h-7 text-primary-600" />
        )}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isAdmin ? t('title') : t('attendance')}
          </h1>
          <p className="text-sm text-gray-500">
            {isAdmin ? t('subtitle') : t('attendanceSubtitle')}
          </p>
        </div>
      </div>

      {visibleTabs.length > 1 && (
        <div className="flex border-b border-gray-200 mb-6">
          {visibleTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'attendance' ? (
                <Users className="w-4 h-4" />
              ) : (
                <Wallet className="w-4 h-4" />
              )}
              {t(tab)}
            </button>
          ))}
        </div>
      )}

      {activeTab === 'attendance' && (
        <div>
          {saveError && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{saveError}</span>
              <button
                onClick={() => setSaveError(null)}
                className="ml-auto text-red-400 hover:text-red-600"
              >
                ×
              </button>
            </div>
          )}
          <div className="flex items-center gap-3 mb-6">
            <label className="text-sm font-medium text-gray-700">{t('date')}:</label>
            <input
              type="date"
              value={attendanceDate}
              onChange={(e) => setAttendanceDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
          </div>

          {loadingAttendance ? (
            <div className="flex justify-center py-16">
              <Spinner size="lg" />
            </div>
          ) : attendanceRecords.length === 0 ? (
            <EmptyState
              icon={<Users className="w-12 h-12 text-gray-300" />}
              label={t('noChildren')}
            />
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">
                        {t('child')}
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">
                        {t('status')}
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">
                        {t('note')}
                      </th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {attendanceRecords.map((record) => {
                      const pending = pendingAttendance.get(record.childId) ?? {
                        status: record.status,
                        note: record.note ?? '',
                      }
                      const isSaving = savingAttendance === record.childId
                      return (
                        <tr key={record.childId} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-gray-900">
                            {record.childName}
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={pending.status ?? ''}
                              onChange={(e) =>
                                setAttendancePending(record.childId, 'status', e.target.value)
                              }
                              className="border border-gray-300 rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                            >
                              <option value="">{t('notMarked')}</option>
                              <option value="present">{t('present')}</option>
                              <option value="absent">{t('absent')}</option>
                              <option value="late">{t('late')}</option>
                            </select>
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              value={pending.note}
                              onChange={(e) =>
                                setAttendancePending(record.childId, 'note', e.target.value)
                              }
                              className="w-full border border-gray-300 rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                              placeholder={t('note')}
                            />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => saveAttendance(record)}
                              disabled={isSaving || !pending.status}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white rounded-lg text-xs font-medium hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                              {isSaving ? (
                                <Spinner size="sm" className="!text-white" />
                              ) : (
                                <Save className="w-3 h-3" />
                              )}
                              {t('save')}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex flex-wrap gap-4 text-xs text-gray-600">
                {(
                  [
                    { status: 'present', cls: 'text-green-600', label: t('present') },
                    { status: 'absent', cls: 'text-red-600', label: t('absent') },
                    { status: 'late', cls: 'text-yellow-600', label: t('late') },
                  ] as const
                ).map(({ status, cls, label }) => (
                  <span key={status}>
                    <span className={`font-semibold ${cls}`}>
                      {attendanceRecords.filter((r) => r.status === status).length}
                    </span>{' '}
                    {label}
                  </span>
                ))}
                <span>
                  <span className="font-semibold text-gray-500">
                    {attendanceRecords.filter((r) => !r.status).length}
                  </span>{' '}
                  {t('notMarked')}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'fees' && (
        <div>
          {feeRecords.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <SummaryCard
                icon={<Users className="w-5 h-5 text-gray-500" />}
                value={feeRecords.length}
                label={t('totalChildren')}
                valueClass="text-gray-900"
              />
              <SummaryCard
                icon={<CheckCircle className="w-5 h-5 text-green-500" />}
                value={paidCount}
                label={`${t('paidCount')} · ${paidAmount.toLocaleString()} KGS`}
                valueClass="text-green-600"
              />
              <SummaryCard
                icon={<AlertTriangle className="w-5 h-5 text-red-500" />}
                value={overdueCount}
                label={t('overdueCount')}
                valueClass="text-red-600"
              />
              <SummaryCard
                icon={<TrendingUp className="w-5 h-5 text-primary-500" />}
                value={`${totalAmount.toLocaleString()}`}
                label={t('totalAmount')}
                valueClass="text-primary-600"
              />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 mb-6">
            <label className="text-sm font-medium text-gray-700">{t('month')}:</label>
            <input
              type="month"
              value={feesMonth}
              onChange={(e) => setFeesMonth(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />

            {feeRecords.length > 0 && (
              <div className="relative ml-auto">
                <select
                  value={billingFilter}
                  onChange={(e) => setBillingFilter(e.target.value as BillingFilter)}
                  className="appearance-none border border-gray-300 rounded-lg pl-3 pr-8 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none bg-white"
                >
                  <option value="all">{t('filterAll')}</option>
                  <option value="overdue">{t('filterOverdue', { count: overdueCount })}</option>
                  <option value="due_soon">{t('filterDueSoon', { count: dueSoonCount })}</option>
                  <option value="upcoming">{t('filterUpcoming')}</option>
                  <option value="paid">{t('filterPaid', { count: paidCount })}</option>
                </select>
                <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            )}
          </div>

          {loadingFees ? (
            <div className="flex justify-center py-16">
              <Spinner size="lg" />
            </div>
          ) : filteredFeeRecords.length === 0 ? (
            <EmptyState
              icon={<Wallet className="w-12 h-12 text-gray-300" />}
              label={feeRecords.length === 0 ? t('noChildren') : t('noFilterResults')}
            />
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">
                        {t('child')}
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">
                        {t('amount')} (KGS)
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">
                        {t('status')}
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">
                        {t('paymentDate')}
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">
                        {t('note')}
                      </th>
                      {isAdmin && <th className="px-4 py-3" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredFeeRecords.map((record) => {
                      const pending = pendingFees.get(record.childId) ?? {
                        amount: record.amount,
                        status: record.status,
                        note: record.note ?? '',
                      }
                      const isSaving = savingFee === record.childId
                      const rowCls =
                        record.billingStatus === 'overdue'
                          ? 'bg-red-50/40'
                          : record.billingStatus === 'due_soon'
                            ? 'bg-orange-50/40'
                            : ''
                      return (
                        <tr
                          key={record.childId}
                          className={`hover:bg-gray-50 transition-colors ${rowCls}`}
                        >
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900">{record.childName}</div>
                            <DueBadge record={record} />
                          </td>
                          <td className="px-4 py-3">
                            {isAdmin ? (
                              <input
                                type="number"
                                min="0"
                                value={pending.amount}
                                onChange={(e) =>
                                  setFeePending(record.childId, 'amount', e.target.value)
                                }
                                className="w-28 border border-gray-300 rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                              />
                            ) : (
                              <span className="font-medium">
                                {record.amount.toLocaleString()} {record.currency}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {isAdmin ? (
                              <select
                                value={pending.status}
                                onChange={(e) =>
                                  setFeePending(record.childId, 'status', e.target.value)
                                }
                                className="border border-gray-300 rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                              >
                                <option value="paid">{t('paid')}</option>
                                <option value="pending">{t('pending')}</option>
                                <option value="overdue">{t('overdue')}</option>
                              </select>
                            ) : (
                              <FeeBadge status={record.status} />
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-500">
                            {record.paidAt
                              ? new Date(record.paidAt).toLocaleDateString('ru-RU', {
                                  day: 'numeric',
                                  month: 'short',
                                })
                              : record.dueDate
                                ? new Date(record.dueDate + 'T00:00:00').toLocaleDateString(
                                    'ru-RU',
                                    { day: 'numeric', month: 'short' }
                                  )
                                : '—'}
                          </td>
                          <td className="px-4 py-3">
                            {isAdmin ? (
                              <input
                                type="text"
                                value={pending.note}
                                onChange={(e) =>
                                  setFeePending(record.childId, 'note', e.target.value)
                                }
                                className="w-full border border-gray-300 rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                                placeholder={t('note')}
                              />
                            ) : (
                              <span className="text-gray-500">{record.note ?? '—'}</span>
                            )}
                          </td>
                          {isAdmin && (
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => saveFee(record)}
                                disabled={isSaving}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white rounded-lg text-xs font-medium hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                              >
                                {isSaving ? (
                                  <Spinner size="sm" className="!text-white" />
                                ) : (
                                  <Save className="w-3 h-3" />
                                )}
                                {t('save')}
                              </button>
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function SummaryCard({
  icon,
  value,
  label,
  valueClass,
}: {
  icon: React.ReactNode
  value: number | string
  label: string
  valueClass: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">{icon}</div>
      <p className={`text-2xl font-bold ${valueClass}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  )
}

function EmptyState({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="bg-gray-50 rounded-xl p-16 text-center">
      <div className="flex justify-center mb-3">{icon}</div>
      <p className="text-gray-500">{label}</p>
    </div>
  )
}
