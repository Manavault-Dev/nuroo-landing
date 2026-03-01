'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { usePageAuth } from '@/lib/b2b/usePageAuth'
import { apiClient, type AttendanceRecord, type FeeRecord } from '@/lib/b2b/api'
import { PageSpinner, Spinner } from '@/components/ui/Spinner'
import { Wallet, Users, CheckCircle, XCircle, Clock, AlertCircle, Save } from 'lucide-react'

type Tab = 'attendance' | 'fees'
type AttendanceStatus = 'present' | 'absent' | 'late' | null
type FeeStatus = 'paid' | 'pending' | 'overdue'

const todayDate = () => new Date().toISOString().split('T')[0]
const currentMonth = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export default function FinancePage() {
  const t = useTranslations('b2b.pages.finance')
  const { orgId, isAdmin, isLoading } = usePageAuth()

  const [activeTab, setActiveTab] = useState<Tab>('attendance')

  // Attendance
  const [attendanceDate, setAttendanceDate] = useState(todayDate)
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([])
  const [loadingAttendance, setLoadingAttendance] = useState(false)
  const [savingAttendance, setSavingAttendance] = useState<string | null>(null)
  const [pendingAttendance, setPendingAttendance] = useState<
    Map<string, { status: AttendanceStatus; note: string }>
  >(new Map())

  // Fees
  const [feesMonth, setFeesMonth] = useState(currentMonth)
  const [feeRecords, setFeeRecords] = useState<FeeRecord[]>([])
  const [loadingFees, setLoadingFees] = useState(false)
  const [savingFee, setSavingFee] = useState<string | null>(null)
  const [pendingFees, setPendingFees] = useState<
    Map<string, { amount: number; status: FeeStatus; note: string }>
  >(new Map())

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
    if (!orgId || !isAdmin) return
    const pending = pendingAttendance.get(record.childId)
    if (!pending?.status) return
    setSavingAttendance(record.childId)
    try {
      await apiClient.saveAttendance(orgId, {
        childId: record.childId,
        childName: record.childName,
        date: attendanceDate,
        status: pending.status,
        note: pending.note || undefined,
      })
      await loadAttendance(orgId, attendanceDate)
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

  // -- Sub-components (inline, no prop drilling needed) --

  function AttendanceBadge({ status }: { status: AttendanceStatus }) {
    if (!status)
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
          <AlertCircle className="w-3 h-3" />
          {t('notMarked')}
        </span>
      )
    const cfg = {
      present: { cls: 'bg-green-100 text-green-700', icon: <CheckCircle className="w-3 h-3" />, label: t('present') },
      absent:  { cls: 'bg-red-100 text-red-700',   icon: <XCircle className="w-3 h-3" />,    label: t('absent')  },
      late:    { cls: 'bg-yellow-100 text-yellow-700', icon: <Clock className="w-3 h-3" />,  label: t('late')    },
    }[status]
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>
        {cfg.icon}{cfg.label}
      </span>
    )
  }

  function FeeBadge({ status }: { status: FeeStatus }) {
    const cfg = {
      paid:    { cls: 'bg-green-100 text-green-700',   label: t('paid')    },
      pending: { cls: 'bg-yellow-100 text-yellow-700', label: t('pending') },
      overdue: { cls: 'bg-red-100 text-red-700',       label: t('overdue') },
    }[status]
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>
        {cfg.label}
      </span>
    )
  }

  const paidCount    = feeRecords.filter((r) => r.status === 'paid').length
  const pendingCount = feeRecords.filter((r) => r.status !== 'paid').length

  if (isLoading) return <PageSpinner />

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Wallet className="w-7 h-7 text-primary-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
          <p className="text-sm text-gray-500">{t('subtitle')}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        {(['attendance', 'fees'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'attendance' ? <Users className="w-4 h-4" /> : <Wallet className="w-4 h-4" />}
            {t(tab)}
          </button>
        ))}
      </div>

      {/* ── Attendance Tab ── */}
      {activeTab === 'attendance' && (
        <div>
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
            <div className="flex justify-center py-16"><Spinner size="lg" /></div>
          ) : attendanceRecords.length === 0 ? (
            <EmptyState icon={<Users className="w-12 h-12 text-gray-300" />} label={t('noChildren')} />
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">{t('child')}</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">{t('status')}</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">{t('note')}</th>
                      {isAdmin && <th className="px-4 py-3" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {attendanceRecords.map((record) => {
                      const pending = pendingAttendance.get(record.childId) ?? { status: record.status, note: record.note ?? '' }
                      const isSaving = savingAttendance === record.childId
                      return (
                        <tr key={record.childId} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-gray-900">{record.childName}</td>
                          <td className="px-4 py-3">
                            {isAdmin ? (
                              <select
                                value={pending.status ?? ''}
                                onChange={(e) => setAttendancePending(record.childId, 'status', e.target.value)}
                                className="border border-gray-300 rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                              >
                                <option value="">{t('notMarked')}</option>
                                <option value="present">{t('present')}</option>
                                <option value="absent">{t('absent')}</option>
                                <option value="late">{t('late')}</option>
                              </select>
                            ) : (
                              <AttendanceBadge status={record.status} />
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {isAdmin ? (
                              <input
                                type="text"
                                value={pending.note}
                                onChange={(e) => setAttendancePending(record.childId, 'note', e.target.value)}
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
                                onClick={() => saveAttendance(record)}
                                disabled={isSaving || !pending.status}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white rounded-lg text-xs font-medium hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                              >
                                {isSaving ? <Spinner size="sm" className="!text-white" /> : <Save className="w-3 h-3" />}
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

              {/* Summary */}
              <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex flex-wrap gap-4 text-xs text-gray-600">
                {(
                  [
                    { status: 'present', cls: 'text-green-600', label: t('present') },
                    { status: 'absent',  cls: 'text-red-600',   label: t('absent')  },
                    { status: 'late',    cls: 'text-yellow-600',label: t('late')    },
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

      {/* ── Fees Tab ── */}
      {activeTab === 'fees' && (
        <div>
          {/* Summary cards */}
          {feeRecords.length > 0 && (
            <div className="grid grid-cols-3 gap-4 mb-6">
              {(
                [
                  { value: feeRecords.length, label: t('totalChildren'), cls: 'text-gray-900' },
                  { value: paidCount,          label: t('paidCount'),     cls: 'text-green-600' },
                  { value: pendingCount,        label: t('pendingCount'),  cls: 'text-yellow-600' },
                ] as const
              ).map(({ value, label, cls }) => (
                <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 text-center shadow-sm">
                  <p className={`text-2xl font-bold ${cls}`}>{value}</p>
                  <p className="text-xs text-gray-500 mt-1">{label}</p>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3 mb-6">
            <label className="text-sm font-medium text-gray-700">{t('month')}:</label>
            <input
              type="month"
              value={feesMonth}
              onChange={(e) => setFeesMonth(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
          </div>

          {loadingFees ? (
            <div className="flex justify-center py-16"><Spinner size="lg" /></div>
          ) : feeRecords.length === 0 ? (
            <EmptyState icon={<Wallet className="w-12 h-12 text-gray-300" />} label={t('noChildren')} />
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">{t('child')}</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">{t('amount')} (KGS)</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">{t('status')}</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">{t('paidAt')}</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">{t('note')}</th>
                      {isAdmin && <th className="px-4 py-3" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {feeRecords.map((record) => {
                      const pending = pendingFees.get(record.childId) ?? {
                        amount: record.amount,
                        status: record.status,
                        note: record.note ?? '',
                      }
                      const isSaving = savingFee === record.childId
                      return (
                        <tr key={record.childId} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-gray-900">{record.childName}</td>
                          <td className="px-4 py-3">
                            {isAdmin ? (
                              <input
                                type="number"
                                min="0"
                                value={pending.amount}
                                onChange={(e) => setFeePending(record.childId, 'amount', e.target.value)}
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
                                onChange={(e) => setFeePending(record.childId, 'status', e.target.value)}
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
                            {record.paidAt ? new Date(record.paidAt).toLocaleDateString() : '—'}
                          </td>
                          <td className="px-4 py-3">
                            {isAdmin ? (
                              <input
                                type="text"
                                value={pending.note}
                                onChange={(e) => setFeePending(record.childId, 'note', e.target.value)}
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
                                {isSaving ? <Spinner size="sm" className="!text-white" /> : <Save className="w-3 h-3" />}
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

function EmptyState({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="bg-gray-50 rounded-xl p-16 text-center">
      <div className="flex justify-center mb-3">{icon}</div>
      <p className="text-gray-500">{label}</p>
    </div>
  )
}
