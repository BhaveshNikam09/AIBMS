import { useState, useEffect, useRef } from 'react'
import {
  MapPin, TrendingUp, TrendingDown, Users, Plus, Loader2,
  Building2, ChevronRight, ExternalLink, X, Check,
  Phone, Mail, Search, Filter, MoreVertical, Edit2,
  ToggleLeft, ToggleRight, Star, Zap, Clock, Hash,
  AlertCircle, CheckCircle, Activity, ArrowUpRight,
  ArrowDownRight, Shield, Eye, Ban, Trash2, RefreshCw,
  Navigation, Layers, BarChart2, Calendar,
} from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'
const getBizId = () => localStorage.getItem('business_id') || ''
const getToken = () => localStorage.getItem('access_token') || ''
const authHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${getToken()}`,
})

const fmt = n => {
  if (!n && n !== 0) return '—'
  if (Math.abs(n) >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`
  if (Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(1)}L`
  if (Math.abs(n) >= 1000) return `₹${(n / 1000).toFixed(1)}K`
  return `₹${n}`
}

const BRANCH_TYPE_META = {
  head_office: { label: 'Head Office', icon: '🏛️', color: 'bg-violet-100 text-violet-700 border-violet-200' },
  branch: { label: 'Branch', icon: '🏢', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  warehouse: { label: 'Warehouse', icon: '🏭', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  // outlet: { label: 'Outlet', icon: '🏪', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  // franchise: { label: 'Franchise', icon: '🤝', color: 'bg-rose-100 text-rose-700 border-rose-200' },
}

const ROLE_PERMISSIONS = {
  owner: {
    label: '👑 Owner', color: 'bg-purple-100 text-purple-700 border-purple-200',
    dot: 'bg-purple-500',
    note: 'Full access to everything — transactions, team, branches, compliance.',
    permissions: [
      { label: 'View Full Dashboard', allowed: true },
      { label: 'View & Export Reports', allowed: true },
      { label: 'Add Income (Credit)', allowed: true },
      { label: 'Add Expenses (Debit)', allowed: true },
      { label: 'Approve Payments', allowed: true },
      // { label: 'Manage Team Members', allowed: true },
      { label: 'Manage Branches', allowed: true },
      { label: 'View & Upload Docs', allowed: true },
      { label: 'AI  Chatbot', allowed: true },
    ],
  },
  manager: {
    label: '🏢 Manager', color: 'bg-blue-100 text-blue-700 border-blue-200',
    dot: 'bg-blue-500',
    note: 'Full financial access including approvals. Cannot manage team or branch settings.',
    permissions: [
      { label: 'View Full Dashboard', allowed: true },
      { label: 'View & Export Reports', allowed: true },
      { label: 'Add Income (Credit)', allowed: true },
      { label: 'Add Expenses (Debit)', allowed: true },
      { label: 'Approve Payments', allowed: true },
      // { label: 'Manage Team Members', allowed: false },
      { label: 'Manage Branches', allowed: false },
      { label: 'View & Upload Docs', allowed: true },
      { label: 'AI Chatbot', allowed: true },
    ],
  },
  staff: {
    label: '👤 Staff', color: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
    note: 'Can only add income entries. Best for frontline sales staff.',
    permissions: [
      { label: 'View Full Dashboard', allowed: false },
      { label: 'View & Export Reports', allowed: false },
      { label: 'Add Income (Credit)', allowed: true },
      { label: 'Add Expenses (Debit)', allowed: false },
      { label: 'Approve Payments', allowed: false },
      // { label: 'Manage Team Members', allowed: false },
      { label: 'Manage Branches', allowed: false },
      { label: 'View & Upload Docs', allowed: false },
      { label: 'AI Chatbot', allowed: true },
    ],
  },
}

// ── Utility: compute branch health score 0–100 ──────────────────────────────
function computeHealth(branch) {
  let score = 0
  if (branch.name) score += 20
  if (branch.city) score += 15
  if (branch.phone || branch.email) score += 15
  if (branch.manager_name) score += 20
  if ((branch.income || 0) > 0) score += 15
  if (branch.member_count > 0) score += 15
  return Math.min(score, 100)
}

function healthColor(score) {
  if (score >= 80) return { bar: 'bg-emerald-500', text: 'text-emerald-600', label: 'Excellent' }
  if (score >= 60) return { bar: 'bg-blue-500', text: 'text-blue-600', label: 'Good' }
  if (score >= 40) return { bar: 'bg-amber-400', text: 'text-amber-600', label: 'Fair' }
  return { bar: 'bg-red-400', text: 'text-red-500', label: 'Needs attention' }
}

// ── Detect same-city branches and return disambiguation label ───────────────
function buildCityGroups(branches) {
  const cityMap = {}
  branches.forEach(b => {
    const city = (b.city || '').trim().toLowerCase()
    if (!city) return
    if (!cityMap[city]) cityMap[city] = []
    cityMap[city].push(b.id)
  })
  // Cities with more than one branch
  const duplicateCities = new Set(
    Object.entries(cityMap).filter(([, ids]) => ids.length > 1).map(([city]) => city)
  )
  return duplicateCities
}

// ── Suggest a locality label from the branch name ───────────────────────────
function getLocalityHint(branchName, city) {
  if (!branchName || !city) return null
  // Try to extract anything after the city name in the branch name
  const cleaned = branchName.replace(new RegExp(city, 'gi'), '').replace(/branch|office|outlet/gi, '').trim()
  return cleaned.length > 1 ? cleaned : null
}

// ─────────────────────────────────────────────────────────────────────────────
// ADD / EDIT BRANCH MODAL
// ─────────────────────────────────────────────────────────────────────────────
function BranchModal({ branch, existingBranches, onClose, onSaved }) {
  const isEdit = !!branch

  const [form, setForm] = useState({
    name: branch?.name || '',
    code: branch?.code || '',
    city: branch?.city || '',
    state: branch?.state || '',
    address_line1: branch?.address_line1 || '',
    pincode: branch?.pincode || '',
    phone: branch?.phone || '',
    email: branch?.email || '',
    branch_type: branch?.branch_type || 'branch',
    is_primary: branch?.is_primary || false,
    locality: '',  // extra UI-only field for same-city disambiguation
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState(1) // 1=basic, 2=contact/address

  // Same-city check (reactive on city change)
  const sameCity = existingBranches.filter(
    b => b.city && b.city.trim().toLowerCase() === form.city.trim().toLowerCase() && b.id !== branch?.id
  )
  const showLocalityHint = sameCity.length > 0

  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  // Auto-suggest branch name from city + locality
  function applyLocality() {
    if (!form.locality.trim()) return
    const suggested = `${form.city} ${form.locality} ${BRANCH_TYPE_META[form.branch_type]?.label || 'Branch'}`.trim()
    setForm(p => ({ ...p, name: suggested }))
  }

  async function submit() {
    if (!form.name.trim()) { setError('Branch name is required.'); return }
    setSaving(true); setError('')
    try {
      const payload = {
        name: form.name.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        address_line1: form.address_line1.trim(),
        pincode: form.pincode.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        branch_type: form.branch_type,
        is_primary: form.is_primary,
      }
      if (form.code.trim()) payload.code = form.code.trim().toUpperCase()

      const url = isEdit
        ? `${API_BASE}/api/v1/branches/${getBizId()}/${branch.id}/`
        : `${API_BASE}/api/v1/branches/${getBizId()}/`
      const method = isEdit ? 'PATCH' : 'POST'

      const res = await fetch(url, { method, headers: authHeaders(), body: JSON.stringify(payload) })
      const data = await res.json()
      if (!res.ok) {
        const msg = data.message || data.detail ||
          (data.errors ? Object.entries(data.errors).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' | ') : `Error ${res.status}`)
        throw new Error(msg)
      }
      onSaved()
      onClose()
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  const inputCls = 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:bg-white focus:border-slate-400 transition-all'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900">{isEdit ? 'Edit Branch' : 'Add New Branch'}</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {step === 1 ? 'Basic information' : 'Contact & address details'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Step pills */}
            <div className="flex gap-1.5">
              {[1, 2].map(s => (
                <div key={s} className={`w-6 h-1.5 rounded-full transition-colors ${step >= s ? 'bg-slate-900' : 'bg-slate-200'}`} />
              ))}
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg">
              <X size={15} className="text-slate-500" />
            </button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">

          {step === 1 && (
            <>
              {/* Branch type */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-2">Branch Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(BRANCH_TYPE_META).map(([val, meta]) => (
                    <button
                      key={val} type="button"
                      onClick={() => setForm(p => ({ ...p, branch_type: val }))}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-semibold transition-all ${form.branch_type === val
                        ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
                        }`}
                    >
                      <span>{meta.icon}</span> {meta.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Name + Code */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Branch Name *</label>
                  <input value={form.name} onChange={set('name')} placeholder="e.g. Nashikroad Branch"
                    className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Code</label>
                  <input value={form.code} onChange={set('code')} placeholder="NSK-01"
                    className={inputCls} style={{ textTransform: 'uppercase' }} />
                </div>
              </div>

              {/* City + State */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">City</label>
                  <input value={form.city} onChange={set('city')} placeholder="e.g. Nashik"
                    className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">State</label>
                  <input value={form.state} onChange={set('state')} placeholder="Maharashtra"
                    className={inputCls} />
                </div>
              </div>

              {/* Same-city disambiguation panel */}
              {showLocalityHint && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs font-bold text-amber-800 mb-1">
                        {sameCity.length} branch{sameCity.length > 1 ? 'es' : ''} already in {form.city}
                      </p>
                      <p className="text-[11px] text-amber-700 mb-2">
                        Existing: {sameCity.map(b => b.name).join(', ')}
                      </p>
                      <p className="text-[11px] text-amber-600 mb-2">
                        Add a locality name to auto-generate a unique branch name:
                      </p>
                      <div className="flex gap-2">
                        <input
                          value={form.locality} onChange={set('locality')}
                          placeholder="e.g. Karvenagar, Old Nashik, Satpur"
                          className="flex-1 px-2.5 py-1.5 text-xs border border-amber-300 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400/30"
                        />
                        <button
                          type="button" onClick={applyLocality}
                          disabled={!form.locality.trim()}
                          className="px-3 py-1.5 text-xs font-semibold bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-40 transition-colors"
                        >
                          Apply
                        </button>
                      </div>
                      {/* Quick suggestions */}
                      <div className="flex gap-1.5 mt-2 flex-wrap">
                        {['Karvenagar', 'Old City', 'MIDC', 'Civil Lines', 'Camp', 'Cantonment'].map(s => (
                          <button key={s} type="button"
                            onClick={() => setForm(p => ({ ...p, locality: s }))}
                            className="px-2 py-0.5 text-[10px] bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-md font-medium transition-colors">
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Primary toggle */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <p className="text-sm font-semibold text-slate-700">Set as Primary Branch</p>
                  <p className="text-xs text-slate-400 mt-0.5">Primary branch appears first across all reports</p>
                </div>
                <button
                  type="button"
                  onClick={() => setForm(p => ({ ...p, is_primary: !p.is_primary }))}
                  className={`relative w-10 h-5 rounded-full transition-colors ${form.is_primary ? 'bg-slate-900' : 'bg-slate-300'}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.is_primary ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Address</label>
                <input value={form.address_line1} onChange={set('address_line1')}
                  placeholder="Street / building / locality"
                  className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Pincode</label>
                  <input value={form.pincode} onChange={set('pincode')} placeholder="422001"
                    maxLength={6} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Branch Phone</label>
                  <input value={form.phone} onChange={set('phone')} placeholder="+91 98765 43210"
                    className={inputCls} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Branch Email</label>
                <input type="email" value={form.email} onChange={set('email')}
                  placeholder="nashikroad@yourbiz.com"
                  className={inputCls} />
              </div>

              {/* Preview card */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Preview</p>
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-sm flex-shrink-0">
                    {BRANCH_TYPE_META[form.branch_type]?.icon || '🏢'}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{form.name || 'Branch Name'}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {[form.address_line1, form.city, form.state, form.pincode].filter(Boolean).join(', ') || 'No address set'}
                    </p>
                    {(form.phone || form.email) && (
                      <p className="text-xs text-slate-400 mt-1">{form.phone || form.email}</p>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg flex items-center gap-2">
              <AlertCircle size={13} /> {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-slate-100">
          <button onClick={step === 1 ? onClose : () => setStep(1)}
            className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
            {step === 1 ? 'Cancel' : '← Back'}
          </button>
          {step === 1 ? (
            <button onClick={() => { if (!form.name.trim()) { setError('Branch name is required.'); return } setError(''); setStep(2) }}
              className="flex-1 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors">
              Continue →
            </button>
          ) : (
            <button onClick={submit} disabled={saving}
              className="flex-1 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
              {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : <><Check size={14} /> {isEdit ? 'Save Changes' : 'Create Branch'}</>}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// BRANCH DETAIL DRAWER
// ─────────────────────────────────────────────────────────────────────────────
function BranchDrawer({ branch, onClose, onEdit, onToggleActive }) {
  const health = computeHealth(branch)
  const hc = healthColor(health)
  const type = BRANCH_TYPE_META[branch.branch_type] || BRANCH_TYPE_META.branch
  const net = (branch.income || 0) - (branch.expense || 0)

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={onClose}>
      <div
        className="w-full max-w-sm h-full bg-white shadow-2xl overflow-y-auto"
        onClick={e => e.stopPropagation()}
        style={{ animation: 'slideInRight 0.22s ease' }}
      >
        {/* Header */}
        <div className="bg-slate-900 px-5 pt-5 pb-6 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, #6366f1 0%, transparent 60%)' }} />
          <div className="flex items-start justify-between relative">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-xl">
                {type.icon}
              </div>
              <div>
                <h3 className="text-sm font-bold text-white leading-tight">{branch.name}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{branch.code || 'No code'}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
              <X size={15} className="text-white" />
            </button>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 mt-5">
            {[
              { label: 'Income', value: fmt(branch.income || 0), color: 'text-emerald-400' },
              { label: 'Expense', value: fmt(branch.expense || 0), color: 'text-red-400' },
              { label: 'Net', value: fmt(net), color: net >= 0 ? 'text-emerald-400' : 'text-red-400' },
            ].map(s => (
              <div key={s.label} className="bg-white/5 rounded-lg p-2.5 text-center">
                <p className="text-[10px] text-slate-400 mb-1">{s.label}</p>
                <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="p-5 space-y-5">

          {/* Health score */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Activity size={12} /> Profile Completeness
              </p>
              <span className={`text-xs font-bold ${hc.text}`}>{health}% · {hc.label}</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-700 ${hc.bar}`} style={{ width: `${health}%` }} />
            </div>
            {health < 80 && (
              <p className="text-[11px] text-slate-400 mt-1.5">
                💡 Add {!branch.manager_name ? 'a manager, ' : ''}{!branch.email ? 'email, ' : ''}{!branch.phone ? 'phone' : ''} to improve your profile score.
              </p>
            )}
          </div>

          {/* Details */}
          <div className="space-y-2.5">
            {[
              { icon: <MapPin size={13} />, label: 'Location', value: [branch.city, branch.state].filter(Boolean).join(', ') || '—' },
              { icon: <Navigation size={13} />, label: 'Address', value: branch.address_line1 || '—' },
              { icon: <Hash size={13} />, label: 'Pincode', value: branch.pincode || '—' },
              { icon: <Phone size={13} />, label: 'Phone', value: branch.phone || '—' },
              { icon: <Mail size={13} />, label: 'Email', value: branch.email || '—' },
              { icon: <Users size={13} />, label: 'Staff', value: `${branch.member_count || 0} members` },
              { icon: <Shield size={13} />, label: 'Manager', value: branch.manager_name || '— Not assigned' },
            ].map(d => (
              <div key={d.label} className="flex items-start gap-3 py-2 border-b border-slate-50 last:border-0">
                <div className="w-6 h-6 bg-slate-100 rounded-md flex items-center justify-center text-slate-400 flex-shrink-0 mt-0.5">
                  {d.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{d.label}</p>
                  <p className="text-sm text-slate-700 truncate">{d.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Status + type badges */}
          <div className="flex gap-2 flex-wrap">
            <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${type.color}`}>
              {type.icon} {type.label}
            </span>
            {branch.is_primary && (
              <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-violet-100 text-violet-700 border border-violet-200 flex items-center gap-1">
                <Star size={11} /> Primary
              </span>
            )}
            <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${branch.is_active !== false ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-red-100 text-red-600 border border-red-200'}`}>
              {branch.is_active !== false ? '● Active' : '● Inactive'}
            </span>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-2 pt-2">
            {/* <button
              onClick={() => { window.location.href = '/dashboard/cashbook' }}
              className={`flex items-center justify-center gap-1.5 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 transition-colors ${branch.isHO ? 'col-span-2' : ''}`}
            >
              <BarChart2 size={13} /> View Cashbook
            </button> */}
            {!branch.isHO && (
              <button
                onClick={onEdit}
                className="flex items-center justify-center gap-1.5 py-2.5 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-50 transition-colors"
              >
                <Edit2 size={13} /> Edit Details
              </button>
            )}
            {!branch.isHO && (
              <button
                onClick={onToggleActive}
                className={`flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold rounded-xl border transition-colors col-span-2 ${branch.is_active !== false
                  ? 'border-red-200 text-red-600 hover:bg-red-50'
                  : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                  }`}
              >
                {branch.is_active !== false ? <><Ban size={13} /> Deactivate Branch</> : <><CheckCircle size={13} /> Activate Branch</>}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// BRANCH CARD
// ─────────────────────────────────────────────────────────────────────────────
function BranchCard({ branch, duplicateCities, onClick, onEdit }) {
  const health = computeHealth(branch)
  const hc = healthColor(health)
  const type = BRANCH_TYPE_META[branch.branch_type] || BRANCH_TYPE_META.branch
  const net = (branch.income || 0) - (branch.expense || 0)
  const cityLower = (branch.city || '').trim().toLowerCase()
  const isSameCity = duplicateCities.has(cityLower) && cityLower

  // Derive locality label from branch name
  const localityHint = isSameCity ? getLocalityHint(branch.name, branch.city) : null

  return (
    <div
      onClick={onClick}
      className={`bg-white border rounded-2xl overflow-hidden cursor-pointer group transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 ${branch.is_active === false ? 'opacity-50 grayscale' : 'border-slate-200 hover:border-slate-300'
        } ${branch.is_primary ? 'ring-2 ring-violet-200' : ''}`}
    >
      {/* Top accent strip */}
      <div className={`h-1 w-full ${hc.bar}`} />

      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start gap-3 mb-3.5">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${type.color.replace('text-', 'bg-').split(' ')[0]} bg-opacity-20`}
            style={{ background: 'transparent' }}>
            <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center">{type.icon}</div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-sm font-bold text-slate-900 truncate">{branch.name}</p>
              {branch.is_primary && <Star size={11} className="text-violet-500 flex-shrink-0" />}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {branch.city && (
                <span className="flex items-center gap-1 text-[11px] text-slate-400">
                  <MapPin size={10} /> {branch.city}
                  {/* Same-city locality badge */}
                  {isSameCity && localityHint && (
                    <span className="ml-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-md text-[9px] font-bold border border-amber-200">
                      {localityHint}
                    </span>
                  )}
                  {isSameCity && !localityHint && (
                    <span className="ml-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-md text-[9px] font-bold border border-amber-200 flex items-center gap-0.5">
                      <AlertCircle size={8} /> Same city
                    </span>
                  )}
                </span>
              )}
              {branch.code && <span className="text-[10px] text-slate-300 font-mono">{branch.code}</span>}
            </div>
          </div>
          <button
            onClick={e => { e.stopPropagation(); onEdit() }}
            className="p-1.5 text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
          >
            <Edit2 size={12} />
          </button>
        </div>

        {/* Financial stats */}
        <div className="grid grid-cols-3 gap-1.5 mb-3.5">
          <div className="bg-emerald-50 rounded-lg p-2 text-center">
            <p className="text-[9px] text-emerald-600 font-semibold uppercase mb-0.5">Income</p>
            <p className="text-xs font-bold text-emerald-700">{fmt(branch.income || 0)}</p>
          </div>
          <div className="bg-red-50 rounded-lg p-2 text-center">
            <p className="text-[9px] text-red-500 font-semibold uppercase mb-0.5">Expense</p>
            <p className="text-xs font-bold text-red-600">{fmt(branch.expense || 0)}</p>
          </div>
          <div className={`rounded-lg p-2 text-center ${net >= 0 ? 'bg-slate-900' : 'bg-red-900'}`}>
            <p className="text-[9px] text-slate-400 font-semibold uppercase mb-0.5">Net</p>
            <p className={`text-xs font-bold ${net >= 0 ? 'text-white' : 'text-red-300'}`}>{fmt(net)}</p>
          </div>
        </div>

        {/* Footer row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-[11px] text-slate-400">
              <Users size={11} /> {branch.member_count || 0}
            </div>
            {branch.manager_name && (
              <div className="flex items-center gap-1 text-[11px] text-slate-400">
                <Shield size={11} /> {branch.manager_name.split(' ')[0]}
              </div>
            )}
          </div>

          {/* Health mini-bar */}
          <div className="flex items-center gap-1.5">
            <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${hc.bar}`} style={{ width: `${health}%` }} />
            </div>
            <span className={`text-[10px] font-semibold ${hc.text}`}>{health}%</span>
          </div>
        </div>
      </div>

      {/* Hover CTA */}
      <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-all">
        <span className="text-[11px] text-slate-400">Click to view details</span>
        <ChevronRight size={13} className="text-slate-400" />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export function MultiBranch() {
  const [branches, setBranches] = useState([])
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedRole, setSelectedRole] = useState('owner')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editBranch, setEditBranch] = useState(null)
  const [drawerBranch, setDrawerBranch] = useState(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('active')
  const [view, setView] = useState('grid')  // grid | list

  function loadData() {
    if (!getBizId()) return
    setLoading(true)
    Promise.all([
      fetch(`${API_BASE}/api/v1/branches/${getBizId()}/`, { headers: authHeaders() }).then(r => r.json()),
      fetch(`${API_BASE}/api/v1/business/${getBizId()}/members/`, { headers: authHeaders() }).then(r => r.json()),
      fetch(`${API_BASE}/api/v1/dashboard/${getBizId()}/`, { headers: authHeaders() }).then(r => r.json()).catch(() => ({})),
    ])
      .then(([branchRaw, membRaw, dashRaw]) => {
        const branchList = branchRaw.data?.results || branchRaw.data || branchRaw.results || branchRaw || []
        const rawBranches = Array.isArray(branchList) ? branchList : []
        const dash = dashRaw.data || dashRaw
        const overview = dash.overview || {}

        // Key the finMap by String(id) to handle UUID-string vs integer mismatches
        const finMap = {}
          ; (dash.branches || []).forEach(b => { finMap[String(b.id)] = b })

        const mappedBranches = rawBranches.map(b => {
          const fin = finMap[String(b.id)] || {}
          return {
            ...b,
            income: Number(fin.income ?? 0),
            expense: Number(fin.expense ?? 0),
            profit: Number(fin.profit ?? 0),
            member_count: fin.member_count ?? b.member_count ?? 0,
          }
        })

        // Head Office = all-time business total minus what's attributed to branches
        const branchInc = mappedBranches.reduce((s, b) => s + (b.income || 0), 0)
        const branchExp = mappedBranches.reduce((s, b) => s + (b.expense || 0), 0)
        const allInc = Number(overview.total_income || dash.income || 0)
        const allExp = Number(overview.total_expense || dash.expense || 0)

        const bizName = localStorage.getItem('business_name') || 'Head Office'

        setBranches([
          {
            id: '__HO__',
            name: `${bizName} (HO)`,
            branch_type: 'head_office',
            city: 'Headquarters',
            isHO: true,
            is_active: true,
            is_primary: true,
            income: Math.max(0, allInc - branchInc),
            expense: Math.max(0, allExp - branchExp),
            profit: Math.max(0, allInc - branchInc) - Math.max(0, allExp - branchExp),
            member_count: 0,
          },
          ...mappedBranches,
        ])
        const membArr = membRaw.data?.results || membRaw.data || membRaw.results || membRaw || []
        setMembers(Array.isArray(membArr) ? membArr : [])
      })
      .catch(err => { console.error('MultiBranch loadData error:', err) })
      .finally(() => setLoading(false))
  }


  useEffect(() => { loadData() }, [])

  async function toggleBranchActive(branch) {
    try {
      await fetch(`${API_BASE}/api/v1/branches/${getBizId()}/${branch.id}/`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ is_active: !branch.is_active }),
      })
      loadData()
      setDrawerBranch(null)
    } catch { }
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const duplicateCities = buildCityGroups(branches)

  const filtered = branches.filter(b => {
    if (statusFilter === 'active' && b.is_active === false) return false
    if (statusFilter === 'inactive' && b.is_active !== false) return false
    if (typeFilter !== 'all' && b.branch_type !== typeFilter) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return b.name?.toLowerCase().includes(q) ||
        b.city?.toLowerCase().includes(q) ||
        b.code?.toLowerCase().includes(q)
    }
    return true
  })

  const totalIncome = branches.reduce((s, b) => s + (b.income || 0), 0)
  const totalExpense = branches.reduce((s, b) => s + (b.expense || 0), 0)
  const activeCount = branches.filter(b => b.is_active !== false).length

  const roleInfo = ROLE_PERMISSIONS[selectedRole] || ROLE_PERMISSIONS.staff

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>

      {/* Modals */}
      {showAddModal && (
        <BranchModal
          existingBranches={branches}
          onClose={() => setShowAddModal(false)}
          onSaved={() => { loadData(); setShowAddModal(false) }}
        />
      )}
      {editBranch && (
        <BranchModal
          branch={editBranch}
          existingBranches={branches}
          onClose={() => setEditBranch(null)}
          onSaved={() => { loadData(); setEditBranch(null); setDrawerBranch(null) }}
        />
      )}
      {drawerBranch && (
        <BranchDrawer
          branch={drawerBranch}
          onClose={() => setDrawerBranch(null)}
          onEdit={() => { setEditBranch(drawerBranch); setDrawerBranch(null) }}
          onToggleActive={() => toggleBranchActive(drawerBranch)}
        />
      )}

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Branch Management</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {loading ? 'Loading…' : `${activeCount} active · ${branches.length} total · ${duplicateCities.size > 0 ? `${duplicateCities.size} multi-branch ${[...duplicateCities].join(', ')}` : 'all unique cities'}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadData} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 shadow-sm transition-colors"
          >
            <Plus size={14} /> Add Branch
          </button>
        </div>
      </div>

      {/* ── KPI row ── */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Branches', value: branches.length, sub: `${activeCount} active`, icon: <Layers size={16} className="text-slate-600" />, bg: 'bg-slate-100' },
          { label: 'Total Income', value: fmt(totalIncome), sub: 'All branches', icon: <TrendingUp size={16} className="text-emerald-600" />, bg: 'bg-emerald-50' },
          { label: 'Total Expenses', value: fmt(totalExpense), sub: 'All branches', icon: <TrendingDown size={16} className="text-red-500" />, bg: 'bg-red-50' },
          // { label: 'Team Members', value: members.length, sub: 'Across all branches', icon: <Users size={16} className="text-blue-600" />, bg: 'bg-blue-50' },
        ].map(k => (
          <div key={k.label} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <div className={`w-9 h-9 ${k.bg} rounded-xl flex items-center justify-center mb-3`}>{k.icon}</div>
            <p className="text-[11px] text-slate-400 font-medium">{k.label}</p>
            <p className="text-2xl font-bold text-slate-900 mt-0.5">{k.value}</p>
            <p className="text-[11px] text-slate-400 mt-1">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Filters + Search ── */}
      <div className="flex items-center gap-3 flex-wrap bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, city, code…"
            className="w-full pl-8 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
          {['all', 'active', 'inactive'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition-colors ${statusFilter === s ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}>{s}</button>
          ))}
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
          {[
            { val: 'all', label: 'All Types' },
            ...Object.entries(BRANCH_TYPE_META).map(([val, m]) => ({ val, label: m.label }))
          ].map(({ val, label }) => (
            <button key={val} onClick={() => setTypeFilter(val)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${typeFilter === val ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}>{label}</button>
          ))}
        </div>

        <div className="flex items-center gap-1 ml-auto p-1 bg-slate-100 rounded-xl">
          {[{ val: 'grid', icon: <Layers size={13} /> }, { val: 'list', icon: <BarChart2 size={13} /> }].map(v => (
            <button key={v.val} onClick={() => setView(v.val)}
              className={`p-1.5 rounded-lg transition-colors ${view === v.val ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
              {v.icon}
            </button>
          ))}
        </div>
      </div>

      {/* Same-city notice */}
      {duplicateCities.size > 0 && (
        <div className="flex items-start gap-3 p-3.5 bg-amber-50 border border-amber-200 rounded-2xl">
          <AlertCircle size={15} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Multiple branches in same city detected</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Cities: <strong>{[...duplicateCities].map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(', ')}</strong>.
              Edit these branches to add a locality name (e.g. "Nashik Karvenagar Branch") so staff and customers can easily tell them apart.
            </p>
          </div>
        </div>
      )}

      {/* ── Branch Cards ── */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={28} className="animate-spin text-slate-300" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-14 text-center shadow-sm">
          <Building2 size={36} className="text-slate-200 mx-auto mb-4" />
          <p className="text-sm font-semibold text-slate-600 mb-1">
            {branches.length === 0 ? 'No branches yet' : 'No branches match your filters'}
          </p>
          <p className="text-xs text-slate-400 mb-5">
            {branches.length === 0 ? 'Create your first branch to manage multiple locations.' : 'Try adjusting your search or filters.'}
          </p>
          {branches.length === 0 && (
            <button onClick={() => setShowAddModal(true)} className="px-4 py-2 bg-slate-900 text-white text-sm font-semibold rounded-xl">
              + Add First Branch
            </button>
          )}
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(branch => (
            <BranchCard
              key={branch.id}
              branch={branch}
              duplicateCities={duplicateCities}
              onClick={() => setDrawerBranch(branch)}
              onEdit={branch.isHO ? () => { } : () => setEditBranch(branch)}
            />
          ))}
        </div>
      ) : (
        /* List view */
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {['Branch', 'Type', 'City', 'Manager', 'Income', 'Expense', 'Net', 'Staff', 'Health', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((b, i) => {
                const type = BRANCH_TYPE_META[b.branch_type] || BRANCH_TYPE_META.branch
                const net = (b.income || 0) - (b.expense || 0)
                const health = computeHealth(b)
                const hc = healthColor(health)
                const cityLower = (b.city || '').trim().toLowerCase()
                const isSameCity = duplicateCities.has(cityLower) && cityLower

                return (
                  <tr key={b.id}
                    className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors cursor-pointer"
                    onClick={() => setDrawerBranch(b)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span>{type.icon}</span>
                        <div>
                          <p className="font-semibold text-slate-900 text-xs">{b.name}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{b.code || '—'}</p>
                        </div>
                        {b.is_primary && <Star size={10} className="text-violet-500" />}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold border ${type.color}`}>{type.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-xs text-slate-600">
                        {b.city || '—'}
                        {isSameCity && (
                          <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[9px] font-bold border border-amber-200">
                            Multi
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{b.manager_name || '—'}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-emerald-600">{fmt(b.income || 0)}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-red-500">{fmt(b.expense || 0)}</td>
                    <td className={`px-4 py-3 text-xs font-bold ${net >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{fmt(net)}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{b.member_count || 0}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${hc.bar}`} style={{ width: `${health}%` }} />
                        </div>
                        <span className={`text-[10px] font-semibold ${hc.text}`}>{health}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={e => { e.stopPropagation(); setEditBranch(b) }}
                        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-colors">
                        <Edit2 size={12} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Permission Matrix */}
      {/* <div className="col-span-5">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900">Permission Matrix</h2>
              <p className="text-xs text-slate-400 mt-0.5">What each role can do</p>
            </div> */}

      {/* Role selector */}
      {/* <div className="px-4 pt-3 pb-3 flex gap-1.5 flex-wrap border-b border-slate-100">
              {Object.entries(ROLE_PERMISSIONS).map(([key, info]) => (
                <button
                  key={key}
                  onClick={() => setSelectedRole(key)}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all border ${selectedRole === key ? info.color + ' shadow-sm' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                    }`}
                >
                  {info.label}
                </button>
              ))}
            </div> */}

      {/* <div className="p-4 space-y-1">
              {roleInfo.permissions.map((perm, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
                  <span className={`text-xs ${perm.allowed ? 'text-slate-800 font-medium' : 'text-slate-400'}`}>
                    {perm.label}
                  </span>
                  {perm.allowed
                    ? <CheckCircle size={14} className="text-emerald-500 flex-shrink-0" />
                    : <Ban size={14} className="text-slate-300 flex-shrink-0" />
                  }
                </div>
              ))}
            </div> */}

      {/* <div className="px-4 pb-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-xs text-slate-500 leading-relaxed">{roleInfo.note}</p>
              </div>
            </div> */}
    </div>
    //     </div>
    //   </div>
    // </div>
  )
}