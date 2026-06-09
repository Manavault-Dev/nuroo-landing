import { FastifyPluginAsync } from 'fastify'
import admin from 'firebase-admin'
import { z } from 'zod'

import { getFirestore } from '../../infrastructure/database/firebase.js'
import { requireOrgMember } from '../../plugins/rbac.js'
import { checkOrgHasFeature } from '../../modules/payments/planLimits.js'

const imageSourceSchema = z
  .string()
  .max(900_000)
  .refine((value) => value.startsWith('data:image/') || z.string().url().safeParse(value).success, {
    message: 'Expected an image URL or data:image payload',
  })

/** Valid preset IDs — must stay in sync with frontend PresetId type */
const PRESET_IDS = ['nuroo', 'ocean', 'forest', 'sunset', 'violet'] as const

const brandingSchema = z.object({
  logo: imageSourceSchema.optional().nullable(),
  logoPositionX: z.number().min(0).max(100).optional().nullable(),
  logoPositionY: z.number().min(0).max(100).optional().nullable(),
  logoScale: z.number().min(1).max(2).optional().nullable(),
  name: z.string().max(120).optional().nullable(),
  description: z.string().max(300).optional().nullable(),
  /** @deprecated kept for backward compat */
  primaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional()
    .nullable(),
  /** Active color theme preset (e.g. 'nuroo', 'ocean') */
  presetId: z.enum(PRESET_IDS).optional().nullable(),
  /**
   * Auto-generated CSS variable map from logo color extraction.
   * When present, overrides presetId for theme rendering.
   * Keys: CSS variable names (--brand-*), values: color strings.
   */
  generatedThemeTokens: z
    .record(z.string().max(60), z.string().max(120))
    .optional()
    .nullable(),
  welcomeMessage: z.string().max(400).optional().nullable(),
  coverImage: imageSourceSchema.optional().nullable(),
  coverPositionX: z.number().min(0).max(100).optional().nullable(),
  coverPositionY: z.number().min(0).max(100).optional().nullable(),
  coverScale: z.number().min(1).max(2).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  address: z.string().max(200).optional().nullable(),
  website: z.string().url().max(2000).optional().nullable(),
})

type BrandingData = z.infer<typeof brandingSchema>

function cleanBranding(data: BrandingData): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) result[key] = value ?? null
  }
  return result
}

export const brandingRoute: FastifyPluginAsync = async (fastify) => {
  // GET /public/orgs/:orgId/branding — no auth required (used by parent connect page)
  fastify.get<{ Params: { orgId: string } }>(
    '/public/orgs/:orgId/branding',
    async (request, reply) => {
      try {
        const { orgId } = request.params
        const db = getFirestore()
        const orgSnap = await db.doc(`organizations/${orgId}`).get()

        if (!orgSnap.exists) {
          return reply.code(404).send({ error: 'Organization not found' })
        }

        const data = orgSnap.data()!
        const branding = (data.branding as BrandingData) || null
        // Return only safe public fields — org name always included
        return {
          ok: true,
          orgName: data.name as string,
          branding: branding
            ? {
                logo: branding.logo ?? null,
                logoPositionX: branding.logoPositionX ?? null,
                logoPositionY: branding.logoPositionY ?? null,
                logoScale: branding.logoScale ?? null,
                name: branding.name ?? null,
                description: branding.description ?? null,
                primaryColor: branding.primaryColor ?? null,
                presetId: branding.presetId ?? null,
                generatedThemeTokens: branding.generatedThemeTokens ?? null,
                welcomeMessage: branding.welcomeMessage ?? null,
                coverImage: branding.coverImage ?? null,
                coverPositionX: branding.coverPositionX ?? null,
                coverPositionY: branding.coverPositionY ?? null,
                coverScale: branding.coverScale ?? null,
              }
            : null,
        }
      } catch (error: any) {
        fastify.log.error(error, '[BRANDING] Public GET error')
        return reply.code(500).send({ error: 'Failed to fetch organization' })
      }
    }
  )

  // GET /orgs/:orgId/branding — any org member can read
  fastify.get<{ Params: { orgId: string } }>('/orgs/:orgId/branding', async (request, reply) => {
    try {
      const { orgId } = request.params
      await requireOrgMember(request, reply, orgId)
      if (reply.sent) return

      const db = getFirestore()
      const orgSnap = await db.doc(`organizations/${orgId}`).get()

      if (!orgSnap.exists) {
        return reply.code(404).send({ error: 'Organization not found' })
      }

      const branding = (orgSnap.data()?.branding as BrandingData) || null
      return { ok: true, branding }
    } catch (error: any) {
      fastify.log.error(error, '[BRANDING] GET error')
      return reply.code(500).send({ error: 'Failed to fetch branding' })
    }
  })

  // PUT /orgs/:orgId/branding — org admin only
  fastify.put<{ Params: { orgId: string }; Body: BrandingData }>(
    '/orgs/:orgId/branding',
    async (request, reply) => {
      try {
        const { orgId } = request.params
        const member = await requireOrgMember(request, reply, orgId)
        if (reply.sent) return

        if (member.role !== 'org_admin') {
          return reply.code(403).send({ error: 'Only organization admins can update branding' })
        }

        const featureCheck = await checkOrgHasFeature(orgId, 'branding')
        if (!featureCheck.ok) {
          return reply.code(403).send({ error: featureCheck.error, upgradeRequired: true })
        }

        const body = brandingSchema.parse(request.body)
        const db = getFirestore()
        const orgRef = db.doc(`organizations/${orgId}`)
        const orgSnap = await orgRef.get()

        if (!orgSnap.exists) {
          return reply.code(404).send({ error: 'Organization not found' })
        }

        const current = (orgSnap.data()?.branding as BrandingData) || {}
        const merged = { ...current, ...cleanBranding(body) }

        await orgRef.update({
          branding: merged,
          updatedAt: admin.firestore.Timestamp.fromDate(new Date()),
        })

        return { ok: true, branding: merged }
      } catch (error: any) {
        if (error?.name === 'ZodError') {
          return reply.code(400).send({ error: 'Invalid branding data', details: error.issues })
        }
        fastify.log.error(error, '[BRANDING] PUT error')
        return reply.code(500).send({ error: 'Failed to update branding' })
      }
    }
  )
}
