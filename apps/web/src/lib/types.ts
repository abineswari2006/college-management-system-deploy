export interface Membership {
  collegeId: string
  collegeName: string
  roleCode: string
  roleName: string
}

export interface SessionUser {
  id: string
  email: string
  fullName: string
}

export interface SessionData {
  user: SessionUser
  memberships: Membership[]
  isSuperAdmin: boolean
  college: { id: string; name: string } | null
  role: { code: string; name: string }
  permissions: string[]
}

export interface College {
  id: string
  name: string
  code: string
  status: 'active' | 'deactivated'
  timezone: string
  locale: string
  currency: string
  createdAt: string
  updatedAt: string
}

export interface ManagedUser {
  id: string
  email: string
  fullName: string
  status: 'invited' | 'active' | 'deactivated'
  role: { code: string; name: string }
  college: { id: string; name: string } | null
  createdAt: string
  lastLoginAt: string | null
}

export interface PageResult<T> {
  data: T[]
  pagination: { page: number; limit: number; total: number }
}