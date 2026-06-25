import { filterManagementPermissions } from '@/lib/admin-permission-routes'

export function normalizeRoleToken(value?: string): string {
  return (value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
}

export function checkHrefPermission(href: string, user: any): boolean {
  if (!user) return false

  // All user paths are accessible to any authenticated user
  if (href.startsWith('/user') || href.startsWith('/candidate-portal')) {
    return true
  }

  const normalizedRole = normalizeRoleToken(user.role)
  const isSuperAdmin =
    normalizedRole === 'super_admin' ||
    (user.userRoles || []).some(
      (code: string) => normalizeRoleToken(code) === 'super_admin',
    )

  if (isSuperAdmin) return true

  const targetPath = href.split('?')[0]

  if (targetPath === '/admin/system-metrics') {
    return false
  }

  // Check role codes for training input
  const roleCodes = (user.userRoles || []).map((code: string) => normalizeRoleToken(code))
  const hasTrainingInputRole = roleCodes.some(
    (code: string) => code === 'hr' || code === 'te' || code === 'tf',
  )
  if (targetPath === '/admin/hr-candidates' && hasTrainingInputRole) {
    return true
  }

  // Base permissions and deal-luong
  const DEAL_LUONG_ROUTES = ['/admin/deal-luong', '/admin/tao-deal-luong']
  const basePermissions = filterManagementPermissions(user.permissions || [])
  const permissions = ['manager', 'admin'].includes(normalizedRole)
    ? Array.from(new Set([...basePermissions, ...DEAL_LUONG_ROUTES]))
    : basePermissions

  const hasPermissionForHref = (h: string) => {
    const t = h.split('?')[0]
    return permissions.some(
      (p) =>
        t === p ||
        t.startsWith(`${p}/`) ||
        p.startsWith(`${t}/`),
    )
  }

  return hasPermissionForHref(href)
}

export function getFilteredAdminMenuItems(adminMenuItems: any[], user: any, pathname: string = ''): any[] {
  if (!user) return []

  const normalizedRole = normalizeRoleToken(user.role)
  const isSuperAdmin =
    normalizedRole === 'super_admin' ||
    (user.userRoles || []).some(
      (code: string) => normalizeRoleToken(code) === 'super_admin',
    )

  if (isSuperAdmin) return adminMenuItems

  const DEAL_LUONG_ROUTES = ['/admin/deal-luong', '/admin/tao-deal-luong']
  const basePermissions = filterManagementPermissions(user.permissions || [])
  const permissions = ['manager', 'admin'].includes(normalizedRole)
    ? Array.from(new Set([...basePermissions, ...DEAL_LUONG_ROUTES]))
    : basePermissions

  const hasAnyK12Access = permissions.some((p) => {
    const normalizedPath = p.split('?')[0]
    return (
      normalizedPath === '/admin/page2' ||
      normalizedPath.startsWith('/admin/page2/')
    )
  })

  const effectivePermissions = hasAnyK12Access
    ? Array.from(
      new Set([...permissions, '/admin/page2', '/admin/page2/manage']),
    )
    : permissions

  const roleCodes = (user.userRoles || []).map((code: string) =>
    normalizeRoleToken(code),
  )
  const hasTrainingInputRole = roleCodes.some(
    (code: string) => code === 'hr' || code === 'te' || code === 'tf',
  )

  if (effectivePermissions.length === 0 && !hasTrainingInputRole) return []

  const hasPermissionForHref = (href: string) => {
    const targetPath = href.split('?')[0]
    return permissions.some(
      (p) =>
        targetPath === p ||
        targetPath.startsWith(`${p}/`) ||
        p.startsWith(`${targetPath}/`),
    )
  }

  const filterMenuItemsByPermissions = (items: any[]): any[] => {
    return items
      .map((item) => {
        const isK12PolicyGroup =
          item?.label === 'Quy Trình, Quy Định K12 Teaching' ||
          item?.groupLabel === 'Quy Trình K12' ||
          item?.label === 'Quy Trình K12'
        if (
          isK12PolicyGroup &&
          (item?.submenu || item?.items)
        ) {
          const canOpenK12Group =
            hasPermissionForHref('/admin/page2') ||
            hasPermissionForHref('/admin/page2/manage') ||
            pathname.startsWith('/admin/page2')

          if (canOpenK12Group) {
            if (item.items) {
              const filteredSubItems = filterMenuItemsByPermissions(item.items)
              if (filteredSubItems.length > 0) {
                return { ...item, items: filteredSubItems }
              }
            } else if (item.submenu) {
              const filteredSubmenu = filterMenuItemsByPermissions(item.submenu)
              if (filteredSubmenu.length > 0) {
                return { ...item, submenu: filteredSubmenu }
              }
            }
          }
          return null
        }

        const isTrainingInputMenu = item?.href === '/admin/hr-candidates'
        if (isTrainingInputMenu && hasTrainingInputRole) {
          return item
        }

        if (item?.href === '/admin/system-metrics') {
          return null
        }

        if (item?.submenu && Array.isArray(item.submenu)) {
          const filteredChildren = filterMenuItemsByPermissions(item.submenu)
          if (filteredChildren.length > 0) {
            return { ...item, submenu: filteredChildren }
          }
          return null
        }

        if (item?.items && Array.isArray(item.items)) {
          const filteredChildren = filterMenuItemsByPermissions(item.items)
          if (filteredChildren.length > 0) {
            return { ...item, items: filteredChildren }
          }
          return null
        }

        if (item?.href) {
          if (hasPermissionForHref(item.href)) {
            return item
          }
          return null
        }

        if (item?.groupLabel) {
          return item
        }

        return null
      })
      .filter(Boolean)
  }

  return filterMenuItemsByPermissions(adminMenuItems)
}
