'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { ActionExecutor } from './executor'
import { Message, ParsedAction, ActionType, TranslationSet } from './types'
import { apiClient } from '@/lib/b2b/api'

// ── Types ────────────────────────────────────────────────────────────────────

interface DisambigOption {
  value: string
  display: string
}

interface ClarifyField {
  key: string
  isList: boolean
  // Set only for entity disambiguation (multiple backend matches)
  disambiguation?: {
    searchName: string
    candidates: DisambigOption[]
  }
}

interface ClarifyState {
  action: ParsedAction
  fields: ClarifyField[]
}

// ── Required text fields per action (in collection order) ────────────────────

const REQUIRED_FIELDS: Record<string, ClarifyField[]> = {
  create_group: [
    { key: 'name', isList: false },
    { key: 'schedule', isList: false },
  ],
  add_child: [
    { key: 'childNames', isList: true },
    { key: 'groupName', isList: false },
  ],
  add_children_to_group: [
    { key: 'childNames', isList: true },
    { key: 'groupName', isList: false },
  ],
  assign_homework: [
    { key: 'childNames', isList: true },
    { key: 'homeworkTitle', isList: false },
  ],
  send_reminder: [
    { key: 'childNames', isList: true },
    { key: 'message', isList: false },
  ],
  update_group_schedule: [
    { key: 'groupName', isList: false },
    { key: 'newSchedule', isList: false },
  ],
}

// Actions that need live entity resolution before confirmation
const RESOLVES_CHILDREN = new Set([
  'add_child',
  'add_children_to_group',
  'assign_homework',
  'send_reminder',
])
const RESOLVES_GROUP = new Set(['add_child', 'add_children_to_group', 'update_group_schedule'])

// Actions that execute immediately without a confirmation card
const READ_ONLY_ACTIONS = new Set([
  'list_groups',
  'list_children',
  'show_reports',
  'show_children_without_homework',
  'show_low_activity',
])

// Follow-up suggestion chips shown after each action type
const FOLLOW_UP_MAP: Record<string, Array<{ key: string; actionType: string; color: string }>> = {
  create_group: [{ key: 'addChildren', actionType: 'add_children_to_group', color: 'blue' }],
  add_child: [
    { key: 'assignHomework', actionType: 'assign_homework', color: 'violet' },
    { key: 'sendReminder', actionType: 'send_reminder', color: 'rose' },
  ],
  add_children_to_group: [
    { key: 'assignHomework', actionType: 'assign_homework', color: 'violet' },
    { key: 'sendReminder', actionType: 'send_reminder', color: 'rose' },
  ],
  assign_homework: [{ key: 'sendReminder', actionType: 'send_reminder', color: 'rose' }],
  show_children_without_homework: [
    { key: 'assignThem', actionType: 'assign_homework', color: 'violet' },
    { key: 'remindThem', actionType: 'send_reminder', color: 'rose' },
  ],
  show_low_activity: [{ key: 'remindThem', actionType: 'send_reminder', color: 'rose' }],
  show_reports: [
    { key: 'checkNoHomework', actionType: 'show_children_without_homework', color: 'rose' },
    { key: 'checkLowActivity', actionType: 'show_low_activity', color: 'violet' },
  ],
}

// ── Entity resolution helpers ─────────────────────────────────────────────────

type ResolveResult =
  | { kind: 'resolved'; value: string }
  | { kind: 'ambiguous'; candidates: DisambigOption[] }
  | { kind: 'notfound' }

async function resolveChild(orgId: string, name: string): Promise<ResolveResult> {
  const all = await apiClient.getChildren(orgId)
  const q = name.toLowerCase()
  const matches = all.filter(
    (c) => c.name.toLowerCase().includes(q) || q.includes(c.name.toLowerCase().split(' ')[0])
  )
  if (matches.length === 0) return { kind: 'notfound' }
  if (matches.length === 1) return { kind: 'resolved', value: matches[0].name }
  return {
    kind: 'ambiguous',
    candidates: matches.slice(0, 5).map((c) => ({
      value: c.name,
      display: c.age !== undefined ? `${c.name} (age ${c.age})` : c.name,
    })),
  }
}

async function resolveGroup(orgId: string, name: string): Promise<ResolveResult> {
  const { groups } = await apiClient.getGroups(orgId)
  const list = groups as Array<{ id: string; name: string; description?: string }>
  const q = name.toLowerCase()
  const matches = list.filter(
    (g) => g.name.toLowerCase().includes(q) || q.includes(g.name.toLowerCase())
  )
  if (matches.length === 0) return { kind: 'notfound' }
  if (matches.length === 1) return { kind: 'resolved', value: matches[0].name }
  return {
    kind: 'ambiguous',
    candidates: matches.slice(0, 5).map((g) => ({
      value: g.name,
      display: g.description ? `${g.name} — ${g.description}` : g.name,
    })),
  }
}

// ── State-machine helpers ─────────────────────────────────────────────────────

function getMissingFields(action: ParsedAction): ClarifyField[] {
  const rules = REQUIRED_FIELDS[action.type] || []
  return rules.filter(({ key, isList }) => {
    const v = action.params[key as keyof typeof action.params]
    return isList ? !(v as string[] | undefined)?.length : !v
  })
}

function applyTextAnswer(action: ParsedAction, field: ClarifyField, raw: string): ParsedAction {
  const params = { ...action.params }
  if (field.isList) {
    ;(params as Record<string, unknown>)[field.key] = raw
      .split(/[,،、]+|(?:\s+(?:and|и|жана)\s+)/)
      .map((s) => s.trim())
      .filter(Boolean)
  } else {
    ;(params as Record<string, unknown>)[field.key] = raw.trim()
  }
  return { ...action, params }
}

function applyDisambigAnswer(
  action: ParsedAction,
  field: ClarifyField,
  chosen: string
): ParsedAction {
  const params = { ...action.params }
  if (field.key === 'childNames' && field.disambiguation) {
    params.childNames = (params.childNames || []).map((n) =>
      n === field.disambiguation!.searchName ? chosen : n
    )
  } else {
    ;(params as Record<string, unknown>)[field.key] = chosen
  }
  return { ...action, params }
}

function buildDisambigMessage(field: ClarifyField, t: TranslationSet): string {
  if (!field.disambiguation) return ''
  const { searchName, candidates } = field.disambiguation
  const header =
    field.key === 'groupName' ? t.disambigGroup(searchName) : t.disambigChild(searchName)
  const list = candidates.map((c, i) => `${i + 1}. ${c.display}`).join('\n')
  return `${header}\n\n${list}\n\n${t.pickNumber}`
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useAssistant(orgId: string, t: TranslationSet, onCommandExecuted?: () => void) {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [clarifyState, setClarifyState] = useState<ClarifyState | null>(null)
  const [sessionCtx, setSessionCtx] = useState<{
    lastGroupName?: string
    lastChildNames?: string[]
    lastResultChildren?: string[]
    lastAction?: string
  }>({})
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const addMessage = useCallback((msg: Omit<Message, 'id' | 'timestamp'>): string => {
    const id = `${Date.now()}${Math.random()}`
    setMessages((prev) => [...prev, { ...msg, id, timestamp: new Date() }])
    return id
  }, [])

  const updateMessage = useCallback((id: string, patch: Partial<Message>) => {
    setMessages((prev) => prev.map((m) => (m.id !== id ? m : { ...m, ...patch })))
  }, [])

  const executeAction = useCallback(
    async (action: ParsedAction, msgId: string) => {
      updateMessage(msgId, { status: 'executing', pending: undefined, form: undefined })
      const executor = new ActionExecutor(orgId, t, onCommandExecuted)
      try {
        const result = await executor.execute(action)
        const followUpConfig = FOLLOW_UP_MAP[action.type]
        const suggestions = followUpConfig?.map(({ key, actionType, color }) => ({
          label: t.followUp[key] || key,
          actionType,
          color,
        }))
        updateMessage(msgId, {
          content: result.content,
          status: 'done',
          isError: false,
          suggestions: suggestions?.length ? suggestions : undefined,
        })
        setSessionCtx((prev) => {
          const next = { ...prev, lastAction: action.type }
          if (action.params.groupName) next.lastGroupName = action.params.groupName
          if (action.params.childNames?.length) next.lastChildNames = action.params.childNames
          if (result.contextUpdate?.childNames?.length)
            next.lastResultChildren = result.contextUpdate.childNames
          if (result.contextUpdate?.groupName) next.lastGroupName = result.contextUpdate.groupName
          return next
        })
      } catch (err) {
        updateMessage(msgId, {
          content: err instanceof Error ? err.message : 'Error',
          status: 'done',
          isError: true,
        })
      }
    },
    [orgId, t, onCommandExecuted, updateMessage]
  )

  // Resolve real entities from backend data before showing confirmation.
  // If entities are ambiguous, enters disambiguation clarification.
  const resolveAndConfirm = useCallback(
    async (action: ParsedAction) => {
      if (!RESOLVES_CHILDREN.has(action.type) && !RESOLVES_GROUP.has(action.type)) {
        addMessage({ role: 'assistant', content: '', pending: { action }, status: 'confirming' })
        return
      }

      const disambigFields: ClarifyField[] = []
      let params = { ...action.params }

      if (RESOLVES_CHILDREN.has(action.type) && params.childNames?.length) {
        const resolvedNames: string[] = []
        for (const name of params.childNames) {
          const result = await resolveChild(orgId, name)
          if (result.kind === 'notfound') {
            addMessage({
              role: 'assistant',
              content: t.noChildren(name),
              status: 'done',
              isError: true,
            })
            return
          }
          if (result.kind === 'resolved') {
            resolvedNames.push(result.value)
          } else {
            resolvedNames.push(name) // placeholder — replaced after user picks
            disambigFields.push({
              key: 'childNames',
              isList: true,
              disambiguation: { searchName: name, candidates: result.candidates },
            })
          }
        }
        params = { ...params, childNames: resolvedNames }
      }

      if (RESOLVES_GROUP.has(action.type) && params.groupName) {
        const result = await resolveGroup(orgId, params.groupName)
        if (result.kind === 'notfound') {
          addMessage({
            role: 'assistant',
            content: t.noGroup(params.groupName),
            status: 'done',
            isError: true,
          })
          return
        }
        if (result.kind === 'resolved') {
          params = { ...params, groupName: result.value }
        } else {
          disambigFields.push({
            key: 'groupName',
            isList: false,
            disambiguation: { searchName: params.groupName, candidates: result.candidates },
          })
        }
      }

      const resolvedAction = { ...action, params }

      if (disambigFields.length > 0) {
        addMessage({
          role: 'assistant',
          content: buildDisambigMessage(disambigFields[0], t),
          status: 'done',
        })
        setClarifyState({ action: resolvedAction, fields: disambigFields })
      } else {
        addMessage({
          role: 'assistant',
          content: '',
          pending: { action: resolvedAction },
          status: 'confirming',
        })
      }
    },
    [orgId, t, addMessage]
  )

  const handleInput = useCallback(
    async (text: string) => {
      if (!text.trim() || isProcessing) return
      addMessage({ role: 'user', content: text })
      setInputText('')
      setIsProcessing(true)

      // ── CLARIFICATION / DISAMBIGUATION MODE ────────────────────────────
      if (clarifyState) {
        const [current, ...rest] = clarifyState.fields

        if (current.disambiguation) {
          // User should type a number to pick from the list
          const num = parseInt(text.trim())
          const max = current.disambiguation.candidates.length
          if (isNaN(num) || num < 1 || num > max) {
            addMessage({ role: 'assistant', content: t.pickNumber, status: 'done' })
            setIsProcessing(false)
            return
          }
          const chosen = current.disambiguation.candidates[num - 1].value
          const updated = applyDisambigAnswer(clarifyState.action, current, chosen)

          if (rest.length > 0) {
            const nextMsg = rest[0].disambiguation
              ? buildDisambigMessage(rest[0], t)
              : t.clarifyQ[`${updated.type}.${rest[0].key}`] || rest[0].key
            addMessage({ role: 'assistant', content: nextMsg, status: 'done' })
            setClarifyState({ action: updated, fields: rest })
          } else {
            setClarifyState(null)
            addMessage({
              role: 'assistant',
              content: '',
              pending: { action: updated },
              status: 'confirming',
            })
          }
        } else {
          // Text answer for a missing field
          const updated = applyTextAnswer(clarifyState.action, current, text)

          if (rest.length > 0) {
            const nextMsg = rest[0].disambiguation
              ? buildDisambigMessage(rest[0], t)
              : t.clarifyQ[`${updated.type}.${rest[0].key}`] || rest[0].key
            addMessage({ role: 'assistant', content: nextMsg, status: 'done' })
            setClarifyState({ action: updated, fields: rest })
          } else {
            // All text fields collected — now do entity resolution
            setClarifyState(null)
            await resolveAndConfirm(updated)
          }
        }

        setIsProcessing(false)
        return
      }

      // ── LLM INTENT PARSE ──────────────────────────────────────────────
      let action: ParsedAction
      try {
        const result = await apiClient.parseAssistantIntent(orgId, text, {
          lastGroupName: sessionCtx.lastGroupName,
          lastChildNames: sessionCtx.lastChildNames,
          lastResultChildren: sessionCtx.lastResultChildren,
        })
        action = result as ParsedAction
      } catch {
        addMessage({ role: 'assistant', content: t.llmError, status: 'done', isError: true })
        setIsProcessing(false)
        return
      }

      if (action.type === 'unknown') {
        addMessage({ role: 'assistant', content: t.unknownCmd, status: 'done' })
        setIsProcessing(false)
        return
      }

      if (READ_ONLY_ACTIONS.has(action.type)) {
        const mid = addMessage({ role: 'assistant', content: '', status: 'executing' })
        await executeAction(action, mid)
        setIsProcessing(false)
        return
      }

      // ── TEXT FIELD CLARIFICATION ──────────────────────────────────────
      const missing = getMissingFields(action)
      if (missing.length > 0) {
        const recognized = t.intentRecognized[action.type] || ''
        const question = t.clarifyQ[`${action.type}.${missing[0].key}`] || missing[0].key
        const content = recognized ? `${recognized}\n\n${question}` : question
        addMessage({ role: 'assistant', content, status: 'done' })
        setClarifyState({ action, fields: missing })
        setIsProcessing(false)
        return
      }

      // ── ENTITY RESOLUTION → CONFIRMATION ─────────────────────────────
      await resolveAndConfirm(action)
      setIsProcessing(false)
    },
    [orgId, sessionCtx, isProcessing, clarifyState, t, addMessage, executeAction, resolveAndConfirm]
  )

  const handleChipAction = useCallback(
    (actionType: string) => {
      setClarifyState(null)
      if (READ_ONLY_ACTIONS.has(actionType)) {
        const mid = addMessage({ role: 'assistant', content: '', status: 'executing' })
        executeAction({ type: actionType as ActionType, params: {}, raw: '' }, mid)
        return
      }
      const formConfig = t.forms[actionType]
      if (!formConfig) return
      addMessage({
        role: 'assistant',
        content: '',
        form: { ...formConfig, actionType: actionType as Exclude<ActionType, 'unknown'> },
        status: 'form',
      })
    },
    [t, addMessage, executeAction]
  )

  const handleFormSubmit = useCallback(
    (msgId: string, action: ParsedAction) => {
      updateMessage(msgId, {
        form: undefined,
        pending: { action },
        status: 'confirming',
        content: '',
      })
    },
    [updateMessage]
  )

  const handleConfirm = useCallback(
    (msgId: string, action: ParsedAction) => {
      executeAction(action, msgId)
    },
    [executeAction]
  )

  const handleCancel = useCallback(
    (msgId: string) => {
      setClarifyState(null)
      updateMessage(msgId, {
        content: t.cancelled,
        status: 'cancelled',
        pending: undefined,
        form: undefined,
      })
    },
    [t, updateMessage]
  )

  // Follow-up suggestion click: pre-fills context-dependent params when available
  const handleSuggestionAction = useCallback(
    (actionType: string) => {
      setClarifyState(null)

      // If action needs children and we have a result set, pre-fill from last query
      if (RESOLVES_CHILDREN.has(actionType) && sessionCtx.lastResultChildren?.length) {
        const preAction: ParsedAction = {
          type: actionType as ActionType,
          params: {
            childNames: sessionCtx.lastResultChildren,
            groupName: sessionCtx.lastGroupName,
          },
          raw: '',
        }
        const missing = getMissingFields(preAction)
        if (missing.length > 0) {
          const question = t.clarifyQ[`${actionType}.${missing[0].key}`] || missing[0].key
          addMessage({ role: 'assistant', content: question, status: 'done' })
          setClarifyState({ action: preAction, fields: missing })
          return
        }
        resolveAndConfirm(preAction)
        return
      }

      if (READ_ONLY_ACTIONS.has(actionType)) {
        const mid = addMessage({ role: 'assistant', content: '', status: 'executing' })
        executeAction({ type: actionType as ActionType, params: {}, raw: '' }, mid)
        return
      }

      const formConfig = t.forms[actionType]
      if (!formConfig) return
      addMessage({
        role: 'assistant',
        content: '',
        form: { ...formConfig, actionType: actionType as Exclude<ActionType, 'unknown'> },
        status: 'form',
      })
    },
    [sessionCtx, t, addMessage, executeAction, resolveAndConfirm]
  )

  return {
    messages,
    inputText,
    setInputText,
    isProcessing,
    isClarifying: clarifyState !== null,
    sessionCtx,
    messagesEndRef,
    handleInput,
    handleChipAction,
    handleSuggestionAction,
    handleFormSubmit,
    handleConfirm,
    handleCancel,
  }
}
