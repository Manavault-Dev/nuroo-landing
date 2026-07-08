import { describe, expect, it } from 'vitest'
import { isOrgAdminRole } from '@/lib/b2b/roleUtils'

describe('isOrgAdminRole', () => {
  it('treats both admin and org_admin as admin roles', () => {
    expect(isOrgAdminRole('admin')).toBe(true)
    expect(isOrgAdminRole('org_admin')).toBe(true)
  })

  it('keeps specialist and unknown roles as non-admin', () => {
    expect(isOrgAdminRole('specialist')).toBe(false)
    expect(isOrgAdminRole(undefined)).toBe(false)
    expect(isOrgAdminRole(null)).toBe(false)
    expect(isOrgAdminRole('')).toBe(false)
  })
})
