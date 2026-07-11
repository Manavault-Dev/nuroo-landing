'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useToast } from '@/hooks/useToast'
import { ToastContainer } from '@/components/ui/Toast'
import { useParams } from 'next/navigation'
import { Link } from '@/i18n/navigation'
import { Select } from '@/components/ui/Select'
import { usePageAuth } from '@/lib/b2b/usePageAuth'
import { apiClient } from '@/lib/b2b/api'
import {
  STATUS_COLORS,
  isPublishedCourse,
  isPublicCourse,
  type Course,
  type CourseModule,
  type Lesson,
} from '@/lib/b2b/types/course'
import type {
  CourseMediaKind,
  Selection,
  ModuleDraft,
  LessonDraft,
  CourseSettingsDraft,
  LessonType,
  CourseAccessPolicy,
} from './types'
import {
  getPublishBlocker,
  getCourseUpdateErrorMessage,
  getErrorMessage,
  emptyModuleDraft,
  draftFromCourse,
  draftFromModule,
  emptyLessonDraft,
  draftFromLesson,
  buildLessonPayload,
} from './utils'
import {
  ArrowLeft,
  BookOpen,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  File,
  FileText,
  Globe,
  Image as ImageIcon,
  Layers,
  Loader2,
  Lock,
  Plus,
  Save,
  Trash2,
  Upload,
  Video,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const LESSON_TYPE_ICONS: Record<LessonType, LucideIcon> = {
  text: FileText,
  video: Video,
  task: ClipboardList,
  pdf: File,
}

function LessonIcon({ type, className }: { type: LessonType; className?: string }) {
  const Icon = LESSON_TYPE_ICONS[type] || FileText
  return <Icon className={className} />
}

export default function CourseDetailPage() {
  const t = useTranslations('b2b.pages.courses')
  const params = useParams()
  const courseId = params.courseId as string
  const { orgId, isAdmin, isLoading: authLoading } = usePageAuth()

  const { toasts, show: toast } = useToast()
  const [course, setCourse] = useState<Course | null>(null)
  const [modules, setModules] = useState<CourseModule[]>([])
  const [lessonsByModule, setLessonsByModule] = useState<Record<string, Lesson[]>>({})
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set())
  const [loadingLessonsFor, setLoadingLessonsFor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [courseDraft, setCourseDraft] = useState<CourseSettingsDraft | null>(null)
  const [moduleDraft, setModuleDraft] = useState<ModuleDraft>(emptyModuleDraft)
  const [lessonDraft, setLessonDraft] = useState<LessonDraft>(() => emptyLessonDraft())
  const [saving, setSaving] = useState(false)
  const [savingCourse, setSavingCourse] = useState(false)
  const [uploadingMedia, setUploadingMedia] = useState<CourseMediaKind | null>(null)
  const [uploadingCover, setUploadingCover] = useState(false)
  const coverInputRef = useRef<HTMLInputElement | null>(null)
  const visibilityOptions = [
    { value: 'PRIVATE', label: t('visibilityOptions.private') },
    { value: 'PUBLIC', label: t('visibilityOptions.public') },
  ]
  const accessPolicyOptions = [
    { value: 'FREE', label: t('accessPolicyOptions.free') },
    { value: 'PAID', label: t('accessPolicyOptions.paid') },
    {
      value: 'VERIFIED_SPECIAL_NEEDS',
      label: t('accessPolicyOptions.verifiedSpecialNeeds'),
    },
    { value: 'INVITATION_ONLY', label: t('accessPolicyOptions.invitationOnly') },
  ]
  const lessonTypeOptions = [
    { value: 'text', label: t('lessonTypes.text.label') },
    { value: 'video', label: t('lessonTypes.video.label') },
    { value: 'task', label: t('lessonTypes.task.label') },
    { value: 'pdf', label: t('lessonTypes.pdf.label') },
  ]
  const lessonTypeMeta: Record<
    LessonType,
    { label: string; description: string; icon: LucideIcon }
  > = {
    text: {
      label: t('lessonTypes.text.label'),
      description: t('lessonTypes.text.description'),
      icon: FileText,
    },
    video: {
      label: t('lessonTypes.video.label'),
      description: t('lessonTypes.video.description'),
      icon: Video,
    },
    task: {
      label: t('lessonTypes.task.label'),
      description: t('lessonTypes.task.description'),
      icon: ClipboardList,
    },
    pdf: {
      label: t('lessonTypes.pdf.label'),
      description: t('lessonTypes.pdf.description'),
      icon: File,
    },
  }

  const selectedModule = useMemo(() => {
    if (!selection || selection.type === 'new-module') return null
    return modules.find((module) => module.id === selection.moduleId) || null
  }, [modules, selection])

  const selectedLesson = useMemo(() => {
    if (!selection || selection.type !== 'lesson') return null
    return (
      lessonsByModule[selection.moduleId]?.find((lesson) => lesson.id === selection.lessonId) ||
      null
    )
  }, [lessonsByModule, selection])

  const totals = useMemo(() => {
    const loadedLessonCount = Object.values(lessonsByModule).reduce(
      (sum, lessons) => sum + lessons.length,
      0
    )
    return {
      modules: modules.length,
      lessons: Math.max(course?.lessonCount || 0, loadedLessonCount),
    }
  }, [course?.lessonCount, lessonsByModule, modules.length])

  const loadLessons = useCallback(
    async (moduleId: string, force = false) => {
      if (!orgId || (!force && lessonsByModule[moduleId])) return lessonsByModule[moduleId] || []

      setLoadingLessonsFor(moduleId)
      try {
        const res = await apiClient.getModuleLessons(orgId, courseId, moduleId)
        setLessonsByModule((prev) => ({ ...prev, [moduleId]: res.lessons }))
        return res.lessons as Lesson[]
      } catch (err) {
        toast(getErrorMessage(err, t))
        return []
      } finally {
        setLoadingLessonsFor((current) => (current === moduleId ? null : current))
      }
    },
    [courseId, lessonsByModule, orgId, toast, t]
  )

  useEffect(() => {
    if (authLoading || !orgId) return

    setLoading(true)
    setError(null)
    Promise.all([apiClient.getCourse(orgId, courseId), apiClient.getCourseModules(orgId, courseId)])
      .then(([courseRes, modulesRes]) => {
        const nextModules = modulesRes.modules as CourseModule[]
        const nextCourse = courseRes.course as Course
        setCourse(nextCourse)
        setCourseDraft(draftFromCourse(nextCourse))
        setModules(nextModules)

        if (nextModules[0]) {
          setExpandedModules(new Set([nextModules[0].id]))
          setSelection({ type: 'module', moduleId: nextModules[0].id })
          setModuleDraft(draftFromModule(nextModules[0]))
          setLoadingLessonsFor(nextModules[0].id)
          apiClient
            .getModuleLessons(orgId, courseId, nextModules[0].id)
            .then((lessonsRes) => {
              setLessonsByModule((prev) => ({
                ...prev,
                [nextModules[0].id]: lessonsRes.lessons,
              }))
            })
            .catch((err: unknown) => toast(getErrorMessage(err, t)))
            .finally(() => setLoadingLessonsFor(null))
        } else {
          setSelection(isAdmin ? { type: 'new-module' } : null)
          setModuleDraft(emptyModuleDraft())
        }
      })
      .catch((err: unknown) => setError(getErrorMessage(err, t)))
      .finally(() => setLoading(false))
  }, [authLoading, courseId, isAdmin, orgId, toast, t])

  function expandModule(moduleId: string) {
    setExpandedModules((prev) => {
      const next = new Set(prev)
      next.add(moduleId)
      return next
    })
    void loadLessons(moduleId)
  }

  function toggleModule(moduleId: string) {
    setExpandedModules((prev) => {
      const next = new Set(prev)
      if (next.has(moduleId)) {
        next.delete(moduleId)
      } else {
        next.add(moduleId)
        void loadLessons(moduleId)
      }
      return next
    })
  }

  function selectModule(module: CourseModule) {
    setSelection({ type: 'module', moduleId: module.id })
    setModuleDraft(draftFromModule(module))
    expandModule(module.id)
  }

  function startNewModule() {
    setSelection({ type: 'new-module' })
    setModuleDraft(emptyModuleDraft())
  }

  function startNewLesson(moduleId: string) {
    setSelection({ type: 'new-lesson', moduleId })
    setLessonDraft(emptyLessonDraft())
    expandModule(moduleId)
  }

  async function selectLesson(moduleId: string, lesson: Lesson) {
    setSelection({ type: 'lesson', moduleId, lessonId: lesson.id })
    setLessonDraft(draftFromLesson(lesson))
    expandModule(moduleId)
  }

  async function handlePublish() {
    if (!course || !orgId) return
    const nextStatus = isPublishedCourse(course) ? 'DRAFT' : 'PUBLISHED'

    if (nextStatus === 'PUBLISHED') {
      const publishBlocker = getPublishBlocker(course, t)
      if (publishBlocker) {
        toast(publishBlocker, 'warn')
        return
      }
    }

    try {
      await apiClient.updateCourse(orgId, courseId, { status: nextStatus })
      setCourse((prev) => prev && { ...prev, status: nextStatus })
    } catch (err) {
      toast(getCourseUpdateErrorMessage(err, t))
    }
  }

  async function saveCourseSettings() {
    if (!orgId || !course || !courseDraft) return

    const normalizedPrice =
      courseDraft.accessPolicy === 'FREE' ? 0 : Math.max(0, Number(courseDraft.price || 0))

    if (!courseDraft.title.trim()) {
      toast(t('validation.titleRequired'), 'warn')
      return
    }

    if (!courseDraft.description.trim()) {
      toast(t('validation.descriptionRequired'), 'warn')
      return
    }

    if (courseDraft.accessPolicy !== 'FREE' && normalizedPrice <= 0) {
      toast(t('publishErrors.positivePriceRequired'), 'warn')
      return
    }

    setSavingCourse(true)
    try {
      await apiClient.updateCourse(orgId, courseId, {
        title: courseDraft.title.trim(),
        description: courseDraft.description.trim(),
        visibility: courseDraft.visibility,
        accessPolicy: courseDraft.accessPolicy,
        price: normalizedPrice,
        coverImageUrl: courseDraft.coverUrl.trim() || null,
        coverUrl: courseDraft.coverUrl.trim() || null,
      })

      setCourse((prev) =>
        prev
          ? {
              ...prev,
              title: courseDraft.title.trim(),
              description: courseDraft.description.trim(),
              visibility: courseDraft.visibility,
              accessPolicy: courseDraft.accessPolicy,
              price: normalizedPrice,
              coverImageUrl: courseDraft.coverUrl.trim() || null,
              coverUrl: courseDraft.coverUrl.trim() || null,
            }
          : prev
      )
      setCourseDraft((prev) =>
        prev
          ? {
              ...prev,
              title: courseDraft.title.trim(),
              description: courseDraft.description.trim(),
              price: String(normalizedPrice),
              coverUrl: courseDraft.coverUrl.trim(),
            }
          : prev
      )
    } catch (err) {
      toast(getCourseUpdateErrorMessage(err, t))
    } finally {
      setSavingCourse(false)
    }
  }

  async function handleCoverUpload(file: File | undefined) {
    if (!file || !orgId) return
    setUploadingCover(true)
    try {
      const { url } = await apiClient.uploadCourseCoverImage(orgId, file)
      await apiClient.updateCourse(orgId, courseId, { coverImageUrl: url, coverUrl: url })
      setCourse((prev) => prev && { ...prev, coverUrl: url, coverImageUrl: url })
      setCourseDraft((prev) => (prev ? { ...prev, coverUrl: url } : prev))
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : t('errors.coverUpload'))
    } finally {
      setUploadingCover(false)
    }
  }

  async function handleCoverUrlSave(url: string) {
    if (!orgId) return
    try {
      await apiClient.updateCourse(orgId, courseId, { coverImageUrl: url, coverUrl: url })
      setCourse((prev) => prev && { ...prev, coverUrl: url, coverImageUrl: url })
      setCourseDraft((prev) => (prev ? { ...prev, coverUrl: url } : prev))
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : t('errors.coverSave'))
    }
  }

  async function saveModule() {
    if (!orgId || !moduleDraft.title.trim()) return
    setSaving(true)

    try {
      if (selection?.type === 'new-module') {
        const res = await apiClient.createCourseModule(orgId, courseId, {
          title: moduleDraft.title.trim(),
          description: moduleDraft.description.trim() || null,
          order: modules.length,
        })
        const createdModule = res.module as CourseModule
        setModules((prev) => [...prev, createdModule])
        setCourse((prev) =>
          prev ? { ...prev, moduleCount: Math.max(prev.moduleCount + 1, modules.length + 1) } : prev
        )
        setExpandedModules((prev) => new Set(prev).add(createdModule.id))
        setSelection({ type: 'module', moduleId: createdModule.id })
        setModuleDraft(draftFromModule(createdModule))
        setLessonsByModule((prev) => ({ ...prev, [createdModule.id]: [] }))
      } else if (selection?.type === 'module') {
        await apiClient.updateCourseModule(orgId, courseId, selection.moduleId, {
          title: moduleDraft.title.trim(),
          description: moduleDraft.description.trim() || null,
        })
        setModules((prev) =>
          prev.map((module) =>
            module.id === selection.moduleId
              ? {
                  ...module,
                  title: moduleDraft.title.trim(),
                  description: moduleDraft.description.trim() || null,
                }
              : module
          )
        )
      }
    } catch (err) {
      toast(getErrorMessage(err, t))
    } finally {
      setSaving(false)
    }
  }

  async function deleteModule(moduleId: string) {
    if (!orgId || !confirm(t('confirm.deleteModule'))) return

    try {
      await apiClient.deleteCourseModule(orgId, courseId, moduleId)
      const removedLessonCount = lessonsByModule[moduleId]?.length || 0
      const nextModules = modules.filter((module) => module.id !== moduleId)

      setModules(nextModules)
      setLessonsByModule((prev) => {
        const next = { ...prev }
        delete next[moduleId]
        return next
      })
      setExpandedModules((prev) => {
        const next = new Set(prev)
        next.delete(moduleId)
        return next
      })
      setCourse((prev) =>
        prev
          ? {
              ...prev,
              moduleCount: Math.max(0, prev.moduleCount - 1),
              lessonCount: Math.max(0, prev.lessonCount - removedLessonCount),
            }
          : prev
      )

      const nextSelection = nextModules[0]
        ? { type: 'module' as const, moduleId: nextModules[0].id }
        : null
      setSelection(nextSelection)
      setModuleDraft(nextModules[0] ? draftFromModule(nextModules[0]) : emptyModuleDraft())
    } catch (err) {
      toast(getErrorMessage(err, t))
    }
  }

  async function saveLesson() {
    if (!orgId || !selection || !('moduleId' in selection) || !lessonDraft.title.trim()) return
    setSaving(true)

    try {
      const moduleLessons = lessonsByModule[selection.moduleId] || []

      if (selection.type === 'new-lesson') {
        const res = await apiClient.createLesson(
          orgId,
          courseId,
          selection.moduleId,
          buildLessonPayload(lessonDraft, moduleLessons.length)
        )
        const createdLesson = res.lesson as Lesson
        setLessonsByModule((prev) => ({
          ...prev,
          [selection.moduleId]: [...(prev[selection.moduleId] || []), createdLesson],
        }))
        setModules((prev) =>
          prev.map((module) =>
            module.id === selection.moduleId
              ? { ...module, lessonCount: module.lessonCount + 1 }
              : module
          )
        )
        setCourse((prev) => (prev ? { ...prev, lessonCount: prev.lessonCount + 1 } : prev))
        setSelection({
          type: 'lesson',
          moduleId: selection.moduleId,
          lessonId: createdLesson.id,
        })
        setLessonDraft(draftFromLesson(createdLesson))
      } else if (selection.type === 'lesson') {
        await apiClient.updateLesson(
          orgId,
          courseId,
          selection.moduleId,
          selection.lessonId,
          buildLessonPayload(lessonDraft)
        )
        setLessonsByModule((prev) => ({
          ...prev,
          [selection.moduleId]: (prev[selection.moduleId] || []).map((lesson) =>
            lesson.id === selection.lessonId
              ? {
                  ...lesson,
                  ...buildLessonPayload(lessonDraft),
                  title: lessonDraft.title.trim(),
                  type: lessonDraft.type,
                }
              : lesson
          ) as Lesson[],
        }))
      }
    } catch (err) {
      toast(getErrorMessage(err, t))
    } finally {
      setSaving(false)
    }
  }

  async function deleteLesson(moduleId: string, lessonId: string) {
    if (!orgId || !confirm(t('confirm.deleteLesson'))) return

    try {
      await apiClient.deleteLesson(orgId, courseId, moduleId, lessonId)
      setLessonsByModule((prev) => ({
        ...prev,
        [moduleId]: (prev[moduleId] || []).filter((lesson) => lesson.id !== lessonId),
      }))
      setModules((prev) =>
        prev.map((module) =>
          module.id === moduleId
            ? { ...module, lessonCount: Math.max(0, module.lessonCount - 1) }
            : module
        )
      )
      setCourse((prev) =>
        prev ? { ...prev, lessonCount: Math.max(0, prev.lessonCount - 1) } : prev
      )

      if (selection?.type === 'lesson' && selection.lessonId === lessonId) {
        const targetModule = modules.find((item) => item.id === moduleId)
        setSelection(targetModule ? { type: 'module', moduleId } : null)
        setModuleDraft(targetModule ? draftFromModule(targetModule) : emptyModuleDraft())
      }
    } catch (err) {
      toast(getErrorMessage(err, t))
    }
  }

  async function uploadLessonMedia(
    file: File | null | undefined,
    kind: CourseMediaKind,
    onUploaded: (url: string, filename: string) => void
  ) {
    if (!file || !orgId) return

    setUploadingMedia(kind)
    try {
      const uploaded = await apiClient.uploadCourseMedia(orgId, file, kind)
      onUploaded(uploaded.url, uploaded.filename || file.name)
    } catch (err) {
      toast(getErrorMessage(err, t))
    } finally {
      setUploadingMedia(null)
    }
  }

  function renderUploadControl({
    label,
    accept,
    kind,
    onUploaded,
  }: {
    label: string
    accept: string
    kind: CourseMediaKind
    onUploaded: (url: string, filename: string) => void
  }) {
    const isUploading = uploadingMedia === kind

    return (
      <label
        className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:border-primary-200 hover:bg-primary-50 hover:text-primary-700 ${
          !isAdmin || uploadingMedia ? 'pointer-events-none opacity-60' : ''
        }`}
      >
        {isUploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Upload className="h-4 w-4" />
        )}
        {isUploading ? t('actions.uploading') : label}
        <input
          type="file"
          accept={accept}
          className="sr-only"
          disabled={!isAdmin || uploadingMedia !== null}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0]
            event.currentTarget.value = ''
            void uploadLessonMedia(file, kind, onUploaded)
          }}
        />
      </label>
    )
  }

  function renderImageAttachmentField() {
    return (
      <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-4">
        <div className="mb-3 flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-800">{t('lesson.imageTitle')}</h3>
        </div>
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">{t('lesson.imageUrl')}</span>
            <input
              type="url"
              value={lessonDraft.imageUrl}
              onChange={(event) =>
                setLessonDraft((prev) => ({ ...prev, imageUrl: event.target.value }))
              }
              disabled={!isAdmin}
              placeholder="https://..."
              className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 outline-none transition focus:border-primary-400 focus:ring-4 focus:ring-primary-100 disabled:bg-gray-50 disabled:text-gray-500"
            />
          </label>
          <div className="flex items-end">
            {renderUploadControl({
              label: t('lesson.uploadImage'),
              accept: 'image/*',
              kind: 'lesson-image',
              onUploaded: (url, filename) =>
                setLessonDraft((prev) => ({
                  ...prev,
                  imageUrl: url,
                  imageName: filename,
                })),
            })}
          </div>
        </div>
        {lessonDraft.imageUrl && (
          <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lessonDraft.imageUrl}
              alt={lessonDraft.imageName || t('lesson.imageAlt')}
              className="max-h-64 w-full object-cover"
            />
          </div>
        )}
      </div>
    )
  }

  function renderLessonFields() {
    if (lessonDraft.type === 'text') {
      return (
        <label className="block">
          <span className="text-sm font-medium text-gray-700">{t('lesson.content')}</span>
          <textarea
            value={lessonDraft.body}
            onChange={(event) => setLessonDraft((prev) => ({ ...prev, body: event.target.value }))}
            rows={10}
            placeholder={t('lesson.contentPlaceholder')}
            className="mt-2 w-full resize-y rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-800 outline-none transition focus:border-primary-400 focus:ring-4 focus:ring-primary-100"
          />
        </label>
      )
    }

    if (lessonDraft.type === 'video') {
      return (
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
          <div className="block">
            <span className="text-sm font-medium text-gray-700">{t('lesson.video')}</span>
            <div className="mt-2 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
              <input
                type="url"
                value={lessonDraft.videoUrl}
                onChange={(event) =>
                  setLessonDraft((prev) => ({ ...prev, videoUrl: event.target.value }))
                }
                disabled={!isAdmin}
                placeholder="https://..."
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-800 outline-none transition focus:border-primary-400 focus:ring-4 focus:ring-primary-100 disabled:bg-gray-50 disabled:text-gray-500"
              />
              {renderUploadControl({
                label: t('lesson.uploadVideo'),
                accept: 'video/*',
                kind: 'lesson-video',
                onUploaded: (url) =>
                  setLessonDraft((prev) => ({
                    ...prev,
                    videoUrl: url,
                  })),
              })}
            </div>
          </div>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">{t('lesson.minutes')}</span>
            <input
              type="number"
              min="0"
              value={lessonDraft.videoDurationMin}
              onChange={(event) =>
                setLessonDraft((prev) => ({ ...prev, videoDurationMin: event.target.value }))
              }
              placeholder="12"
              className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-800 outline-none transition focus:border-primary-400 focus:ring-4 focus:ring-primary-100"
            />
          </label>
        </div>
      )
    }

    if (lessonDraft.type === 'task') {
      return (
        <div className="grid gap-4">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">{t('lesson.taskDescription')}</span>
            <textarea
              value={lessonDraft.taskDescription}
              onChange={(event) =>
                setLessonDraft((prev) => ({ ...prev, taskDescription: event.target.value }))
              }
              rows={6}
              placeholder={t('lesson.taskDescriptionPlaceholder')}
              className="mt-2 w-full resize-y rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-800 outline-none transition focus:border-primary-400 focus:ring-4 focus:ring-primary-100"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">{t('lesson.taskExample')}</span>
            <textarea
              value={lessonDraft.taskExample}
              onChange={(event) =>
                setLessonDraft((prev) => ({ ...prev, taskExample: event.target.value }))
              }
              rows={4}
              placeholder={t('lesson.taskExamplePlaceholder')}
              className="mt-2 w-full resize-y rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-800 outline-none transition focus:border-primary-400 focus:ring-4 focus:ring-primary-100"
            />
          </label>
        </div>
      )
    }

    return (
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_260px]">
        <div className="block">
          <span className="text-sm font-medium text-gray-700">{t('lesson.pdfFile')}</span>
          <div className="mt-2 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
            <input
              type="url"
              value={lessonDraft.pdfUrl}
              onChange={(event) =>
                setLessonDraft((prev) => ({ ...prev, pdfUrl: event.target.value }))
              }
              disabled={!isAdmin}
              placeholder="https://..."
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-800 outline-none transition focus:border-primary-400 focus:ring-4 focus:ring-primary-100 disabled:bg-gray-50 disabled:text-gray-500"
            />
            {renderUploadControl({
              label: t('lesson.uploadPdf'),
              accept: 'application/pdf,.pdf',
              kind: 'lesson-pdf',
              onUploaded: (url, filename) =>
                setLessonDraft((prev) => ({
                  ...prev,
                  pdfUrl: url,
                  pdfName: prev.pdfName || filename,
                })),
            })}
          </div>
        </div>
        <label className="block">
          <span className="text-sm font-medium text-gray-700">{t('lesson.fileName')}</span>
          <input
            type="text"
            value={lessonDraft.pdfName}
            onChange={(event) =>
              setLessonDraft((prev) => ({ ...prev, pdfName: event.target.value }))
            }
            disabled={!isAdmin}
            placeholder={t('lesson.fileNamePlaceholder')}
            className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-800 outline-none transition focus:border-primary-400 focus:ring-4 focus:ring-primary-100 disabled:bg-gray-50 disabled:text-gray-500"
          />
        </label>
      </div>
    )
  }

  function renderModuleEditor() {
    const isNew = selection?.type === 'new-module'

    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-primary-600">
              {isNew ? t('module.newKicker') : t('module.kicker')}
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-gray-900">
              {isNew ? t('module.newTitle') : selectedModule?.title}
            </h2>
          </div>
          {!isNew && selectedModule && isAdmin && (
            <button
              type="button"
              onClick={() => void deleteModule(selectedModule.id)}
              className="rounded-lg p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-600"
              aria-label={t('module.delete')}
            >
              <Trash2 className="h-5 w-5" />
            </button>
          )}
        </div>

        <div className="grid gap-4">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">{t('module.title')}</span>
            <input
              type="text"
              value={moduleDraft.title}
              onChange={(event) =>
                setModuleDraft((prev) => ({ ...prev, title: event.target.value }))
              }
              disabled={!isAdmin}
              placeholder={t('module.titlePlaceholder')}
              className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-800 outline-none transition focus:border-primary-400 focus:ring-4 focus:ring-primary-100 disabled:bg-gray-50 disabled:text-gray-500"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">{t('module.description')}</span>
            <textarea
              value={moduleDraft.description}
              onChange={(event) =>
                setModuleDraft((prev) => ({ ...prev, description: event.target.value }))
              }
              disabled={!isAdmin}
              rows={5}
              placeholder={t('module.descriptionPlaceholder')}
              className="mt-2 w-full resize-y rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-800 outline-none transition focus:border-primary-400 focus:ring-4 focus:ring-primary-100 disabled:bg-gray-50 disabled:text-gray-500"
            />
          </label>
        </div>

        {isAdmin && (
          <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 pt-5">
            <button
              type="button"
              onClick={() => void saveModule()}
              disabled={saving || !moduleDraft.title.trim()}
              className="btn-primary inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isNew ? t('module.create') : t('module.save')}
            </button>
            {isNew && modules[0] && (
              <button
                type="button"
                onClick={() => selectModule(modules[0])}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
              >
                {t('actions.cancel')}
              </button>
            )}
          </div>
        )}
      </div>
    )
  }

  function renderLessonEditor() {
    if (!selection || !('moduleId' in selection) || !selectedModule) return null

    const isNew = selection.type === 'new-lesson'
    const currentMeta = lessonTypeMeta[lessonDraft.type]
    const CurrentIcon = currentMeta.icon

    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-primary-600">
              {selectedModule.title}
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-gray-900">
              {isNew ? t('lesson.newTitle') : selectedLesson?.title}
            </h2>
          </div>
          {!isNew && selectedLesson && isAdmin && (
            <button
              type="button"
              onClick={() => void deleteLesson(selection.moduleId, selectedLesson.id)}
              className="rounded-lg p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-600"
              aria-label={t('lesson.delete')}
            >
              <Trash2 className="h-5 w-5" />
            </button>
          )}
        </div>

        <div className="rounded-xl border border-primary-100 bg-primary-50/50 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-primary-600 shadow-sm">
              <CurrentIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium text-gray-900">{currentMeta.label}</p>
              <p className="text-sm text-gray-500">{currentMeta.description}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">{t('lesson.title')}</span>
            <input
              type="text"
              value={lessonDraft.title}
              onChange={(event) =>
                setLessonDraft((prev) => ({ ...prev, title: event.target.value }))
              }
              disabled={!isAdmin}
              placeholder={t('lesson.titlePlaceholder')}
              className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-800 outline-none transition focus:border-primary-400 focus:ring-4 focus:ring-primary-100 disabled:bg-gray-50 disabled:text-gray-500"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">{t('lesson.type')}</span>
            <Select
              value={lessonDraft.type}
              onChange={(value) =>
                setLessonDraft((prev) => ({ ...prev, type: value as LessonType }))
              }
              options={lessonTypeOptions}
              disabled={!isAdmin}
              className="mt-2"
              buttonClassName="min-h-[46px]"
            />
          </label>
        </div>

        {renderLessonFields()}
        {renderImageAttachmentField()}

        {isAdmin && (
          <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 pt-5">
            <button
              type="button"
              onClick={() => void saveLesson()}
              disabled={saving || !lessonDraft.title.trim()}
              className="btn-primary inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isNew ? t('lesson.create') : t('lesson.save')}
            </button>
            {isNew && (
              <button
                type="button"
                onClick={() => selectModule(selectedModule)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
              >
                {t('actions.cancel')}
              </button>
            )}
          </div>
        )}
      </div>
    )
  }

  function renderEditor() {
    if (!selection) {
      return (
        <div className="flex min-h-[460px] flex-col items-center justify-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gray-100 text-gray-400">
            <BookOpen className="h-7 w-7" />
          </div>
          <h2 className="mt-4 text-xl font-semibold text-gray-900">{t('editor.emptyTitle')}</h2>
          <p className="mt-2 max-w-sm text-sm text-gray-500">{t('editor.emptyDescription')}</p>
        </div>
      )
    }

    if (selection.type === 'new-module' || selection.type === 'module') {
      return renderModuleEditor()
    }

    return renderLessonEditor()
  }

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
      </div>
    )
  }

  if (error || !course) {
    return <div className="p-6 text-center text-red-500">{error || t('errors.notFound')}</div>
  }

  return (
    <div className="mx-auto max-w-7xl p-6">
      <ToastContainer toasts={toasts} />
      <div className="mb-6 flex items-start gap-3">
        <Link
          href={`/b2b/courses${orgId ? `?orgId=${orgId}` : ''}`}
          className="mt-1 rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h1 className="truncate text-2xl font-bold text-gray-900">{course.title}</h1>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_COLORS[course.status]}`}
            >
              {t(`status.${String(course.status).toLowerCase()}`) || course.status}
            </span>
            {isPublicCourse(course) ? (
              <span className="flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-xs text-blue-700">
                <Globe className="h-3 w-3" />
                {t('visibility.public')}
              </span>
            ) : (
              <span className="flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600">
                <Lock className="h-3 w-3" />
                {t('visibility.privateOnly')}
              </span>
            )}
          </div>
          <p className="max-w-3xl text-sm text-gray-500">{course.description}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-gray-500">
            <span>{t('metrics.modulesCount', { count: totals.modules })}</span>
            <span>{t('metrics.lessonsCount', { count: totals.lessons })}</span>
            <span>{t('metrics.enrollmentsCount', { count: course.enrollmentCount })}</span>
            <span className="font-medium text-gray-700">
              {course.price === 0 ? t('pricing.free') : `${course.price} ${course.currency}`}
            </span>
            {course.accessPolicy && (
              <span>{t(`accessPolicy.${course.accessPolicy}`) ?? course.accessPolicy}</span>
            )}
          </div>
        </div>
        {isAdmin && (
          <div className="flex shrink-0 items-center gap-2">
            <Select
              value={isPublicCourse(course) ? 'PUBLIC' : 'PRIVATE'}
              onChange={async (val) => {
                try {
                  await apiClient.updateCourse(orgId!, courseId, { visibility: val })
                  setCourse((prev) => prev && { ...prev, visibility: val as Course['visibility'] })
                } catch (err: unknown) {
                  toast(err instanceof Error ? err.message : t('errors.generic'))
                }
              }}
              options={[
                { value: 'PRIVATE', label: t('visibilityOptions.privateShort') },
                { value: 'PUBLIC', label: t('visibilityOptions.publicShort') },
              ]}
              buttonClassName="text-sm py-2 min-w-[160px]"
            />
            <button
              type="button"
              onClick={() => void handlePublish()}
              className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                isPublishedCourse(course)
                  ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                  : 'btn-primary'
              }`}
            >
              {isPublishedCourse(course) ? t('publish.unpublish') : t('publish.publish')}
            </button>
          </div>
        )}
      </div>

      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <div className="h-28 w-full overflow-hidden rounded-lg bg-gradient-to-br from-primary-50 to-primary-100 md:w-44 md:shrink-0">
            {course.coverUrl || course.coverImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={course.coverUrl || course.coverImageUrl || ''}
                alt={course.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-primary-200">
                <ImageIcon className="h-8 w-8" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">{t('cover.title')}</h2>
                <p className="mt-1 text-xs text-gray-500">{t('cover.description')}</p>
              </div>
              {course.ownerOrgName && (
                <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-2.5 py-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary-100 text-xs font-bold text-primary-700">
                    {course.ownerOrgName.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-gray-700">{course.ownerOrgName}</span>
                </div>
              )}
            </div>

            {isAdmin && (
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                <label className="min-w-0">
                  <span className="sr-only">{t('cover.url')}</span>
                  <input
                    type="url"
                    value={courseDraft?.coverUrl || ''}
                    onChange={(event) =>
                      setCourseDraft((prev) =>
                        prev ? { ...prev, coverUrl: event.target.value } : prev
                      )
                    }
                    onBlur={(event) => {
                      if (event.target.value !== (course.coverUrl || course.coverImageUrl || '')) {
                        void handleCoverUrlSave(event.target.value)
                      }
                    }}
                    placeholder={t('cover.placeholder')}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                  />
                </label>
                <label
                  className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 ${
                    uploadingCover ? 'pointer-events-none opacity-60' : ''
                  }`}
                >
                  {uploadingCover ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {uploadingCover ? t('actions.uploading') : t('actions.upload')}
                  <input
                    ref={coverInputRef}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(event) => {
                      void handleCoverUpload(event.target.files?.[0])
                      event.target.value = ''
                    }}
                    disabled={uploadingCover}
                  />
                </label>
              </div>
            )}
          </div>
        </div>
      </div>

      {isAdmin && courseDraft && (
        <section className="mb-6 rounded-xl border border-gray-200 bg-white p-5">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{t('settings.title')}</h2>
              <p className="mt-1 text-sm text-gray-500">{t('settings.description')}</p>
            </div>
            <button
              type="button"
              onClick={() => void saveCourseSettings()}
              disabled={savingCourse || uploadingCover}
              className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingCourse ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {t('settings.save')}
            </button>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">{t('fields.courseTitle')}</span>
              <input
                type="text"
                value={courseDraft.title}
                onChange={(event) =>
                  setCourseDraft((prev) => (prev ? { ...prev, title: event.target.value } : prev))
                }
                className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-800 outline-none transition focus:border-primary-400 focus:ring-4 focus:ring-primary-100"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">{t('fields.priceKgs')}</span>
              <input
                type="number"
                min="0"
                step="100"
                value={courseDraft.price}
                disabled={courseDraft.accessPolicy === 'FREE'}
                onChange={(event) =>
                  setCourseDraft((prev) => (prev ? { ...prev, price: event.target.value } : prev))
                }
                className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-800 outline-none transition focus:border-primary-400 focus:ring-4 focus:ring-primary-100 disabled:bg-gray-50 disabled:text-gray-400"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">{t('fields.visibility')}</span>
              <Select
                value={courseDraft.visibility}
                onChange={(value) =>
                  setCourseDraft((prev) =>
                    prev ? { ...prev, visibility: value as 'PRIVATE' | 'PUBLIC' } : prev
                  )
                }
                options={visibilityOptions}
                className="mt-2"
                buttonClassName="min-h-[46px]"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">{t('fields.access')}</span>
              <Select
                value={courseDraft.accessPolicy}
                onChange={(value) =>
                  setCourseDraft((prev) =>
                    prev
                      ? {
                          ...prev,
                          accessPolicy: value as CourseAccessPolicy,
                          price: value === 'FREE' ? '0' : prev.price,
                        }
                      : prev
                  )
                }
                options={accessPolicyOptions}
                className="mt-2"
                buttonClassName="min-h-[46px]"
              />
            </label>
          </div>

          <label className="mt-4 block">
            <span className="text-sm font-medium text-gray-700">
              {t('fields.courseDescription')}
            </span>
            <textarea
              value={courseDraft.description}
              onChange={(event) =>
                setCourseDraft((prev) =>
                  prev ? { ...prev, description: event.target.value } : prev
                )
              }
              rows={4}
              className="mt-2 w-full resize-y rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-800 outline-none transition focus:border-primary-400 focus:ring-4 focus:ring-primary-100"
            />
          </label>

          {courseDraft.accessPolicy !== 'FREE' && Number(courseDraft.price || 0) <= 0 && (
            <div className="mt-4 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
              {t('settings.priceWarning')}
            </div>
          )}
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <section className="self-start rounded-xl border border-gray-200 bg-white">
          <div className="flex items-start justify-between gap-4 border-b border-gray-100 p-5">
            <div>
              <div className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-primary-600" />
                <h2 className="font-semibold text-gray-900">{t('program.title')}</h2>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                {t('program.summary', { modules: totals.modules, lessons: totals.lessons })}
              </p>
            </div>
            {isAdmin && (
              <button
                type="button"
                onClick={startNewModule}
                className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-primary-700 transition hover:bg-primary-50"
              >
                <Plus className="h-4 w-4" />
                {t('module.add')}
              </button>
            )}
          </div>

          {modules.length === 0 ? (
            <div className="p-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 text-gray-400">
                <Layers className="h-6 w-6" />
              </div>
              <p className="mt-3 text-sm text-gray-500">{t('program.emptyModules')}</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {modules.map((module, moduleIndex) => {
                const expanded = expandedModules.has(module.id)
                const lessons = lessonsByModule[module.id]
                const activeModule =
                  selection?.type === 'module' && selection.moduleId === module.id
                const activeNewLesson =
                  selection?.type === 'new-lesson' && selection.moduleId === module.id

                return (
                  <div key={module.id} className="p-3">
                    <div
                      className={`rounded-xl border transition ${
                        activeModule || activeNewLesson
                          ? 'border-primary-200 bg-primary-50/60'
                          : 'border-transparent hover:border-gray-100 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 p-3">
                        <button
                          type="button"
                          onClick={() => toggleModule(module.id)}
                          className="rounded-md p-1 text-gray-400 transition hover:bg-white hover:text-gray-600"
                          aria-label={expanded ? t('module.collapse') : t('module.expand')}
                        >
                          {expanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => selectModule(module)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <span className="block text-xs font-medium uppercase tracking-wide text-gray-400">
                            {t('module.index', { index: moduleIndex + 1 })}
                          </span>
                          <span className="block truncate font-medium text-gray-900">
                            {module.title}
                          </span>
                          <span className="block text-xs text-gray-500">
                            {t('metrics.lessonsCount', { count: module.lessonCount })}
                          </span>
                        </button>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => startNewLesson(module.id)}
                            className="rounded-lg p-2 text-primary-600 transition hover:bg-white"
                            aria-label={t('lesson.add')}
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        )}
                      </div>

                      {expanded && (
                        <div className="space-y-1 border-t border-gray-100 px-3 pb-3 pt-2">
                          {lessons === undefined || loadingLessonsFor === module.id ? (
                            <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-400">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              {t('lesson.loading')}
                            </div>
                          ) : lessons.length === 0 ? (
                            <p className="rounded-lg px-3 py-2 text-sm text-gray-400">
                              {t('lesson.emptyInModule')}
                            </p>
                          ) : (
                            lessons.map((lesson, lessonIndex) => {
                              const activeLesson =
                                selection?.type === 'lesson' && selection.lessonId === lesson.id

                              return (
                                <button
                                  key={lesson.id}
                                  type="button"
                                  onClick={() => void selectLesson(module.id, lesson)}
                                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition ${
                                    activeLesson
                                      ? 'bg-white text-primary-700 shadow-sm ring-1 ring-primary-100'
                                      : 'text-gray-700 hover:bg-white'
                                  }`}
                                >
                                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gray-100 text-gray-500">
                                    <LessonIcon type={lesson.type} className="h-4 w-4" />
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-medium">
                                      {lesson.title}
                                    </span>
                                    <span className="block text-xs text-gray-400">
                                      {t('lesson.indexWithType', {
                                        index: lessonIndex + 1,
                                        type: lessonTypeMeta[lesson.type]?.label || lesson.type,
                                      })}
                                    </span>
                                  </span>
                                </button>
                              )
                            })
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <section className="min-h-[560px] rounded-xl border border-gray-200 bg-white p-6">
          {renderEditor()}
        </section>
      </div>
    </div>
  )
}
