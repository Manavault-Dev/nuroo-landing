import type { getFirestore } from '../../infrastructure/database/firebase.js'
import type {
  ChildVerificationDoc,
  ChildVerificationStatus,
  CourseAccessDecision,
  CourseAccessPolicy,
  CourseDoc,
  CourseEntitlementDoc,
  CourseEntitlementSource,
  CourseStatus,
  CourseVisibility,
  EnrollmentDoc,
} from './courses.types.js'

type FirestoreDb = ReturnType<typeof getFirestore>

export function nowIso(): string {
  return new Date().toISOString()
}

export function entitlementIdFor(orgId: string, courseId: string): string {
  return `${orgId}_${courseId}`
}

export function normalizeCourseStatus(status: CourseDoc['status'] | undefined): CourseStatus {
  if (status === 'published' || status === 'PUBLISHED') return 'PUBLISHED'
  if (status === 'archived' || status === 'ARCHIVED') return 'ARCHIVED'
  return 'DRAFT'
}

export function normalizeCourseVisibility(
  visibility: CourseDoc['visibility'] | undefined
): CourseVisibility {
  if (visibility === 'marketplace' || visibility === 'PUBLIC') return 'PUBLIC'
  return 'PRIVATE'
}

export function normalizeAccessPolicy(course: Partial<CourseDoc>): CourseAccessPolicy {
  if (course.accessPolicy) return course.accessPolicy
  return Number(course.price || 0) > 0 ? 'PAID' : 'FREE'
}

export function isPublishedPublicCourse(course: CourseDoc): boolean {
  return (
    normalizeCourseStatus(course.status) === 'PUBLISHED' &&
    normalizeCourseVisibility(course.visibility) === 'PUBLIC'
  )
}

export function publicCoursePayload(course: CourseDoc) {
  const accessPolicy = normalizeAccessPolicy(course)

  return {
    ...course,
    ownerOrgId: course.ownerOrgId || course.orgId,
    coverUrl: course.coverUrl || course.coverImageUrl,
    status: normalizeCourseStatus(course.status),
    visibility: normalizeCourseVisibility(course.visibility),
    accessPolicy,
    price: accessPolicy === 'FREE' ? 0 : Number(course.price || 0),
    currency: course.currency || 'KGS',
  }
}

async function getActiveEntitlement(
  db: FirestoreDb,
  userId: string,
  orgId: string,
  courseId: string
): Promise<CourseEntitlementDoc | null> {
  const snap = await db.doc(`users/${userId}/courseEntitlements/${entitlementIdFor(orgId, courseId)}`).get()
  if (!snap.exists) {
    const enrollmentSnap = await db
      .doc(`organizations/${orgId}/courses/${courseId}/enrollments/${userId}`)
      .get()
    if (!enrollmentSnap.exists) return null

    const enrollment = enrollmentSnap.data() as EnrollmentDoc
    if (enrollment.status !== 'ACTIVE' && enrollment.status !== 'active') return null

    return {
      id: entitlementIdFor(orgId, courseId),
      courseId,
      orgId,
      userId,
      childId: enrollment.childId,
      source: enrollment.accessSource || (enrollment.pricePaid > 0 ? 'PURCHASE' : 'FREE_POLICY'),
      status: 'ACTIVE',
      pricePaid: enrollment.pricePaid || 0,
      currency: enrollment.currency || 'KGS',
      createdAt: enrollment.enrolledAt,
      updatedAt: enrollment.lastAccessedAt || enrollment.enrolledAt,
    }
  }

  const entitlement = { id: snap.id, ...snap.data() } as CourseEntitlementDoc
  return entitlement.status === 'ACTIVE' ? entitlement : null
}

async function getVerificationStatus(
  db: FirestoreDb,
  userId: string,
  childId?: string
): Promise<{ status: ChildVerificationStatus | 'NONE'; childId?: string }> {
  let query = db
    .collection('childVerifications')
    .where('parentUserId', '==', userId)
    .orderBy('updatedAt', 'desc')
    .limit(10)

  if (childId) {
    query = db
      .collection('childVerifications')
      .where('parentUserId', '==', userId)
      .where('childId', '==', childId)
      .orderBy('updatedAt', 'desc')
      .limit(1)
  }

  const snap = await query.get()
  if (snap.empty) return { status: 'NONE' }

  const approved = snap.docs.find((doc) => doc.data().status === 'APPROVED')
  if (approved) {
    const data = approved.data() as ChildVerificationDoc
    return { status: 'APPROVED', childId: data.childId }
  }

  const latest = snap.docs[0].data() as ChildVerificationDoc
  return { status: latest.status || 'NONE', childId: latest.childId }
}

export async function decideCourseAccess(
  db: FirestoreDb,
  course: CourseDoc,
  userId: string,
  childId?: string
): Promise<CourseAccessDecision> {
  const normalized = publicCoursePayload(course)
  const activeEntitlement = await getActiveEntitlement(db, userId, normalized.orgId, normalized.id)

  if (activeEntitlement) {
    return {
      canAccess: true,
      requiresPayment: false,
      freeReason: activeEntitlement.source,
      price: normalized.price,
      currency: normalized.currency,
      accessPolicy: normalized.accessPolicy,
      entitlement: activeEntitlement,
    }
  }

  if (normalized.accessPolicy === 'FREE') {
    return {
      canAccess: true,
      requiresPayment: false,
      freeReason: 'FREE_POLICY',
      price: 0,
      currency: normalized.currency,
      accessPolicy: normalized.accessPolicy,
    }
  }

  if (normalized.accessPolicy === 'VERIFIED_SPECIAL_NEEDS') {
    const verification = await getVerificationStatus(db, userId, childId)
    if (verification.status === 'APPROVED') {
      return {
        canAccess: true,
        requiresPayment: false,
        freeReason: 'APPROVED_SPECIAL_NEEDS',
        price: normalized.price,
        currency: normalized.currency,
        accessPolicy: normalized.accessPolicy,
        verificationStatus: verification.status,
      }
    }

    return {
      canAccess: false,
      requiresPayment: normalized.price > 0,
      blockedReason: normalized.price > 0 ? 'PAYMENT_REQUIRED' : undefined,
      price: normalized.price,
      currency: normalized.currency,
      accessPolicy: normalized.accessPolicy,
      verificationStatus: verification.status,
    }
  }

  if (normalized.accessPolicy === 'INVITATION_ONLY') {
    return {
      canAccess: false,
      requiresPayment: false,
      blockedReason: 'INVITATION_REQUIRED',
      price: normalized.price,
      currency: normalized.currency,
      accessPolicy: normalized.accessPolicy,
    }
  }

  return {
    canAccess: false,
    requiresPayment: normalized.price > 0,
    blockedReason: 'PAYMENT_REQUIRED',
    price: normalized.price,
    currency: normalized.currency,
    accessPolicy: normalized.accessPolicy,
  }
}

export async function grantCourseEntitlement(
  db: FirestoreDb,
  course: CourseDoc,
  userId: string,
  source: CourseEntitlementSource,
  childId?: string,
  pricePaid = 0
): Promise<CourseEntitlementDoc> {
  const normalized = publicCoursePayload(course)
  const ts = nowIso()
  const id = entitlementIdFor(normalized.orgId, normalized.id)
  const entitlement: CourseEntitlementDoc = {
    id,
    courseId: normalized.id,
    orgId: normalized.orgId,
    userId,
    childId,
    source,
    status: 'ACTIVE',
    pricePaid,
    currency: normalized.currency,
    createdAt: ts,
    updatedAt: ts,
  }

  await db.doc(`users/${userId}/courseEntitlements/${id}`).set(entitlement, { merge: true })
  return entitlement
}

export async function createEnrollmentFromEntitlement(
  db: FirestoreDb,
  course: CourseDoc,
  entitlement: CourseEntitlementDoc
): Promise<EnrollmentDoc> {
  const normalized = publicCoursePayload(course)
  const ts = nowIso()
  const enrollRef = db.doc(
    `organizations/${normalized.orgId}/courses/${normalized.id}/enrollments/${entitlement.userId}`
  )
  const enrollment: EnrollmentDoc = {
    id: entitlement.userId,
    courseId: normalized.id,
    orgId: normalized.orgId,
    userId: entitlement.userId,
    childId: entitlement.childId,
    entitlementId: entitlement.id,
    status: 'ACTIVE',
    pricePaid: entitlement.pricePaid,
    currency: entitlement.currency,
    accessSource: entitlement.source,
    enrolledAt: ts,
    lastAccessedAt: ts,
  }

  await enrollRef.set(enrollment, { merge: true })
  return enrollment
}
