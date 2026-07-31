'use client'

import { useEffect, useState } from 'react'
import { Link } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { usePageAuth } from '@/lib/b2b/usePageAuth'
import { apiClient } from '@/lib/b2b/api'
import {
  BookOpen,
  Loader2,
  Plus,
  Users,
  Calendar,
  MapPin,
  Video,
  Clock,
  ChevronRight,
  AlertCircle,
  Ban,
  Rocket,
} from 'lucide-react'
import { ConfirmModal } from '@/components/ui/ConfirmModal'

type CohortStatus = 'draft' | 'open' | 'full' | 'in_progress' | 'completed' | 'cancelled'

interface Cohort {
  id: string
  title: string
  description: string
  category: string | null
  format: 'online' | 'offline'
  startDate: string
  endDate: string
  price: number
  currency: string
  maxParticipants: number
  enrolledCount: number
  status: CohortStatus
  instructorName: string | null
  ageMin: number | null
  ageMax: number | null
  coverUrl: string | null
  scheduleType: 'manual' | 'recurring'
}

const STATUS_STYLE: Record<CohortStatus, { bg: string; label: string }> = {
  draft: { bg: 'bg-gray-100 text-gray-500', label: 'Черновик' },
  open: { bg: 'bg-emerald-100 text-emerald-700', label: 'Набор открыт' },
  full: { bg: 'bg-amber-100 text-amber-700', label: 'Мест нет' },
  in_progress: { bg: 'bg-blue-100 text-blue-700', label: 'Идут занятия' },
  completed: { bg: 'bg-gray-100 text-gray-600', label: 'Завершён' },
  cancelled: { bg: 'bg-red-100 text-red-600', label: 'Отменён' },
}

function CohortCard({
  cohort,
  orgId,
  isAdmin,
  onCancel,
  onPublish,
}: {
  cohort: Cohort
  orgId: string
  isAdmin: boolean
  onCancel: (c: Cohort) => void
  onPublish: (c: Cohort) => void
}) {
  const st = STATUS_STYLE[cohort.status]
  const spots = cohort.maxParticipants - cohort.enrolledCount
  const spotsPercent = Math.round((cohort.enrolledCount / cohort.maxParticipants) * 100)

  return (
    <Link
      href={`/b2b/courses/${cohort.id}?orgId=${orgId}`}
      className="block bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:border-primary-300 transition-all group"
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${st.bg}`}>
                {st.label}
              </span>
              {cohort.category && (
                <span className="text-xs text-gray-400 border border-gray-200 px-2 py-0.5 rounded-full">
                  {cohort.category}
                </span>
              )}
              {cohort.ageMin != null && (
                <span className="text-xs text-gray-400">
                  {cohort.ageMin}–{cohort.ageMax ?? '∞'} лет
                </span>
              )}
            </div>
            <h3 className="font-semibold text-gray-900 text-base truncate group-hover:text-primary-600 transition-colors">
              {cohort.title}
            </h3>
            {cohort.instructorName && (
              <p className="text-sm text-gray-500 mt-0.5">{cohort.instructorName}</p>
            )}
          </div>
          <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-primary-400 shrink-0 mt-1 transition-colors" />
        </div>

        <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            {cohort.format === 'online' ? (
              <Video className="w-3.5 h-3.5 text-blue-400" />
            ) : (
              <MapPin className="w-3.5 h-3.5 text-gray-400" />
            )}
            {cohort.format === 'online' ? 'Онлайн' : 'Офлайн'}
          </span>
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-gray-400" />
            {cohort.startDate} — {cohort.endDate}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-gray-400" />
            {cohort.scheduleType === 'recurring' ? 'По расписанию' : 'Вручную'}
          </span>
        </div>

        {/* Enrollment bar */}
        <div className="mt-3">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              {cohort.enrolledCount} / {cohort.maxParticipants}
            </span>
            <span>{spots > 0 ? `Свободно: ${spots}` : 'Мест нет'}</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-500 rounded-full transition-all"
              style={{ width: `${Math.min(100, spotsPercent)}%` }}
            />
          </div>
        </div>

        {/* Price */}
        <div className="mt-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-900">
            {cohort.price > 0 ? `${cohort.price.toLocaleString()} ${cohort.currency}` : 'Бесплатно'}
          </span>
          {isAdmin && (
            <div className="flex items-center gap-2">
              {cohort.status === 'draft' && (
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    onPublish(cohort)
                  }}
                  className="text-xs text-emerald-600 hover:text-emerald-800 flex items-center gap-1 transition-colors font-medium"
                >
                  <Rocket className="w-3.5 h-3.5" />
                  Открыть набор
                </button>
              )}
              {cohort.status !== 'cancelled' && cohort.status !== 'completed' && (
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    onCancel(cohort)
                  }}
                  className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 transition-colors"
                >
                  <Ban className="w-3.5 h-3.5" />
                  Отменить
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}

export default function CoursesPage() {
  const t = useTranslations('b2b.pages.courses')
  const { orgId, isAdmin, isLoading: authLoading } = usePageAuth()
  const [cohorts, setCohorts] = useState<Cohort[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cancelModal, setCancelModal] = useState<Cohort | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [publishing, setPublishing] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading || !orgId) return
    setLoading(true)
    apiClient
      .getCohorts(orgId)
      .then((res) => setCohorts(res.cohorts))
      .catch((e: any) => setError(e.message))
      .finally(() => setLoading(false))
  }, [authLoading, orgId])

  const handlePublish = async (cohort: Cohort) => {
    if (!orgId) return
    setPublishing(cohort.id)
    try {
      await apiClient.updateCohort(orgId, cohort.id, { status: 'open' })
      setCohorts((prev) =>
        prev.map((c) => (c.id === cohort.id ? { ...c, status: 'open' as const } : c))
      )
    } catch {
      alert('Не удалось открыть набор. Попробуйте ещё раз.')
    } finally {
      setPublishing(null)
    }
  }

  const handleCancel = async () => {
    if (!cancelModal || !orgId) return
    setCancelling(true)
    try {
      await apiClient.deleteCohort(orgId, cancelModal.id)
      setCohorts((prev) =>
        prev.map((c) => (c.id === cancelModal.id ? { ...c, status: 'cancelled' as const } : c))
      )
      setCancelModal(null)
    } catch {
      alert('Не удалось отменить набор')
    } finally {
      setCancelling(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
      </div>
    )
  }

  const activeCohorts = cohorts.filter((c) => c.status !== 'cancelled' && c.status !== 'completed')
  const archiveCohorts = cohorts.filter((c) => c.status === 'cancelled' || c.status === 'completed')

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <BookOpen className="w-6 h-6 text-primary-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">{t('list.title')}</h1>
            <p className="text-sm text-gray-500">{t('list.subtitle')}</p>
          </div>
        </div>
        {isAdmin && (
          <Link
            href={`/b2b/courses/new${orgId ? `?orgId=${orgId}` : ''}`}
            className="btn-primary flex items-center gap-2 text-sm px-4 py-2"
          >
            <Plus className="w-4 h-4" />
            {t('list.newCourse')}
          </Link>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 mb-5">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {cohorts.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-gray-100">
          <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-gray-600 font-medium mb-1">{t('list.emptyTitle')}</h3>
          <p className="text-sm text-gray-400 mb-4">{t('list.emptyDescription')}</p>
          {isAdmin && (
            <Link
              href={`/b2b/courses/new${orgId ? `?orgId=${orgId}` : ''}`}
              className="btn-primary inline-flex items-center gap-2 text-sm px-4 py-2"
            >
              <Plus className="w-4 h-4" />
              {t('list.createCourse')}
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {activeCohorts.length > 0 && (
            <div>
              <div className="grid gap-3">
                {activeCohorts.map((c) => (
                  <CohortCard
                    key={c.id}
                    cohort={c}
                    orgId={orgId ?? ''}
                    isAdmin={isAdmin}
                    onCancel={setCancelModal}
                    onPublish={handlePublish}
                  />
                ))}
              </div>
            </div>
          )}

          {archiveCohorts.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
                Архив
              </h2>
              <div className="grid gap-3 opacity-70">
                {archiveCohorts.map((c) => (
                  <CohortCard
                    key={c.id}
                    cohort={c}
                    orgId={orgId ?? ''}
                    isAdmin={isAdmin}
                    onCancel={setCancelModal}
                    onPublish={handlePublish}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {cancelModal && (
        <ConfirmModal
          title="Отменить набор?"
          subtitle="Это действие нельзя отменить"
          description={
            <span>
              Набор <span className="font-semibold text-gray-900">«{cancelModal.title}»</span> будет
              отмечен как отменённый. Участники останутся в системе.
            </span>
          }
          confirmLabel="Отменить набор"
          cancelLabel="Назад"
          loading={cancelling}
          onConfirm={handleCancel}
          onCancel={() => setCancelModal(null)}
        />
      )}
    </div>
  )
}
