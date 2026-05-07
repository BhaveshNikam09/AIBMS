import { useState, useEffect, useRef } from 'react'
import {
  Upload, FileText, Eye, Download, Search, Tag,
  Calendar, CheckCircle2, Loader2, X, AlertTriangle,
  RefreshCw, Zap, BookOpen, Archive, ChevronRight,
  IndianRupee, Building2, Hash, CreditCard, ArrowUpRight,
} from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'
const getBizId = () => localStorage.getItem('business_id') || ''
const getToken = () => localStorage.getItem('access_token') || ''
const authHeaders = () => ({ 'Authorization': `Bearer ${getToken()}` })
const jsonHeaders = () => ({ ...authHeaders(), 'Content-Type': 'application/json' })

const fmtDate = iso => {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}
const fmtSize = bytes => {
  if (!bytes) return '—'
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(0)} KB`
  return `${bytes} B`
}
const fmtRupee = n =>
  n != null ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n) : '—'

// ── Field label prettifier ────────────────────────────────────────────────────
const FIELD_LABELS = {
  document_type: 'Document Type',
  vendor_name: 'Vendor / Party',
  vendor_gstin: 'Vendor GSTIN',
  bill_number: 'Bill / Invoice No.',
  bill_date: 'Bill Date',
  due_date: 'Due Date',
  subtotal: 'Subtotal',
  tax_amount: 'Tax Amount',
  total_amount: 'Total Amount',
  currency: 'Currency',
  payment_mode: 'Payment Mode',
  payment_status: 'Payment Status',
  notes: 'Notes',
  confidence_score: 'Confidence Score',
}
const SKIP_FIELDS = new Set(['is_bill', 'line_items', 'raw_text', '_cashbook_error', 'summary', 'important_information'])

// ── Upload Zone ───────────────────────────────────────────────────────────────
function UploadZone({ onUploaded }) {
  const inputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)

  async function uploadFile(file) {
    if (!file) return
    setUploading(true); setError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('title', file.name.replace(/\.[^.]+$/, '') || file.name)
      const res = await fetch(`${API_BASE}/api/v1/documents/${getBizId()}/files/`, {
        method: 'POST', headers: authHeaders(), body: fd,
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d?.message || `Upload failed (${res.status})`)
      }
      onUploaded()
    } catch (err) {
      setError(err.message || 'Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div
      onClick={() => !uploading && inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { e.preventDefault(); setDragOver(false); uploadFile(e.dataTransfer.files[0]) }}
      className={`m-3 p-4 border-2 border-dashed rounded-xl text-center cursor-pointer transition-colors ${dragOver ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100'
        }`}
    >
      <input ref={inputRef} type="file" accept=".pdf,.png,.jpg,.jpeg"
        className="hidden" onChange={e => uploadFile(e.target.files[0])} />
      {uploading
        ? <Loader2 size={18} className="text-blue-500 mx-auto mb-1.5 animate-spin" />
        : <Upload size={18} className="text-slate-400 mx-auto mb-1.5" />
      }
      <p className="text-xs font-medium text-slate-600">
        {uploading ? 'Uploading…' : 'Drop file or click to upload'}
      </p>
      <p className="text-[10px] text-slate-400 mt-0.5">PDF, PNG, JPG up to 25 MB</p>
      {error && <p className="text-[10px] text-red-500 mt-1">{error}</p>}
    </div>
  )
}

// ── Cashbook Confirm Modal ─────────────────────────────────────────────────────
function CashbookConfirmModal({ extracted, onConfirm, onCancel, pushing }) {
  const [date, setDate] = useState(extracted.bill_date || extracted.due_date || new Date().toISOString().split('T')[0])
  const [amount, setAmount] = useState(extracted.total_amount || '')
  const [party, setParty] = useState(extracted.vendor_name || '')
  const [ref, setRef] = useState(extracted.bill_number || '')
  const [payMode, setPayMode] = useState(extracted.payment_mode || 'cash')
  const [description, setDesc] = useState('')
  const [entryType, setEntryType] = useState(extracted.is_bill === false ? 'credit' : 'debit')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
            <BookOpen size={18} className="text-blue-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Push to Cashbook</h3>
            <p className="text-xs text-slate-400 mt-0.5">Review and confirm the extracted details before saving</p>
          </div>
          <button onClick={onCancel} className="ml-auto p-1.5 hover:bg-slate-100 rounded-lg">
            <X size={15} className="text-slate-400" />
          </button>
        </div>

        {/* Entry Type Selector */}
        <div className="mb-4 flex items-center p-1 bg-slate-100 rounded-xl">
          <button
            onClick={() => setEntryType('credit')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${entryType === 'credit' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Income (Credit)
          </button>
          <button
            onClick={() => setEntryType('debit')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${entryType === 'debit' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Expense (Debit)
          </button>
        </div>

        <div className="space-y-3">
          {/* Amount */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Amount (₹) *</label>
            <div className="relative">
              <IndianRupee size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
          </div>

          {/* Party */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Vendor / Party</label>
            <div className="relative">
              <Building2 size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" value={party} onChange={e => setParty(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
          </div>

          {/* Date + Reference side by side */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Date *</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Reference No.</label>
              <div className="relative">
                <Hash size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" value={ref} onChange={e => setRef(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
              </div>
            </div>
          </div>

          {/* Payment mode */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Payment Mode</label>
            <div className="relative">
              <CreditCard size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <select value={payMode} onChange={e => setPayMode(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-white">
                {['cash', 'upi', 'bank_transfer', 'cheque', 'card', 'other'].map(m => (
                  <option key={m} value={m}>{m.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Description (optional)</label>
            <input type="text" value={description} onChange={e => setDesc(e.target.value)}
              placeholder={`Bill from ${party || 'vendor'}`}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
          </div>
        </div>

        <div className="flex gap-3 mt-5">
          <button onClick={onCancel}
            className="flex-1 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl">
            Cancel
          </button>
          <button
            onClick={() => onConfirm({ type: entryType, amount, party, date, ref, payMode, description })}
            disabled={!amount || !date || pushing}
            className="flex-1 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {pushing ? <Loader2 size={14} className="animate-spin" /> : <BookOpen size={14} />}
            {pushing ? 'Saving…' : 'Add to Cashbook'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function DocumentIntelligence() {
  const [documents, setDocuments] = useState([])
  const [selectedDoc, setSelectedDoc] = useState(null)
  const [extracted, setExtracted] = useState(null)   // null = not yet analysed
  const [search, setSearch] = useState('')
  const [loadingDocs, setLoadingDocs] = useState(true)
  const [loadingFields, setLoadingFields] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState('')
  const [showCashbookModal, setShowCashbookModal] = useState(false)
  const [pushing, setPushing] = useState(false)
  const [toastMsg, setToastMsg] = useState('')
  const [toastType, setToastType] = useState('success') // 'success' | 'error'

  function toast(msg, type = 'success') {
    setToastMsg(msg); setToastType(type)
    setTimeout(() => setToastMsg(''), 4000)
  }

  // ── Load document list ──────────────────────────────────────────────────────
  function loadDocuments() {
    if (!getBizId()) { setLoadingDocs(false); return }
    setLoadingDocs(true)
    fetch(`${API_BASE}/api/v1/documents/${getBizId()}/files/`, { headers: authHeaders() })
      .then(r => r.json())
      .then(data => {
        const list = Array.isArray(data) ? data
          : Array.isArray(data?.data) ? data.data
            : (data?.data?.results ?? data?.results ?? [])
        setDocuments(list)
        if (list.length > 0 && !selectedDoc) setSelectedDoc(list[0])
      })
      .catch(() => { })
      .finally(() => setLoadingDocs(false))
  }

  useEffect(() => { loadDocuments() }, [])

  // ── When doc changes, reset extracted state ─────────────────────────────────
  useEffect(() => {
    setExtracted(null)
    setAnalyzeError('')
    if (!selectedDoc?.id) return

    // If doc already has extracted_data cached, show it immediately
    if (selectedDoc.extracted_data && Object.keys(selectedDoc.extracted_data).length) {
      setExtracted(selectedDoc.extracted_data)
      return
    }
  }, [selectedDoc?.id])

  // ── AI Analyse ──────────────────────────────────────────────────────────────
  async function analyzeDocument() {
    if (!selectedDoc?.id) return
    setAnalyzing(true)
    setAnalyzeError('')
    setExtracted(null)
    try {
      const res = await fetch(
        `${API_BASE}/api/v1/documents/${getBizId()}/files/${selectedDoc.id}/analyse/`,
        { method: 'POST', headers: jsonHeaders(), body: JSON.stringify({ push_to_cashbook: false }) }
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.message || data?.detail || `Error ${res.status}`)
      }
      const payload = data?.data ?? data
      setExtracted(payload?.extracted || payload)
    } catch (err) {
      setAnalyzeError(err.message || 'Analysis failed. Please try again.')
    } finally {
      setAnalyzing(false)
    }
  }

  // ── Push to Cashbook ────────────────────────────────────────────────────────
  async function handleCashbookPush({ type, amount, party, date, ref, payMode, description }) {
    if (!selectedDoc?.id) return
    setPushing(true)
    try {
      const res = await fetch(
        `${API_BASE}/api/v1/cashbook/${getBizId()}/entries/`,
        {
          method: 'POST',
          headers: jsonHeaders(),
          body: JSON.stringify({
            type: type,
            amount: parseFloat(amount),
            payment_mode: payMode,
            party_name: party,
            reference_no: ref,
            description: description || `Bill from ${party || 'vendor'} — ${docName(selectedDoc)}`,
            date: date,
            status: 'pending',
          }),
        }
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.message || data?.detail || `Error ${res.status}`)
      }
      setShowCashbookModal(false)
      toast(`✅ Cashbook entry created — ₹${parseFloat(amount).toLocaleString('en-IN')} ${type} added as pending`)
    } catch (err) {
      toast(err.message || 'Failed to create cashbook entry.', 'error')
    } finally {
      setPushing(false)
    }
  }

  // ── Tag & Archive ───────────────────────────────────────────────────────────
  async function handleArchive() {
    if (!selectedDoc?.id) return
    try {
      const res = await fetch(
        `${API_BASE}/api/v1/documents/${getBizId()}/files/${selectedDoc.id}/archive/`,
        { method: 'POST', headers: jsonHeaders() }
      )
      const data = await res.json().catch(() => ({}))
      toast(data?.message || 'Document archived.')
      loadDocuments()
    } catch {
      toast('Archive failed.', 'error')
    }
  }

  // ── Download ────────────────────────────────────────────────────────────────
  function handleDownload() {
    const url = selectedDoc?.file_url || selectedDoc?.file
    if (url) window.open(url, '_blank')
    else toast('File URL not available.', 'error')
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const docName = d => d?.title || d?.file_name || d?.name || 'Untitled'
  const docType = d => d?.category || d?.document_type || d?.type || 'Document'
  const docSize = d => d?.file_size_display || (d?.file_size ? fmtSize(d.file_size) : '—')
  const docDate = d => fmtDate(d?.upload_date || d?.created_at)
  const docTags = d => d?.tags || []
  const docConf = d => d?.confidence_score ?? null
  const docStatus = d => d?.status || 'active'

  const filtered = documents.filter(d => {
    const q = search.toLowerCase()
    return (
      (d.title || d.file_name || '').toLowerCase().includes(q) ||
      (d.category || '').toLowerCase().includes(q)
    )
  })

  const isBill = extracted?.is_bill === true
  const hasExtracted = extracted && Object.keys(extracted).length > 0
  const displayFields = extracted
    ? Object.entries(extracted).filter(([k]) => !SKIP_FIELDS.has(k))
    : []
  const lineItems = extracted?.line_items || []

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-[1600px] mx-auto">

      {/* Toast */}
      {toastMsg && (
        <div className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium max-w-sm border ${toastType === 'error'
          ? 'bg-red-50 border-red-200 text-red-700'
          : 'bg-emerald-50 border-emerald-200 text-emerald-700'
          }`}>
          {toastMsg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Document Intelligence</h1>
          <p className="text-sm text-slate-400 mt-0.5">AI-powered document extraction · auto-push bills to cashbook</p>
        </div>
        <button onClick={loadDocuments}
          className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors" title="Refresh">
          <RefreshCw size={15} className="text-slate-500" />
        </button>
      </div>

      <div className="grid grid-cols-12 gap-5">

        {/* ── Left: Document List ──────────────────────────────────────────── */}
        <div className="col-span-5">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">

            {/* Search */}
            <div className="px-4 py-3 border-b border-slate-100">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search documents…"
                  className="w-full pl-8 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
              </div>
            </div>

            {/* Upload */}
            <UploadZone onUploaded={loadDocuments} />

            {/* List */}
            {loadingDocs && (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={20} className="animate-spin text-slate-300" />
              </div>
            )}
            {!loadingDocs && filtered.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-10 px-4">
                {documents.length === 0 ? 'No documents uploaded yet.' : 'No documents match your search.'}
              </p>
            )}
            {!loadingDocs && filtered.map(doc => (
              <button key={doc.id} onClick={() => setSelectedDoc(doc)}
                className={`w-full flex items-start gap-3 px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors text-left ${selectedDoc?.id === doc.id ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''
                  }`}
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${docStatus(doc) === 'archived' ? 'bg-amber-50' : docStatus(doc) === 'expired' ? 'bg-red-50' : 'bg-slate-100'
                  }`}>
                  <FileText size={16} className={
                    docStatus(doc) === 'archived' ? 'text-amber-600' : docStatus(doc) === 'expired' ? 'text-red-500' : 'text-slate-600'
                  } />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-800 truncate">{docName(doc)}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{docType(doc)} · {docSize(doc)} · {docDate(doc)}</p>
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    {docTags(doc).slice(0, 2).map(tag => (
                      <span key={tag} className="px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[10px] rounded font-medium">{tag}</span>
                    ))}
                    {docStatus(doc) === 'archived' && (
                      <span className="px-1.5 py-0.5 bg-amber-50 text-amber-600 text-[10px] rounded font-medium">Archived</span>
                    )}
                    {docConf(doc) != null && (
                      <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 text-[10px] rounded font-medium flex items-center gap-0.5">
                        <CheckCircle2 size={9} /> {docConf(doc)}%
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Right: Analysis Panel ───────────────────────────────────────── */}
        <div className="col-span-7 flex flex-col gap-4">

          {!selectedDoc ? (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex items-center justify-center py-24">
              <div className="text-center">
                <FileText size={32} className="text-slate-200 mx-auto mb-3" />
                <p className="text-sm text-slate-400">Select a document to analyse</p>
              </div>
            </div>
          ) : (
            <>
              {/* Document Header Card */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 truncate">{docName(selectedDoc)}</p>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <Calendar size={11} /> {docDate(selectedDoc)}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <Tag size={11} /> {docType(selectedDoc)}
                      </span>
                      {extracted?.confidence_score != null && (
                        <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                          <CheckCircle2 size={11} /> {extracted.confidence_score}% confidence
                        </span>
                      )}
                      {isBill && (
                        <span className="px-2 py-0.5 bg-red-50 text-red-600 text-[10px] font-bold rounded-full flex items-center gap-1">
                          <ArrowUpRight size={9} /> Bill Detected
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {(selectedDoc.file_url || selectedDoc.file) && (
                      <a href={selectedDoc.file_url || selectedDoc.file} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50">
                        <Eye size={13} /> Preview
                      </a>
                    )}
                    {/* <button onClick={handleDownload}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50">
                      <Download size={13} /> Download
                    </button> */}
                    <button onClick={analyzeDocument} disabled={analyzing}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 disabled:opacity-50">
                      {analyzing
                        ? <><Loader2 size={12} className="animate-spin" /> Analysing…</>
                        : <><Zap size={12} /> {hasExtracted ? 'Re-Analyse' : 'Analyse'}</>
                      }
                    </button>
                  </div>
                </div>

                {/* Extracted Fields */}
                <div className="p-5">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">
                    AI Extracted Fields
                  </p>

                  {/* Idle state */}
                  {!analyzing && !hasExtracted && !analyzeError && (
                    <div className="py-10 text-center">
                      <Zap size={28} className="text-slate-200 mx-auto mb-3" />
                      <p className="text-sm text-slate-400 mb-1">Ready to analyse</p>
                      <p className="text-xs text-slate-300">Click <span className="font-semibold text-slate-400">Analyse</span> to extract fields using AI</p>
                    </div>
                  )}

                  {/* Analysing spinner */}
                  {analyzing && (
                    <div className="py-10 flex flex-col items-center gap-3">
                      <Loader2 size={24} className="animate-spin text-blue-400" />
                      <p className="text-sm text-slate-400">Reading document with AI…</p>
                      <p className="text-xs text-slate-300">This may take a few seconds</p>
                    </div>
                  )}

                  {/* Error */}
                  {analyzeError && !analyzing && (
                    <div className="py-4 px-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3">
                      <AlertTriangle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-red-700">Analysis failed</p>
                        <p className="text-xs text-red-500 mt-0.5">{analyzeError}</p>
                      </div>
                    </div>
                  )}

                  {/* Bill banner */}
                  {hasExtracted && isBill && !analyzing && (
                    <div className="mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                          <BookOpen size={13} className="text-amber-600" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-800">Bill / Invoice detected</p>
                          <p className="text-[11px] text-slate-500">
                            {extracted.total_amount != null ? `Total: ${fmtRupee(extracted.total_amount)}` : ''}
                            {extracted.vendor_name ? ` · ${extracted.vendor_name}` : ''}
                          </p>
                        </div>
                      </div>
                      <button onClick={() => setShowCashbookModal(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg whitespace-nowrap transition-colors">
                        <BookOpen size={12} /> Push to Cashbook
                      </button>
                    </div>
                  )}

                  {/* Extracted field grid */}
                  {hasExtracted && !analyzing && (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        {displayFields.map(([key, val]) => {
                          const label = FIELD_LABELS[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                          const isAmount = ['subtotal', 'tax_amount', 'total_amount'].includes(key)
                          const displayVal = val == null || val === '' ? '—'
                            : isAmount ? fmtRupee(val)
                              : key.includes('date') ? fmtDate(val)
                                : String(val)
                          return (
                            <div key={key} className={`p-3 rounded-lg border ${key === 'total_amount' ? 'border-blue-100 bg-blue-50 col-span-2' : 'border-slate-100 bg-slate-50'
                              }`}>
                              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
                              <p className={`text-sm font-semibold truncate ${key === 'total_amount' ? 'text-blue-700 text-base' : 'text-slate-800'
                                }`} title={displayVal}>{displayVal}</p>
                            </div>
                          )
                        })}
                      </div>

                      {/* Summary for non-bills */}
                      {extracted?.summary && (
                        <div className="mt-4 p-3 rounded-lg border border-slate-100 bg-slate-50">
                          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Summary</p>
                          <p className="text-sm text-slate-800 leading-relaxed">{extracted.summary}</p>
                        </div>
                      )}

                      {/* Important Information */}
                      {extracted?.important_information && Array.isArray(extracted.important_information) && extracted.important_information.length > 0 && (
                        <div className="mt-4 p-3 rounded-lg border border-slate-100 bg-slate-50">
                          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Important Information</p>
                          <ul className="list-disc pl-5 space-y-1">
                            {extracted.important_information.map((info, i) => (
                              <li key={i} className="text-sm text-slate-700">{info}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Line items table */}
                      {lineItems.length > 0 && (
                        <div className="mt-4">
                          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Line Items</p>
                          <div className="border border-slate-100 rounded-lg overflow-hidden">
                            <table className="w-full text-xs">
                              <thead className="bg-slate-50 border-b border-slate-100">
                                <tr>
                                  {['Description', 'Qty', 'Unit Price', 'Amount'].map(h => (
                                    <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {lineItems.map((item, i) => (
                                  <tr key={i} className="border-b border-slate-50 last:border-0">
                                    <td className="px-3 py-2 text-slate-700">{item.description || '—'}</td>
                                    <td className="px-3 py-2 text-slate-500">{item.quantity ?? '—'}</td>
                                    <td className="px-3 py-2 text-slate-500">{item.unit_price != null ? fmtRupee(item.unit_price) : '—'}</td>
                                    <td className="px-3 py-2 font-semibold text-slate-700">{item.amount != null ? fmtRupee(item.amount) : '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Quick Actions</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Push to Cashbook', icon: BookOpen, action: () => setShowCashbookModal(true), highlight: isBill && hasExtracted },
                    { label: 'Tag & Archive', icon: Archive, action: handleArchive },
                    // { label: 'Download', icon: Download, action: handleDownload },
                  ].map(({ label, icon: Icon, action, highlight }) => (
                    <button key={label} onClick={action}
                      className={`flex items-center gap-2 px-3 py-2.5 text-xs font-semibold rounded-lg border transition-colors ${highlight
                        ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                        : 'text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                        }`}>
                      <Icon size={13} /> {label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Cashbook Confirm Modal */}
      {showCashbookModal && extracted && (
        <CashbookConfirmModal
          extracted={extracted}
          onConfirm={handleCashbookPush}
          onCancel={() => setShowCashbookModal(false)}
          pushing={pushing}
        />
      )}
    </div>
  )
}