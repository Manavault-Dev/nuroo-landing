'use client'

import { useEffect, useState, useCallback } from 'react'
import { Link } from '@/i18n/navigation'
import { usePageAuth } from '@/lib/b2b/usePageAuth'
import { apiClient } from '@/lib/b2b/api'
import {
  BookOpen,
  Globe,
  Image as ImageIcon,
  Layers,
  Loader2,
  Lock,
  Plus,
  Users,
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

interface Course {
  id: string
  title: string
  description: string
  coverUrl?: string | null
  coverImageUrl?: string | null
  ownerOrgName?: string | null
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | 'draft' | 'published' | 'archived'
  visibility: 'PRIVATE' | 'PUBLIC' | 'org_only' | 'marketplace'
  accessPolicy?: 'FREE' | 'PAID' | 'VERIFIED_SPECIAL_NEEDS' | 'INVITATION_ONLY'
  price: number
  currency: string
  moduleCount: number
  lessonCount: number
  enrollmentCount: number
}

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

const STATUS_COLORS = {
  DRAFT: 'bg-yellow-100 text-yellow-800',
  PUBLISHED: 'bg-green-100 text-green-800',
  ARCHIVED: 'bg-gray-100 text-gray-600',
  draft: 'bg-yellow-100 text-yellow-800',
  published: 'bg-green-100 text-green-800',
  archived: 'bg-gray-100 text-gray-600',
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Черновик',
  PUBLISHED: 'Опубликован',
  ARCHIVED: 'Архив',
  draft: 'Черновик',
  published: 'Опубликован',
  archived: 'Архив',
}

const ACCESS_POLICY_LABELS: Record<string, string> = {
  FREE: 'Бесплатно',
  PAID: 'Платно',
  VERIFIED_SPECIAL_NEEDS: 'Бесплатно для подтвержденных детей',
  INVITATION_ONLY: 'По приглашению',
}

function isPublicCourse(course: Course) {
  return course.visibility === 'PUBLIC' || course.visibility === 'marketplace'
}

// ── Verification tab ───────────────────────────────────────────────────────────

type VerifTab = 'PENDING' | 'APPROVED' | 'REJECTED'

function VerificationBadge({ status }: { status: ChildVerification['status'] }) {
  const cfg = {
    PENDING: {
      bg: 'bg-amber-50 border-amber-200 text-amber-700',
      icon: Clock,
      label: 'На рассмотрении',
    },
    APPROVED: {
      bg: 'bg-emerald-50 border-emerald-200 text-emerald-700',
      icon: CheckCircle,
      label: 'Одобрено',
    },
    REJECTED: { bg: 'bg-red-50 border-red-200 text-red-700', icon: XCircle, label: 'Отклонено' },
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
}: {
  v: ChildVerification
  courseTitle: string
  onApprove: () => void
  onReject: () => void
  actionLoading: boolean
}) {
  const [docsOpen, setDocsOpen] = useState(false)
  const date = new Date(v.createdAt).toLocaleDateString('ru-RU', {
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
              <VerificationBadge status={v.status} />
              <span className="text-xs text-gray-400">{date}</span>
            </div>
            <p className="text-xs text-gray-500">
              <span className="font-medium text-gray-700">Курс:</span>{' '}
              <span className="truncate">{courseTitle}</span>
            </p>
            <p className="text-xs text-gray-500">
              <span className="font-medium text-gray-700">Parent UID:</span>{' '}
              <span className="font-mono text-[11px]">{v.parentUserId}</span>
            </p>
            {v.note && (
              <p className="text-sm text-gray-600 mt-1 max-w-lg">
                <span className="font-medium">Примечание: </span>
                {v.note}
              </p>
            )}
            {v.rejectionReason && (
              <p className="text-sm text-red-600 mt-1">
                <span className="font-medium">Причина отклонения: </span>
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
                    Отклонить
                  </button>
                  <button
                    onClick={onApprove}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-xs font-semibold hover:bg-emerald-600 transition-colors"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    Одобрить
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
            {v.documentRefs.length} документ(а)
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
                    {v.documentRefs[i]?.split('/').pop() || `Документ ${i + 1}`}
                  </span>
                  <Eye className="w-3.5 h-3.5 text-gray-400 group-hover:text-primary-500 shrink-0" />
                </a>
              ) : (
                <div
                  key={i}
                  className="flex items-center gap-2 p-2.5 border border-dashed border-gray-200 rounded-lg text-gray-400 text-xs"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Документ {i + 1} (недоступен)
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function VerificationsTab({ courses, orgId }: { courses: Course[]; orgId: string }) {
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

  const load = useCallback(async (status: VerifTab) => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiClient.getChildVerificationsForReview(status, orgId)
      setVerifications(res.verifications as ChildVerification[])
    } catch (e: any) {
      setError('Не удалось загрузить заявки. Попробуйте ещё раз.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(tab)
  }, [tab, load])

  const approve = async (id: string) => {
    setActionState((s) => ({ ...s, [id]: true }))
    try {
      await apiClient.reviewChildVerification(id, { status: 'APPROVED' })
      setVerifications((prev) => prev.filter((v) => v.id !== id))
    } catch {
      alert('Ошибка при одобрении.')
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
      alert('Ошибка при отклонении.')
    } finally {
      setActionState((s) => {
        const n = { ...s }
        delete n[id]
        return n
      })
    }
  }

  const tabLabels: Record<VerifTab, string> = {
    PENDING: 'На рассмотрении',
    APPROVED: 'Одобренные',
    REJECTED: 'Отклонённые',
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
          title="Обновить"
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
          <p className="text-gray-500 font-medium text-sm">Нет заявок</p>
          <p className="text-gray-400 text-xs mt-1">Заявки на льготный доступ появятся здесь</p>
        </div>
      ) : (
        <div className="space-y-3">
          {verifications.map((v) => (
            <VerificationCard
              key={v.id}
              v={v}
              courseTitle={courseMap[v.courseId] ?? v.courseId}
              actionLoading={!!actionState[v.id]}
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
            <h3 className="text-lg font-bold text-gray-900 mb-2">Отклонить заявку</h3>
            <p className="text-sm text-gray-500 mb-4">Укажите причину — родитель её увидит.</p>
            <textarea
              className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
              rows={4}
              placeholder="Например: документ нечитаем, истёк срок справки..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setRejectModal({ id: '', open: false })}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Отмена
              </button>
              <button
                onClick={confirmReject}
                disabled={!rejectReason.trim()}
                className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-xl text-sm font-semibold hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Отклонить
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
  const { orgId, isAdmin, isLoading: authLoading } = usePageAuth()
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pageTab, setPageTab] = useState<PageTab>('courses')

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
            <h1 className="text-xl font-bold text-gray-900">Курсы</h1>
            <p className="text-sm text-gray-500">Создавайте и публикуйте учебные материалы</p>
          </div>
        </div>
        {isAdmin && pageTab === 'courses' && (
          <Link
            href={`/b2b/courses/new${orgId ? `?orgId=${orgId}` : ''}`}
            className="btn-primary flex items-center gap-2 text-sm px-4 py-2"
          >
            <Plus className="w-4 h-4" />
            Новый курс
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
          Курсы
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
            Заявки на льготный доступ
          </button>
        )}
      </div>

      {pageTab === 'verifications' ? (
        <VerificationsTab courses={courses} orgId={orgId ?? ''} />
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
              <h3 className="text-gray-600 font-medium mb-1">Курсов пока нет</h3>
              <p className="text-sm text-gray-400 mb-4">
                Создайте первый курс и поделитесь знаниями с родителями
              </p>
              {isAdmin && (
                <Link
                  href={`/b2b/courses/new${orgId ? `?orgId=${orgId}` : ''}`}
                  className="btn-primary inline-flex items-center gap-2 text-sm px-4 py-2"
                >
                  <Plus className="w-4 h-4" />
                  Создать курс
                </Link>
              )}
            </div>
          ) : (
            <div className="grid gap-3">
              {courses.map((course) => (
                <Link
                  key={course.id}
                  href={`/b2b/courses/${course.id}${orgId ? `?orgId=${orgId}` : ''}`}
                  className="group grid overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all hover:border-primary-200 hover:shadow-md sm:grid-cols-[180px_minmax(0,1fr)]"
                >
                  <div className="relative aspect-[16/9] overflow-hidden bg-gradient-to-br from-primary-50 via-white to-blue-50 sm:aspect-auto sm:min-h-[142px]">
                    {course.coverUrl || course.coverImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={course.coverUrl || course.coverImageUrl || ''}
                        alt={course.title}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/80 text-primary-300 shadow-sm">
                          <ImageIcon className="h-6 w-6" />
                        </div>
                      </div>
                    )}

                    <div className="absolute left-3 top-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm backdrop-blur-sm ${STATUS_COLORS[course.status]}`}
                      >
                        {STATUS_LABELS[course.status] ?? course.status}
                      </span>
                    </div>
                  </div>

                  <div className="min-w-0 p-4">
                    <div className="mb-2 flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-base font-semibold text-gray-900">
                            {course.title}
                          </h3>
                          {isPublicCourse(course) ? (
                            <span className="flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                              <Globe className="h-3 w-3" />
                              Маркетплейс
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                              <Lock className="h-3 w-3" />
                              Организация
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-medium uppercase tracking-wide text-primary-600">
                          {course.ownerOrgName || 'Nuroo'}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-sm font-semibold text-gray-900">
                          {course.price === 0 ? 'Бесплатно' : `${course.price} ${course.currency}`}
                        </div>
                        <div className="max-w-[190px] text-xs leading-4 text-gray-400">
                          {ACCESS_POLICY_LABELS[course.accessPolicy || 'FREE']}
                        </div>
                      </div>
                    </div>

                    <p className="line-clamp-2 text-sm leading-5 text-gray-500">
                      {course.description}
                    </p>

                    <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-gray-100 pt-3 text-sm">
                      <div className="flex items-center gap-1.5 text-gray-500">
                        <Layers className="h-4 w-4 text-gray-400" />
                        <span className="font-medium text-gray-900">{course.moduleCount}</span>
                        <span>модулей</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-gray-500">
                        <BookOpen className="h-4 w-4 text-gray-400" />
                        <span className="font-medium text-gray-900">{course.lessonCount}</span>
                        <span>уроков</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-gray-500">
                        <Users className="h-4 w-4 text-gray-400" />
                        <span className="font-medium text-gray-900">{course.enrollmentCount}</span>
                        <span>учеников</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
