import { useState, useEffect, useCallback, useRef } from 'react'
import { KpiCard }             from '../components/KpiCard'
import { CashFlowChart }       from '../components/CashFlowChart'
import { AIInsightsPanel }     from '../components/AIInsightsPanel'
import {
  RefreshCw, Loader2, ArrowDownLeft, ArrowUpRight,
  CalendarClock, AlertTriangle, ChevronRight,
} from 'lucide-react'
import { motion } from 'framer-motion'
import {
  getSharedChatSessionId,
  setSharedChatSessionId,
  subscribeSharedChatSession,
} from '../utils/chatSession'
import { canAccess, getStoredRole } from '../utils/rbac'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'
const getBizId = () => localStorage.getItem('business_id') || ''
const getToken = () => localStorage.getItem('access_token') || ''
const authHeaders = () => ({
  'Content-Type':  'application/json',
  'Authorization': `Bearer ${getToken()}`,
})

const PERIODS = [
  { key: 'daily',   label: 'Daily' },
  { key: '1month',  label: '1M'    },
  { key: '3months', label: '3M'    },
  { key: '6months', label: '6M'    },
  { key: '1yr',     label: '1Y'    },
]

function fmtRupee(n) {
  if (n == null || isNaN(n)) return '—'
  if (Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(2)}L`
  if (Math.abs(n) >= 1000)   return `₹${(n / 1000).toFixed(1)}K`
  return `₹${n}`
}

function fmtFull(n) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(n || 0)
}

function fmtDate(iso) {
  return iso
    ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—'
}

const getToday = () => new Date().toLocaleDateString('en-CA')

function daysUntil(dateStr) {
  if (!dateStr) return null
  return Math.round((new Date(dateStr) - new Date(getToday())) / 86400000)
}

function sparkline(val) {
  if (!val) return []
  const base = val * 0.7
  return Array.from({ length: 6 }, (_, i) =>
    Math.round(base + (val - base) * (i / 5))
  )
}

// ── AI response parser (same as AICAChatbot) ──────────────────────────────────
function parseAIResponse(text) {
  if (!text) return null
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const summary = [], points = [], actionSteps = [], examples = []
  let disclaimer = ''
  let mode = 'summary'
  for (const line of lines) {
    const lower = line.toLowerCase()
    if (lower === 'summary') continue
    if (lower === 'key points') continue
    if (lower === 'example') continue
    if (/^\d+[\.\)]?$/.test(lower)) continue
    if (lower.startsWith('|') || lower.includes('---|')) continue
    if (lower.includes('recommended next steps')) { mode = 'actions'; continue }
    if (lower.includes('action steps')) { mode = 'actions'; continue }
    const clean = line
      .replace(/^\*\*(.+)\*\*$/, '$1').replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/^\#{1,3}\s+/, '').replace(/^[\-\*]\s+/, '')
      .replace(/^\d+\.\s+/, '').replace(/^\d+\)\s+/, '')
      .replace(/^summary:\s*/i, '').replace(/^key points:\s*/i, '')
      .replace(/^recommended next steps:\s*/i, '').trim()
    if (!clean) continue
    if (/^\W+$/.test(clean)) continue
    if (clean.toLowerCase().startsWith('disclaimer') || clean.toLowerCase().includes('not a substitute')) {
      disclaimer = clean; continue
    }
    if (
      clean.toLowerCase().startsWith('example') ||
      clean.toLowerCase().startsWith('worked example') ||
      clean.includes('=')
    ) { examples.push(clean); continue }
    const actionWords = ['file ', 'ensure ', 'reconcile ', 'consult ', 'check ', 'pay ', 'submit ', 'review ', 'verify ']
    if (mode === 'actions' || actionWords.some(w => clean.toLowerCase().startsWith(w))) { actionSteps.push(clean); continue }
    if (summary.length < 1) summary.push(clean)
    else points.push(clean)
  }
  return { summary: summary.join(' '), points: points.slice(0, 8), actionSteps: actionSteps.slice(0, 5), examples: examples.slice(0, 3), disclaimer }
}

function AIMessage({ structured, rawText }) {
  if (!structured || (!structured.summary && !structured.points.length)) {
    return <p className="text-sm text-slate-700 leading-relaxed p-3">{rawText}</p>
  }
  return (
    <div className="p-3 flex flex-col gap-2.5">
      {structured.summary && (
        <div className="p-2.5 bg-blue-50 rounded-lg border border-blue-100">
          <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider mb-1">📋 Summary</p>
          <p className="text-xs font-semibold text-slate-800 leading-relaxed">{structured.summary}</p>
        </div>
      )}
      {structured.points.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {structured.points.map((point, i) => (
            <li key={i} className="flex gap-2 text-xs text-slate-600 leading-relaxed">
              <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 text-[9px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i+1}</span>
              {point}
            </li>
          ))}
        </ul>
      )}
      {structured.examples.length > 0 && (
        <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-100">
          <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1">💡 Example</p>
          {structured.examples.map((ex, i) => <p key={i} className="text-xs text-amber-800">{ex}</p>)}
        </div>
      )}
      {structured.actionSteps.length > 0 && (
        <div className="flex flex-col gap-1">
          {structured.actionSteps.map((step, i) => (
            <div key={i} className="flex gap-1.5 items-start p-2 bg-emerald-50 border border-emerald-100 rounded-lg">
              <ChevronRight size={11} className="text-emerald-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs font-medium text-emerald-800">{step}</p>
            </div>
          ))}
        </div>
      )}
      {structured.disclaimer && (
        <p className="text-[10px] text-slate-400 italic border-t border-slate-100 pt-1.5">⚠ {structured.disclaimer}</p>
      )}
    </div>
  )
}

const CHAT_SUGGESTIONS = [
  'Calculate my advance tax for Q4',
  'What deductions can I claim under 80C?',
  'Explain GST composition scheme',
  'TDS rates on professional fees',
  'Due date for GSTR-3B filing',
  'How to reduce my tax liability?',
]

// ── Floating AI Chatbot Panel ─────────────────────────────────────────────────
function AIChatbotPanel({ open, onClose }) {
  const [messages,       setMessages]       = useState([])
  const [input,          setInput]          = useState('')
  const [loading,        setLoading]        = useState(false)
  const [sessionId,      setSessionId]      = useState(() => getSharedChatSessionId() || null)
  const [sessions,       setSessions]       = useState([])
  const [activeSession,  setActiveSession]  = useState(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [showSessions,   setShowSessions]   = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (open) loadSessions()
  }, [open])

  useEffect(() => subscribeSharedChatSession(nextSessionId => {
    setSessionId(nextSessionId || null)
  }), [])

  function loadSessions() {
    if (!getBizId()) return
    fetch(`${API_BASE}/api/v1/chatbot/sessions/`, { headers: authHeaders() })
      .then(r => r.json())
      .then(raw => {
        const list = raw.data || raw.results || (Array.isArray(raw) ? raw : [])
        setSessions(Array.isArray(list) ? list.slice(0, 30) : [])
      })
      .catch(() => {})
  }

  function loadSession(session) {
    setActiveSession(session.id)
    setSessionId(session.id)
    setMessages([])
    setHistoryLoading(true)
    setShowSessions(false)
    fetch(`${API_BASE}/api/v1/chatbot/sessions/${session.id}/`, { headers: authHeaders() })
      .then(r => r.json())
      .then(raw => {
        const sessionData = raw.data || raw
        const msgs = sessionData.messages || []
        const built = []
        for (const m of msgs) {
          if (m.role === 'user') {
            built.push({ id: m.id + '_u', role: 'user', text: m.content || '', time: m.created_at })
          } else if (m.role === 'assistant') {
            built.push({ id: m.id + '_a', role: 'ai', text: m.content || '', structured: parseAIResponse(m.content || ''), time: m.created_at })
          }
        }
        setMessages(built)
      })
      .catch(() => {})
      .finally(() => setHistoryLoading(false))
  }

  function newConversation() {
    setSessionId(null); setActiveSession(null); setMessages([]); setInput(''); setShowSessions(false)
  }

  async function sendMessage(textOverride) {
    const text = (textOverride || input).trim()
    if (!text || loading) return
    setMessages(prev => [...prev, {
      id: Date.now(), role: 'user', text,
      time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    }])
    setInput('')
    setLoading(true)
    try {
      const bizId = getBizId()
      const body = { message: text, business_id: bizId || null }
      if (sessionId) body.session_id = sessionId
      const res  = await fetch(`${API_BASE}/api/v1/chatbot/chat/`, {
        method: 'POST', headers: authHeaders(), body: JSON.stringify(body),
      })
      const raw  = await res.json()
      if (!res.ok) throw new Error(raw.message || raw.detail || 'Failed')
      const data = raw.data || raw
      if (data.session_id) {
        setSessionId(data.session_id)
        setSharedChatSessionId(data.session_id)
      }
      const responseText = data.response || data.message || data.reply || data.answer || 'Sorry, I could not process that.'
      setMessages(prev => [...prev, {
        id: Date.now() + 1, role: 'ai', text: responseText,
        structured: parseAIResponse(responseText),
        time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      }])
      loadSessions()
    } catch {
      setMessages(prev => [...prev, {
        id: Date.now() + 2, role: 'ai',
        text: 'Connection error. Please try again.', structured: null,
        time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop (subtle) */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/10 backdrop-blur-[1px]"
            onClick={onClose}
          />

          {/* Slide-in panel from right */}
          <motion.div
            key="panel"
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0,      opacity: 1 }}
            exit={{ x: '100%',    opacity: 0 }}
            transition={{ type: 'spring', stiffness: 340, damping: 34 }}
            className="fixed top-[60px] right-0 bottom-0 z-50 w-[420px] bg-white border-l border-slate-200 shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-900 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Cpu size={15} className="text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">AI CA Assistant</p>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                    <p className="text-[10px] text-slate-400">Online · Powered by Gemini</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {/* History toggle */}
                <button
                  onClick={() => setShowSessions(s => !s)}
                  title="Chat history"
                  className={`p-1.5 rounded-lg transition-colors ${showSessions ? 'bg-slate-700 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                >
                  <Clock size={15} />
                </button>
                {/* New chat */}
                <button
                  onClick={newConversation}
                  title="New conversation"
                  className="p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white rounded-lg transition-colors"
                >
                  <Plus size={15} />
                </button>
                {/* Close */}
                <button
                  onClick={onClose}
                  className="p-1.5 text-slate-400 hover:bg-slate-800 hover:text-red-400 rounded-lg transition-colors"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Session history drawer */}
            <AnimatePresence>
              {showSessions && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="border-b border-slate-200 bg-slate-50 overflow-hidden flex-shrink-0"
                >
                  <div className="max-h-[200px] overflow-y-auto py-1">
                    <p className="px-4 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Recent Conversations</p>
                    {sessions.length === 0 && (
                      <p className="px-4 py-2 text-xs text-slate-400">No conversations yet.</p>
                    )}
                    {sessions.map(s => (
                      <div
                        key={s.id}
                        onClick={() => loadSession(s)}
                        className={`w-full text-left px-4 py-2.5 hover:bg-white transition-colors border-l-2 cursor-pointer ${
                          activeSession === s.id ? 'border-blue-500 bg-white' : 'border-transparent'
                        }`}
                      >
                        <p className={`text-xs font-semibold truncate ${activeSession === s.id ? 'text-blue-700' : 'text-slate-700'}`}>
                          {s.title || s.first_message || 'Conversation'}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {s.created_at ? new Date(s.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}
                        </p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 bg-slate-50">
              {historyLoading && (
                <div className="flex items-center justify-center h-full">
                  <div className="flex flex-col items-center gap-2 text-slate-400">
                    <Loader2 size={18} className="animate-spin" />
                    <p className="text-xs">Loading conversation…</p>
                  </div>
                </div>
              )}

              {messages.length === 0 && !loading && !historyLoading && (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-4">
                  <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center">
                    <Cpu size={20} className="text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">Ask your CA anything</p>
                    <p className="text-xs text-slate-400 mt-1">GST · TDS · ITR · Advance Tax · Compliance</p>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center mt-1">
                    {CHAT_SUGGESTIONS.map(s => (
                      <button
                        key={s}
                        onClick={() => sendMessage(s)}
                        className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-full hover:bg-slate-50 hover:border-blue-300 transition-colors text-left"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map(msg => (
                <div key={msg.id} className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'ai' ? 'bg-slate-900' : 'bg-blue-600'}`}>
                    {msg.role === 'ai' ? <Cpu size={12} className="text-white" /> : <User size={12} className="text-white" />}
                  </div>
                  <div className={`max-w-[82%] flex flex-col ${msg.role === 'user' ? 'items-end' : ''}`}>
                    {msg.role === 'user'
                      ? <div className="bg-slate-900 text-white px-3 py-2 rounded-2xl rounded-tr-sm text-sm leading-relaxed">{msg.text}</div>
                      : <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm shadow-sm overflow-hidden">
                          <AIMessage structured={msg.structured} rawText={msg.text} />
                        </div>
                    }
                    <div className={`flex items-center gap-1 mt-0.5 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                      <Clock size={9} className="text-slate-300" />
                      <span className="text-[10px] text-slate-300">{msg.time}</span>
                    </div>
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-slate-900 flex items-center justify-center flex-shrink-0">
                    <Cpu size={12} className="text-white" />
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm shadow-sm px-4 py-3 flex items-center gap-2">
                    <Loader2 size={13} className="animate-spin text-slate-400" />
                    <span className="text-xs text-slate-400">Thinking…</span>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Quick suggestions when chatting */}
            {messages.length > 0 && !loading && (
              <div className="px-4 pb-2 pt-1 flex gap-2 flex-wrap border-t border-slate-100 bg-white flex-shrink-0">
                {CHAT_SUGGESTIONS.slice(0, 3).map(s => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="px-2.5 py-1 text-[11px] font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-full hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <div className="bg-white border-t border-slate-200 px-4 py-3 flex-shrink-0">
              <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
                <input
                  value       = {input}
                  onChange    = {e => setInput(e.target.value)}
                  onKeyDown   = {e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  placeholder = "Ask about GST, TDS, ITR, compliance…"
                  className   = "flex-1 bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
                />
                <button
                  onClick   = {() => sendMessage()}
                  disabled  = {!input.trim() || loading}
                  className = "w-7 h-7 bg-slate-900 rounded-lg flex items-center justify-center hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                >
                  {loading
                    ? <Loader2 size={12} className="text-white animate-spin" />
                    : <Send size={12} className="text-white" />
                  }
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1.5 text-center">
                AI responses are informational only. Verify with a qualified CA.
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}


// MarkDoneDialog removed — mark-done is handled exclusively in LedgerBook


// ── Ledger Summary Card ────────────────────────────────────────────────────────
function LedgerSummaryStrip() {
  const [totals,  setTotals]  = useState({ receivable: 0, payable: 0, dueToday: 0, dueTodayAmt: 0, count: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!getBizId()) { setLoading(false); return }
    setLoading(true)

    Promise.all([
      fetch(`${API_BASE}/api/v1/cashbook/${getBizId()}/entries/pending-dues/`, { headers: authHeaders() })
        .then(r => r.json()).catch(() => ({})),
      fetch(`${API_BASE}/api/v1/cashbook/${getBizId()}/entries/?status=pending&page_size=200`, { headers: authHeaders() })
        .then(r => r.json()).catch(() => ({})),
    ]).then(([duesRaw, pendingRaw]) => {
      const d        = duesRaw.data || duesRaw
      const duesList = d.entries || []
      const pd       = pendingRaw.data || pendingRaw
      const allPending = (pd.results || (Array.isArray(pd) ? pd : [])).filter(e => e.status === 'pending')
      const dueIds   = new Set(duesList.map(e => e.id))
      const merged   = [...duesList, ...allPending.filter(e => !dueIds.has(e.id))]

      const todayEntries = merged.filter(e => daysUntil(e.date) === 0)
      setTotals({
        receivable:  merged.filter(e => e.type === 'credit').reduce((s, e) => s + parseFloat(e.amount || 0), 0),
        payable:     merged.filter(e => e.type === 'debit' ).reduce((s, e) => s + parseFloat(e.amount || 0), 0),
        dueToday:    todayEntries.length,
        dueTodayAmt: todayEntries.reduce((s, e) => s + parseFloat(e.amount || 0), 0),
        count:       merged.length,
      })
    })
    .catch(() => {})
    .finally(() => setLoading(false))
  }, [])

  if (!loading && totals.count === 0) return null

  const STATS = [
    {
      label    : 'Total Payable',
      value    : loading ? '—' : fmtRupee(totals.payable),
      sub      : loading ? '' : `${totals.count > 0 ? `${totals.count} pending` : 'No pending'} entries`,
      icon     : ArrowUpRight,
      iconBg   : 'bg-red-50 text-red-600',
    },
    {
      label    : 'Total Receivable',
      value    : loading ? '—' : fmtRupee(totals.receivable),
      sub      : loading ? '' : 'Expected to collect',
      icon     : ArrowDownLeft,
      iconBg   : 'bg-emerald-50 text-emerald-600',
    },
    {
      label    : 'Due Today',
      value    : loading ? '—' : totals.dueToday === 0 ? 'All Clear ✓' : `${totals.dueToday} ${totals.dueToday === 1 ? 'entry' : 'entries'}`,
      sub      : loading ? '' : totals.dueToday > 0 ? `Worth ${fmtRupee(totals.dueTodayAmt)}` : 'No dues today',
      icon     : AlertTriangle,
      iconBg   : totals.dueToday > 0 ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-400',
    },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
    >
      {/* Section header — same style as page header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center">
            <CalendarClock size={15} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">Pending Ledger Overview</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {loading ? 'Loading…' : `${totals.count} pending entries awaiting settlement`}
            </p>
          </div>
        </div>
        <a
          href="/dashboard/ledger"
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-700 rounded-lg transition-all shadow-md hover:shadow-lg active:scale-95"
        >
          Open Ledger Book <ChevronRight size={15} />
        </a>
      </div>

      {/* Three stat cards — same look as KpiCard */}
      <div className="grid grid-cols-3 gap-6">
        {STATS.map((s) => {
          const Icon = s.icon
          return (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="bg-white/80 backdrop-blur-md border border-slate-200/60 rounded-xl p-5 shadow-[0px_2px_4px_rgba(0,0,0,0.02)] transition-shadow duration-300 hover:shadow-md hover:border-slate-300"
            >
              {/* Label */}
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">{s.label}</p>

              {/* Value + icon */}
              <div className="flex items-start justify-between mb-4">
                <p className="text-2xl font-bold text-slate-900 tracking-tight">{s.value}</p>
                <div className={`p-1.5 rounded-md ${s.iconBg}`}>
                  <Icon size={16} strokeWidth={2.5} />
                </div>
              </div>

              {/* Sub text */}
              <p className="text-xs text-slate-400">{s.sub}</p>
            </motion.div>
          )
        })}
      </div>
    </motion.div>
  )
}



// ── Dashboard ─────────────────────────────────────────────────────────────────
export function Dashboard() {
  const [overview,     setOverview]     = useState(null)
  const [cashFlow,     setCashFlow]     = useState([])
  const [businessMeta, setBusinessMeta] = useState({ name: '—', branch: '—', fy: 'FY 2025–26' })
  const [loading,      setLoading]      = useState(true)
  const [refreshKey,   setRefreshKey]   = useState(0)
  const [lastUpdated,  setLastUpdated]  = useState('')
  const [period,       setPeriod]       = useState('6months')
  const [chatOpen,     setChatOpen]     = useState(false)   // kept for AIChatbotPanel
  // replaced by Shell floating button — chatOpen kept but panel hidden
  void setChatOpen  // suppress unused warning
  const role = getStoredRole()

  const load = useCallback(() => {
    if (!getBizId()) { setLoading(false); return }
    setLoading(true)
    fetch(`${API_BASE}/api/v1/dashboard/${getBizId()}/?period=${period}`, { headers: authHeaders() })
      .then(r => r.json())
      .then(res => {
        const data = res.data || res
        setOverview(data)
        setCashFlow(data.cash_flow || [])
        setBusinessMeta({
          name:   data.business_name  || '—',
          branch: data.branch_name    || 'All Branches',
          fy:     data.financial_year || 'FY 2025–26',
        })
        setLastUpdated(
          data.generated_at
            ? new Date(data.generated_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
            : 'just now'
        )
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [refreshKey, period])

  useEffect(() => { load() }, [load])
  function handleRefresh() { setRefreshKey(k => k + 1) }

  const ov = overview?.overview || {}

  const kpiCards = [
    { title: 'Total Revenue',  value: fmtRupee(ov.total_income),  change: ov.income_change_pct  ?? null, changeLabel: 'vs prev period', data: sparkline(ov.total_income)        },
    { title: 'Total Expenses', value: fmtRupee(ov.total_expense), change: ov.expense_change_pct ?? null, changeLabel: 'vs prev period', data: sparkline(ov.total_expense)       },
    { title: 'Net Profit',     value: fmtRupee(ov.net_profit),    change: ov.profit_change_pct  ?? null, changeLabel: 'vs prev period', data: sparkline(ov.net_profit)          },
    { title: 'Health Score',   value: ov.health_score != null ? `${ov.health_score}/100` : '—', change: ov.health_change ?? null, changeLabel: 'vs prev period', data: sparkline(ov.profit_margin ?? 70) },
  ]

  return (
    <div className="p-8 max-w-[1600px] mx-auto min-h-screen">
      <div className="absolute top-0 left-0 w-full h-[30vh] bg-gradient-to-b from-blue-50/50 to-transparent pointer-events-none -z-10" />

      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: 'easeOut' }}
        className="flex items-center justify-between mb-6"
      >
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Business Overview</h1>
          <p className="text-sm font-medium text-slate-500 mt-1.5">
            {loading ? 'Loading…' : `${businessMeta.branch} · ${businessMeta.name} · ${businessMeta.fy}`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Period Filter Pills */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200">
            {PERIODS.map(p => (
              <button
                key={p.key} onClick={() => setPeriod(p.key)} disabled={loading}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 ${
                  period === p.key ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Live badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg shadow-sm">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-xs font-medium text-slate-600">
              {loading ? 'Loading…' : `Live · Updated ${lastUpdated}`}
            </span>
          </div>

          {/* Refresh */}
          <button
            onClick={handleRefresh} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Refresh
          </button>

          {/* Export */}
          <button className="px-5 py-2.5 bg-slate-900 border border-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition-all shadow-[0_4px_14px_0_rgb(15,23,42,0.2)] hover:shadow-[0_6px_20px_rgba(15,23,42,0.15)] active:scale-95">
            Export Report
          </button>
        </div>
      </motion.div>

      {/* 12-column grid */}
      <div className="grid grid-cols-12 gap-6">

        {/* Row 1: KPI Cards */}
        <div className="col-span-12 grid grid-cols-4 gap-6">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-[110px] bg-white border border-slate-200 rounded-xl shadow-sm animate-pulse" />
              ))
            : kpiCards.map(card => (
                <KpiCard
                  key={card.title} title={card.title} value={card.value}
                  change={card.change} changeLabel={card.changeLabel} data={card.data}
                />
              ))
          }
        </div>

        {/* Row 2: Cash Flow (8) + AI Insights (4) */}
        <div className="col-span-8">
          <CashFlowChart key={`${refreshKey}-${period}`} period={period} data={cashFlow} />
        </div>
        <div className="col-span-4">
          <AIInsightsPanel key={`${refreshKey}-${period}`} period={period} />
        </div>

        {/* Row 3: Ledger Summary */}
        {canAccess('ledger', role) && (
          <div className="col-span-12">
            <LedgerSummaryStrip key={refreshKey} />
          </div>
        )}
      </div>

      {/* AI Chat button provided globally by Shell — no duplicate here */}
    </div>
  )
}
