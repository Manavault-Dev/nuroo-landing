export type LessonType = 'text' | 'video' | 'task' | 'pdf'
export type CourseStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
export type LegacyCourseStatus = 'draft' | 'published' | 'archived'
export type CourseVisibility = 'PRIVATE' | 'PUBLIC'
export type LegacyCourseVisibility = 'org_only' | 'marketplace'
export type CourseAccessPolicy = 'FREE' | 'PAID' | 'VERIFIED_SPECIAL_NEEDS' | 'INVITATION_ONLY'
export type EnrollmentStatus = 'ACTIVE' | 'COMPLETED' | 'REFUNDED'
export type LegacyEnrollmentStatus = 'active' | 'completed' | 'refunded'
export type CourseEntitlementSource =
  | 'FREE_POLICY'
  | 'PURCHASE'
  | 'APPROVED_SPECIAL_NEEDS'
  | 'INVITATION'
export type CourseEntitlementStatus = 'ACTIVE' | 'REVOKED'
export type ChildVerificationStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface LessonDoc {
  id: string
  moduleId: string
  courseId: string
  orgId: string
  title: string
  type: LessonType
  order: number
  // text lesson
  body?: string
  // shared lesson media
  imageUrl?: string
  imageName?: string
  // video lesson
  videoUrl?: string
  videoDurationMin?: number
  // task lesson
  taskDescription?: string
  taskExample?: string
  // pdf lesson
  pdfUrl?: string
  pdfName?: string
  createdAt: string
  updatedAt: string
}

export interface ModuleDoc {
  id: string
  courseId: string
  orgId: string
  title: string
  description?: string
  order: number
  lessonCount: number
  createdAt: string
  updatedAt: string
}

export interface CourseDoc {
  id: string
  orgId: string
  ownerOrgId: string
  ownerOrgName?: string
  ownerOrgLogo?: string
  title: string
  description: string
  coverImageUrl?: string
  coverUrl?: string
  targetAudience?: string
  ageRange?: string
  category?: string
  difficulty?: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'
  tags: string[]
  status: CourseStatus | LegacyCourseStatus
  visibility: CourseVisibility | LegacyCourseVisibility
  accessPolicy: CourseAccessPolicy
  price: number
  currency: string // 'KGS'
  moduleCount: number
  lessonCount: number
  enrollmentCount: number
  createdBy: string // uid
  createdAt: string
  updatedAt: string
  publishedAt?: string
}

export interface EnrollmentDoc {
  id: string
  courseId: string
  orgId: string
  userId: string // parent uid
  childId?: string | null
  entitlementId?: string
  status: EnrollmentStatus | LegacyEnrollmentStatus
  pricePaid: number
  currency: string
  accessSource?: CourseEntitlementSource
  enrolledAt: string
  completedAt?: string
  lastAccessedAt?: string
}

export interface CourseEntitlementDoc {
  id: string
  courseId: string
  orgId: string
  userId: string
  childId?: string | null
  source: CourseEntitlementSource
  status: CourseEntitlementStatus
  pricePaid: number
  currency: string
  createdAt: string
  updatedAt: string
  revokedAt?: string
}

export interface ChildVerificationDoc {
  id: string
  childId: string
  parentUserId: string
  courseId?: string
  orgId?: string
  status: ChildVerificationStatus
  documentRefs: string[]
  note?: string
  rejectionReason?: string
  reviewedBy?: string
  reviewedAt?: string
  createdAt: string
  updatedAt: string
}

export interface CourseAccessDecision {
  canAccess: boolean
  requiresPayment: boolean
  freeReason?: CourseEntitlementSource
  blockedReason?: 'PAYMENT_REQUIRED' | 'INVITATION_REQUIRED'
  price: number
  currency: string
  accessPolicy: CourseAccessPolicy
  verificationStatus?: ChildVerificationStatus | 'NONE'
  entitlement?: CourseEntitlementDoc
}

export interface LessonProgressDoc {
  userId: string
  courseId: string
  lessonId: string
  completedAt: string
}
