import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { getFirestore } from '../../infrastructure/database/firebase.js'
import { requireOrgMember } from '../../infrastructure/auth/rbac.js'
import type { SpecialistService } from './types.js'

const RATE = { max: 60, timeWindow: '1 minute' }

const serviceSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).optional().nullable(),
  durationMinutes: z.number().int().min(5).max(480),
  price: z.number().min(0),
  currency: z.string().trim().length(3).default('KGS'),
  specialistId: z.string().trim().min(1),
  intakeFormId: z.string().trim().min(1).optional().nullable(),
})

const updateServiceSchema = serviceSchema.partial().refine((b) => Object.keys(b).length > 0)

function sortByCreatedAtDesc<T extends Record<string, unknown>>(items: T[]): T[] {
  return [...items].sort((a, b) =>
    String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? ''))
  )
}

export const servicesRoute: FastifyPluginAsync = async (fastify) => {
  const db = getFirestore()

  /** GET /orgs/:orgId/services — list services */
  fastify.get<{ Params: { orgId: string } }>(
    '/orgs/:orgId/services',
    { config: { rateLimit: RATE } },
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })
      const { orgId } = request.params
      await requireOrgMember(request, reply, orgId)
      if (reply.sent) return

      const snap = await db
        .collection(`organizations/${orgId}/specialistServices`)
        .where('isActive', '==', true)
        .get()

      return {
        ok: true,
        services: sortByCreatedAtDesc(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      }
    }
  )

  /** POST /orgs/:orgId/services — create service */
  fastify.post<{ Params: { orgId: string } }>(
    '/orgs/:orgId/services',
    { config: { rateLimit: RATE } },
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })
      const { orgId } = request.params
      const member = await requireOrgMember(request, reply, orgId)
      if (reply.sent) return
      if (member.role !== 'org_admin') return reply.code(403).send({ error: 'Forbidden' })

      const parse = serviceSchema.safeParse(request.body)
      if (!parse.success)
        return reply.code(400).send({ error: 'Invalid input', issues: parse.error.issues })

      const now = new Date().toISOString()
      const doc = {
        orgId,
        ...parse.data,
        description: parse.data.description ?? null,
        intakeFormId: parse.data.intakeFormId ?? null,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      }

      const ref = db.collection(`organizations/${orgId}/specialistServices`).doc()
      await ref.set(doc)

      return reply.code(201).send({ ok: true, service: { id: ref.id, ...doc } })
    }
  )

  /** PATCH /orgs/:orgId/services/:serviceId — update service */
  fastify.patch<{ Params: { orgId: string; serviceId: string } }>(
    '/orgs/:orgId/services/:serviceId',
    { config: { rateLimit: RATE } },
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })
      const { orgId, serviceId } = request.params
      const member = await requireOrgMember(request, reply, orgId)
      if (reply.sent) return
      if (member.role !== 'org_admin') return reply.code(403).send({ error: 'Forbidden' })

      const parse = updateServiceSchema.safeParse(request.body)
      if (!parse.success) return reply.code(400).send({ error: 'Invalid input' })

      const ref = db.doc(`organizations/${orgId}/specialistServices/${serviceId}`)
      const snap = await ref.get()
      if (!snap.exists) return reply.code(404).send({ error: 'Service not found' })

      await ref.update({ ...parse.data, updatedAt: new Date().toISOString() })

      return { ok: true }
    }
  )

  /** DELETE /orgs/:orgId/services/:serviceId — soft delete */
  fastify.delete<{ Params: { orgId: string; serviceId: string } }>(
    '/orgs/:orgId/services/:serviceId',
    { config: { rateLimit: RATE } },
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })
      const { orgId, serviceId } = request.params
      const member = await requireOrgMember(request, reply, orgId)
      if (reply.sent) return
      if (member.role !== 'org_admin') return reply.code(403).send({ error: 'Forbidden' })

      const ref = db.doc(`organizations/${orgId}/specialistServices/${serviceId}`)
      const snap = await ref.get()
      if (!snap.exists) return reply.code(404).send({ error: 'Service not found' })

      await ref.update({ isActive: false, updatedAt: new Date().toISOString() })

      return { ok: true }
    }
  )

  /** GET /marketplace/organizations/:orgId/specialists/:specialistId/services — public */
  fastify.get<{ Params: { orgId: string; specialistId: string } }>(
    '/marketplace/organizations/:orgId/specialists/:specialistId/services',
    { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const { orgId, specialistId } = request.params

      const orgSnap = await db.doc(`organizations/${orgId}`).get()
      if (!orgSnap.exists) {
        return reply.code(404).send({ error: 'Organization not found' })
      }

      const snap = await db
        .collection(`organizations/${orgId}/specialistServices`)
        .where('specialistId', '==', specialistId)
        .get()

      return {
        ok: true,
        services: snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as SpecialistService)
          .filter((data) => data.isActive)
          .map((data) => ({
            id: data.id,
            name: data.name,
            description: data.description,
            durationMinutes: data.durationMinutes,
            price: data.price,
            currency: data.currency,
          })),
      }
    }
  )
}
