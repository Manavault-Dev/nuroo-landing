const INVITE_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export function generateInviteCode(length: number = 8): string {
  let code = ''
  for (let i = 0; i < length; i++) {
    code += INVITE_CODE_CHARS.charAt(Math.floor(Math.random() * INVITE_CODE_CHARS.length))
  }
  return code
}

export function generateParentInviteCode(): string {
  return generateInviteCode(6)
}

export function normalizeInviteCode(code: string): string {
  return code.trim().toUpperCase()
}
