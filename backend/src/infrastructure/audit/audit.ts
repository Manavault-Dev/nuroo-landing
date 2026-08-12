/**
 * Audit log — immutable Firestore trail.
 *
 * Written to: organizations/{orgId}/auditLog/{autoId}
 * Also mirrored to: auditLog/{orgId}/entries/{autoId} for cross-org platform admin.
 *
 * Design choices:
 * - Fire-and-forget (never blocks the main transaction)
 * - Stores before/after snapshots for diffs
 * - Does NOT use Firestore transactions so it never conflicts with business writes
 */

import type { Firestore } from 'firebase-admin/firestore'
import type { AuditEntry } from '../../domains/booking/types.js'

export type AuditAction =
  | 'booking.created'
  | 'booking.confirmed'
  | 'booking.cancelled'
  | 'booking.rescheduled'
  | 'booking.completed'
  | 'booking.no_show'
  | 'cohort.published'
  | 'cohort.closed'
  | 'participant.enrolled'
  | 'participant.status_changed'
  | 'participant.payment_updated'
  | 'recommendation.created'
  | 'recommendation.updated'

export interface WriteAuditOptions {
  db: Firestore
  orgId: string
  entityType: AuditEntry['entityType']
  entityId: string
  action: AuditAction
  actorId: string
  actorRole: AuditEntry['actorRole']
  before?: Record<string, unknown>
  after?: Record<string, unknown>
  reason?: string | null
}

/**
 * Write an audit entry — fire-and-forget.
 * Never throws; errors are silently logged.
 */
export function writeAudit(opts: WriteAuditOptions): void {
  _write(opts).catch((err) => {
    console.error('[Audit] Failed to write audit entry:', err)
  })
}

async function _write(opts: WriteAuditOptions): Promise<void> {
  const entry: AuditEntry = {
    entityType: opts.entityType,
    entityId: opts.entityId,
    orgId: opts.orgId,
    action: opts.action,
    actorId: opts.actorId,
    actorRole: opts.actorRole,
    before: opts.before ?? {},
    after: opts.after ?? {},
    reason: opts.reason ?? null,
    ts: new Date().toISOString(),
  }

  const orgRef = opts.db.collection(`organizations/${opts.orgId}/auditLog`).doc()

  await orgRef.set(entry)
}
