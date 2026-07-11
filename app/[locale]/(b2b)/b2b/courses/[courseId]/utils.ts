import type { Course, CourseModule, Lesson } from '@/lib/b2b/types/course'
import { isPublicCourse } from '@/lib/b2b/types/course'
import type { CourseSettingsDraft, LessonDraft, ModuleDraft } from './types'

// ─── Publish validation ────────────────────────────────────────────────────────

export function getPublishBlocker(course: Course, t: (key: string) => string): string | null {
  if (!isPublicCourse(course)) return null
  if (!course.title?.trim()) return t('publishErrors.titleRequired')
  if (!course.description?.trim()) return t('publishErrors.descriptionRequired')
  if (!course.coverUrl && !course.coverImageUrl) return t('publishErrors.coverRequired')
  if (course.accessPolicy !== 'FREE' && Number(course.price || 0) <= 0)
    return t('publishErrors.positivePriceRequired')
  return null
}

export function getCourseUpdateErrorMessage(error: unknown, t: (key: string) => string): string {
  const message = error instanceof Error ? error.message : t('errors.generic')
  const knownMessages: Record<string, string> = {
    'Published courses require a title': t('publishErrors.titleRequired'),
    'Published courses require a description': t('publishErrors.descriptionRequired'),
    'Published courses require a cover image': t('publishErrors.coverRequired'),
    'Paid access policies require a positive price': t('publishErrors.positivePriceRequired'),
  }
  return knownMessages[message] || message
}

export function getErrorMessage(error: unknown, t: (key: string) => string): string {
  return error instanceof Error ? error.message : t('errors.generic')
}

// ─── Draft factories ───────────────────────────────────────────────────────────

export function emptyModuleDraft(): ModuleDraft {
  return { title: '', description: '' }
}

export function draftFromModule(module: CourseModule): ModuleDraft {
  return { title: module.title, description: module.description || '' }
}

export function emptyLessonDraft(type: LessonDraft['type'] = 'text'): LessonDraft {
  return {
    title: '',
    type,
    body: '',
    imageUrl: '',
    imageName: '',
    videoUrl: '',
    videoDurationMin: '',
    taskDescription: '',
    taskExample: '',
    pdfUrl: '',
    pdfName: '',
  }
}

export function draftFromLesson(lesson: Lesson): LessonDraft {
  return {
    title: lesson.title,
    type: lesson.type,
    body: lesson.body || '',
    imageUrl: lesson.imageUrl || '',
    imageName: lesson.imageName || '',
    videoUrl: lesson.videoUrl || '',
    videoDurationMin: lesson.videoDurationMin == null ? '' : String(lesson.videoDurationMin),
    taskDescription: lesson.taskDescription || '',
    taskExample: lesson.taskExample || '',
    pdfUrl: lesson.pdfUrl || '',
    pdfName: lesson.pdfName || '',
  }
}

export function draftFromCourse(course: Course): CourseSettingsDraft {
  const visibility =
    course.visibility === 'PUBLIC' || course.visibility === 'marketplace' ? 'PUBLIC' : 'PRIVATE'
  return {
    title: course.title,
    description: course.description,
    visibility,
    accessPolicy: course.accessPolicy || (Number(course.price || 0) > 0 ? 'PAID' : 'FREE'),
    price: String(course.price || 0),
    coverUrl: course.coverUrl || course.coverImageUrl || '',
  }
}

// ─── Payload builder ───────────────────────────────────────────────────────────

export function buildLessonPayload(draft: LessonDraft, order?: number): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    title: draft.title.trim(),
    type: draft.type,
    imageUrl: draft.imageUrl.trim() || null,
    imageName: draft.imageName.trim() || null,
  }

  if (order !== undefined) payload.order = order

  if (draft.type === 'text') {
    payload.body = draft.body.trim() || null
  }
  if (draft.type === 'video') {
    payload.videoUrl = draft.videoUrl.trim() || null
    payload.videoDurationMin = draft.videoDurationMin ? Number(draft.videoDurationMin) : null
  }
  if (draft.type === 'task') {
    payload.taskDescription = draft.taskDescription.trim() || null
    payload.taskExample = draft.taskExample.trim() || null
  }
  if (draft.type === 'pdf') {
    payload.pdfUrl = draft.pdfUrl.trim() || null
    payload.pdfName = draft.pdfName.trim() || null
  }

  return payload
}
