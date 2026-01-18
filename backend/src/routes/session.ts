import { FastifyPluginAsync } from 'fastify'
import { getFirestore } from '../firebaseAdmin.js'

export const sessionRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/session', async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    const db = getFirestore()
    const { uid } = request.user

    const specialistRef = db.doc(`specialists/${uid}`)
    const specialistSnap = await specialistRef.get()

    if (!specialistSnap.exists) {
      return { ok: true, hasOrg: false }
    }

    const orgsSnapshot = await db.collection('organizations').get()
    for (const orgDoc of orgsSnapshot.docs) {
      const orgId = orgDoc.id
      const memberRef = db.doc(`organizations/${orgId}/members/${uid}`)
      const memberSnap = await memberRef.get()
      
      if (memberSnap.exists && memberSnap.data()?.status === 'active') {
        return { ok: true, orgId, hasOrg: true }
      }
    }

    return { ok: true, hasOrg: false }
  })
}
