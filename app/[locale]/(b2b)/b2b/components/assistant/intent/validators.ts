import { ParsedAction } from '../types'

export interface ValidationResult {
  valid: boolean
  missingFields: string[]
}

export function validateIntent(action: ParsedAction): ValidationResult {
  const missingFields: string[] = []

  switch (action.type) {
    case 'create_group':
      if (!action.params.name) missingFields.push('group name')
      break
    case 'add_children_to_group':
      if (!action.params.childNames?.length) missingFields.push('child names')
      if (!action.params.groupName) missingFields.push('group name')
      break
    case 'add_child':
      if (!action.params.childNames?.length) missingFields.push('child name')
      if (!action.params.groupName) missingFields.push('group name')
      break
    case 'assign_homework':
      if (!action.params.homeworkTitle) missingFields.push('homework title')
      break
    case 'send_reminder':
      // message is optional
      break
    case 'update_group_schedule':
      if (!action.params.groupName) missingFields.push('group name')
      break
  }

  return { valid: missingFields.length === 0, missingFields }
}
