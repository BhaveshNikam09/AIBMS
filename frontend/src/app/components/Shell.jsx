import { useState, useRef, useEffect } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Navbar } from "./Navbar";
import { Cpu, X, Send, Loader2, ChevronRight, MessageSquare, Minimize2 } from "lucide-react";
import { VoiceBuddyFloating } from "./VoiceBuddyFloating";
import {
  getSharedChatSessionId,
  setSharedChatSessionId,
  subscribeSharedChatSession,
} from "../utils/chatSession";
import { canAccess, getStoredRole } from "../utils/rbac";

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'
const getBizId = () => localStorage.getItem('business_id') || ''
const getToken = () => localStorage.getItem('access_token') || ''
const authHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${getToken()}`,
})

function parseAIResponse(text) {
  if (!text) return null
  if (
    text.includes('Tax Calculation Summary') || 
    text.includes('I have fetched your income') ||
    text.includes('Which tax regime do you prefer') ||
    text.includes('business loan interest paid') ||
    text.includes('bad debts written off') ||
    text.includes('other deductions or expenses')
  ) {
    return null;
  }
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const summary = []; const points = []; const actionSteps = []
  let mode = 'summary'
  for (const line of lines) {
    const lower = line.toLowerCase()
    if (lower === 'summary' || lower === 'key points') continue
    if (lower.includes('recommended next steps') || lower.includes('action steps')) { mode = 'actions'; continue }
    const clean = line
      .replace(/^\*\*(.+)\*\*$/, '$1').replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/^#{1,3}\s+/, '').replace(/^[\-\*]\s+/, '')
      .replace(/^\d+\.\s+/, '').replace(/^\d+\)\s+/, '').trim()
    if (!clean || /^\W+$/.test(clean)) continue
    const actionWords = ['file ', 'ensure ', 'reconcile ', 'consult ', 'check ', 'pay ', 'submit ', 'review ', 'verify ']
    if (mode === 'actions' || actionWords.some(w => clean.toLowerCase().startsWith(w))) {
      actionSteps.push(clean); continue
    }
    if (summary.length < 1) summary.push(clean)
    else points.push(clean)
  }
  return { summary: summary.join(' '), points: points.slice(0, 6), actionSteps: actionSteps.slice(0, 4) }
}

const MIN_W = 300, MAX_W = 900
const MIN_H = 360, MAX_H = 820
const DEFAULT_W = 400, DEFAULT_H = 540

function AIChatFloating() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState(() => getSharedChatSessionId() || null)
  const [unread, setUnread] = useState(0)
  const [maximized, setMaximized] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const drawerRef = useRef(null)
  const resizeRef = useRef({ active: false, edge: '', startX: 0, startY: 0, startW: DEFAULT_W, startH: DEFAULT_H })
  const sizeRef = useRef({ w: DEFAULT_W, h: DEFAULT_H })
  const badgeTimer = useRef(null)
  const justDragged = useRef(false)   // prevent backdrop close on drag-end

  // Set initial size via DOM only — NOT via React style, so re-renders never overwrite it
  useEffect(() => {
    const el = drawerRef.current
    if (el) { el.style.width = DEFAULT_W + 'px'; el.style.height = DEFAULT_H + 'px' }
  }, [])

  function applySize(w, h) {
    const el = drawerRef.current
    if (!el) return
    el.style.width = w + 'px'
    el.style.height = h + 'px'
    sizeRef.current = { w, h }
    // Show badge without triggering a React re-render that resets size
    clearTimeout(badgeTimer.current)
    const badge = el.querySelector('#resize-badge')
    if (badge) { badge.textContent = `${Math.round(w)} × ${Math.round(h)}`; badge.style.opacity = '1' }
    badgeTimer.current = setTimeout(() => { const b = el.querySelector('#resize-badge'); if (b) b.style.opacity = '0' }, 1200)
  }

  function startResize(e, edge) {
    if (maximized) return
    e.preventDefault(); e.stopPropagation()
    const r = resizeRef.current
    r.active = true; r.edge = edge
    r.startX = e.clientX; r.startY = e.clientY
    r.startW = sizeRef.current.w; r.startH = sizeRef.current.h
    document.body.style.userSelect = 'none'
    document.body.style.cursor = edge === 'left' ? 'ew-resize' : edge === 'top' ? 'ns-resize' : 'nwse-resize'
  }

  useEffect(() => {
    function onMove(e) {
      const r = resizeRef.current
      if (!r.active) return
      // LEFT edge / corner: dragging left (clientX decreases) → dx>0 → wider; dragging right → narrower
      const dx = r.startX - e.clientX
      // TOP edge / corner: dragging up (clientY decreases) → dy>0 → taller; dragging down → shorter
      const dy = r.startY - e.clientY
      let newW = r.startW, newH = r.startH
      if (r.edge === 'left' || r.edge === 'corner') newW = Math.min(MAX_W, Math.max(MIN_W, r.startW + dx))
      if (r.edge === 'top' || r.edge === 'corner') newH = Math.min(MAX_H, Math.max(MIN_H, r.startH + dy))
      applySize(newW, newH)
    }
    function onUp() {
      const r = resizeRef.current
      if (!r.active) return
      r.active = false
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
      // Mark that we just finished a drag so the backdrop click doesn't close the drawer
      justDragged.current = true
      setTimeout(() => { justDragged.current = false }, 100)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  function toggleMaximize() {
    const el = drawerRef.current
    if (!el) return
    if (!maximized) {
      el.style.width = '92vw'
      el.style.height = '88vh'
      el.style.bottom = '4vh'
      el.style.right = '4vw'
      setMaximized(true)
    } else {
      el.style.width = sizeRef.current.w + 'px'
      el.style.height = sizeRef.current.h + 'px'
      el.style.bottom = '88px'
      el.style.right = '28px'
      setMaximized(false)
    }
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (open) { setUnread(0); setTimeout(() => inputRef.current?.focus(), 150) }
  }, [open])

  useEffect(() => subscribeSharedChatSession(nextSessionId => {
    setSessionId(nextSessionId || null)
  }), [])

  async function sendMessage() {
    const text = input.trim()
    if (!text || loading) return
    const userMsg = { id: Date.now(), role: 'user', text, time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)
    try {
      const body = { message: text, business_id: getBizId() || null }
      if (sessionId) body.session_id = sessionId
      const res = await fetch(`${API_BASE}/api/v1/chatbot/chat/`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) })
      const raw = await res.json()
      if (!res.ok) throw new Error(raw.message || 'Failed')
      const data = raw.data || raw
      if (data.session_id) {
        setSessionId(data.session_id)
        setSharedChatSessionId(data.session_id)
      }
      const responseText = data.response || data.message || data.reply || data.answer || 'Sorry, I could not process that.'
      setMessages(prev => [...prev, { id: Date.now() + 1, role: 'ai', text: responseText, structured: parseAIResponse(responseText), time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) }])
      if (!open) setUnread(u => u + 1)
    } catch {
      setMessages(prev => [...prev, { id: Date.now() + 2, role: 'ai', text: 'Connection error. Please try again.', structured: null, time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) }])
    } finally { setLoading(false) }
  }

  const quickSuggestions = ['Total Profit & Loss', 'Calculate Income Tax', 'Add entries', 'Business Insights']

  return (
    <>
      {/* Floating button */}
      <button
        id="ai-chat-fab"
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'fixed', bottom: '28px', right: '28px', zIndex: 9999,
          display: 'flex', alignItems: 'center', gap: '8px',
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          color: 'white', border: 'none', borderRadius: '14px',
          padding: '11px 18px', cursor: 'pointer', boxShadow: '0 8px 32px rgba(0,0,0,0.28), 0 2px 8px rgba(0,0,0,0.18)',
          fontSize: '13px', fontWeight: '600', letterSpacing: '0.01em',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,0,0,0.35), 0 4px 12px rgba(0,0,0,0.2)' }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.28), 0 2px 8px rgba(0,0,0,0.18)' }}
      >
        <div style={{ width: 22, height: 22, background: 'rgba(59,130,246,0.9)', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Cpu size={13} color="white" />
        </div>
        <span>AI Chat</span>
        {unread > 0 && (
          <span style={{ background: '#ef4444', color: 'white', borderRadius: '99px', fontSize: '10px', fontWeight: 700, padding: '1px 6px', minWidth: 18, textAlign: 'center' }}>{unread}</span>
        )}
        <div style={{ width: 7, height: 7, background: '#22c55e', borderRadius: '50%', flexShrink: 0 }} />
      </button>

      {/* Backdrop */}
      {open && (
        <div
          onClick={() => { if (!justDragged.current) setOpen(false) }}
          style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
        />
      )}

      {/* Chat drawer — width/height managed via DOM ref, NOT React style */}
      <div
        id="ai-chat-drawer"
        ref={drawerRef}
        style={{
          position: 'fixed', bottom: '88px', right: '28px', zIndex: 9999,
          /* width & height set in useEffect and applySize — NOT here */
          background: 'white', borderRadius: '20px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.22), 0 6px 20px rgba(0,0,0,0.14)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          border: '1px solid rgba(226,232,240,0.8)',
          transform: open ? 'translateY(0) scale(1)' : 'translateY(24px) scale(0.96)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'all' : 'none',
          transition: 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1), opacity 0.2s ease',
          transformOrigin: 'bottom right',
        }}
      >
        {/* ── Resize handles ─────────────────────────────────────────── */}
        {/* Top edge */}
        <div
          onMouseDown={e => startResize(e, 'top')}
          style={{
            position: 'absolute', top: 0, left: 12, right: 12, height: 6, cursor: 'ns-resize', zIndex: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
        >
          <div style={{ width: 36, height: 3, background: 'rgba(148,163,184,0.35)', borderRadius: 99, marginTop: 1 }} />
        </div>
        {/* Left edge */}
        <div
          onMouseDown={e => startResize(e, 'left')}
          style={{ position: 'absolute', top: 12, bottom: 12, left: 0, width: 6, cursor: 'ew-resize', zIndex: 10 }}
        />
        {/* Top-left corner */}
        <div
          onMouseDown={e => startResize(e, 'corner')}
          style={{
            position: 'absolute', top: 0, left: 0, width: 14, height: 14, cursor: 'nwse-resize', zIndex: 11,
            borderTopLeftRadius: 20
          }}
        />

        {/* Size badge — pure DOM, no React state needed */}
        <div
          id="resize-badge"
          style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.55)', color: 'white', fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 99, zIndex: 20, pointerEvents: 'none', letterSpacing: '0.04em', opacity: 0, transition: 'opacity 0.2s' }}
        />

        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{ width: 30, height: 30, background: 'rgba(59,130,246,0.9)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Cpu size={14} color="white" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ color: 'white', fontWeight: 700, fontSize: 13, margin: 0, lineHeight: 1.2 }}>AI Chat Assistant</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
              <span style={{ width: 6, height: 6, background: '#22c55e', borderRadius: '50%', display: 'inline-block' }} />
              <p style={{ color: 'rgba(148,163,184,1)', fontSize: 10, margin: 0 }}>Powered by Gemini · Online</p>
            </div>
          </div>
          {/* Maximize / Restore */}
          <button
            onClick={toggleMaximize}
            title={maximized ? 'Restore' : 'Maximize'}
            style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 8, padding: '5px 7px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 4 }}
          >
            {maximized
              ? <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><rect x="1" y="4" width="9" height="9" rx="1.5" stroke="rgba(148,163,184,1)" strokeWidth="1.6" /><path d="M4 4V2.5A1.5 1.5 0 0 1 5.5 1H11.5A1.5 1.5 0 0 1 13 2.5V8.5A1.5 1.5 0 0 1 11.5 10H10" stroke="rgba(148,163,184,1)" strokeWidth="1.6" strokeLinecap="round" /></svg>
              : <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="12" height="12" rx="2" stroke="rgba(148,163,184,1)" strokeWidth="1.6" /><path d="M5 1V5H1" stroke="rgba(148,163,184,1)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            }
          </button>
          <button onClick={() => setOpen(false)} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 8, padding: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={14} color="rgba(148,163,184,1)" />
          </button>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 12, background: '#f8fafc' }}>
          {messages.length === 0 && !loading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16, textAlign: 'center', padding: '0 20px' }}>
              <div style={{ width: 52, height: 52, background: '#1e293b', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Cpu size={22} color="white" />
              </div>
              <div>
                <p style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', margin: 0 }}>Ask your AI anything</p>
                <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Summary · Insights · CRUD · Total</p>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
                {quickSuggestions.map(s => (
                  <button key={s} onClick={() => setInput(s)} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 99, padding: '6px 12px', fontSize: 11, fontWeight: 500, color: '#475569', cursor: 'pointer' }}>{s}</button>
                ))}
              </div>
            </div>
          )}

          {messages.map(msg => (
            <div key={msg.id} style={{ display: 'flex', gap: 8, flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: msg.role === 'ai' ? '#1e293b' : '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Cpu size={12} color="white" />
              </div>
              <div style={{ maxWidth: '78%' }}>
                {msg.role === 'user' ? (
                  <div style={{ background: '#1e293b', color: 'white', padding: '8px 12px', borderRadius: '14px 14px 4px 14px', fontSize: 13, lineHeight: 1.5 }}>{msg.text}</div>
                ) : (
                  <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '14px 14px 14px 4px', padding: '10px 13px', fontSize: 13, color: '#334155', lineHeight: 1.6, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                    {msg.structured?.summary && <p style={{ fontWeight: 600, color: '#0f172a', marginBottom: 6, fontSize: 13 }}>{msg.structured.summary}</p>}
                    {msg.structured?.points?.length > 0 && (
                      <ul style={{ paddingLeft: 0, margin: '6px 0 0', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {msg.structured.points.map((p, i) => (
                          <li key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 12, color: '#475569' }}>
                            <ChevronRight size={12} color="#3b82f6" style={{ flexShrink: 0, marginTop: 2 }} />{p}
                          </li>
                        ))}
                      </ul>
                    )}
                    {!msg.structured?.summary && <div style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</div>}
                  </div>
                )}
                <p style={{ fontSize: 10, color: '#cbd5e1', marginTop: 3, textAlign: msg.role === 'user' ? 'right' : 'left' }}>{msg.time}</p>
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Cpu size={12} color="white" />
              </div>
              <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '14px 14px 14px 4px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Loader2 size={13} color="#94a3b8" style={{ animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: 12, color: '#94a3b8' }}>Thinking…</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{ background: 'white', borderTop: '1px solid #e2e8f0', padding: '12px 14px', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '8px 12px', transition: 'border-color 0.2s' }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder="Ask GST, TDS, ITR, compliance…"
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 13, color: '#334155' }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              style={{ width: 30, height: 30, background: '#1e293b', borderRadius: 9, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, opacity: (!input.trim() || loading) ? 0.4 : 1 }}
            >
              {loading ? <Loader2 size={13} color="white" /> : <Send size={13} color="white" />}
            </button>
          </div>
          <p style={{ textAlign: 'center', fontSize: 10, color: '#cbd5e1', marginTop: 6 }}>Not a substitute for professional CA advice</p>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        #ai-chat-drawer *::-webkit-scrollbar { width: 4px; }
        #ai-chat-drawer *::-webkit-scrollbar-track { background: transparent; }
        #ai-chat-drawer *::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 4px; }
        #ai-chat-drawer { transition-property: transform, opacity !important; }
      `}</style>
    </>
  )
}

export function Shell() {

  const [collapsed, setCollapsed] = useState(false);
  const role = getStoredRole()

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">

      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
      />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        <Navbar />

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>

      </div>

      {canAccess('chatbot', role) && <AIChatFloating />}
      {canAccess('chatbot', role) && <VoiceBuddyFloating />}

    </div>
  );
}
