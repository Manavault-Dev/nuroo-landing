import { apiClient } from '@/lib/b2b/api'
import { ParsedAction } from '../types'

export async function createGroup(
  orgId: string,
  action: ParsedAction,
  onSuccess?: () => void
): Promise<string> {
  const name = action.params.name || 'New Group'
  await apiClient.createGroup(orgId, name, action.params.schedule || undefined)
  onSuccess?.()
  return name
}
