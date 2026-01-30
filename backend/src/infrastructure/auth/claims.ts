import { getAuth } from '../database/firebase.js'

export async function setSuperAdminClaim(uid: string, value: boolean = true): Promise<void> {
  const auth = getAuth()
  const user = await auth.getUser(uid)
  const currentClaims = user.customClaims || {}

  if (value) {
    await auth.setCustomUserClaims(uid, { ...currentClaims, superAdmin: true })
  } else {
    const { superAdmin, ...restClaims } = currentClaims
    await auth.setCustomUserClaims(uid, restClaims)
  }
}

export async function getSuperAdminClaim(uid: string): Promise<boolean> {
  const auth = getAuth()
  const user = await auth.getUser(uid)
  return user.customClaims?.superAdmin === true
}

export async function getUserByEmail(email: string) {
  const auth = getAuth()
  return auth.getUserByEmail(email)
}

export async function listUsersWithClaim(
  claimKey: string,
  claimValue: unknown,
  maxResults: number = 1000
) {
  const auth = getAuth()
  const listUsersResult = await auth.listUsers(maxResults)
  return listUsersResult.users.filter((user) => user.customClaims?.[claimKey] === claimValue)
}
