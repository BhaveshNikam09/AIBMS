import { useState, useEffect } from 'react'
import {
  User, Building2, Bell, Shield, Users,
  ChevronRight, Loader2, Check, AlertCircle,
  Plus, Eye, EyeOff, Copy, KeyRound, X,
} from 'lucide-react'
import { getAssignedBranchIds, getStoredRole, normalizeRole } from '../utils/rbac'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'
const getBizId = () => localStorage.getItem('business_id') || ''
const getToken = () => localStorage.getItem('access_token') || ''
const authHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${getToken()}`,
})

const ALL_SECTIONS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'business', label: 'Business Info', icon: Building2 },
  // { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'security', label: 'Security', icon: Shield },
  // { id: 'team',          label: 'Team Management',  icon: Users     },
]

// ── Maps any role value (from DB or API) to a human-readable label ─────────
// DB stores 'branch_manager', frontend sends/shows 'manager' — handle both.
const ROLE_LABEL = {
  'staff': 'Staff',
  'manager': 'Manager',
  'branch_manager': 'Manager',   // ← DB value → same display label
  'accountant': 'Accountant',
  'ca': 'CA / Consultant',
  'business_owner': 'Owner',
  'owner': 'Owner',
}

function roleLabel(role) {
  return ROLE_LABEL[role] || (role ? role.charAt(0).toUpperCase() + role.slice(1) : '—')
}

// ── Role badge color ──────────────────────────────────────────────────────
function RoleBadge({ role }) {
  const label = roleLabel(role)
  const color =
    role === 'business_owner' || role === 'owner'
      ? 'bg-blue-50 text-blue-700'
      : role === 'branch_manager' || role === 'manager'
        ? 'bg-purple-50 text-purple-700'
        : role === 'accountant'
          ? 'bg-amber-50 text-amber-700'
          : role === 'ca'
            ? 'bg-teal-50 text-teal-700'
            : 'bg-slate-100 text-slate-600'
  return (
    <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${color}`}>
      {label}
    </span>
  )
}

// ── Reusable field ────────────────────────────────────────────────────────────
function Field({ label, value, onChange, type = 'text', disabled = false }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 mb-1.5">{label}</label>
      <input
        type={type}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className={`w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all ${disabled ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : ''
          }`}
      />
    </div>
  )
}

// ── Save bar ──────────────────────────────────────────────────────────────────
function SaveBar({ saving, saved, error, onSave }) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/60">
      <div>
        {error && (
          <p className="text-xs text-red-500 flex items-center gap-1.5">
            <AlertCircle size={12} /> {error}
          </p>
        )}
        {saved && !error && (
          <p className="text-xs text-emerald-600 flex items-center gap-1.5">
            <Check size={12} /> Changes saved
          </p>
        )}
      </div>
      <button
        onClick={onSave}
        disabled={saving}
        className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors"
      >
        {saving ? <><Loader2 size={13} className="animate-spin" /> Saving…</> : 'Save Changes'}
      </button>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function Settings() {
  const [activeSection, setActiveSection] = useState('profile')

  // Profile
  const [profile, setProfile] = useState({})
  const [savingP, setSavingP] = useState(false)
  const [savedP, setSavedP] = useState(false)
  const [errorP, setErrorP] = useState('')

  // Business
  const [business, setBusiness] = useState({})
  const [savingB, setSavingB] = useState(false)
  const [savedB, setSavedB] = useState(false)
  const [errorB, setErrorB] = useState('')

  // Team
  const [members, setMembers] = useState([])
  const [branches, setBranches] = useState([])
  const [createForm, setCreateForm] = useState({ full_name: '', email: '', password: '', role: 'staff', branch_id: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [createSuccess, setCreateSuccess] = useState(null)
  const [loadingM, setLoadingM] = useState(false)
  // Invite (keep existing invite flow)
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'manager', branch_id: '' })
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState(false)

  // Security
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' })
  const [savingSec, setSavingSec] = useState(false)
  const [savedSec, setSavedSec] = useState(false)
  const [errorSec, setErrorSec] = useState('')

  // Notifications
  const [notifPrefs, setNotifPrefs] = useState({ email_alerts: true, sms_alerts: false, compliance_reminders: true })
  const [savingN, setSavingN] = useState(false)
  const [savedN, setSavedN] = useState(false)

  const currentRole = normalizeRole(profile.bizRole || profile.role || getStoredRole() || 'staff')
  const isOwner = currentRole === 'owner'
  const isManager = currentRole === 'manager'
  const canEditTeam = isOwner
  const visibleSections = isOwner
    ? ALL_SECTIONS
    : isManager
      ? ALL_SECTIONS.filter(section => section.id === 'team')
      : ALL_SECTIONS.filter(section => ['profile', 'security'].includes(section.id))

  useEffect(() => {
    if (!visibleSections.some(section => section.id === activeSection)) {
      setActiveSection(visibleSections[0]?.id || 'profile')
    }
  }, [activeSection, visibleSections])

  // ── Load profile ─────────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${API_BASE}/api/v1/auth/me/`, { headers: authHeaders() })
      .then(r => r.json())
      .then(raw => {
        const p = raw.data || raw
        p.bizRole = normalizeRole(p.business_role || p.bizRole || p.role || 'staff')
        p.is_owner = p.bizRole === 'owner'
        setProfile(p)
      })
      .catch(() => { })
  }, [])

  // ── Load business ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!getBizId()) return
    fetch(`${API_BASE}/api/v1/business/${getBizId()}/`, { headers: authHeaders() })
      .then(r => r.json())
      .then(data => setBusiness(data.data || data))
      .catch(() => {
        fetch(`${API_BASE}/api/v1/business/my/`, { headers: authHeaders() })
          .then(r => r.json())
          .then(data => {
            const biz = (data.data || data.results || data)[0]
            if (biz) setBusiness(biz)
          })
          .catch(() => { })
      })
  }, [])

  // ── Load members + branches when team tab active ─────────────────────────
  useEffect(() => {
    if (activeSection !== 'team' || !getBizId()) return
    setLoadingM(true)
    fetch(`${API_BASE}/api/v1/business/${getBizId()}/members/`, { headers: authHeaders() })
      .then(r => r.json())
      .then(data => {
        const list = data.data || data.results || data || []
        const rows = Array.isArray(list) ? list : []
        if (isManager) {
          const allowed = new Set(getAssignedBranchIds())
          setMembers(
            allowed.size > 0
              ? rows.filter(m => allowed.has(String(m.branch?.id || m.branch_id || m.branch?.branch_id || '')))
              : []
          )
        } else {
          setMembers(rows)
        }
      })
      .catch(() => { })
      .finally(() => setLoadingM(false))

    if (canEditTeam) {
      fetch(`${API_BASE}/api/v1/branches/${getBizId()}/`, { headers: authHeaders() })
        .then(r => r.json())
        .then(data => {
          const list = data.data || data.results || data || []
          setBranches(Array.isArray(list) ? list : [])
        })
        .catch(() => { })
    }
  }, [activeSection])

  // ── Save profile ──────────────────────────────────────────────────────────
  async function saveProfile() {
    setSavingP(true); setErrorP(''); setSavedP(false)
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/profile/`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          full_name: profile.full_name || profile.first_name || '',
          phone: profile.phone || '',
        }),
      })
      if (!res.ok) throw new Error()
      setSavedP(true)
      setTimeout(() => setSavedP(false), 3000)
    } catch {
      setErrorP('Failed to save. Please try again.')
    } finally {
      setSavingP(false)
    }
  }

  // ── Save business ─────────────────────────────────────────────────────────
  async function saveBusiness() {
    if (!getBizId()) return
    setSavingB(true); setErrorB(''); setSavedB(false)
    try {
      const res = await fetch(`${API_BASE}/api/v1/business/${getBizId()}/`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({
          name: business.name || '',
          gstin: business.gstin || '',
          pan: business.pan || '',
          city: business.city || '',
        }),
      })
      if (!res.ok) throw new Error()
      setSavedB(true)
      setTimeout(() => setSavedB(false), 3000)
    } catch {
      setErrorB('Failed to save. Please try again.')
    } finally {
      setSavingB(false)
    }
  }

  // ── Change password ───────────────────────────────────────────────────────
  async function savePassword() {
    if (pwForm.newPw !== pwForm.confirm) { setErrorSec('New passwords do not match.'); return }
    if (pwForm.newPw.length < 8) { setErrorSec('Password must be at least 8 characters.'); return }
    setSavingSec(true); setErrorSec(''); setSavedSec(false)
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/change-password/`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          old_password: pwForm.current,
          new_password: pwForm.newPw,
          confirm_password: pwForm.confirm,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        const firstError = data.errors && Object.values(data.errors)[0]
        throw new Error(
          data.message ||
          (Array.isArray(firstError) ? firstError[0] : firstError) ||
          data.detail ||
          'Failed to change password.'
        )
      }
      setSavedSec(true)
      setPwForm({ current: '', newPw: '', confirm: '' })
      setTimeout(() => setSavedSec(false), 3000)
    } catch (e) {
      setErrorSec(e.message || 'Failed to change password.')
    } finally {
      setSavingSec(false)
    }
  }

  // ── Save notifications ────────────────────────────────────────────────────
  async function saveNotifications() {
    setSavingN(true)
    try {
      await fetch(`${API_BASE}/api/v1/auth/profile/`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ notification_preferences: notifPrefs }),
      })
      setSavedN(true)
      setTimeout(() => setSavedN(false), 3000)
    } catch { }
    finally { setSavingN(false) }
  }

  const setP = key => val => setProfile(p => ({ ...p, [key]: val }))
  const setB = key => val => setBusiness(b => ({ ...b, [key]: val }))

  // ── Invite existing member ────────────────────────────────────────────────
  async function inviteMember() {
    if (!inviteForm.email.trim()) { setInviteError('Email is required.'); return }
    if (!inviteForm.email.includes('@')) { setInviteError('Enter a valid email.'); return }
    setInviting(true); setInviteError(''); setInviteSuccess(false)
    try {
      const res = await fetch(`${API_BASE}/api/v1/business/${getBizId()}/members/`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          email: inviteForm.email,
          ...(inviteForm.branch_id ? { branch_id: inviteForm.branch_id } : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || data.detail || 'Failed to invite member.')
      setInviteSuccess(true)
      setInviteForm({ email: '', role: 'manager', branch_id: '' })
      fetch(`${API_BASE}/api/v1/business/${getBizId()}/members/`, { headers: authHeaders() })
        .then(r => r.json())
        .then(d => setMembers(Array.isArray(d.data || d.results || d) ? (d.data || d.results || d) : []))
        .catch(() => { })
      setTimeout(() => setInviteSuccess(false), 4000)
    } catch (e) {
      setInviteError(e.message || 'Failed to send invite.')
    } finally {
      setInviting(false)
    }
  }

  // ── Create new team member account ────────────────────────────────────────
  // Sends: role = 'staff' | 'manager' | 'accountant'
  // Backend maps 'manager' → 'branch_manager' (MemberRole value) internally.
  async function createMember() {
    const { full_name, email, password, role, branch_id } = createForm
    if (!full_name.trim()) { setCreateError('Full name is required.'); return }
    if (!email.trim() || !email.includes('@')) { setCreateError('Valid email is required.'); return }
    if (!password || password.length < 6) { setCreateError('Password must be at least 6 characters.'); return }

    setCreating(true); setCreateError(''); setCreateSuccess(null)
    try {
      const res = await fetch(`${API_BASE}/api/v1/business/${getBizId()}/members/create/`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          full_name: full_name.trim(),
          email: email.trim().toLowerCase(),
          password,
          role,                                   // 'staff' | 'manager' | 'accountant'
          ...(branch_id ? { branch_id } : {}),    // omit if empty
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        // Surface the exact backend message so the user sees what went wrong
        throw new Error(data.message || data.detail || JSON.stringify(data.errors || data) || 'Failed to create account.')
      }

      setCreateSuccess({
        full_name: full_name.trim(),
        email: email.trim().toLowerCase(),
        password,
        role,                                     // keep the friendly label ('manager' not 'branch_manager')
      })
      setCreateForm({ full_name: '', email: '', password: '', role: 'staff', branch_id: '' })

      // Refresh members list
      fetch(`${API_BASE}/api/v1/business/${getBizId()}/members/`, { headers: authHeaders() })
        .then(r => r.json())
        .then(d => {
          const list = d.data || d.results || d
          setMembers(Array.isArray(list) ? list : [])
        })
        .catch(() => { })
    } catch (e) {
      setCreateError(e.message || 'Failed to create account.')
    } finally {
      setCreating(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-[1200px] mx-auto">

      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-400 mt-0.5">Manage your account, business, and preferences</p>
      </div>

      <div className="grid grid-cols-12 gap-5">

        {/* ── Left Nav ──────────────────────────────────────────────── */}
        <div className="col-span-3">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            {visibleSections.map(s => {
              const Icon = s.icon
              return (
                <button
                  key={s.id}
                  onClick={() => setActiveSection(s.id)}
                  className={`w-full flex items-center justify-between px-4 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors ${activeSection === s.id ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon size={15} className={activeSection === s.id ? 'text-blue-600' : 'text-slate-400'} />
                    <span className={`text-sm font-medium ${activeSection === s.id ? 'text-blue-700' : 'text-slate-700'}`}>
                      {s.label}
                    </span>
                  </div>
                  <ChevronRight size={14} className="text-slate-300" />
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Right Panel ───────────────────────────────────────────── */}
        <div className="col-span-9">

          {/* Profile */}
          {activeSection === 'profile' && (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h2 className="text-sm font-semibold text-slate-900">Profile Information</h2>
              </div>
              <div className="p-6 grid grid-cols-2 gap-4">
                <Field label="Full Name" value={profile.full_name} onChange={setP('full_name')} />
                <Field label="Email" value={profile.email} onChange={setP('email')} disabled />
                <Field label="Phone" value={profile.phone} onChange={setP('phone')} type="tel" />

              </div>
              <SaveBar saving={savingP} saved={savedP} error={errorP} onSave={saveProfile} />
            </div>
          )}

          {/* Business */}
          {activeSection === 'business' && (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h2 className="text-sm font-semibold text-slate-900">Business Information</h2>
              </div>
              <div className="p-6 grid grid-cols-2 gap-4">
                <Field label="Business Name" value={business.name} onChange={setB('name')} />
                <Field label="GSTIN" value={business.gstin} onChange={setB('gstin')} />
                <Field label="PAN" value={business.pan} onChange={setB('pan')} />
                <Field label="City" value={business.city} onChange={setB('city')} />
                <Field label="State" value={business.state} onChange={setB('state')} />
                <Field label="Business Type" value={business.business_type} onChange={setB('business_type')} />
              </div>
              <SaveBar saving={savingB} saved={savedB} error={errorB} onSave={saveBusiness} />
            </div>
          )}

          {/* Notifications */}
          {activeSection === 'notifications' && (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h2 className="text-sm font-semibold text-slate-900">Notification Preferences</h2>
              </div>
              <div className="p-6 flex flex-col gap-4">
                {[
                  { key: 'email_alerts', label: 'Email Alerts', desc: 'Receive financial alerts via email' },
                  { key: 'sms_alerts', label: 'SMS Alerts', desc: 'Receive critical alerts via SMS' },
                  { key: 'compliance_reminders', label: 'Compliance Reminders', desc: 'GST, TDS, and ITR filing reminders' },
                ].map(n => (
                  <div key={n.key} className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{n.label}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{n.desc}</p>
                    </div>
                    <button
                      onClick={() => setNotifPrefs(p => ({ ...p, [n.key]: !p[n.key] }))}
                      className={`relative w-10 h-5 rounded-full transition-colors ${notifPrefs[n.key] ? 'bg-blue-600' : 'bg-slate-200'}`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${notifPrefs[n.key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                ))}
              </div>
              <SaveBar saving={savingN} saved={savedN} error="" onSave={saveNotifications} />
            </div>
          )}

          {/* Security */}
          {activeSection === 'security' && (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h2 className="text-sm font-semibold text-slate-900">Change Password</h2>
              </div>
              <div className="p-6 flex flex-col gap-4 max-w-sm">
                <Field label="Current Password" value={pwForm.current} onChange={v => setPwForm(f => ({ ...f, current: v }))} type="password" />
                <Field label="New Password" value={pwForm.newPw} onChange={v => setPwForm(f => ({ ...f, newPw: v }))} type="password" />
                <Field label="Confirm Password" value={pwForm.confirm} onChange={v => setPwForm(f => ({ ...f, confirm: v }))} type="password" />
              </div>
              <SaveBar saving={savingSec} saved={savedSec} error={errorSec} onSave={savePassword} />
            </div>
          )}

          {/* Team */}
          {activeSection === 'team' && (
            <div className="space-y-5">

              {/* Create Account form */}
              {canEditTeam && (
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-9 h-9 bg-slate-900 rounded-xl flex items-center justify-center">
                      <Plus size={16} className="text-white" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-slate-900">Create Team Account</h2>
                      <p className="text-xs text-slate-400 mt-0.5">Set login credentials — share with your staff or manager</p>
                    </div>
                  </div>

                  {/* Success card */}
                  {createSuccess && (
                    <div className="mb-5 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-bold text-emerald-800">✅ Account created for {createSuccess.full_name}</p>
                          <p className="text-xs text-emerald-700 mt-1">Share these login details securely:</p>
                          <div className="mt-2 space-y-1 font-mono text-xs bg-white border border-emerald-200 rounded-lg p-3">
                            <p><span className="text-slate-500">Email: </span><span className="font-semibold text-slate-800">{createSuccess.email}</span></p>
                            <p><span className="text-slate-500">Password: </span><span className="font-semibold text-slate-800">{createSuccess.password}</span></p>
                            <p><span className="text-slate-500">Role: </span><span className="font-semibold text-slate-800">{roleLabel(createSuccess.role)}</span></p>
                          </div>
                          <p className="text-[11px] text-emerald-600 mt-2">They can change their password after first login via Settings → Security.</p>
                        </div>
                        <button onClick={() => setCreateSuccess(null)} className="p-1 hover:bg-emerald-100 rounded-lg">
                          <X size={14} className="text-emerald-600" />
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1.5">Full Name *</label>
                      <input
                        value={createForm.full_name}
                        onChange={e => setCreateForm(f => ({ ...f, full_name: e.target.value }))}
                        placeholder="e.g. Ravi Kumar"
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1.5">Email Address *</label>
                      <input
                        type="email"
                        value={createForm.email}
                        onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))}
                        placeholder="ravi@example.com"
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1.5">Temporary Password *</label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={createForm.password}
                          onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))}
                          placeholder="Min 6 characters"
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 pr-9 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                        />
                        <button
                          onClick={() => setShowPassword(p => !p)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">They'll use this to login and can change it later</p>
                    </div>

                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                        Assign to Branch <span className="font-normal text-slate-400">(optional — they'll only see this branch's cashbook)</span>
                      </label>
                      <select
                        value={createForm.branch_id}
                        onChange={e => setCreateForm(f => ({ ...f, branch_id: e.target.value }))}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      >
                        <option value="">— No specific branch (Head Office) —</option>
                        {branches.map(b => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {createError && (
                    <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-3">⚠️ {createError}</p>
                  )}

                  <button
                    onClick={createMember}
                    disabled={creating}
                    className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
                  >
                    {creating ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
                    {creating ? 'Creating Account…' : 'Create Account & Set Password'}
                  </button>
                </div>
              )}

              {/* Members table */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-900">Team Management</h2>
                  <span className="text-xs text-slate-400">{members.length} member{members.length !== 1 ? 's' : ''}</span>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-5 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Member</th>
                      <th className="px-5 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Branch</th>
                      <th className="px-5 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingM && (
                      <tr>
                        <td colSpan={4} className="py-12 text-center">
                          <Loader2 size={20} className="animate-spin text-slate-300 mx-auto" />
                        </td>
                      </tr>
                    )}
                    {!loadingM && members.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-10 text-center text-sm text-slate-400">No team members found.</td>
                      </tr>
                    )}
                    {!loadingM && members.map(m => (
                      <tr key={m.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-xs font-semibold text-slate-600">
                              {(m.user?.full_name?.[0] || m.user?.name?.[0] || m.email?.[0] || '?').toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-800">
                                {m.user?.full_name || m.user?.name || m.email || '—'}
                              </p>
                              <p className="text-xs text-slate-400">{m.user?.email || m.email || '—'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <span className="text-sm text-slate-600">
                            {m.branch?.name || m.branch_name || '—'}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span className={`px-2 py-0.5 text-xs rounded-md font-medium ${m.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-500'
                            }`}>
                            {m.status || 'active'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </div>
          )}

        </div>
      </div>
    </div>
  )
}
