import admin from 'firebase-admin'

export function registeredChildDisplayName(
  childData: admin.firestore.DocumentData | null | undefined,
  userData?: admin.firestore.DocumentData | null | undefined
): string | undefined {
  const flat =
    childData?.childName ||
    childData?.name ||
    childData?.displayName ||
    childData?.fullName ||
    userData?.childName ||
    userData?.name ||
    userData?.displayName
  if (typeof flat === 'string' && flat.trim()) return flat.trim()
  if (childData?.firstName) {
    return childData.lastName
      ? `${childData.firstName} ${childData.lastName}`.trim()
      : String(childData.firstName).trim()
  }
  return undefined
}

export async function getConnectionsForSpecialist(
  db: admin.firestore.Firestore,
  orgId: string,
  specialistUid: string
) {
  const orgChildrenRef = db.collection(`organizations/${orgId}/children`)
  const assignedChildrenSnap = await orgChildrenRef
    .where('assigned', '==', true)
    .where('assignedSpecialistId', '==', specialistUid)
    .get()

  const parentMap = new Map<
    string,
    Array<{
      childId: string
      childName: string
      childAge?: number
      assignedAt: string | null
    }>
  >()

  for (const childDoc of assignedChildrenSnap.docs) {
    const linkData = childDoc.data()
    const childId = childDoc.id
    const parentUserId = linkData.parentUserId

    if (!parentUserId) continue

    const fromLink =
      (typeof linkData.childName === 'string' && linkData.childName.trim()) ||
      (typeof linkData.name === 'string' && linkData.name.trim()) ||
      ''

    const childRef = db.doc(`children/${childId}`)
    const childSnap = await childRef.get()
    const userRef = db.doc(`users/${childId}`)
    const userSnap = await userRef.get()

    let childName = fromLink || 'Unknown'
    let childAge: number | undefined

    if (childSnap.exists) {
      const childData = childSnap.data()!
      childName = childData.name || childData.childName || childName
      childAge = childData.age || childData.childAge
    }

    if (childName === 'Unknown' && userSnap.exists) {
      const userData = userSnap.data()!
      childName = userData.name || userData.childName || childName
      childAge = childAge || userData.age || userData.childAge
    }

    if (childName === 'Unknown') {
      for (const uid of [...new Set([childId, parentUserId])]) {
        try {
          const authUser = await admin.auth().getUser(uid)
          if (authUser.displayName) {
            childName = authUser.displayName
            break
          }
          if (authUser.email) {
            childName = authUser.email.split('@')[0]
            break
          }
        } catch {}
      }
    }

    if (!parentMap.has(parentUserId)) {
      parentMap.set(parentUserId, [])
    }

    parentMap.get(parentUserId)!.push({
      childId,
      childName,
      childAge,
      assignedAt: linkData.assignedAt?.toDate?.()?.toISOString() || null,
    })
  }

  const connections = await Promise.all(
    Array.from(parentMap.entries()).map(async ([parentUserId, children]) => {
      let parentEmail: string | null = null
      let parentDisplayName: string | null = null
      try {
        const auth = admin.auth()
        const parentUser = await auth.getUser(parentUserId)
        parentEmail = parentUser.email || null
        parentDisplayName = parentUser.displayName || null
      } catch {}

      const orgParentRef = db.doc(`orgParents/${orgId}/parents/${parentUserId}`)
      const orgParentSnap = await orgParentRef.get()
      const orgParentData = orgParentSnap.exists ? orgParentSnap.data() : null

      return {
        parentUserId,
        parentName: parentDisplayName || 'Unknown',
        parentEmail,
        specialistId: orgParentData?.linkedSpecialistUid || null,
        joinedAt: orgParentData?.joinedAt?.toDate?.()?.toISOString() || null,
        children,
      }
    })
  )

  return connections
}
