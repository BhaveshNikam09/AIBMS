import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Search, Bell, ChevronDown, Building2, MapPin,
  CheckCircle2, LogOut, Settings, User, ExternalLink,
  AlertTriangle, Clock, ArrowDownLeft, ArrowUpRight,
} from 'lucide-react'
import {
  canAccess,
  filterBranchesForRole,
  getStoredRole,
  getBranchScopeLabel,
  isScopedBranchRole,
  normalizeRole,
} from '../utils/rbac'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'
const getBizId = () => localStorage.getItem('business_id') || ''
const getToken = () => localStorage.getItem('access_token') || ''

const authHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${getToken()}`,
})

function getCachedUser() {
  try { return JSON.parse(localStorage.getItem('user') || 'null') } catch { return null }
}

// Notifications now use live payable/receivable data

const breadcrumbMap = {
  '/dashboard': { label: 'Dashboard' },
  '/dashboard/cashbook': { label: 'Digital Cashbook', parent: 'Finance' },
  '/dashboard/ledger': { label: 'Ledger Book', parent: 'Finance' },
  '/dashboard/branches': { label: 'Multi-Branch Management', parent: 'Operations' },
  '/dashboard/documents': { label: 'Document Intelligence', parent: 'Compliance' },
  '/dashboard/chatbot': { label: 'AI Chatbot', parent: 'AI Tools' },
  '/dashboard/reports': { label: 'Reports & Analytics', parent: 'Analytics' },
  '/dashboard/settings': { label: 'Settings', parent: 'System' },
}

function logout() {
  localStorage.clear()
  window.location.href = '/login'
}

function useOutsideClick(ref, handler) {
  useEffect(() => {
    function onDown(e) { if (ref.current && !ref.current.contains(e.target)) handler() }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [ref, handler])
}

const daysUntil = (dateStr) => {
  if (!dateStr) return null
  const d = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((d - today) / (1000 * 60 * 60 * 24))
}

export function Navbar() {
  const location = useLocation()
  const navigate = useNavigate()
  const crumb = breadcrumbMap[location.pathname] || { label: 'Page' }

  const [user, setUser] = useState(getCachedUser)
  const [businesses, setBusinesses] = useState([])
  const [branches, setBranches] = useState([])
  const [activeBizId, setActiveBizId] = useState(getBizId)
  const [activeBranch, setActiveBranch] = useState(
    localStorage.getItem('selected_branch_id') || 'all'
  )

  const [pendingDues, setPendingDues] = useState([])
  const [duesLoading, setDuesLoading] = useState(false)

  const [showBusiness, setShowBusiness] = useState(false)
  const [showBranch, setShowBranch] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showProfile, setShowProfile] = useState(false)

  const bizRef = useRef(null)
  const branchRef = useRef(null)
  const notifRef = useRef(null)
  const profRef = useRef(null)

  useOutsideClick(bizRef, () => setShowBusiness(false))
  useOutsideClick(branchRef, () => setShowBranch(false))
  useOutsideClick(notifRef, () => setShowNotifications(false))
  useOutsideClick(profRef, () => setShowProfile(false))

  // ── Load pending dues for notifications ─────────────────────────
  useEffect(() => {
    const bizId = getBizId()
    if (!bizId || !getToken()) return
    setDuesLoading(true)
    fetch(`${API_BASE}/api/v1/cashbook/${bizId}/entries/pending-dues/`, { headers: authHeaders() })
      .then(r => r.json())
      .then(raw => {
        const d = raw.data || raw
        const list = d.entries || []
        if (list.length === 0) {
          return fetch(`${API_BASE}/api/v1/cashbook/${bizId}/entries/?status=pending&page_size=50`, { headers: authHeaders() })
            .then(r => r.json())
            .then(raw2 => {
              const d2 = raw2.data || raw2
              return (d2.results || (Array.isArray(d2) ? d2 : [])).filter(e => e.status === 'pending')
            })
        }
        return list
      })
      .then(list => setPendingDues(Array.isArray(list) ? list : []))
      .catch(() => { })
      .finally(() => setDuesLoading(false))
  }, [activeBizId])

  const urgentDues = pendingDues.filter(e => {
    const d = daysUntil(e.date)
    return d !== null && d <= 3
  })
  const urgentCount = urgentDues.length

  useEffect(() => {
    if (!getToken()) return
    fetch(`${API_BASE}/api/v1/auth/me/`, { headers: authHeaders() })
      .then(r => r.json())
      .then(raw => {
        const p = raw.data || raw
        if (!p?.email) return
        const bizId = getBizId()
        if (bizId) {
          fetch(`${API_BASE}/api/v1/business/${bizId}/`, { headers: authHeaders() })
            .then(r => r.json())
            .then(biz => {
              const b = biz.data || biz
              const isOwner = b.owner && (
                String(b.owner) === String(p.id) ||
                String(b.owner_id) === String(p.id) ||
                b.owner?.id && String(b.owner.id) === String(p.id)
              )
              const bizRole = isOwner ? 'owner' : (p.role === 'staff' ? 'member' : p.role)
              const updated = { ...(getCachedUser() || {}), ...p, bizRole }
              localStorage.setItem('user', JSON.stringify(updated))
              setUser(updated)
            })
            .catch(() => {
              fetch(`${API_BASE}/api/v1/business/${bizId}/members/`, { headers: authHeaders() })
                .then(r => r.json())
                .then(mem => {
                  const list = mem.data || mem.results || mem || []
                  const me = Array.isArray(list) ? list.find(m =>
                    String(m.user?.id || m.user_id || m.id) === String(p.id) ||
                    String(m.email || m.user?.email) === String(p.email)
                  ) : null
                  const bizRole = me?.role || (p.role === 'staff' ? 'member' : p.role)
                  const updated = { ...(getCachedUser() || {}), ...p, bizRole }
                  localStorage.setItem('user', JSON.stringify(updated))
                  setUser(updated)
                })
                .catch(() => {
                  const updated = { ...(getCachedUser() || {}), ...p }
                  localStorage.setItem('user', JSON.stringify(updated))
                  setUser(updated)
                })
            })
        } else {
          const updated = { ...(getCachedUser() || {}), ...p }
          localStorage.setItem('user', JSON.stringify(updated))
          setUser(updated)
        }
      })
      .catch(() => { })
  }, [])

  useEffect(() => {
    if (!getToken()) return
    fetch(`${API_BASE}/api/v1/business/`, { headers: authHeaders() })
      .then(r => r.json())
      .then(raw => {
        const list = raw.data || raw.results || raw || []
        const arr = Array.isArray(list) ? list : []
        setBusinesses(arr)
        if (!getBizId() && arr.length > 0) {
          localStorage.setItem('business_id', arr[0].id)
          localStorage.setItem('business_name', arr[0].name || '')
          setActiveBizId(arr[0].id)
        }
      })
      .catch(() => { })
  }, [])

  const role = normalizeRole(user?.bizRole || user?.role || getStoredRole())

  useEffect(() => {
    const bizId = getBizId()
    if (!bizId || !getToken()) return
    fetch(`${API_BASE}/api/v1/branches/${bizId}/`, { headers: authHeaders() })
      .then(r => r.json())
      .then(raw => {
        let list = raw.data || raw.results || raw || []
        list = Array.isArray(list) ? list : []
        list = filterBranchesForRole(list, role)
        setBranches(list)
      })
      .catch(() => { })
  }, [activeBizId, role])

  function switchBusiness(biz) {
    localStorage.setItem('business_id', biz.id)
    localStorage.setItem('business_name', biz.name || '')
    setActiveBizId(biz.id)
    setShowBusiness(false)
    window.location.reload()
  }

  function switchBranch(branch) {
    if (branch === 'all') {
      localStorage.removeItem('selected_branch_id')
      localStorage.removeItem('selected_branch_name')
      setActiveBranch('all')
    } else {
      localStorage.setItem('selected_branch_id', branch.id)
      localStorage.setItem('selected_branch_name', branch.name)
      setActiveBranch(branch.id)
    }
    setShowBranch(false)
  }

  const activeBiz = businesses.find(b => b.id === activeBizId)
  const bizName = activeBiz?.name || localStorage.getItem('business_name') || 'Business'

  const curBranch = branches.find(b => b.id === activeBranch)
  const branchName = activeBranch === 'all'
    ? (isScopedBranchRole(role) ? 'Assigned Branches' : 'All Branches')
    : (curBranch?.name || (isScopedBranchRole(role) ? 'Assigned Branches' : localStorage.getItem('selected_branch_name') || 'Branch'))

  const displayName = user?.full_name || user?.first_name || user?.email || 'Loading…'
  const displayRole = 'Owner'
  const initials = displayName !== 'Loading…'
    ? displayName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  return (
    <header className="h-[60px] bg-white border-b border-slate-200 flex items-center justify-between px-6 flex-shrink-0 sticky top-0 z-30">

      <div className="flex flex-col justify-center">
        {crumb.parent
          ? <p className="text-[11px] text-slate-400 leading-none mb-0.5">{crumb.parent} › {crumb.label}</p>
          : <p className="text-[11px] text-slate-400 leading-none mb-0.5">AI-BMS</p>
        }
        <p className="text-sm font-semibold text-slate-800 leading-tight">{crumb.label}</p>
      </div>

      <div className="flex-1 max-w-sm mx-8">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
          <input
            type="text"
            placeholder="Search transactions, clients, reports…"
            className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 placeholder:text-slate-400"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">

        <div className="relative" ref={bizRef}>
          <button
            onClick={() => {
              setShowBusiness(!showBusiness)
              setShowBranch(false); setShowNotifications(false); setShowProfile(false)
            }}
            className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Building2 size={15} className="text-slate-500" />
            <span className="text-sm font-medium text-slate-700 max-w-[110px] truncate">{bizName}</span>
            <ChevronDown size={14} className="text-slate-400" />
          </button>
          {showBusiness && (
            <div className="absolute right-0 top-full mt-1.5 w-64 bg-white rounded-xl shadow-lg border border-slate-200 z-50 py-1.5 overflow-hidden">
              <p className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Switch Business</p>
              {businesses.length === 0 && (
                <p className="px-3 py-2.5 text-xs text-slate-400 italic">No businesses found.</p>
              )}
              {businesses.map(biz => (
                <button
                  key={biz.id}
                  onClick={() => switchBusiness(biz)}
                  className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left"
                >
                  <div>
                    <p className="font-medium">{biz.name}</p>
                    {biz.gstin && <p className="text-[11px] text-slate-400 mt-0.5">GSTIN: {biz.gstin}</p>}
                  </div>
                  {biz.id === activeBizId && <CheckCircle2 size={14} className="text-blue-600 flex-shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative" ref={branchRef}>
          <button
            onClick={() => {
              setShowBranch(!showBranch)
              setShowBusiness(false); setShowNotifications(false); setShowProfile(false)
            }}
            className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <MapPin size={15} className="text-slate-500" />
            <span className="text-sm font-medium text-slate-700 max-w-[110px] truncate">{branchName}</span>
            <ChevronDown size={14} className="text-slate-400" />
          </button>
          {showBranch && (
            <div className="absolute right-0 top-full mt-1.5 w-52 bg-white rounded-xl shadow-lg border border-slate-200 z-50 py-1.5">
              <p className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Select Branch</p>
              <button
                onClick={() => switchBranch('all')}
                className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                <span className="font-medium">All Branches</span>
                {activeBranch === 'all' && <CheckCircle2 size={14} className="text-blue-600" />}
              </button>
              {branches.length === 0 && (
                <p className="px-3 py-2 text-xs text-slate-400 italic">No branches found.</p>
              )}
              {branches.map(branch => (
                <button
                  key={branch.id}
                  onClick={() => switchBranch(branch)}
                  className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <div className="text-left">
                    <p className="font-medium">{branch.name}</p>
                    {(branch.city || branch.code) && (
                      <p className="text-[11px] text-slate-400">{branch.city || branch.code}</p>
                    )}
                  </div>
                  {activeBranch === branch.id && <CheckCircle2 size={14} className="text-blue-600 flex-shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="w-px h-5 bg-slate-200 mx-1" />

        <div className="relative" ref={notifRef}>
          <button
            onClick={() => {
              setShowNotifications(!showNotifications)
              setShowBusiness(false); setShowBranch(false); setShowProfile(false)
            }}
            className="relative p-2 hover:bg-slate-50 rounded-lg transition-colors"
          >
            <Bell size={18} className="text-slate-600" />
            {urgentCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                <span className="text-[9px] font-bold text-white leading-none">
                  {urgentCount > 9 ? '9+' : urgentCount}
                </span>
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 top-full mt-1.5 w-80 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden">

              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div>
                  <p className="text-sm font-semibold text-slate-800">Payment Reminders</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {duesLoading ? 'Loading…' : pendingDues.length === 0
                      ? 'No pending dues'
                      : `${urgentCount} urgent · ${pendingDues.length} total pending`
                    }
                  </p>
                </div>
                <button
                  onClick={() => { navigate(canAccess('ledger', role) ? '/dashboard/ledger' : '/dashboard/cashbook'); setShowNotifications(false) }}
                  className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
                >
                  View all <ExternalLink size={11} />
                </button>
              </div>

              <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-100">
                {duesLoading ? (
                  <div className="flex items-center justify-center py-8 gap-2 text-slate-400">
                    <div className="w-4 h-4 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
                    <p className="text-xs">Loading…</p>
                  </div>
                ) : pendingDues.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-2 text-slate-400">
                    <CheckCircle2 size={24} className="text-emerald-400" />
                    <p className="text-sm font-medium text-slate-500">No pending dues</p>
                    <p className="text-xs">All payments are up to date 🎉</p>
                  </div>
                ) : (
                  pendingDues.slice(0, 12).map((entry, i) => {
                    const isRcv = entry.type === 'credit'
                    const days = daysUntil(entry.date)
                    const isOvd = days !== null && days < 0
                    const isToday = days === 0
                    const amount = parseFloat(entry.amount || 0)
                    return (
                      <div
                        key={entry.id || i}
                        onClick={() => { navigate('/dashboard/ledger'); setShowNotifications(false) }}
                        className="flex gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors"
                      >
                        <div className={`mt-0.5 flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${isOvd ? 'bg-red-100' : isToday ? 'bg-amber-100' : isRcv ? 'bg-emerald-50' : 'bg-blue-50'
                          }`}>
                          {isOvd
                            ? <AlertTriangle size={13} className="text-red-600" />
                            : isToday
                              ? <AlertTriangle size={13} className="text-amber-600" />
                              : isRcv
                                ? <ArrowDownLeft size={13} className="text-emerald-600" />
                                : <ArrowUpRight size={13} className="text-blue-600" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium text-slate-800 leading-snug truncate">
                              {entry.party_name || entry.description || (isRcv ? 'Receivable' : 'Payable')}
                            </p>
                            <span className={`text-[11px] font-bold flex-shrink-0 ${isRcv ? 'text-emerald-600' : 'text-red-500'}`}>
                              {isRcv ? '+' : '-'}₹{Math.round(amount).toLocaleString('en-IN')}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${isRcv ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
                              }`}>
                              {isRcv ? 'Receivable' : 'Payable'}
                            </span>
                            <p className={`text-[11px] font-semibold ${isOvd ? 'text-red-600' : isToday ? 'text-amber-600' : 'text-slate-400'
                              }`}>
                              {isOvd ? `Overdue ${Math.abs(days)}d` : isToday ? '⚠ Due today' : days !== null ? `Due in ${days}d` : 'Pending'}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {pendingDues.length > 0 && (
                <div className="px-4 py-3 border-t border-slate-100 bg-slate-50">
                  <button
                    onClick={() => { navigate(canAccess('ledger', role) ? '/dashboard/ledger' : '/dashboard/cashbook'); setShowNotifications(false) }}
                    className="w-full py-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded-lg transition-colors"
                  >
                    {canAccess('ledger', role) ? 'Manage payables & receivables in Ledger Book →' : 'Manage payables & receivables in Cashbook →'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Profile ─────────────────────────────────────────────────────── */}
        <div className="relative" ref={profRef}>
          <button
            onClick={() => {
              setShowProfile(!showProfile)
              setShowBusiness(false); setShowBranch(false); setShowNotifications(false)
            }}
            className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 hover:bg-slate-50 rounded-lg transition-colors"
          >
            <div className="w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0">
              {initials}
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-slate-800 leading-tight">{displayName}</p>
              <p className="text-[11px] text-slate-400 leading-tight capitalize">{displayRole}</p>
            </div>
            <ChevronDown size={14} className="text-slate-400" />
          </button>

          {showProfile && (
            <div className="absolute right-0 top-full mt-1.5 w-52 bg-white rounded-xl shadow-lg border border-slate-200 z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-sm font-semibold text-slate-800 truncate">{displayName}</p>
                <p className="text-xs text-slate-400 truncate">{user?.email || '—'}</p>
              </div>
              {canAccess('settings', role) && (
                <>
                  <button
                    onClick={() => { window.location.href = '/dashboard/settings'; setShowProfile(false) }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <User size={14} className="text-slate-400" /> Profile &amp; Settings
                  </button>
                  <button
                    onClick={() => { window.location.href = '/dashboard/settings'; setShowProfile(false) }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <Settings size={14} className="text-slate-400" /> Settings
                  </button>
                </>
              )}
              <div className="border-t border-slate-100">
                <button
                  onClick={logout}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut size={14} /> Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
