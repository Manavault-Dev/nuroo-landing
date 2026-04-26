import { apiClient } from '@/lib/b2b/api'
import { ParsedAction } from '../types'

export async function assignHomework(
  orgId: string,
  action: ParsedAction,
  onSuccess?: () => void
): Promise<string> {
  const childNames = action.params.childNames || []
  const title = action.params.homeworkTitle || 'Homework'

  const all = await apiClient.getChildren(orgId)
  if (!all.length) throw new Error('No children yet.')

  const targets = childNames.length
    ? all.filter((c) => childNames.some((n) => c.name.toLowerCase().includes(n.toLowerCase())))
    : [all[0]]

  if (!targets.length) throw new Error(`Children not found: ${childNames.join(', ')}.`)

  for (const child of targets) {
    await apiClient.createChildTask(orgId, child.id, {
      title,
      description: action.params.homeworkDescription || undefined,
    })
  }

  onSuccess?.()
  return targets.map((c) => c.name).join(', ')
}
