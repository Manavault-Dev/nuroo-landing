import type { IntakeField, IntakeFormDoc, IntakeSection, IntakeStatus } from './types.js'

// ── Default Nuroo template ────────────────────────────────────────────────────

export const NUROO_SECTIONS: IntakeSection[] = [
  {
    id: 'child_info',
    title: 'Информация о ребёнке',
    fields: [
      {
        id: 'child_preferred_name',
        label: 'Как зовут вашего ребёнка?',
        type: 'text',
        required: true,
      },
      { id: 'child_age', label: 'Возраст ребёнка', type: 'text', required: true },
    ],
  },
  {
    id: 'reason_for_visit',
    title: 'Причина обращения',
    fields: [
      {
        id: 'reason_for_visit',
        label: 'Что привело вас к специалисту?',
        type: 'textarea',
        required: true,
      },
      {
        id: 'main_concerns',
        label: 'Что вас беспокоит больше всего?',
        type: 'textarea',
        required: false,
      },
    ],
  },
  {
    id: 'concern_history',
    title: 'История беспокойств',
    fields: [
      {
        id: 'when_first_noticed',
        label: 'Когда вы впервые заметили эти особенности?',
        type: 'textarea',
        required: false,
      },
      {
        id: 'changes_over_time',
        label: 'Как ситуация менялась со временем?',
        type: 'textarea',
        required: false,
      },
    ],
  },
  {
    id: 'previous_support',
    title: 'Предыдущая помощь',
    fields: [
      {
        id: 'had_previous_specialist',
        label: 'Работал ли ваш ребёнок ранее со специалистом?',
        type: 'checkbox',
        required: false,
      },
      {
        id: 'previous_support_details',
        label: 'Если да — какую помощь получал ребёнок?',
        type: 'textarea',
        required: false,
      },
    ],
  },
  {
    id: 'current_support',
    title: 'Текущая поддержка',
    fields: [
      {
        id: 'current_support',
        label: 'Получает ли ребёнок сейчас развивающую или учебную поддержку?',
        type: 'textarea',
        required: false,
      },
    ],
  },
  {
    id: 'expectations',
    title: 'Ожидания',
    fields: [
      {
        id: 'most_want_help_with',
        label: 'В чём вы хотите получить помощь больше всего?',
        type: 'textarea',
        required: false,
      },
      {
        id: 'what_makes_useful',
        label: 'Что сделало бы эту консультацию полезной для вас?',
        type: 'textarea',
        required: false,
      },
    ],
  },
  {
    id: 'additional_info',
    title: 'Дополнительная информация',
    fields: [
      {
        id: 'additional_notes',
        label: 'Есть ли что-то ещё, что специалист должен знать до встречи?',
        type: 'textarea',
        required: false,
      },
    ],
  },
]

export const NUROO_DEFAULT_FIELDS: IntakeField[] = NUROO_SECTIONS.flatMap((s) => s.fields)

// ── Pure helpers ──────────────────────────────────────────────────────────────

/** Returns all fields from a form, flattening sections if present */
export function getAllFields(form: Pick<IntakeFormDoc, 'fields' | 'sections'>): IntakeField[] {
  if (form.sections && form.sections.length > 0) {
    return form.sections.flatMap((s) => s.fields)
  }
  return form.fields
}

/**
 * Validates answers against a field list.
 * Returns null if valid, or an error message string.
 */
export function validateAnswers(
  fields: IntakeField[],
  answers: Record<string, string | boolean>
): string | null {
  const validIds = new Set(fields.map((f) => f.id))

  for (const key of Object.keys(answers)) {
    if (!validIds.has(key)) return `Unknown field: ${key}`
  }

  for (const field of fields) {
    if (!field.required) continue
    const val = answers[field.id]
    if (val === undefined || val === null || val === '' || val === false) {
      return `Field "${field.label}" is required`
    }
  }

  return null
}

/**
 * Determines intakeStatus at booking-creation time.
 * If service has an intake form linked, status starts as 'pending'; otherwise 'not_required'.
 */
export function resolveInitialIntakeStatus(intakeFormId: string | null | undefined): IntakeStatus {
  return intakeFormId ? 'pending' : 'not_required'
}

/** Returns valid next statuses for a given intake status */
export function intakeStatusTransitions(current: IntakeStatus): IntakeStatus[] {
  const allowed: Record<IntakeStatus, IntakeStatus[]> = {
    not_required: [],
    pending: ['submitted'],
    submitted: ['reviewed'],
    reviewed: [],
  }
  return allowed[current]
}

export function canTransitionIntake(current: IntakeStatus, next: IntakeStatus): boolean {
  return intakeStatusTransitions(current).includes(next)
}

/** Builds the template snapshot stored inside a submission */
export function buildTemplateSnapshot(form: Pick<IntakeFormDoc, 'name' | 'fields' | 'sections'>) {
  return {
    name: form.name,
    fields: form.fields,
    ...(form.sections ? { sections: form.sections } : {}),
  }
}

export function sortByCreatedAtDesc<T extends Record<string, unknown>>(items: T[]): T[] {
  return [...items].sort((a, b) =>
    String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? ''))
  )
}
