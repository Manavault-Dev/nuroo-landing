import { ParsedAction } from './types'

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
    /(?:called|named)\s+(.+?)(?:\s+on\s|\s+at\s|\s+по\s|\s+в\s|$)/i,
    /(?:группу|группа|топ)\s+(.+?)(?:\s+по\s|\s+в\s|\s+на\s|\s+at\s|$)/i,
    /group\s+(.+?)(?:\s+on\s|\s+at\s|$)/i,
  ]) {
    const m = text.match(p)
    if (m?.[1]) return m[1].trim()
  }
  return ''
}

export function extractChildNames(text: string): string[] {
  const m = text.match(
    /(?:add|добавь|добавить|запиши|кош)\s+(.+?)\s+(?:to(?:\s+(?:the|this|group|группу))|в\s+(?:группу|эту)|топко)/i
  )
  if (!m) return []
  return m[1]
    .split(/\s+(?:and|и|менен|да|жана)\s+|,\s*/)
    .map((n) => n.trim())
    .filter(Boolean)
}

export function extractTargetGroup(text: string): string {
  const m = text.match(
    /(?:to\s+(?:group|the\s+group)\s+|в\s+группу\s+|в\s+топ\s+|топко\s+)(.+?)(?:\s*$)/i
  )
  return m?.[1]?.trim() || ''
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
      params: { name: extractGroupName(text) || 'New Group', schedule: extractSchedule(text) },
      raw: text,
    }
  }

  // Add single child
  if (
    /\b(?:add|put)\s+(?:child|kid)\b/i.test(lower) ||
    /(?:добавь|добавить)\s+(?:ребёнка|ребенка|ребенок)\b/i.test(lower) ||
    /баланы\s+топко/i.test(lower)
  ) {
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

  // Add multiple children
  if (
    /\b(?:add|put)\b.*\b(?:to|into)\b/i.test(lower) ||
    /(?:добавь|добавить|запиши|поставь)\b.*\bв\s+(?:группу|эту)/i.test(lower) ||
    /\bкош\b.*\bтопко/i.test(lower)
  ) {
    const childNames = extractChildNames(text)
    if (childNames.length) {
      return {
        type: 'add_children_to_group',
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
    /\b(?:assign|give|create)\s+(?:homework|task|assignment)\b/i.test(lower) ||
    /(?:назначь|назначить|выдай|выдать)\s+(?:задание|дз|homework)/i.test(lower) ||
    /Үй\s+тапшырма/i.test(lower)
  ) {
    const taskMatch = text.match(
      /(?:homework|task|assignment|задание|тапшырма)\s+(?:on\s+)?(?:about\s+)?(.+?)(?:\s+to|\s+for|$)/i
    )
    return {
      type: 'assign_homework',
      params: {
        childNames: [],
        homeworkTitle: taskMatch ? taskMatch[1] : '',
      },
      raw: text,
    }
  }

  // Send reminder
  if (
    /\b(?:send|create)\s+reminder\b/i.test(lower) ||
    /(?:отправь|отправить|пошли)\s+(?:напоминание|сообщение)\b/i.test(lower) ||
    /Эскертүү/i.test(lower)
  ) {
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
