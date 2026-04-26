import { apiClient } from '@/lib/b2b/api'
import { getIdToken } from '@/lib/b2b/authClient'
import { ParsedAction, TranslationSet } from './types'

interface ExecutionResult {
  content: string
  speakText?: string
  contextUpdate?: { childNames?: string[]; groupName?: string }
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
        return this.executeAddChildren(action)
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
      case 'show_reports':
        return this.executeShowReports(action)
      case 'show_children_without_homework':
        return this.executeShowChildrenWithoutHomework()
      case 'show_low_activity':
        return this.executeShowLowActivity()
      default:
        throw new Error('Unknown action')
    }
  }

  private async executeCreateGroup(action: ParsedAction): Promise<ExecutionResult> {
    const name = action.params.name
    if (!name) throw new Error('Group name is required.')

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
      await apiClient.addParentToGroup(this.orgId, found.id, uid, ids)
    }

    this.onSuccess?.()
    let msg = added.length ? this.t.successAdd(added.join(', '), found.name) : ''
    if (noParent.length) msg += (msg ? '\n' : '') + this.t.noParent(noParent.join(', '))
    if (!msg) throw new Error(this.t.noParent(childNames.join(', ')))
    return {
      content: msg.trim(),
      speakText: added.length ? this.t.successAdd(added.join(', '), found.name) : undefined,
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
    return { content, contextUpdate: { childNames: all.map((c) => c.name) } }
  }

  private async executeAssignHomework(action: ParsedAction): Promise<ExecutionResult> {
    const title = action.params.homeworkTitle
    if (!title) throw new Error('Please specify the homework title.')

    const childNames = action.params.childNames || []
    if (!childNames.length) throw new Error(this.t.noChildren('?'))

    const all = await apiClient.getChildren(this.orgId)
    if (!all.length) throw new Error(this.t.noChildrenYet)

    const targets = all.filter((c) =>
      childNames.some((n) => c.name.toLowerCase().includes(n.toLowerCase()))
    )
    if (!targets.length) throw new Error(this.t.noChildren(childNames.join(', ')))

    for (const child of targets) {
      await apiClient.createChildTask(this.orgId, child.id, {
        title,
        description: action.params.homeworkDescription,
      })
    }

    this.onSuccess?.()
    const names = targets.map((c) => c.name).join(', ')
    return {
      content: this.t.successHomework(names),
      speakText: this.t.successHomework(names),
    }
  }

  private async executeShowReports(action: ParsedAction): Promise<ExecutionResult> {
    const days = parseInt(action.params.period || '7')
    const r = await apiClient.getReports(this.orgId, days)
    const avgCompletion = r.childCompletion.length
      ? Math.round(r.childCompletion.reduce((s, c) => s + c.percent, 0) / r.childCompletion.length)
      : 0
    const bestGroup = [...r.groupCompletion].sort((a, b) => b.percent - a.percent)[0]
    const lines: string[] = [
      `📊 Report — last ${days} days`,
      ``,
      `✅ Avg completion: ${avgCompletion}%`,
      `👶 Children tracked: ${r.childCompletion.length}`,
    ]
    if (bestGroup) lines.push(`🏆 Top group: ${bestGroup.groupName} (${bestGroup.percent}%)`)
    if (r.topParents.length) lines.push(`⭐ Most active parent: ${r.topParents[0].parentName}`)
    if (r.lowActivity.length) lines.push(`⚠️ Low activity: ${r.lowActivity.length} parent(s)`)
    lines.push(``, `📝 Tasks completed (7d): ${r.contentActivity.completedLast7Days}`)
    return { content: lines.join('\n') }
  }

  private async executeShowChildrenWithoutHomework(): Promise<ExecutionResult> {
    const r = await apiClient.getReports(this.orgId, 7)
    const noHw = r.childCompletion.filter((c) => c.totalTasks === 0)
    if (!noHw.length) return { content: '✅ All children have at least one task assigned.' }
    const list = noHw.map((c) => `• ${c.childName}`).join('\n')
    return {
      content: `📋 Children without homework (${noHw.length}):\n\n${list}`,
      contextUpdate: { childNames: noHw.map((c) => c.childName) },
    }
  }

  private async executeShowLowActivity(): Promise<ExecutionResult> {
    const r = await apiClient.getReports(this.orgId, 7)
    const lines: string[] = []
    if (r.lowActivity.length) {
      lines.push(`⚠️ Low-activity parents (${r.lowActivity.length}):`)
      r.lowActivity.forEach((p) => lines.push(`• ${p.parentName} — ${p.completedLast7} tasks/week`))
    }
    const lowChildren = r.childCompletion.filter((c) => c.totalTasks > 0 && c.percent < 30)
    if (lowChildren.length) {
      if (lines.length) lines.push('')
      lines.push(`📉 Children below 30% completion (${lowChildren.length}):`)
      lowChildren.forEach((c) => lines.push(`• ${c.childName} — ${c.percent}%`))
    }
    if (!lines.length) return { content: '✅ No low-activity families this week.' }
    const resultChildren = lowChildren.map((c) => c.childName)
    return {
      content: lines.join('\n'),
      contextUpdate: { childNames: resultChildren.length ? resultChildren : undefined },
    }
  }

  private async executeSendReminder(action: ParsedAction): Promise<ExecutionResult> {
    const childNames = action.params.childNames || []
    if (!childNames.length) throw new Error(this.t.noChildren('?'))

    const message = action.params.message || 'Reminder from your specialist'

    const all = await apiClient.getChildren(this.orgId)
    if (!all.length) throw new Error(this.t.noChildrenYet)

    const child = all.find((c) =>
      childNames.some((n) => c.name.toLowerCase().includes(n.toLowerCase()))
    )
    if (!child) throw new Error(this.t.noChildren(childNames.join(', ')))

    const d = await apiClient.getChildDetail(this.orgId, child.id)
    if (!d.parentInfo?.uid) throw new Error(this.t.noParent(child.name))

    // Creates a parent-visible task as the reminder delivery mechanism
    await apiClient.createChildTask(this.orgId, child.id, {
      title: `📩 ${message}`,
    })

    this.onSuccess?.()
    return {
      content: this.t.successReminder(child.name),
      speakText: this.t.successReminder(child.name),
    }
  }
}
