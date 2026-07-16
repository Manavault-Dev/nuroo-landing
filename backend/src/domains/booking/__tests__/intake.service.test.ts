import { describe, expect, it } from 'vitest'
import {
  getAllFields,
  validateAnswers,
  resolveInitialIntakeStatus,
  canTransitionIntake,
  intakeStatusTransitions,
  buildTemplateSnapshot,
  sortByCreatedAtDesc,
  NUROO_SECTIONS,
  NUROO_DEFAULT_FIELDS,
} from '../intake.service.js'
import type { IntakeField, IntakeFormDoc } from '../types.js'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const FLAT_FIELDS: IntakeField[] = [
  { id: 'name', label: 'Name', type: 'text', required: true },
  { id: 'age', label: 'Age', type: 'text', required: true },
  { id: 'notes', label: 'Notes', type: 'textarea', required: false },
]

const FLAT_FORM: Pick<IntakeFormDoc, 'name' | 'fields' | 'sections'> = {
  name: 'Test Form',
  fields: FLAT_FIELDS,
}

const SECTIONED_FORM: Pick<IntakeFormDoc, 'name' | 'fields' | 'sections'> = {
  name: 'Sectioned Form',
  fields: [], // ignored when sections present
  sections: [
    {
      id: 's1',
      title: 'Section 1',
      fields: [
        { id: 'q1', label: 'Q1', type: 'text', required: true },
        { id: 'q2', label: 'Q2', type: 'checkbox', required: false },
      ],
    },
    {
      id: 's2',
      title: 'Section 2',
      fields: [{ id: 'q3', label: 'Q3', type: 'textarea', required: true }],
    },
  ],
}

// ── getAllFields ───────────────────────────────────────────────────────────────

describe('getAllFields', () => {
  it('returns flat fields when no sections', () => {
    const fields = getAllFields(FLAT_FORM)
    expect(fields).toHaveLength(3)
    expect(fields.map((f) => f.id)).toEqual(['name', 'age', 'notes'])
  })

  it('flattens sections into a single array', () => {
    const fields = getAllFields(SECTIONED_FORM)
    expect(fields).toHaveLength(3)
    expect(fields.map((f) => f.id)).toEqual(['q1', 'q2', 'q3'])
  })

  it('ignores flat fields when sections are present', () => {
    const form = { ...FLAT_FORM, sections: SECTIONED_FORM.sections }
    const fields = getAllFields(form)
    expect(fields.every((f) => ['q1', 'q2', 'q3'].includes(f.id))).toBe(true)
  })

  it('returns flat fields when sections array is empty', () => {
    const form = { ...FLAT_FORM, sections: [] }
    const fields = getAllFields(form)
    expect(fields).toHaveLength(3)
  })
})

// ── validateAnswers ───────────────────────────────────────────────────────────

describe('validateAnswers — valid cases', () => {
  it('returns null for correct answers to all required fields', () => {
    const err = validateAnswers(FLAT_FIELDS, { name: 'Alice', age: '5' })
    expect(err).toBeNull()
  })

  it('returns null when optional fields are omitted', () => {
    const err = validateAnswers(FLAT_FIELDS, { name: 'Alice', age: '5' })
    expect(err).toBeNull()
  })

  it('returns null when optional fields are filled', () => {
    const err = validateAnswers(FLAT_FIELDS, { name: 'Alice', age: '5', notes: 'Some text' })
    expect(err).toBeNull()
  })

  it('accepts boolean true for checkbox required field', () => {
    const fields: IntakeField[] = [
      { id: 'consent', label: 'Consent', type: 'checkbox', required: true },
    ]
    expect(validateAnswers(fields, { consent: true })).toBeNull()
  })

  it('returns null for empty answers when no required fields', () => {
    const allOptional: IntakeField[] = [
      { id: 'note', label: 'Note', type: 'textarea', required: false },
    ]
    expect(validateAnswers(allOptional, {})).toBeNull()
  })
})

describe('validateAnswers — invalid cases', () => {
  it('returns error for unknown field id', () => {
    const err = validateAnswers(FLAT_FIELDS, { name: 'Alice', age: '5', unknownField: 'x' })
    expect(err).toContain('Unknown field')
    expect(err).toContain('unknownField')
  })

  it('returns error when required text field is empty string', () => {
    const err = validateAnswers(FLAT_FIELDS, { name: '', age: '5' })
    expect(err).not.toBeNull()
    expect(err).toContain('required')
  })

  it('returns error when required field is missing entirely', () => {
    const err = validateAnswers(FLAT_FIELDS, { age: '5' })
    expect(err).not.toBeNull()
  })

  it('returns error when required checkbox is false', () => {
    const fields: IntakeField[] = [
      { id: 'consent', label: 'Consent', type: 'checkbox', required: true },
    ]
    expect(validateAnswers(fields, { consent: false })).not.toBeNull()
  })

  it('returns error when required checkbox is missing', () => {
    const fields: IntakeField[] = [
      { id: 'consent', label: 'Consent', type: 'checkbox', required: true },
    ]
    expect(validateAnswers(fields, {})).not.toBeNull()
  })

  it('returns first error only (does not accumulate)', () => {
    // both name and age missing — returns a single string, not array
    const err = validateAnswers(FLAT_FIELDS, {})
    expect(typeof err).toBe('string')
  })
})

describe('validateAnswers — with sections', () => {
  const fields = getAllFields(SECTIONED_FORM)

  it('validates flat list extracted from sections', () => {
    expect(validateAnswers(fields, { q1: 'answer', q3: 'answer' })).toBeNull()
  })

  it('rejects unknown field from another form', () => {
    expect(validateAnswers(fields, { q1: 'ok', q3: 'ok', q999: 'hack' })).toContain('Unknown field')
  })

  it('rejects missing required field in second section', () => {
    expect(validateAnswers(fields, { q1: 'ok' })).not.toBeNull()
  })
})

// ── resolveInitialIntakeStatus ────────────────────────────────────────────────

describe('resolveInitialIntakeStatus', () => {
  it('returns pending when intakeFormId is a non-empty string', () => {
    expect(resolveInitialIntakeStatus('form123')).toBe('pending')
  })

  it('returns not_required when intakeFormId is null', () => {
    expect(resolveInitialIntakeStatus(null)).toBe('not_required')
  })

  it('returns not_required when intakeFormId is undefined', () => {
    expect(resolveInitialIntakeStatus(undefined)).toBe('not_required')
  })

  it('returns not_required when intakeFormId is empty string', () => {
    // empty string is falsy — treated as not linked
    expect(resolveInitialIntakeStatus('')).toBe('not_required')
  })
})

// ── intakeStatusTransitions / canTransitionIntake ─────────────────────────────

describe('intakeStatusTransitions', () => {
  it('not_required has no valid transitions', () => {
    expect(intakeStatusTransitions('not_required')).toEqual([])
  })

  it('pending can only move to submitted', () => {
    expect(intakeStatusTransitions('pending')).toEqual(['submitted'])
  })

  it('submitted can only move to reviewed', () => {
    expect(intakeStatusTransitions('submitted')).toEqual(['reviewed'])
  })

  it('reviewed has no valid transitions', () => {
    expect(intakeStatusTransitions('reviewed')).toEqual([])
  })
})

describe('canTransitionIntake', () => {
  it('pending → submitted is allowed', () => {
    expect(canTransitionIntake('pending', 'submitted')).toBe(true)
  })

  it('submitted → reviewed is allowed', () => {
    expect(canTransitionIntake('submitted', 'reviewed')).toBe(true)
  })

  it('pending → reviewed is NOT allowed (must go through submitted)', () => {
    expect(canTransitionIntake('pending', 'reviewed')).toBe(false)
  })

  it('reviewed → pending is NOT allowed', () => {
    expect(canTransitionIntake('reviewed', 'pending')).toBe(false)
  })

  it('not_required → pending is NOT allowed', () => {
    expect(canTransitionIntake('not_required', 'pending')).toBe(false)
  })

  it('submitted → pending is NOT allowed (no rollback)', () => {
    expect(canTransitionIntake('submitted', 'pending')).toBe(false)
  })
})

// ── buildTemplateSnapshot ─────────────────────────────────────────────────────

describe('buildTemplateSnapshot', () => {
  it('includes name and fields for flat form', () => {
    const snap = buildTemplateSnapshot(FLAT_FORM)
    expect(snap.name).toBe('Test Form')
    expect(snap.fields).toEqual(FLAT_FIELDS)
    expect(snap.sections).toBeUndefined()
  })

  it('includes sections when present', () => {
    const snap = buildTemplateSnapshot(SECTIONED_FORM)
    expect(snap.sections).toHaveLength(2)
    expect(snap.sections![0].id).toBe('s1')
  })

  it('snapshot is a plain object copy (not reference)', () => {
    const snap = buildTemplateSnapshot(FLAT_FORM)
    expect(snap).not.toBe(FLAT_FORM)
  })
})

// ── sortByCreatedAtDesc ───────────────────────────────────────────────────────

describe('sortByCreatedAtDesc', () => {
  it('sorts newest first', () => {
    const items = [
      { id: 'a', createdAt: '2025-01-01T10:00:00Z' },
      { id: 'b', createdAt: '2025-03-01T10:00:00Z' },
      { id: 'c', createdAt: '2025-02-01T10:00:00Z' },
    ]
    const sorted = sortByCreatedAtDesc(items)
    expect(sorted.map((i) => i.id)).toEqual(['b', 'c', 'a'])
  })

  it('does not mutate the original array', () => {
    const items = [
      { id: 'a', createdAt: '2025-01-01T10:00:00Z' },
      { id: 'b', createdAt: '2025-03-01T10:00:00Z' },
    ]
    const original = [...items]
    sortByCreatedAtDesc(items)
    expect(items).toEqual(original)
  })

  it('handles items without createdAt', () => {
    const items = [{ id: 'a' }, { id: 'b', createdAt: '2025-01-01T10:00:00Z' }]
    const sorted = sortByCreatedAtDesc(items)
    // 'b' has createdAt so should be first; 'a' sorts to bottom
    expect(sorted[0].id).toBe('b')
  })
})

// ── NUROO_SECTIONS & NUROO_DEFAULT_FIELDS ─────────────────────────────────────

describe('NUROO default template', () => {
  it('has 7 sections', () => {
    expect(NUROO_SECTIONS).toHaveLength(7)
  })

  it('every section has at least one field', () => {
    for (const sec of NUROO_SECTIONS) {
      expect(sec.fields.length).toBeGreaterThan(0)
    }
  })

  it('NUROO_DEFAULT_FIELDS equals flattened sections', () => {
    const flat = NUROO_SECTIONS.flatMap((s) => s.fields)
    expect(NUROO_DEFAULT_FIELDS).toEqual(flat)
  })

  it('all field ids are unique', () => {
    const ids = NUROO_DEFAULT_FIELDS.map((f) => f.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('required fields are only in critical sections', () => {
    const required = NUROO_DEFAULT_FIELDS.filter((f) => f.required)
    const requiredIds = required.map((f) => f.id)
    // child name, age, reason_for_visit are required — others are optional
    expect(requiredIds).toContain('child_preferred_name')
    expect(requiredIds).toContain('child_age')
    expect(requiredIds).toContain('reason_for_visit')
    // most fields are optional to reduce friction
    expect(required.length).toBeLessThan(NUROO_DEFAULT_FIELDS.length)
  })

  it('validates correct minimal Nuroo answers', () => {
    const minimalAnswers = {
      child_preferred_name: 'Asel',
      child_age: '7',
      reason_for_visit: 'Speech delay',
    }
    const err = validateAnswers(NUROO_DEFAULT_FIELDS, minimalAnswers)
    expect(err).toBeNull()
  })

  it('rejects Nuroo answers with missing required child_age', () => {
    const answers = {
      child_preferred_name: 'Asel',
      reason_for_visit: 'Speech delay',
    }
    expect(validateAnswers(NUROO_DEFAULT_FIELDS, answers)).not.toBeNull()
  })

  it('rejects Nuroo answers with unknown field', () => {
    const answers = {
      child_preferred_name: 'Asel',
      child_age: '7',
      reason_for_visit: 'Speech delay',
      injected_field: '<script>alert(1)</script>',
    }
    const err = validateAnswers(NUROO_DEFAULT_FIELDS, answers)
    expect(err).toContain('Unknown field')
    expect(err).toContain('injected_field')
  })
})
