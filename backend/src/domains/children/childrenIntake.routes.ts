import { z } from 'zod'

import { getFirestore } from '../../infrastructure/database/firebase.js'
import { requireOrgMember, requireChildAccess } from '../../plugins/rbac.js'

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
  motherAgeAtPregnancy: z.number().int().min(0).max(80).optional(),
  pregnancyNumber: z.string().max(50).optional(),
  pregnancyComplications: z.boolean().optional(),
  pregnancyFactors: z.array(z.string()).optional(),
  pregnancyFactorsOther: z.string().max(200).optional(),
  pregnancyHospitalizations: z.string().max(500).optional(),
  gestationWeeks: z.number().int().min(20).max(45).optional(),

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
  daysInHospital: z.number().int().min(0).optional(),

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
})

// ── Route ──────────────────────────────────────────────────────────────────────

export const childrenIntakeRoute: import('fastify').FastifyPluginAsync = async (fastify) => {
  /** GET intake form — readable by any org member (specialist, admin) */
  fastify.get<{ Params: { orgId: string; childId: string } }>(
    '/orgs/:orgId/children/:childId/intake',
    async (request, reply) => {
      try {
        const { orgId, childId } = request.params
        await requireOrgMember(request, reply, orgId)
        if (reply.sent) return
        const resolvedChildId = await requireChildAccess(request, reply, orgId, childId)
        if (reply.sent) return

        const db = getFirestore()
        const snap = await db
          .doc(`organizations/${orgId}/children/${resolvedChildId}/intake/main`)
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

  /** PUT intake form — parents and org members can write */
  fastify.put<{
    Params: { orgId: string; childId: string }
    Body: z.infer<typeof intakeSchema>
  }>('/orgs/:orgId/children/:childId/intake', async (request, reply) => {
    try {
      const { orgId, childId } = request.params
      await requireOrgMember(request, reply, orgId)
      if (reply.sent) return
      const resolvedChildId = await requireChildAccess(request, reply, orgId, childId)
      if (reply.sent) return

      const parse = intakeSchema.safeParse(request.body)
      if (!parse.success) {
        return reply.code(400).send({ error: 'Invalid intake data', details: parse.error.errors })
      }

      const db = getFirestore()
      const now = new Date()
      const ref = db.doc(`organizations/${orgId}/children/${resolvedChildId}/intake/main`)
      const snap = await ref.get()
      const isNew = !snap.exists

      await ref.set(
        {
          ...parse.data,
          updatedAt: now,
          ...(isNew ? { filledAt: now, filledByParentUid: request.user!.uid } : {}),
        },
        { merge: true }
      )

      return { ok: true, updatedAt: now.toISOString(), isNew }
    } catch (err: unknown) {
      fastify.log.error({ err }, 'Failed to save intake form')
      return reply.code(500).send({ error: 'Failed to save intake form' })
    }
  })
}
