'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { getIdToken } from '@/lib/b2b/authClient'
import { apiClient } from '@/lib/b2b/api'
import {
  Mic,
  MicOff,
  X,
  Loader2,
  Check,
  XCircle,
  MessageCircle,
  Volume2,
  VolumeX,
  Send,
  Bot,
  User,
  Keyboard,
  ListChecks,
  CalendarClock,
  UserPlus,
  FolderPlus,
  ArrowRight,
  HelpCircle,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

type ActionType =
  | 'create_group'
  | 'add_children_to_group'
  | 'add_child'
  | 'update_group_schedule'
  | 'assign_homework'
  | 'send_reminder'
  | 'list_groups'
  | 'list_children'
  | 'unknown'
type VoiceState = 'idle' | 'listening' | 'error'
type Locale = 'en' | 'ru' | 'ky'

interface ParsedAction {
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

interface FormField {
  key: string
  label: string
  type: 'text' | 'days' | 'time'
  placeholder?: string
  required?: boolean
}

interface MessageForm {
  actionType: Exclude<ActionType, 'unknown'>
  title: string
  fields: FormField[]
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  form?: MessageForm
  pending?: { action: ParsedAction }
  status?: 'form' | 'confirming' | 'executing' | 'done' | 'cancelled'
}

// ─── Translations ─────────────────────────────────────────────────────────────

const T = {
  en: {
    title: 'AI Assistant',
    open: 'Open assistant',
    howCanHelp: 'What would you like to do?',
    type: 'Type a command...',
    thinking: 'Working on it...',
    confirm: 'Confirm',
    cancel: 'Cancel',
    next: 'Continue',
    cancelled: 'Cancelled.',
    mute: 'Mute',
    unmute: 'Unmute',
    startListen: 'Start listening',
    stopListen: 'Stop',
    tapToSpeak: 'Tap to speak',
    listening: 'Listening...',
    noSupport: 'Voice not supported in this browser.',
    recogError: 'Could not understand. Please try again.',
    notAuth: 'Not authenticated.',
    noGroup: (n: string) => `Group "${n}" not found.`,
    noChildren: (n: string) => `Children not found: ${n}.`,
    noParent: (n: string) => `"${n}" has no parent account yet.`,
    successCreate: (n: string) => `Group "${n}" created.`,
    successAdd: (c: string, g: string) => `${c} added to "${g}".`,
    successUpdate: (g: string) => `Schedule updated for "${g}".`,
    successHomework: (c: string) => `Homework assigned to ${c}.`,
    successReminder: (c: string) => `Reminder sent to ${c}.`,
    successChild: (c: string, g: string) => `${c} added to "${g}".`,
    children: 'Children',
    noChildrenYet: 'No children yet.',
    unknownCmd:
      'Command not recognised. Use one of the buttons below, or try:\n"Create group X on Mon at 15:00"\n"Add Arsen to group X"\n"Assign homework on colors to Alina"\n"Send reminder to Alina"',
    groups: 'Groups',
    noGroupsYet: 'No groups yet.',
    voiceLang: 'Speaking: EN',
    help: 'Help',
    days: { Mon: 'Mon', Tue: 'Tue', Wed: 'Wed', Thu: 'Thu', Fri: 'Fri', Sat: 'Sat', Sun: 'Sun' },
    paramLabels: {
      name: 'Name',
      schedule: 'Schedule',
      group: 'Group',
      children: 'Children',
      child: 'Child',
      homework: 'Homework',
      reminder: 'Reminder',
      message: 'Message',
    },
    formTitles: {
      create_group: 'Create Group',
      add_children_to_group: 'Add Children to Group',
      add_child: 'Add Child',
      update_group_schedule: 'Update Schedule',
      assign_homework: 'Assign Homework',
      send_reminder: 'Send Reminder',
    },
    helpContent: [
      { cmd: 'Create group', example: 'Create group Speech Therapy A on Mon, Wed at 15:00' },
      { cmd: 'Add children', example: 'Add Arsen and Dana to group Speech Therapy A' },
      { cmd: 'Add child', example: 'Add child Alina to group Speech Therapy A' },
      { cmd: 'Reschedule', example: 'Move lesson to Friday at 14:00' },
      { cmd: 'Assign homework', example: 'Assign homework on colors to Alina' },
      { cmd: 'Send reminder', example: 'Send reminder to complete exercises to Alina' },
      { cmd: 'Show groups', example: 'Show all groups' },
      { cmd: 'Show children', example: 'Show all children' },
    ],
    chips: [
      { label: 'Create group', color: 'primary', actionType: 'create_group' as ActionType },
      { label: 'Add children', color: 'blue', actionType: 'add_children_to_group' as ActionType },
      { label: 'Add child', color: 'indigo', actionType: 'add_child' as ActionType },
      { label: 'Reschedule', color: 'amber', actionType: 'update_group_schedule' as ActionType },
      { label: 'Homework', color: 'violet', actionType: 'assign_homework' as ActionType },
      { label: 'Reminder', color: 'rose', actionType: 'send_reminder' as ActionType },
      { label: 'Show groups', color: 'green', actionType: 'list_groups' as ActionType },
      { label: 'Children', color: 'teal', actionType: 'list_children' as ActionType },
    ],
    forms: {
      create_group: {
        title: 'Create Group',
        fields: [
          {
            key: 'name',
            label: 'Group name',
            type: 'text' as const,
            placeholder: 'e.g. Speech Therapy A',
            required: true,
          },
          { key: 'days', label: 'Days', type: 'days' as const },
          { key: 'time', label: 'Time', type: 'time' as const, placeholder: '15:00' },
        ],
      },
      add_children_to_group: {
        title: 'Add Children to Group',
        fields: [
          {
            key: 'children',
            label: 'Children (comma-separated)',
            type: 'text' as const,
            placeholder: 'Arsen, Dana',
            required: true,
          },
          {
            key: 'group',
            label: 'Group name',
            type: 'text' as const,
            placeholder: 'Speech Therapy A',
            required: true,
          },
        ],
      },
      update_group_schedule: {
        title: 'Update Schedule',
        fields: [
          {
            key: 'group',
            label: 'Group name',
            type: 'text' as const,
            placeholder: 'Speech Therapy A',
            required: true,
          },
          { key: 'days', label: 'New days', type: 'days' as const },
          { key: 'time', label: 'New time', type: 'time' as const, placeholder: '14:00' },
        ],
      },
      add_child: {
        title: 'Add Child to Group',
        fields: [
          {
            key: 'child',
            label: 'Child name',
            type: 'text' as const,
            placeholder: 'Alina',
            required: true,
          },
          {
            key: 'group',
            label: 'Group name',
            type: 'text' as const,
            placeholder: 'Speech Therapy A',
            required: true,
          },
        ],
      },
      assign_homework: {
        title: 'Assign Homework',
        fields: [
          {
            key: 'child',
            label: 'Child name',
            type: 'text' as const,
            placeholder: 'Alina',
            required: true,
          },
          {
            key: 'homework',
            label: 'Homework title',
            type: 'text' as const,
            placeholder: 'Practice colors',
            required: true,
          },
          {
            key: 'description',
            label: 'Description (optional)',
            type: 'text' as const,
            placeholder: 'Complete exercises 1-5',
          },
        ],
      },
      send_reminder: {
        title: 'Send Reminder',
        fields: [
          {
            key: 'child',
            label: 'Child name',
            type: 'text' as const,
            placeholder: 'Alina',
            required: true,
          },
          {
            key: 'message',
            label: 'Reminder message',
            type: 'text' as const,
            placeholder: 'Please complete your daily exercises',
            required: true,
          },
        ],
      },
    },
  },
  ru: {
    title: 'ИИ Ассистент',
    open: 'Открыть ассистент',
    howCanHelp: 'Что нужно сделать?',
    type: 'Введите команду...',
    thinking: 'Выполняю...',
    confirm: 'Подтвердить',
    cancel: 'Отмена',
    next: 'Далее',
    cancelled: 'Отменено.',
    mute: 'Выкл. звук',
    unmute: 'Вкл. звук',
    startListen: 'Начать',
    stopListen: 'Стоп',
    tapToSpeak: 'Нажмите, чтобы говорить',
    listening: 'Слушаю...',
    noSupport: 'Голосовой ввод не поддерживается.',
    recogError: 'Не удалось распознать. Попробуйте ещё раз.',
    notAuth: 'Требуется авторизация.',
    noGroup: (n: string) => `Группа "${n}" не найдена.`,
    noChildren: (n: string) => `Дети не найдены: ${n}.`,
    noParent: (n: string) => `У "${n}" нет аккаунта родителя.`,
    successCreate: (n: string) => `Группа "${n}" создана.`,
    successAdd: (c: string, g: string) => `${c} добавлены в "${g}".`,
    successUpdate: (g: string) => `Расписание "${g}" обновлено.`,
    successHomework: (c: string) => `Задание назначено для ${c}.`,
    successReminder: (c: string) => `Напоминание отправлено ${c}.`,
    successChild: (c: string, g: string) => `${c} добавлен в "${g}".`,
    children: 'Дети',
    noChildrenYet: 'Детей пока нет.',
    unknownCmd:
      'Команда не распознана. Используйте кнопки ниже или попробуйте:\n"Создай группу X по пн и ср в 15:00"\n"Добавь Арсена в группу X"\n"Назначь задание по цветам для Алины"\n"Отправь напоминание Алине"',
    groups: 'Группы',
    noGroupsYet: 'Групп пока нет.',
    voiceLang: 'Язык: RU',
    help: 'Помощь',
    days: { Mon: 'Пн', Tue: 'Вт', Wed: 'Ср', Thu: 'Чт', Fri: 'Пт', Sat: 'Сб', Sun: 'Вс' },
    paramLabels: {
      name: 'Название',
      schedule: 'Расписание',
      group: 'Группа',
      children: 'Дети',
      child: 'Ребёнок',
      homework: 'Задание',
      reminder: 'Напоминание',
      message: 'Сообщение',
    },
    formTitles: {
      create_group: 'Создать группу',
      add_children_to_group: 'Добавить детей в группу',
      add_child: 'Добавить ребёнка',
      update_group_schedule: 'Обновить расписание',
      assign_homework: 'Назначить задание',
      send_reminder: 'Отправить напоминание',
    },
    helpContent: [
      { cmd: 'Создать группу', example: 'Создай группу Логопедия А по пн и ср в 15:00' },
      { cmd: 'Добавить детей', example: 'Добавь Арсена и Дану в группу Логопедия А' },
      { cmd: 'Добавить ребёнка', example: 'Добавь Алину в группу Логопедия А' },
      { cmd: 'Перенести занятие', example: 'Перенеси занятие на пятницу в 14:00' },
      { cmd: 'Назначить задание', example: 'Назначь задание по цветам для Алины' },
      { cmd: 'Напоминание', example: 'Отправь напоминание Алине' },
      { cmd: 'Показать группы', example: 'Покажи все группы' },
      { cmd: 'Показать детей', example: 'Покажи всех детей' },
    ],
    chips: [
      { label: 'Создать группу', color: 'primary', actionType: 'create_group' as ActionType },
      { label: 'Добавить детей', color: 'blue', actionType: 'add_children_to_group' as ActionType },
      { label: 'Добавить ребёнка', color: 'indigo', actionType: 'add_child' as ActionType },
      {
        label: 'Перенести занятие',
        color: 'amber',
        actionType: 'update_group_schedule' as ActionType,
      },
      { label: 'Задание', color: 'violet', actionType: 'assign_homework' as ActionType },
      { label: 'Напоминание', color: 'rose', actionType: 'send_reminder' as ActionType },
      { label: 'Показать группы', color: 'green', actionType: 'list_groups' as ActionType },
      { label: 'Дети', color: 'teal', actionType: 'list_children' as ActionType },
    ],
    forms: {
      create_group: {
        title: 'Создать группу',
        fields: [
          {
            key: 'name',
            label: 'Название группы',
            type: 'text' as const,
            placeholder: 'напр. Логопедия А',
            required: true,
          },
          { key: 'days', label: 'Дни недели', type: 'days' as const },
          { key: 'time', label: 'Время', type: 'time' as const, placeholder: '15:00' },
        ],
      },
      add_children_to_group: {
        title: 'Добавить детей в группу',
        fields: [
          {
            key: 'children',
            label: 'Дети (через запятую)',
            type: 'text' as const,
            placeholder: 'Арсен, Дана',
            required: true,
          },
          {
            key: 'group',
            label: 'Название группы',
            type: 'text' as const,
            placeholder: 'Логопедия А',
            required: true,
          },
        ],
      },
      add_child: {
        title: 'Добавить ребёнка в группу',
        fields: [
          {
            key: 'child',
            label: 'Имя ребёнка',
            type: 'text' as const,
            placeholder: 'Алина',
            required: true,
          },
          {
            key: 'group',
            label: 'Название группы',
            type: 'text' as const,
            placeholder: 'Логопедия А',
            required: true,
          },
        ],
      },
      update_group_schedule: {
        title: 'Обновить расписание',
        fields: [
          {
            key: 'group',
            label: 'Название группы',
            type: 'text' as const,
            placeholder: 'Логопедия А',
            required: true,
          },
          { key: 'days', label: 'Новые дни', type: 'days' as const },
          { key: 'time', label: 'Новое время', type: 'time' as const, placeholder: '14:00' },
        ],
      },
      assign_homework: {
        title: 'Назначить задание',
        fields: [
          {
            key: 'child',
            label: 'Имя ребёнка',
            type: 'text' as const,
            placeholder: 'Алина',
            required: true,
          },
          {
            key: 'homework',
            label: 'Название задания',
            type: 'text' as const,
            placeholder: 'Практика цветов',
            required: true,
          },
          {
            key: 'description',
            label: 'Описание (необязательно)',
            type: 'text' as const,
            placeholder: 'Выполни упражнения 1-5',
          },
        ],
      },
      send_reminder: {
        title: 'Отправить напоминание',
        fields: [
          {
            key: 'child',
            label: 'Имя ребёнка',
            type: 'text' as const,
            placeholder: 'Алина',
            required: true,
          },
          {
            key: 'message',
            label: 'Текст напоминания',
            type: 'text' as const,
            placeholder: 'Пожалуйста, выполни ежедневные упражнения',
            required: true,
          },
        ],
      },
    },
  },
  ky: {
    title: 'ИИ Жардамчы',
    open: 'Жардамчыны ачуу',
    howCanHelp: 'Эмне жасайлы?',
    type: 'Буйрук жазыңыз...',
    thinking: 'Аткарылууда...',
    confirm: 'Кабыл алуу',
    cancel: 'Болбойт',
    next: 'Кийинки',
    cancelled: 'Жокко чыгарылды.',
    mute: 'Үндү өчүрүү',
    unmute: 'Үндү күйгүзүү',
    startListen: 'Баштоо',
    stopListen: 'Токтотуу',
    tapToSpeak: 'Сүйлөө үчүн басыңыз',
    listening: 'Угуп жатам...',
    noSupport: 'Үн таануу колдоого алынбайт.',
    recogError: 'Түшүнө алган жок. Кайра аракет кылыңыз.',
    notAuth: 'Кирүү талап кылынат.',
    noGroup: (n: string) => `"${n}" тобу табылган жок.`,
    noChildren: (n: string) => `Балдар табылган жок: ${n}.`,
    noParent: (n: string) => `"${n}" ата-эне аккаунту жок.`,
    successCreate: (n: string) => `"${n}" тобу түзүлдү.`,
    successAdd: (c: string, g: string) => `${c} "${g}" тобуна кошулду.`,
    successUpdate: (g: string) => `"${g}" убактысы жаңыртылды.`,
    successHomework: (c: string) => `Үй тапшырмасы ${c}га берилди.`,
    successReminder: (c: string) => `Эскертүү ${c}га жөнөтүлдү.`,
    successChild: (c: string, g: string) => `${c} "${g}" тобуна кошулду.`,
    children: 'Балдар',
    noChildrenYet: 'Балдар азыр жок.',
    unknownCmd: 'Буйрук таанылган жок. Төмөндөгү баскычтарды колдонуңуз.',
    groups: 'Топтор',
    noGroupsYet: 'Топтор азыр жок.',
    voiceLang: 'Тил: RU',
    help: 'Жардам',
    days: { Mon: 'Дш', Tue: 'Шш', Wed: 'Шр', Thu: 'Бш', Fri: 'Жм', Sat: 'Иш', Sun: 'Жш' },
    paramLabels: {
      name: 'Аты',
      schedule: 'Убакыт',
      group: 'Топ',
      children: 'Балдар',
      child: 'Бала',
      homework: 'Үй тапшырмасы',
      reminder: 'Эскертүү',
      message: 'Билдирүү',
    },
    formTitles: {
      create_group: 'Топ түзүү',
      add_children_to_group: 'Балдарды топко кошуу',
      add_child: 'Баланы топко кошуу',
      update_group_schedule: 'Убактыны жаңыртуу',
      assign_homework: 'Үй тапшырмасын берүү',
      send_reminder: 'Эскертүү жөнөтүү',
    },
    helpContent: [
      { cmd: 'Топ түзүү', example: 'Дш жана Шр саат 15:00дө Логопедия А тобун түзүү' },
      { cmd: 'Бала кошуу', example: 'Арсен жана Дананы Логопедия А тобуна кошуу' },
      { cmd: 'Бала кошуу', example: 'Алинаны Логопедия А тобуна кошуу' },
      { cmd: 'Сабакты жылдыруу', example: 'Сабакты жумага саат 14:00гө жылдыруу' },
      { cmd: 'Үй тапшырма', example: 'Алинага түстөр боюнча үй тапшырмасын бер' },
      { cmd: 'Эскертүү', example: 'Алинага эскертүү жөнөт' },
      { cmd: 'Топторду көрүү', example: 'Бардык топторду көрсөтүү' },
      { cmd: 'Балдарды көрүү', example: 'Бардык балдарды көрсөтүү' },
    ],
    chips: [
      { label: 'Топ түзүү', color: 'primary', actionType: 'create_group' as ActionType },
      { label: 'Бала кошуу', color: 'blue', actionType: 'add_children_to_group' as ActionType },
      { label: 'Бала кошуу', color: 'indigo', actionType: 'add_child' as ActionType },
      {
        label: 'Сабакты жылдыруу',
        color: 'amber',
        actionType: 'update_group_schedule' as ActionType,
      },
      { label: 'Үй тапшырма', color: 'violet', actionType: 'assign_homework' as ActionType },
      { label: 'Эскертүү', color: 'rose', actionType: 'send_reminder' as ActionType },
      { label: 'Топторду көрүү', color: 'green', actionType: 'list_groups' as ActionType },
      { label: 'Балдар', color: 'teal', actionType: 'list_children' as ActionType },
    ],
    forms: {
      create_group: {
        title: 'Топ түзүү',
        fields: [
          {
            key: 'name',
            label: 'Топтун аты',
            type: 'text' as const,
            placeholder: 'мис. Логопедия А',
            required: true,
          },
          { key: 'days', label: 'Күндөр', type: 'days' as const },
          { key: 'time', label: 'Убакыт', type: 'time' as const, placeholder: '15:00' },
        ],
      },
      add_children_to_group: {
        title: 'Балдарды топко кошуу',
        fields: [
          {
            key: 'children',
            label: 'Балдардын аттары',
            type: 'text' as const,
            placeholder: 'Арсен, Дана',
            required: true,
          },
          {
            key: 'group',
            label: 'Топтун аты',
            type: 'text' as const,
            placeholder: 'Логопедия А',
            required: true,
          },
        ],
      },
      add_child: {
        title: 'Баланы топко кошуу',
        fields: [
          {
            key: 'child',
            label: 'Баланын аты',
            type: 'text' as const,
            placeholder: 'Алина',
            required: true,
          },
          {
            key: 'group',
            label: 'Топтун аты',
            type: 'text' as const,
            placeholder: 'Логопедия А',
            required: true,
          },
        ],
      },
      update_group_schedule: {
        title: 'Убактыны жаңыртуу',
        fields: [
          {
            key: 'group',
            label: 'Топтун аты',
            type: 'text' as const,
            placeholder: 'Логопедия А',
            required: true,
          },
          { key: 'days', label: 'Жаңы күндөр', type: 'days' as const },
          { key: 'time', label: 'Жаңы убакыт', type: 'time' as const, placeholder: '14:00' },
        ],
      },
      assign_homework: {
        title: 'Үй тапшырмасын берүү',
        fields: [
          {
            key: 'child',
            label: 'Баланын аты',
            type: 'text' as const,
            placeholder: 'Алина',
            required: true,
          },
          {
            key: 'homework',
            label: 'Тапшырманын аты',
            type: 'text' as const,
            placeholder: 'Түстөрдү практика кыл',
            required: true,
          },
          {
            key: 'description',
            label: 'Сүрөттөмө (керек болсо)',
            type: 'text' as const,
            placeholder: '1-5 көнүгүүлөрдү аткар',
          },
        ],
      },
      send_reminder: {
        title: 'Эскертүү жөнөтүү',
        fields: [
          {
            key: 'child',
            label: 'Баланын аты',
            type: 'text' as const,
            placeholder: 'Алина',
            required: true,
          },
          {
            key: 'message',
            label: 'Билдирүү',
            type: 'text' as const,
            placeholder: 'Күнүмдүк көнүгүүлөрдү аткар',
            required: true,
          },
        ],
      },
    },
  },
}

const CHIP_ICONS: Record<string, React.ReactNode> = {
  primary: <FolderPlus className="h-3.5 w-3.5" />,
  blue: <UserPlus className="h-3.5 w-3.5" />,
  indigo: <UserPlus className="h-3.5 w-3.5" />,
  amber: <CalendarClock className="h-3.5 w-3.5" />,
  violet: <ListChecks className="h-3.5 w-3.5" />,
  rose: <MessageCircle className="h-3.5 w-3.5" />,
  green: <ListChecks className="h-3.5 w-3.5" />,
  teal: <User className="h-3.5 w-3.5" />,
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

// ─── NLP helpers ──────────────────────────────────────────────────────────────

const DAY_MAP: Record<string, string> = {
  monday: 'Mon',
  mon: 'Mon',
  tuesday: 'Tue',
  tue: 'Tue',
  wednesday: 'Wed',
  wed: 'Wed',
  thursday: 'Thu',
  thu: 'Thu',
  friday: 'Fri',
  fri: 'Fri',
  saturday: 'Sat',
  sat: 'Sat',
  sunday: 'Sun',
  sun: 'Sun',
  понедельник: 'Пн',
  пн: 'Пн',
  'по понедельникам': 'Пн',
  понедельникам: 'Пн',
  вторник: 'Вт',
  вт: 'Вт',
  вторникам: 'Вт',
  среда: 'Ср',
  ср: 'Ср',
  средам: 'Ср',
  среду: 'Ср',
  четверг: 'Чт',
  чт: 'Чт',
  четвергам: 'Чт',
  пятница: 'Пт',
  пт: 'Пт',
  пятницам: 'Пт',
  пятницу: 'Пт',
  суббота: 'Сб',
  сб: 'Сб',
  субботам: 'Сб',
  субботу: 'Сб',
  воскресенье: 'Вс',
  вс: 'Вс',
  воскресеньям: 'Вс',
  дүйшөмбү: 'Дш',
  дш: 'Дш',
  шейшемби: 'Шш',
  шш: 'Шш',
  шаршемби: 'Шр',
  шр: 'Шр',
  бейшемби: 'Бш',
  бш: 'Бш',
  жума: 'Жм',
  жм: 'Жм',
  ишемби: 'Иш',
  иш: 'Иш',
  жекшемби: 'Жш',
  жш: 'Жш',
}

function extractSchedule(text: string): string {
  const lower = text.toLowerCase()
  const found: string[] = []
  for (const key of Object.keys(DAY_MAP).sort((a, b) => b.length - a.length)) {
    if (lower.includes(key) && !found.includes(DAY_MAP[key])) found.push(DAY_MAP[key])
  }
  const tm =
    text.match(/\b(\d{1,2}:\d{2})\b/) ||
    text.match(/\b(\d{1,2})\s*(?:pm|am)\b/i) ||
    text.match(/(?:в|at|саат)\s+(\d{1,2}(?::\d{2})?)/i)
  const time = tm ? (tm[1].includes(':') ? tm[1] : `${tm[1]}:00`) : ''
  if (!found.length && !time) return ''
  if (found.length && time) return `${found.join(', ')} ${time}`
  return found.join(', ') || time
}

function extractGroupName(text: string): string {
  for (const p of [
    /(?:called|named)\s+(.+?)(?:\s+on\s|\s+at\s|\s+по\s|\s+в\s|$)/i,
    /(?:группу|группа|топ)\s+(.+?)(?:\s+по\s|\s+в\s|\s+на\s|\s+at\s|$)/i,
    /group\s+(.+?)(?:\s+on\s|\s+at\s|$)/i,
  ]) {
    const m = text.match(p)
    if (m?.[1]) return m[1].trim()
  }
  return ''
}

function extractChildNames(text: string): string[] {
  const m = text.match(
    /(?:add|добавь|добавить|запиши|кош)\s+(.+?)\s+(?:to(?:\s+(?:the|this|group|группу))|в\s+(?:группу|эту)|топко)/i
  )
  if (!m) return []
  return m[1]
    .split(/\s+(?:and|и|менен|да|жана)\s+|,\s*/)
    .map((n) => n.trim())
    .filter(Boolean)
}

function extractTargetGroup(text: string): string {
  const m = text.match(
    /(?:to\s+(?:group|the\s+group)\s+|в\s+группу\s+|в\s+топ\s+|топко\s+)(.+?)(?:\s*$)/i
  )
  return m?.[1]?.trim() || ''
}

function parseIntent(text: string): ParsedAction {
  const lower = text.toLowerCase().trim()

  const isCreate =
    /\b(?:create|make|new|add|start)\s+(?:a\s+)?group\b/i.test(lower) ||
    /(?:создай|создать|создайте|новая|добавь)\s+группу/i.test(lower) ||
    /топ\s+(?:түзүү|жасоо|кош)/i.test(lower)
  if (isCreate)
    return {
      type: 'create_group',
      params: { name: extractGroupName(text) || 'New Group', schedule: extractSchedule(text) },
      raw: text,
    }

  const isAddSingle =
    /\b(?:add|put)\s+(?:child|kid)\b/i.test(lower) ||
    /(?:добавь|добавить)\s+(?:ребёнка|ребенка|ребенок)\b/i.test(lower) ||
    /баланы\s+топко/i.test(lower)
  if (isAddSingle) {
    const childMatch = text.match(/(?:add|добавь|добавить)\s+(?:child\s+)?(\w+)/i)
    return {
      type: 'add_child',
      params: {
        childNames: childMatch ? [childMatch[1]] : [],
        groupName: extractTargetGroup(text),
      },
      raw: text,
    }
  }

  const isAdd =
    /\b(?:add|put)\b.+\b(?:to|into)\b/i.test(lower) ||
    /(?:добавь|добавить|запиши|поставь)\b.+\bв\s+(?:группу|эту)/i.test(lower) ||
    /\bкош\b.+\bтопко/i.test(lower)
  if (isAdd) {
    const childNames = extractChildNames(text)
    if (childNames.length)
      return {
        type: 'add_children_to_group',
        params: { childNames, groupName: extractTargetGroup(text) },
        raw: text,
      }
  }

  const isUpdate =
    /\b(?:move|reschedule|change)\b.+\b(?:to|on)\b/i.test(lower) ||
    /(?:перенеси|перенести|перемести|измени\s+расписание)/i.test(lower) ||
    /(?:жылдыр|өзгөрт)\b/i.test(lower)
  if (isUpdate)
    return {
      type: 'update_group_schedule',
      params: { groupName: extractTargetGroup(text), newSchedule: extractSchedule(text) },
      raw: text,
    }

  const isHomework =
    /\b(?:assign|give|create)\s+(?:homework|task|assignment)\b/i.test(lower) ||
    /(?:назначь|назначить|выдай|выдать)\s+(?:задание|дз|homework)/i.test(lower) ||
    /Үй\s+тапшырма/i.test(lower)
  if (isHomework) {
    const childMatch = text.match(/(?:to|for|для|для\s+(\w+))/i)
    const taskMatch = text.match(
      /(?:homework|task|assignment|задание|тапшырма)\s+(?:on\s+)?(?:about\s+)?(.+?)(?:\s+to|\s+for|$)/i
    )
    return {
      type: 'assign_homework',
      params: {
        childNames: childMatch ? [childMatch[1]] : [],
        homeworkTitle: taskMatch ? taskMatch[1] : '',
      },
      raw: text,
    }
  }

  const isReminder =
    /\b(?:send|create)\s+reminder\b/i.test(lower) ||
    /(?:отправь|отправить|пошли)\s+(?:напоминание|сообщение)\b/i.test(lower) ||
    /Эскертүү/i.test(lower)
  if (isReminder) {
    return {
      type: 'send_reminder',
      params: {
        childNames: [],
        message: text
          .replace(/^(?:send|create)\s+reminder\b/gi, '')
          .replace(/^(?:отправь|отправить|пошли)\s+(?:напоминание|сообщение)\b/gi, '')
          .trim(),
      },
      raw: text,
    }
  }

  const isListGroups =
    /\b(?:list|show|get)\s+(?:all\s+)?groups\b/i.test(lower) ||
    /(?:покажи|список|показать)\s+(?:все\s+)?групп/i.test(lower) ||
    /(?:бардык\s+)?топторду\s+(?:көрсөт|тизме)/i.test(lower)
  if (isListGroups) return { type: 'list_groups', params: {}, raw: text }

  const isListChildren =
    /\b(?:list|show|get)\s+(?:all\s+)?children\b/i.test(lower) ||
    /(?:покажи|список|показать)\s+(?:все\s+)?детей/i.test(lower) ||
    /(?:бардык\s+)?балдарды\s+(?:көрсөт|тизме)/i.test(lower)
  if (isListChildren) return { type: 'list_children', params: {}, raw: text }

  return { type: 'unknown', params: {}, raw: text }
}

function getLocale(): Locale {
  if (typeof window === 'undefined') return 'en'
  const p = window.location.pathname
  if (p.startsWith('/ru')) return 'ru'
  if (p.startsWith('/ky')) return 'ky'
  return 'en'
}

function actionIcon(type: ActionType) {
  const cls = 'h-4 w-4'
  switch (type) {
    case 'create_group':
      return <FolderPlus className={`${cls} text-primary-600`} />
    case 'add_children_to_group':
    case 'add_child':
      return <UserPlus className={`${cls} text-blue-600`} />
    case 'update_group_schedule':
      return <CalendarClock className={`${cls} text-amber-600`} />
    case 'assign_homework':
      return <ListChecks className={`${cls} text-violet-600`} />
    case 'send_reminder':
      return <MessageCircle className={`${cls} text-rose-600`} />
    case 'list_groups':
      return <ListChecks className={`${cls} text-green-600`} />
    case 'list_children':
      return <User className={`${cls} text-teal-600`} />
    default:
      return null
  }
}

function getConfirmParams(
  action: ParsedAction,
  t: (typeof T)[Locale]
): Array<{ label: string; value: string }> {
  const pl = t.paramLabels
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

function buildActionFromForm(
  actionType: Exclude<ActionType, 'unknown'>,
  values: Record<string, string>,
  selectedDays: string[],
  t: (typeof T)[Locale]
): ParsedAction {
  const dayLabels = selectedDays.map((d) => t.days[d as keyof typeof t.days]).filter(Boolean)
  const time = values.time?.trim() || ''
  const schedule =
    dayLabels.length && time
      ? `${dayLabels.join(', ')} ${time}`
      : dayLabels.length
        ? dayLabels.join(', ')
        : time
  return {
    type: actionType,
    raw: '',
    params: {
      name: values.name?.trim(),
      schedule: actionType === 'create_group' ? schedule : undefined,
      groupName: values.group?.trim(),
      childNames: values.children
        ? values.children
            .split(/[,،、]+/)
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined,
      newSchedule: actionType === 'update_group_schedule' ? schedule : undefined,
    },
  }
}

// ─── FormMessage ──────────────────────────────────────────────────────────────

function FormMessage({
  form,
  t,
  onSubmit,
  onCancel,
}: {
  form: MessageForm
  t: (typeof T)[Locale]
  onSubmit: (action: ParsedAction) => void
  onCancel: () => void
}) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [selectedDays, setSelectedDays] = useState<string[]>([])

  const toggleDay = (d: string) =>
    setSelectedDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]))

  const isValid = form.fields
    .filter((f) => f.required)
    .every((f) => (f.type === 'days' ? selectedDays.length > 0 : !!values[f.key]?.trim()))

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4 space-y-3">
      <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
        {actionIcon(form.actionType)}
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
          onClick={() => onSubmit(buildActionFromForm(form.actionType, values, selectedDays, t))}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-40 transition-colors"
        >
          <ArrowRight className="h-3.5 w-3.5" /> {t.next}
        </button>
      </div>
    </div>
  )
}

// ─── ConfirmCard ──────────────────────────────────────────────────────────────

function ConfirmCard({
  action,
  t,
  onConfirm,
  onCancel,
}: {
  action: ParsedAction
  t: (typeof T)[Locale]
  onConfirm: () => void
  onCancel: () => void
}) {
  const params = getConfirmParams(action, t)
  const title =
    action.type !== 'unknown' && action.type !== 'list_groups'
      ? t.formTitles[action.type as keyof typeof t.formTitles]
      : ''

  return (
    <div className="rounded-xl border border-primary-200 bg-primary-50 p-3">
      <div className="flex items-center gap-1.5 mb-3">
        {actionIcon(action.type)}
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

// ─── Main component ───────────────────────────────────────────────────────────

interface VoiceAIProps {
  orgId: string
  onCommandExecuted?: () => void
}

export default function VoiceAI({ orgId, onCommandExecuted }: VoiceAIProps) {
  const [locale, setLocale] = useState<Locale>(getLocale)
  const t = T[locale]
  const normalizeI18nLeak = useCallback(
    (value: string) => {
      const text = value.trim()
      if (
        text.includes('b2b.voiceAssistant.unknownCommand') ||
        text.includes('voiceAssistant.unknownCommand')
      ) {
        return t.unknownCmd
      }
      if (
        text.includes('b2b.voiceAssistant.confirmCreateGroup') ||
        text.includes('voiceAssistant.confirmCreateGroup')
      ) {
        return t.formTitles.create_group
      }
      return value
    },
    [t]
  )

  const [isOpen, setIsOpen] = useState(false)
  const [mode, setMode] = useState<'chat' | 'voice'>('chat')
  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const [transcript, setTranscript] = useState('')
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const [speakingEnabled, setSpeakingEnabled] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  const contextGroupRef = useRef<{ id: string; name: string } | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const synthRef = useRef<SpeechSynthesis | null>(null)
  const handleInputRef = useRef<(text: string) => Promise<void>>(async () => {})

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const p = window.location.pathname
    if (p.startsWith('/ru')) setLocale('ru')
    else if (p.startsWith('/ky')) setLocale('ky')
    else setLocale('en')
  }, [])

  useEffect(() => {
    const SR =
      (window as unknown as { SpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: typeof SpeechRecognition })
        .webkitSpeechRecognition
    if (!SR) return
    recognitionRef.current = new SR()
    recognitionRef.current.continuous = false
    recognitionRef.current.interimResults = true
    // ky-KG is unsupported in Chrome — fall back to ru-RU
    recognitionRef.current.lang = locale === 'ru' || locale === 'ky' ? 'ru-RU' : 'en-US'
    recognitionRef.current.onresult = (ev: SpeechRecognitionEvent) => {
      const last = ev.results[ev.results.length - 1]
      setTranscript(last[0].transcript)
      if (last.isFinal) handleInputRef.current(last[0].transcript)
    }
    recognitionRef.current.onerror = (ev: SpeechRecognitionErrorEvent) => {
      if (ev.error !== 'no-speech') {
        setVoiceState('error')
        setVoiceError(T[locale].recogError)
      }
    }
    recognitionRef.current.onend = () => setVoiceState('idle')
    synthRef.current = window.speechSynthesis
  }, [locale])

  const speak = useCallback(
    (text: string) => {
      if (!speakingEnabled || !synthRef.current) return
      synthRef.current.cancel()
      const u = new SpeechSynthesisUtterance(text)
      u.lang = locale === 'ru' || locale === 'ky' ? 'ru-RU' : 'en-US'
      u.rate = 0.9
      synthRef.current.speak(u)
    },
    [speakingEnabled, locale]
  )

  const addMessage = useCallback(
    (msg: Omit<Message, 'id' | 'timestamp'>) => {
      const full: Message = {
        ...msg,
        content: normalizeI18nLeak(msg.content),
        id: `${Date.now()}${Math.random()}`,
        timestamp: new Date(),
      }
      setMessages((p) => [...p, full])
      return full.id
    },
    [normalizeI18nLeak]
  )

  const updateMessage = useCallback(
    (id: string, patch: Partial<Message>) => {
      setMessages((p) =>
        p.map((m) => {
          if (m.id !== id) return m
          const next = { ...m, ...patch }
          if (typeof patch.content === 'string') {
            next.content = normalizeI18nLeak(patch.content)
          }
          return next
        })
      )
    },
    [normalizeI18nLeak]
  )

  // ── Execution ──────────────────────────────────────────────────────────────

  const executeAction = useCallback(
    async (action: ParsedAction, msgId: string) => {
      updateMessage(msgId, { status: 'executing', pending: undefined, form: undefined })
      try {
        const token = await getIdToken()
        if (!token) throw new Error(t.notAuth)
        apiClient.setToken(token)

        if (action.type === 'create_group') {
          const name = action.params.name || 'New Group'
          const res = await apiClient.createGroup(orgId, name, action.params.schedule || undefined)
          const gid = res.group?.id as string | undefined
          if (gid) contextGroupRef.current = { id: gid, name }
          const msg = t.successCreate(name)
          updateMessage(msgId, { content: msg, status: 'done' })
          speak(msg)
          onCommandExecuted?.()
        } else if (action.type === 'add_children_to_group') {
          const childNames = action.params.childNames || []
          const tgt = action.params.groupName
          let gid: string | null = null
          let gName = ''
          if (!tgt && contextGroupRef.current) {
            gid = contextGroupRef.current.id
            gName = contextGroupRef.current.name
          } else if (tgt) {
            const { groups } = await apiClient.getGroups(orgId)
            const found = (groups as Array<{ id: string; name: string }>).find((g) =>
              g.name.toLowerCase().includes(tgt.toLowerCase())
            )
            if (!found) throw new Error(t.noGroup(tgt))
            gid = found.id
            gName = found.name
            contextGroupRef.current = { id: gid, name: gName }
          }
          if (!gid) throw new Error(t.noGroup('?'))
          const all = await apiClient.getChildren(orgId)
          const matched = all.filter((c) =>
            childNames.some((n) => c.name.toLowerCase().includes(n.toLowerCase()))
          )
          const notFound = childNames.filter(
            (n) => !all.some((c) => c.name.toLowerCase().includes(n.toLowerCase()))
          )
          if (notFound.length) throw new Error(t.noChildren(notFound.join(', ')))
          if (!matched.length) throw new Error(t.noChildren(childNames.join(', ')))
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
          for (const [uid, ids] of byParent) await apiClient.addParentToGroup(orgId, gid, uid, ids)
          let msg = added.length ? t.successAdd(added.join(', '), gName) : ''
          if (noParent.length) msg += '\n' + t.noParent(noParent.join(', '))
          updateMessage(msgId, { content: msg.trim(), status: 'done' })
          speak(msg)
          onCommandExecuted?.()
        } else if (action.type === 'update_group_schedule') {
          const tgt = action.params.groupName
          let gid: string | null = null
          let gName = ''
          if (!tgt && contextGroupRef.current) {
            gid = contextGroupRef.current.id
            gName = contextGroupRef.current.name
          } else if (tgt) {
            const { groups } = await apiClient.getGroups(orgId)
            const found = (groups as Array<{ id: string; name: string }>).find((g) =>
              g.name.toLowerCase().includes(tgt.toLowerCase())
            )
            if (!found) throw new Error(t.noGroup(tgt))
            gid = found.id
            gName = found.name
            contextGroupRef.current = { id: gid, name: gName }
          }
          if (!gid) throw new Error(t.noGroup('?'))
          await apiClient.updateGroup(orgId, gid, { description: action.params.newSchedule || '' })
          const msg = t.successUpdate(gName)
          updateMessage(msgId, { content: msg, status: 'done' })
          speak(msg)
          onCommandExecuted?.()
        } else if (action.type === 'list_groups') {
          const { groups } = await apiClient.getGroups(orgId)
          const list = groups as Array<{ id: string; name: string; description?: string }>
          const content = list.length
            ? `${t.groups} (${list.length}):\n` +
              list.map((g) => `• ${g.name}${g.description ? ` — ${g.description}` : ''}`).join('\n')
            : t.noGroupsYet
          updateMessage(msgId, { content, status: 'done' })
        } else if (action.type === 'list_children') {
          const all = await apiClient.getChildren(orgId)
          const content = all.length
            ? `${t.children} (${all.length}):\n` +
              all
                .map((c) => `• ${c.name}${c.age !== undefined ? ` (${c.age} y.o.)` : ''}`)
                .join('\n')
            : t.noChildrenYet
          updateMessage(msgId, { content, status: 'done' })
        } else if (action.type === 'add_child') {
          const childNames = action.params.childNames || []
          const tgt = action.params.groupName
          if (!childNames.length) throw new Error(t.noChildren('?'))
          if (!tgt) throw new Error(t.noGroup('?'))
          const { groups } = await apiClient.getGroups(orgId)
          const found = (groups as Array<{ id: string; name: string }>).find((g) =>
            g.name.toLowerCase().includes(tgt.toLowerCase())
          )
          if (!found) throw new Error(t.noGroup(tgt))
          const gid = found.id
          const gName = found.name
          const all = await apiClient.getChildren(orgId)
          const matched = all.filter((c) =>
            childNames.some((n) => c.name.toLowerCase().includes(n.toLowerCase()))
          )
          if (!matched.length) throw new Error(t.noChildren(childNames.join(', ')))
          const child = matched[0]
          const d = await apiClient.getChildDetail(orgId, child.id)
          const uid = d.parentInfo?.uid
          if (!uid) throw new Error(t.noParent(child.name))
          await apiClient.addParentToGroup(orgId, gid, uid, [child.id])
          const msg = t.successChild(child.name, gName)
          updateMessage(msgId, { content: msg, status: 'done' })
          speak(msg)
          onCommandExecuted?.()
        } else if (action.type === 'assign_homework') {
          const childNames = action.params.childNames || []
          if (!childNames.length) throw new Error(t.noChildren('?'))
          const all = await apiClient.getChildren(orgId)
          const matched = all.filter((c) =>
            childNames.some((n) => c.name.toLowerCase().includes(n.toLowerCase()))
          )
          if (!matched.length) throw new Error(t.noChildren(childNames.join(', ')))
          const child = matched[0]
          const title = action.params.homeworkTitle || 'Homework'
          const description = action.params.homeworkDescription
          await apiClient.createChildTask(orgId, child.id, { title, description })
          const msg = t.successHomework(child.name)
          updateMessage(msgId, { content: msg, status: 'done' })
          speak(msg)
          onCommandExecuted?.()
        } else if (action.type === 'send_reminder') {
          const childNames = action.params.childNames || []
          if (!childNames.length) throw new Error(t.noChildren('?'))
          const all = await apiClient.getChildren(orgId)
          const matched = all.filter((c) =>
            childNames.some((n) => c.name.toLowerCase().includes(n.toLowerCase()))
          )
          if (!matched.length) throw new Error(t.noChildren(childNames.join(', ')))
          const child = matched[0]
          const message = action.params.message || 'Please complete your exercises'
          const d = await apiClient.getChildDetail(orgId, child.id)
          if (!d.parentInfo?.uid) throw new Error(t.noParent(child.name))
          const msg = t.successReminder(child.name)
          updateMessage(msgId, { content: `${msg}\n\n"${message}"`, status: 'done' })
          speak(msg)
          onCommandExecuted?.()
        }
      } catch (err) {
        const msg = normalizeI18nLeak(err instanceof Error ? err.message : 'Error')
        updateMessage(msgId, { content: msg, status: 'done' })
        speak(msg)
      }
    },
    [orgId, t, speak, onCommandExecuted, updateMessage, normalizeI18nLeak]
  )

  // ── Input ──────────────────────────────────────────────────────────────────

  const handleInput = useCallback(
    async (text: string) => {
      if (!text.trim() || isProcessing) return
      addMessage({ role: 'user', content: text })
      setInputText('')
      setIsProcessing(true)
      const action = parseIntent(text)
      if (action.type === 'unknown') {
        addMessage({ role: 'assistant', content: t.unknownCmd, status: 'done' })
      } else if (action.type === 'list_groups') {
        const mid = addMessage({ role: 'assistant', content: '', status: 'executing' })
        await executeAction(action, mid)
      } else {
        addMessage({ role: 'assistant', content: '', pending: { action }, status: 'confirming' })
      }
      setIsProcessing(false)
    },
    [isProcessing, t, addMessage, executeAction]
  )

  useEffect(() => {
    handleInputRef.current = handleInput
  }, [handleInput])

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
    async (msgId: string, action: ParsedAction) => executeAction(action, msgId),
    [executeAction]
  )

  const handleCancel = useCallback(
    (msgId: string) =>
      updateMessage(msgId, {
        content: t.cancelled,
        status: 'cancelled',
        pending: undefined,
        form: undefined,
      }),
    [t, updateMessage]
  )

  // ── Chip → structured form or direct execution ─────────────────────────────

  const handleChipAction = useCallback(
    (actionType: ActionType) => {
      if (actionType === 'list_groups') {
        const mid = addMessage({ role: 'assistant', content: '', status: 'executing' })
        executeAction({ type: 'list_groups', params: {}, raw: '' }, mid)
        return
      }
      const formConfig = t.forms[actionType as keyof typeof t.forms]
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

  // ── Voice ──────────────────────────────────────────────────────────────────

  const startListening = () => {
    if (!recognitionRef.current) {
      setVoiceError(t.noSupport)
      return
    }
    setVoiceError(null)
    setTranscript('')
    setVoiceState('listening')
    try {
      recognitionRef.current.start()
    } catch {
      setVoiceState('error')
      setVoiceError(t.recogError)
    }
  }
  const stopListening = () => {
    recognitionRef.current?.stop()
    setVoiceState('idle')
  }

  // ── Chip row ───────────────────────────────────────────────────────────────

  function ChipRow({ onChip }: { onChip: (type: ActionType) => void }) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {t.chips.map((chip, i) => (
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

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary-600 shadow-lg hover:bg-primary-700 transition-all hover:scale-105"
        aria-label={t.open}
      >
        <MessageCircle className="h-6 w-6 text-white" />
      </button>

      {isOpen && (
        <div
          className="fixed bottom-24 right-6 z-50 w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl border border-gray-100 flex flex-col"
          style={{ height: '580px' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-3 shrink-0">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100">
                <Bot className="h-4 w-4 text-primary-600" />
              </div>
              <span className="font-semibold text-gray-900">{t.title}</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowHelp(!showHelp)}
                className={`rounded-lg p-1.5 transition-colors ${showHelp ? 'bg-primary-100 text-primary-600' : 'text-gray-400 hover:bg-gray-200 hover:text-gray-600'}`}
                title={t.help}
              >
                <HelpCircle className="h-4 w-4" />
              </button>
              <button
                onClick={() => setMode(mode === 'voice' ? 'chat' : 'voice')}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors"
              >
                {mode === 'voice' ? <Keyboard className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
              <button
                onClick={() => setSpeakingEnabled(!speakingEnabled)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors"
              >
                {speakingEnabled ? (
                  <Volume2 className="h-4 w-4" />
                ) : (
                  <VolumeX className="h-4 w-4" />
                )}
              </button>
              <button
                onClick={() => {
                  setIsOpen(false)
                  setMessages([])
                  setShowHelp(false)
                }}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Help panel */}
          {showHelp && (
            <div className="border-b border-gray-100 bg-amber-50 px-4 py-3 shrink-0">
              <p className="text-xs font-semibold text-amber-800 mb-2">{t.help}</p>
              <div className="space-y-1.5">
                {t.helpContent.map((item, i) => (
                  <div key={i}>
                    <span className="text-xs font-medium text-gray-700">{item.cmd}: </span>
                    <span className="text-xs text-gray-500 italic">
                      &ldquo;{item.example}&rdquo;
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {mode === 'chat' ? (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-gray-700 text-center pt-2">
                      {t.howCanHelp}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {t.chips.map((chip, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handleChipAction(chip.actionType)}
                          className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors ${CHIP_STYLES[chip.color]}`}
                        >
                          <div className="flex items-center gap-1.5">
                            {CHIP_ICONS[chip.color]}
                            <span className="text-xs font-semibold">{chip.label}</span>
                          </div>
                          <span className="text-xs opacity-60 leading-snug line-clamp-2">
                            {t.helpContent[i]?.example}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`flex items-start gap-2 max-w-[90%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                      >
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${msg.role === 'user' ? 'bg-primary-100' : 'bg-gray-100'}`}
                        >
                          {msg.role === 'user' ? (
                            <User className="h-3 w-3 text-primary-600" />
                          ) : (
                            <Bot className="h-3 w-3 text-gray-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          {msg.status === 'form' && msg.form ? (
                            <FormMessage
                              form={msg.form}
                              t={t}
                              onSubmit={(action) => handleFormSubmit(msg.id, action)}
                              onCancel={() => handleCancel(msg.id)}
                            />
                          ) : msg.status === 'confirming' && msg.pending ? (
                            <ConfirmCard
                              action={msg.pending.action}
                              t={t}
                              onConfirm={() => handleConfirm(msg.id, msg.pending!.action)}
                              onCancel={() => handleCancel(msg.id)}
                            />
                          ) : msg.status === 'executing' ? (
                            <div className="flex items-center gap-2 bg-gray-100 px-3 py-2 rounded-lg">
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-500" />
                              <span className="text-sm text-gray-500">{t.thinking}</span>
                            </div>
                          ) : (
                            <div
                              className={`px-3 py-2 rounded-xl text-sm whitespace-pre-line break-words ${
                                msg.role === 'user'
                                  ? 'bg-primary-600 text-white'
                                  : msg.status === 'done' &&
                                      normalizeI18nLeak(msg.content) !== t.cancelled
                                    ? 'bg-green-50 text-green-800 border border-green-200'
                                    : msg.status === 'cancelled'
                                      ? 'bg-gray-100 text-gray-400 italic'
                                      : 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {normalizeI18nLeak(msg.content)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                {isProcessing && (
                  <div className="flex justify-start">
                    <div className="flex items-center gap-2 bg-gray-100 px-3 py-2 rounded-lg ml-8">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-500" />
                      <span className="text-sm text-gray-500">{t.thinking}</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input area */}
              <div className="border-t border-gray-100 p-3 space-y-2 shrink-0 bg-gray-50">
                <ChipRow onChip={handleChipAction} />
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    handleInput(inputText)
                  }}
                  className="flex gap-2"
                >
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={t.type}
                    disabled={isProcessing}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!inputText.trim() || isProcessing}
                    className="px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </form>
              </div>
            </>
          ) : (
            /* Voice mode */
            <div className="flex flex-col flex-1 items-center justify-center p-6 gap-4">
              <div className="flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500">
                <Mic className="h-3 w-3" />
                {t.voiceLang}
              </div>
              <div
                className={`flex h-20 w-20 items-center justify-center rounded-full transition-all ${
                  voiceState === 'listening'
                    ? 'animate-pulse bg-red-100 ring-4 ring-red-200'
                    : voiceState === 'error'
                      ? 'bg-red-100'
                      : 'bg-gray-100'
                }`}
              >
                {voiceState === 'listening' ? (
                  <Mic className="h-10 w-10 text-red-600" />
                ) : voiceState === 'error' ? (
                  <MicOff className="h-10 w-10 text-red-600" />
                ) : (
                  <Mic className="h-10 w-10 text-gray-400" />
                )}
              </div>
              {transcript && (
                <p className="text-sm text-center text-gray-700 bg-gray-50 rounded-lg px-3 py-2 max-w-full">
                  &ldquo;{transcript}&rdquo;
                </p>
              )}
              {voiceError && (
                <p className="text-sm text-center text-red-600 bg-red-50 rounded-lg px-3 py-2">
                  {normalizeI18nLeak(voiceError)}
                </p>
              )}
              <p className="text-sm text-gray-500">
                {voiceState === 'listening' ? t.listening : t.tapToSpeak}
              </p>
              <button
                onClick={voiceState === 'listening' ? stopListening : startListening}
                className={`flex items-center gap-2 rounded-full px-6 py-3 font-medium transition-all ${
                  voiceState === 'listening'
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-primary-600 text-white hover:bg-primary-700'
                }`}
              >
                {voiceState === 'listening' ? (
                  <>
                    <MicOff className="h-5 w-5" />
                    {t.stopListen}
                  </>
                ) : (
                  <>
                    <Mic className="h-5 w-5" />
                    {t.startListen}
                  </>
                )}
              </button>
              {/* Same chips in voice mode — tap to switch to chat + open form */}
              <ChipRow
                onChip={(type) => {
                  setMode('chat')
                  handleChipAction(type)
                }}
              />
            </div>
          )}
        </div>
      )}
    </>
  )
}
