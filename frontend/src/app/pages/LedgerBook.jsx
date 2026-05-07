import { useState, useEffect, useCallback } from 'react'
import {
  ArrowUpRight, ArrowDownLeft, CheckCircle2, Clock, AlertTriangle,
  Calendar, Filter, Search, Loader2, IndianRupee, X,
  ChevronDown, RefreshCw, BookOpen,
} from 'lucide-react'

const API_BASE    = import.meta.env.VITE_API_BASE || 'http://localhost:8000'
const getBizId    = () => localStorage.getItem('business_id') || ''
const getToken    = () => localStorage.getItem('access_token') || ''
const authHeaders = () => ({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` })

const fmtRupee = n =>
  n != null ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n) : '—'
const fmtDate = iso => {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const daysUntil = (dateStr) => {
  if (!dateStr) return null
  const d = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  return Math.round((d - today) / (1000 * 60 * 60 * 24))
}

// ── Urgency badge ─────────────────────────────────────────────────────────────
function UrgencyBadge({ days }) {
  if (days === null) return <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">No date</span>
  if (days < 0) return (
    <span className="text-[10px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full flex items-center gap-1">
      <AlertTriangle size={10} /> Overdue {Math.abs(days)}d
    </span>
  )
  if (days === 0) return (
    <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full flex items-center gap-1">
      <AlertTriangle size={10} /> Due today
    </span>
  )
  if (days === 1) return (
    <span className="text-[10px] font-bold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full flex items-center gap-1">
      <Clock size={10} /> Due tomorrow
    </span>
  )
  if (days <= 3) return (
    <span className="text-[10px] font-bold text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full flex items-center gap-1">
      <Clock size={10} /> {days} days left
    </span>
  )
  if (days <= 7) return (
    <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full flex items-center gap-1">
      <Clock size={10} /> {days} days left
    </span>
  )
  return (
    <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full flex items-center gap-1">
      <Calendar size={10} /> {days} days left
    </span>
  )
}

// ── Quick-View Stat Card ──────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, color, bgColor, borderColor, sub }) {
  return (
    <div className={`flex-1 min-w-[200px] bg-white border rounded-xl p-5 shadow-sm ${borderColor}`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${bgColor}`}>
          <Icon size={16} className={color} />
        </div>
      </div>
      <p className={`text-2xl font-bold tracking-tight ${color}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  )
}

// ── Confirm Modal ─────────────────────────────────────────────────────────────
function ConfirmModal({ entry, onConfirm, onCancel, loading }) {
  const isRcv = entry.type === 'credit'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isRcv ? 'bg-emerald-50' : 'bg-blue-50'}`}>
            {isRcv
              ? <ArrowDownLeft size={18} className="text-emerald-600" />
              : <ArrowUpRight size={18} className="text-blue-600" />
            }
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Mark as Completed</h3>
            <p className="text-xs text-slate-400 mt-0.5">This will settle this entry and move it to your Cashbook</p>
          </div>
          <button onClick={onCancel} className="ml-auto p-1.5 hover:bg-slate-100 rounded-lg">
            <X size={15} className="text-slate-400" />
          </button>
        </div>

        <div className={`mb-4 px-4 py-3 rounded-lg border flex items-center gap-2 ${
          isRcv ? 'bg-emerald-50 border-emerald-100' : 'bg-blue-50 border-blue-100'
        }`}>
          <CheckCircle2 size={14} className={isRcv ? 'text-emerald-600' : 'text-blue-600'} />
          <p className="text-xs leading-relaxed">
            <span className="font-bold">{entry.party_name || 'Unknown'}</span>
            {' · '}
            <span className="font-bold">{fmtRupee(parseFloat(entry.amount || 0))}</span>
            {' · '}
            <span className={`font-semibold ${isRcv ? 'text-emerald-700' : 'text-blue-700'}`}>
              {isRcv ? 'Receivable (Credit)' : 'Payable (Debit)'}
            </span>
          </p>
        </div>

        <p className="text-xs text-slate-500 mb-5 leading-relaxed">
          Once marked complete, this entry's status will change to <strong>Confirmed</strong> in
          your Digital Cashbook with today as the settlement date.
        </p>

        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 py-2.5 text-sm font-semibold text-white rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 ${
              isRcv ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            {loading ? 'Processing…' : 'Mark Complete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── FILTER OPTIONS ────────────────────────────────────────────────────────────
const URGENCY_FILTERS = [
  { id: 'all',       label: 'All Pending',     fn: () => true                                          },
  { id: 'overdue',   label: 'Overdue',         fn: e => { const d = daysUntil(e.date); return d !== null && d < 0 }  },
  { id: 'today',     label: 'Due Today',       fn: e => daysUntil(e.date) === 0                         },
  { id: '1day',      label: '≤ 1 Day Left',    fn: e => { const d = daysUntil(e.date); return d !== null && d <= 1 } },
  { id: '2days',     label: '≤ 2 Days Left',   fn: e => { const d = daysUntil(e.date); return d !== null && d <= 2 } },
  { id: '3days',     label: '≤ 3 Days Left',   fn: e => { const d = daysUntil(e.date); return d !== null && d <= 3 } },
  { id: '7days',     label: '≤ 7 Days Left',   fn: e => { const d = daysUntil(e.date); return d !== null && d <= 7 } },
]

const TYPE_FILTERS = [
  { id: 'all',      label: 'All Types'   },
  { id: 'debit',    label: 'Payable'     },
  { id: 'credit',   label: 'Receivable'  },
]

// ══════════════════════════════════════════════════════════════════════════════
//  LEDGER BOOK PAGE
// ══════════════════════════════════════════════════════════════════════════════
export function LedgerBook() {
  const [entries,      setEntries]      = useState([])
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [urgencyFilter, setUrgencyFilter] = useState('all')
  const [typeFilter,   setTypeFilter]   = useState('all')
  const [confirmEntry, setConfirmEntry] = useState(null)
  const [marking,      setMarking]      = useState(false)
  const [toastMsg,     setToastMsg]     = useState('')
  const [toastType,    setToastType]    = useState('success')
  const [showFilterDrop, setShowFilterDrop] = useState(false)

  function toast(msg, type = 'success') {
    setToastMsg(msg); setToastType(type)
    setTimeout(() => setToastMsg(''), 4000)
  }

  // ── Load pending entries ─────────────────────────────────────────────────
  const loadEntries = useCallback(() => {
    const bizId = getBizId()
    if (!bizId) { setLoading(false); return }
    setLoading(true)

    // Try pending-dues first, fallback to filtered entries
    fetch(`${API_BASE}/api/v1/cashbook/${bizId}/entries/pending-dues/`, { headers: authHeaders() })
      .then(r => r.json())
      .then(raw => {
        const d    = raw.data || raw
        const list = d.entries || []
        if (list.length > 0) return list
        // Fallback
        return fetch(`${API_BASE}/api/v1/cashbook/${bizId}/entries/?status=pending&page_size=200`, { headers: authHeaders() })
          .then(r => r.json())
          .then(raw2 => {
            const d2 = raw2.data || raw2
            return (d2.results || (Array.isArray(d2) ? d2 : [])).filter(e => e.status === 'pending')
          })
      })
      .then(list => setEntries(Array.isArray(list) ? list : []))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadEntries() }, [loadEntries])

  // ── Mark as complete ─────────────────────────────────────────────────────
  async function handleMarkComplete() {
    if (!confirmEntry) return
    setMarking(true)
    try {
      const res = await fetch(
        `${API_BASE}/api/v1/cashbook/${getBizId()}/entries/${confirmEntry.id}/mark-done/`,
        { method: 'POST', headers: authHeaders() }
      )
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d?.message || d?.detail || `Error ${res.status}`)
      }
      const isRcv = confirmEntry.type === 'credit'
      toast(`✅ ${isRcv ? 'Receivable' : 'Payable'} settled — ${fmtRupee(parseFloat(confirmEntry.amount))} moved to Cashbook`)
      setConfirmEntry(null)
      loadEntries()
    } catch (err) {
      toast(err.message || 'Failed to mark entry as complete.', 'error')
    } finally {
      setMarking(false)
    }
  }

  // ── Compute stats ────────────────────────────────────────────────────────
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().split('T')[0]

  const totalPayable   = entries.filter(e => e.type === 'debit').reduce((s, e) => s + parseFloat(e.amount || 0), 0)
  const totalReceivable = entries.filter(e => e.type === 'credit').reduce((s, e) => s + parseFloat(e.amount || 0), 0)
  const dueToday       = entries.filter(e => {
    if (!e.date) return false
    return e.date === todayStr || daysUntil(e.date) === 0
  })
  const dueTodayCount  = dueToday.length
  const dueTodayAmount = dueToday.reduce((s, e) => s + parseFloat(e.amount || 0), 0)

  // ── Apply filters ────────────────────────────────────────────────────────
  const urgencyFn = URGENCY_FILTERS.find(f => f.id === urgencyFilter)?.fn || (() => true)

  const filtered = entries.filter(entry => {
    // Type filter
    if (typeFilter !== 'all' && entry.type !== typeFilter) return false
    // Urgency filter
    if (!urgencyFn(entry)) return false
    // Search
    if (search) {
      const q = search.toLowerCase()
      const match = (
        (entry.party_name || '').toLowerCase().includes(q) ||
        (entry.description || '').toLowerCase().includes(q) ||
        (entry.reference_no || '').toLowerCase().includes(q)
      )
      if (!match) return false
    }
    return true
  })

  // Sort: overdue first, then by ascending date
  const sorted = [...filtered].sort((a, b) => {
    const da = daysUntil(a.date) ?? 9999
    const db = daysUntil(b.date) ?? 9999
    return da - db
  })

  const activeUrgencyLabel = URGENCY_FILTERS.find(f => f.id === urgencyFilter)?.label || 'All Pending'

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-[1400px] mx-auto">

      {/* Toast */}
      {toastMsg && (
        <div className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium max-w-sm border ${
          toastType === 'error'
            ? 'bg-red-50 border-red-200 text-red-700'
            : 'bg-emerald-50 border-emerald-200 text-emerald-700'
        }`}>
          {toastMsg}
        </div>
      )}

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <BookOpen size={22} className="text-blue-600" />
            Ledger Book
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">Track pending payables &amp; receivables · mark complete to settle in Cashbook</p>
        </div>
        <button onClick={loadEntries}
          className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors" title="Refresh">
          <RefreshCw size={15} className="text-slate-500" />
        </button>
      </div>

      {/* ── Quick View Stats ────────────────────────────────────────────────── */}
      <div className="flex gap-4 mb-6 flex-wrap">
        <StatCard
          label="Total Payable"
          value={fmtRupee(totalPayable)}
          icon={ArrowUpRight}
          color="text-red-600"
          bgColor="bg-red-50"
          borderColor="border-red-100"
          sub={`${entries.filter(e => e.type === 'debit').length} pending payments`}
        />
        <StatCard
          label="Total Receivable"
          value={fmtRupee(totalReceivable)}
          icon={ArrowDownLeft}
          color="text-emerald-600"
          bgColor="bg-emerald-50"
          borderColor="border-emerald-100"
          sub={`${entries.filter(e => e.type === 'credit').length} expected receipts`}
        />
        <StatCard
          label="Due Today"
          value={dueTodayCount}
          icon={AlertTriangle}
          color="text-amber-600"
          bgColor="bg-amber-50"
          borderColor="border-amber-100"
          sub={dueTodayCount > 0 ? `Worth ${fmtRupee(dueTodayAmount)}` : 'No dues today 🎉'}
        />
      </div>

      {/* ── Filters Bar ─────────────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm mb-5">
        <div className="px-4 py-3 flex items-center gap-3 flex-wrap">

          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by party, description, reference…"
              className="w-full pl-8 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
          </div>

          {/* Type filter pills */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg p-1">
            {TYPE_FILTERS.map(f => (
              <button key={f.id} onClick={() => setTypeFilter(f.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  typeFilter === f.id
                    ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                    : 'text-slate-500 hover:text-slate-700'
                }`}>
                {f.label}
              </button>
            ))}
          </div>

          {/* Urgency filter dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowFilterDrop(!showFilterDrop)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 bg-white transition-colors"
            >
              <Filter size={13} />
              {activeUrgencyLabel}
              <ChevronDown size={12} />
            </button>
            {showFilterDrop && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-lg border border-slate-200 z-50 py-1 overflow-hidden">
                {URGENCY_FILTERS.map(f => (
                  <button key={f.id}
                    onClick={() => { setUrgencyFilter(f.id); setShowFilterDrop(false) }}
                    className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                      urgencyFilter === f.id
                        ? 'bg-blue-50 text-blue-700 font-semibold'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {f.label}
                    {urgencyFilter === f.id && <CheckCircle2 size={13} className="inline ml-2" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Count badge */}
          <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2.5 py-1.5 rounded-lg">
            {sorted.length} {sorted.length === 1 ? 'entry' : 'entries'}
          </span>
        </div>
      </div>

      {/* ── Entries List ────────────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">

        {/* Table header */}
        <div className="grid grid-cols-12 gap-3 px-5 py-3 border-b border-slate-100 bg-slate-50">
          <div className="col-span-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Type</div>
          <div className="col-span-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Party / Description</div>
          <div className="col-span-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Amount</div>
          <div className="col-span-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Due Date</div>
          <div className="col-span-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Urgency</div>
          <div className="col-span-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider text-right">Action</div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-16 gap-2">
            <Loader2 size={20} className="animate-spin text-slate-300" />
            <p className="text-sm text-slate-400">Loading ledger…</p>
          </div>
        )}

        {/* Empty */}
        {!loading && sorted.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <CheckCircle2 size={32} className="text-emerald-300" />
            <p className="text-sm font-medium text-slate-500">
              {entries.length === 0 ? 'No pending entries' : 'No entries match your filters'}
            </p>
            <p className="text-xs text-slate-400">
              {entries.length === 0 ? 'All payables and receivables are settled 🎉' : 'Try adjusting your filter or search.'}
            </p>
          </div>
        )}

        {/* Rows */}
        {!loading && sorted.map(entry => {
          const isRcv  = entry.type === 'credit'
          const amount = parseFloat(entry.amount || 0)
          const days   = daysUntil(entry.date)
          const isOvd  = days !== null && days < 0

          return (
            <div key={entry.id}
              className={`grid grid-cols-12 gap-3 px-5 py-3.5 border-b border-slate-50 hover:bg-slate-50/80 transition-colors items-center ${
                isOvd ? 'bg-red-50/30' : ''
              }`}
            >
              {/* Type icon */}
              <div className="col-span-1">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  isRcv ? 'bg-emerald-50' : 'bg-blue-50'
                }`}>
                  {isRcv
                    ? <ArrowDownLeft size={15} className="text-emerald-600" />
                    : <ArrowUpRight size={15} className="text-blue-600" />
                  }
                </div>
              </div>

              {/* Party / Description */}
              <div className="col-span-3 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">
                  {entry.party_name || entry.description || (isRcv ? 'Receivable' : 'Payable')}
                </p>
                <p className="text-[11px] text-slate-400 truncate mt-0.5">
                  {entry.description && entry.party_name ? entry.description : ''}
                  {entry.reference_no ? ` · Ref: ${entry.reference_no}` : ''}
                </p>
              </div>

              {/* Amount */}
              <div className="col-span-2">
                <p className={`text-sm font-bold ${isRcv ? 'text-emerald-600' : 'text-red-600'}`}>
                  {isRcv ? '+' : '-'}{fmtRupee(amount)}
                </p>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md mt-0.5 inline-block ${
                  isRcv ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
                }`}>
                  {isRcv ? 'Receivable' : 'Payable'}
                </span>
              </div>

              {/* Due Date */}
              <div className="col-span-2">
                <p className="text-sm text-slate-700">{fmtDate(entry.date)}</p>
              </div>

              {/* Urgency */}
              <div className="col-span-2">
                <UrgencyBadge days={days} />
              </div>

              {/* Action */}
              <div className="col-span-2 text-right">
                <button
                  onClick={() => setConfirmEntry(entry)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <CheckCircle2 size={12} /> Complete
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Confirm Modal ───────────────────────────────────────────────────── */}
      {confirmEntry && (
        <ConfirmModal
          entry={confirmEntry}
          onConfirm={handleMarkComplete}
          onCancel={() => setConfirmEntry(null)}
          loading={marking}
        />
      )}
    </div>
  )
}
