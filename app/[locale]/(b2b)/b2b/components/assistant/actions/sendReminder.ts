import { apiClient } from '@/lib/b2b/api'
import { ParsedAction } from '../types'

export async function sendReminder(
  orgId: string,
  action: ParsedAction,
  onSuccess?: () => void
): Promise<{ childName: string; message: string }> {
  const childNames = action.params.childNames || []
  const message = action.params.message || 'Please complete your exercises'

  const all = await apiClient.getChildren(orgId)
  if (!all.length) throw new Error('No children yet.')

  const child = childNames.length
    ? all.find((c) => childNames.some((n) => c.name.toLowerCase().includes(n.toLowerCase())))
    : all[0]

  if (!child) throw new Error(`Child not found: ${childNames.join(', ')}.`)

  const d = await apiClient.getChildDetail(orgId, child.id)
  if (!d.parentInfo?.uid) throw new Error(`"${child.name}" has no parent account yet.`)

  // Reminder delivery (push/SMS) wired to backend when notifications route is added.
  onSuccess?.()
  return { childName: child.name, message }
}
