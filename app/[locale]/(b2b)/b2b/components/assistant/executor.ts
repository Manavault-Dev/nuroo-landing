import { apiClient } from '@/lib/b2b/api'
import { getIdToken } from '@/lib/b2b/authClient'
import { ParsedAction, TranslationSet } from './types'

interface ExecutionResult {
  content: string
  speakText?: string
}

export class ActionExecutor {
  constructor(
    private orgId: string,
    private t: TranslationSet,
    private onSuccess?: () => void
  ) {}

  async execute(action: ParsedAction): Promise<ExecutionResult> {
    const token = await getIdToken()
    if (!token) throw new Error(this.t.notAuth)
    apiClient.setToken(token)

    switch (action.type) {
      case 'create_group':
        return this.executeCreateGroup(action)
      case 'add_children_to_group':
        return this.executeAddChildren(action)
      case 'add_child':
        return this.executeAddChild(action)
      case 'update_group_schedule':
        return this.executeUpdateSchedule(action)
      case 'list_groups':
        return this.executeListGroups()
      case 'list_children':
        return this.executeListChildren()
      case 'assign_homework':
        return this.executeAssignHomework(action)
      case 'send_reminder':
        return this.executeSendReminder(action)
      default:
        throw new Error('Unknown action')
    }
  }

  private async executeCreateGroup(action: ParsedAction): Promise<ExecutionResult> {
    const name = action.params.name || 'New Group'
    await apiClient.createGroup(this.orgId, name, action.params.schedule || undefined)
    this.onSuccess?.()
    return { content: this.t.successCreate(name), speakText: this.t.successCreate(name) }
  }

  private async executeAddChildren(action: ParsedAction): Promise<ExecutionResult> {
    const childNames = action.params.childNames || []
    const tgt = action.params.groupName
    if (!childNames.length) throw new Error(this.t.noChildren('?'))
    if (!tgt) throw new Error(this.t.noGroup('?'))

    const { groups } = await apiClient.getGroups(this.orgId)
    const found = (groups as Array<{ id: string; name: string }>).find((g) =>
      g.name.toLowerCase().includes(tgt.toLowerCase())
    )
    if (!found) throw new Error(this.t.noGroup(tgt))
    const gid = found.id
    const gName = found.name

    const all = await apiClient.getChildren(this.orgId)
    const matched = all.filter((c) =>
      childNames.some((n) => c.name.toLowerCase().includes(n.toLowerCase()))
    )
    if (!matched.length) throw new Error(this.t.noChildren(childNames.join(', ')))

    const added: string[] = []
    const noParent: string[] = []
    const byParent = new Map<string, string[]>()

    for (const child of matched) {
      const d = await apiClient.getChildDetail(this.orgId, child.id)
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
      await apiClient.addParentToGroup(this.orgId, gid, uid, ids)
    }

    this.onSuccess?.()
    let msg = added.length ? this.t.successAdd(added.join(', '), gName) : ''
    if (noParent.length) msg += '\n' + this.t.noParent(noParent.join(', '))
    return {
      content: msg.trim(),
      speakText: added.length ? this.t.successAdd(added.join(', '), gName) : undefined,
    }
  }

  private async executeAddChild(action: ParsedAction): Promise<ExecutionResult> {
    const childNames = action.params.childNames || []
    const tgt = action.params.groupName
    if (!childNames.length) throw new Error(this.t.noChildren('?'))
    if (!tgt) throw new Error(this.t.noGroup('?'))

    const { groups } = await apiClient.getGroups(this.orgId)
    const found = (groups as Array<{ id: string; name: string }>).find((g) =>
      g.name.toLowerCase().includes(tgt.toLowerCase())
    )
    if (!found) throw new Error(this.t.noGroup(tgt))
    const gid = found.id
    const gName = found.name

    const all = await apiClient.getChildren(this.orgId)
    const matched = all.filter((c) =>
      childNames.some((n) => c.name.toLowerCase().includes(n.toLowerCase()))
    )
    if (!matched.length) throw new Error(this.t.noChildren(childNames.join(', ')))

    const child = matched[0]
    const d = await apiClient.getChildDetail(this.orgId, child.id)
    if (!d.parentInfo?.uid) throw new Error(this.t.noParent(child.name))

    await apiClient.addParentToGroup(this.orgId, gid, d.parentInfo.uid, [child.id])
    this.onSuccess?.()
    return {
      content: this.t.successChild(child.name, gName),
      speakText: this.t.successChild(child.name, gName),
    }
  }

  private async executeUpdateSchedule(action: ParsedAction): Promise<ExecutionResult> {
    const tgt = action.params.groupName
    if (!tgt) throw new Error(this.t.noGroup('?'))

    const { groups } = await apiClient.getGroups(this.orgId)
    const found = (groups as Array<{ id: string; name: string }>).find((g) =>
      g.name.toLowerCase().includes(tgt.toLowerCase())
    )
    if (!found) throw new Error(this.t.noGroup(tgt))

    await apiClient.updateGroup(this.orgId, found.id, {
      description: action.params.newSchedule || '',
    })
    this.onSuccess?.()
    return {
      content: this.t.successUpdate(found.name),
      speakText: this.t.successUpdate(found.name),
    }
  }

  private async executeListGroups(): Promise<ExecutionResult> {
    const { groups } = await apiClient.getGroups(this.orgId)
    const list = groups as Array<{ id: string; name: string; description?: string }>
    const content = list.length
      ? `${this.t.groups} (${list.length}):\n` +
        list.map((g) => `• ${g.name}${g.description ? ` — ${g.description}` : ''}`).join('\n')
      : this.t.noGroupsYet
    return { content }
  }

  private async executeListChildren(): Promise<ExecutionResult> {
    const all = await apiClient.getChildren(this.orgId)
    const content = all.length
      ? `${this.t.children} (${all.length}):\n` +
        all.map((c) => `• ${c.name}${c.age !== undefined ? ` (${c.age} y.o.)` : ''}`).join('\n')
      : this.t.noChildrenYet
    return { content }
  }

  private async executeAssignHomework(action: ParsedAction): Promise<ExecutionResult> {
    const all = await apiClient.getChildren(this.orgId)
    if (!all.length) throw new Error(this.t.noChildrenYet)

    const child = all[0]
    const title = action.params.homeworkTitle || 'Homework'
    await apiClient.createChildTask(this.orgId, child.id, { title })
    this.onSuccess?.()
    return {
      content: this.t.successHomework(child.name),
      speakText: this.t.successHomework(child.name),
    }
  }

  private async executeSendReminder(action: ParsedAction): Promise<ExecutionResult> {
    const all = await apiClient.getChildren(this.orgId)
    if (!all.length) throw new Error(this.t.noChildrenYet)

    const child = all[0]
    const d = await apiClient.getChildDetail(this.orgId, child.id)
    if (!d.parentInfo?.uid) throw new Error(this.t.noParent(child.name))

    const message = action.params.message || 'Please complete your exercises'
    this.onSuccess?.()
    return {
      content: `${this.t.successReminder(child.name)}\n\n"${message}"`,
      speakText: this.t.successReminder(child.name),
    }
  }
}
