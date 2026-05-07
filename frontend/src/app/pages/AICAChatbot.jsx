import { useState, useEffect, useRef } from 'react'
import { Send, Cpu, User, ChevronRight, Clock, Loader2, Plus } from 'lucide-react'
import {
  getSharedChatSessionId,
  setSharedChatSessionId,
  subscribeSharedChatSession,
} from '../utils/chatSession'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'
const getBizId = () => localStorage.getItem('business_id') || ''
const getToken = () => localStorage.getItem('access_token') || ''
const authHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${getToken()}`,
})

const suggestions = [
  'Calculate my advance tax for Q4',
  'What deductions can I claim under 80C?',
  'Explain GST composition scheme eligibility',
  'TDS rates on professional fees',
  'Due date for GSTR-3B filing',
  'How to reduce my tax liability?',
]

// ── Parse raw AI text into structured format ──────────────────────────────────
function parseAIResponse(text) {
  if (!text) return null

  const lines = text
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)

  const summary = []
  const points = []
  const actionSteps = []
  const examples = []
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
      .replace(/^\*\*(.+)\*\*$/, '$1')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/^\#{1,3}\s+/, '')
      .replace(/^[\-\*]\s+/, '')
      .replace(/^\d+\.\s+/, '')
      .replace(/^\d+\)\s+/, '')
      .replace(/^summary:\s*/i, '')
      .replace(/^key points:\s*/i, '')
      .replace(/^recommended next steps:\s*/i, '')
      .trim()

    if (!clean) continue
    if (/^\W+$/.test(clean)) continue

    if (clean.toLowerCase().startsWith('disclaimer') || clean.toLowerCase().includes('not a substitute')) {
      disclaimer = clean; continue
    }
    if (
      clean.toLowerCase().startsWith('example') ||
      clean.toLowerCase().startsWith('worked example') ||
      clean.includes('=')
    ) {
      examples.push(clean); continue
    }
    const actionWords = ['file ', 'ensure ', 'reconcile ', 'consult ', 'check ', 'pay ', 'submit ', 'review ', 'verify ']
    if (mode === 'actions' || actionWords.some(w => clean.toLowerCase().startsWith(w))) {
      actionSteps.push(clean); continue
    }
    if (summary.length < 1) {
      summary.push(clean)
    } else {
      points.push(clean)
    }
  }

  return {
    summary: summary.join(' '),
    points: points.slice(0, 8),
    actionSteps: actionSteps.slice(0, 5),
    examples: examples.slice(0, 3),
    disclaimer,
  }
}

// ── Structured AI message card ────────────────────────────────────────────────
function AIMessage({ structured, rawText }) {
  if (!structured || (!structured.summary && !structured.points.length)) {
    return <p className="text-sm text-slate-700 leading-relaxed p-4 whitespace-pre-wrap">{rawText}</p>
  }

  return (
    <div className="p-4 flex flex-col gap-3">
      {structured.summary && (
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
          <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider mb-1">📋 Summary</p>
          <p className="text-sm font-semibold text-slate-800 leading-relaxed">{structured.summary}</p>
        </div>
      )}

      {structured.points.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Key Points</p>
          <ul className="flex flex-col gap-2">
            {structured.points.map((point, i) => (
              <li key={i} className="flex gap-2.5 text-sm text-slate-600 leading-relaxed">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                {point}
              </li>
            ))}
          </ul>
        </div>
      )}

      {structured.examples.length > 0 && (
        <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
          <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1.5">💡 Example</p>
          {structured.examples.map((ex, i) => (
            <p key={i} className="text-xs text-amber-800 leading-relaxed">{ex}</p>
          ))}
        </div>
      )}

      {structured.actionSteps.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">✅ Action Steps</p>
          <div className="flex flex-col gap-1.5">
            {structured.actionSteps.map((step, i) => (
              <div key={i} className="flex gap-2 items-start p-2.5 bg-emerald-50 border border-emerald-100 rounded-lg">
                <ChevronRight size={13} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs font-medium text-emerald-800 leading-relaxed">{step}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {structured.disclaimer && (
        <p className="text-[10px] text-slate-400 italic border-t border-slate-100 pt-2">
          ⚠ {structured.disclaimer}
        </p>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function AICAChatbot() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState(() => getSharedChatSessionId() || null)
  const [sessions, setSessions] = useState([])
  const [activeSession, setActiveSession] = useState(null)
  const [sessionLoading, setSessionLoading] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [taxState, setTaxState] = useState(null)
  const [taxData, setTaxData] = useState({ income: 0, deductions: 0 })
  const bottomRef = useRef(null)

  function loadSessions() {
    if (!getBizId()) return
    fetch(`${API_BASE}/api/v1/chatbot/sessions/`, { headers: authHeaders() })
      .then(r => r.json())
      .then(raw => {
        const list = raw.data || raw.results || (Array.isArray(raw) ? raw : [])
        setSessions(Array.isArray(list) ? list.slice(0, 30) : [])
      })
      .catch(() => { })
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => { loadSessions() }, [])

  useEffect(() => subscribeSharedChatSession(nextSessionId => {
    setSessionId(nextSessionId || null)
  }), [])

  function loadSession(session) {
    setActiveSession(session.id)
    setSessionId(session.id)
    setMessages([])
    setHistoryLoading(true)

    fetch(`${API_BASE}/api/v1/chatbot/sessions/${session.id}/`, { headers: authHeaders() })
      .then(r => r.json())
      .then(raw => {
        const sessionData = raw.data || raw
        const msgs = sessionData.messages || []
        const built = []
        for (const m of msgs) {
          if (m.role === 'user') {
            built.push({
              id: m.id + '_u',
              role: 'user',
              text: m.content || '',
              time: m.created_at,
            })
          } else if (m.role === 'assistant') {
            built.push({
              id: m.id + '_a',
              role: 'ai',
              text: m.content || '',
              structured: parseAIResponse(m.content || ''),
              time: m.created_at,
            })
          }
        }
        setMessages(built)
      })
      .catch(() => { })
      .finally(() => setHistoryLoading(false))
  }

  function newConversation() {
    setSessionId(null); setActiveSession(null); setMessages([]); setInput('')
    setTaxState(null); setTaxData({ income: 0, deductions: 0 })
  }

  async function sendMessage() {
    const text = input.trim()
    if (!text || loading) return
    setMessages(prev => [...prev, {
      id: Date.now(), role: 'user', text,
      time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    }])
    setInput('')

    // ── Smart Frontend Handling for Tax Calculation ──
    const lowerText = text.toLowerCase()

    // 1. Start tax flow
    if (!taxState && (lowerText.includes('calculate tax') || lowerText.includes('tax calculation') || lowerText.includes('compute tax'))) {
      setTaxState('income')
      setMessages(prev => [...prev, {
        id: Date.now() + 1, role: 'ai',
        text: "Let's calculate your tax. To start, what is your total estimated annual income (in ₹)?",
        structured: null,
        time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      }])
      return
    }

    // 2. Handle income input
    if (taxState === 'income') {
      const income = parseInt(text.replace(/[^0-9]/g, ''), 10) || 0
      setTaxData(prev => ({ ...prev, income }))
      setTaxState('deductions')
      setMessages(prev => [...prev, {
        id: Date.now() + 1, role: 'ai',
        text: `Got it. Your income is ₹${income.toLocaleString('en-IN')}. Now, what are your total eligible deductions (e.g., Section 80C, 80D)? Enter 0 if none.`,
        structured: null,
        time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      }])
      return
    }

    // 3. Handle deductions input & output result
    if (taxState === 'deductions') {
      const deductions = parseInt(text.replace(/[^0-9]/g, ''), 10) || 0
      const income = taxData.income
      setTaxState(null)
      setTaxData({ income: 0, deductions: 0 })
      setLoading(true)

      try {
        const res = await fetch(`${API_BASE}/api/v1/chatbot/calculate-tax/`, {
          method: 'POST', headers: authHeaders(),
          body: JSON.stringify({ income, deductions })
        })
        if (!res.ok) throw new Error('Backend calc failed')
        const raw = await res.json()
        const data = raw.data || raw

        const responseText = `Here’s your tax calculation summary:\n\n• Total Income: ₹${income.toLocaleString('en-IN')}\n• Deductions: ₹${deductions.toLocaleString('en-IN')}\n• Taxable Income: ₹${data.taxable_income.toLocaleString('en-IN')}\n• Estimated Tax: ₹${data.estimated_tax.toLocaleString('en-IN')}\n\nLet me know if you want a detailed breakdown.`

        setMessages(prev => [...prev, {
          id: Date.now() + 1, role: 'ai', text: responseText, structured: null,
          time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        }])
      } catch (err) {
        // Fallback hardcoded logic
        const taxable = Math.max(0, income - deductions)
        let tax = 0
        if (taxable > 300000) tax += Math.min(taxable - 300000, 400000) * 0.05
        if (taxable > 700000) tax += Math.min(taxable - 700000, 300000) * 0.10
        if (taxable > 1000000) tax += Math.min(taxable - 1000000, 200000) * 0.15
        if (taxable > 1200000) tax += Math.min(taxable - 1200000, 300000) * 0.20
        if (taxable > 1500000) tax += (taxable - 1500000) * 0.30

        const responseText = `Here’s your tax calculation summary:\n\n• Total Income: ₹${income.toLocaleString('en-IN')}\n• Deductions: ₹${deductions.toLocaleString('en-IN')}\n• Taxable Income: ₹${taxable.toLocaleString('en-IN')}\n• Estimated Tax: ₹${Math.round(tax).toLocaleString('en-IN')}\n\nLet me know if you want a detailed breakdown.`

        setMessages(prev => [...prev, {
          id: Date.now() + 1, role: 'ai', text: responseText, structured: null,
          time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        }])
      } finally {
        setLoading(false)
      }
      return
    }

    setLoading(true)

    try {
      const bizId = getBizId()
      const body = {
        message: text,
        business_id: bizId || null,   // must be UUID or null — never empty string
      }
      if (sessionId) body.session_id = sessionId

      const res = await fetch(`${API_BASE}/api/v1/chatbot/chat/`, {
        method: 'POST', headers: authHeaders(), body: JSON.stringify(body),
      })
      const raw = await res.json()

      // Log full response so we can see what backend returns/expects
      if (!res.ok) {
        console.error('Chatbot 400 error:', JSON.stringify(raw))
        throw new Error(raw.message || raw.detail || JSON.stringify(raw.errors || raw) || 'Failed')
      }

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

      loadSessions()  // refresh sidebar after new message
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
    <div className="flex h-[calc(100vh-60px)]">

      {/* ── Sidebar ───────────────────────────────────────────────────── */}
      <div className="w-[260px] flex-shrink-0 bg-white border-r border-slate-200 flex flex-col">
        <div className="px-4 py-4 border-b border-slate-100">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">AI Chatbot</p>
          <div
            role="button" tabIndex={0}
            onClick={newConversation}
            onKeyDown={e => e.key === 'Enter' && newConversation()}
            className="w-full flex items-center justify-center gap-2 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors cursor-pointer select-none"
          >
            <Plus size={13} /> New Conversation
          </div>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          <p className="px-4 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Recent</p>
          {sessions.length === 0 && (
            <p className="px-4 py-3 text-xs text-slate-400">No conversations yet.</p>
          )}
          {sessions.map(s => (
            <div
              key={s.id} role="button" tabIndex={0}
              onClick={() => loadSession(s)}
              onKeyDown={e => e.key === 'Enter' && loadSession(s)}
              className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors border-l-2 cursor-pointer ${activeSession === s.id ? 'border-blue-500 bg-blue-50' : 'border-transparent'
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
      </div>

      {/* ── Chat Area ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50">

        <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-3">
          <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
            <Cpu size={15} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">AI CA Assistant</p>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
              <p className="text-[11px] text-slate-400">Online · Powered by Gemini · Not a substitute for professional CA advice</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">

          {historyLoading && (
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center gap-3 text-slate-400">
                <div className="w-7 h-7 border-2 border-slate-200 border-t-slate-700 rounded-full animate-spin" />
                <p className="text-xs">Loading conversation…</p>
              </div>
            </div>
          )}

          {messages.length === 0 && !loading && !historyLoading && (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center">
                <Cpu size={24} className="text-white" />
              </div>
              <div>
                <p className="text-base font-bold text-slate-900">Ask your CA anything</p>
                <p className="text-sm text-slate-400 mt-1">GST · TDS · ITR · Advance Tax · Compliance</p>
              </div>
              <div className="flex flex-wrap gap-2 justify-center max-w-lg mt-2">
                {suggestions.map(s => (
                  <div
                    key={s} role="button" tabIndex={0}
                    onClick={() => setInput(s)}
                    onKeyDown={e => e.key === 'Enter' && setInput(s)}
                    className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-full hover:bg-slate-50 cursor-pointer"
                  >
                    {s}
                  </div>
                ))}
              </div>
            </div>
          )}

          {messages.map(msg => (
            <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'ai' ? 'bg-slate-900' : 'bg-blue-600'}`}>
                {msg.role === 'ai' ? <Cpu size={14} className="text-white" /> : <User size={14} className="text-white" />}
              </div>
              <div className={`max-w-[78%] flex flex-col ${msg.role === 'user' ? 'items-end' : ''}`}>
                {msg.role === 'user'
                  ? <div className="bg-slate-900 text-white px-4 py-2.5 rounded-2xl rounded-tr-sm text-sm leading-relaxed">{msg.text}</div>
                  : <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm shadow-sm overflow-hidden">
                    <AIMessage structured={msg.structured} rawText={msg.text} />
                  </div>
                }
                <div className={`flex items-center gap-1 mt-1 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                  <Clock size={10} className="text-slate-300" />
                  <span className="text-[10px] text-slate-300">{msg.time}</span>
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center">
                <Cpu size={14} className="text-white" />
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm shadow-sm px-4 py-3 flex items-center gap-2">
                <Loader2 size={14} className="animate-spin text-slate-400" />
                <span className="text-sm text-slate-400">Thinking…</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {messages.length > 0 && (
          <div className="px-6 pb-2 flex gap-2 flex-wrap">
            {suggestions.slice(0, 4).map(s => (
              <div
                key={s} role="button" tabIndex={0}
                onClick={() => setInput(s)}
                onKeyDown={e => e.key === 'Enter' && setInput(s)}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-full hover:bg-slate-50 cursor-pointer"
              >
                {s}
              </div>
            ))}
          </div>
        )}

        <div className="bg-white border-t border-slate-200 px-6 py-4">
          <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder="Ask your CA question — GST, TDS, ITR, compliance…"
              className="flex-1 bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
            >
              {loading
                ? <Loader2 size={14} className="text-white animate-spin" />
                : <Send size={14} className="text-white" />}
            </button>
          </div>
          <p className="text-[10px] text-slate-400 mt-2 text-center">
            AI responses are for informational purposes. Always verify with a qualified CA.
          </p>
        </div>
      </div>
    </div>
  )
}
