import { FastifyPluginAsync } from 'fastify'
import admin from 'firebase-admin'
import { aiAssistant } from './service.js'
import { requireOrgMember } from '../../plugins/rbac.js'
import { getFirestore } from '../../infrastructure/database/firebase.js'

const COLLECTIONS = {
  CHILDREN: 'children',
  ORG_CHILDREN: (orgId: string) => `organizations/${orgId}/children`,
  GROUPS: (orgId: string) => `organizations/${orgId}/groups`,
  TEAM: (orgId: string) => `organizations/${orgId}/members`,
}

const aiAssistantRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{
    Body: {
      message: string
      mode?: 'chat' | 'voice'
    }
  }>('/ai/chat', async (request, reply) => {
    try {
      const { message, mode = 'chat' } = request.body || {}
      if (!message?.trim()) {
        return reply.code(400).send({ error: 'Message is required' })
      }

      const decoded = request.user
      if (!decoded) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      const { uid } = decoded

      let orgId = ''
      let role = 'specialist'

      if (decoded.claims?.orgId) {
        orgId = decoded.claims.orgId as string
        role = (decoded.claims as Record<string, unknown>).role as string || 'specialist'
      }

      if (!orgId) {
        return reply.code(400).send({ error: 'Organization not found' })
      }

      const result = await aiAssistant.process({
        message,
        orgId,
        userId: uid,
        role,
        mode,
      })

      let executionResult: { content?: string; success?: boolean } | undefined
      if (result.action) {
        executionResult = await executeAction(result.action.type, result.action.params, orgId, uid)
      }

      return {
        response: result.response,
        speakText: result.speakText,
        ...executionResult,
      }
    } catch (error) {
      console.error('[AI] Chat error:', error)
      return reply.code(500).send({
        error: 'AI assistant error',
        details: error instanceof Error ? error.message : '',
      })
    }
  })
}

async function executeAction(
  actionType: string,
  params: Record<string, string>,
  orgId: string,
  _userId: string
): Promise<{ content: string; success: boolean }> {
  const db = getFirestore()

  try {
    switch (actionType) {
      case 'list_children': {
        const snap = await db
          .collection(COLLECTIONS.ORG_CHILDREN(orgId))
          .where('assigned', '==', true)
          .get()
        const children = snap.docs.map((d) => ({
          id: d.id,
          name: d.data().name || 'Unknown',
        }))
        const list = children.map((c) => c.name).join(', ')
        return {
          content: children.length
            ? `Children (${children.length}): ${list}`
            : 'No children found in your organization.',
          success: true,
        }
      }

      case 'list_groups': {
        const snap = await db.collection(COLLECTIONS.GROUPS(orgId)).get()
        const groups = snap.docs.map((d) => ({
          id: d.id,
          name: d.data().name || 'Unnamed',
          description: d.data().description || '',
        }))
        const list = groups
          .map((g) => `${g.name}${g.description ? ` (${g.description})` : ''}`)
          .join('\n')
        return {
          content: groups.length ? `Groups (${groups.length}):\n${list}` : 'No groups found.',
          success: true,
        }
      }

      case 'create_group': {
        const doc = await db.collection(COLLECTIONS.GROUPS(orgId)).doc()
        await doc.set({
          name: params.name || 'New Group',
          description: params.schedule || '',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        })
        return {
          content: `Created group "${params.name || 'New Group'}"`,
          success: true,
        }
      }

      case 'delete_group': {
        const groupName = params.groupName || ''

        const groupsSnap = await db.collection(COLLECTIONS.GROUPS(orgId)).get()
        const groupDoc = groupsSnap.docs.find(
          (d) => d.data().name?.toLowerCase().includes(groupName.toLowerCase())
        )
        if (!groupDoc) {
          return { content: `Group "${groupName}" not found`, success: false }
        }

        const groupNameStr = groupDoc.data().name
        await groupDoc.ref.delete()

        return {
          content: `Deleted group "${groupNameStr}"`,
          success: true,
        }
      }

      case 'add_child_to_group': {
        const childName = params.childName || ''
        const groupName = params.groupName || ''

        const childrenSnap = await db
          .collection(COLLECTIONS.ORG_CHILDREN(orgId))
          .where('assigned', '==', true)
          .get()
        const childDoc = childrenSnap.docs.find(
          (d) => d.data().name?.toLowerCase().includes(childName.toLowerCase())
        )
        if (!childDoc) {
          return { content: `Child "${childName}" not found`, success: false }
        }

        const groupsSnap = await db.collection(COLLECTIONS.GROUPS(orgId)).get()
        const groupDoc = groupsSnap.docs.find(
          (d) => d.data().name?.toLowerCase().includes(groupName.toLowerCase())
        )
        if (!groupDoc) {
          return { content: `Group "${groupName}" not found`, success: false }
        }

        const childData = childDoc.data()
        const parentUid = childData.parentUserId
        if (!parentUid) {
          return { content: `No parent linked to ${childData.name}`, success: false }
        }

        await groupDoc.ref.update({
          [`children.${childDoc.id}`]: true,
        })

        return {
          content: `Added ${childData.name} to ${groupDoc.data().name}`,
          success: true,
        }
      }

      case 'assign_homework': {
        const childName = params.childName || ''
        const title = params.title || 'Homework'

        const childrenSnap = await db
          .collection(COLLECTIONS.ORG_CHILDREN(orgId))
          .where('assigned', '==', true)
          .get()
        const childDoc = childrenSnap.docs.find(
          (d) => d.data().name?.toLowerCase().includes(childName.toLowerCase())
        )
        if (!childDoc) {
          return { content: `Child "${childName}" not found`, success: false }
        }

        const taskRef = db
          .collection(`children/${childDoc.id}/tasks`)
          .doc()
        await taskRef.set({
          title,
          description: params.description || '',
          status: 'pending',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          assignedBy: _userId,
        })

        return {
          content: `Homework "${title}" assigned to ${childDoc.data().name}`,
          success: true,
        }
      }

      case 'send_reminder': {
        const childName = params.childName || ''
        const message = params.message || 'Please complete your exercises'

        const childrenSnap = await db
          .collection(COLLECTIONS.ORG_CHILDREN(orgId))
          .where('assigned', '==', true)
          .get()
        const childDoc = childrenSnap.docs.find(
          (d) => d.data().name?.toLowerCase().includes(childName.toLowerCase())
        )
        if (!childDoc) {
          return { content: `Child "${childName}" not found`, success: false }
        }

        const parentUid = childDoc.data().parentUserId
        if (!parentUid) {
          return { content: `No parent linked to ${childDoc.data().name}`, success: false }
        }

        const notificationRef = db
          .collection(`users/${parentUid}/notifications`)
          .doc()
        await notificationRef.set({
          title: 'Reminder',
          body: message,
          type: 'reminder',
          childId: childDoc.id,
          read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        })

        return {
          content: `Reminder sent to ${childDoc.data().name}'s parent`,
          success: true,
        }
      }

      case 'list_team': {
        const snap = await db.collection(COLLECTIONS.TEAM(orgId)).get()
        const members = snap.docs.map((d) => ({
          name: d.data().name || 'Unknown',
          email: d.data().email || '',
          role: d.data().role || 'specialist',
        }))
        const list = members
          .map((m) => `${m.name} (${m.role}): ${m.email}`)
          .join('\n')
        return {
          content: members.length ? `Team:\n${list}` : 'No team members found.',
          success: true,
        }
      }

      default:
        return { content: `Unknown action: ${actionType}`, success: false }
    }
  } catch (error) {
    console.error('[AI] Execute error:', error)
    return {
      content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      success: false,
    }
  }
}

export { aiAssistantRoutes }