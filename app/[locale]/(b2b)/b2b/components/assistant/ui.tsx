'use client'

import React from 'react'
import { Message, MessageForm, ParsedAction, TranslationSet } from './types'
import {
  Bot,
  User,
  Loader2,
  XCircle,
  Check,
  ArrowRight,
  FolderPlus,
  UserPlus,
  CalendarClock,
  ListChecks,
  MessageCircle,
} from 'lucide-react'
import { ChipConfig } from './types'

const CHIP_ICONS: Record<string, React.ReactNode> = {
  primary: <FolderPlus className="h-3.5 w-3.5" />,
  blue: <UserPlus className="h-3.5 w-3.5" />,
  indigo: <UserPlus className="h-3.5 w-3.5" />,
  amber: <CalendarClock className="h-3.5 w-3.5" />,
  violet: <ListChecks className="h-3.5 w-3.5" />,
  rose: <MessageCircle className="h-3.5 w-3.5" />,
  green: <ListChecks className="h-3.5 w-3.5" />,
  teal: <UserPlus className="h-3.5 w-3.5" />,
}

const CHIP_STYLES: Record<string, string> = {
  primary: 'bg-primary-50 text-primary-700 border-primary-200 hover:bg-primary-100',
  blue: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
  indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100',
  amber: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100',
  violet: 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100',
  rose: 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100',
  green: 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100',
  teal: 'bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100',
}

const actionIcons: Record<string, React.ReactNode> = {
  create_group: <FolderPlus className="h-4 w-4 text-primary-600" />,
  add_children_to_group: <UserPlus className="h-4 w-4 text-blue-600" />,
  add_child: <UserPlus className="h-4 w-4 text-blue-600" />,
  update_group_schedule: <CalendarClock className="h-4 w-4 text-amber-600" />,
  assign_homework: <ListChecks className="h-4 w-4 text-violet-600" />,
  send_reminder: <MessageCircle className="h-4 w-4 text-rose-600" />,
  list_groups: <ListChecks className="h-4 w-4 text-green-600" />,
  list_children: <UserPlus className="h-4 w-4 text-teal-600" />,
}

export function ChipRow({
  chips,
  onChip,
}: {
  chips: ChipConfig[]
  onChip: (type: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((chip, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChip(chip.actionType)}
          className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${CHIP_STYLES[chip.color]}`}
        >
          {CHIP_ICONS[chip.color]}
          {chip.label}
        </button>
      ))}
    </div>
  )
}

export function FormMessage({
  form,
  t,
  onSubmit,
  onCancel,
}: {
  form: MessageForm
  t: TranslationSet
  onSubmit: (action: ParsedAction) => void
  onCancel: () => void
}) {
  const [values, setValues] = React.useState<Record<string, string>>({})
  const [selectedDays, setSelectedDays] = React.useState<string[]>([])

  const toggleDay = (d: string) =>
    setSelectedDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]))

  const isValid = form.fields
    .filter((f) => f.required)
    .every((f) => (f.type === 'days' ? selectedDays.length > 0 : !!values[f.key]?.trim()))

  const handleSubmit = () => {
    const dayLabels = selectedDays.map((d) => t.days[d]).filter(Boolean)
    const time = values.time?.trim() || ''
    const schedule =
      dayLabels.length && time
        ? `${dayLabels.join(', ')} ${time}`
        : dayLabels.length
          ? dayLabels.join(', ')
          : time

    const action: ParsedAction = {
      type: form.actionType,
      raw: '',
      params: {
        name: values.name?.trim(),
        schedule: form.actionType === 'create_group' ? schedule : undefined,
        groupName: values.group?.trim(),
        childNames: values.children
          ? values.children
              .split(/[,،、]+/)
              .map((s) => s.trim())
              .filter(Boolean)
          : values.child
            ? [values.child.trim()]
            : undefined,
        newSchedule: form.actionType === 'update_group_schedule' ? schedule : undefined,
        homeworkTitle: values.homework?.trim(),
        homeworkDescription: values.description?.trim(),
        message: values.message?.trim(),
      },
    }
    onSubmit(action)
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4 space-y-3">
      <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
        {actionIcons[form.actionType] || <Bot className="h-4 w-4" />}
        <span className="text-sm font-semibold text-gray-800">{form.title}</span>
      </div>
      {form.fields.map((field) => (
        <div key={field.key} className="space-y-1.5">
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
            {field.label}
            {field.required && <span className="text-red-400 ml-0.5">*</span>}
          </label>
          {field.type === 'days' ? (
            <div className="flex flex-wrap gap-1">
              {(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDay(d)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium border transition-colors ${
                    selectedDays.includes(d)
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'
                  }`}
                >
                  {t.days[d]}
                </button>
              ))}
            </div>
          ) : (
            <input
              type="text"
              value={values[field.key] || ''}
              onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
              placeholder={field.placeholder}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
          )}
        </div>
      ))}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <XCircle className="h-3.5 w-3.5" /> {t.cancel}
        </button>
        <button
          type="button"
          disabled={!isValid}
          onClick={handleSubmit}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-40 transition-colors"
        >
          <ArrowRight className="h-3.5 w-3.5" /> {t.next}
        </button>
      </div>
    </div>
  )
}

export function ConfirmCard({
  action,
  t,
  onConfirm,
  onCancel,
}: {
  action: ParsedAction
  t: TranslationSet
  onConfirm: () => void
  onCancel: () => void
}) {
  const getParams = (): Array<{ label: string; value: string }> => {
    const pl = t.paramLabels
    switch (action.type) {
      case 'create_group':
        return [
          { label: pl.name, value: action.params.name || '—' },
          ...(action.params.schedule
            ? [{ label: pl.schedule, value: action.params.schedule }]
            : []),
        ]
      case 'add_children_to_group':
      case 'add_child':
        return [
          {
            label: pl.children || pl.child,
            value: (action.params.childNames || []).join(', ') || '—',
          },
          { label: pl.group, value: action.params.groupName || '—' },
        ]
      case 'update_group_schedule':
        return [
          { label: pl.group, value: action.params.groupName || '(current)' },
          { label: pl.schedule, value: action.params.newSchedule || '—' },
        ]
      case 'assign_homework':
        return [
          { label: pl.child, value: (action.params.childNames || []).join(', ') || '—' },
          { label: pl.homework, value: action.params.homeworkTitle || '—' },
        ]
      case 'send_reminder':
        return [
          { label: pl.child, value: (action.params.childNames || []).join(', ') || '—' },
          { label: pl.message, value: action.params.message || '—' },
        ]
      default:
        return []
    }
  }

  const params = getParams()
  const title = t.formTitles[action.type] || ''

  return (
    <div className="rounded-xl border border-primary-200 bg-primary-50 p-3">
      <div className="flex items-center gap-1.5 mb-3">
        {actionIcons[action.type] || <Bot className="h-4 w-4" />}
        <span className="text-xs font-bold text-primary-800 uppercase tracking-wider">{title}</span>
      </div>
      <div className="space-y-2 mb-3">
        {params.map((p) => (
          <div key={p.label} className="flex items-baseline gap-3">
            <span className="text-xs text-gray-500 w-24 shrink-0">{p.label}</span>
            <span className="text-sm font-semibold text-gray-800">{p.value}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <XCircle className="h-3.5 w-3.5" /> {t.cancel}
        </button>
        <button
          onClick={onConfirm}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700 transition-colors"
        >
          <Check className="h-3.5 w-3.5" /> {t.confirm}
        </button>
      </div>
    </div>
  )
}

export function ContextBar({
  groupName,
  childNames,
}: {
  groupName?: string
  childNames?: string[]
}) {
  const items = [
    ...(groupName ? [{ text: groupName, cls: 'bg-primary-100 text-primary-700' }] : []),
    ...(childNames?.slice(0, 3).map((n) => ({ text: n, cls: 'bg-blue-100 text-blue-700' })) || []),
  ]
  if (!items.length) return null
  return (
    <div className="flex items-center gap-1.5 flex-wrap px-3 py-1.5 border-b border-gray-100 bg-gray-50/80 shrink-0">
      <span className="text-xs text-gray-400 font-medium">Context:</span>
      {items.map((item, i) => (
        <span key={i} className={`rounded-full px-2 py-0.5 text-xs font-medium ${item.cls}`}>
          {item.text}
        </span>
      ))}
    </div>
  )
}

export function MessageBubble({
  message,
  t,
  onFormSubmit,
  onFormCancel,
  onConfirm,
  onCancel,
  onSuggestion,
}: {
  message: Message
  t: TranslationSet
  onFormSubmit: (action: ParsedAction) => void
  onFormCancel: () => void
  onConfirm: () => void
  onCancel: () => void
  onSuggestion?: (actionType: string) => void
}) {
  return (
    <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`flex items-start gap-2 max-w-[90%] ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
      >
        <div
          className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
            message.role === 'user' ? 'bg-primary-100' : 'bg-gray-100'
          }`}
        >
          {message.role === 'user' ? (
            <User className="h-3 w-3 text-primary-600" />
          ) : (
            <Bot className="h-3 w-3 text-gray-600" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          {message.status === 'form' && message.form ? (
            <FormMessage
              form={message.form}
              t={t}
              onSubmit={onFormSubmit}
              onCancel={onFormCancel}
            />
          ) : message.status === 'confirming' && message.pending ? (
            <ConfirmCard
              action={message.pending.action}
              t={t}
              onConfirm={onConfirm}
              onCancel={onCancel}
            />
          ) : message.status === 'executing' ? (
            <div className="flex items-center gap-2 bg-gray-100 px-3 py-2 rounded-lg">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-500" />
              <span className="text-sm text-gray-500">{t.thinking}</span>
            </div>
          ) : (
            <div className="space-y-2">
              <div
                className={`px-3 py-2 rounded-xl text-sm whitespace-pre-line break-words ${
                  message.role === 'user'
                    ? 'bg-primary-600 text-white'
                    : message.isError
                      ? 'bg-red-50 text-red-800 border border-red-200'
                      : message.status === 'done' && message.content !== t.cancelled
                        ? 'bg-green-50 text-green-800 border border-green-200'
                        : message.status === 'cancelled'
                          ? 'bg-gray-100 text-gray-400 italic'
                          : 'bg-gray-100 text-gray-700'
                }`}
              >
                {message.content}
              </div>
              {message.role === 'assistant' &&
              message.status === 'done' &&
              message.suggestions?.length ? (
                <div className="flex flex-wrap gap-1.5 pl-1">
                  {message.suggestions.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => onSuggestion?.(s.actionType)}
                      className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${CHIP_STYLES[s.color] || CHIP_STYLES.primary}`}
                    >
                      <ArrowRight className="h-3 w-3" />
                      {s.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
