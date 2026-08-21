/**
 * Legal consent types for Nuroo platform.
 *
 * Architecture:
 *   ConsentRecord stored in Firestore: users/{uid}/consents/{consentId}
 *   LegalDocument config is static (versioned in code) — no DB needed until docs are finalized
 */

/** Supported consent types */
export type ConsentType =
  | 'PUBLIC_OFFER'
  | 'PRIVACY_POLICY'
  | 'LEGAL_REPRESENTATIVE'
  | 'MARKETING_COMMUNICATIONS'
  | 'ANONYMIZED_ANALYTICS'
  | 'SPECIALIST_CHILD_PROFILE_ACCESS'
  | 'MEDIA_MARKETING_USAGE'

/** Required consents — blocking registration/onboarding */
export const REQUIRED_CONSENT_TYPES: ConsentType[] = ['PUBLIC_OFFER', 'PRIVACY_POLICY']

/** Optional consents — never block registration */
export const OPTIONAL_CONSENT_TYPES: ConsentType[] = [
  'MARKETING_COMMUNICATIONS',
  'ANONYMIZED_ANALYTICS',
  'SPECIALIST_CHILD_PROFILE_ACCESS',
  'MEDIA_MARKETING_USAGE',
]

/** Child data consent — required before creating a child profile */
export const CHILD_DATA_CONSENT_TYPES: ConsentType[] = ['LEGAL_REPRESENTATIVE']

/** Supported platforms for audit trail */
export type ConsentPlatform = 'web' | 'ios' | 'android'

/** A single consent record — one per user per consent type per version */
export interface ConsentRecord {
  id: string
  userId: string
  consentType: ConsentType
  documentVersion: string
  accepted: boolean
  acceptedAt: string | null // ISO timestamp (server-set)
  withdrawnAt: string | null // ISO timestamp when withdrawn
  platform: ConsentPlatform
  userAgent?: string
  locale: string
  metadata?: Record<string, string>
  createdAt: string // ISO timestamp
  updatedAt: string // ISO timestamp
}

/** Current legal document metadata (static config — updated when docs change) */
export interface LegalDocumentMeta {
  type: ConsentType
  version: string
  effectiveAt: string // ISO date
  titleRu: string
  requiresReacceptance: boolean // true = users with old version must re-accept
  path: string // frontend route, e.g. /legal/terms
}

/**
 * Current active document versions.
 * NOTE: Update version + requiresReacceptance when legal docs change.
 * IMPORTANT: Placeholders in actual docs not yet filled — version is DRAFT.
 */
export const LEGAL_DOCUMENTS: Record<string, LegalDocumentMeta> = {
  PUBLIC_OFFER: {
    type: 'PUBLIC_OFFER',
    version: '1.0',
    effectiveAt: '2026-01-01',
    titleRu: 'Публичная оферта',
    requiresReacceptance: false,
    path: '/legal/terms',
  },
  PRIVACY_POLICY: {
    type: 'PRIVACY_POLICY',
    version: '1.0',
    effectiveAt: '2026-01-01',
    titleRu: 'Политика конфиденциальности',
    requiresReacceptance: false,
    path: '/legal/privacy',
  },
  LEGAL_REPRESENTATIVE: {
    type: 'LEGAL_REPRESENTATIVE',
    version: '1.0',
    effectiveAt: '2026-01-01',
    titleRu: 'Согласие законного представителя',
    requiresReacceptance: false,
    path: '/legal/parental-consent',
  },
}

export function getCurrentDocumentVersion(type: ConsentType): string {
  return LEGAL_DOCUMENTS[type]?.version ?? '1.0-draft'
}
