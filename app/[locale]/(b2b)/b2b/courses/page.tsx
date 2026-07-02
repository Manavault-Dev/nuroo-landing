'use client'

import { useEffect, useState } from 'react'
import { Link } from '@/i18n/navigation'
import { usePageAuth } from '@/lib/b2b/usePageAuth'
import { apiClient } from '@/lib/b2b/api'
import { BookOpen, Plus, Globe, Lock, Loader2 } from 'lucide-react'

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

export default function CoursesPage() {
  const { orgId, isAdmin, isLoading: authLoading } = usePageAuth()
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <BookOpen className="w-6 h-6 text-primary-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Курсы</h1>
            <p className="text-sm text-gray-500">Создавайте и публикуйте учебные материалы</p>
          </div>
        </div>
        {isAdmin && (
          <Link
            href={`/b2b/courses/new${orgId ? `?orgId=${orgId}` : ''}`}
            className="btn-primary flex items-center gap-2 text-sm px-4 py-2"
          >
            <Plus className="w-4 h-4" />
            Новый курс
          </Link>
        )}
      </div>

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
        <div className="grid gap-4">
          {courses.map((course) => (
            <Link
              key={course.id}
              href={`/b2b/courses/${course.id}${orgId ? `?orgId=${orgId}` : ''}`}
              className="block bg-white rounded-xl border border-gray-100 p-5 hover:border-primary-200 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-semibold text-gray-900 truncate">{course.title}</h3>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[course.status]}`}
                    >
                      {STATUS_LABELS[course.status] ?? course.status}
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
                </div>
                <div className="text-right shrink-0 text-sm text-gray-500 space-y-1">
                  <div>{course.moduleCount} модулей</div>
                  <div>{course.lessonCount} уроков</div>
                  <div className="font-medium text-gray-700">
                    {course.price === 0 ? 'Бесплатно' : `${course.price} ${course.currency}`}
                  </div>
                  {course.accessPolicy && (
                    <div className="text-xs text-gray-400">
                      {ACCESS_POLICY_LABELS[course.accessPolicy] ?? course.accessPolicy}
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-gray-50 text-xs text-gray-400">
                {course.enrollmentCount} записавшихся
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
