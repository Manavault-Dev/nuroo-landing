'use client'

import { useEffect, useState, useCallback } from 'react'
import { Link } from '@/i18n/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { usePageAuth } from '@/lib/b2b/usePageAuth'
import { apiClient } from '@/lib/b2b/api'
import type { Course } from '@/lib/b2b/types/course'
import { CourseCard } from '@/components/b2b/courses/CourseCard'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import {
  BookOpen,
  Loader2,
  Plus,
  ShieldCheck,
  CheckCircle,
  XCircle,
  Clock,
  ChevronDown,
  FileText,
  Eye,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'

interface ChildVerification {
  id: string
  childId: string
  parentUserId: string
  courseId: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  documentRefs: string[]
  documentUrls: string[]
  note?: string
  rejectionReason?: string
  createdAt: string
}

// ── Verification tab ───────────────────────────────────────────────────────────

type VerifTab = 'PENDING' | 'APPROVED' | 'REJECTED'

function VerificationBadge({
  status,
  t,
}: {
  status: ChildVerification['status']
  t: (key: string) => string
}) {
  const cfg = {
    PENDING: {
      bg: 'bg-amber-50 border-amber-200 text-amber-700',
      icon: Clock,
      label: t('verifications.status.pending'),
    },
    APPROVED: {
      bg: 'bg-emerald-50 border-emerald-200 text-emerald-700',
      icon: CheckCircle,
      label: t('verifications.status.approved'),
    },
    REJECTED: {
      bg: 'bg-red-50 border-red-200 text-red-700',
      icon: XCircle,
      label: t('verifications.status.rejected'),
    },
  }[status]
  const Icon = cfg.icon
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.bg}`}
    >
      <Icon className="w-3.5 h-3.5" />
      {cfg.label}
    </span>
  )
}

function VerificationCard({
  v,
  courseTitle,
  onApprove,
  onReject,
  actionLoading,
  t,
  locale,
}: {
  v: ChildVerification
  courseTitle: string
  onApprove: () => void
  onReject: () => void
  actionLoading: boolean
  t: (key: string, values?: Record<string, string | number>) => string
  locale: string
}) {
  const [docsOpen, setDocsOpen] = useState(false)
  const date = new Date(v.createdAt).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <VerificationBadge status={v.status} t={t} />
              <span className="text-xs text-gray-400">{date}</span>
            </div>
            <p className="text-xs text-gray-500">
              <span className="font-medium text-gray-700">{t('verifications.course')}:</span>{' '}
              <span className="truncate">{courseTitle}</span>
            </p>
            <p className="text-xs text-gray-500">
              <span className="font-medium text-gray-700">Parent UID:</span>{' '}
              <span className="font-mono text-[11px]">{v.parentUserId}</span>
            </p>
            {v.note && (
              <p className="text-sm text-gray-600 mt-1 max-w-lg">
                <span className="font-medium">{t('verifications.note')}: </span>
                {v.note}
              </p>
            )}
            {v.rejectionReason && (
              <p className="text-sm text-red-600 mt-1">
                <span className="font-medium">{t('verifications.rejectionReason')}: </span>
                {v.rejectionReason}
              </p>
            )}
          </div>
          {v.status === 'PENDING' && (
            <div className="flex gap-2 shrink-0">
              {actionLoading ? (
                <Loader2 className="w-5 h-5 text-primary-500 animate-spin mt-1" />
              ) : (
                <>
                  <button
                    onClick={onReject}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-600 rounded-lg text-xs font-medium hover:bg-red-50 transition-colors"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    {t('verifications.reject')}
                  </button>
                  <button
                    onClick={onApprove}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-xs font-semibold hover:bg-emerald-600 transition-colors"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    {t('verifications.approve')}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="border-t border-gray-100">
        <button
          onClick={() => setDocsOpen((o) => !o)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-gray-500 hover:bg-gray-50 transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-gray-400" />
            {t('verifications.documentsCount', { count: v.documentRefs.length })}
          </span>
          <ChevronDown
            className={`w-3.5 h-3.5 text-gray-400 transition-transform ${docsOpen ? 'rotate-180' : ''}`}
          />
        </button>
        {docsOpen && (
          <div className="px-4 pb-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(v.documentUrls?.length ? v.documentUrls : v.documentRefs).map((url, i) =>
              url ? (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-2.5 border border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors group"
                >
                  <FileText className="w-4 h-4 text-gray-400 group-hover:text-primary-600 shrink-0" />
                  <span className="text-xs text-gray-600 truncate flex-1">
                    {v.documentRefs[i]?.split('/').pop() ||
                      t('verifications.documentName', { index: i + 1 })}
                  </span>
                  <Eye className="w-3.5 h-3.5 text-gray-400 group-hover:text-primary-500 shrink-0" />
                </a>
              ) : (
                <div
                  key={i}
                  className="flex items-center gap-2 p-2.5 border border-dashed border-gray-200 rounded-lg text-gray-400 text-xs"
                >
                  <FileText className="w-3.5 h-3.5" />
                  {t('verifications.documentUnavailable', { index: i + 1 })}
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function VerificationsTab({
  courses,
  orgId,
  t,
  locale,
}: {
  courses: Course[]
  orgId: string
  t: (key: string, values?: Record<string, string | number>) => string
  locale: string
}) {
  const courseMap = Object.fromEntries(courses.map((c) => [c.id, c.title]))

  const [tab, setTab] = useState<VerifTab>('PENDING')
  const [verifications, setVerifications] = useState<ChildVerification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionState, setActionState] = useState<Record<string, boolean>>({})
  const [rejectModal, setRejectModal] = useState<{ id: string; open: boolean }>({
    id: '',
    open: false,
  })
  const [rejectReason, setRejectReason] = useState('')

  const load = useCallback(
    async (status: VerifTab) => {
      setLoading(true)
      setError(null)
      try {
        const res = await apiClient.getChildVerificationsForReview(status, orgId)
        setVerifications(res.verifications as ChildVerification[])
      } catch (e: any) {
        setError(t('verifications.loadError'))
      } finally {
        setLoading(false)
      }
    },
    [orgId, t]
  )

  useEffect(() => {
    load(tab)
  }, [tab, load])

  const approve = async (id: string) => {
    setActionState((s) => ({ ...s, [id]: true }))
    try {
      await apiClient.reviewChildVerification(id, { status: 'APPROVED' })
      setVerifications((prev) => prev.filter((v) => v.id !== id))
    } catch {
      alert(t('verifications.approveError'))
    } finally {
      setActionState((s) => {
        const n = { ...s }
        delete n[id]
        return n
      })
    }
  }

  const confirmReject = async () => {
    if (!rejectReason.trim()) return
    const { id } = rejectModal
    setRejectModal({ id: '', open: false })
    setActionState((s) => ({ ...s, [id]: true }))
    try {
      await apiClient.reviewChildVerification(id, {
        status: 'REJECTED',
        rejectionReason: rejectReason.trim(),
      })
      setVerifications((prev) => prev.filter((v) => v.id !== id))
    } catch {
      alert(t('verifications.rejectError'))
    } finally {
      setActionState((s) => {
        const n = { ...s }
        delete n[id]
        return n
      })
    }
  }

  const tabLabels: Record<VerifTab, string> = {
    PENDING: t('verifications.tabs.pending'),
    APPROVED: t('verifications.tabs.approved'),
    REJECTED: t('verifications.tabs.rejected'),
  }

  return (
    <div>
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-5 w-fit">
        {(['PENDING', 'APPROVED', 'REJECTED'] as VerifTab[]).map((s) => (
          <button
            key={s}
            onClick={() => setTab(s)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === s ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tabLabels[s]}
          </button>
        ))}
        <button
          onClick={() => load(tab)}
          className="ml-1 px-2.5 py-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-white transition-colors"
          title={t('verifications.refresh')}
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {error ? (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="text-sm">{error}</p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-7 h-7 text-primary-500 animate-spin" />
        </div>
      ) : verifications.length === 0 ? (
        <div className="text-center py-14 bg-white rounded-xl border border-gray-100">
          <ShieldCheck className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium text-sm">{t('verifications.emptyTitle')}</p>
          <p className="text-gray-400 text-xs mt-1">{t('verifications.emptyDescription')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {verifications.map((v) => (
            <VerificationCard
              key={v.id}
              v={v}
              courseTitle={courseMap[v.courseId] ?? v.courseId}
              actionLoading={!!actionState[v.id]}
              t={t}
              locale={locale}
              onApprove={() => approve(v.id)}
              onReject={() => {
                setRejectReason('')
                setRejectModal({ id: v.id, open: true })
              }}
            />
          ))}
        </div>
      )}

      {rejectModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              {t('verifications.rejectTitle')}
            </h3>
            <p className="text-sm text-gray-500 mb-4">{t('verifications.rejectDescription')}</p>
            <textarea
              className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
              rows={4}
              placeholder={t('verifications.rejectPlaceholder')}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setRejectModal({ id: '', open: false })}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                {t('actions.cancel')}
              </button>
              <button
                onClick={confirmReject}
                disabled={!rejectReason.trim()}
                className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-xl text-sm font-semibold hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t('verifications.reject')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

type PageTab = 'courses' | 'verifications'

export default function CoursesPage() {
  const t = useTranslations('b2b.pages.courses')
  const locale = useLocale()
  const { orgId, isAdmin, isLoading: authLoading } = usePageAuth()
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pageTab, setPageTab] = useState<PageTab>('courses')
  const [deleteModal, setDeleteModal] = useState<{ id: string; title: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    if (!deleteModal || !orgId) return
    setDeleting(true)
    try {
      await apiClient.deleteCourse(orgId, deleteModal.id)
      setCourses((prev) => prev.filter((c) => c.id !== deleteModal.id))
      setDeleteModal(null)
    } catch {
      alert(t('delete.error'))
    } finally {
      setDeleting(false)
    }
  }

  useEffect(() => {
    if (authLoading || !orgId) return
    setLoading(true)
    apiClient
      .getCourses(orgId)
      .then((res) => setCourses(res.courses))
      .catch((e: any) => setError(e.message))
      .finally(() => setLoading(false))
  }, [authLoading, orgId])

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <BookOpen className="w-6 h-6 text-primary-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">{t('list.title')}</h1>
            <p className="text-sm text-gray-500">{t('list.subtitle')}</p>
          </div>
        </div>
        {isAdmin && pageTab === 'courses' && (
          <Link
            href={`/b2b/courses/new${orgId ? `?orgId=${orgId}` : ''}`}
            className="btn-primary flex items-center gap-2 text-sm px-4 py-2"
          >
            <Plus className="w-4 h-4" />
            {t('list.newCourse')}
          </Link>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6 gap-1">
        <button
          onClick={() => setPageTab('courses')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            pageTab === 'courses'
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          {t('list.coursesTab')}
        </button>
        {isAdmin && (
          <button
            onClick={() => setPageTab('verifications')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              pageTab === 'verifications'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            {t('list.verificationsTab')}
          </button>
        )}
      </div>

      {pageTab === 'verifications' ? (
        <VerificationsTab courses={courses} orgId={orgId ?? ''} t={t} locale={locale} />
      ) : (
        <>
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700 mb-4">
              {error}
            </div>
          )}

          {courses.length === 0 ? (
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
            <div className="grid gap-3">
              {courses.map((course) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  orgId={orgId ?? ''}
                  isAdmin={isAdmin}
                  onDelete={(c) => setDeleteModal({ id: c.id, title: c.title })}
                />
              ))}
            </div>
          )}
        </>
      )}

      {deleteModal && (
        <ConfirmModal
          title={t('delete.title')}
          subtitle={t('delete.subtitle')}
          description={t.rich('delete.description', {
            title: deleteModal.title,
            strong: (chunks) => <span className="font-semibold text-gray-900">{chunks}</span>,
          })}
          confirmLabel={t('delete.confirm')}
          cancelLabel={t('actions.cancel')}
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteModal(null)}
        />
      )}
    </div>
  )
}
