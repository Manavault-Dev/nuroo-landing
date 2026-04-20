import { ParsedAction } from './types'

const DAY_MAP: Record<string, string> = {
  monday: 'Mon',
  mondays: 'Mon',
  mon: 'Mon',
  tuesday: 'Tue',
  tuesdays: 'Tue',
  tue: 'Tue',
  wednesday: 'Wed',
  wednesdays: 'Wed',
  wed: 'Wed',
  thursday: 'Thu',
  thursdays: 'Thu',
  thu: 'Thu',
  friday: 'Fri',
  fridays: 'Fri',
  fri: 'Fri',
  saturday: 'Sat',
  saturdays: 'Sat',
  sat: 'Sat',
  sunday: 'Sun',
  sundays: 'Sun',
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

export function extractSchedule(text: string): string {
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

export function extractGroupName(text: string): string {
  for (const p of [
    /(?:called|named)\s+(.+?)(?:\s+on\b|\s+at\b|\s+по\b|\s+в\b|$)/i,
    /(?:группу|группа|топ)\s+(.+?)(?:\s+по\b|\s+в\b|\s+на\b|\s+at\b|$)/i,
    /(?:create|make|new|add|start)\s+(?:a\s+)?group\s+(.+?)(?:\s+on\b|\s+at\b|$)/i,
    /(?:создай|создать|создайте|новая|добавь)\s+группу?\s+(.+?)(?:\s+по\b|\s+в\b|$)/i,
  ]) {
    const m = text.match(p)
    if (m?.[1]) return m[1].trim()
  }
  return ''
}

export function extractChildNames(text: string): string[] {
  // Match "add/put [names] to/into [group]"
  const m = text.match(
    /(?:add|put|добавь|добавить|запиши|кош)\s+(.+?)\s+(?:to\b|into\b|в\b|топко)/i
  )
  if (!m) return []
  return m[1]
    .split(/\s+(?:and|и|менен|да|жана)\s+|,\s*/)
    .map((n) => n.trim())
    .filter(Boolean)
}

export function extractTargetGroup(text: string): string {
  // "to/into group X" — explicit keyword
  let m = text.match(/\b(?:to|into)\s+(?:the\s+)?group\s+(.+?)$/i)
  if (m?.[1]) return m[1].trim()

  // "add X to Y" — general: everything after "to"
  m = text.match(/\b(?:add|put)\b.+?\b(?:to|into)\s+(.+?)$/i)
  if (m?.[1]) return m[1].trim()

  // Russian
  m = text.match(/в\s+(?:группу\s+)?(.+?)$/i)
  if (m?.[1]) return m[1].trim()

  m = text.match(/топко\s+(.+?)$/i)
  if (m?.[1]) return m[1].trim()

  return ''
}

export function parseIntent(text: string): ParsedAction {
  const lower = text.toLowerCase().trim()

  // Create group
  if (
    /\b(?:create|make|new|add|start)\s+(?:a\s+)?group\b/i.test(lower) ||
    /(?:создай|создать|создайте|новая|добавь)\s+группу/i.test(lower) ||
    /топ\s+(?:түзүү|жасоо|кош)/i.test(lower)
  ) {
    return {
      type: 'create_group',
      params: {
        name: extractGroupName(text) || '',
        schedule: extractSchedule(text),
      },
      raw: text,
    }
  }

  // Add children (multiple or single) to group
  if (
    /\b(?:add|put)\b.+\b(?:to|into)\b/i.test(lower) ||
    /(?:добавь|добавить|запиши|поставь)\b.+\bв\s+(?:группу|эту)/i.test(lower) ||
    /\bкош\b.+\bтопко/i.test(lower)
  ) {
    const childNames = extractChildNames(text)
    if (childNames.length) {
      return {
        type: childNames.length === 1 ? 'add_child' : 'add_children_to_group',
        params: { childNames, groupName: extractTargetGroup(text) },
        raw: text,
      }
    }
  }

  // Reschedule
  if (
    /\b(?:move|reschedule|change)\b.*\b(?:to|on)\b/i.test(lower) ||
    /(?:перенеси|перенести|перемести|измени\s+расписание)/i.test(lower) ||
    /(?:жылдыр|өзгөрт)\b/i.test(lower)
  ) {
    return {
      type: 'update_group_schedule',
      params: { groupName: extractTargetGroup(text), newSchedule: extractSchedule(text) },
      raw: text,
    }
  }

  // Assign homework
  if (
    /\b(?:assign|give|create)\s+(?:homework|task|assignment|practice|exercise|reading|pronunciation|речь|упражнение|задание|тапшырма)\b/i.test(
      lower
    ) ||
    /\b(?:assign|give)\b.+\bto\b/i.test(lower) ||
    /(?:назначь|назначить|выдай|выдать)\s+(?:задание|дз|homework|упражнение)/i.test(lower) ||
    /Үй\s+тапшырма/i.test(lower)
  ) {
    const title = extractHomeworkTitle(text)
    const childNames = extractRecipientNames(text)
    return {
      type: 'assign_homework',
      params: { homeworkTitle: title, childNames },
      raw: text,
    }
  }

  // Send reminder
  if (
    /\b(?:send|create)\s+(?:a\s+)?reminder\b/i.test(lower) ||
    /\bremind\b/i.test(lower) ||
    /(?:отправь|отправить|пошли)\s+(?:напоминание|сообщение)\b/i.test(lower) ||
    /Эскертүү\b/i.test(lower)
  ) {
    const childNames = extractRecipientNames(text)
    const message = extractReminderMessage(text)
    return {
      type: 'send_reminder',
      params: { childNames, message },
      raw: text,
    }
  }

  // List groups
  if (
    /\b(?:list|show|get)\s+(?:all\s+)?groups\b/i.test(lower) ||
    /(?:покажи|список|показать)\s+(?:все\s+)?групп/i.test(lower) ||
    /(?:бардык\s+)?топторду\s+(?:көрсөт|тизме)/i.test(lower)
  ) {
    return { type: 'list_groups', params: {}, raw: text }
  }

  // List children
  if (
    /\b(?:list|show|get)\s+(?:all\s+)?children\b/i.test(lower) ||
    /(?:покажи|список|показать)\s+(?:все\s+)?детей/i.test(lower) ||
    /(?:бардык\s+)?балдарды\s+(?:көрсөт|тизме)/i.test(lower)
  ) {
    return { type: 'list_children', params: {}, raw: text }
  }

  return { type: 'unknown', params: {}, raw: text }
}

function extractHomeworkTitle(text: string): string {
  // "assign [title] to [name]" or "give [title] to [name]"
  let m = text.match(/\b(?:assign|give)\s+(.+?)\s+to\s+\w/i)
  if (m?.[1]) return m[1].trim()

  // "assign homework on X" / "assign task: X"
  m = text.match(
    /\b(?:homework|task|assignment|practice|exercise)\s+(?:on\s+|about\s+|:\s*)?(.+?)(?:\s+to\b|\s+for\b|$)/i
  )
  if (m?.[1]) return m[1].trim()

  // "назначь задание X для Y"
  m = text.match(/(?:назначь|выдай)\s+(?:задание\s+)?(.+?)(?:\s+для\b|\s+к\b|$)/i)
  if (m?.[1]) return m[1].trim()

  return ''
}

function extractRecipientNames(text: string): string[] {
  // "to Arsen" / "for Dana" at end of sentence
  const m =
    text.match(/\b(?:to|for)\s+(\w[\w\s]*?)(?:\s+about\b|\s+regarding\b|\s*$)/i) ||
    text.match(/для\s+(\w+)/i) ||
    text.match(/(\w+)(?:га|ге|ке|кке)\s*$/i) // Kyrgyz dative
  if (m?.[1]) {
    const raw = m[1].trim()
    // Don't treat generic words as names
    if (/^(?:parents?|parent|all|everyone|their|группу?|класс)$/i.test(raw)) return []
    return raw
      .split(/\s+(?:and|и|менен|да)\s+|,\s*/)
      .map((n) => n.trim())
      .filter((n) => n.length > 0)
  }
  return []
}

function extractReminderMessage(text: string): string {
  // "remind about X" / "send reminder about X"
  const m = text.match(/\b(?:about|про|о|regarding)\s+(.+?)(?:\s*$)/i)
  if (m?.[1]) return m[1].trim()

  // Strip command prefix and return remainder
  const stripped = text
    .replace(/^(?:send|create)\s+(?:a\s+)?reminder\s+(?:to\s+\w+\s+)?/i, '')
    .replace(/^(?:отправь|пошли)\s+напоминание\s+\w+\s+/i, '')
    .trim()
  return stripped || 'Reminder from your specialist'
}
