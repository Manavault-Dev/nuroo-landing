/**
 * Unit tests for children.service — pure functions only (no Firestore).
 * London School TDD: all external dependencies are mocked at the module boundary.
 */

import { describe, it, expect } from 'vitest'
import {
  COLLECTIONS,
  DEFAULT_TIMELINE_DAYS,
  MIN_TIMELINE_DAYS,
  MAX_TIMELINE_DAYS,
  pickStoredProfileName,
  resolveChildNameFromData,
  groupChildrenByParent,
  parseTimelineDays,
  buildActivityMap,
  buildFeedbackMap,
  buildTimelineDays,
} from '../children.service.js'

// ─── COLLECTIONS ──────────────────────────────────────────────────────────────

describe('COLLECTIONS', () => {
  it('builds ORG_CHILDREN path', () => {
    expect(COLLECTIONS.ORG_CHILDREN('org_1')).toBe('organizations/org_1/children')
  })

  it('builds CHILD_TASKS path', () => {
    expect(COLLECTIONS.CHILD_TASKS('child_abc')).toBe('children/child_abc/tasks')
  })

  it('builds ORG_PARENTS path', () => {
    expect(COLLECTIONS.ORG_PARENTS('org_x')).toBe('orgParents/org_x/parents')
  })
})

// ─── pickStoredProfileName ────────────────────────────────────────────────────

describe('pickStoredProfileName', () => {
  it('returns null for null input', () => {
    expect(pickStoredProfileName(null)).toBeNull()
  })

  it('returns null for undefined input', () => {
    expect(pickStoredProfileName(undefined)).toBeNull()
  })

  it('picks childName field first', () => {
    expect(pickStoredProfileName({ childName: 'Аня', name: 'Другой' })).toBe('Аня')
  })

  it('picks name field', () => {
    expect(pickStoredProfileName({ name: 'Берик' })).toBe('Берик')
  })

  it('picks displayName field', () => {
    expect(pickStoredProfileName({ displayName: 'Камила К.' })).toBe('Камила К.')
  })

  it('assembles firstName + lastName', () => {
    expect(pickStoredProfileName({ firstName: 'Арман', lastName: 'Сейткали' })).toBe(
      'Арман Сейткали'
    )
  })

  it('returns only firstName when no lastName', () => {
    expect(pickStoredProfileName({ firstName: 'Айдай' })).toBe('Айдай')
  })

  it('trims whitespace', () => {
    expect(pickStoredProfileName({ childName: '  Дана  ' })).toBe('Дана')
  })

  it('returns null for whitespace-only name', () => {
    expect(pickStoredProfileName({ childName: '   ' })).toBeNull()
  })
})

// ─── resolveChildNameFromData ─────────────────────────────────────────────────

describe('resolveChildNameFromData', () => {
  it('prefers childData.name over userData', () => {
    const result = resolveChildNameFromData('c1', { name: 'Данияр' }, { name: 'Родитель' })
    expect(result).toBe('Данияр')
  })

  it('falls back to userData.displayName when childData has no name', () => {
    const result = resolveChildNameFromData('c1', {}, { displayName: 'Мама' })
    expect(result).toBe('Мама')
  })

  it('assembles firstName + lastName from childData', () => {
    const result = resolveChildNameFromData('c1', { firstName: 'Алина', lastName: 'Ким' }, null)
    expect(result).toBe('Алина Ким')
  })

  it('falls back to childId when nothing is available', () => {
    const result = resolveChildNameFromData('child_xyz', {}, null)
    expect(result).toBe('child_xyz')
  })

  it('returns null when childId is empty', () => {
    const result = resolveChildNameFromData('', null, null)
    expect(result).toBeNull()
  })
})

// ─── parseTimelineDays ────────────────────────────────────────────────────────

describe('parseTimelineDays', () => {
  it('defaults to DEFAULT_TIMELINE_DAYS when undefined', () => {
    expect(parseTimelineDays(undefined)).toBe(DEFAULT_TIMELINE_DAYS)
  })

  it('clamps below MIN_TIMELINE_DAYS', () => {
    expect(parseTimelineDays('1')).toBe(MIN_TIMELINE_DAYS)
  })

  it('clamps above MAX_TIMELINE_DAYS', () => {
    expect(parseTimelineDays('999')).toBe(MAX_TIMELINE_DAYS)
  })

  it('parses valid value in range', () => {
    expect(parseTimelineDays('14')).toBe(14)
  })

  it('returns DEFAULT for NaN input (graceful fallback)', () => {
    expect(parseTimelineDays('abc')).toBe(DEFAULT_TIMELINE_DAYS)
  })
})

// ─── buildActivityMap ─────────────────────────────────────────────────────────

describe('buildActivityMap', () => {
  function makeDoc(status: string, updatedAt: Date) {
    return {
      data: () => ({
        status,
        updatedAt: { toDate: () => updatedAt },
      }),
    } as any
  }

  it('counts completed and attempted tasks per day', () => {
    const date = new Date('2026-01-10T10:00:00Z')
    const docs = [makeDoc('completed', date), makeDoc('pending', date)]
    const map = buildActivityMap(docs)
    expect(map.get('2026-01-10')).toEqual({ attempted: 2, completed: 1 })
  })

  it('splits tasks into different days', () => {
    const d1 = new Date('2026-01-10T10:00:00Z')
    const d2 = new Date('2026-01-11T10:00:00Z')
    const docs = [makeDoc('completed', d1), makeDoc('completed', d2)]
    const map = buildActivityMap(docs)
    expect(map.size).toBe(2)
    expect(map.get('2026-01-10')!.completed).toBe(1)
    expect(map.get('2026-01-11')!.completed).toBe(1)
  })

  it('returns empty map for empty input', () => {
    expect(buildActivityMap([])).toEqual(new Map())
  })
})

// ─── buildFeedbackMap ─────────────────────────────────────────────────────────

describe('buildFeedbackMap', () => {
  function makeFeedbackDoc(mood: string, comment: string | undefined, timestamp: Date) {
    return {
      data: () => ({
        mood,
        comment,
        timestamp: { toDate: () => timestamp },
      }),
    } as any
  }

  it('groups feedback by date', () => {
    const ts = new Date('2026-01-10T09:00:00Z')
    const map = buildFeedbackMap([makeFeedbackDoc('good', 'отлично!', ts)])
    const entry = map.get('2026-01-10')
    expect(entry?.mood).toBe('good')
    expect(entry?.comment).toBe('отлично!')
  })

  it('overwrites earlier entry for same date (last wins)', () => {
    const ts = new Date('2026-01-10T09:00:00Z')
    const docs = [
      makeFeedbackDoc('good', 'первый', ts),
      makeFeedbackDoc('hard', 'второй', ts),
    ]
    const map = buildFeedbackMap(docs)
    expect(map.get('2026-01-10')?.mood).toBe('hard')
  })

  it('returns empty map for empty input', () => {
    expect(buildFeedbackMap([])).toEqual(new Map())
  })
})

// ─── buildTimelineDays ────────────────────────────────────────────────────────

describe('buildTimelineDays', () => {
  it('returns the correct number of days', () => {
    const result = buildTimelineDays(7, new Map(), new Map())
    expect(result).toHaveLength(7)
  })

  it('days are in ascending order (oldest first)', () => {
    const result = buildTimelineDays(3, new Map(), new Map())
    expect(result[0].date < result[1].date).toBe(true)
    expect(result[1].date < result[2].date).toBe(true)
  })

  it('zeroes out activity when no data', () => {
    const result = buildTimelineDays(1, new Map(), new Map())
    expect(result[0].tasksAttempted).toBe(0)
    expect(result[0].tasksCompleted).toBe(0)
    expect(result[0].feedback).toBeUndefined()
  })

  it('injects activity data for matching date', () => {
    const today = new Date().toISOString().split('T')[0]
    const activityMap = new Map([[today, { attempted: 3, completed: 2 }]])
    const result = buildTimelineDays(1, activityMap, new Map())
    expect(result[0].tasksAttempted).toBe(3)
    expect(result[0].tasksCompleted).toBe(2)
  })

  it('injects feedback for matching date', () => {
    const today = new Date().toISOString().split('T')[0]
    const feedbackMap = new Map([
      [today, { mood: 'ok' as const, comment: 'неплохо', timestamp: new Date() }],
    ])
    const result = buildTimelineDays(1, new Map(), feedbackMap)
    expect(result[0].feedback?.mood).toBe('ok')
    expect(result[0].feedback?.comment).toBe('неплохо')
  })
})

// ─── groupChildrenByParent ────────────────────────────────────────────────────

describe('groupChildrenByParent', () => {
  function makeChildDoc(id: string, data: Record<string, unknown>) {
    return { id, data: () => data } as any
  }

  it('groups children under their parent', () => {
    const docs = [
      makeChildDoc('child_1', { parentUserId: 'parent_1', assigned: true }),
      makeChildDoc('child_2', { parentUserId: 'parent_1', assigned: true }),
    ]
    const { parentMap } = groupChildrenByParent(docs)
    expect(parentMap.get('parent_1')).toHaveLength(2)
  })

  it('skips docs without parentUserId', () => {
    const docs = [makeChildDoc('child_1', { assigned: true })]
    const { parentMap } = groupChildrenByParent(docs)
    expect(parentMap.size).toBe(0)
  })

  it('builds orgLinkByChildId map', () => {
    const docs = [makeChildDoc('child_1', { parentUserId: 'parent_1' })]
    const { orgLinkByChildId } = groupChildrenByParent(docs)
    expect(orgLinkByChildId.has('child_1')).toBe(true)
  })

  it('handles multiple parents', () => {
    const docs = [
      makeChildDoc('child_1', { parentUserId: 'parent_1' }),
      makeChildDoc('child_2', { parentUserId: 'parent_2' }),
    ]
    const { parentMap } = groupChildrenByParent(docs)
    expect(parentMap.size).toBe(2)
  })
})
