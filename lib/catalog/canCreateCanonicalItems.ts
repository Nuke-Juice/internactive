export function canCreateCanonicalItems(role: string | null | undefined) {
  return role === 'ops_admin' || role === 'super_admin'
}
