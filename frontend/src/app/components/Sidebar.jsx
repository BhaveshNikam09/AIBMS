import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, BookOpen, GitBranch, FileBarChart2,
  FolderSearch, BarChart3, Settings,
  ChevronLeft, ChevronRight, Cpu, LogOut, ClipboardList,
} from 'lucide-react'
import { canAccess, getStoredRole } from '../utils/rbac'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'
const getToken = () => localStorage.getItem('access_token') || ''
const authHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${getToken()}`,
})

function getCachedUser() {
  try {
    const raw = localStorage.getItem('user')
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

// ── Role-based nav (AI Chatbot removed — now a floating button on Dashboard) ─
const ALL_NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, to: '/dashboard', roles: ['owner', 'manager', 'accountant', 'staff'] },
  { id: 'cashbook', label: 'Digital Cashbook', icon: BookOpen, to: '/dashboard/cashbook', roles: ['owner', 'manager', 'accountant', 'staff'] },
  { id: 'ledger', label: 'Ledger Book', icon: ClipboardList, to: '/dashboard/ledger', roles: ['owner', 'manager', 'accountant', 'staff'] },
  { id: 'branches', label: 'Multi-Branch', icon: GitBranch, to: '/dashboard/branches', roles: ['owner', 'manager'] },
  { id: 'documents', label: 'Document Intelligence', icon: FolderSearch, to: '/dashboard/documents', roles: ['owner', 'manager', 'accountant'] },
  { id: 'reports', label: 'Reports & Analytics', icon: BarChart3, to: '/dashboard/reports', roles: ['owner', 'manager', 'accountant'] },
]
const ALL_BOTTOM = [
  { id: 'settings', label: 'Settings', icon: Settings, to: '/dashboard/settings', roles: ['owner'] },
]

function getNavItems(role) {
  return ALL_NAV.filter(item => canAccess(item.id, role))
}
function getBottomItems(role) {
  return ALL_BOTTOM.filter(item => canAccess(item.id, role))
}

function logout() {
  localStorage.clear()
  window.location.href = '/login'
}

export function Sidebar({ collapsed, onToggle }) {
  const [user, setUser] = useState(getCachedUser)

  useEffect(() => {
    if (!getToken()) return
    fetch(`${API_BASE}/api/v1/auth/me/`, { headers: authHeaders() })
      .then(r => r.json())
      .then(raw => {
        const p = raw.data || raw
        if (!p?.email) return

        // business_role is the scoped role set by the backend (owner / manager / accountant / staff)
        // Never fall back to the system-level p.role — that could be 'business_owner' which
        // would bypass the manager restriction check in getNavItems / canAccess.
        const bizRole = p.business_role || 'staff'

        const updated = { ...(getCachedUser() || {}), ...p, bizRole }
        localStorage.setItem('user', JSON.stringify(updated))
        setUser(updated)
      })
      .catch(() => { })
  }, [])

  const displayName = user?.full_name || user?.first_name || user?.email || 'Loading…'
  const rawRole = (user?.bizRole || user?.role || '').toLowerCase()
  const displayRole = rawRole
    ? rawRole.charAt(0).toUpperCase() + rawRole.slice(1)
    : '…'
  const initials = displayName !== 'Loading…'
    ? displayName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  return (
    <div className={`h-screen bg-slate-900 text-white flex flex-col flex-shrink-0 transition-all duration-300 ease-in-out ${collapsed ? 'w-[64px]' : 'w-[240px]'}`}>

      {/* Logo */}
      <div className="h-[60px] flex items-center justify-between px-4 border-b border-slate-800 flex-shrink-0">
        {!collapsed && (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 bg-blue-600 rounded-md flex items-center justify-center flex-shrink-0">
              <Cpu size={15} className="text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white tracking-tight leading-none">AI-BMS</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Business Management</p>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="w-7 h-7 bg-blue-600 rounded-md flex items-center justify-center mx-auto">
            <Cpu size={15} className="text-white" />
          </div>
        )}
        {!collapsed && (
          <button onClick={onToggle} className="p-1 hover:bg-slate-800 rounded-md transition-colors flex-shrink-0 ml-2">
            <ChevronLeft size={16} className="text-slate-400" />
          </button>
        )}
      </div>

      {collapsed && (
        <button onClick={onToggle} className="mx-auto mt-2 p-1.5 hover:bg-slate-800 rounded-md transition-colors">
          <ChevronRight size={16} className="text-slate-400" />
        </button>
      )}

      {/* Nav */}
      <nav className="flex-1 py-4 overflow-y-auto overflow-x-hidden">
        {!collapsed && (
          <p className="px-4 mb-2 text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Navigation</p>
        )}
        <ul className="flex flex-col gap-0.5 px-2">
          {getNavItems(user?.bizRole || user?.role || getStoredRole()).map(item => {
            const Icon = item.icon
            return (
              <li key={item.id}>
                <NavLink
                  to={item.to}
                  end={item.to === '/dashboard'}
                  className={({ isActive }) =>
                    `group w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors relative ${isActive ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                    }`
                  }
                  title={collapsed ? item.label : undefined}
                >
                  {({ isActive }) => (
                    <>
                      {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-blue-500 rounded-r" />}
                      <Icon size={18} className={`flex-shrink-0 ${isActive ? 'text-blue-400' : ''}`} strokeWidth={isActive ? 2.5 : 1.8} />
                      {!collapsed && <span className="text-sm font-medium truncate">{item.label}</span>}
                    </>
                  )}
                </NavLink>
              </li>
            )
          })}
        </ul>

        <div className="mt-4 pt-4 border-t border-slate-800">
          <ul className="flex flex-col gap-0.5 px-2">
            {getBottomItems(user?.bizRole || user?.role || getStoredRole()).map(item => {
              const Icon = item.icon
              return (
                <li key={item.id}>
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      `group w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors relative ${isActive ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                      }`
                    }
                    title={collapsed ? item.label : undefined}
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-blue-500 rounded-r" />}
                        <Icon size={18} className={`flex-shrink-0 ${isActive ? 'text-blue-400' : ''}`} strokeWidth={isActive ? 2.5 : 1.8} />
                        {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
                      </>
                    )}
                  </NavLink>
                </li>
              )
            })}
          </ul>
        </div>
      </nav>

      {/* User Footer */}
      <div className="p-3 border-t border-slate-800 flex-shrink-0">
        {!collapsed ? (
          <div className="flex items-center gap-3 px-1 group">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{displayName}</p>
              <p className="text-[11px] text-slate-400 truncate capitalize">{displayRole}</p>
            </div>
            <button
              onClick={logout}
              title="Logout"
              className="p-1.5 rounded-md hover:bg-red-600/20 transition-colors opacity-0 group-hover:opacity-100"
            >
              <LogOut size={14} className="text-slate-400 hover:text-red-400" />
            </button>
          </div>
        ) : (
          <div
            onClick={logout}
            title="Click to logout"
            className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-xs font-bold mx-auto cursor-pointer hover:bg-blue-700 transition-colors"
          >
            {initials}
          </div>
        )}
      </div>
    </div>
  )
}
