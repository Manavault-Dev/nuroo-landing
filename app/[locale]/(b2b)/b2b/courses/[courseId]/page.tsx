'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Link } from '@/i18n/navigation'
import { usePageAuth } from '@/lib/b2b/usePageAuth'
import { apiClient } from '@/lib/b2b/api'
import {
  ArrowLeft,
  Plus,
  ChevronDown,
  ChevronRight,
  Loader2,
  Globe,
  Lock,
  Trash2,
  Save,
  X,
} from 'lucide-react'

interface Course {
  id: string
  title: string
  description: string
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | 'draft' | 'published' | 'archived'
  visibility: 'PRIVATE' | 'PUBLIC' | 'org_only' | 'marketplace'
  accessPolicy?: 'FREE' | 'PAID' | 'VERIFIED_SPECIAL_NEEDS' | 'INVITATION_ONLY'
  price: number
  currency: string
  moduleCount: number
  lessonCount: number
  enrollmentCount: number
}

interface Module {
  id: string
  title: string
  order: number
  lessonCount: number
}

interface Lesson {
  id: string
  title: string
  type: 'text' | 'video' | 'task' | 'pdf'
  order: number
}

const LESSON_TYPE_LABEL: Record<string, string> = {
  text: 'Текст',
  video: 'Видео',
  task: 'Задание',
  pdf: 'PDF',
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-yellow-100 text-yellow-800',
  PUBLISHED: 'bg-green-100 text-green-800',
  ARCHIVED: 'bg-gray-100 text-gray-600',
  draft: 'bg-yellow-100 text-yellow-800',
  published: 'bg-green-100 text-green-800',
  archived: 'bg-gray-100 text-gray-600',
}

const ACCESS_POLICY_LABELS: Record<string, string> = {
  FREE: 'Бесплатно',
  PAID: 'Платно',
  VERIFIED_SPECIAL_NEEDS: 'Бесплатно для подтвержденных детей',
  INVITATION_ONLY: 'По приглашению',
}

function isPublished(course: Course) {
  return course.status === 'PUBLISHED' || course.status === 'published'
}

function isPublicCourse(course: Course) {
  return course.visibility === 'PUBLIC' || course.visibility === 'marketplace'
}

export default function CourseDetailPage() {
  const params = useParams()
  const courseId = params.courseId as string
  const { orgId, isAdmin } = usePageAuth()

  const [course, setCourse] = useState<Course | null>(null)
  const [modules, setModules] = useState<Module[]>([])
  const [lessonsByModule, setLessonsByModule] = useState<Record<string, Lesson[]>>({})
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [addingModule, setAddingModule] = useState(false)
  const [newModuleTitle, setNewModuleTitle] = useState('')
  const [savingModule, setSavingModule] = useState(false)

  const [addingLessonFor, setAddingLessonFor] = useState<string | null>(null)
  const [newLessonTitle, setNewLessonTitle] = useState('')
  const [newLessonType, setNewLessonType] = useState<'text' | 'video' | 'task' | 'pdf'>('text')
  const [savingLesson, setSavingLesson] = useState(false)

  useEffect(() => {
    if (!orgId) return
    Promise.all([apiClient.getCourse(orgId, courseId), apiClient.getCourseModules(orgId, courseId)])
      .then(([courseRes, modulesRes]) => {
        setCourse(courseRes.course)
        setModules(modulesRes.modules)
      })
      .catch((e: any) => setError(e.message))
      .finally(() => setLoading(false))
  }, [orgId, courseId])

  async function loadLessons(moduleId: string) {
    if (lessonsByModule[moduleId]) return
    try {
      const res = await apiClient.getModuleLessons(orgId!, courseId, moduleId)
      setLessonsByModule((prev) => ({ ...prev, [moduleId]: res.lessons }))
    } catch {
      /* ignore */
    }
  }

  function toggleModule(moduleId: string) {
    setExpandedModules((prev) => {
      const next = new Set(prev)
      if (next.has(moduleId)) {
        next.delete(moduleId)
      } else {
        next.add(moduleId)
        loadLessons(moduleId)
      }
      return next
    })
  }

  async function handlePublish() {
    if (!course || !orgId) return
    const nextStatus = isPublished(course) ? 'DRAFT' : 'PUBLISHED'
    try {
      await apiClient.updateCourse(orgId, courseId, { status: nextStatus })
      setCourse((prev) => prev && { ...prev, status: nextStatus })
    } catch (e: any) {
      alert(e.message)
    }
  }

  async function addModule() {
    if (!newModuleTitle.trim() || !orgId) return
    setSavingModule(true)
    try {
      const res = await apiClient.createCourseModule(orgId, courseId, {
        title: newModuleTitle.trim(),
        order: modules.length,
      })
      setModules((prev) => [...prev, res.module])
      setNewModuleTitle('')
      setAddingModule(false)
    } catch (e: any) {
      alert(e.message)
    } finally {
      setSavingModule(false)
    }
  }

  async function deleteModule(moduleId: string) {
    if (!confirm('Удалить модуль со всеми уроками?') || !orgId) return
    try {
      await apiClient.deleteCourseModule(orgId, courseId, moduleId)
      setModules((prev) => prev.filter((m) => m.id !== moduleId))
      setLessonsByModule((prev) => {
        const next = { ...prev }
        delete next[moduleId]
        return next
      })
    } catch (e: any) {
      alert(e.message)
    }
  }

  async function addLesson(moduleId: string) {
    if (!newLessonTitle.trim() || !orgId) return
    setSavingLesson(true)
    try {
      const currentLessons = lessonsByModule[moduleId] || []
      const res = await apiClient.createLesson(orgId, courseId, moduleId, {
        title: newLessonTitle.trim(),
        type: newLessonType,
        order: currentLessons.length,
      })
      setLessonsByModule((prev) => ({
        ...prev,
        [moduleId]: [...(prev[moduleId] || []), res.lesson],
      }))
      setNewLessonTitle('')
      setAddingLessonFor(null)
    } catch (e: any) {
      alert(e.message)
    } finally {
      setSavingLesson(false)
    }
  }

  async function deleteLesson(moduleId: string, lessonId: string) {
    if (!confirm('Удалить урок?') || !orgId) return
    try {
      await apiClient.deleteLesson(orgId, courseId, moduleId, lessonId)
      setLessonsByModule((prev) => ({
        ...prev,
        [moduleId]: (prev[moduleId] || []).filter((l) => l.id !== lessonId),
      }))
    } catch (e: any) {
      alert(e.message)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
      </div>
    )
  }

  if (error || !course) {
    return <div className="p-6 text-center text-red-500">{error || 'Курс не найден'}</div>
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-3 mb-6">
        <Link
          href={`/b2b/courses${orgId ? `?orgId=${orgId}` : ''}`}
          className="text-gray-400 hover:text-gray-600 transition-colors mt-1"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h1 className="text-xl font-bold text-gray-900 truncate">{course.title}</h1>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[course.status]}`}
            >
              {course.status === 'draft' || course.status === 'DRAFT'
                ? 'Черновик'
                : course.status === 'published' || course.status === 'PUBLISHED'
                  ? 'Опубликован'
                  : 'Архив'}
            </span>
            {isPublicCourse(course) ? (
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 flex items-center gap-1">
                <Globe className="w-3 h-3" />
                Маркетплейс
              </span>
            ) : (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 flex items-center gap-1">
                <Lock className="w-3 h-3" />
                Только для организации
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 line-clamp-2">{course.description}</p>
          <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
            <span>{course.moduleCount} модулей</span>
            <span>{course.lessonCount} уроков</span>
            <span>{course.enrollmentCount} записавшихся</span>
            <span className="font-medium text-gray-600">
              {course.price === 0 ? 'Бесплатно' : `${course.price} ${course.currency}`}
            </span>
            {course.accessPolicy && (
              <span>{ACCESS_POLICY_LABELS[course.accessPolicy] ?? course.accessPolicy}</span>
            )}
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={handlePublish}
            className={`shrink-0 text-sm px-4 py-2 rounded-lg font-medium transition-colors ${
              isPublished(course)
                ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                : 'btn-primary'
            }`}
          >
            {isPublished(course) ? 'Снять с публикации' : 'Опубликовать'}
          </button>
        )}
      </div>

      {/* Modules */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Модули</h2>
          {isAdmin && (
            <button
              onClick={() => setAddingModule(true)}
              className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              Добавить модуль
            </button>
          )}
        </div>

        {modules.length === 0 && !addingModule && (
          <div className="text-center py-10 bg-white rounded-xl border border-dashed border-gray-200 text-sm text-gray-400">
            Нет модулей. Добавьте первый модуль, чтобы начать наполнять курс.
          </div>
        )}

        {modules.map((mod) => {
          const expanded = expandedModules.has(mod.id)
          const lessons = lessonsByModule[mod.id]

          return (
            <div
              key={mod.id}
              className="bg-white rounded-xl border border-gray-100 overflow-hidden"
            >
              <div
                className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => toggleModule(mod.id)}
              >
                {expanded ? (
                  <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 truncate">{mod.title}</p>
                  <p className="text-xs text-gray-400">{mod.lessonCount} уроков</p>
                </div>
                {isAdmin && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteModule(mod.id)
                    }}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {expanded && (
                <div className="border-t border-gray-50 px-4 pb-4 space-y-2 pt-3">
                  {lessons === undefined ? (
                    <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Загрузка...
                    </div>
                  ) : lessons.length === 0 ? (
                    <p className="text-xs text-gray-400 py-1">Нет уроков в этом модуле.</p>
                  ) : (
                    lessons.map((lesson) => (
                      <div
                        key={lesson.id}
                        className="flex items-center gap-3 py-2 px-3 rounded-lg bg-gray-50 group"
                      >
                        <span className="text-xs px-1.5 py-0.5 bg-white border border-gray-200 rounded text-gray-500">
                          {LESSON_TYPE_LABEL[lesson.type] ?? lesson.type}
                        </span>
                        <span className="text-sm text-gray-700 flex-1 truncate">
                          {lesson.title}
                        </span>
                        {isAdmin && (
                          <button
                            onClick={() => deleteLesson(mod.id, lesson.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))
                  )}

                  {isAdmin && (
                    <>
                      {addingLessonFor === mod.id ? (
                        <div className="flex items-center gap-2 pt-1">
                          <select
                            value={newLessonType}
                            onChange={(e) =>
                              setNewLessonType(e.target.value as typeof newLessonType)
                            }
                            className="text-xs rounded border border-gray-200 px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-primary-300"
                          >
                            <option value="text">Текст</option>
                            <option value="video">Видео</option>
                            <option value="task">Задание</option>
                            <option value="pdf">PDF</option>
                          </select>
                          <input
                            autoFocus
                            type="text"
                            value={newLessonTitle}
                            onChange={(e) => setNewLessonTitle(e.target.value)}
                            placeholder="Название урока"
                            className="flex-1 text-sm rounded border border-gray-200 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-300"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') addLesson(mod.id)
                              if (e.key === 'Escape') {
                                setAddingLessonFor(null)
                                setNewLessonTitle('')
                              }
                            }}
                          />
                          <button
                            onClick={() => addLesson(mod.id)}
                            disabled={savingLesson}
                            className="p-1.5 text-primary-600 hover:bg-primary-50 rounded transition-colors"
                          >
                            {savingLesson ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Save className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => {
                              setAddingLessonFor(null)
                              setNewLessonTitle('')
                            }}
                            className="p-1.5 text-gray-400 hover:bg-gray-100 rounded transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setAddingLessonFor(mod.id)
                            setNewLessonTitle('')
                          }}
                          className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1 mt-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Добавить урок
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {/* Add module inline form */}
        {addingModule && (
          <div className="flex items-center gap-2 bg-white rounded-xl border border-primary-200 p-4">
            <input
              autoFocus
              type="text"
              value={newModuleTitle}
              onChange={(e) => setNewModuleTitle(e.target.value)}
              placeholder="Название модуля"
              className="flex-1 text-sm rounded border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-300"
              onKeyDown={(e) => {
                if (e.key === 'Enter') addModule()
                if (e.key === 'Escape') {
                  setAddingModule(false)
                  setNewModuleTitle('')
                }
              }}
            />
            <button
              onClick={addModule}
              disabled={savingModule}
              className="p-2 text-primary-600 hover:bg-primary-50 rounded transition-colors"
            >
              {savingModule ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={() => {
                setAddingModule(false)
                setNewModuleTitle('')
              }}
              className="p-2 text-gray-400 hover:bg-gray-100 rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
