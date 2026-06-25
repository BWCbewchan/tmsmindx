export type TeacherSyncState = {
  foundInDatabase: boolean
  dbUnavailable: boolean
}

type AuthenticatedLandingOptions = {
  selectedRole: 'teacher' | 'manager'
  userRole: string
  isAdmin: boolean
  teacherSync?: TeacherSyncState
}

export function resolveAuthenticatedLanding({
  selectedRole,
  userRole,
  isAdmin,
  teacherSync,
}: AuthenticatedLandingOptions): string {
  if (selectedRole === 'manager' && isAdmin) {
    return '/admin/dashboard'
  }

  if (isAdmin || userRole !== 'teacher') {
    return '/user/truyenthong'
  }

  if (teacherSync?.dbUnavailable || teacherSync?.foundInDatabase) {
    return '/user/truyenthong'
  }

  return '/checkdatasource'
}
