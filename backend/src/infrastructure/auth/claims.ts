import { getAuth } from '../database/firebase.js'

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
