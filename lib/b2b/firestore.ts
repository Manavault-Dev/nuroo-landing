import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  Timestamp,
  QueryConstraint 
} from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import type { Organization, Specialist, ChildSummary, SpecialistNote, ChildProfile } from './types'

const COLLECTIONS = {
  organizations: 'organizations',
  specialists: 'specialists',
  orgMembers: (orgId: string) => `organizations/${orgId}/members`,
  orgChildren: (orgId: string) => `organizations/${orgId}/children`,
  children: 'children',
  specialistNotes: (childId: string) => `children/${childId}/specialistNotes`,
}

const toDate = (timestamp: any): Date => {
  if (timestamp?.toDate) {
    return timestamp.toDate()
  }
  if (timestamp instanceof Date) {
    return timestamp
  }
  return new Date()
}

const toTimestamp = (date: Date | undefined): Timestamp | null => {
  if (!date) return null
  return Timestamp.fromDate(date)
}

export async function getOrganization(orgId: string): Promise<Organization | null> {
  const docRef = doc(db, COLLECTIONS.organizations, orgId)
  const docSnap = await getDoc(docRef)
  
  if (!docSnap.exists()) {
    return null
  }
  
  const data = docSnap.data()
  return {
    id: docSnap.id,
    name: data.name,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  }
}

export async function createOrganization(orgData: Omit<Organization, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const orgRef = doc(collection(db, COLLECTIONS.organizations))
  const now = new Date()
  
  await setDoc(orgRef, {
    ...orgData,
    createdAt: Timestamp.fromDate(now),
    updatedAt: Timestamp.fromDate(now),
  })
  
  return orgRef.id
}

export async function getSpecialist(specialistId: string): Promise<Specialist | null> {
  const docRef = doc(db, COLLECTIONS.specialists, specialistId)
  const docSnap = await getDoc(docRef)
  
  if (!docSnap.exists()) {
    return null
  }
  
  const data = docSnap.data()
  return {
    id: docSnap.id,
    email: data.email,
    name: data.name,
    organizationId: data.organizationId,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  }
}

export async function createOrUpdateSpecialist(
  specialistId: string,
  specialistData: Omit<Specialist, 'id' | 'createdAt' | 'updatedAt'>
): Promise<void> {
  const specialistRef = doc(db, COLLECTIONS.specialists, specialistId)
  const docSnap = await getDoc(specialistRef)
  const now = new Date()
  
  if (docSnap.exists()) {
    await setDoc(specialistRef, {
      ...specialistData,
      updatedAt: Timestamp.fromDate(now),
    }, { merge: true })
  } else {
    await setDoc(specialistRef, {
      ...specialistData,
      createdAt: Timestamp.fromDate(now),
      updatedAt: Timestamp.fromDate(now),
    })
  }
}

export async function getChildrenByOrganization(orgId: string): Promise<ChildSummary[]> {
  const q = query(
    collection(db, COLLECTIONS.children),
    where('organizationId', '==', orgId)
  )
  
  const querySnapshot = await getDocs(q)
  const children: ChildSummary[] = []
  
  querySnapshot.forEach((doc) => {
    const data = doc.data()
    children.push({
      id: doc.id,
      name: data.name,
      organizationId: data.organizationId,
      speechRoadmapStep: data.speechRoadmapStep,
      completedTasksCount: data.completedTasksCount || 0,
      lastActiveDate: data.lastActiveDate ? toDate(data.lastActiveDate) : undefined,
      assignedSpecialistIds: data.assignedSpecialistIds || [],
    })
  })
  
  return children
}

export async function getChildProfile(childId: string): Promise<ChildProfile | null> {
  const childRef = doc(db, COLLECTIONS.children, childId)
  const childSnap = await getDoc(childRef)
  
  if (!childSnap.exists()) {
    return null
  }
  
  const childData = childSnap.data()
  
  const notesQuery = query(
    collection(db, COLLECTIONS.specialistNotes(childId)),
    orderBy('createdAt', 'desc')
  )
  const notesSnapshot = await getDocs(notesQuery)
  
  const notes: SpecialistNote[] = []
  notesSnapshot.forEach((doc) => {
    const data = doc.data()
    notes.push({
      id: doc.id,
      childId,
      specialistId: data.specialistId,
      specialistName: data.specialistName,
      content: data.content,
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
    })
  })
  
  const recentTasks = childData.recentTasks || []
  
  return {
    id: childSnap.id,
    name: childData.name,
    organizationId: childData.organizationId,
    speechRoadmapStep: childData.speechRoadmapStep,
    completedTasksCount: childData.completedTasksCount || 0,
    lastActiveDate: childData.lastActiveDate ? toDate(childData.lastActiveDate) : undefined,
    assignedSpecialistIds: childData.assignedSpecialistIds || [],
    recentTasks: recentTasks.map((task: any) => ({
      id: task.id,
      title: task.title,
      completedAt: task.completedAt ? toDate(task.completedAt) : undefined,
      status: task.status || 'pending',
    })),
    notes,
  }
}

export async function createSpecialistNote(
  childId: string,
  specialistId: string,
  specialistName: string,
  content: string
): Promise<string> {
  const notesRef = collection(db, COLLECTIONS.specialistNotes(childId))
  const now = new Date()
  
  const docRef = await addDoc(notesRef, {
    childId,
    specialistId,
    specialistName,
    content,
    createdAt: Timestamp.fromDate(now),
    updatedAt: Timestamp.fromDate(now),
  })
  
  return docRef.id
}
