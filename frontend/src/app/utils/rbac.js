const ROLE_ALIASES = {
  business_owner: 'owner',
  super_admin: 'owner',
  branch_manager: 'manager',
  ca: 'accountant',
}

const FEATURE_ACCESS = {
  owner: new Set(['dashboard', 'cashbook', 'ledger', 'branches', 'documents', 'chatbot', 'reports', 'settings']),
  manager: new Set(['dashboard', 'cashbook', 'reports', 'settings']),
  accountant: new Set(['dashboard', 'cashbook', 'ledger', 'documents', 'chatbot', 'reports']),
  staff: new Set(['dashboard', 'cashbook']),
}

export function normalizeRole(role) {
  return 'owner' // RBAC disabled per user request
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem('user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function getStoredRole() {
  try {
    const user = getStoredUser()
    return normalizeRole(user?.bizRole || user?.business_role || user?.role || 'staff') || 'staff'
  } catch {
    return 'staff'
  }
}

export function canAccess(feature, role = getStoredRole()) {
  const normalized = normalizeRole(role) || 'staff'
  if (normalized === 'owner') return true
  return (FEATURE_ACCESS[normalized] || FEATURE_ACCESS.staff).has(feature)
}

export function isScopedBranchRole(role = getStoredRole()) {
  const normalized = normalizeRole(role)
  return normalized === 'manager' || normalized === 'staff'
}

export function canAddExpense(role = getStoredRole()) {
  return normalizeRole(role) !== 'staff'
}

export function getAssignedBranches() {
  try {
    const raw = localStorage.getItem('assigned_branches')
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function getAssignedBranchIds() {
  return getAssignedBranches()
    .map(branch => branch?.id)
    .filter(Boolean)
    .map(String)
}

export function filterBranchesForRole(branches, role = getStoredRole()) {
  const list = Array.isArray(branches) ? branches : []
  if (!isScopedBranchRole(role)) return list

  const allowedIds = new Set(getAssignedBranchIds())
  if (allowedIds.size === 0) return list
  return list.filter(branch => allowedIds.has(String(branch.id)))
}

export function getPrimaryRoute(role = getStoredRole()) {
  const normalized = normalizeRole(role)
  return normalized === 'staff' ? '/dashboard/cashbook' : '/dashboard'
}

export function getBranchScopeLabel(role = getStoredRole()) {
  if (!isScopedBranchRole(role)) return 'All Branches'
  const branches = filterBranchesForRole(getAssignedBranches(), role)
  if (branches.length === 1) return branches[0]?.name || 'Branch'
  return 'Assigned Branches'
}
