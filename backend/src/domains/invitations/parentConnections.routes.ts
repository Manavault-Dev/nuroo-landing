import { FastifyPluginAsync } from 'fastify'
import { getFirestore } from '../../infrastructure/database/firebase.js'
import { getConnectionsForSpecialist } from './invitations.helpers.js'

export const parentConnectionsRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/org/parent-connection/status', async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    try {
      const db = getFirestore()
      const parentUid = request.user.uid

      fastify.log.info({ parentUid }, '[CONNECTION] Checking connection status for parent')

      const orgsSnapshot = await db.collection('organizations').get()
      const connections: Array<{
        orgId: string
        orgName: string
        specialistId: string | null
        joinedAt: string | null
      }> = []

      for (const orgDoc of orgsSnapshot.docs) {
        const orgId = orgDoc.id
        const orgData = orgDoc.data()

        const orgParentRef = db.doc(`orgParents/${orgId}/parents/${parentUid}`)
        const orgParentSnap = await orgParentRef.get()

        if (orgParentSnap.exists) {
          const parentData = orgParentSnap.data()!
          connections.push({
            orgId,
            orgName: orgData.name || orgId,
            specialistId: parentData.linkedSpecialistUid || null,
            joinedAt: parentData.joinedAt?.toDate?.()?.toISOString() || null,
          })
        }
      }

      fastify.log.info(
        `✅ [CONNECTION] Found ${connections.length} connection(s) for parent ${parentUid}`
      )

      return {
        ok: true,
        connected: connections.length > 0,
        connections,
      }
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Route handler failed')
      return reply.code(500).send({
        error: 'Failed to check connection status',
        message: error.message,
      })
    }
  })

  fastify.get<{ Querystring: { orgId?: string } }>(
    '/api/specialist/connections',
    async (request, reply) => {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      try {
        const db = getFirestore()
        const specialistUid = request.user.uid
        const orgId = request.query.orgId

        fastify.log.info(
          { specialistUid, orgId },
          '[SPECIALIST_CONNECTIONS] Getting connections for specialist'
        )

        if (!orgId) {
          const orgsSnapshot = await db.collection('organizations').get()
          const allConnections: any[] = []

          for (const orgDoc of orgsSnapshot.docs) {
            const orgId = orgDoc.id
            const memberRef = db.doc(`organizations/${orgId}/members/${specialistUid}`)
            const memberSnap = await memberRef.get()

            if (memberSnap.exists) {
              const connections = await getConnectionsForSpecialist(db, orgId, specialistUid)
              allConnections.push(
                ...connections.map((conn) => ({
                  ...conn,
                  orgId,
                  orgName: orgDoc.data().name || orgId,
                }))
              )
            }
          }

          return {
            ok: true,
            connections: allConnections,
            count: allConnections.length,
          }
        } else {
          const connections = await getConnectionsForSpecialist(db, orgId, specialistUid)
          return {
            ok: true,
            connections,
            count: connections.length,
          }
        }
      } catch (error: any) {
        fastify.log.error({ err: error }, 'Route handler failed')
        return reply.code(500).send({
          error: 'Failed to get connections',
          message: error.message,
        })
      }
    }
  )

  fastify.get('/api/parent/organizations', async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    try {
      const db = getFirestore()
      const parentUid = request.user.uid

      fastify.log.info({ parentUid }, '[PARENT] Getting linked organizations for parent')

      const orgsSnapshot = await db.collection('organizations').get()
      const organizations: Array<{
        orgId: string
        orgName: string
        specialistId: string | null
        specialistName: string | null
        joinedAt: string | null
      }> = []

      for (const orgDoc of orgsSnapshot.docs) {
        const orgId = orgDoc.id
        const orgData = orgDoc.data()

        const orgParentRef = db.doc(`orgParents/${orgId}/parents/${parentUid}`)
        const orgParentSnap = await orgParentRef.get()

        if (orgParentSnap.exists) {
          const parentData = orgParentSnap.data()!
          const specialistId = parentData.linkedSpecialistUid || null
          let specialistName: string | null = null

          if (specialistId) {
            const specialistRef = db.doc(`specialists/${specialistId}`)
            const specialistSnap = await specialistRef.get()
            if (specialistSnap.exists) {
              const specialistData = specialistSnap.data()!
              specialistName = specialistData.fullName || specialistData.name || null
            }
          }

          organizations.push({
            orgId,
            orgName: orgData.name || orgId,
            specialistId,
            specialistName,
            joinedAt: parentData.joinedAt?.toDate?.()?.toISOString() || null,
          })
        }
      }

      fastify.log.info(
        `✅ [PARENT] Found ${organizations.length} organization(s) for parent ${parentUid}`
      )

      return {
        ok: true,
        organizations,
        count: organizations.length,
      }
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Route handler failed')
      return reply.code(500).send({
        error: 'Failed to get linked organizations',
        message: error.message,
      })
    }
  })
}
