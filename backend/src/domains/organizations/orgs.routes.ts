import multipart from '@fastify/multipart'
import { FastifyPluginAsync } from 'fastify'
import admin from 'firebase-admin'
import { z } from 'zod'

import { getFirestore, getStorageBucket } from '../../infrastructure/database/firebase.js'
import { FREE_TRIAL_DAYS, FREE_TRIAL_PLAN_ID } from '../../modules/payments/planLimits.js'
import { requireOrgMember } from '../../plugins/rbac.js'

const createOrgSchema = z.object({
  name: z.string().trim().min(1).max(200),
  country: z.string().trim().max(100).optional(),
})

const imageSourceSchema = z
  .string()
  .trim()
  .max(900_000)
  .refine((value) => value.startsWith('data:image/') || z.string().url().safeParse(value).success, {
    message: 'Must be a valid URL or uploaded image',
  })

const uploadKindSchema = z.enum(['logo', 'cover'])
const imagePositionSchema = z.number().min(0).max(100).optional().nullable()
const imageScaleSchema = z.number().min(1).max(2).optional().nullable()

function parseDataImageUrl(value: string): { mimeType: string; buffer: Buffer } | null {
  const match = value.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/)
  if (!match) return null

  try {
    return {
      mimeType: match[1],
      buffer: Buffer.from(match[2], 'base64'),
    }
  } catch {
    return null
  }
}

async function uploadOrgMarketplaceImage(
  orgId: string,
  kind: 'logo' | 'cover',
  mediaBuffer: Buffer,
  mediaMimetype: string,
  mediaFilename: string
) {
  const bucket = await getStorageBucket()
  const safeName = mediaFilename.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `orgs/${orgId}/marketplace/${kind}/${Date.now()}-${safeName}`
  const file = bucket.file(storagePath)

  await file.save(mediaBuffer, {
    contentType: mediaMimetype || undefined,
    metadata: {
      cacheControl: 'public, max-age=31536000',
    },
  })
  await file.makePublic()

  return `https://storage.googleapis.com/${bucket.name}/${storagePath}`
}

const updateOrgSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    country: z.string().trim().max(100).optional(),
    city: z.string().trim().max(100).optional(),
    categories: z.array(z.string().trim().min(1).max(100)).max(20).optional(),
    // Marketplace profile fields
    description: z.string().trim().max(1000).optional(),
    address: z.string().trim().max(300).optional(),
    contactPhone: z
      .string()
      .trim()
      .max(50)
      .regex(/^[+\d\s\-().]*$/, 'Invalid phone format')
      .optional(),
    whatsappNumber: z
      .string()
      .trim()
      .max(50)
      .regex(/^[+\d\s\-().]*$/, 'Invalid phone format')
      .optional(),
    websiteUrl: z.string().trim().max(500).url('Must be a valid URL').optional().or(z.literal('')),
    logoUrl: imageSourceSchema.optional().or(z.literal('')),
    coverImageUrl: imageSourceSchema.optional().or(z.literal('')),
    logoPositionX: imagePositionSchema,
    logoPositionY: imagePositionSchema,
    logoScale: imageScaleSchema,
    coverPositionX: imagePositionSchema,
    coverPositionY: imagePositionSchema,
    coverScale: imageScaleSchema,
    isPublicMarketplaceEnabled: z.boolean().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: 'At least one field must be provided',
  })

export const orgsRoute: FastifyPluginAsync = async (fastify) => {
  await fastify.register(multipart, { limits: { fileSize: 8 * 1024 * 1024 } })

  fastify.post<{ Body: z.infer<typeof createOrgSchema> }>('/orgs', async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    const db = getFirestore()
    const { uid, email } = request.user
    const body = createOrgSchema.parse(request.body)
    const now = new Date()
    const trialExpiresAt = new Date(now)
    trialExpiresAt.setDate(trialExpiresAt.getDate() + FREE_TRIAL_DAYS)

    const existing = await db
      .collection('organizations')
      .where('createdBy', '==', uid)
      .where('name', '==', body.name)
      .limit(1)
      .get()

    if (!existing.empty) {
      return reply.code(400).send({ error: 'You already have an organization with this name' })
    }

    const orgRef = db.collection('organizations').doc()
    const orgId = orgRef.id

    await orgRef.set({
      name: body.name,
      country: body.country || null,
      createdAt: admin.firestore.Timestamp.fromDate(now),
      createdBy: uid,
      isActive: true,
      billingPlan: null,
      billing: {
        provider: 'manual',
        status: 'trialing',
        plan: FREE_TRIAL_PLAN_ID,
        trialEndsAt: admin.firestore.Timestamp.fromDate(trialExpiresAt),
        currentPeriodEnd: null,
        updatedAt: admin.firestore.Timestamp.fromDate(now),
      },
      freeTrial: {
        planId: FREE_TRIAL_PLAN_ID,
        startedAt: admin.firestore.Timestamp.fromDate(now),
        expiresAt: admin.firestore.Timestamp.fromDate(trialExpiresAt),
      },
    })

    await orgRef
      .collection('members')
      .doc(uid)
      .set({
        uid,
        role: 'org_admin',
        status: 'active',
        joinedAt: admin.firestore.Timestamp.fromDate(now),
      })

    await db.doc(`specialists/${uid}/organizations/${orgId}`).set({
      orgId,
      orgName: body.name,
      country: body.country || null,
      role: 'org_admin',
      status: 'active',
      updatedAt: admin.firestore.Timestamp.fromDate(now),
    })

    const specialistRef = db.doc(`specialists/${uid}`)
    const specialistSnap = await specialistRef.get()
    if (specialistSnap.exists) {
      await specialistRef.update({
        orgId,
        role: 'org_admin',
        updatedAt: admin.firestore.Timestamp.fromDate(now),
      })
    } else {
      await specialistRef.set({
        uid,
        email: email || '',
        fullName: email?.split('@')[0] || 'Specialist',
        orgId,
        role: 'org_admin',
        createdAt: admin.firestore.Timestamp.fromDate(now),
        updatedAt: admin.firestore.Timestamp.fromDate(now),
      })
    }

    return {
      ok: true,
      orgId,
      name: body.name,
      country: body.country || null,
      role: 'org_admin',
    }
  })

  fastify.patch<{
    Params: { orgId: string }
    Body: z.infer<typeof updateOrgSchema>
  }>('/orgs/:orgId', async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    const { orgId } = request.params
    const member = await requireOrgMember(request, reply, orgId)
    if (reply.sent) return

    if (member.role !== 'org_admin') {
      request.log.warn(
        { orgId, uid: request.user.uid, role: member.role },
        '[ORG_UPDATE_FORBIDDEN] User is not an organization admin'
      )
      return reply.code(403).send({ error: 'Only organization admins can perform this action' })
    }

    const parseResult = updateOrgSchema.safeParse(request.body)
    if (!parseResult.success) {
      return reply.code(400).send({
        error: 'Invalid organization update',
        issues: parseResult.error.issues,
      })
    }

    const body = parseResult.data
    const db = getFirestore()
    const orgRef = db.doc(`organizations/${orgId}`)
    const orgSnap = await orgRef.get()

    if (!orgSnap.exists) {
      return reply.code(404).send({ error: 'Organization not found' })
    }

    const updateData: Record<string, unknown> = {
      updatedAt: admin.firestore.Timestamp.fromDate(new Date()),
    }

    let logoUrl = body.logoUrl
    if (typeof logoUrl === 'string' && logoUrl.startsWith('data:image/')) {
      const parsed = parseDataImageUrl(logoUrl)
      if (!parsed) {
        return reply.code(400).send({ error: 'Invalid logo image payload' })
      }
      logoUrl = await uploadOrgMarketplaceImage(
        orgId,
        'logo',
        parsed.buffer,
        parsed.mimeType,
        'logo-upload'
      )
    }

    let coverImageUrl = body.coverImageUrl
    if (typeof coverImageUrl === 'string' && coverImageUrl.startsWith('data:image/')) {
      const parsed = parseDataImageUrl(coverImageUrl)
      if (!parsed) {
        return reply.code(400).send({ error: 'Invalid cover image payload' })
      }
      coverImageUrl = await uploadOrgMarketplaceImage(
        orgId,
        'cover',
        parsed.buffer,
        parsed.mimeType,
        'cover-upload'
      )
    }

    if (body.name !== undefined) updateData.name = body.name
    if (body.country !== undefined) updateData.country = body.country || null
    if (body.city !== undefined) updateData.city = body.city || null
    if (body.categories !== undefined) updateData.categories = body.categories
    if (body.description !== undefined) updateData.description = body.description || null
    if (body.address !== undefined) updateData.address = body.address || null
    if (body.contactPhone !== undefined) updateData.contactPhone = body.contactPhone || null
    if (body.whatsappNumber !== undefined) updateData.whatsappNumber = body.whatsappNumber || null
    if (body.websiteUrl !== undefined) updateData.websiteUrl = body.websiteUrl || null
    if (body.logoUrl !== undefined) updateData.logoUrl = logoUrl || null
    if (body.coverImageUrl !== undefined) updateData.coverImageUrl = coverImageUrl || null
    if (body.logoPositionX !== undefined) updateData.logoPositionX = body.logoPositionX
    if (body.logoPositionY !== undefined) updateData.logoPositionY = body.logoPositionY
    if (body.logoScale !== undefined) updateData.logoScale = body.logoScale
    if (body.coverPositionX !== undefined) updateData.coverPositionX = body.coverPositionX
    if (body.coverPositionY !== undefined) updateData.coverPositionY = body.coverPositionY
    if (body.coverScale !== undefined) updateData.coverScale = body.coverScale
    if (body.isPublicMarketplaceEnabled !== undefined)
      updateData.isPublicMarketplaceEnabled = body.isPublicMarketplaceEnabled

    await orgRef.update(updateData)

    const updatedSnap = await orgRef.get()
    const data = updatedSnap.data()!

    return {
      ok: true,
      org: {
        id: updatedSnap.id,
        name: data.name,
        country: data.country ?? null,
        city: data.city ?? null,
        categories: data.categories ?? [],
        description: data.description ?? null,
        address: data.address ?? null,
        contactPhone: data.contactPhone ?? null,
        whatsappNumber: data.whatsappNumber ?? null,
        websiteUrl: data.websiteUrl ?? null,
        logoUrl: data.logoUrl ?? null,
        coverImageUrl: data.coverImageUrl ?? null,
        logoPositionX: data.logoPositionX ?? null,
        logoPositionY: data.logoPositionY ?? null,
        logoScale: data.logoScale ?? null,
        coverPositionX: data.coverPositionX ?? null,
        coverPositionY: data.coverPositionY ?? null,
        coverScale: data.coverScale ?? null,
        isPublicMarketplaceEnabled: data.isPublicMarketplaceEnabled ?? false,
        createdBy: data.createdBy,
        createdAt: data.createdAt?.toDate?.() || new Date(),
        isActive: data.isActive ?? true,
        billingPlan: data.billingPlan ?? null,
      },
    }
  })

  fastify.post<{ Params: { orgId: string } }>('/orgs/:orgId/media', async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    const { orgId } = request.params
    const member = await requireOrgMember(request, reply, orgId)
    if (reply.sent) return

    if (member.role !== 'org_admin') {
      return reply.code(403).send({ error: 'Only organization admins can perform this action' })
    }

    try {
      const parts = request.parts()
      let mediaBuffer: Buffer | null = null
      let mediaMimetype = ''
      let mediaFilename = 'image'
      let kind: 'logo' | 'cover' = 'logo'

      for await (const part of parts) {
        if (part.type === 'file' && part.fieldname === 'media') {
          const chunks: Buffer[] = []
          for await (const chunk of part.file) chunks.push(chunk)
          mediaBuffer = Buffer.concat(chunks)
          mediaMimetype = part.mimetype || ''
          mediaFilename = part.filename || 'image'
        } else if (part.type === 'field' && part.fieldname === 'kind') {
          kind = uploadKindSchema.parse((part as { value: string }).value)
        }
      }

      if (!mediaBuffer || mediaBuffer.length === 0) {
        return reply.code(400).send({ error: 'Image file is required' })
      }

      if (!mediaMimetype.startsWith('image/')) {
        return reply.code(400).send({ error: 'Only image uploads are allowed' })
      }

      return reply.code(201).send({
        ok: true,
        kind,
        url: await uploadOrgMarketplaceImage(
          orgId,
          kind,
          mediaBuffer,
          mediaMimetype,
          mediaFilename
        ),
      })
    } catch (error: any) {
      if (error?.code === 'FST_FILES_LIMIT') {
        return reply.code(413).send({ error: 'Image file is too large' })
      }
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid upload kind', issues: error.issues })
      }
      request.log.error(error, '[ORG_MEDIA_UPLOAD] Failed to upload org marketplace image')
      return reply.code(500).send({ error: 'Failed to upload image' })
    }
  })

  // ── GET /api/organizations/public — unauthenticated marketplace listing ───────
  fastify.get<{
    Querystring: { category?: string; search?: string; country?: string; city?: string }
  }>('/api/organizations/public', async (request, _reply) => {
    const db = getFirestore()
    const { category, search, country, city } = request.query

    const snap = await db
      .collection('organizations')
      .where('isPublicMarketplaceEnabled', '==', true)
      .limit(100)
      .get()

    const orgs = snap.docs.map((doc) => {
      const d = doc.data()
      const logoUrl = d.logoUrl ?? null
      const coverImageUrl = d.coverImageUrl ?? null

      return {
        id: doc.id,
        name: d.name ?? '',
        logoUrl,
        coverImageUrl,
        marketplaceLogoUrl: logoUrl,
        marketplaceCoverImageUrl: coverImageUrl,
        coverImage: coverImageUrl,
        imageUrl: coverImageUrl,
        logoPositionX: d.logoPositionX ?? null,
        logoPositionY: d.logoPositionY ?? null,
        logoScale: d.logoScale ?? null,
        coverPositionX: d.coverPositionX ?? null,
        coverPositionY: d.coverPositionY ?? null,
        coverScale: d.coverScale ?? null,
        description: d.description ?? null,
        country: d.country ?? null,
        city: d.city ?? null,
        address: d.address ?? null,
        categories: Array.isArray(d.categories) ? d.categories : [],
        contactPhone: d.contactPhone ?? null,
        whatsappNumber: d.whatsappNumber ?? null,
        websiteUrl: d.websiteUrl ?? null,
      }
    })

    // Server-side filters (client can also filter, but this reduces payload)
    let result = orgs.filter((o) => o.name)

    if (category && category !== 'All') {
      const lc = category.toLowerCase()
      result = result.filter((o) => o.categories.some((c: string) => c.toLowerCase().includes(lc)))
    }
    if (country) {
      result = result.filter((o) => o.country?.toLowerCase() === country.toLowerCase())
    }
    if (city) {
      result = result.filter((o) => o.city?.toLowerCase().includes(city.toLowerCase()))
    }
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (o) =>
          o.name.toLowerCase().includes(q) ||
          (o.description ?? '').toLowerCase().includes(q) ||
          (o.city ?? '').toLowerCase().includes(q) ||
          o.categories.some((c: string) => c.toLowerCase().includes(q))
      )
    }

    return { ok: true, organizations: result }
  })
}
