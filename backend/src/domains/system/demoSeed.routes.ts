import type { FastifyPluginAsync } from 'fastify'
import admin from 'firebase-admin'
import { getFirestore } from '../../infrastructure/database/firebase.js'
import { requireOrgMember } from '../../plugins/rbac.js'

const DEMO_DATA = [
  {
    child: {
      firstName: 'Айдар',
      lastName: 'Бекович',
      dateOfBirth: '2018-03-15',
      gender: 'male',
      diagnosis: 'ЗРР',
      primaryConcern: 'Задержка речевого развития',
    },
    parent: {
      fullName: 'Бекова Гүлнара',
      phone: '+996700000001',
      email: 'demo.parent1@demo.nuroo.app',
    },
  },
  {
    child: {
      firstName: 'Малика',
      lastName: 'Эркинова',
      dateOfBirth: '2017-07-22',
      gender: 'female',
      diagnosis: 'Дислалия',
      primaryConcern: 'Нарушение звукопроизношения',
    },
    parent: {
      fullName: 'Эркинов Бакыт',
      phone: '+996700000002',
      email: 'demo.parent2@demo.nuroo.app',
    },
  },
  {
    child: {
      firstName: 'Тимур',
      lastName: 'Асанов',
      dateOfBirth: '2019-01-10',
      gender: 'male',
      diagnosis: 'ОНР II',
      primaryConcern: 'Общее недоразвитие речи',
    },
    parent: {
      fullName: 'Асанова Айнура',
      phone: '+996700000003',
      email: 'demo.parent3@demo.nuroo.app',
    },
  },
]

const DEMO_TASKS = [
  {
    title: 'Упражнение «Лягушка»',
    description: 'Артикуляционное упражнение для развития подвижности языка',
    category: 'Артикуляция',
    difficulty: 'easy',
    estimatedDuration: 10,
    instructions: [
      'Улыбнуться и показать зубы',
      'Удерживать положение 5 секунд',
      'Расслабить мышцы',
      'Повторить 5 раз',
    ],
  },
  {
    title: 'Звук «Р» — постановка',
    description: 'Работа над постановкой звука Р',
    category: 'Звукопроизношение',
    difficulty: 'medium',
    estimatedDuration: 20,
    instructions: [
      'Произнести звук «д-д-д» быстро',
      'Добавить вибрацию кончика языка',
      'Зафиксировать правильное положение',
    ],
  },
  {
    title: 'Дыхательная гимнастика',
    description: 'Упражнения для развития речевого дыхания',
    category: 'Дыхание',
    difficulty: 'easy',
    estimatedDuration: 5,
    instructions: ['Медленный вдох через нос', 'Медленный выдох через рот', 'Повторить 8-10 раз'],
  },
  {
    title: 'Слоговые цепочки',
    description: 'Произнесение слогов для автоматизации звуков',
    category: 'Автоматизация',
    difficulty: 'medium',
    estimatedDuration: 15,
    instructions: [
      'Повторить слоги: са-со-су-сы',
      'Произнести чётко и медленно',
      'Ускорить темп постепенно',
    ],
  },
  {
    title: 'Понимание инструкций',
    description: 'Выполнение двухшаговых инструкций',
    category: 'Коммуникация',
    difficulty: 'easy',
    estimatedDuration: 10,
    instructions: [
      'Назвать предмет на картинке',
      'Выполнить действие по заданию',
      'Подтвердить выполнение',
    ],
  },
]

const DEMO_ROUTE_RATE_LIMIT = {
  max: 5,
  timeWindow: '1 minute',
}

async function getOrCreateDemoParent(email: string, fullName: string): Promise<string> {
  try {
    const existing = await admin.auth().getUserByEmail(email)
    return existing.uid
  } catch {
    const created = await admin.auth().createUser({
      email,
      password: 'DemoNuroo2025!',
      displayName: fullName,
      emailVerified: true,
    })
    return created.uid
  }
}

export const demoSeedRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Params: { orgId: string } }>(
    '/orgs/:orgId/demo/seed',
    { config: { rateLimit: DEMO_ROUTE_RATE_LIMIT } },
    async (request, reply) => {
      try {
        const { orgId } = request.params
        const member = await requireOrgMember(request, reply, orgId)
        if (member.role !== 'org_admin') {
          return reply.code(403).send({ error: 'Only admins can seed demo data' })
        }

        const db = getFirestore()
        const now = admin.firestore.Timestamp.now()
        const uid = request.user!.uid

        const createdChildIds: string[] = []
        const createdParentUids: string[] = []

        // --- 1. Create children + parents + links ---
        for (const entry of DEMO_DATA) {
          const { child, parent } = entry

          // Create or get Firebase Auth parent account
          const parentUid = await getOrCreateDemoParent(parent.email, parent.fullName)
          createdParentUids.push(parentUid)

          const fullName = `${child.firstName} ${child.lastName}`

          // Global child doc
          const globalRef = db.collection('children').doc()
          const childId = globalRef.id
          createdChildIds.push(childId)

          const childData = {
            name: fullName,
            firstName: child.firstName,
            lastName: child.lastName,
            dateOfBirth: child.dateOfBirth,
            gender: child.gender,
            diagnosis: child.diagnosis,
            primaryConcern: child.primaryConcern,
            orgId,
            createdBy: uid,
            createdAt: now,
            updatedAt: now,
            isDemo: true,
          }
          await globalRef.set(childData)

          // Org child link (with parentUserId so children page shows parent)
          await db.collection(`organizations/${orgId}/children`).doc(childId).set({
            assigned: true,
            childId,
            name: fullName,
            parentUserId: parentUid,
            createdAt: now,
            updatedAt: now,
            isDemo: true,
          })

          // Parent profile in orgParents
          await db.doc(`orgParents/${orgId}/parents/${parentUid}`).set(
            {
              parentUserId: parentUid,
              fullName: parent.fullName,
              phone: parent.phone,
              email: parent.email,
              orgId,
              createdAt: now,
              updatedAt: now,
              isDemo: true,
            },
            { merge: true }
          )

          // users doc so name resolves
          await db.doc(`users/${parentUid}`).set(
            {
              name: parent.fullName,
              email: parent.email,
              role: 'parent',
              orgId,
              createdAt: now,
              isDemo: true,
            },
            { merge: true }
          )
        }

        // --- 2. Create content tasks ---
        const createdTaskIds: string[] = []
        const taskBatch = db.batch()
        for (const task of DEMO_TASKS) {
          const ref = db.collection(`organizations/${orgId}/contentTasks`).doc()
          createdTaskIds.push(ref.id)
          taskBatch.set(ref, { ...task, orgId, createdAt: now, createdBy: uid, isDemo: true })
        }
        await taskBatch.commit()

        // --- 3. Create demo group with all children + parents ---
        const groupRef = db.collection(`specialists/${uid}/groups`).doc()
        const groupId = groupRef.id
        await groupRef.set({
          name: 'Демо-группа',
          description: 'Тестовая группа для показа клиенту',
          color: '#6366f1',
          orgId,
          childIds: createdChildIds,
          parentCount: createdParentUids.length,
          taskCount: 0,
          createdAt: now,
          updatedAt: now,
          isDemo: true,
        })

        // Link children and parents into the group
        const groupBatch = db.batch()
        for (let i = 0; i < createdChildIds.length; i++) {
          const childId = createdChildIds[i]
          const parentUid = createdParentUids[i]

          groupBatch.set(db.doc(`specialists/${uid}/groups/${groupId}/children/${childId}`), {
            childId,
            addedAt: now,
          })
          groupBatch.set(db.doc(`specialists/${uid}/groups/${groupId}/parents/${parentUid}`), {
            childIds: [childId],
            addedAt: now,
          })
        }
        await groupBatch.commit()

        return {
          ok: true,
          created: {
            children: createdChildIds.length,
            parents: createdParentUids.length,
            tasks: createdTaskIds.length,
            groups: 1,
          },
          message: `Создано: ${createdChildIds.length} детей, ${createdParentUids.length} родителей, ${createdTaskIds.length} заданий, 1 группа`,
        }
      } catch (e: any) {
        fastify.log.error(e)
        return reply.code(500).send({ error: e?.message || 'Seeding failed' })
      }
    }
  )

  fastify.delete<{ Params: { orgId: string } }>(
    '/orgs/:orgId/demo/seed',
    { config: { rateLimit: DEMO_ROUTE_RATE_LIMIT } },
    async (request, reply) => {
      try {
        const { orgId } = request.params
        const member = await requireOrgMember(request, reply, orgId)
        if (member.role !== 'org_admin') {
          return reply.code(403).send({ error: 'Only admins can delete demo data' })
        }

        const db = getFirestore()
        const uid = request.user!.uid

        const [orgChildrenSnap, tasksSnap, groupsSnap, orgParentsSnap] = await Promise.all([
          db.collection(`organizations/${orgId}/children`).where('isDemo', '==', true).get(),
          db.collection(`organizations/${orgId}/contentTasks`).where('isDemo', '==', true).get(),
          db
            .collection(`specialists/${uid}/groups`)
            .where('orgId', '==', orgId)
            .where('isDemo', '==', true)
            .get(),
          db.collection(`orgParents/${orgId}/parents`).where('isDemo', '==', true).get(),
        ])

        const globalChildIds = orgChildrenSnap.docs
          .map((d) => d.data().childId)
          .filter(Boolean) as string[]
        const parentUids = orgParentsSnap.docs
          .map((d) => d.data().parentUserId)
          .filter(Boolean) as string[]

        const batch = db.batch()
        orgChildrenSnap.docs.forEach((d) => batch.delete(d.ref))
        tasksSnap.docs.forEach((d) => batch.delete(d.ref))
        groupsSnap.docs.forEach((d) => batch.delete(d.ref))
        orgParentsSnap.docs.forEach((d) => batch.delete(d.ref))
        for (const childId of globalChildIds) {
          batch.delete(db.doc(`children/${childId}`))
        }
        for (const parentUid of parentUids) {
          batch.delete(db.doc(`users/${parentUid}`))
        }
        await batch.commit()

        // Delete demo Firebase Auth accounts (best-effort)
        for (const email of DEMO_DATA.map((d) => d.parent.email)) {
          try {
            const u = await admin.auth().getUserByEmail(email)
            await admin.auth().deleteUser(u.uid)
          } catch {
            /* already gone */
          }
        }

        return {
          ok: true,
          deleted: {
            children: orgChildrenSnap.size,
            parents: orgParentsSnap.size,
            tasks: tasksSnap.size,
            groups: groupsSnap.size,
          },
        }
      } catch (e: any) {
        return reply.code(500).send({ error: e?.message || 'Cleanup failed' })
      }
    }
  )
}
