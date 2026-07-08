export function isOrgAdminRole(role: string | null | undefined): boolean {
  if (!role) return false
  return role === 'admin' || role === 'org_admin'
}
