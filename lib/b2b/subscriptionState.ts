/**
 * Centralized subscription state utility.
 *
 * Pure functions — no browser/React deps — fully testable in Vitest.
 *
 * All UI components and layout guards consume this. Do NOT duplicate
 * subscription logic elsewhere.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type RawBillingStatus =
  | 'trialing'
  | 'active'
  | 'manual_active'
  | 'past_due'
  | 'expired'
  | 'cancelled'
  | 'canceled'
  | 'suspended'
  | null
  | undefined

export type SubscriptionBannerType = 'trial_active' | 'trial_expiring' | 'past_due' | 'none'

export type SubscriptionBlockType = 'expired' | 'suspended' | 'none'

export interface SubscriptionState {
  /** Normalised status string (never null) */
  status: 'active' | 'trial' | 'trial_expiring' | 'expired' | 'past_due' | 'suspended' | 'unknown'

  isTrial: boolean
  isActive: boolean
  /** Trial ends within 7 days */
  isExpiringSoon: boolean
  isExpired: boolean
  isPastDue: boolean
  isSuspended: boolean

  /** Full workspace access */
  canAccessWorkspace: boolean
  /** Always true — billing/settings/support are never blocked */
  canAccessBilling: boolean

  /** Calendar days until trial/subscription ends. null when unknown or not applicable. */
  daysRemaining: number | null

  bannerType: SubscriptionBannerType
  blockType: SubscriptionBlockType

  /** Human-readable message for the banner or paywall */
  message: string
  ctaLabel: string
  ctaHref: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TRIAL_WARNING_DAYS = 7

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Days remaining until expiresAt. Returns null if date is invalid or missing. */
export function calcDaysRemaining(expiresAt: string | null | undefined): number | null {
  if (!expiresAt) return null
  const ms = new Date(expiresAt).getTime()
  if (Number.isNaN(ms)) return null
  const diff = ms - Date.now()
  if (diff <= 0) return 0
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

// ── Core ──────────────────────────────────────────────────────────────────────

/**
 * Compute the full subscription state from raw API billing fields.
 *
 * @param billingStatus   - The raw status string from the backend
 * @param expiresAt       - ISO date string for trial or subscription expiry
 * @param active          - Whether the backend considers the sub active
 */
export function getSubscriptionState(
  billingStatus: RawBillingStatus,
  expiresAt: string | null | undefined,
  active: boolean
): SubscriptionState {
  const days = calcDaysRemaining(expiresAt)

  // ── Suspended ─────────────────────────────────────────────────────────────
  if (billingStatus === 'suspended') {
    return {
      status: 'suspended',
      isTrial: false,
      isActive: false,
      isExpiringSoon: false,
      isExpired: false,
      isPastDue: false,
      isSuspended: true,
      canAccessWorkspace: false,
      canAccessBilling: true,
      daysRemaining: null,
      bannerType: 'none',
      blockType: 'suspended',
      message:
        'Your workspace has been suspended. Your data is safe. Contact support to restore access.',
      ctaLabel: 'Contact Support',
      ctaHref: 'mailto:support@nuroo.io',
    }
  }

  // ── Past due ──────────────────────────────────────────────────────────────
  if (billingStatus === 'past_due') {
    return {
      status: 'past_due',
      isTrial: false,
      isActive: true, // grace period — full access with warning
      isExpiringSoon: false,
      isExpired: false,
      isPastDue: true,
      isSuspended: false,
      canAccessWorkspace: true,
      canAccessBilling: true,
      daysRemaining: null,
      bannerType: 'past_due',
      blockType: 'none',
      message:
        'There is an issue with your payment. Please update your billing details to avoid interruption.',
      ctaLabel: 'Update Billing',
      ctaHref: 'billing',
    }
  }

  // ── Trialing ──────────────────────────────────────────────────────────────
  if (billingStatus === 'trialing') {
    if (active && days !== null && days > 0) {
      const expiringSoon = days <= TRIAL_WARNING_DAYS
      return {
        status: expiringSoon ? 'trial_expiring' : 'trial',
        isTrial: true,
        isActive: true,
        isExpiringSoon: expiringSoon,
        isExpired: false,
        isPastDue: false,
        isSuspended: false,
        canAccessWorkspace: true,
        canAccessBilling: true,
        daysRemaining: days,
        bannerType: expiringSoon ? 'trial_expiring' : 'trial_active',
        blockType: 'none',
        message: expiringSoon
          ? `Your free trial ends in ${days} day${days === 1 ? '' : 's'}. Choose a plan to keep your workspace.`
          : `You are on a free trial. ${days} day${days === 1 ? '' : 's'} remaining.`,
        ctaLabel: 'Choose Plan',
        ctaHref: 'billing',
      }
    }
    // Trial date missing but backend says active — treat as active trial
    if (active && days === null) {
      return {
        status: 'trial',
        isTrial: true,
        isActive: true,
        isExpiringSoon: false,
        isExpired: false,
        isPastDue: false,
        isSuspended: false,
        canAccessWorkspace: true,
        canAccessBilling: true,
        daysRemaining: null,
        bannerType: 'trial_active',
        blockType: 'none',
        message: 'You are on a free trial.',
        ctaLabel: 'Choose Plan',
        ctaHref: 'billing',
      }
    }
    // Trial has ended
    return {
      status: 'expired',
      isTrial: true,
      isActive: false,
      isExpiringSoon: false,
      isExpired: true,
      isPastDue: false,
      isSuspended: false,
      canAccessWorkspace: false,
      canAccessBilling: true,
      daysRemaining: 0,
      bannerType: 'none',
      blockType: 'expired',
      message:
        'Your free trial has ended. Your data is safe — choose a plan to continue using Nuroo.',
      ctaLabel: 'Choose Plan',
      ctaHref: 'billing',
    }
  }

  // ── Active / manual_active ─────────────────────────────────────────────────
  if (
    billingStatus === 'active' ||
    billingStatus === 'manual_active' ||
    (active && (billingStatus === null || billingStatus === undefined))
  ) {
    return {
      status: 'active',
      isTrial: false,
      isActive: true,
      isExpiringSoon: false,
      isExpired: false,
      isPastDue: false,
      isSuspended: false,
      canAccessWorkspace: true,
      canAccessBilling: true,
      daysRemaining: days,
      bannerType: 'none',
      blockType: 'none',
      message: '',
      ctaLabel: 'Manage Billing',
      ctaHref: 'billing',
    }
  }

  // ── Cancelled / expired ────────────────────────────────────────────────────
  if (
    billingStatus === 'expired' ||
    billingStatus === 'cancelled' ||
    billingStatus === 'canceled' ||
    !active
  ) {
    return {
      status: 'expired',
      isTrial: false,
      isActive: false,
      isExpiringSoon: false,
      isExpired: true,
      isPastDue: false,
      isSuspended: false,
      canAccessWorkspace: false,
      canAccessBilling: true,
      daysRemaining: 0,
      bannerType: 'none',
      blockType: 'expired',
      message:
        'Your subscription has ended. Your data is safe — choose a plan to continue using Nuroo.',
      ctaLabel: 'Choose Plan',
      ctaHref: 'billing',
    }
  }

  // ── Safe fallback (unknown / no billing field) ────────────────────────────
  return {
    status: 'unknown',
    isTrial: false,
    isActive: false,
    isExpiringSoon: false,
    isExpired: false,
    isPastDue: false,
    isSuspended: false,
    canAccessWorkspace: false,
    canAccessBilling: true,
    daysRemaining: null,
    bannerType: 'none',
    blockType: 'expired',
    message: 'No active subscription found. Choose a plan to get started.',
    ctaLabel: 'Choose Plan',
    ctaHref: 'billing',
  }
}
