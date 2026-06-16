'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { usePageAuth } from '@/lib/b2b/usePageAuth'
import {
  apiClient,
  type AttendanceRecord,
  type Invoice,
  type CreateInvoiceInput,
  type ChildSummary,
  type ChildBillingProfile,
} from '@/lib/b2b/api'
import { PageSpinner, Spinner } from '@/components/ui/Spinner'
import {
  Wallet,
  Users,
  CheckCircle,
  Clock,
  AlertCircle,
  Save,
  AlertTriangle,
  TrendingUp,
  Plus,
  Copy,
  X,
  Settings,
  RefreshCw,
  Repeat,
  Eye,
  EyeOff,
  ShieldCheck,
  Pencil,
} from 'lucide-react'
import { PlanGate } from '@/components/b2b/PlanGate'

type Tab = 'attendance' | 'invoices'
type AttendanceStatus = 'present' | 'absent' | 'late' | null

const isoDateFromNow = (daysFromNow = 0) => {
  const date = new Date()
  date.setDate(date.getDate() + daysFromNow)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
const todayDate = () => isoDateFromNow()
const tomorrowDate = () => isoDateFromNow(1)
const resolveActiveTab = (tab: string | null, isAdmin: boolean): Tab => {
  if (tab === 'attendance') return 'attendance'
  if (tab === 'invoices' && isAdmin) return 'invoices'
  return isAdmin ? 'invoices' : 'attendance'
}

export default function FinancePage() {
  const t = useTranslations('b2b.pages.finance')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { orgId, isAdmin, isLoading } = usePageAuth()
  const activeTab = resolveActiveTab(searchParams.get('tab'), isAdmin)
  const visibleTabs = (isAdmin ? ['attendance', 'invoices'] : ['attendance']) as Tab[]

  const [attendanceDate, setAttendanceDate] = useState(todayDate)
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([])
  const [loadingAttendance, setLoadingAttendance] = useState(false)
  const [savingAttendance, setSavingAttendance] = useState<string | null>(null)
  const [pendingAttendance, setPendingAttendance] = useState<
    Map<string, { status: AttendanceStatus; note: string }>
  >(new Map())
  const [saveError, setSaveError] = useState<string | null>(null)

  // Invoices state
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loadingInvoices, setLoadingInvoices] = useState(false)
  const [finikConfigured, setFinikConfigured] = useState<boolean | null>(null)
  const [finikInfo, setFinikInfo] = useState<{
    merchantId?: string
    configuredAt?: string
  } | null>(null)
  const [showFinikModal, setShowFinikModal] = useState(false)
  const [finikForm, setFinikForm] = useState({ merchantId: '' })
  const [showMerchantId, setShowMerchantId] = useState(false)
  const [savingFinik, setSavingFinik] = useState(false)
  const [showCreateInvoice, setShowCreateInvoice] = useState(false)
  const [children, setChildren] = useState<ChildSummary[]>([])
  const [invoiceForm, setInvoiceForm] = useState<{
    childId: string
    amount: string
    description: string
    dueDate: string
  }>({ childId: '', amount: '', description: '', dueDate: '' })
  const [creatingInvoice, setCreatingInvoice] = useState(false)
  const [createInvoiceError, setCreateInvoiceError] = useState<string | null>(null)
  const [cancellingInvoice, setCancellingInvoice] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Billing profiles state
  const [billingProfiles, setBillingProfiles] = useState<ChildBillingProfile[]>([])
  const [loadingProfiles, setLoadingProfiles] = useState(false)
  const [showSetupBillingModal, setShowSetupBillingModal] = useState(false)
  const [billingProfileForm, setBillingProfileForm] = useState<{
    childId: string
    amount: string
    dueDayOfMonth: string
    note: string
  }>({ childId: '', amount: '', dueDayOfMonth: '5', note: '' })
  const [creatingProfile, setCreatingProfile] = useState(false)
  const [updatingProfile, setUpdatingProfile] = useState<{
    id: string
    action: 'pause' | 'resume' | 'cancel'
  } | null>(null)
  const [generatingInvoices, setGeneratingInvoices] = useState(false)
  const [generateInvoicesMessage, setGenerateInvoicesMessage] = useState<{
    type: 'success' | 'info' | 'error'
    text: string
  } | null>(null)
  const [expandedChild, setExpandedChild] = useState<string | null>(null)
  const financeLoadSeq = useRef(0)

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

  const loadInvoices = useCallback(async (oid: string) => {
    setLoadingInvoices(true)
    try {
      const res = await apiClient.getInvoices(oid)
      setInvoices(res.invoices ?? [])
    } catch {
      setInvoices([])
    } finally {
      setLoadingInvoices(false)
    }
  }, [])

  const loadPaymentProviders = useCallback(async (oid: string) => {
    try {
      const res = await apiClient.getPaymentProviders(oid)
      const finik = res.providers?.finik
      const enabled = finik?.enabled === true
      setFinikConfigured(enabled)
      setFinikInfo(
        enabled
          ? { merchantId: finik?.merchantId, configuredAt: finik?.configuredAt ?? undefined }
          : null
      )
    } catch {
      setFinikConfigured(false)
      setFinikInfo(null)
    }
  }, [])

  const [loadingChildren, setLoadingChildren] = useState(false)

  const loadBillingProfiles = useCallback(async (oid: string) => {
    setLoadingProfiles(true)
    try {
      const res = await apiClient.getBillingProfiles(oid)
      setBillingProfiles(res.profiles ?? [])
    } catch {
      setBillingProfiles([])
    } finally {
      setLoadingProfiles(false)
    }
  }, [])

  const loadFinanceData = useCallback(async (oid: string) => {
    const seq = ++financeLoadSeq.current
    setLoadingInvoices(true)
    setLoadingChildren(true)
    setLoadingProfiles(true)
    setFinikConfigured(null)

    const [invoicesResult, providersResult, childrenResult, profilesResult] =
      await Promise.allSettled([
        apiClient.getInvoices(oid),
        apiClient.getPaymentProviders(oid),
        apiClient.getChildren(oid),
        apiClient.getBillingProfiles(oid),
      ])

    if (seq !== financeLoadSeq.current) return

    if (invoicesResult.status === 'fulfilled') {
      setInvoices(invoicesResult.value.invoices ?? [])
    } else {
      setInvoices([])
    }

    if (providersResult.status === 'fulfilled') {
      const finik = providersResult.value.providers?.finik
      const enabled = finik?.enabled === true
      setFinikConfigured(enabled)
      setFinikInfo(
        enabled
          ? { merchantId: finik?.merchantId, configuredAt: finik?.configuredAt ?? undefined }
          : null
      )
    } else {
      setFinikConfigured(false)
      setFinikInfo(null)
    }

    if (childrenResult.status === 'fulfilled') {
      setChildren(Array.isArray(childrenResult.value) ? childrenResult.value : [])
    } else {
      setChildren([])
    }

    if (profilesResult.status === 'fulfilled') {
      setBillingProfiles(profilesResult.value.profiles ?? [])
    } else {
      setBillingProfiles([])
    }

    setLoadingInvoices(false)
    setLoadingChildren(false)
    setLoadingProfiles(false)
  }, [])

  useEffect(() => {
    if (orgId && activeTab === 'attendance') loadAttendance(orgId, attendanceDate)
  }, [orgId, activeTab, attendanceDate, loadAttendance])

  useEffect(() => {
    if (orgId && activeTab === 'invoices') {
      loadFinanceData(orgId)
    }
  }, [orgId, activeTab, loadFinanceData])

  useEffect(() => {
    if (isLoading || !isAdmin || searchParams.get('tab')) return
    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.set('tab', 'invoices')
    router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false })
  }, [isLoading, isAdmin, pathname, router, searchParams])

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

  const handleSaveFinik = async () => {
    if (!orgId || !finikForm.merchantId.trim()) return
    setSavingFinik(true)
    try {
      await apiClient.configureFinik(orgId, { merchantId: finikForm.merchantId.trim() })
      // Reload to get confirmed state from server
      await loadPaymentProviders(orgId)
      setShowFinikModal(false)
      setFinikForm({ merchantId: '' })
      setShowMerchantId(false)
    } catch {
      // keep modal open
    } finally {
      setSavingFinik(false)
    }
  }

  const handleOpenFinikModal = () => {
    // Pre-fill with masked hint so user knows value exists; don't pre-fill actual secret
    setFinikForm({ merchantId: '' })
    setShowMerchantId(false)
    setShowFinikModal(true)
  }

  const handleOpenCreateInvoice = () => {
    setCreateInvoiceError(null)
    setInvoiceForm((form) => ({ ...form, dueDate: form.dueDate || tomorrowDate() }))
    setShowCreateInvoice(true)
  }

  const handleCloseCreateInvoice = () => {
    setShowCreateInvoice(false)
    setCreateInvoiceError(null)
  }

  const handleCreateInvoice = async () => {
    if (!orgId) return
    setCreateInvoiceError(null)

    const child = children.find((c) => c.id === invoiceForm.childId)
    if (!child?.parentId) {
      setCreateInvoiceError(t('invoiceChildRequired'))
      return
    }

    const amount = Number(invoiceForm.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setCreateInvoiceError(t('invoiceAmountInvalid'))
      return
    }

    const dueDate = new Date(`${invoiceForm.dueDate}T00:00:00`)
    const today = new Date(`${todayDate()}T00:00:00`)
    if (!invoiceForm.dueDate || Number.isNaN(dueDate.getTime()) || dueDate <= today) {
      setCreateInvoiceError(t('invoiceDueDateInvalid'))
      return
    }

    setCreatingInvoice(true)
    try {
      const data: CreateInvoiceInput = {
        parentId: child.parentId,
        childId: invoiceForm.childId,
        amount,
        currency: 'KGS',
        description: invoiceForm.description || child.name || '',
        dueDate: invoiceForm.dueDate,
      }
      await apiClient.createInvoice(orgId, data)
      setShowCreateInvoice(false)
      setInvoiceForm({ childId: '', amount: '', description: '', dueDate: '' })
      setCreateInvoiceError(null)
      await loadInvoices(orgId)
    } catch (err: unknown) {
      setCreateInvoiceError(err instanceof Error ? err.message : t('invoiceCreateFailed'))
    } finally {
      setCreatingInvoice(false)
    }
  }

  const handleCreateBillingProfile = async () => {
    if (
      !orgId ||
      !billingProfileForm.childId ||
      !billingProfileForm.amount ||
      !billingProfileForm.dueDayOfMonth
    )
      return
    const child = children.find((c) => c.id === billingProfileForm.childId)
    if (!child?.parentId) return
    setCreatingProfile(true)
    try {
      await apiClient.createBillingProfile(orgId, {
        childId: billingProfileForm.childId,
        parentId: child.parentId,
        amount: Number(billingProfileForm.amount),
        currency: 'KGS',
        billingCycle: 'monthly',
        dueDayOfMonth: Number(billingProfileForm.dueDayOfMonth),
        note: billingProfileForm.note || undefined,
      })
      setShowSetupBillingModal(false)
      setBillingProfileForm({ childId: '', amount: '', dueDayOfMonth: '5', note: '' })
      await Promise.all([loadBillingProfiles(orgId), loadInvoices(orgId)])
    } catch {
      // keep modal open
    } finally {
      setCreatingProfile(false)
    }
  }

  const handleUpdateBillingProfile = async (
    profileId: string,
    updates: { status: 'active' | 'paused' | 'canceled' }
  ) => {
    if (!orgId) return
    const action =
      updates.status === 'active' ? 'resume' : updates.status === 'paused' ? 'pause' : 'cancel'
    setUpdatingProfile({ id: profileId, action })
    try {
      await apiClient.updateBillingProfile(orgId, profileId, updates)
      await loadBillingProfiles(orgId)
    } catch {
      // ignore
    } finally {
      setUpdatingProfile(null)
    }
  }

  const handleGenerateInvoices = async () => {
    if (!orgId) return
    setGeneratingInvoices(true)
    setGenerateInvoicesMessage(null)
    try {
      const res = await apiClient.generateMonthlyInvoices(orgId)
      await loadInvoices(orgId)
      const { created, skipped, failed } = res.result
      setGenerateInvoicesMessage({
        type: created > 0 ? 'success' : 'info',
        text:
          created > 0
            ? t('generateInvoicesResult', { created, skipped, failed })
            : t('generateInvoicesNoDue', { skipped }),
      })
    } catch (err: unknown) {
      setGenerateInvoicesMessage({
        type: 'error',
        text: err instanceof Error ? err.message : t('generateInvoicesFailed'),
      })
    } finally {
      setGeneratingInvoices(false)
    }
  }

  const handleCancelInvoice = async (invoiceId: string) => {
    if (!orgId) return
    setCancellingInvoice(invoiceId)
    try {
      await apiClient.cancelInvoice(orgId, invoiceId)
      await loadInvoices(orgId)
    } catch {
      // ignore
    } finally {
      setCancellingInvoice(null)
    }
  }

  const handleCopyLink = async (invoiceId: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopiedId(invoiceId)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      // ignore
    }
  }

  // Unified per-child payment groups (billing profile + invoices merged)
  const childPaymentGroups = useMemo(() => {
    const childIds = new Set([
      ...billingProfiles.map((p) => p.childId),
      ...invoices.map((i) => i.childId),
    ])
    return Array.from(childIds).map((cid) => {
      // Fallback for orphan invoices where the child was removed from the org
      const child: ChildSummary = children.find((c) => c.id === cid) ?? {
        id: cid,
        name: cid,
        parentId: undefined,
        completedTasksCount: 0,
      }
      return {
        child,
        profile: billingProfiles.find((p) => p.childId === cid),
        childInvoices: invoices
          .filter((i) => i.childId === cid)
          .sort(
            (a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
          ),
      }
    }) as Array<{
      child: ChildSummary
      profile: ChildBillingProfile | undefined
      childInvoices: Invoice[]
    }>
  }, [billingProfiles, invoices, children])

  const invoiceActivePlans = billingProfiles.filter((p) => p.status === 'active').length

  // Compute client-side effective statuses (past-due upcoming → pending, past-due pending → overdue)
  const todayISO = new Date().toISOString().split('T')[0]
  const getEffectiveStatus = (inv: { status: string; dueDate: string }) => {
    if (inv.status === 'upcoming' && inv.dueDate && inv.dueDate <= todayISO) return 'pending'
    if (inv.status === 'pending' && inv.dueDate && inv.dueDate < todayISO) return 'overdue'
    return inv.status
  }
  const invoicePendingCount = invoices.filter((i) => getEffectiveStatus(i) === 'pending').length
  const invoiceOverdueCount = invoices.filter((i) => getEffectiveStatus(i) === 'overdue').length
  const invoiceOutstanding = invoices
    .filter((i) => ['pending', 'overdue'].includes(getEffectiveStatus(i)))
    .reduce((s, i) => s + i.amount, 0)

  const handleTabChange = (tab: Tab) => {
    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.set('tab', tab)
    router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false })
  }

  if (isLoading) return <PageSpinner />

  return (
    <PlanGate requiredPlan="enterprise" orgId={orgId}>
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
                {tab === 'attendance' ? t('attendance') : t('fees')}
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

        {activeTab === 'invoices' && (
          <div>
            {/* Finik status banner */}
            {finikConfigured === false && (
              <div className="mb-6 flex items-start gap-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-amber-800">{t('finikNotConfigured')}</p>
                  <p className="text-xs text-amber-700 mt-0.5">{t('finikNotConfiguredHint')}</p>
                </div>
                <button
                  onClick={handleOpenFinikModal}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700 transition-colors"
                >
                  <Settings className="w-3.5 h-3.5" />
                  {t('configureFinik')}
                </button>
              </div>
            )}
            {finikConfigured === true && finikInfo && (
              <div className="mb-6 flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-200 rounded-xl">
                <ShieldCheck className="w-5 h-5 text-green-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-green-800">{t('finikConnected')}</p>
                  {finikInfo.merchantId && (
                    <p className="text-xs text-green-600 font-mono mt-0.5">
                      ID: {'•'.repeat(Math.max(0, (finikInfo.merchantId.length ?? 6) - 4))}
                      {finikInfo.merchantId.slice(-4)}
                    </p>
                  )}
                </div>
                {finikInfo.configuredAt && (
                  <span className="text-xs text-green-500 shrink-0">
                    {new Date(finikInfo.configuredAt).toLocaleDateString('ru-RU', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                )}
                <button
                  onClick={handleOpenFinikModal}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 border border-green-300 text-green-700 rounded-lg text-xs font-medium hover:bg-green-100 transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  {t('editFinik')}
                </button>
              </div>
            )}

            {/* ── UNIFIED PAYMENTS VIEW ──────────────────────────────────────── */}

            {/* Stats row */}
            {(billingProfiles.length > 0 || invoices.length > 0) && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                <SummaryCard
                  icon={<Repeat className="w-5 h-5 text-primary-500" />}
                  value={invoiceActivePlans}
                  label={t('activePlans')}
                  valueClass="text-primary-600"
                />
                <SummaryCard
                  icon={<Clock className="w-5 h-5 text-amber-500" />}
                  value={invoicePendingCount}
                  label={t('pendingInvoicesLabel')}
                  valueClass="text-amber-600"
                />
                <SummaryCard
                  icon={<AlertCircle className="w-5 h-5 text-red-500" />}
                  value={invoiceOverdueCount}
                  label={t('overdueCount')}
                  valueClass="text-red-600"
                />
                <SummaryCard
                  icon={<TrendingUp className="w-5 h-5 text-gray-500" />}
                  value={invoiceOutstanding.toLocaleString('ru-RU')}
                  label={t('outstanding')}
                  valueClass="text-gray-900"
                />
              </div>
            )}

            {/* Action bar */}
            <div className="flex flex-wrap items-center gap-2 mb-5">
              <button
                onClick={handleGenerateInvoices}
                disabled={generatingInvoices}
                className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                title={t('generateInvoicesTitle')}
              >
                {generatingInvoices ? <Spinner size="sm" /> : <RefreshCw className="w-4 h-4" />}
                {t('generateInvoices')}
              </button>
              <button
                onClick={() => setShowSetupBillingModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 transition-colors"
              >
                <Repeat className="w-4 h-4" />
                {t('setupMonthlyPayment')}
              </button>
              <button
                onClick={handleOpenCreateInvoice}
                className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                <Plus className="w-4 h-4" />
                {t('createOneTimeInvoice')}
              </button>
            </div>
            {generateInvoicesMessage && (
              <div
                className={`mb-5 flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${
                  generateInvoicesMessage.type === 'error'
                    ? 'border-red-200 bg-red-50 text-red-700'
                    : generateInvoicesMessage.type === 'success'
                      ? 'border-green-200 bg-green-50 text-green-700'
                      : 'border-blue-200 bg-blue-50 text-blue-700'
                }`}
              >
                {generateInvoicesMessage.type === 'error' ? (
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                ) : (
                  <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                )}
                <span>{generateInvoicesMessage.text}</span>
                <button
                  onClick={() => setGenerateInvoicesMessage(null)}
                  className="ml-auto opacity-70 hover:opacity-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Per-child unified list */}
            {loadingProfiles || loadingInvoices || loadingChildren ? (
              <div className="flex justify-center py-12">
                <Spinner size="lg" />
              </div>
            ) : childPaymentGroups.length === 0 ? (
              <div className="bg-gray-50 rounded-xl p-10 text-center border border-dashed border-gray-300">
                <Repeat className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium mb-1">{t('noPaymentsYet')}</p>
                <p className="text-xs text-gray-400 mb-4">{t('noPaymentsHint')}</p>
                <button
                  onClick={() => setShowSetupBillingModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 transition-colors"
                >
                  <Repeat className="w-4 h-4" />
                  {t('setupMonthlyPayment')}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {childPaymentGroups.map(({ child, profile, childInvoices: cInvoices }) => {
                  const isExpanded = expandedChild === child.id
                  const hasMore = cInvoices.length > 3
                  const visibleInvoices = isExpanded ? cInvoices : cInvoices.slice(0, 3)
                  const profileStatusCfg = profile
                    ? ({
                        active: {
                          cls: 'bg-green-100 text-green-700',
                          label: t('profileStatusActive'),
                        },
                        paused: {
                          cls: 'bg-yellow-100 text-yellow-700',
                          label: t('profileStatusPaused'),
                        },
                        canceled: {
                          cls: 'bg-gray-100 text-gray-500',
                          label: t('profileStatusCanceled'),
                        },
                      }[profile.status] ?? {
                        cls: 'bg-gray-100 text-gray-500',
                        label: profile.status,
                      })
                    : null
                  const isPauseUpdating =
                    updatingProfile?.id === (profile?.id ?? '') &&
                    updatingProfile?.action === 'pause'
                  const isResumeUpdating =
                    updatingProfile?.id === (profile?.id ?? '') &&
                    updatingProfile?.action === 'resume'
                  const isCancelUpdating =
                    updatingProfile?.id === (profile?.id ?? '') &&
                    updatingProfile?.action === 'cancel'
                  const isAnyUpdating = updatingProfile?.id === (profile?.id ?? '')

                  return (
                    <div
                      key={child.id}
                      className="bg-white rounded-xl border border-gray-200 overflow-hidden"
                    >
                      {/* Child header */}
                      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
                        <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-bold shrink-0">
                          {child.name[0]?.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 truncate">{child.name}</p>
                          {profile ? (
                            <p className="text-xs text-gray-500">
                              {profile.amount.toLocaleString('ru-RU')} {profile.currency}/
                              {t('perMonth')}
                              {' · '}
                              {t('dueDayValue', { day: profile.dueDayOfMonth })}
                              {' · '}
                              {t('nextInvoiceDate')}:{' '}
                              {new Date(profile.nextInvoiceDate).toLocaleDateString('ru-RU', {
                                day: 'numeric',
                                month: 'short',
                              })}
                            </p>
                          ) : (
                            <p className="text-xs text-gray-400">{t('noProfile')}</p>
                          )}
                        </div>
                        {profileStatusCfg && (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${profileStatusCfg.cls}`}
                          >
                            {profileStatusCfg.label}
                          </span>
                        )}
                        <div className="flex items-center gap-1 shrink-0">
                          {profile && profile.status === 'active' && (
                            <button
                              onClick={() =>
                                handleUpdateBillingProfile(profile.id, { status: 'paused' })
                              }
                              disabled={isAnyUpdating}
                              className="px-2 py-1 border border-yellow-200 text-yellow-700 rounded-lg text-xs font-medium hover:bg-yellow-50 transition-colors disabled:opacity-40"
                            >
                              {isPauseUpdating ? <Spinner size="sm" /> : t('pauseProfile')}
                            </button>
                          )}
                          {profile && profile.status === 'paused' && (
                            <button
                              onClick={() =>
                                handleUpdateBillingProfile(profile.id, { status: 'active' })
                              }
                              disabled={isAnyUpdating}
                              className="px-2 py-1 border border-green-200 text-green-700 rounded-lg text-xs font-medium hover:bg-green-50 transition-colors disabled:opacity-40"
                            >
                              {isResumeUpdating ? <Spinner size="sm" /> : t('resumeProfile')}
                            </button>
                          )}
                          {profile && profile.status !== 'canceled' && (
                            <button
                              onClick={() =>
                                handleUpdateBillingProfile(profile.id, { status: 'canceled' })
                              }
                              disabled={isAnyUpdating}
                              className="px-2 py-1 border border-red-200 text-red-600 rounded-lg text-xs font-medium hover:bg-red-50 transition-colors disabled:opacity-40"
                            >
                              {isCancelUpdating ? <Spinner size="sm" /> : t('cancelProfile')}
                            </button>
                          )}
                          {!profile && (
                            <button
                              onClick={() => {
                                setBillingProfileForm((f) => ({ ...f, childId: child.id }))
                                setShowSetupBillingModal(true)
                              }}
                              className="px-2 py-1 bg-primary-50 border border-primary-200 text-primary-700 rounded-lg text-xs font-medium hover:bg-primary-100 transition-colors"
                            >
                              {t('setupMonthlyPayment')}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Invoices for this child */}
                      {cInvoices.length === 0 ? (
                        <div className="px-4 py-3 text-xs text-gray-400 text-center italic">
                          {t('noInvoicesYet')}
                        </div>
                      ) : (
                        <div>
                          <div className="divide-y divide-gray-50">
                            {visibleInvoices.map((invoice) => {
                              const isc: Record<string, { cls: string; label: string }> = {
                                upcoming: {
                                  cls: 'bg-blue-100 text-blue-700',
                                  label: t('statusUpcoming'),
                                },
                                pending: {
                                  cls: 'bg-amber-100 text-amber-700',
                                  label: t('statusPending'),
                                },
                                overdue: {
                                  cls: 'bg-red-100 text-red-700',
                                  label: t('statusOverdue'),
                                },
                                paid: {
                                  cls: 'bg-green-100 text-green-700',
                                  label: t('statusPaid'),
                                },
                                failed: {
                                  cls: 'bg-red-100 text-red-700',
                                  label: t('statusFailed'),
                                },
                                expired: {
                                  cls: 'bg-gray-100 text-gray-500',
                                  label: t('statusExpired'),
                                },
                                canceled: {
                                  cls: 'bg-gray-100 text-gray-500',
                                  label: t('statusCanceled'),
                                },
                              }
                              // Client-side effective status:
                              // - upcoming with dueDate in the past → show as pending (awaiting Finik upgrade)
                              // - pending with dueDate in the past → show as overdue
                              const todayStr = new Date().toISOString().split('T')[0]
                              const effectiveStatus =
                                invoice.status === 'upcoming' &&
                                invoice.dueDate &&
                                invoice.dueDate <= todayStr
                                  ? 'pending'
                                  : invoice.status === 'pending' &&
                                      invoice.dueDate &&
                                      invoice.dueDate < todayStr
                                    ? 'overdue'
                                    : invoice.status
                              const isCfg = isc[effectiveStatus] ?? {
                                cls: 'bg-gray-100 text-gray-500',
                                label: effectiveStatus,
                              }
                              return (
                                <div
                                  key={invoice.id}
                                  className={`flex items-center gap-3 px-4 py-2.5 text-sm ${effectiveStatus === 'overdue' ? 'bg-red-50/40' : ''}`}
                                >
                                  <div className="flex-1 min-w-0">
                                    <span className="text-gray-700 block truncate">
                                      {invoice.periodStart
                                        ? new Date(
                                            invoice.periodStart + 'T00:00:00'
                                          ).toLocaleDateString('ru-RU', {
                                            month: 'long',
                                            year: 'numeric',
                                          })
                                        : invoice.description}
                                    </span>
                                    <span className="text-xs text-gray-400 flex items-center gap-1">
                                      {invoice.billingProfileId && <Repeat className="w-3 h-3" />}
                                      {new Date(invoice.dueDate + 'T00:00:00').toLocaleDateString(
                                        'ru-RU',
                                        { day: 'numeric', month: 'short', year: 'numeric' }
                                      )}
                                    </span>
                                  </div>
                                  <span className="font-semibold text-gray-800 shrink-0">
                                    {invoice.amount.toLocaleString('ru-RU')} KGS
                                  </span>
                                  <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${isCfg.cls}`}
                                  >
                                    {isCfg.label}
                                  </span>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {['pending', 'overdue'].includes(effectiveStatus) &&
                                      invoice.paymentUrl && (
                                        <button
                                          onClick={() =>
                                            handleCopyLink(invoice.id, invoice.paymentUrl!)
                                          }
                                          className="flex items-center gap-1 px-2 py-1 border border-gray-200 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors"
                                        >
                                          <Copy className="w-3 h-3" />
                                          {copiedId === invoice.id ? '✓' : t('copyPaymentLink')}
                                        </button>
                                      )}
                                    {['pending', 'overdue', 'upcoming'].includes(
                                      effectiveStatus
                                    ) && (
                                      <button
                                        onClick={() => handleCancelInvoice(invoice.id)}
                                        disabled={cancellingInvoice === invoice.id}
                                        className="flex items-center gap-1 px-2 py-1 border border-red-200 text-red-600 rounded-lg text-xs font-medium hover:bg-red-50 transition-colors disabled:opacity-40"
                                      >
                                        {cancellingInvoice === invoice.id ? (
                                          <Spinner size="sm" />
                                        ) : (
                                          <X className="w-3 h-3" />
                                        )}
                                        {t('cancelInvoice')}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                          {hasMore && (
                            <button
                              onClick={() => setExpandedChild(isExpanded ? null : child.id)}
                              className="w-full py-2 text-xs text-primary-600 font-medium hover:bg-primary-50 transition-colors border-t border-gray-100"
                            >
                              {isExpanded
                                ? t('hideInvoices')
                                : t('showAllInvoices', { count: cInvoices.length })}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* ── SETUP BILLING PROFILE MODAL ────────────────────────────────── */}
            {showSetupBillingModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">
                        {t('setupMonthlyPayment')}
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5">{t('setupMonthlyPaymentHint')}</p>
                    </div>
                    <button
                      onClick={() => setShowSetupBillingModal(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('child')}
                      </label>
                      <select
                        value={billingProfileForm.childId}
                        onChange={(e) =>
                          setBillingProfileForm((f) => ({ ...f, childId: e.target.value }))
                        }
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                      >
                        <option value="">—</option>
                        {children
                          .filter((c) => c.parentId)
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('monthlyAmount')} (KGS)
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={billingProfileForm.amount}
                        onChange={(e) =>
                          setBillingProfileForm((f) => ({ ...f, amount: e.target.value }))
                        }
                        placeholder="4000"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('dueDayOfMonth')}{' '}
                        <span className="text-gray-400 font-normal">(1–28)</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="28"
                        value={billingProfileForm.dueDayOfMonth}
                        onChange={(e) =>
                          setBillingProfileForm((f) => ({ ...f, dueDayOfMonth: e.target.value }))
                        }
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                      />
                      <p className="text-xs text-gray-400 mt-1">{t('dueDayHint')}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('optionalNote')}
                      </label>
                      <input
                        type="text"
                        value={billingProfileForm.note}
                        onChange={(e) =>
                          setBillingProfileForm((f) => ({ ...f, note: e.target.value }))
                        }
                        placeholder={t('billingNoteHint')}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={() => setShowSetupBillingModal(false)}
                      className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      {t('cancelInvoice')}
                    </button>
                    <button
                      onClick={handleCreateBillingProfile}
                      disabled={
                        creatingProfile ||
                        !billingProfileForm.childId ||
                        !billingProfileForm.amount ||
                        !billingProfileForm.dueDayOfMonth ||
                        !children.find((c) => c.id === billingProfileForm.childId)?.parentId
                      }
                      className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {creatingProfile && <Spinner size="sm" className="!text-white" />}
                      <Repeat className="w-4 h-4" />
                      {t('saveProfile')}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── FINIK CONFIG MODAL ──────────────────────────────────────────── */}
            {showFinikModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-5">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">
                        {finikConfigured ? t('editFinik') : t('configureFinik')}
                      </h3>
                      <p className="text-xs text-gray-400 mt-0.5">{t('finikModalSubtitle')}</p>
                    </div>
                    <button
                      onClick={() => {
                        setShowFinikModal(false)
                        setFinikForm({ merchantId: '' })
                        setShowMerchantId(false)
                      }}
                      className="text-gray-400 hover:text-gray-600 mt-0.5"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Security notice */}
                  <div className="flex items-start gap-2.5 p-3 bg-blue-50 border border-blue-100 rounded-xl mb-5">
                    <ShieldCheck className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-700">{t('finikSecurityNotice')}</p>
                  </div>

                  <div className="space-y-4">
                    {finikConfigured && finikInfo?.merchantId && (
                      <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <p className="text-xs text-gray-500 mb-1">{t('finikCurrentId')}</p>
                        <p className="font-mono text-sm text-gray-800 tracking-wider">
                          {'•'.repeat(Math.max(0, (finikInfo.merchantId.length ?? 6) - 4))}
                          {finikInfo.merchantId.slice(-4)}
                        </p>
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {finikConfigured ? t('finikNewId') : 'Merchant ID'}
                      </label>
                      <div className="relative">
                        <input
                          type={showMerchantId ? 'text' : 'password'}
                          value={finikForm.merchantId}
                          onChange={(e) =>
                            setFinikForm((f) => ({ ...f, merchantId: e.target.value }))
                          }
                          placeholder={t('finikMerchantIdPlaceholder')}
                          autoComplete="off"
                          spellCheck={false}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 pr-10 text-sm focus:ring-2 focus:ring-primary-500 outline-none font-mono tracking-widest"
                        />
                        <button
                          type="button"
                          onClick={() => setShowMerchantId((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          tabIndex={-1}
                        >
                          {showMerchantId ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{t('finikMerchantIdHint')}</p>
                    </div>
                  </div>

                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={() => {
                        setShowFinikModal(false)
                        setFinikForm({ merchantId: '' })
                        setShowMerchantId(false)
                      }}
                      className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      {t('close')}
                    </button>
                    <button
                      onClick={handleSaveFinik}
                      disabled={savingFinik || !finikForm.merchantId.trim()}
                      className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {savingFinik ? (
                        <Spinner size="sm" className="!text-white" />
                      ) : (
                        <ShieldCheck className="w-4 h-4" />
                      )}
                      {finikConfigured ? t('finikUpdate') : t('finikConnect')}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── ONE-TIME INVOICE MODAL (ADVANCED / SECONDARY) ───────────────── */}
            {showCreateInvoice && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-bold text-gray-900">{t('createOneTimeInvoice')}</h3>
                    <button
                      onClick={handleCloseCreateInvoice}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mb-4">{t('oneTimeInvoiceHint')}</p>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('child')}
                      </label>
                      <select
                        value={invoiceForm.childId}
                        onChange={(e) => setInvoiceForm((f) => ({ ...f, childId: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                      >
                        <option value="">—</option>
                        {children.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('invoiceAmount')} (KGS)
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={invoiceForm.amount}
                        onChange={(e) => setInvoiceForm((f) => ({ ...f, amount: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('invoiceDescription')}
                      </label>
                      <input
                        type="text"
                        value={invoiceForm.description}
                        onChange={(e) =>
                          setInvoiceForm((f) => ({ ...f, description: e.target.value }))
                        }
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('invoiceDueDate')}
                      </label>
                      <input
                        type="date"
                        min={tomorrowDate()}
                        value={invoiceForm.dueDate}
                        onChange={(e) => setInvoiceForm((f) => ({ ...f, dueDate: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                      />
                      <p className="mt-1 text-xs text-gray-400">{t('invoiceDueDateHint')}</p>
                    </div>
                  </div>
                  {createInvoiceError && (
                    <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                      <span>{createInvoiceError}</span>
                    </div>
                  )}
                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={handleCloseCreateInvoice}
                      className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      {t('cancelInvoice')}
                    </button>
                    <button
                      onClick={handleCreateInvoice}
                      disabled={
                        creatingInvoice ||
                        !invoiceForm.childId ||
                        !invoiceForm.amount ||
                        !invoiceForm.dueDate ||
                        !children.find((c) => c.id === invoiceForm.childId)?.parentId
                      }
                      className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {creatingInvoice && <Spinner size="sm" className="!text-white" />}
                      <Plus className="w-4 h-4" />
                      {t('createInvoice')}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </PlanGate>
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
