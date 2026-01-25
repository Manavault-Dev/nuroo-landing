// Characters that are easy to read and don't confuse (excludes 0, O, I, 1, L)
const INVITE_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

/**
 * Generate a random invite code
 * @param length - Length of the code (default: 8)
 * @returns Random alphanumeric code
 */
export function generateInviteCode(length: number = 8): string {
  let code = ''
  for (let i = 0; i < length; i++) {
    code += INVITE_CODE_CHARS.charAt(Math.floor(Math.random() * INVITE_CODE_CHARS.length))
  }
  return code
}

/**
 * Generate a parent invite code (shorter, 6 characters)
 */
export function generateParentInviteCode(): string {
  return generateInviteCode(6)
}

/**
 * Normalize an invite code (uppercase, trim whitespace)
 */
export function normalizeInviteCode(code: string): string {
  return code.trim().toUpperCase()
}
