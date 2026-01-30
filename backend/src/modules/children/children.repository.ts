import admin from 'firebase-admin'
import {
  getOrgChildrenRef,
  getOrgChildRef,
  getChildRef,
  getChildProgressRef,
  getChildTasksRef,
  getChildFeedbackRef,
  getParentRef,
  getFirestore,
} from '../../infrastructure/database/collections.js'
import type {
  ChildSummary,
  ChildDetail,
  ActivityDay,
  ParentInfo,
} from '../../shared/types/common.js'

export async function findOrgChildren(orgId: string, role: string, uid: string): Promise<string[]> {
  const orgChildrenRef = getOrgChildrenRef(orgId)
  let assignedChildrenSnap

  if (role === 'org_admin') {
    assignedChildrenSnap = await orgChildrenRef.where('assigned', '==', true).get()
  } else {
    assignedChildrenSnap = await orgChildrenRef
      .where('assigned', '==', true)
      .where('assignedSpecialistId', '==', uid)
      .get()
  }

  return assignedChildrenSnap.docs.map((doc) => doc.id)
}

export async function getChildSummary(childId: string): Promise<ChildSummary | null> {
  const childRef = getChildRef(childId)
  const childSnap = await childRef.get()

  let name = 'Unknown'
  let age: number | undefined
  let speechStepId: string | undefined
  let speechStepNumber: number | undefined
  let lastActiveDate: Date | undefined
  let completedTasksCount = 0

  if (childSnap.exists) {
    const childData = childSnap.data()!
    name = childData.name || childData.childName || 'Unknown'
    age = childData.age || childData.childAge
    lastActiveDate = childData.lastActiveDate?.toDate() || childData.updatedAt?.toDate()

    const progressRef = getChildProgressRef(childId)
    const progressSnap = await progressRef.get()
    const progressData = progressSnap.exists ? progressSnap.data() : null

    speechStepId = progressData?.currentStepId
    speechStepNumber = progressData?.currentStepNumber

    const tasksRef = getChildTasksRef(childId)
    const tasksSnapshot = await tasksRef.where('status', '==', 'completed').get()
    completedTasksCount = tasksSnapshot.size
  }

  return {
    id: childId,
    name,
    age,
    speechStepId,
    speechStepNumber,
    lastActiveDate,
    completedTasksCount,
  }
}

export async function getChildDetail(childId: string, orgId: string): Promise<ChildDetail | null> {
  const childRef = getChildRef(childId)
  const childSnap = await childRef.get()

  if (!childSnap.exists) {
    return null
  }

  const childData = childSnap.data()!
  const progressRef = getChildProgressRef(childId)
  const progressSnap = await progressRef.get()
  const progressData = progressSnap.exists ? progressSnap.data() : null

  const tasksRef = getChildTasksRef(childId)
  const tasksSnapshot = await tasksRef.orderBy('updatedAt', 'desc').limit(10).get()

  const recentTasks = tasksSnapshot.docs.map((doc) => {
    const taskData = doc.data()
    return {
      id: doc.id,
      title: taskData.title || 'Untitled Task',
      status: taskData.status || 'pending',
      completedAt: taskData.completedAt?.toDate(),
    }
  })

  const completedTasksSnapshot = await tasksRef.where('status', '==', 'completed').get()

  // Get parent info if available
  let parentInfo: ParentInfo | undefined
  const parentUid = childData.parentUid

  if (parentUid) {
    // Try to get parent info from the parents collection first
    const parentRef = getParentRef(parentUid)
    const parentSnap = await parentRef.get()

    if (parentSnap.exists) {
      const parentData = parentSnap.data()!
      parentInfo = {
        uid: parentUid,
        displayName: parentData.displayName || parentData.name,
        email: parentData.email,
      }
    }

    // If not in parents collection, try the users collection (mobile app users)
    if (!parentInfo?.displayName && !parentInfo?.email) {
      const db = getFirestore()
      const userRef = db.doc(`users/${parentUid}`)
      const userSnap = await userRef.get()

      if (userSnap.exists) {
        const userData = userSnap.data()!
        parentInfo = {
          uid: parentUid,
          displayName: userData.fullName || userData.name || userData.displayName,
          email: userData.email,
        }
      }
    }

    // Get linkedAt from org child record
    if (parentInfo) {
      const orgChildRef = getOrgChildRef(orgId, childId)
      const orgChildSnap = await orgChildRef.get()
      if (orgChildSnap.exists) {
        const orgChildData = orgChildSnap.data()!
        parentInfo.linkedAt = orgChildData.assignedAt?.toDate()
      }
    }
  }

  return {
    id: childSnap.id,
    name: childData.name || 'Unknown',
    age: childData.age,
    organizationId: childData.organizationId || orgId,
    parentInfo,
    speechStepId: progressData?.currentStepId,
    speechStepNumber: progressData?.currentStepNumber,
    lastActiveDate: childData.lastActiveDate?.toDate(),
    completedTasksCount: completedTasksSnapshot.size,
    recentTasks,
  }
}

export async function getChildTimeline(childId: string, days: number): Promise<ActivityDay[]> {
  const now = new Date()
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
  const startTimestamp = admin.firestore.Timestamp.fromDate(startDate)

  // Get tasks
  const tasksRef = getChildTasksRef(childId)
  const tasksSnapshot = await tasksRef
    .where('updatedAt', '>=', startTimestamp)
    .orderBy('updatedAt', 'desc')
    .get()

  const activityMap = new Map<string, { attempted: number; completed: number }>()

  tasksSnapshot.docs.forEach((doc) => {
    const taskData = doc.data()
    const updatedAt = taskData.updatedAt?.toDate() || new Date()
    const dateKey = updatedAt.toISOString().split('T')[0]

    if (!activityMap.has(dateKey)) {
      activityMap.set(dateKey, { attempted: 0, completed: 0 })
    }

    const day = activityMap.get(dateKey)!
    day.attempted++

    if (taskData.status === 'completed') {
      day.completed++
    }
  })

  // Get feedback
  const feedbackRef = getChildFeedbackRef(childId)
  const feedbackSnapshot = await feedbackRef.where('timestamp', '>=', startTimestamp).get()

  const feedbackMap = new Map<
    string,
    { mood: 'good' | 'ok' | 'hard'; comment?: string; timestamp: Date }
  >()

  feedbackSnapshot.docs.forEach((doc) => {
    const feedbackData = doc.data()
    const timestamp = feedbackData.timestamp?.toDate() || new Date()
    const dateKey = timestamp.toISOString().split('T')[0]

    feedbackMap.set(dateKey, {
      mood: feedbackData.mood || 'ok',
      comment: feedbackData.comment,
      timestamp,
    })
  })

  // Build timeline
  const timelineDays: ActivityDay[] = []
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
    const dateKey = date.toISOString().split('T')[0]
    const activity = activityMap.get(dateKey) || { attempted: 0, completed: 0 }
    const feedback = feedbackMap.get(dateKey)

    timelineDays.push({
      date: dateKey,
      tasksAttempted: activity.attempted,
      tasksCompleted: activity.completed,
      feedback: feedback
        ? {
            mood: feedback.mood,
            comment: feedback.comment,
            timestamp: feedback.timestamp,
          }
        : undefined,
    })
  }

  return timelineDays
}
