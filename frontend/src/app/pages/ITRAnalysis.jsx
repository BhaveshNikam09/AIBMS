import { useState } from 'react'
import {
  Upload, FileText, CheckCircle2,
  TrendingDown, IndianRupee, AlertCircle, Loader2,
} from 'lucide-react'

const API_BASE    = import.meta.env.VITE_API_BASE || 'http://localhost:8000'
const getBizId = () => localStorage.getItem('business_id') || ''

const getToken    = () => localStorage.getItem('access_token') || ''
const authHeaders = () => ({ Authorization: `Bearer ${getToken()}` })

const fmtInr = n =>
  new Intl.NumberFormat('en-IN', {
    style:                 'currency',
    currency:              'INR',
    maximumFractionDigits: 0,
  }).format(Math.abs(n || 0))

export function ITRAnalysis() {
  const [uploaded,      setUploaded]      = useState(false)
  const [dragging,      setDragging]      = useState(false)
  const [file,          setFile]          = useState(null)
  const [uploading,     setUploading]     = useState(false)
  const [polling,       setPolling]       = useState(false)
  const [error,         setError]         = useState('')

  const [summaryCards,  setSummaryCards]  = useState([])
  const [deductions,    setDeductions]    = useState([])
  const [taxBreakdown,  setTaxBreakdown]  = useState([])

  // ── Upload → poll → fetch analysis ────────────────────────────────────────
  const uploadFile = async selectedFile => {
    setUploading(true); setError('')
    try {
      const fd = new FormData()
      fd.append('file',            selectedFile)
      fd.append('form_type',       'ITR-3')
      fd.append('assessment_year', '2025-26')

      const res  = await fetch(`${API_BASE}/api/v1/itr/${getBizId()}/`, {
        method:  'POST',
        headers: authHeaders(),
        body:    fd,
      })
      if (!res.ok) throw new Error(await res.text())

      const data = await res.json()
      setUploading(false)
      setPolling(true)
      pollStatus(data.data.id)
    } catch {
      setError('Upload failed. Please check the file and try again.')
      setUploading(false)
    }
  }

  const pollStatus = itrId => {
    const interval = setInterval(async () => {
      try {
        const res    = await fetch(
          `${API_BASE}/api/v1/itr/${getBizId()}/${itrId}/status/`,
          { headers: authHeaders() }
        )
        const status = await res.json()
        if (status.data?.status === 'completed') {
          clearInterval(interval)
          setPolling(false)
          fetchAnalysis(itrId)
        }
        if (status.data?.status === 'failed') {
          clearInterval(interval)
          setPolling(false)
          setError('Analysis failed. Please try uploading again.')
        }
      } catch {
        clearInterval(interval)
        setPolling(false)
        setError('Lost connection while processing. Please refresh.')
      }
    }, 3000)
  }

  const fetchAnalysis = async itrId => {
    try {
      const res  = await fetch(
        `${API_BASE}/api/v1/itr/${getBizId()}/${itrId}/analysis/`,
        { headers: authHeaders() }
      )
      const data = await res.json()
      const a    = data.data

      setSummaryCards([
        {
          label:  'Gross Total Income',
          value:  fmtInr(a.gross_total_income),
          sub:    'From ITR',
          icon:   IndianRupee,
          color:  'bg-slate-50 border-slate-200',
          iconBg: 'bg-slate-100 text-slate-600',
        },
        {
          label:  'Tax Liability',
          value:  fmtInr(a.tax_payable),
          sub:    'Calculated',
          icon:   AlertCircle,
          color:  'bg-red-50 border-red-100',
          iconBg: 'bg-red-100 text-red-600',
        },
        {
          label:  'TDS Paid',
          value:  fmtInr(a.tds_amount),
          sub:    'As per ITR',
          icon:   CheckCircle2,
          color:  'bg-emerald-50 border-emerald-100',
          iconBg: 'bg-emerald-100 text-emerald-600',
        },
        {
          label:  'Refund Due',
          value:  fmtInr(a.refund_due),
          sub:    'Estimated refund',
          icon:   TrendingDown,
          color:  'bg-blue-50 border-blue-100',
          iconBg: 'bg-blue-100 text-blue-600',
        },
      ])

      setTaxBreakdown([
        { label: 'Gross Total Income', amount: a.gross_total_income,  type: 'total'     },
        { label: 'Total Deductions',   amount: -a.total_deductions,   type: 'deduction' },
        { label: 'Taxable Income',     amount: a.taxable_income,      type: 'subtotal'  },
        { label: 'Tax Payable',        amount: a.tax_payable,         type: 'tax'       },
      ])

      setDeductions(
        (a.tax_saving_tips || []).map((tip, i) => ({
          section:     `Tip ${i + 1}`,
          description: tip,
          claimed:     0,
          max:         null,
          pct:         null,
        }))
      )

      setUploaded(true)
    } catch {
      setError('Failed to load analysis results.')
    }
  }

  const handleFile = f => {
    if (!f) return
    setFile(f)
    uploadFile(f)
  }

  const reset = () => {
    setUploaded(false); setFile(null); setError('')
    setSummaryCards([]); setDeductions([]); setTaxBreakdown([])
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-[1600px] mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">ITR Analysis</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Upload ITR documents for AI-powered tax extraction &amp; analysis
          </p>
        </div>
        {uploaded && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-lg">
            <CheckCircle2 size={14} className="text-emerald-600" />
            <span className="text-xs font-medium text-emerald-700">ITR Loaded</span>
          </div>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-5 flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
          <AlertCircle size={15} className="flex-shrink-0" />
          {error}
          <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600 text-xs underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Upload Area */}
      {!uploaded && !uploading && !polling && (
        <div
          onDragOver  = {e => { e.preventDefault(); setDragging(true) }}
          onDragLeave = {() => setDragging(false)}
          onDrop      = {e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]) }}
          className   = {`border-2 border-dashed rounded-xl p-12 mb-6 text-center transition-colors ${
            dragging
              ? 'border-blue-400 bg-blue-50'
              : 'border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50'
          }`}
        >
          <input
            type     = "file"
            className= "hidden"
            id       = "itr-upload"
            accept   = ".pdf,.xml"
            onChange = {e => handleFile(e.target.files[0])}
          />
          <label htmlFor="itr-upload" className="cursor-pointer">
            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Upload size={22} className="text-slate-500" />
            </div>
            <p className="text-sm font-semibold text-slate-700 mb-1">
              Drop your ITR document here
            </p>
            <p className="text-xs text-slate-400 mb-4">
              Supports ITR-1, ITR-3, ITR-4 · PDF, XML · Max 10 MB
            </p>
            <span className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 inline-block">
              Browse Files
            </span>
          </label>
        </div>
      )}

      {/* Processing state */}
      {(uploading || polling) && (
        <div className="border-2 border-dashed border-blue-200 rounded-xl p-12 mb-6 bg-blue-50 text-center">
          <Loader2 size={28} className="animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-sm font-semibold text-slate-700 mb-1">
            {uploading ? 'Uploading document…' : 'AI is analysing your ITR…'}
          </p>
          <p className="text-xs text-slate-400">
            {uploading ? 'Please wait' : 'This may take a few seconds. Checking every 3s…'}
          </p>
          {file && (
            <p className="text-[11px] text-slate-400 mt-2 font-mono">{file.name}</p>
          )}
        </div>
      )}

      {/* Results */}
      {uploaded && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-4 mb-5">
            {summaryCards.map(card => {
              const Icon = card.icon
              return (
                <div key={card.label} className={`border rounded-xl p-4 shadow-sm ${card.color}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${card.iconBg}`}>
                      <Icon size={16} />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-slate-900 mb-0.5">{card.value}</p>
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{card.label}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{card.sub}</p>
                </div>
              )
            })}
          </div>

          {/* Tax Breakdown */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mb-4">
            <div className="px-5 py-3 border-b border-slate-100">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tax Breakdown</p>
            </div>
            <div className="p-4">
              {taxBreakdown.map((item, i) => (
                <div
                  key       = {i}
                  className = {`flex items-center justify-between py-2.5 ${
                    i < taxBreakdown.length - 1 ? 'border-b border-slate-50' : ''
                  } ${item.type === 'subtotal' || item.type === 'tax' ? 'font-semibold' : ''}`}
                >
                  <span className={`text-sm ${item.type === 'deduction' ? 'text-emerald-700' : 'text-slate-700'}`}>
                    {item.label}
                  </span>
                  <span className={`text-sm font-semibold ${
                    item.type === 'deduction' ? 'text-emerald-600' :
                    item.type === 'tax'       ? 'text-red-600'     : 'text-slate-900'
                  }`}>
                    {item.amount < 0 ? '−' : ''}{fmtInr(item.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Tax Saving Tips */}
          {deductions.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mb-4">
              <div className="px-5 py-3 border-b border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">AI Tax Saving Tips</p>
              </div>
              <div className="divide-y divide-slate-50">
                {deductions.map((d, i) => (
                  <div key={i} className="flex items-start gap-3 px-5 py-3">
                    <div className="w-6 h-6 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                      {i + 1}
                    </div>
                    <p className="text-sm text-slate-700">{d.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Re-upload */}
          <button
            onClick   = {reset}
            className = "flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors"
          >
            <FileText size={13} />
            Upload a different document
          </button>
        </>
      )}
    </div>
  )
}