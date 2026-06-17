import { z } from 'zod'

import { getFirestore } from '../../infrastructure/database/firebase.js'
import { requireParentOrgAccess } from '../content/orgContentParent.service.js'

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Accepts a number from JSON. Treats null, undefined, NaN as "not provided"
 * (returns undefined). This way the field stays optional and doesn't fail
 * validation when the mobile app sends NaN→null for an empty numeric input.
 */
const safeOptionalInt = z.preprocess(
  (v) =>
    v === null || v === undefined || (typeof v === 'number' && isNaN(v))
      ? undefined
      : typeof v === 'string'
        ? v.trim() === ''
          ? undefined
          : parseInt(v, 10)
        : v,
  z.number().int().optional()
)

// ── Zod schema ─────────────────────────────────────────────────────────────────

const intakeSchema = z.object({
  // 1. General info
  childFullName: z.string().max(200).optional(),
  dateOfBirth: z.string().max(30).optional(),
  ageText: z.string().max(50).optional(),
  homeAddress: z.string().max(500).optional(),
  contactPhone: z.string().max(50).optional(),
  filledBy: z.enum(['mother', 'father', 'guardian', 'other']).optional(),
  filledByOther: z.string().max(100).optional(),

  // 2. Complaints
  mainConcerns: z.string().max(2000).optional(),
  firstNoticedAt: z.string().max(500).optional(),
  previousSpecialists: z.array(z.string()).optional(),
  previousSpecialistsOther: z.string().max(200).optional(),

  // 3. Pregnancy
  motherAgeAtPregnancy: safeOptionalInt,
  pregnancyNumber: z.string().max(50).optional(),
  pregnancyComplications: z.boolean().optional(),
  pregnancyFactors: z.array(z.string()).optional(),
  pregnancyFactorsOther: z.string().max(200).optional(),
  pregnancyHospitalizations: z.string().max(500).optional(),
  gestationWeeks: safeOptionalInt,

  // 4. Birth
  birthTypes: z.array(z.string()).optional(),
  birthComplications: z.boolean().optional(),
  birthFactors: z.array(z.string()).optional(),
  birthFactorsOther: z.string().max(200).optional(),
  weightAtBirth: z.string().max(20).optional(),
  heightAtBirth: z.string().max(20).optional(),
  apgarScore: z.string().max(20).optional(),
  criedImmediately: z.boolean().optional(),
  neededResuscitation: z.boolean().optional(),
  inIncubator: z.boolean().optional(),
  daysInHospital: safeOptionalInt,

  // 5a. Motor development
  heldHeadAt: z.string().max(20).optional(),
  rolledOverAt: z.string().max(20).optional(),
  satAt: z.string().max(20).optional(),
  crawledAt: z.string().max(20).optional(),
  stoodAt: z.string().max(20).optional(),
  walkedAt: z.string().max(20).optional(),
  toneIssues: z.boolean().optional(),
  neurologistBefore3: z.boolean().optional(),

  // 5b. Speech development
  cooingAt: z.string().max(20).optional(),
  babblingAt: z.string().max(20).optional(),
  firstWordsAt: z.string().max(20).optional(),
  phraseSpeechAt: z.string().max(20).optional(),
  speechRegression: z.boolean().optional(),
  understandsSpeech: z.enum(['well', 'partially', 'poorly']).optional(),
  usesGestures: z.boolean().optional(),
  hasEcholalia: z.boolean().optional(),
  speechFeatures: z.array(z.string()).optional(),

  // 5c. Social development
  eyeContact: z.enum(['yes', 'rarely', 'no']).optional(),
  respondsToName: z.enum(['yes', 'sometimes', 'no']).optional(),
  likedCommunication: z.boolean().optional(),
  playedRoleGames: z.boolean().optional(),
  behaviorFeatures: z.array(z.string()).optional(),
  behaviorFeaturesOther: z.string().max(200).optional(),

  // 6. Health
  healthConditions: z.array(z.string()).optional(),
  healthConditionsOther: z.string().max(200).optional(),
  hospitalizations: z.string().max(500).optional(),
  longTermMedications: z.string().max(500).optional(),

  // 7. Nutrition & sleep
  breastfed: z.boolean().optional(),
  breastfedUntil: z.string().max(50).optional(),
  feedingDifficulties: z.boolean().optional(),
  selectiveEating: z.boolean().optional(),
  sleepDisorders: z.boolean().optional(),
  sleepDisordersDescription: z.string().max(500).optional(),

  // 8. Family history
  familyConditions: z.array(z.string()).optional(),
  familyConditionsOther: z.string().max(200).optional(),
  familyConditionsWho: z.string().max(500).optional(),

  // 9. Institutions
  attendedInstitutions: z.array(z.string()).optional(),
  adaptationDescription: z.string().max(500).optional(),
  groupDifficulties: z.string().max(500).optional(),

  // 10. Self-care
  selfCareSkills: z.array(z.string()).optional(),

  // 11. Additional
  additionalInfo: z.string().max(2000).optional(),

  // Set to true only when the parent explicitly submits the completed form.
  // Intermediate "next step" saves must NOT set this.
  submitted: z.boolean().optional(),
})

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Resolve which child document to use for intake.
 *
 * Parents pass their own UID as childId. The backend resolves this to the
 * actual child document ID via `parentUserId` field in the org children
 * collection.  Org members (specialists / admins) pass the real childId.
 *
 * Returns null if the caller has no access to this org/child.
 */
async function resolveIntakeAccess(
  db: FirebaseFirestore.Firestore,
  uid: string,
  orgId: string,
  childId: string
): Promise<{ resolvedChildId: string; isParent: boolean } | null> {
  // ── Try org member first (specialist / admin) ──────────────────────────────
  const memberSnap = await db.doc(`organizations/${orgId}/members/${uid}`).get()
  if (memberSnap.exists && memberSnap.data()?.status === 'active') {
    // Org member: resolve childId directly or via parentUserId fallback
    const directSnap = await db.doc(`organizations/${orgId}/children/${childId}`).get()
    if (directSnap.exists) {
      return { resolvedChildId: childId, isParent: false }
    }
    // Fallback: childId is actually a parentUserId
    const byParent = await db
      .collection(`organizations/${orgId}/children`)
      .where('parentUserId', '==', childId)
      .limit(1)
      .get()
    if (!byParent.empty) {
      return { resolvedChildId: byParent.docs[0].id, isParent: false }
    }
    return null
  }

  // ── Try parent access ──────────────────────────────────────────────────────
  const parentAccess = await requireParentOrgAccess(db, uid, orgId)
  if (!parentAccess) return null

  // Parent's childId is either their own uid or the actual child doc id
  // First try the direct lookup
  const directSnap = await db.doc(`organizations/${orgId}/children/${childId}`).get()
  if (directSnap.exists && directSnap.data()?.parentUserId === uid) {
    return { resolvedChildId: childId, isParent: true }
  }

  // childId is the parent's uid — resolve via parentUserId
  const byParent = await db
    .collection(`organizations/${orgId}/children`)
    .where('parentUserId', '==', uid)
    .limit(1)
    .get()
  if (!byParent.empty) {
    return { resolvedChildId: byParent.docs[0].id, isParent: true }
  }

  // No child doc yet — parent is linked to org but child not assigned yet
  // Allow access using uid as a virtual child ID so parent can still fill form
  if (parentAccess) {
    return { resolvedChildId: uid, isParent: true }
  }

  return null
}

// ── Route ──────────────────────────────────────────────────────────────────────

export const childrenIntakeRoute: import('fastify').FastifyPluginAsync = async (fastify) => {
  /**
   * GET /orgs/:orgId/children/:childId/intake
   * Readable by: org members (specialist/admin) + parent linked to this org
   */
  fastify.get<{ Params: { orgId: string; childId: string } }>(
    '/orgs/:orgId/children/:childId/intake',
    async (request, reply) => {
      try {
        if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })
        const { orgId, childId } = request.params
        const db = getFirestore()

        const access = await resolveIntakeAccess(db, request.user.uid, orgId, childId)
        if (!access) {
          return reply.code(403).send({ error: 'No access to this child intake' })
        }

        const snap = await db
          .doc(`organizations/${orgId}/children/${access.resolvedChildId}/intake/main`)
          .get()

        if (!snap.exists) return { ok: true, intake: null }

        const data = snap.data()!
        return {
          ok: true,
          intake: {
            ...data,
            filledAt: data.filledAt?.toDate?.()?.toISOString?.() ?? data.filledAt ?? null,
            updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() ?? data.updatedAt ?? null,
          },
        }
      } catch (err: unknown) {
        fastify.log.error({ err }, 'Failed to get intake form')
        return reply.code(500).send({ error: 'Failed to get intake form' })
      }
    }
  )

  /**
   * PUT /orgs/:orgId/children/:childId/intake
   * Writable by: parent linked to this org + org members (specialist/admin)
   */
  fastify.put<{
    Params: { orgId: string; childId: string }
    Body: z.infer<typeof intakeSchema>
  }>('/orgs/:orgId/children/:childId/intake', async (request, reply) => {
    try {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })
      const { orgId, childId } = request.params
      const db = getFirestore()

      const access = await resolveIntakeAccess(db, request.user.uid, orgId, childId)
      if (!access) {
        return reply.code(403).send({ error: 'No access to this child intake' })
      }

      const parse = intakeSchema.safeParse(request.body)
      if (!parse.success) {
        fastify.log.warn(
          { orgId, childId, issues: parse.error.errors },
          '[intake] validation failed'
        )
        return reply.code(400).send({ error: 'Invalid intake data', details: parse.error.errors })
      }

      const now = new Date()
      const ref = db.doc(`organizations/${orgId}/children/${access.resolvedChildId}/intake/main`)
      const snap = await ref.get()
      const isNew = !snap.exists

      // Strip the `submitted` flag — it's a signal, not a stored field
      const { submitted, ...formData } = parse.data

      await ref.set(
        {
          ...formData,
          updatedAt: now,
          // Only set filledAt when the parent explicitly submits the completed form.
          // Intermediate "Next step" saves must NOT mark the form as filled.
          ...(submitted ? { filledAt: now, filledByParentUid: request.user.uid } : {}),
        },
        { merge: true }
      )

      fastify.log.info(
        { orgId, resolvedChildId: access.resolvedChildId, isParent: access.isParent, isNew },
        '[intake] form saved'
      )

      return { ok: true, updatedAt: now.toISOString(), isNew }
    } catch (err: unknown) {
      fastify.log.error({ err }, 'Failed to save intake form')
      return reply.code(500).send({ error: 'Failed to save intake form' })
    }
  })
}
