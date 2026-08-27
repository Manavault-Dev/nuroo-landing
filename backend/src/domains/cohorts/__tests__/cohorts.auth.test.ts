/**
 * Unit tests for cohorts.auth — permission checks and status machine.
 * Pure functions: no Fastify, no Firestore, no network.
 * London School: FastifyReply is mocked inline where needed.
 */

import { describe, it, expect, vi } from 'vitest'
import {
  isValidTransition,
  isAdmin,
  isInstructor,
  canManageCohort,
  canCreateCohort,
  canPublishCohort,
  canSubmitForApproval,
  canApproveCohort,
  validateStatusTransition,
  validateImmutableFields,
  ERR,
} from '../cohorts.auth.js'
import type { OrgMember } from '../../../shared/types/domain.js'
import type { CohortStatus } from '../cohorts.types.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function member(role: 'org_admin' | 'specialist' | 'parent', uid = 'u1'): OrgMember {
  return { uid, role, orgId: 'org1', email: null, name: 'Test', joinedAt: null } as OrgMember
}

function makeCohort(instructorId: string | null, status: CohortStatus = 'draft') {
  return { instructorId, status }
}

function mockReply() {
  const reply = { code: vi.fn().mockReturnThis(), send: vi.fn().mockReturnThis() }
  return reply as any
}

// ─── isValidTransition ────────────────────────────────────────────────────────

describe('isValidTransition — status machine', () => {
  const cases: [CohortStatus, CohortStatus, boolean][] = [
    ['draft', 'pending_approval', true],
    ['draft', 'open', true],
    ['draft', 'cancelled', true],
    ['draft', 'completed', false],
    ['draft', 'archived', false],
    ['pending_approval', 'open', true],
    ['pending_approval', 'draft', true],
    ['pending_approval', 'cancelled', true],
    ['pending_approval', 'in_progress', false],
    ['open', 'full', true],
    ['open', 'in_progress', true],
    ['open', 'cancelled', true],
    ['open', 'archived', true],
    ['open', 'draft', false],
    ['full', 'open', true],
    ['full', 'in_progress', true],
    ['full', 'cancelled', true],
    ['full', 'draft', false],
    ['in_progress', 'completed', true],
    ['in_progress', 'cancelled', true],
    ['in_progress', 'open', false],
    ['completed', 'archived', true],
    ['completed', 'open', false],
    ['archived', 'open', false],
    ['cancelled', 'open', false],
  ]

  it.each(cases)('%s → %s = %s', (from, to, expected) => {
    expect(isValidTransition(from, to)).toBe(expected)
  })
})

// ─── isAdmin / isInstructor / canManageCohort ─────────────────────────────────

describe('isAdmin', () => {
  it('true for org_admin', () => expect(isAdmin(member('org_admin'))).toBe(true))
  it('false for specialist', () => expect(isAdmin(member('specialist'))).toBe(false))
})

describe('isInstructor', () => {
  it('true when uid matches instructorId', () => {
    expect(isInstructor(member('specialist', 'sp1'), { instructorId: 'sp1' })).toBe(true)
  })

  it('false when uid does not match', () => {
    expect(isInstructor(member('specialist', 'sp1'), { instructorId: 'sp2' })).toBe(false)
  })

  it('false when instructorId is null', () => {
    expect(isInstructor(member('specialist', 'sp1'), { instructorId: null })).toBe(false)
  })
})

describe('canManageCohort', () => {
  it('true for org_admin regardless of instructorId', () => {
    expect(canManageCohort(member('org_admin', 'admin1'), { instructorId: 'sp1' })).toBe(true)
  })

  it('true for specialist who is instructor', () => {
    expect(canManageCohort(member('specialist', 'sp1'), { instructorId: 'sp1' })).toBe(true)
  })

  it('false for specialist who is NOT instructor', () => {
    expect(canManageCohort(member('specialist', 'sp2'), { instructorId: 'sp1' })).toBe(false)
  })
})

// ─── canCreateCohort ──────────────────────────────────────────────────────────

describe('canCreateCohort', () => {
  it('true for org_admin', () => expect(canCreateCohort(member('org_admin'))).toBe(true))
  it('true for specialist', () => expect(canCreateCohort(member('specialist'))).toBe(true))
  it('false for parent', () => expect(canCreateCohort(member('parent'))).toBe(false))
})

// ─── canPublishCohort ─────────────────────────────────────────────────────────

describe('canPublishCohort', () => {
  it('admin can always publish', () => {
    expect(canPublishCohort(member('org_admin', 'a1'), { instructorId: 'sp1' }, true)).toBe(true)
  })

  it('specialist-instructor can publish when approval NOT required', () => {
    expect(canPublishCohort(member('specialist', 'sp1'), { instructorId: 'sp1' }, false)).toBe(true)
  })

  it('specialist-instructor CANNOT publish when approval IS required', () => {
    expect(canPublishCohort(member('specialist', 'sp1'), { instructorId: 'sp1' }, true)).toBe(false)
  })

  it('non-instructor specialist cannot publish', () => {
    expect(canPublishCohort(member('specialist', 'sp2'), { instructorId: 'sp1' }, false)).toBe(
      false
    )
  })
})

// ─── canSubmitForApproval / canApproveCohort ──────────────────────────────────

describe('canSubmitForApproval', () => {
  it('true for instructor specialist', () => {
    expect(canSubmitForApproval(member('specialist', 'sp1'), { instructorId: 'sp1' })).toBe(true)
  })

  it('false for non-instructor specialist', () => {
    expect(canSubmitForApproval(member('specialist', 'sp2'), { instructorId: 'sp1' })).toBe(false)
  })
})

describe('canApproveCohort', () => {
  it('true for org_admin', () => expect(canApproveCohort(member('org_admin'))).toBe(true))
  it('false for specialist', () => expect(canApproveCohort(member('specialist'))).toBe(false))
})

// ─── validateStatusTransition ─────────────────────────────────────────────────

describe('validateStatusTransition', () => {
  it('returns true for valid transition admin does', () => {
    const reply = mockReply()
    const result = validateStatusTransition({
      member: member('org_admin'),
      cohort: makeCohort('sp1', 'draft'),
      nextStatus: 'open',
      requireGroupApproval: false,
      reply,
    })
    expect(result).toBe(true)
    expect(reply.code).not.toHaveBeenCalled()
  })

  it('rejects invalid transition with 422', () => {
    const reply = mockReply()
    validateStatusTransition({
      member: member('org_admin'),
      cohort: makeCohort('sp1', 'completed'),
      nextStatus: 'draft',
      requireGroupApproval: false,
      reply,
    })
    expect(reply.code).toHaveBeenCalledWith(422)
  })

  it('rejects specialist publishing draft when approval required', () => {
    const reply = mockReply()
    const result = validateStatusTransition({
      member: member('specialist', 'sp1'),
      cohort: makeCohort('sp1', 'draft'),
      nextStatus: 'open',
      requireGroupApproval: true,
      reply,
    })
    expect(result).toBe(false)
    expect(reply.code).toHaveBeenCalledWith(403)
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ code: ERR.ADMIN_APPROVAL_REQUIRED.code })
    )
  })

  it('rejects specialist approving pending_approval', () => {
    const reply = mockReply()
    validateStatusTransition({
      member: member('specialist', 'sp1'),
      cohort: makeCohort('sp1', 'pending_approval'),
      nextStatus: 'open',
      requireGroupApproval: false,
      reply,
    })
    expect(reply.code).toHaveBeenCalledWith(403)
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ code: ERR.ADMIN_APPROVAL_REQUIRED.code })
    )
  })

  it('allows admin to approve pending_approval → open', () => {
    const reply = mockReply()
    const result = validateStatusTransition({
      member: member('org_admin'),
      cohort: makeCohort('sp1', 'pending_approval'),
      nextStatus: 'open',
      requireGroupApproval: false,
      reply,
    })
    expect(result).toBe(true)
  })

  it('allows instructor to withdraw pending_approval → draft', () => {
    const reply = mockReply()
    const result = validateStatusTransition({
      member: member('specialist', 'sp1'),
      cohort: makeCohort('sp1', 'pending_approval'),
      nextStatus: 'draft',
      requireGroupApproval: false,
      reply,
    })
    expect(result).toBe(true)
  })
})

// ─── validateImmutableFields ──────────────────────────────────────────────────

describe('validateImmutableFields', () => {
  it('admin can change instructorId', () => {
    const reply = mockReply()
    const result = validateImmutableFields({
      member: member('org_admin'),
      body: { instructorId: 'new_sp' },
      reply,
    })
    expect(result).toBe(true)
    expect(reply.code).not.toHaveBeenCalled()
  })

  it('specialist cannot change instructorId', () => {
    const reply = mockReply()
    const result = validateImmutableFields({
      member: member('specialist', 'sp1'),
      body: { instructorId: 'other_sp' },
      reply,
    })
    expect(result).toBe(false)
    expect(reply.code).toHaveBeenCalledWith(422)
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ code: ERR.IMMUTABLE_FIELD.code, field: 'instructorId' })
    )
  })

  it('specialist cannot change orgId', () => {
    const reply = mockReply()
    const result = validateImmutableFields({
      member: member('specialist'),
      body: { orgId: 'other_org' },
      reply,
    })
    expect(result).toBe(false)
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ field: 'orgId' })
    )
  })

  it('specialist can change non-immutable fields', () => {
    const reply = mockReply()
    const result = validateImmutableFields({
      member: member('specialist'),
      body: { title: 'Новое название', maxParticipants: 10 },
      reply,
    })
    expect(result).toBe(true)
  })

  it('specialist setting instructorId to undefined is allowed', () => {
    const reply = mockReply()
    const result = validateImmutableFields({
      member: member('specialist'),
      body: { instructorId: undefined },
      reply,
    })
    expect(result).toBe(true)
  })
})
