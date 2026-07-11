'use client'

import { Link } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { BookOpen, Globe, Image as ImageIcon, Layers, Lock, Trash2, Users } from 'lucide-react'
import { STATUS_COLORS, isPublicCourse, type Course } from '@/lib/b2b/types/course'

interface CourseCardProps {
  course: Course
  orgId: string
  isAdmin: boolean
  onDelete: (course: Course) => void
}

export function CourseCard({ course, orgId, isAdmin, onDelete }: CourseCardProps) {
  const t = useTranslations('b2b.pages.courses')

  return (
    <Link
      href={`/b2b/courses/${course.id}${orgId ? `?orgId=${orgId}` : ''}`}
      className="group grid overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all hover:border-primary-200 hover:shadow-md sm:grid-cols-[180px_minmax(0,1fr)]"
    >
      {/* Cover */}
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
            {t(`status.${String(course.status).toLowerCase()}`)}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="min-w-0 p-4">
        <div className="mb-2 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <h3 className="truncate text-base font-semibold text-gray-900">{course.title}</h3>
              {isPublicCourse(course) ? (
                <span className="flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                  <Globe className="h-3 w-3" />
                  {t('visibility.public')}
                </span>
              ) : (
                <span className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                  <Lock className="h-3 w-3" />
                  {t('visibility.private')}
                </span>
              )}
            </div>
            <p className="text-xs font-medium uppercase tracking-wide text-primary-600">
              {course.ownerOrgName || 'Nuroo'}
            </p>
          </div>

          <div className="flex items-start gap-2 shrink-0">
            <div className="text-right">
              <div className="text-sm font-semibold text-gray-900">
                {course.price === 0 ? t('pricing.free') : `${course.price} ${course.currency}`}
              </div>
              <div className="max-w-[190px] text-xs leading-4 text-gray-400">
                {t(`accessPolicy.${course.accessPolicy || 'FREE'}`)}
              </div>
            </div>
            {isAdmin && (
              <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onDelete(course)
                }}
                className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                title={t('delete.trigger')}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <p className="line-clamp-2 text-sm leading-5 text-gray-500">{course.description}</p>

        <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-gray-100 pt-3 text-sm">
          <div className="flex items-center gap-1.5 text-gray-500">
            <Layers className="h-4 w-4 text-gray-400" />
            <span className="font-medium text-gray-900">{course.moduleCount}</span>
            <span>{t('metrics.modules')}</span>
          </div>
          <div className="flex items-center gap-1.5 text-gray-500">
            <BookOpen className="h-4 w-4 text-gray-400" />
            <span className="font-medium text-gray-900">{course.lessonCount}</span>
            <span>{t('metrics.lessons')}</span>
          </div>
          <div className="flex items-center gap-1.5 text-gray-500">
            <Users className="h-4 w-4 text-gray-400" />
            <span className="font-medium text-gray-900">{course.enrollmentCount}</span>
            <span>{t('metrics.students')}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}
