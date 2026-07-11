import type { LessonType, CourseAccessPolicy, CourseVisibility } from '@/lib/b2b/types/course'

export type CourseMediaKind = 'lesson-video' | 'lesson-image' | 'lesson-pdf'

export type Selection =
  | { type: 'new-module' }
  | { type: 'module'; moduleId: string }
  | { type: 'new-lesson'; moduleId: string }
  | { type: 'lesson'; moduleId: string; lessonId: string }

export interface ModuleDraft {
  title: string
  description: string
}

export interface LessonDraft {
  title: string
  type: LessonType
  body: string
  imageUrl: string
  imageName: string
  videoUrl: string
  videoDurationMin: string
  taskDescription: string
  taskExample: string
  pdfUrl: string
  pdfName: string
}

export interface CourseSettingsDraft {
  title: string
  description: string
  visibility: 'PRIVATE' | 'PUBLIC'
  accessPolicy: CourseAccessPolicy
  price: string
  coverUrl: string
}

// Re-export shared types used throughout this page for a single import source
export type { LessonType, CourseAccessPolicy, CourseVisibility }
