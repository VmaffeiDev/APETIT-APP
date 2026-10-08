import { AdminUser, isPresentationMode } from './api'

export type AdminPermission = 'read' | 'publish_menu' | 'manage_sheets' | 'restore_menu' | 'manage_users'

const ROLE_PERMISSIONS: Record<AdminUser['role'], AdminPermission[]> = {
  admin: ['read', 'publish_menu', 'manage_sheets', 'restore_menu', 'manage_users'],
  operacao: ['read', 'publish_menu', 'restore_menu'],
  nutricao: ['read', 'publish_menu', 'manage_sheets'],
  visualizacao: ['read'],
}

export function hasAdminPermission(user: AdminUser | null, permission: AdminPermission): boolean {
  if (!user) return isPresentationMode
  return ROLE_PERMISSIONS[user.role].includes(permission)
}

export function filterUnitsForUser<T extends { unitId: string }>(units: T[], user: AdminUser | null): T[] {
  if (!user || user.role === 'admin') return units
  const allowed = new Set(user.unit_ids ?? [])
  return units.filter((unit) => allowed.has(unit.unitId))
}

export function requiredPermissionForRoute(hash: string): AdminPermission | null {
  if (hash === 'usuarios' || hash === 'empresas') return 'manage_users'
  if (hash === 'importar-fichas') return 'manage_sheets'
  if (hash === 'cardapios') return 'publish_menu'
  return null
}
