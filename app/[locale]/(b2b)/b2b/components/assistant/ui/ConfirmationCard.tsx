'use client'

import {
  Bot,
  XCircle,
  Check,
  FolderPlus,
  UserPlus,
  CalendarClock,
  ListChecks,
  MessageCircle,
} from 'lucide-react'
import { ParsedAction, TranslationSet } from '../types'

const actionIcons: Record<string, React.ReactNode> = {
  create_group: <FolderPlus className="h-4 w-4 text-primary-600" />,
  add_children_to_group: <UserPlus className="h-4 w-4 text-blue-600" />,
  add_child: <UserPlus className="h-4 w-4 text-blue-600" />,
  update_group_schedule: <CalendarClock className="h-4 w-4 text-amber-600" />,
  assign_homework: <ListChecks className="h-4 w-4 text-violet-600" />,
  send_reminder: <MessageCircle className="h-4 w-4 text-rose-600" />,
}

function getSummary(action: ParsedAction): string {
  switch (action.type) {
    case 'create_group': {
      const sched = action.params.schedule ? ` — ${action.params.schedule}` : ''
      return `Create group "${action.params.name || '?'}"${sched}`
    }
    case 'add_children_to_group':
    case 'add_child':
      return `Add ${(action.params.childNames || []).join(', ')} to group "${action.params.groupName || '?'}"`
    case 'update_group_schedule':
      return `Update schedule of "${action.params.groupName || '?'}" to ${action.params.newSchedule || '?'}`
    case 'assign_homework':
      return `Assign "${action.params.homeworkTitle || '?'}" to ${(action.params.childNames || []).join(', ')}`
    case 'send_reminder':
      return `Send reminder to ${(action.params.childNames || []).join(', ')}: "${action.params.message || '?'}"`
    default:
      return 'Confirm this action'
  }
}

function getParams(
  action: ParsedAction,
  pl: TranslationSet['paramLabels']
): Array<{ label: string; value: string }> {
  switch (action.type) {
    case 'create_group':
      return [
        { label: pl.name, value: action.params.name || '—' },
        ...(action.params.schedule ? [{ label: pl.schedule, value: action.params.schedule }] : []),
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
        { label: pl.group, value: action.params.groupName || '—' },
        { label: pl.schedule, value: action.params.newSchedule || '—' },
      ]
    case 'assign_homework':
      return [
        { label: pl.child, value: (action.params.childNames || []).join(', ') || '—' },
        { label: pl.homework, value: action.params.homeworkTitle || '—' },
        ...(action.params.homeworkDescription
          ? [{ label: 'Note', value: action.params.homeworkDescription }]
          : []),
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

interface ConfirmationCardProps {
  action: ParsedAction
  t: TranslationSet
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmationCard({ action, t, onConfirm, onCancel }: ConfirmationCardProps) {
  const params = getParams(action, t.paramLabels)
  const title = t.formTitles[action.type] || ''
  const summary = getSummary(action)

  return (
    <div className="rounded-xl border border-primary-200 bg-primary-50 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-1.5">
        {actionIcons[action.type] || <Bot className="h-4 w-4" />}
        <span className="text-xs font-bold text-primary-800 uppercase tracking-wider">{title}</span>
      </div>

      {/* Natural language summary */}
      <p className="text-sm text-primary-900 font-medium leading-snug">{summary}</p>

      {/* Structured params */}
      <div className="space-y-1.5 border-t border-primary-200 pt-2">
        {params.map((p) => (
          <div key={p.label} className="flex items-baseline gap-3">
            <span className="text-xs text-primary-600 w-20 shrink-0">{p.label}</span>
            <span className="text-xs font-semibold text-gray-800">{p.value}</span>
          </div>
        ))}
      </div>

      {/* Buttons */}
      <div className="flex gap-2 pt-1">
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
