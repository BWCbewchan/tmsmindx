const MANAGEMENT_EXCLUDED_ROUTES = new Set(['/checkdatasource', '/user/checkdatasource'])

function normalizeRoutePath(routePath: string): string {
  const [path] = routePath.trim().split('?')
  const normalized = path.replace(/\/+$/, '')
  return normalized || '/'
}

export function isManagementPermissionRoute(routePath: string): boolean {
  return !MANAGEMENT_EXCLUDED_ROUTES.has(normalizeRoutePath(routePath))
}

export function filterManagementPermissions(routePaths: string[]): string[] {
  return routePaths.filter(isManagementPermissionRoute)
}
