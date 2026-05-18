import { apiClient } from '@/lib/b2b/api'
import { ParsedAction } from '../types'

async function resolveGroup(orgId: string, groupName: string) {
  const { groups } = await apiClient.getGroups(orgId)
  return (groups as Array<{ id: string; name: string }>).find((g) =>
    g.name.toLowerCase().includes(groupName.toLowerCase())
  )
}

export async function addChildToGroup(
  orgId: string,
  action: ParsedAction,
  onSuccess?: () => void
): Promise<{ added: string[]; noParent: string[]; groupName: string }> {
  const childNames = action.params.childNames || []
  const tgt = action.params.groupName || ''
  const found = await resolveGroup(orgId, tgt)
  if (!found) throw new Error(`Group "${tgt}" not found.`)

  const all = await apiClient.getChildren(orgId)
  const matched = all.filter((c) =>
    childNames.some((n) => c.name.toLowerCase().includes(n.toLowerCase()))
  )
  if (!matched.length) throw new Error(`Children not found: ${childNames.join(', ')}.`)

  const added: string[] = []
  const noParent: string[] = []
  const byParent = new Map<string, string[]>()

  for (const child of matched) {
    const d = await apiClient.getChildDetail(orgId, child.id)
    const uid = d.parentInfo?.uid
    if (!uid) {
      noParent.push(child.name)
      continue
    }
    if (!byParent.has(uid)) byParent.set(uid, [])
    byParent.get(uid)!.push(child.id)
    added.push(child.name)
  }

  for (const [uid, ids] of byParent) {
    await apiClient.addParentToGroup(orgId, found.id, uid, ids)
  }

  onSuccess?.()
  return { added, noParent, groupName: found.name }
}
