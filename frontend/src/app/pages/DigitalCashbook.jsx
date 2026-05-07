import { useState, useEffect, useCallback } from 'react'
import {
  Plus, Search, Filter, Download, Loader2, X, Check,
  ChevronLeft, ChevronRight, ArrowUpRight, ArrowDownLeft,
  Building2, TrendingUp, TrendingDown, Wallet, RefreshCw,
  Pencil, Trash2, AlertTriangle, Clock, CheckCircle2,
  CalendarClock, BadgeIndianRupee,
} from 'lucide-react'
import {
  canAddExpense,
  getAssignedBranchIds,
  getStoredRole,
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

const fmt = n =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0)

const fmtShort = n => {
  if (n == null || isNaN(n)) return '—'
  if (Math.abs(n) >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`
  if (Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(2)}L`
  if (Math.abs(n) >= 1000) return `₹${(n / 1000).toFixed(1)}K`
  return `₹${n}`
}

const fmtDate = iso =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

const fmtDateTime = iso =>
  iso ? new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

// ── Date helpers ─────────────────────────────────────────────────────────────
// Uses Intl.DateTimeFormat with Asia/Kolkata so the date always matches what
// the Django server (running in IST) considers "today" — regardless of the
// browser's system timezone or when the JS bundle was first loaded.
const _istFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric', month: '2-digit', day: '2-digit',
})
function getISTDate(offsetDays = 0) {
  const d = new Date()
  if (offsetDays) d.setDate(d.getDate() + offsetDays)
  return _istFmt.format(d)   // always returns YYYY-MM-DD in IST
}
const getToday = () => getISTDate(0)
const getTomorrow = () => getISTDate(1)
// NEVER cache these as module-level constants — always call as functions

const DUE_CATEGORY_NAMES = new Set(['receivable', 'payable'])

function isDueCategory(catName) {
  return !!(catName && DUE_CATEGORY_NAMES.has(catName.trim().toLowerCase()))
}

function validateTransactionDate(dateStr, catName) {
  if (!dateStr) return 'Transaction date is required.'
  const today = getToday()
  if (isDueCategory(catName)) {
    if (dateStr <= today)
      return `Receivable/Payable entries must have a future date — pick tomorrow or later.`
  } else {
    if (dateStr > today)
      return `Transaction date cannot be in the future. Please select today or an earlier date.`
  }
  return ''
}

// Days until a date (negative = overdue)
function daysUntil(dateStr) {
  if (!dateStr) return null
  const diff = new Date(dateStr) - new Date(getToday())
  return Math.round(diff / 86400000)
}


// ── Mark-as-Done confirmation dialog ─────────────────────────────────────────
function MarkDoneDialog({ entry, onConfirm, onCancel, marking, error }) {
  const isReceivable = entry.type === 'credit'
  const [settlementDate, setSettlementDate] = useState(getToday())

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isReceivable ? 'bg-emerald-50' : 'bg-blue-50'}`}>
            <CheckCircle2 size={18} className={isReceivable ? 'text-emerald-500' : 'text-blue-500'} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Mark as {isReceivable ? 'Received' : 'Paid'}?
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Amount will be added to your balance.
            </p>
          </div>
        </div>

        {/* Entry summary */}
        <div className="bg-slate-50 rounded-xl px-4 py-3 mb-4 space-y-1">
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-500">{isReceivable ? 'Receivable from' : 'Payable to'}</span>
            <span className="text-xs font-semibold text-slate-800">{entry.party_name || '—'}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-500">Amount</span>
            <span className={`text-sm font-bold ${isReceivable ? 'text-emerald-600' : 'text-red-500'}`}>
              {isReceivable ? '+' : '-'}{fmt(entry.amount)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-500">Due date</span>
            <span className="text-xs text-slate-700">{fmtDate(entry.date)}</span>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <AlertTriangle size={13} className="text-red-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-red-700 font-medium">{error}</p>
          </div>
        )}

        {/* Settlement date picker */}
        <div className="mb-5">
          <label className="block text-xs font-semibold text-slate-500 mb-1">
            Settlement Date <span className="font-normal text-slate-400">(when money actually moved)</span>
          </label>
          <input
            type="date"
            value={settlementDate}
            max={getToday()}
            onChange={e => setSettlementDate(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
          >
            Not Yet
          </button>
          <button
            onClick={() => onConfirm(settlementDate)}
            disabled={marking}
            className={`flex-1 py-2.5 text-sm font-semibold text-white rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 ${isReceivable ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'
              }`}
          >
            {marking ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            {marking ? 'Saving…' : `Yes, Mark ${isReceivable ? 'Received' : 'Paid'}`}
          </button>
        </div>
      </div>
    </div>
  )
}


// ── Confirm Delete Dialog ─────────────────────────────────────────────────────
function DeleteConfirmDialog({ entry, onConfirm, onCancel, deleting }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={18} className="text-red-500" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Cancel Entry?</h3>
            <p className="text-xs text-slate-400 mt-0.5">This action cannot be undone.</p>
          </div>
        </div>
        <p className="text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2 mb-5">
          <span className={`font-semibold ${entry.type === 'credit' ? 'text-emerald-600' : 'text-red-500'}`}>
            {entry.type === 'credit' ? '+' : '-'}{fmt(entry.amount)}
          </span>
          {' '}— {entry.description || entry.party_name || 'No description'} ({fmtDate(entry.date)})
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
          >
            Keep Entry
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 py-2.5 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            {deleting ? 'Cancelling…' : 'Cancel Entry'}
          </button>
        </div>
      </div>
    </div>
  )
}


// ── Pending Dues Panel ────────────────────────────────────────────────────────
// Shows ALL pending entries (receivable, payable, and general pending)
// with inline Mark-as-Done CTAs.
function PendingDuesPanel({ onMarkDone }) {
  const [dues, setDues] = useState([])
  const [loading, setLoading] = useState(true)
  const [totals, setTotals] = useState({ receivable: 0, payable: 0 })

  const load = useCallback(() => {
    if (!getBizId()) { setLoading(false); return }
    setLoading(true)

    // Fetch both pending-dues (receivable/payable) AND all pending entries
    Promise.all([
      fetch(`${API_BASE}/api/v1/cashbook/${getBizId()}/entries/pending-dues/`, { headers: authHeaders() })
        .then(r => r.json()).catch(() => ({})),
      fetch(`${API_BASE}/api/v1/cashbook/${getBizId()}/entries/?status=pending&page_size=100`, { headers: authHeaders() })
        .then(r => r.json()).catch(() => ({})),
    ]).then(([duesRaw, pendingRaw]) => {
      const d = duesRaw.data || duesRaw
      const duesList = d.entries || []

      const pd = pendingRaw.data || pendingRaw
      const allPending = (pd.results || (Array.isArray(pd) ? pd : []))
        .filter(e => e.status === 'pending')

      // Merge: due-category entries from pending-dues endpoint + any remaining pending entries
      const dueIds = new Set(duesList.map(e => e.id))
      const extra = allPending.filter(e => !dueIds.has(e.id))
      const merged = [...duesList, ...extra]

      setDues(merged)
      setTotals({
        receivable: parseFloat(d.total_receivable || 0),
        payable: parseFloat(d.total_payable || 0),
      })
    })
      .catch(() => { })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  // expose reload so parent can call it after a mark-done
  PendingDuesPanel._reload = load

  if (!loading && dues.length === 0) return null

  const pendingCredits = dues.filter(e => e.type === 'credit').reduce((s, e) => s + parseFloat(e.amount || 0), 0)
  const pendingDebits = dues.filter(e => e.type === 'debit').reduce((s, e) => s + parseFloat(e.amount || 0), 0)

  return (
    <div className="bg-white border border-amber-200 rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-amber-100 bg-amber-50/60">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
            <CalendarClock size={14} className="text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800">Pending Entries</p>
            <p className="text-[11px] text-slate-500">{dues.length} entries awaiting confirmation</p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs">
          {pendingCredits > 0 && (
            <span className="flex items-center gap-1 font-semibold text-emerald-600">
              <ArrowDownLeft size={12} /> To Receive: {fmtShort(pendingCredits)}
            </span>
          )}
          {pendingDebits > 0 && (
            <span className="flex items-center gap-1 font-semibold text-red-500">
              <ArrowUpRight size={12} /> To Pay: {fmtShort(pendingDebits)}
            </span>
          )}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="py-8 flex items-center justify-center">
          <Loader2 size={18} className="animate-spin text-slate-300" />
        </div>
      ) : (
        <div className="divide-y divide-slate-50">
          {dues.map(e => {
            const isReceivable = e.type === 'credit'
            const days = daysUntil(e.date)
            const isOverdue = days !== null && days < 0
            const isDueToday = days === 0
            // Label: use category name if it's a due category, else generic
            const catName = (e.category_name || '').toLowerCase()
            const isDueCat = catName === 'receivable' || catName === 'payable'
            const typeLabel = isDueCat
              ? (isReceivable ? 'Receivable' : 'Payable')
              : (e.category_name || (isReceivable ? 'Credit' : 'Debit'))

            return (
              <div
                key={e.id}
                className={`flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50/70 transition-colors ${isOverdue ? 'bg-red-50/30' : ''}`}
              >
                {/* Type icon */}
                <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center ${isReceivable ? 'bg-emerald-50' : 'bg-red-50'}`}>
                  {isReceivable
                    ? <ArrowDownLeft size={12} className="text-emerald-600" />
                    : <ArrowUpRight size={12} className="text-red-500" />
                  }
                </div>

                {/* Description + party */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-800 truncate">
                    {e.description || e.party_name || '—'}
                  </p>
                  {e.party_name && e.description && (
                    <p className="text-[11px] text-slate-400 truncate">{e.party_name}</p>
                  )}
                </div>

                {/* Category / type badge */}
                <span className={`hidden sm:inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full ${isReceivable ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
                  }`}>
                  {typeLabel}
                </span>

                {/* Due / scheduled date */}
                <div className="text-right min-w-[90px]">
                  <p className={`text-[11px] font-medium ${isOverdue ? 'text-red-500' : isDueToday ? 'text-amber-600' : 'text-slate-500'
                    }`}>
                    {isOverdue
                      ? `⚠ ${Math.abs(days)}d overdue`
                      : isDueToday
                        ? '⚡ Due today'
                        : `${fmtDate(e.date)}`
                    }
                  </p>
                </div>

                {/* Amount */}
                <p className={`text-sm font-bold min-w-[80px] text-right ${isReceivable ? 'text-emerald-600' : 'text-red-500'}`}>
                  {isReceivable ? '+' : '-'}{fmt(e.amount)}
                </p>

                {/* Mark done CTA */}
                <button
                  onClick={() => onMarkDone(e)}
                  title={isReceivable ? 'Mark as Received' : 'Mark as Paid'}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg transition-all whitespace-nowrap ${isReceivable
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                >
                  <CheckCircle2 size={12} />
                  {isReceivable ? 'Mark Received' : 'Mark Paid'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}


// ── Add / Edit Transaction Modal ──────────────────────────────────────────────
function TransactionModal({ onClose, onSaved, branches, selectedBranchId, editEntry, allowExpense }) {
  const isEdit = !!editEntry

  const [form, setForm] = useState(() => {
    if (isEdit) {
      return {
        type: editEntry.type || 'credit',
        description: editEntry.description || '',
        amount: editEntry.amount || '',
        date: editEntry.date || getToday(),
        category_id: editEntry.category_id
          ? String(editEntry.category_id)
          : (editEntry.category?.id ? String(editEntry.category.id) : ''),
        payment_mode: editEntry.payment_mode || 'cash',
        party_name: editEntry.party_name || '',
        reference_no: editEntry.reference_no || '',
        branch_id: editEntry.branch_id ? String(editEntry.branch_id) : '',
      }
    }
    return {
      type: 'credit', description: '', amount: '',
      date: getToday(),   // fresh IST date every time modal opens
      category_id: '', payment_mode: 'cash',
      party_name: '', reference_no: '',
      branch_id: selectedBranchId || '',
    }
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [dateErr, setDateErr] = useState('')
  const [apiCats, setApiCats] = useState([])

  useEffect(() => {
    if (!getBizId()) return
    fetch(`${API_BASE}/api/v1/cashbook/${getBizId()}/categories/`, { headers: authHeaders() })
      .then(r => r.json())
      .then(raw => {
        const list = raw.data?.results || raw.data || raw.results || raw || []
        setApiCats(Array.isArray(list) ? list : [])
      })
      .catch(() => { })
  }, [])

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))
  const filtCats = apiCats.filter(c => !c.type || c.type === form.type || c.type === 'both')
  const selCat = apiCats.find(c => String(c.id) === String(form.category_id))
  const selCatName = selCat?.name || (form.category_id?.startsWith('_fb_') ? form.category_id.replace('_fb_', '') : '')
  const isDueType = isDueCategory(selCatName)
  const isCancelled = isEdit && editEntry.status === 'cancelled'
  const typeOptions = [
    { val: 'credit', label: '💰 Income', cls: 'bg-emerald-500 text-white shadow-sm' },
    ...(allowExpense ? [{ val: 'debit', label: '💸 Expense', cls: 'bg-red-500 text-white shadow-sm' }] : []),
  ]

  // Always fresh so min/max stay correct even if modal open across midnight
  const todayStr = getToday()
  const tomorrowStr = getTomorrow()

  function handleDateChange(e) {
    const val = e.target.value
    setForm(f => ({ ...f, date: val }))
    setDateErr(validateTransactionDate(val, selCatName))
  }

  function handleCategoryChange(e) {
    const catId = e.target.value
    const newCat = apiCats.find(c => String(c.id) === catId)
    const catName = newCat?.name || (catId.startsWith('_fb_') ? catId.replace('_fb_', '') : '')
    const newIsDue = isDueCategory(catName)
    const resetDate = newIsDue ? getTomorrow() : getToday()
    setForm(f => ({ ...f, category_id: catId, date: resetDate }))
    setDateErr('')
  }

  async function handleSave() {
    if (!form.amount || parseFloat(form.amount) <= 0) {
      setError('Enter a valid amount greater than 0.')
      return
    }
    const txnErr = validateTransactionDate(form.date, selCatName)
    if (txnErr) { setDateErr(txnErr); return }

    // Hard clamp: if non-due entry somehow has a future date, force it to IST today
    const safeDate = (!isDueType && form.date > getToday()) ? getToday() : form.date

    setSaving(true); setError(''); setDateErr('')
    try {
      const payload = {
        amount: parseFloat(form.amount),
        payment_mode: form.payment_mode || 'cash',
        date: safeDate,
        // Only send status for due-type entries — regular entries use backend default (confirmed)
        ...(isDueType ? { status: 'pending' } : {}),
      }
      if (!isEdit) payload.type = form.type
      if (form.description.trim()) payload.description = form.description.trim()
      if (form.reference_no.trim()) payload.reference_no = form.reference_no.trim()
      if (form.party_name.trim()) payload.party_name = form.party_name.trim()
      if (form.category_id && !form.category_id.startsWith('_fb_')) {
        payload.category = form.category_id
      }
      if (form.branch_id && form.branch_id !== '__HO__') payload.branch = form.branch_id

      const url = isEdit
        ? `${API_BASE}/api/v1/cashbook/${getBizId()}/entries/${editEntry.id}/`
        : `${API_BASE}/api/v1/cashbook/${getBizId()}/entries/`
      const method = isEdit ? 'PATCH' : 'POST'

      const res = await fetch(url, { method, headers: authHeaders(), body: JSON.stringify(payload) })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        const backendMsg = data.message || data.detail ||
          (data.errors ? JSON.stringify(data.errors) : null) ||
          Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' | ') ||
          `Error ${res.status}`
        setError(backendMsg)
        return
      }
      onSaved()
    } catch (e) {
      setError(e.message || 'Network error.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {isEdit ? 'Edit Transaction' : 'Add Transaction'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {isEdit
                ? `Editing entry · ${fmtDate(editEntry.date)}`
                : 'Record a new cashbook entry'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X size={16} className="text-slate-500" />
          </button>
        </div>

        {isCancelled && (
          <div className="mx-6 mt-4 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 flex items-center gap-2">
            <AlertTriangle size={13} /> This entry is cancelled and cannot be edited.
          </div>
        )}

        {/* Due-type info banner */}
        {isDueType && !isCancelled && (
          <div className="mx-6 mt-4 px-3 py-2.5 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
            <Clock size={13} className="text-blue-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-700">
              <span className="font-semibold">{selCatName.charAt(0).toUpperCase() + selCatName.slice(1)} entry</span>
              {' '}— This will be saved as <span className="font-semibold">Pending</span> and won't
              affect your balance until you mark it as done.
            </p>
          </div>
        )}

        <div className="px-6 pt-4 pb-2 space-y-4">

          {/* Type Toggle */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
            {[
              { val: 'credit', label: '💰 Income', cls: 'bg-emerald-500 text-white shadow-sm' },
              { val: 'debit', label: '💸 Expense', cls: 'bg-red-500 text-white shadow-sm' },
            ].map(({ val, label, cls }) => (
              <button
                key={val}
                disabled={isEdit}
                onClick={() => !isEdit && setForm(f => ({ ...f, type: val, category_id: '' }))}
                className={`py-2.5 text-sm font-semibold rounded-lg transition-all ${form.type === val
                    ? cls
                    : 'text-slate-500 hover:text-slate-700'
                  } ${isEdit ? 'cursor-not-allowed opacity-70' : ''}`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Amount *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-base">₹</span>
              <input
                type="number"
                value={form.amount}
                onChange={set('amount')}
                placeholder="0"
                min="0"
                disabled={isCancelled}
                className="w-full pl-8 pr-3 py-3 text-lg font-bold border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:bg-slate-50"
              />
            </div>
          </div>

          {/* Category + Payment Mode */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Category</label>
              <select
                value={form.category_id}
                onChange={handleCategoryChange}
                disabled={isCancelled}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-white disabled:bg-slate-50"
              >
                <option value="">— Select —</option>
                {(() => {
                  const fallbacks = form.type === 'credit'
                    ? ['Sales', 'Service Income', 'Receivable', 'Other Income']
                    : ['Rent', 'Salaries', 'GST Payment', 'Payable', 'Other Expense']
                  
                  // Collect names already in filtCats
                  const existingNames = new Set(filtCats.map(c => c.name.toLowerCase()))
                  
                  // Filter out fallbacks that are already in the actual categories
                  const missingFallbacks = fallbacks.filter(n => !existingNames.has(n.toLowerCase()))

                  return (
                    <>
                      {filtCats.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
                      {missingFallbacks.map(n => <option key={n} value={`_fb_${n}`}>{n}</option>)}
                    </>
                  )
                })()}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Payment Mode</label>
              <select
                value={form.payment_mode}
                onChange={set('payment_mode')}
                disabled={isCancelled}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-white disabled:bg-slate-50"
              >
                <option value="cash">💵 Cash</option>
                <option value="upi">📱 UPI</option>
                <option value="bank_transfer">🏦 Bank Transfer</option>
                <option value="cheque">📄 Cheque</option>
                <option value="card">💳 Card</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          {/* Branch */}
          {branches && branches.length > 1 && (
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Branch</label>
              <select
                value={form.branch_id}
                onChange={set('branch_id')}
                disabled={isCancelled}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-white disabled:bg-slate-50"
              >
                {branches.map(b => (
                  <option key={b.id || '__HO__'} value={b.id === '__HO__' ? '' : b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Description + Ref */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Description</label>
              <input
                value={form.description}
                onChange={set('description')}
                placeholder="e.g. Client Payment"
                disabled={isCancelled}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:bg-slate-50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Ref / Invoice No.</label>
              <input
                value={form.reference_no}
                onChange={set('reference_no')}
                placeholder="INV-001, UTR…"
                disabled={isCancelled}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:bg-slate-50"
              />
            </div>
          </div>

          {/* Party Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">
              Party Name
              <span className="ml-1 font-normal text-slate-400">
                ({form.type === 'credit' ? 'Who paid you?' : 'Who did you pay?'} · optional)
              </span>
            </label>
            <input
              value={form.party_name}
              onChange={set('party_name')}
              placeholder={form.type === 'credit' ? 'e.g. Reliance Industries' : 'e.g. MSEB, Landlord'}
              disabled={isCancelled}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:bg-slate-50"
            />
            {isDueType && !form.party_name && (
              <p className="text-[11px] text-amber-600 mt-1">
                💡 Add party name to track in Receivables &amp; Payables
              </p>
            )}
          </div>

          {/* Transaction Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">
              {isDueType ? '📅 Expected Payment Date (future)' : 'Transaction Date'}
            </label>
            <input
              type="date"
              value={form.date}
              onChange={handleDateChange}
              min={isDueType ? tomorrowStr : undefined}
              max={isDueType ? undefined : todayStr}
              disabled={isCancelled}
              className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 disabled:bg-slate-50 ${dateErr
                  ? 'border-red-400 focus:ring-red-400/30 bg-red-50'
                  : isDueType
                    ? 'border-amber-300 bg-amber-50/40 focus:ring-amber-400/30'
                    : 'border-slate-200 focus:ring-blue-500/30'
                }`}
            />
            <p className="text-[10px] mt-1 text-slate-400">
              {isDueType
                ? `⚡ Must be tomorrow (${tomorrowStr}) or later`
                : `📅 Today or earlier — no future dates for regular transactions`}
            </p>
            {dateErr && (
              <p className="text-[11px] text-red-600 mt-1 flex items-start gap-1">
                <AlertTriangle size={11} className="mt-0.5 flex-shrink-0" />{dateErr}
              </p>
            )}
          </div>

          {/* Audit info on edit */}
          {isEdit && editEntry.created_by_name && (
            <div className="text-[11px] text-slate-400 bg-slate-50 rounded-lg px-3 py-2 flex items-center gap-2">
              <span>Created by <span className="font-medium text-slate-600">{editEntry.created_by_name}</span></span>
              {editEntry.updated_at && (
                <span>· Last updated {fmtDateTime(editEntry.updated_at)}</span>
              )}
            </div>
          )}

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">
              ⚠️ {error}
            </p>
          )}
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-slate-100">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
          >
            Cancel
          </button>
          {!isCancelled && (
            <button
              onClick={handleSave}
              disabled={saving || !!dateErr}
              className={`flex-1 py-2.5 text-sm font-semibold text-white rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50 ${form.type === 'credit' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-900 hover:bg-slate-800'
                }`}
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {saving
                ? 'Saving…'
                : isEdit
                  ? 'Save Changes'
                  : isDueType
                    ? `Save as Pending ${form.type === 'credit' ? 'Receivable' : 'Payable'}`
                    : `Save ${form.type === 'credit' ? 'Income' : 'Expense'}`
              }
            </button>
          )}
        </div>
      </div>
    </div>
  )
}


// ── Branch Card ───────────────────────────────────────────────────────────────
function BranchCard({ branch, isSelected, onClick }) {
  const income = parseFloat(branch.income || 0)
  const expense = parseFloat(branch.expense || 0)
  const net = income - expense

  return (
    <div
      onClick={onClick}
      className={`cursor-pointer rounded-xl border p-4 transition-all select-none ${isSelected
          ? 'border-slate-900 bg-slate-900 text-white shadow-lg scale-[1.02]'
          : 'border-slate-200 bg-white hover:border-slate-400 hover:shadow-md'
        }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isSelected ? 'bg-white/10' : branch.isHO ? 'bg-amber-50' : 'bg-slate-100'}`}>
          <Building2 size={15} className={isSelected ? 'text-white' : branch.isHO ? 'text-amber-600' : 'text-slate-600'} />
        </div>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${net >= 0
            ? isSelected ? 'bg-emerald-400/20 text-emerald-300' : 'bg-emerald-50 text-emerald-700'
            : isSelected ? 'bg-red-400/20 text-red-300' : 'bg-red-50 text-red-600'
          }`}>
          {net >= 0 ? '▲' : '▼'} {fmtShort(Math.abs(net))}
        </span>
      </div>
      <p className={`text-xs font-semibold truncate mb-3 ${isSelected ? 'text-white' : 'text-slate-800'}`}>
        {branch.name}
      </p>
      <div className="grid grid-cols-2 gap-1">
        <div>
          <p className="text-[10px] text-slate-400">Income</p>
          <p className={`text-xs font-bold ${isSelected ? 'text-emerald-400' : 'text-emerald-600'}`}>{fmtShort(income)}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-400">Expense</p>
          <p className={`text-xs font-bold ${isSelected ? 'text-red-400' : 'text-red-500'}`}>{fmtShort(expense)}</p>
        </div>
      </div>
    </div>
  )
}


// ── Main Page ─────────────────────────────────────────────────────────────────
export function DigitalCashbook() {
  const [branches, setBranches] = useState([])
  const [selectedBranch, setSelectedBranch] = useState(null)
  const [entries, setEntries] = useState([])
  const [balance, setBalance] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editEntry, setEditEntry] = useState(null)
  const [deleteEntry, setDeleteEntry] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [markDoneEntry, setMarkDoneEntry] = useState(null)   // entry pending mark-as-done
  const [marking, setMarking] = useState(false)
  const [markDoneError, setMarkDoneError] = useState('')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('All')
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const PAGE_SIZE = 20

  // ── Load branch stats ────────────────────────────────────────────────────────
  const loadBranchStats = useCallback(async () => {
    if (!getBizId()) return
    const assignedIds = getAssignedBranchIds()

    try {
      const [brRaw, balRaw, statsRaw] = await Promise.all([
        fetch(`${API_BASE}/api/v1/branches/${getBizId()}/`, { headers: authHeaders() }).then(r => r.json()).catch(() => ({})),
        fetch(`${API_BASE}/api/v1/cashbook/${getBizId()}/balance/`, { headers: authHeaders() }).then(r => r.json()).catch(() => ({})),
        fetch(`${API_BASE}/api/v1/cashbook/${getBizId()}/stats/branches/`, { headers: authHeaders() }).then(r => r.json()).catch(() => ({})),
      ])

      const rawList = brRaw.data?.results || brRaw.data || brRaw.results || brRaw || []
      let list = Array.isArray(rawList) ? rawList : []

      if (isScopedBranchRole()) list = list.filter(b => assignedIds.includes(b.id))

      const statsArr = statsRaw?.data?.branches || statsRaw?.branches || []
      const statsMap = {}
      let hoIncome = 0, hoExpense = 0

      statsArr.forEach(s => {
        if (s.branch_id === null || s.branch_id === undefined) {
          hoIncome += parseFloat(s.total_credit || 0)
          hoExpense += parseFloat(s.total_debit || 0)
        } else {
          statsMap[s.branch_id] = {
            income: parseFloat(s.total_credit || 0),
            expense: parseFloat(s.total_debit || 0),
          }
        }
      })

      const bizName = localStorage.getItem('business_name') || 'Head Office'
      const hoCard = [{
        id: '__HO__', name: `${bizName} (HO)`,
        income: hoIncome, expense: hoExpense, isHO: true,
      }]

      const finalBranches = [
        ...hoCard,
        ...list.map(b => ({
          ...b,
          income: statsMap[b.id]?.income || 0,
          expense: statsMap[b.id]?.expense || 0,
        })),
      ]
      setBranches(finalBranches)

      if (isScopedBranchRole() && list.length === 1 && !selectedBranch) {
        setSelectedBranch(list[0].id)
      }

      const bd = balRaw?.data || balRaw
      setBalance(bd?.net_balance ?? bd?.balance ?? null)
    } catch (e) {
      console.error('loadBranchStats error', e)
    }
  }, [])

  useEffect(() => { loadBranchStats() }, [loadBranchStats])

  // ── Load entries ─────────────────────────────────────────────────────────────
  const loadEntries = useCallback(() => {
    if (!getBizId()) { setLoading(false); return }
    setLoading(true)
    const params = new URLSearchParams({ page, page_size: PAGE_SIZE })
    if (selectedBranch && selectedBranch !== '__HO__') params.set('branch', selectedBranch)
    if (typeFilter !== 'All') params.set('type', typeFilter.toLowerCase())
    if (search.trim()) params.set('search', search.trim())

    fetch(`${API_BASE}/api/v1/cashbook/${getBizId()}/entries/?${params}`, { headers: authHeaders() })
      .then(r => r.json())
      .then(raw => {
        const d = raw.data || raw
        let list = d.results || (Array.isArray(d) ? d : [])
        if (selectedBranch === '__HO__') list = list.filter(e => !e.branch && !e.branch_name)
        setEntries(list)
        setTotalCount(selectedBranch === '__HO__' ? list.length : (d.count || list.length))
      })
      .catch(() => { })
      .finally(() => setLoading(false))
  }, [page, typeFilter, search, selectedBranch])

  useEffect(() => { loadEntries() }, [loadEntries])

  const pageCredits = entries.filter(e => e.type === 'credit' && e.status === 'confirmed').reduce((s, e) => s + parseFloat(e.amount || 0), 0)
  const pageDebits = entries.filter(e => e.type === 'debit' && e.status === 'confirmed').reduce((s, e) => s + parseFloat(e.amount || 0), 0)
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const activeName = selectedBranch ? (branches.find(b => b.id === selectedBranch)?.name || 'Branch') : 'All Branches'

  function refreshAll() {
    setPage(1)
    loadBranchStats()
    loadEntries()
    // Reload the pending dues panel if mounted
    if (PendingDuesPanel._reload) PendingDuesPanel._reload()
  }

  function handleSaved() {
    setShowModal(false)
    setEditEntry(null)
    refreshAll()
  }

  async function handleDelete() {
    if (!deleteEntry) return
    setDeleting(true)
    try {
      const res = await fetch(
        `${API_BASE}/api/v1/cashbook/${getBizId()}/entries/${deleteEntry.id}/`,
        { method: 'DELETE', headers: authHeaders() }
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setDeleteEntry(null)
      refreshAll()
    } catch (e) {
      console.error('Delete failed', e)
    } finally {
      setDeleting(false)
    }
  }

  // ── Mark-as-Done handler ─────────────────────────────────────────────────────
  async function handleMarkDone(settlementDate) {
    if (!markDoneEntry) return
    setMarking(true)
    setMarkDoneError('')
    try {
      const res = await fetch(
        `${API_BASE}/api/v1/cashbook/${getBizId()}/entries/${markDoneEntry.id}/mark-done/`,
        {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ settlement_date: settlementDate }),
        }
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = data.message || data.detail || `Error ${res.status}`
        setMarkDoneError(msg)
        return
      }
      setMarkDoneEntry(null)
      setMarkDoneError('')
      refreshAll()
    } catch (e) {
      setMarkDoneError(e.message || 'Network error. Please try again.')
    } finally {
      setMarking(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Digital Cashbook</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Viewing: <span className="font-semibold text-slate-700">{activeName}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedBranch && (
            <button
              onClick={() => { setSelectedBranch(null); setPage(1) }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              <X size={13} /> All Branches
            </button>
          )}
          <button
            onClick={() => { setEditEntry(null); setShowModal(true) }}
            className="flex items-center gap-2 px-4 py-1.5 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 shadow-sm"
          >
            <Plus size={15} /> Add Transaction
          </button>
        </div>
      </div>



      {/* Branch Summary Grid */}
      {branches.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Branches — click to filter cashbook
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">

            <div
              onClick={() => { setSelectedBranch(null); setPage(1) }}
              className={`cursor-pointer rounded-xl border p-4 transition-all select-none ${!selectedBranch
                  ? 'border-blue-600 bg-blue-600 text-white shadow-lg scale-[1.02]'
                  : 'border-slate-200 bg-white hover:border-slate-400 hover:shadow-md'
                }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${!selectedBranch ? 'bg-white/10' : 'bg-blue-50'}`}>
                <Wallet size={15} className={!selectedBranch ? 'text-white' : 'text-blue-600'} />
              </div>
              <p className={`text-xs font-semibold mb-3 ${!selectedBranch ? 'text-white' : 'text-slate-800'}`}>All Branches</p>
              <div className="grid grid-cols-2 gap-1">
                <div>
                  <p className="text-[10px] text-slate-400">Income</p>
                  <p className={`text-xs font-bold ${!selectedBranch ? 'text-emerald-300' : 'text-emerald-600'}`}>
                    {fmtShort(branches.reduce((s, b) => s + (b.income || 0), 0))}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400">Expense</p>
                  <p className={`text-xs font-bold ${!selectedBranch ? 'text-red-300' : 'text-red-500'}`}>
                    {fmtShort(branches.reduce((s, b) => s + (b.expense || 0), 0))}
                  </p>
                </div>
              </div>
            </div>

            {branches.map(b => (
              <BranchCard
                key={b.id}
                branch={b}
                isSelected={selectedBranch === b.id}
                onClick={() => { setSelectedBranch(b.id); setPage(1) }}
              />
            ))}
          </div>
        </div>
      )}

      {/* KPI Row */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Net Balance', value: balance, icon: <Wallet size={16} className="text-blue-600" />, color: 'text-blue-700', bg: 'bg-blue-50' },
          { label: 'Confirmed Income (this page)', value: pageCredits, icon: <TrendingUp size={16} className="text-emerald-600" />, color: 'text-emerald-700', bg: 'bg-emerald-50' },
          { label: 'Confirmed Expense (this page)', value: pageDebits, icon: <TrendingDown size={16} className="text-red-500" />, color: 'text-red-600', bg: 'bg-red-50' },
          {
            label: 'Net Flow (this page)', value: pageCredits - pageDebits,
            icon: <RefreshCw size={16} className={pageCredits - pageDebits >= 0 ? 'text-emerald-600' : 'text-red-500'} />,
            color: pageCredits - pageDebits >= 0 ? 'text-emerald-700' : 'text-red-600',
            bg: pageCredits - pageDebits >= 0 ? 'bg-emerald-50' : 'bg-red-50'
          },
        ].map(k => (
          <div key={k.label} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className={`w-8 h-8 rounded-lg ${k.bg} flex items-center justify-center mb-2`}>{k.icon}</div>
            <p className="text-[11px] text-slate-400 font-medium mb-0.5">{k.label}</p>
            {k.value != null
              ? <p className={`text-xl font-bold ${k.color}`}>{fmtShort(k.value)}</p>
              : <div className="h-7 w-24 bg-slate-100 animate-pulse rounded mt-1" />
            }
          </div>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search description, party, ref…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-slate-50"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-slate-400" />
            {[
              { val: 'All', label: 'All' },
              { val: 'credit', label: '↑ Income' },
              { val: 'debit', label: '↓ Expense' },
            ].map(({ val, label }) => (
              <button
                key={val}
                onClick={() => { setTypeFilter(val); setPage(1) }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${typeFilter === val
                    ? val === 'credit' ? 'bg-emerald-600 text-white'
                      : val === 'debit' ? 'bg-red-500 text-white'
                        : 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-3">
            <p className="text-xs text-slate-400">{totalCount} entries</p>
            <button className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
              <Download size={14} /> Export
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              {['Date', 'Description', 'Category', 'Branch', 'Mode', 'Created By', 'Status', 'Amount', 'Actions'].map(h => (
                <th
                  key={h}
                  className={`px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider ${h === 'Amount' || h === 'Actions' ? 'text-right' : 'text-left'
                    }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={9} className="py-16 text-center">
                <Loader2 size={22} className="animate-spin text-slate-300 mx-auto" />
              </td></tr>
            )}
            {!loading && entries.length === 0 && (
              <tr><td colSpan={9} className="py-16 text-center text-slate-400 text-sm">
                No transactions found{selectedBranch ? ' for this branch' : ''}.
              </td></tr>
            )}
            {!loading && entries.map((e, i) => {
              const credit = e.type === 'credit'
              const cancelled = e.status === 'cancelled'
              const isPending = e.status === 'pending'
              const isDue = e.is_due_pending  // from serializer

              return (
                <tr
                  key={e.id || i}
                  className={`border-b border-slate-50 hover:bg-slate-50/70 transition-colors ${cancelled ? 'opacity-50' : ''} ${isDue ? 'bg-amber-50/20' : ''}`}
                >
                  <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{fmtDate(e.date)}</td>
                  <td className="px-4 py-3 max-w-[180px]">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center ${credit ? 'bg-emerald-50' : 'bg-red-50'}`}>
                        {credit
                          ? <ArrowDownLeft size={11} className="text-emerald-600" />
                          : <ArrowUpRight size={11} className="text-red-500" />
                        }
                      </div>
                      <div className="min-w-0">
                        <p className="text-slate-800 font-medium truncate text-xs">{e.description || e.party_name || '—'}</p>
                        {e.party_name && e.description && (
                          <p className="text-[10px] text-slate-400 truncate">{e.party_name}</p>
                        )}
                        {cancelled && (
                          <span className="text-[9px] font-semibold text-red-400 uppercase tracking-wide">cancelled</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[11px] rounded-md font-medium">
                      {e.category_name || (credit ? 'Income' : 'Expense')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{e.branch_name || '—'}</td>
                  <td className="px-4 py-3 text-slate-500 text-[11px] capitalize">
                    {(e.payment_mode || '').replace('_', ' ') || '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-[11px] whitespace-nowrap">
                    {e.created_by_name || '—'}
                  </td>

                  {/* Status badge */}
                  <td className="px-4 py-3">
                    {cancelled ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-semibold rounded-full">
                        Cancelled
                      </span>
                    ) : isPending ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-semibold rounded-full">
                        <Clock size={9} />
                        {isDue ? (credit ? 'Receivable' : 'Payable') : 'Pending'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-semibold rounded-full">
                        <CheckCircle2 size={9} /> Confirmed
                      </span>
                    )}
                  </td>

                  <td className={`px-4 py-3 text-right font-bold text-sm ${isPending ? 'text-slate-400 line-through' : credit ? 'text-emerald-600' : 'text-red-500'
                    }`}>
                    {credit ? '+' : '-'}{fmt(e.amount)}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {/* Mark as Done — for all pending entries */}
                      {isPending && !cancelled && (
                        <button
                          title={credit ? 'Mark as Received' : 'Mark as Paid'}
                          onClick={() => setMarkDoneEntry(e)}
                          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-colors ${credit
                              ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                              : 'bg-blue-50 hover:bg-blue-100 text-blue-700'
                            }`}
                        >
                          <CheckCircle2 size={11} />
                          {credit ? 'Received' : 'Paid'}
                        </button>
                      )}
                      <button
                        title="Edit"
                        onClick={() => { setEditEntry(e); setShowModal(true) }}
                        disabled={cancelled}
                        className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        title="Cancel entry"
                        onClick={() => setDeleteEntry(e)}
                        disabled={cancelled}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-xs text-slate-400">
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalCount)} of {totalCount}
          </p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40">
              <ChevronLeft size={14} className="text-slate-600" />
            </button>
            <span className="text-xs font-medium text-slate-600">Page {page} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40">
              <ChevronRight size={14} className="text-slate-600" />
            </button>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <TransactionModal
          onClose={() => { setShowModal(false); setEditEntry(null) }}
          onSaved={handleSaved}
          branches={branches}
          selectedBranchId={selectedBranch || ''}
          editEntry={editEntry}
        />
      )}

      {/* Delete Confirm */}
      {deleteEntry && (
        <DeleteConfirmDialog
          entry={deleteEntry}
          onConfirm={handleDelete}
          onCancel={() => setDeleteEntry(null)}
          deleting={deleting}
        />
      )}

      {/* Mark-as-Done Dialog */}
      {markDoneEntry && (
        <MarkDoneDialog
          entry={markDoneEntry}
          onConfirm={handleMarkDone}
          onCancel={() => { setMarkDoneEntry(null); setMarkDoneError('') }}
          marking={marking}
          error={markDoneError}
        />
      )}
    </div>
  )
}
