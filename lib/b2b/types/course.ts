// Shared course domain types and constants used across courses pages

export type LessonType = 'text' | 'video' | 'task' | 'pdf'
export type CourseAccessPolicy = 'FREE' | 'PAID' | 'VERIFIED_SPECIAL_NEEDS' | 'INVITATION_ONLY'
export type CourseVisibility = 'PRIVATE' | 'PUBLIC' | 'org_only' | 'marketplace'
export type CourseStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | 'draft' | 'published' | 'archived'

export interface Course {
  id: string
  title: string
  description: string
  coverUrl?: string | null
  coverImageUrl?: string | null
  ownerOrgName?: string | null
  status: CourseStatus
  visibility: CourseVisibility
  accessPolicy?: CourseAccessPolicy
  price: number
  currency: string
  moduleCount: number
  lessonCount: number
  enrollmentCount: number
}

export interface CourseModule {
  id: string
  title: string
  description?: string | null
  order: number
  lessonCount: number
}

export interface Lesson {
  id: string
  title: string
  type: LessonType
  order: number
  body?: string | null
  imageUrl?: string | null
  imageName?: string | null
  videoUrl?: string | null
  videoDurationMin?: number | null
  taskDescription?: string | null
  taskExample?: string | null
  pdfUrl?: string | null
  pdfName?: string | null
}

export const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-yellow-100 text-yellow-800',
  PUBLISHED: 'bg-green-100 text-green-800',
  ARCHIVED: 'bg-gray-100 text-gray-600',
  draft: 'bg-yellow-100 text-yellow-800',
  published: 'bg-green-100 text-green-800',
  archived: 'bg-gray-100 text-gray-600',
}

export function isPublishedCourse(course: Pick<Course, 'status'>): boolean {
  return course.status === 'PUBLISHED' || course.status === 'published'
}

export function isPublicCourse(course: Pick<Course, 'visibility'>): boolean {
  return course.visibility === 'PUBLIC' || course.visibility === 'marketplace'
}
