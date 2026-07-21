'use client'

import { useEffect, useState, useCallback } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { usePageAuth } from '@/lib/b2b/usePageAuth'
import { apiClient } from '@/lib/b2b/api'
import {
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Plus,
  Loader2,
  User,
  Scissors,
  Timer,
  Pencil,
  Trash2,
  CalendarDays,
  FileText,
  Eye,
  X,
  ClipboardList,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import clsx from 'clsx'

// ── Types ──────────────────────────────────────────────────────────────────────

type Tab = 'bookings' | 'services' | 'schedule'

type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled'
type IntakeStatus = 'not_required' | 'pending' | 'submitted' | 'reviewed'

interface IntakeField {
  id: string
  label: string
  type: 'text' | 'textarea' | 'select' | 'checkbox'
  options?: string[]
  required: boolean
}

interface IntakeSection {
  id: string
  title: string
  fields: IntakeField[]
}

interface IntakeSubmission {
  answers: Record<string, string | boolean>
  submittedAt: string
  templateSnapshot: {
    name: string
    fields: IntakeField[]
    sections?: IntakeSection[]
  }
}

interface Booking {
  id: string
  orgId: string
  specialistId: string
  date: string
  startTime: string
  endTime: string
  status: BookingStatus
  intakeStatus: IntakeStatus
  intakeFormId: string | null
  notes: string | null
  cancelReason: string | null
}

interface TeamMember {
  uid: string
  name: string
  role: 'admin' | 'specialist'
}

interface Service {
  id: string
  name: string
  description: string | null
  durationMinutes: number
  price: number
  currency: string
  specialistId: string
  intakeFormId: string | null
}

interface DaySchedule {
  enabled: boolean
  windows: { start: string; end: string }[]
}

type WeekSchedule = Record<string, DaySchedule>

// ── Constants ─────────────────────────────────────────────────────────────────

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

const STATUS_CONFIG: Record<BookingStatus, { bg: string; text: string; icon: LucideIcon }> = {
  pending: { bg: 'bg-amber-50', text: 'text-amber-700', icon: AlertCircle },
  confirmed: {
    bg: 'bg-teal-50',
    text: 'text-teal-700',
    icon: CheckCircle2,
  },
  completed: { bg: 'bg-gray-100', text: 'text-gray-600', icon: CheckCircle2 },
  cancelled: { bg: 'bg-red-50', text: 'text-red-600', icon: XCircle },
}

function formatDate(iso: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(iso + 'T00:00:00Z'))
}

function emptyWeek(): WeekSchedule {
  return Object.fromEntries(
    DAY_KEYS.map((key) => [key, { enabled: false, windows: [{ start: '09:00', end: '18:00' }] }])
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status, label }: { status: BookingStatus; label: string }) {
  const cfg = STATUS_CONFIG[status]
  const Icon = cfg.icon
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold',
        cfg.bg,
        cfg.text
      )}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </span>
  )
}

const INTAKE_BADGE_CONFIG: Partial<Record<IntakeStatus, { bg: string; text: string }>> = {
  pending: { bg: 'bg-amber-50', text: 'text-amber-700' },
  submitted: { bg: 'bg-indigo-50', text: 'text-indigo-700' },
  reviewed: { bg: 'bg-gray-100', text: 'text-gray-500' },
}

function IntakeBadge({
  status,
  label,
  onView,
}: {
  status: IntakeStatus
  label: string
  onView?: () => void
}) {
  const cfg = INTAKE_BADGE_CONFIG[status]
  if (!cfg) return null
  return (
    <button
      onClick={onView}
      disabled={status === 'pending' || !onView}
      className={clsx(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-opacity',
        cfg.bg,
        cfg.text,
        onView && status !== 'pending' ? 'hover:opacity-80 cursor-pointer' : 'cursor-default'
      )}
    >
      <FileText className="w-3.5 h-3.5" />
      {label}
    </button>
  )
}

function ClientBriefModal({
  submission,
  bookingId,
  orgId,
  onClose,
  onReviewed,
}: {
  submission: IntakeSubmission
  bookingId: string
  orgId: string
  onClose: () => void
  onReviewed: () => void
}) {
  const t = useTranslations('b2b.pages.bookings')
  const locale = useLocale()
  const [marking, setMarking] = useState(false)
  const snap = submission.templateSnapshot
  const sections = snap.sections ?? [{ id: '_', title: '', fields: snap.fields }]
  const submittedAt = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
    new Date(submission.submittedAt)
  )

  const handleMarkReviewed = async () => {
    setMarking(true)
    try {
      await apiClient.markIntakeReviewed(orgId, bookingId)
      onReviewed()
    } finally {
      setMarking(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-900">{t('clientBriefTitle')}</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {t('submittedAt', { date: submittedAt })}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">
          {sections.map((sec) => (
            <div key={sec.id}>
              {sec.title && (
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                  {sec.title}
                </p>
              )}
              <div className="space-y-3">
                {sec.fields.map((field) => {
                  const val = submission.answers[field.id]
                  const display =
                    val === true
                      ? t('yes')
                      : val === false
                        ? t('no')
                        : (val as string) || t('emptyValue')
                  return (
                    <div key={field.id} className="bg-gray-50 rounded-xl px-4 py-3">
                      <p className="text-xs text-gray-400 mb-1">{field.label}</p>
                      <p className="text-sm font-semibold text-gray-900 whitespace-pre-wrap">
                        {display}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50"
          >
            {t('close')}
          </button>
          <button
            onClick={handleMarkReviewed}
            disabled={marking}
            className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {marking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
            {t('markReviewed')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Bookings tab ──────────────────────────────────────────────────────────────

function BookingsTab({ orgId, specialistId }: { orgId: string; specialistId?: string }) {
  const t = useTranslations('b2b.pages.bookings')
  const locale = useLocale()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [briefBookingId, setBriefBookingId] = useState<string | null>(null)
  const [briefSubmission, setBriefSubmission] = useState<IntakeSubmission | null>(null)
  const [briefLoading, setBriefLoading] = useState(false)

  const FILTERS = [
    { value: '', label: t('filterAll') },
    { value: 'pending', label: t('filterPending') },
    { value: 'confirmed', label: t('filterConfirmed') },
    { value: 'completed', label: t('filterCompleted') },
    { value: 'cancelled', label: t('filterCancelled') },
  ]

  useEffect(() => {
    setLoading(true)
    apiClient
      .getOrgBookings(orgId, filter || undefined, specialistId)
      .then((res) => setBookings(res.bookings as Booking[]))
      .finally(() => setLoading(false))
  }, [orgId, filter, specialistId])

  const handleStatus = async (b: Booking, next: BookingStatus) => {
    setActionLoading(b.id)
    try {
      await apiClient.updateBookingStatus(orgId, b.id, next as any)
      setBookings((prev) => prev.map((x) => (x.id === b.id ? { ...x, status: next } : x)))
    } finally {
      setActionLoading(null)
    }
  }

  const openBrief = async (b: Booking) => {
    setBriefBookingId(b.id)
    setBriefSubmission(null)
    setBriefLoading(true)
    try {
      const res = await apiClient.getBookingIntake(orgId, b.id)
      setBriefSubmission((res.intake as IntakeSubmission) ?? null)
    } catch {
      setBriefSubmission(null)
    } finally {
      setBriefLoading(false)
    }
  }

  const handleReviewed = (bookingId: string) => {
    setBookings((prev) =>
      prev.map((x) => (x.id === bookingId ? { ...x, intakeStatus: 'reviewed' } : x))
    )
    setBriefBookingId(null)
    setBriefSubmission(null)
  }

  const transitions: Record<BookingStatus, BookingStatus[]> = {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['completed', 'cancelled'],
    completed: [],
    cancelled: [],
  }

  return (
    <div className="space-y-4">
      {/* Filter pills */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={clsx(
              'px-4 py-1.5 rounded-full text-sm font-semibold transition-colors',
              filter === f.value
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
        </div>
      ) : bookings.length === 0 ? (
        <div className="text-center py-16">
          <CalendarDays className="w-14 h-14 mx-auto mb-4 text-gray-200" />
          <p className="font-semibold text-gray-500">{t('emptyBookingsTitle')}</p>
          <p className="text-sm text-gray-400 mt-1">{t('emptyBookingsDescription')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => {
            const next = transitions[b.status]
            const actioning = actionLoading === b.id
            return (
              <div
                key={b.id}
                className="bg-white border border-gray-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4"
              >
                <div className="flex items-center gap-3 sm:w-44 flex-shrink-0">
                  <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-primary-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">{formatDate(b.date, locale)}</p>
                    <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" />
                      {b.startTime}–{b.endTime}
                    </p>
                  </div>
                </div>
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge status={b.status} label={t(`status.${b.status}`)} />
                    {b.intakeStatus && b.intakeStatus !== 'not_required' && (
                      <IntakeBadge
                        status={b.intakeStatus}
                        label={t(`intakeStatus.${b.intakeStatus}`)}
                        onView={
                          b.intakeStatus === 'submitted' || b.intakeStatus === 'reviewed'
                            ? () => openBrief(b)
                            : undefined
                        }
                      />
                    )}
                  </div>
                  {b.notes && <p className="text-sm text-gray-600 truncate">{b.notes}</p>}
                  {b.cancelReason && <p className="text-xs text-red-500">{b.cancelReason}</p>}
                </div>
                {next.length > 0 && (
                  <div className="flex gap-2 flex-shrink-0">
                    {actioning ? (
                      <Loader2 className="w-5 h-5 text-primary-500 animate-spin" />
                    ) : (
                      next.map((s) => (
                        <button
                          key={s}
                          onClick={() => handleStatus(b, s)}
                          className={clsx(
                            'px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors',
                            s === 'cancelled'
                              ? 'text-red-600 bg-red-50 hover:bg-red-100'
                              : 'text-teal-700 bg-teal-50 hover:bg-teal-100'
                          )}
                        >
                          {t(`actions.${s}`)}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Brief loading overlay */}
      {briefLoading && briefBookingId && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-8 flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            <p className="text-sm text-gray-500 font-medium">{t('loadingBrief')}</p>
          </div>
        </div>
      )}

      {/* Client brief modal */}
      {!briefLoading && briefBookingId && briefSubmission && (
        <ClientBriefModal
          submission={briefSubmission}
          bookingId={briefBookingId}
          orgId={orgId}
          onClose={() => {
            setBriefBookingId(null)
            setBriefSubmission(null)
          }}
          onReviewed={() => handleReviewed(briefBookingId)}
        />
      )}
    </div>
  )
}

// ── Services tab ──────────────────────────────────────────────────────────────

function ServicesTab({
  orgId,
  isAdmin,
  specialistId,
}: {
  orgId: string
  isAdmin: boolean
  specialistId?: string
}) {
  const t = useTranslations('b2b.pages.bookings')
  const [services, setServices] = useState<Service[]>([])
  const [team, setTeam] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    name: '',
    description: '',
    durationMinutes: 60,
    price: 0,
    currency: 'KGS',
    specialistId: specialistId ?? '',
    requireIntake: false,
  })
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!isAdmin) {
      setTeam([])
      return
    }
    await apiClient.getTeam(orgId).then(setTeam)
  }, [orgId, isAdmin])

  const loadServices = useCallback(async () => {
    try {
      const res = await apiClient.getOrgServices(orgId)
      const all = (res.services ?? []) as Service[]
      setServices(isAdmin ? all : all.filter((s) => s.specialistId === specialistId))
    } catch {
      setServices([])
    }
  }, [orgId, isAdmin, specialistId])

  useEffect(() => {
    Promise.all([load(), loadServices()]).finally(() => setLoading(false))
  }, [load, loadServices])

  const resetForm = () => {
    setForm({
      name: '',
      description: '',
      durationMinutes: 60,
      price: 0,
      currency: 'KGS',
      specialistId: isAdmin ? (team[0]?.uid ?? '') : (specialistId ?? ''),
      requireIntake: false,
    })
    setEditingId(null)
    setError('')
  }

  const openCreate = () => {
    resetForm()
    setShowForm(true)
  }

  const openEdit = (s: Service) => {
    setForm({
      name: s.name,
      description: s.description ?? '',
      durationMinutes: s.durationMinutes,
      price: s.price,
      currency: s.currency,
      specialistId: s.specialistId,
      requireIntake: !!s.intakeFormId,
    })
    setEditingId(s.id)
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError(t('errorServiceNameRequired'))
      return
    }
    if (!form.specialistId) {
      setError(t('errorSpecialistRequired'))
      return
    }
    setSaving(true)
    try {
      // If intake is required, ensure the default template exists and get its ID
      let intakeFormId: string | null = null
      if (form.requireIntake) {
        const tmplRes = await apiClient.ensureDefaultIntakeTemplate(orgId)
        intakeFormId = tmplRes.form?.id ?? null
      }

      const payload = {
        name: form.name,
        description: form.description || null,
        durationMinutes: form.durationMinutes,
        price: form.price,
        currency: form.currency,
        specialistId: form.specialistId,
        intakeFormId,
      }

      if (editingId) {
        await apiClient.updateOrgService(orgId, editingId, payload)
      } else {
        await apiClient.createOrgService(orgId, payload)
      }
      await loadServices()
      setShowForm(false)
      resetForm()
    } catch (e: any) {
      setError(e?.payload?.error ?? t('errorSaveService'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('confirmDeleteService'))) return
    try {
      await apiClient.deleteOrgService(orgId, id)
      setServices((prev) => prev.filter((s) => s.id !== id))
    } catch {
      setError(t('errorDeleteService'))
    }
  }

  const specialistName = (uid: string) => team.find((member) => member.uid === uid)?.name ?? uid

  if (loading)
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {services.length === 0
            ? t('servicesHint')
            : t('serviceCount', { count: services.length })}
        </p>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> {t('addService')}
        </button>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">
              {editingId ? t('editService') : t('newService')}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">
                  {t('serviceNameLabel')}
                </label>
                <input
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                  placeholder={t('serviceNamePlaceholder')}
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>

              {isAdmin && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    {t('specialistLabel')}
                  </label>
                  <select
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white"
                    value={form.specialistId}
                    onChange={(e) => setForm((f) => ({ ...f, specialistId: e.target.value }))}
                  >
                    <option value="">{t('specialistPlaceholder')}</option>
                    {team.map((m) => (
                      <option key={m.uid} value={m.uid}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    {t('durationLabel')}
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={480}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                    value={form.durationMinutes}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, durationMinutes: Number(e.target.value) }))
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    {t('priceLabel')}
                  </label>
                  <input
                    type="number"
                    min={0}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                    value={form.price}
                    onChange={(e) => setForm((f) => ({ ...f, price: Number(e.target.value) }))}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">
                  {t('descriptionLabel')}
                </label>
                <textarea
                  rows={2}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"
                  placeholder={t('descriptionPlaceholder')}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>

              {/* Intake toggle */}
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, requireIntake: !f.requireIntake }))}
                className={clsx(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-colors',
                  form.requireIntake
                    ? 'border-indigo-400 bg-indigo-50'
                    : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                )}
              >
                <div
                  className={clsx(
                    'w-10 h-6 rounded-full relative flex-shrink-0 transition-colors',
                    form.requireIntake ? 'bg-indigo-600' : 'bg-gray-300'
                  )}
                >
                  <span
                    className={clsx(
                      'absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all',
                      form.requireIntake ? 'left-4' : 'left-0.5'
                    )}
                  />
                </div>
                <div>
                  <p
                    className={clsx(
                      'text-sm font-semibold',
                      form.requireIntake ? 'text-indigo-700' : 'text-gray-600'
                    )}
                  >
                    {t('intakeToggleTitle')}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{t('intakeToggleDescription')}</p>
                </div>
              </button>

              {error && <p className="text-sm text-red-500">{error}</p>}
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => {
                  setShowForm(false)
                  resetForm()
                }}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {t('save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Services list */}
      {services.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl">
          <Scissors className="w-12 h-12 mx-auto mb-3 text-gray-200" />
          <p className="font-semibold text-gray-400">{t('emptyServicesTitle')}</p>
          <p className="text-sm text-gray-300 mt-1">{t('emptyServicesDescription')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {services.map((svc) => (
            <div
              key={svc.id}
              className="bg-white border border-gray-200 rounded-2xl px-5 py-4 flex items-center gap-4"
            >
              <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                <Scissors className="w-5 h-5 text-primary-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-gray-900 text-sm">{svc.name}</p>
                  {svc.intakeFormId && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-600">
                      <ClipboardList className="w-3 h-3" /> {t('intakeBadge')}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Timer className="w-3 h-3" />{' '}
                    {t('minutesShort', { count: svc.durationMinutes })}
                  </span>
                  <span className="text-xs font-semibold text-primary-600">
                    {svc.price === 0 ? t('free') : `${svc.price} ${svc.currency}`}
                  </span>
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <User className="w-3 h-3" /> {specialistName(svc.specialistId)}
                  </span>
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button
                  onClick={() => openEdit(svc)}
                  className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(svc.id)}
                  className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Schedule tab ──────────────────────────────────────────────────────────────

function ScheduleTab({
  orgId,
  isAdmin,
  specialistId,
}: {
  orgId: string
  isAdmin: boolean
  specialistId?: string
}) {
  const t = useTranslations('b2b.pages.bookings')
  const [team, setTeam] = useState<TeamMember[]>([])
  const [selectedUid, setSelectedUid] = useState(isAdmin ? '' : (specialistId ?? ''))
  const [schedule, setSchedule] = useState<WeekSchedule>(emptyWeek())
  const [slotDuration, setSlotDuration] = useState(60)
  const [breakMins, setBreakMins] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const days = DAY_KEYS.map((key) => ({ key, label: t(`days.${key}`) }))

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false)
      return
    }
    apiClient
      .getTeam(orgId)
      .then((t) => {
        setTeam(t)
        if (t.length > 0) setSelectedUid(t[0].uid)
      })
      .finally(() => setLoading(false))
  }, [orgId, isAdmin])

  useEffect(() => {
    if (!selectedUid) return
    setLoading(true)
    apiClient
      .getSpecialistAvailability(orgId, selectedUid)
      .then((res) => {
        if (res.availability) {
          const existing = res.availability
          const built = emptyWeek()
          for (const [day, wins] of Object.entries(existing.schedule || {})) {
            built[day] = {
              enabled: true,
              windows:
                (wins as any[]).length > 0 ? (wins as any[]) : [{ start: '09:00', end: '18:00' }],
            }
          }
          setSchedule(built)
          setSlotDuration(existing.slotDurationMinutes ?? 60)
          setBreakMins(existing.breakBetweenSlotsMinutes ?? 0)
        } else {
          setSchedule(emptyWeek())
        }
      })
      .catch(() => setSchedule(emptyWeek()))
      .finally(() => setLoading(false))
  }, [orgId, selectedUid])

  const toggleDay = (day: string) => {
    setSchedule((s) => ({ ...s, [day]: { ...s[day], enabled: !s[day].enabled } }))
  }

  const updateWindow = (day: string, idx: number, field: 'start' | 'end', val: string) => {
    setSchedule((s) => {
      const wins = [...s[day].windows]
      wins[idx] = { ...wins[idx], [field]: val }
      return { ...s, [day]: { ...s[day], windows: wins } }
    })
  }

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    try {
      const enabledSchedule: Record<string, { start: string; end: string }[]> = {}
      for (const [day, cfg] of Object.entries(schedule)) {
        if (cfg.enabled) enabledSchedule[day] = cfg.windows
      }
      await apiClient.updateSpecialistAvailability(orgId, selectedUid, {
        schedule: enabledSchedule,
        slotDurationMinutes: slotDuration,
        breakBetweenSlotsMinutes: breakMins,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } finally {
      setSaving(false)
    }
  }

  if (loading)
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    )

  return (
    <div className="space-y-6">
      {/* Specialist picker — admins only */}
      {isAdmin && (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm font-semibold text-gray-500">{t('specialistFilterLabel')}</span>
          <div className="flex gap-2 flex-wrap">
            {team.map((m) => (
              <button
                key={m.uid}
                onClick={() => setSelectedUid(m.uid)}
                className={clsx(
                  'px-4 py-2 rounded-xl text-sm font-semibold transition-colors',
                  selectedUid === m.uid
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                {m.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedUid && (
        <>
          {/* Slot settings */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <p className="text-sm font-bold text-gray-700 mb-4">{t('slotSettingsTitle')}</p>
            <div className="flex gap-6 flex-wrap">
              <div>
                <label className="block text-xs text-gray-400 mb-1">{t('slotDurationLabel')}</label>
                <select
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-400"
                  value={slotDuration}
                  onChange={(e) => setSlotDuration(Number(e.target.value))}
                >
                  {[15, 20, 30, 45, 60, 90, 120].map((v) => (
                    <option key={v} value={v}>
                      {t('minutesShort', { count: v })}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  {t('breakBetweenSlotsLabel')}
                </label>
                <select
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-400"
                  value={breakMins}
                  onChange={(e) => setBreakMins(Number(e.target.value))}
                >
                  {[0, 5, 10, 15, 20, 30].map((v) => (
                    <option key={v} value={v}>
                      {v === 0 ? t('noBreak') : t('minutesShort', { count: v })}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Weekly schedule */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
            <p className="text-sm font-bold text-gray-700 mb-2">{t('workingHoursTitle')}</p>
            {days.map(({ key, label }) => {
              const cfg = schedule[key]
              return (
                <div
                  key={key}
                  className={clsx(
                    'flex items-center gap-4 p-3 rounded-xl transition-colors',
                    cfg.enabled ? 'bg-primary-50' : 'bg-gray-50'
                  )}
                >
                  {/* Toggle */}
                  <button
                    onClick={() => toggleDay(key)}
                    className={clsx(
                      'w-11 h-6 rounded-full relative transition-colors flex-shrink-0',
                      cfg.enabled ? 'bg-primary-600' : 'bg-gray-300'
                    )}
                  >
                    <span
                      className={clsx(
                        'absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all',
                        cfg.enabled ? 'left-5' : 'left-0.5'
                      )}
                    />
                  </button>
                  <span
                    className={clsx(
                      'text-sm font-bold w-8 flex-shrink-0',
                      cfg.enabled ? 'text-primary-700' : 'text-gray-400'
                    )}
                  >
                    {label}
                  </span>

                  {cfg.enabled ? (
                    <div className="flex items-center gap-2 flex-wrap flex-1">
                      {cfg.windows.map((w, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <input
                            type="time"
                            value={w.start}
                            onChange={(e) => updateWindow(key, i, 'start', e.target.value)}
                            className="border border-primary-200 rounded-lg px-2 py-1 text-sm text-primary-800 bg-white focus:outline-none focus:ring-1 focus:ring-primary-400"
                          />
                          <span className="text-gray-400 text-sm">—</span>
                          <input
                            type="time"
                            value={w.end}
                            onChange={(e) => updateWindow(key, i, 'end', e.target.value)}
                            className="border border-primary-200 rounded-lg px-2 py-1 text-sm text-primary-800 bg-white focus:outline-none focus:ring-1 focus:ring-primary-400"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400">{t('dayOff')}</span>
                  )}
                </div>
              )
            })}
          </div>

          {/* Save */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary-600 text-white rounded-xl font-semibold text-sm hover:bg-primary-700 disabled:opacity-60 transition-colors"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {t('saveSchedule')}
            </button>
            {saved && (
              <span className="text-sm text-emerald-600 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> {t('saved')}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BookingsPage() {
  const t = useTranslations('b2b.pages.bookings')
  const { orgId, isLoading, isAdmin, profile } = usePageAuth()
  const [tab, setTab] = useState<Tab>('bookings')

  const specialistId = isAdmin ? undefined : (profile?.uid ?? undefined)

  const TABS: { id: Tab; label: string }[] = [
    { id: 'bookings', label: t('tabBookings') },
    { id: 'services', label: t('tabServices') },
    { id: 'schedule', label: t('tabSchedule') },
  ]

  if (isLoading || !orgId) return null

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <CalendarDays className="w-6 h-6 text-primary-600" />
          {t('title')}
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          {t('subtitlePrefix')}{' '}
          <button
            onClick={() => setTab('services')}
            className="text-primary-600 hover:underline font-medium"
          >
            {t('subtitleServices')}
          </button>
          {t('subtitleMiddle')}{' '}
          <button
            onClick={() => setTab('schedule')}
            className="text-primary-600 hover:underline font-medium"
          >
            {t('subtitleSchedule')}
          </button>{' '}
          {t('subtitleSuffix')}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={clsx(
              'px-5 py-2 rounded-lg text-sm font-semibold transition-all',
              tab === t.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'bookings' && <BookingsTab orgId={orgId} specialistId={specialistId} />}
      {tab === 'services' && (
        <ServicesTab orgId={orgId} isAdmin={isAdmin} specialistId={specialistId} />
      )}
      {tab === 'schedule' && (
        <ScheduleTab orgId={orgId} isAdmin={isAdmin} specialistId={specialistId} />
      )}
    </div>
  )
}
