export type ActionType =
  | 'create_group'
  | 'add_children_to_group'
  | 'add_child'
  | 'update_group_schedule'
  | 'assign_homework'
  | 'send_reminder'
  | 'list_groups'
  | 'list_children'
  | 'unknown'

export type VoiceState = 'idle' | 'listening' | 'error'
export type Locale = 'en' | 'ru' | 'ky'
export type MessageStatus = 'form' | 'confirming' | 'executing' | 'done' | 'cancelled'

export interface ParsedAction {
  type: ActionType
  params: {
    name?: string
    schedule?: string
    groupName?: string
    childNames?: string[]
    newSchedule?: string
    homeworkTitle?: string
    homeworkDescription?: string
    message?: string
  }
  raw: string
}

export interface FormField {
  key: string
  label: string
  type: 'text' | 'days' | 'time'
  placeholder?: string
  required?: boolean
}

export interface MessageForm {
  actionType: Exclude<ActionType, 'unknown'>
  title: string
  fields: FormField[]
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  form?: MessageForm
  pending?: { action: ParsedAction }
  status?: MessageStatus
}

export interface ChipConfig {
  label: string
  color: string
  actionType: ActionType
}

export interface TranslationSet {
  title: string
  open: string
  howCanHelp: string
  type: string
  thinking: string
  confirm: string
  cancel: string
  next: string
  cancelled: string
  mute: string
  unmute: string
  startListen: string
  stopListen: string
  tapToSpeak: string
  listening: string
  noSupport: string
  recogError: string
  notAuth: string
  noGroup: (n: string) => string
  noChildren: (n: string) => string
  noParent: (n: string) => string
  successCreate: (n: string) => string
  successAdd: (c: string, g: string) => string
  successUpdate: (g: string) => string
  successHomework: (c: string) => string
  successReminder: (c: string) => string
  successChild: (c: string, g: string) => string
  children: string
  noChildrenYet: string
  unknownCmd: string
  groups: string
  noGroupsYet: string
  voiceLang: string
  help: string
  days: Record<string, string>
  paramLabels: Record<string, string>
  formTitles: Record<string, string>
  helpContent: Array<{ cmd: string; example: string }>
  chips: ChipConfig[]
  forms: Record<string, { title: string; fields: FormField[] }>
}
