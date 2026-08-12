/**
 * Cohort Authorization Layer
 *
 * Single source of truth for all permission checks on cohorts.
 * All write paths in cohorts.routes.ts go through these helpers.
 *
 * Principles:
 * - org_admin can manage any cohort in their org
 * - specialist can manage only cohorts where instructorId === their uid
 * - no client-supplied role is trusted — all checks use server-resolved OrgMember
 * - immutable fields (orgId, instructorId by specialist) are enforced here
 */

import type { FastifyReply } from 'fastify'
import type { OrgMember } from '../../shared/types/domain.js'
import type { CohortDoc } from './cohorts.types.js'
import type { CohortStatus } from './cohorts.types.js'

// ─── Error codes ──────────────────────────────────────────────────────────────

export const ERR = {
  UNAUTHENTICATED: { code: 'UNAUTHENTICATED', status: 401 },
  ORG_MEMBERSHIP_REQUIRED: { code: 'ORG_MEMBERSHIP_REQUIRED', status: 403 },
  FORBIDDEN: { code: 'FORBIDDEN', status: 403 },
  NOT_GROUP_INSTRUCTOR: { code: 'NOT_GROUP_INSTRUCTOR', status: 403 },
  ADMIN_APPROVAL_REQUIRED: { code: 'ADMIN_APPROVAL_REQUIRED', status: 403 },
  INVALID_STATUS_TRANSITION: { code: 'INVALID_STATUS_TRANSITION', status: 422 },
  RESOURCE_NOT_FOUND: { code: 'RESOURCE_NOT_FOUND', status: 404 },
  IMMUTABLE_FIELD: { code: 'IMMUTABLE_FIELD', status: 422 },
} as const

// ─── Status machine ───────────────────────────────────────────────────────────

/** Allowed transitions: [from] → Set<to> */
const ALLOWED_TRANSITIONS: Record<string, Set<CohortStatus>> = {
  draft: new Set(['pending_approval', 'open', 'cancelled']),
  pending_approval: new Set(['open', 'draft', 'cancelled']),
  open: new Set(['full', 'in_progress', 'cancelled', 'archived']),
  full: new Set(['open', 'in_progress', 'cancelled', 'archived']),
  in_progress: new Set(['completed', 'cancelled']),
  completed: new Set(['archived']),
  archived: new Set(),
  cancelled: new Set(),
}

export function isValidTransition(from: CohortStatus, to: CohortStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.has(to) ?? false
}

// ─── Permission checks ────────────────────────────────────────────────────────

export function isAdmin(member: OrgMember): boolean {
  return member.role === 'org_admin'
}

export function isInstructor(member: OrgMember, cohort: Pick<CohortDoc, 'instructorId'>): boolean {
  return !!cohort.instructorId && cohort.instructorId === member.uid
}

export function canManageCohort(
  member: OrgMember,
  cohort: Pick<CohortDoc, 'instructorId'>
): boolean {
  return isAdmin(member) || isInstructor(member, cohort)
}

/** Can create a cohort in the org */
export function canCreateCohort(member: OrgMember): boolean {
  return member.role === 'org_admin' || member.role === 'specialist'
}

/** Can publish (open) a cohort directly */
export function canPublishCohort(
  member: OrgMember,
  cohort: Pick<CohortDoc, 'instructorId'>,
  requireGroupApproval: boolean
): boolean {
  if (!canManageCohort(member, cohort)) return false
  if (isAdmin(member)) return true
  // specialist can publish only if approval is not required
  return !requireGroupApproval
}

/** Can submit cohort for admin approval */
export function canSubmitForApproval(
  member: OrgMember,
  cohort: Pick<CohortDoc, 'instructorId'>
): boolean {
  return canManageCohort(member, cohort)
}

/** Can approve a pending_approval cohort */
export function canApproveCohort(member: OrgMember): boolean {
  return isAdmin(member)
}

/** Validate status transition with role context */
export function validateStatusTransition(opts: {
  member: OrgMember
  cohort: Pick<CohortDoc, 'instructorId' | 'status'>
  nextStatus: CohortStatus
  requireGroupApproval: boolean
  reply: FastifyReply
}): boolean {
  const { member, cohort, nextStatus, requireGroupApproval, reply } = opts
  const currentStatus = cohort.status

  if (!isValidTransition(currentStatus, nextStatus)) {
    reply.code(422).send({
      error: `Status transition '${currentStatus}' → '${nextStatus}' is not allowed`,
      code: ERR.INVALID_STATUS_TRANSITION.code,
    })
    return false
  }

  // draft → open: specialist needs approval=off
  if (nextStatus === 'open' && currentStatus === 'draft') {
    if (!canPublishCohort(member, cohort, requireGroupApproval)) {
      reply.code(403).send({
        error: 'Admin approval is required before publishing this group',
        code: ERR.ADMIN_APPROVAL_REQUIRED.code,
      })
      return false
    }
  }

  // pending_approval → open: only admin
  if (nextStatus === 'open' && currentStatus === 'pending_approval') {
    if (!canApproveCohort(member)) {
      reply.code(403).send({
        error: 'Only administrators can approve and publish groups',
        code: ERR.ADMIN_APPROVAL_REQUIRED.code,
      })
      return false
    }
  }

  // pending_approval → draft (reject/withdraw): admin or instructor
  if (nextStatus === 'draft' && currentStatus === 'pending_approval') {
    if (!canManageCohort(member, cohort)) {
      reply.code(403).send({ error: 'Forbidden', code: ERR.FORBIDDEN.code })
      return false
    }
  }

  return true
}

/** Validate that specialist cannot change immutable fields */
export function validateImmutableFields(opts: {
  member: OrgMember
  body: Record<string, unknown>
  reply: FastifyReply
}): boolean {
  const { member, body, reply } = opts

  // Specialist cannot change instructorId or orgId
  if (!isAdmin(member)) {
    if ('instructorId' in body && body.instructorId !== undefined) {
      reply.code(422).send({
        error: 'Specialists cannot change the instructor assignment',
        code: ERR.IMMUTABLE_FIELD.code,
        field: 'instructorId',
      })
      return false
    }
    if ('orgId' in body) {
      reply.code(422).send({
        error: 'Organization cannot be changed',
        code: ERR.IMMUTABLE_FIELD.code,
        field: 'orgId',
      })
      return false
    }
  }

  return true
}

/** Deny access with structured error */
export function denyNotInstructor(reply: FastifyReply): never {
  return reply.code(403).send({
    error: 'You can only manage groups where you are the instructor',
    code: ERR.NOT_GROUP_INSTRUCTOR.code,
  }) as never
}

export function denyForbidden(reply: FastifyReply, message = 'Forbidden'): never {
  return reply.code(403).send({
    error: message,
    code: ERR.FORBIDDEN.code,
  }) as never
}
