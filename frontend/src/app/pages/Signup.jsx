import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router'
import {
  Eye, EyeOff, ArrowRight, ArrowLeft, CheckCircle2,
  Building2, User, Mail, Phone, Lock, ChevronDown, Loader2,
  Plus, Trash2, Users,
} from 'lucide-react'

const API_BASE = (import.meta.env.VITE_API_BASE || (import.meta.env.PROD ? 'https://aibms-8mx2.onrender.com' : 'http://localhost:8000'))

// ─── Particle Canvas ─────────────────────────────────────────────────────────
function ParticleCanvas() {
  const canvasRef = useRef(null)
  useEffect(() => {
    const cv = canvasRef.current
    if (!cv) return
    const ctx = cv.getContext('2d')
    const C = [[76, 110, 245], [124, 58, 237], [147, 51, 234], [236, 72, 153], [6, 182, 212]]
    let W, H, pts = [], animId

    function resize() { W = cv.width = cv.offsetWidth; H = cv.height = cv.offsetHeight }

    class P {
      constructor(ry) { this.init(ry) }
      init(ry) {
        this.x = Math.random() * W; this.y = ry ? Math.random() * H : H + 50
        this.r = 0.4 + Math.random() * 2; this.vy = -0.1 - Math.random() * 0.4
        this.vx = (Math.random() - 0.5) * 0.18; this.life = 0
        this.max = 260 + Math.random() * 200
        this.col = C[Math.floor(Math.random() * C.length)]
        this.ph = Math.random() * Math.PI * 2; this.ps = 0.012 + Math.random() * 0.022
      }
      tick() {
        this.x += this.vx; this.y += this.vy; this.life++; this.ph += this.ps
        if (this.life > this.max || this.y < -10) this.init(false)
      }
      draw() {
        const p = this.life / this.max, fi = Math.min(p / 0.12, 1), fo = p > 0.8 ? 1 - (p - 0.8) / 0.2 : 1
        const a = fi * fo * (0.58 + 0.42 * Math.sin(this.ph)) * 0.76
        const [r, g, b] = this.col
        ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${r},${g},${b},${a})`; ctx.fill()
        if (this.r > 1.4) {
          ctx.beginPath(); ctx.arc(this.x, this.y, this.r * 2.6, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(${r},${g},${b},${a * 0.14})`; ctx.fill()
        }
      }
    }

    function init() { resize(); pts = Array.from({ length: Math.floor(W * H / 11000) }, () => new P(true)) }
    function loop() { ctx.clearRect(0, 0, W, H); pts.forEach(p => { p.tick(); p.draw() }); animId = requestAnimationFrame(loop) }

    const handleResize = () => { resize(); pts = Array.from({ length: Math.floor(W * H / 11000) }, () => new P(true)) }
    window.addEventListener('resize', handleResize)
    init(); loop()
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', handleResize) }
  }, [])

  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none', width: '100%', height: '100%' }} />
}

// ─── Step Indicator ───────────────────────────────────────────────────────────
function StepIndicator({ current, total }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.72rem', fontWeight: 800, fontFamily: 'var(--f-d)',
            transition: 'all 0.3s',
            background: i + 1 < current ? 'linear-gradient(135deg,#10B981,#059669)'
              : i + 1 === current ? 'var(--g-brand)'
                : 'rgba(255,255,255,0.08)',
            color: i + 1 <= current ? '#fff' : 'var(--tx-3)',
            boxShadow: i + 1 === current ? '0 0 14px rgba(147,51,234,0.5)' : 'none',
          }}>
            {i + 1 < current ? <CheckCircle2 size={13} /> : i + 1}
          </div>
          {i < total - 1 && (
            <div style={{ width: 32, height: 1.5, borderRadius: 9, background: i + 1 < current ? 'linear-gradient(90deg,#10B981,#059669)' : 'rgba(255,255,255,0.1)', transition: 'all 0.5s' }} />
          )}
        </div>
      ))}
    </div>
  )
}

const businessTypes = [
  'Sole Proprietorship', 'Partnership Firm', 'LLP',
  'Private Limited Company', 'Public Limited Company',
  'HUF', 'Trust / NGO', 'Other',
]

const industries = [
  'Manufacturing', 'Trading', 'Services – IT/Tech', 'Services – CA/Legal',
  'Retail', 'Healthcare', 'Education', 'Construction', 'Hospitality', 'Other',
]

const PARTNERSHIP_TYPES = ['Partnership Firm', 'LLP', 'Private Limited Company', 'Public Limited Company']
const EMPTY_PARTNER = { name: '', email: '', phone: '', role: 'business_owner' }
const PARTNER_ROLE_OPTIONS = [
  { value: 'business_owner', label: 'Business Owner (Co-owner)' },
  { value: 'branch_manager', label: 'Branch Manager' },
  { value: 'accountant', label: 'Accountant' },
  { value: 'staff', label: 'Staff' },
  { value: 'ca', label: 'CA / Consultant' },
]

// ─── Floating Input Field ─────────────────────────────────────────────────────
function Field({ id, label, type = 'text', value, onChange, onBlur, autoComplete, maxLength, state, errorMsg, rightSlot, style }) {
  return (
    <div className={`aibms-field${state ? ` ${state}` : ''}`} style={{ position: 'relative', marginBottom: 14, ...style }}>
      <div style={{ position: 'relative' }}>
        <input
          id={id} type={type} value={value} onChange={onChange} onBlur={onBlur}
          placeholder=" " autoComplete={autoComplete} maxLength={maxLength}
          className="aibms-fi"
          style={rightSlot ? { paddingRight: 50 } : {}}
        />
        <label htmlFor={id} className="aibms-fl">{label}</label>
        {rightSlot}
        <span className="aibms-fi-ico ico-ok">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8l4 4 6-6" stroke="#34D399" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
        <span className="aibms-fi-ico ico-err">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="#EC4899" strokeWidth="1.4" /><path d="M8 5v3.5M8 11v.3" stroke="#EC4899" strokeWidth="1.5" strokeLinecap="round" /></svg>
        </span>
      </div>
      {state === 'err' && errorMsg && (
        <div className="aibms-f-err">
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><circle cx="5.5" cy="5.5" r="4.5" stroke="currentColor" strokeWidth="1.1" /><path d="M5.5 3.5v2.5M5.5 7.5v.3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" /></svg>
          {errorMsg}
        </div>
      )}
    </div>
  )
}

// ─── Eye Toggle Button ────────────────────────────────────────────────────────
function EyeBtn({ show, onToggle }) {
  return (
    <button type="button" onClick={onToggle} className="aibms-fi-eye" aria-label="Toggle password">
      {show ? (
        <svg width="17" height="17" viewBox="0 0 17 17" fill="none"><path d="M2 2l13 13M6 6.2A5.2 5.2 0 0 0 2.5 8.5C4 12 6.6 14 8.5 14a7 7 0 0 0 4-1.2M3 4.2A13 13 0 0 1 8.5 2.5c2 0 4 1 5.5 3A9.5 9.5 0 0 1 16 8.5a9 9 0 0 1-2.5 3.8" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" /></svg>
      ) : (
        <svg width="17" height="17" viewBox="0 0 17 17" fill="none"><path d="M1 8.5C2.5 5 5.3 3 8.5 3S14.5 5 16 8.5c-1.5 3.5-4.3 5.5-7.5 5.5S2.5 12 1 8.5Z" stroke="currentColor" strokeWidth="1.35" /><circle cx="8.5" cy="8.5" r="2.3" stroke="currentColor" strokeWidth="1.35" /></svg>
      )}
    </button>
  )
}

// ─── Password Strength ────────────────────────────────────────────────────────
function getStrength(p) {
  let s = 0
  if (p.length >= 8) s++
  if (p.length >= 12) s++
  if (/[A-Z]/.test(p) && /[0-9]/.test(p)) s++
  if (/[^A-Za-z0-9]/.test(p)) s++
  return Math.min(s, 4)
}
const PW_LABELS = ['', 'Too weak', 'Fair — add uppercase or numbers', 'Good — almost there!', 'Strong — great password!']
const PW_TIPS = ['', 'Try adding numbers & symbols', 'Add uppercase letters', 'Add a symbol', '']
const PW_COLORS = ['', '#EC4899', '#F59E0B', '#3B82F6', '#10B981']

function PwStrength({ password }) {
  if (!password) return null
  const str = getStrength(password)
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', gap: 5, marginBottom: 6 }}>
        {[1, 2, 3, 4].map(lvl => (
          <div key={lvl} style={{
            flex: 1, height: 3, borderRadius: 99,
            background: lvl <= str ? (PW_COLORS[str] || '#EC4899') : 'rgba(255,255,255,0.08)',
            transition: 'background 0.35s ease',
          }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.68rem', color: PW_COLORS[str] || 'var(--tx-3)', fontFamily: 'var(--f-m)' }}>{PW_LABELS[str]}</span>
        {PW_TIPS[str] && <span style={{ fontSize: '0.62rem', color: 'var(--tx-3)', fontFamily: 'var(--f-m)' }}>{PW_TIPS[str]}</span>}
      </div>
    </div>
  )
}

// ─── Dark Select ──────────────────────────────────────────────────────────────
function DarkSelect({ value, onChange, children, hasError }) {
  return (
    <div style={{ position: 'relative' }}>
      <select value={value} onChange={onChange} className={`aibms-fi aibms-select${hasError ? ' has-err' : ''}`} style={{ appearance: 'none', paddingRight: 44, cursor: 'pointer' }}>
        {children}
      </select>
      <ChevronDown size={14} style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--tx-3)', pointerEvents: 'none' }} />
    </div>
  )
}

// ─── Main Signup Component ────────────────────────────────────────────────────
export function Signup() {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [showConfirmPass, setShowConfirmPass] = useState(false)

  // Step 1 — Business info
  const [step1, setStep1] = useState({ businessName: '', businessType: '', industry: '', gstin: '', city: '', state: '' })
  const [errors1, setErrors1] = useState({})

  // Step 2 — Primary owner account
  const [step2, setStep2] = useState({ ownerName: '', email: '', phone: '', password: '', confirmPassword: '' })
  const [errors2, setErrors2] = useState({})

  // Step 3 — Co-owners / partners
  const [partners, setPartners] = useState([{ ...EMPTY_PARTNER }])
  const [errors3, setErrors3] = useState([{}])
  const [skipPartners, setSkipPartners] = useState(false)
  const [termsChecked, setTermsChecked] = useState(false)
  const [termsShake, setTermsShake] = useState(false)

  const isPartnership = PARTNERSHIP_TYPES.includes(step1.businessType)
  const totalSteps = isPartnership ? 3 : 2

  // ── Helpers ────────────────────────────────────────────────────────────────
  const s1 = k => e => { setStep1(p => ({ ...p, [k]: e.target.value })); setErrors1(p => ({ ...p, [k]: undefined })) }
  const s2 = k => e => { setStep2(p => ({ ...p, [k]: e.target.value })); setErrors2(p => ({ ...p, [k]: undefined })) }

  function fieldState1(k) { return errors1[k] ? 'err' : step1[k] ? 'ok' : '' }
  function fieldState2(k) { return errors2[k] ? 'err' : step2[k] ? 'ok' : '' }

  // ── Validation ─────────────────────────────────────────────────────────────
  function validateStep1() {
    const e = {}
    if (!step1.businessName.trim()) e.businessName = 'Business name is required'
    if (!step1.businessType) e.businessType = 'Please select a business type'
    if (!step1.city.trim()) e.city = 'City is required'
    setErrors1(e)
    return Object.keys(e).length === 0
  }

  function validateStep2() {
    const e = {}
    if (!step2.ownerName.trim()) e.ownerName = 'Owner name is required'
    if (!step2.email) e.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(step2.email)) e.email = 'Enter a valid email'
    if (!step2.phone) e.phone = 'Phone number is required'
    else if (!/^[6-9]\d{9}$/.test(step2.phone.replace(/\s/g, ''))) e.phone = 'Enter a valid 10-digit mobile number'
    if (!step2.password) e.password = 'Password is required'
    else if (step2.password.length < 8) e.password = 'Password must be at least 8 characters'
    if (step2.confirmPassword !== step2.password) e.confirmPassword = 'Passwords do not match'
    setErrors2(e)
    return Object.keys(e).length === 0
  }

  function validateStep3() {
    if (skipPartners) return true
    const errs = partners.map(p => {
      const e = {}
      if (!p.name.trim()) e.name = 'Name is required'
      if (!p.email.trim()) e.email = 'Email is required'
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) e.email = 'Enter a valid email'
      if (p.email.trim().toLowerCase() === step2.email.trim().toLowerCase())
        e.email = 'Partner email must differ from owner email'
      return e
    })
    setErrors3(errs)
    return errs.every(e => Object.keys(e).length === 0)
  }

  // ── Partner helpers ────────────────────────────────────────────────────────
  function addPartner() {
    setPartners(p => [...p, { ...EMPTY_PARTNER }]); setErrors3(e => [...e, {}])
  }
  function removePartner(idx) {
    setPartners(p => p.filter((_, i) => i !== idx)); setErrors3(e => e.filter((_, i) => i !== idx))
  }
  function updatePartner(idx, key, value) {
    setPartners(p => p.map((pt, i) => i === idx ? { ...pt, [key]: value } : pt))
    setErrors3(e => e.map((er, i) => i === idx ? { ...er, [key]: undefined } : er))
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault()
    if (isPartnership && step === 3) { if (!validateStep3()) return }
    else { if (!validateStep2()) return }

    if (!termsChecked && step !== 3) {
      setTermsShake(true); setTimeout(() => setTermsShake(false), 900); return
    }

    setLoading(true); setError('')
    try {
      const partnersPayload = (!skipPartners && isPartnership)
        ? partners.filter(p => p.name.trim() && p.email.trim()).map(p => ({
          full_name: p.name.trim(), email: p.email.trim().toLowerCase(),
          phone: p.phone.trim() || '', role: p.role || 'business_owner',
        }))
        : []

      const regRes = await fetch(`${API_BASE}/api/v1/auth/register/`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: step2.ownerName.trim(), email: step2.email.trim().toLowerCase(),
          phone: step2.phone.trim() || undefined, password: step2.password,
          confirm_password: step2.confirmPassword, partners: partnersPayload,
        }),
      })
      const regData = await regRes.json()
      if (!regRes.ok) {
        const msg = regData.message || regData.detail ||
          (regData.errors ? Object.entries(regData.errors).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' | ') : `Registration failed (${regRes.status})`)
        throw new Error(msg)
      }

      const tokens = regData.data?.tokens || {}
      const accessToken = tokens.access || regData.data?.access_token || ''
      const refreshToken = tokens.refresh || regData.data?.refresh_token || ''
      if (!accessToken) throw new Error('No access token received. Please try again.')

      localStorage.setItem('access_token', accessToken)
      localStorage.setItem('refresh_token', refreshToken)

      const createdPartners = regData.data?.partners || []
      const partnerUserIds = createdPartners.map(p => p.user_id).filter(Boolean)
      const authHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` }

      const bizRes = await fetch(`${API_BASE}/api/v1/business/`, {
        method: 'POST', headers: authHeaders,
        body: JSON.stringify({
          name: step1.businessName.trim(), business_type: step1.businessType,
          gstin: step1.gstin.trim() || undefined, city: step1.city.trim() || undefined,
          state: step1.state.trim() || undefined, partner_user_ids: partnerUserIds,
        }),
      })
      const bizData = await bizRes.json()
      if (!bizRes.ok) {
        const msg = bizData.message || bizData.detail || (bizData.errors ? Object.values(bizData.errors).flat().join(' ') : 'Business creation failed')
        throw new Error(msg)
      }
      const biz = bizData.data || bizData
      if (biz.id) { fetch(`${API_BASE}/api/v1/cashbook/${biz.id}/categories/seed/`, { method: 'POST', headers: authHeaders }).catch(() => { }) }

      const userData = regData.data?.user || {}
      localStorage.setItem('business_id', biz.id || '')
      localStorage.setItem('business_name', biz.name || step1.businessName.trim())
      localStorage.setItem('user', JSON.stringify({ ...userData, bizRole: 'owner', full_name: step2.ownerName.trim(), email: step2.email.trim().toLowerCase() }))

      setLoading(false); setSuccess(true)
      setTimeout(() => { window.location.href = '/dashboard' }, 1800)
    } catch (err) {
      setLoading(false); setError(err.message || 'Something went wrong. Please try again.')
    }
  }

  function handleNextFromStep1() { if (validateStep1()) setStep(2) }
  function handleNextFromStep2() { if (!validateStep2()) return; if (isPartnership) setStep(3) }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&family=DM+Mono:wght@400;500&display=swap');

        :root {
          --bg:#04050d; --glass:rgba(255,255,255,.042); --glass-hi:rgba(255,255,255,.068);
          --blue:#4C6EF5; --violet:#7C3AED; --purple:#9333EA; --pink:#EC4899; --cyan:#06B6D4; --green:#10B981;
          --g-brand:linear-gradient(135deg,#4C6EF5 0%,#9333EA 55%,#EC4899 100%);
          --g-text:linear-gradient(135deg,#93c5fd 0%,#c084fc 45%,#f9a8d4 100%);
          --g-btn:linear-gradient(120deg,#4C6EF5 0%,#7C3AED 50%,#9333EA 100%);
          --tx-0:#fff; --tx-1:rgba(255,255,255,.78); --tx-2:rgba(255,255,255,.50); --tx-3:rgba(255,255,255,.32); --tx-4:rgba(255,255,255,.18);
          --bd:rgba(255,255,255,.08); --bd-hi:rgba(255,255,255,.16);
          --inp-bg:rgba(255,255,255,.040); --inp-bg-foc:rgba(255,255,255,.062);
          --inp-bd:rgba(255,255,255,.10); --inp-bd-foc:rgba(124,58,237,.72);
          --inp-bd-ok:rgba(16,185,129,.55); --inp-bd-err:rgba(236,72,153,.65);
          --inp-ring-foc:rgba(124,58,237,.16); --inp-ring-ok:rgba(16,185,129,.12); --inp-ring-err:rgba(236,72,153,.14);
          --f-d:'Bricolage Grotesque',sans-serif; --f-b:'DM Sans',sans-serif; --f-m:'DM Mono',monospace;
          --ease:cubic-bezier(.25,1,.5,1); --ease-spr:cubic-bezier(.34,1.56,.64,1); --ease-exp:cubic-bezier(.16,1,.3,1);
          --r-sm:8px; --r-md:14px; --r-pill:100px;
          --inp-h:56px; --inp-px:18px; --inp-pt:22px; --inp-pb:10px;
          --lbl-rest:50%; --lbl-flt:11px; --lbl-flt-sz:.62rem;
        }
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0 }
        html, body, #root { height:100%; margin:0; padding:0 }
        body { font-family:var(--f-b); background:var(--bg); color:var(--tx-0); min-height:100vh; -webkit-font-smoothing:antialiased; overflow:hidden }
        a { text-decoration:none; color:inherit }

        /* ── Animations ── */
        @keyframes bg-shift   { 0%{filter:hue-rotate(0deg) brightness(1);opacity:.8} 100%{filter:hue-rotate(22deg) brightness(1.1);opacity:1} }
        @keyframes aurora     { 0%{background-position:0% 50%;opacity:.4} 50%{background-position:100% 50%;opacity:1} 100%{background-position:0% 50%;opacity:.58} }
        @keyframes fade-up    { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:none} }
        @keyframes box-enter  { to{opacity:1;transform:none} }
        @keyframes dot-pulse  { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.44;transform:scale(.74)} }
        @keyframes chip-rise  { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:none} }
        @keyframes chip-bob   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-9px)} }
        @keyframes shake      { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-5px)} 40%{transform:translateX(5px)} 60%{transform:translateX(-3px)} 80%{transform:translateX(3px)} }
        @keyframes terms-highlight { 0%,100%{background:rgba(236,72,153,.06)} 50%{background:rgba(236,72,153,.16)} }
        @keyframes success-rise { from{opacity:0;transform:scale(.9) translateY(12px)} to{opacity:1;transform:none} }
        @keyframes spin-border { to{transform:translateY(-50%) rotate(360deg)} }

        /* ── Left panel ── */
        .aibms-left { flex:0 0 54%; height:100vh; position:relative; overflow:hidden; display:flex; flex-direction:column; justify-content:space-between; padding:44px 56px 48px }
        .l-bg { position:absolute; inset:0; z-index:0;
          background: radial-gradient(ellipse 76% 66% at 20% 60%,rgba(76,110,245,.24) 0%,transparent 60%), radial-gradient(ellipse 62% 62% at 80% 16%,rgba(147,51,234,.20) 0%,transparent 60%), radial-gradient(ellipse 52% 52% at 54% 96%,rgba(236,72,153,.15) 0%,transparent 55%), radial-gradient(ellipse 44% 40% at 6% 6%,rgba(6,182,212,.09) 0%,transparent 55%);
          animation:bg-shift 20s ease-in-out infinite alternate }
        .l-grid { position:absolute; inset:0; z-index:1; pointer-events:none;
          background-image:linear-gradient(rgba(255,255,255,.022) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.022) 1px,transparent 1px);
          background-size:72px 72px; mask-image:radial-gradient(ellipse 90% 90% at 50% 50%,black 18%,transparent 82%) }
        .l-aurora { position:absolute; inset:0; z-index:1; pointer-events:none;
          background:linear-gradient(110deg,transparent 0%,rgba(76,110,245,.07) 22%,rgba(147,51,234,.12) 50%,rgba(236,72,153,.07) 78%,transparent 100%);
          background-size:260% 260%; animation:aurora 17s ease-in-out infinite alternate }
        .l-vig { position:absolute; inset:0; z-index:2; pointer-events:none; background:radial-gradient(ellipse 88% 88% at 50% 50%,transparent 32%,rgba(4,5,13,.8) 100%) }

        /* Steps */
        .aibms-step { position:absolute; display:flex; align-items:flex-start; gap:11px; padding:12px 16px; background:rgba(8,5,20,.82); border:1px solid rgba(255,255,255,.11); border-radius:var(--r-md); box-shadow:0 8px 28px rgba(0,0,0,.46),inset 0 1px 0 rgba(255,255,255,.06); backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px); opacity:0; max-width:240px }
        .aibms-step.s1 { top:10%; left:5%;   animation:chip-rise .7s var(--ease-exp) .85s  forwards, chip-bob 5.5s ease-in-out 1.5s infinite }
        .aibms-step.s2 { top:32%; right:5%;  animation:chip-rise .7s var(--ease-exp) 1.1s  forwards, chip-bob 5.5s ease-in-out 2.2s infinite }
        .aibms-step.s3 { bottom:24%; right:5%; animation:chip-rise .7s var(--ease-exp) 1.35s forwards, chip-bob 5.5s ease-in-out 2.9s infinite }
        .aibms-step.s4 { bottom:8%;  left:5%;  animation:chip-rise .7s var(--ease-exp) 1.6s  forwards, chip-bob 5.5s ease-in-out 3.4s infinite }
        .st-num { width:24px; height:24px; border-radius:50%; flex-shrink:0; background:var(--g-brand); display:flex; align-items:center; justify-content:center; font-family:var(--f-d); font-size:.68rem; font-weight:800; color:#fff; box-shadow:0 0 12px rgba(147,51,234,.4) }
        .st-body { display:flex; flex-direction:column; gap:2px }
        .st-ttl { font-family:var(--f-d); font-size:.82rem; font-weight:700; color:var(--tx-0) }
        .st-dsc { font-size:.72rem; color:var(--tx-2); line-height:1.4 }

        /* Logo */
        .aibms-logo { display:flex; align-items:center; gap:10px; opacity:0; animation:fade-up .8s var(--ease-exp) .2s forwards }
        .logo-mark { width:36px; height:36px; border-radius:9px; background:var(--g-brand); display:flex; align-items:center; justify-content:center; box-shadow:0 0 20px rgba(124,58,237,.4); position:relative; overflow:hidden; flex-shrink:0 }
        .logo-mark::before { content:''; position:absolute; inset:0; background:radial-gradient(ellipse at 30% 25%,rgba(255,255,255,.22) 0%,transparent 60%) }
        .logo-name { font-family:var(--f-d); font-size:1.15rem; font-weight:800; letter-spacing:-.03em }
        .logo-name .grad { background:var(--g-text); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text }

        /* Left inner */
        .l-inner { position:relative; z-index:4; display:flex; flex-direction:column; justify-content:space-between; height:100% }
        .l-eyebrow { display:inline-flex; align-items:center; gap:8px; font-family:var(--f-m); font-size:.67rem; font-weight:500; text-transform:uppercase; letter-spacing:.13em; color:var(--tx-2); margin-bottom:22px; opacity:0; animation:fade-up .8s var(--ease-exp) .35s forwards }
        .ey-dot { width:6px; height:6px; border-radius:50%; background:var(--g-brand); box-shadow:0 0 8px rgba(147,51,234,.8); flex-shrink:0; animation:dot-pulse 2.4s ease-in-out infinite }
        .l-title { font-family:var(--f-d); font-size:clamp(2rem,3.4vw,2.9rem); font-weight:800; letter-spacing:-.04em; line-height:1.08; color:var(--tx-0); margin-bottom:18px; text-shadow:0 2px 40px rgba(0,0,0,.7); opacity:0; animation:fade-up .8s var(--ease-exp) .48s forwards }
        .l-title .grad { background:var(--g-text); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; filter:drop-shadow(0 0 18px rgba(147,51,234,.45)) }
        .l-sub { font-size:.95rem; font-weight:300; color:var(--tx-2); line-height:1.74; max-width:340px; opacity:0; animation:fade-up .8s var(--ease-exp) .6s forwards }
        .l-benefits { display:flex; flex-direction:column; gap:11px; margin-top:26px; opacity:0; animation:fade-up .8s var(--ease-exp) .72s forwards }
        .b-row { display:flex; align-items:center; gap:9px; font-size:.86rem; color:var(--tx-2) }
        .b-chk { width:19px; height:19px; border-radius:50%; flex-shrink:0; background:rgba(16,185,129,.1); border:1px solid rgba(16,185,129,.3); display:flex; align-items:center; justify-content:center; box-shadow:0 0 8px rgba(16,185,129,.15) }
        .l-trust { display:flex; align-items:center; gap:18px; flex-wrap:wrap; opacity:0; animation:fade-up .8s var(--ease-exp) .85s forwards }
        .t-badge { display:flex; align-items:center; gap:6px; font-family:var(--f-m); font-size:.6rem; font-weight:500; color:var(--tx-3); letter-spacing:.05em }
        .t-sep { width:3px; height:3px; border-radius:50%; background:rgba(255,255,255,.18) }

        /* ── Right panel ── */
        .aibms-right {
          flex: 0 0 46%;
          position: relative;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding: 36px 48px;
          background: rgba(255,255,255,.014);
          border-left: 1px solid var(--bd);
          overflow-y: auto;
          overflow-x: hidden;
          height: 100vh;
        }
        .aibms-right::before { content:''; position:fixed; top:0; right:0; bottom:0; width:46%; pointer-events:none; z-index:0; background: radial-gradient(ellipse 70% 45% at 50% -5%,rgba(76,110,245,.05) 0%,transparent 65%), radial-gradient(ellipse 55% 40% at 50% 108%,rgba(147,51,234,.04) 0%,transparent 62%) }

        /* Form box */
        .aibms-form-box {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 520px;
          margin: auto 0;
          background: rgba(255,255,255,.032);
          border: 1px solid rgba(255,255,255,.09);
          border-radius: 24px;
          padding: 40px 44px 36px;
          box-shadow: 0 0 0 1px rgba(255,255,255,.038), 0 20px 60px rgba(0,0,0,.42), inset 0 2px 0 rgba(255,255,255,.05);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          overflow: hidden;
          opacity: 0;
          transform: translateY(24px) scale(.978);
          animation: box-enter 1s var(--ease-exp) .28s forwards;
        }
        .aibms-form-box::before { content:''; position:absolute; top:0; left:0; width:62%; height:46%; background:radial-gradient(ellipse at 12% 12%,rgba(255,255,255,.044) 0%,transparent 68%); border-radius:24px 0 0 0; pointer-events:none; z-index:0 }
        .aibms-form-box::after { content:''; position:absolute; top:0; left:15%; right:15%; height:1px; z-index:1; background:linear-gradient(90deg,transparent 0%,rgba(76,110,245,.48) 30%,rgba(147,51,234,.68) 50%,rgba(236,72,153,.48) 70%,transparent 100%); box-shadow:0 0 14px rgba(147,51,234,.26) }

        /* Form header */
        .form-head { position:relative; z-index:1; margin-bottom:26px }
        .f-eyebrow { display:inline-flex; align-items:center; gap:7px; font-family:var(--f-m); font-size:.64rem; font-weight:500; text-transform:uppercase; letter-spacing:.13em; color:var(--tx-3); margin-bottom:14px }
        .f-title { font-family:var(--f-d); font-size:clamp(1.55rem,2.4vw,1.9rem); font-weight:800; letter-spacing:-.04em; line-height:1.12; color:var(--tx-0); margin-bottom:9px }
        .f-sub { font-size:.87rem; font-weight:300; color:var(--tx-2); line-height:1.6; font-style:italic }

        /* Social buttons */
        .aibms-socials { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:18px }
        .btn-soc { display:flex; align-items:center; justify-content:center; gap:9px; height:44px; padding:0 16px; background:var(--glass); border:1px solid var(--bd); border-radius:var(--r-md); font-family:var(--f-b); font-size:.82rem; font-weight:500; color:var(--tx-1); cursor:pointer; transition:background .22s var(--ease),border-color .22s var(--ease),transform .18s var(--ease-spr); white-space:nowrap; width:100% }
        .btn-soc:hover { background:var(--glass-hi); border-color:var(--bd-hi); transform:translateY(-1px) }

        /* Divider */
        .aibms-divider { display:flex; align-items:center; gap:12px; margin:18px 0 }
        .div-line { flex:1; height:1px; background:var(--bd) }
        .div-txt { font-family:var(--f-m); font-size:.6rem; font-weight:500; color:var(--tx-3); letter-spacing:.1em; text-transform:uppercase; white-space:nowrap }

        /* Fields */
        .aibms-field { position:relative; margin-bottom:14px }
        .aibms-fi { width:100%; height:var(--inp-h); padding:var(--inp-pt) var(--inp-px) var(--inp-pb); background:var(--inp-bg); border:1.5px solid var(--inp-bd); border-radius:var(--r-md); font-family:var(--f-b); font-size:.95rem; font-weight:400; color:var(--tx-0); outline:none; -webkit-appearance:none; transition:border-color .28s var(--ease),background .28s var(--ease),box-shadow .28s var(--ease) }
        .aibms-fi::placeholder { color:transparent }
        .aibms-fi:focus { border-color:var(--inp-bd-foc); background:var(--inp-bg-foc); box-shadow:0 0 0 3.5px var(--inp-ring-foc),0 2px 16px rgba(124,58,237,.06) }
        .aibms-select { height:var(--inp-h) }
        .aibms-select option { background:#0e0f1a; color:var(--tx-1) }
        .aibms-fl { position:absolute; left:var(--inp-px); top:var(--lbl-rest); transform:translateY(-50%); pointer-events:none; font-family:var(--f-b); font-size:.95rem; font-weight:400; color:var(--tx-3); transition:top .22s var(--ease),transform .22s var(--ease),font-size .22s var(--ease),font-weight .22s var(--ease),color .22s var(--ease),letter-spacing .22s var(--ease); transform-origin:left top; white-space:nowrap }
        .aibms-fi:focus ~ .aibms-fl, .aibms-fi:not(:placeholder-shown) ~ .aibms-fl { top:var(--lbl-flt); transform:none; font-size:var(--lbl-flt-sz); font-weight:500; letter-spacing:.07em; text-transform:uppercase; color:var(--tx-3) }
        .aibms-fi:focus ~ .aibms-fl { color:rgba(167,139,250,.92) }
        .aibms-field.ok  .aibms-fi { border-color:var(--inp-bd-ok); box-shadow:0 0 0 3px var(--inp-ring-ok) }
        .aibms-field.ok  .aibms-fl { color:rgba(52,211,153,.8) }
        .aibms-field.err .aibms-fi { border-color:var(--inp-bd-err); box-shadow:0 0 0 3px var(--inp-ring-err); animation:shake .38s var(--ease-spr) }
        .aibms-field.err .aibms-fl { color:rgba(236,72,153,.88) }

        .aibms-fi-ico { position:absolute; right:14px; top:50%; display:flex; align-items:center; justify-content:center; width:22px; height:22px; pointer-events:none; opacity:0; transform:translateY(-50%) scale(.7); transition:opacity .28s var(--ease),transform .3s var(--ease-spr) }
        .aibms-field.ok  .aibms-fi-ico.ico-ok  { opacity:1; transform:translateY(-50%) scale(1) }
        .aibms-field.err .aibms-fi-ico.ico-err { opacity:1; transform:translateY(-50%) scale(1) }
        .aibms-fi-eye { position:absolute; right:12px; top:50%; transform:translateY(-50%); width:32px; height:32px; border-radius:var(--r-sm); background:none; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; color:var(--tx-3); transition:color .2s,background .2s,transform .2s var(--ease-spr) }
        .aibms-fi-eye:hover { color:var(--tx-1); background:rgba(255,255,255,.06) }
        .aibms-f-err { display:flex; align-items:center; gap:6px; padding:7px 12px; margin-top:5px; background:rgba(236,72,153,.07); border:1px solid rgba(236,72,153,.15); border-left:2.5px solid rgba(236,72,153,.6); border-radius:0 var(--r-sm) var(--r-sm) 0; font-size:.7rem; color:rgba(236,72,153,.9) }

        /* Terms */
        .aibms-terms { display:flex; align-items:flex-start; gap:11px; margin-bottom:18px; padding:12px 14px; background:rgba(255,255,255,.022); border:1px solid var(--bd); border-radius:var(--r-md); cursor:pointer; transition:border-color .22s var(--ease),background .22s var(--ease) }
        .aibms-terms:hover { background:rgba(255,255,255,.038); border-color:var(--bd-hi) }
        .aibms-terms.shake { animation:terms-highlight .9s ease }
        .terms-box { width:18px; height:18px; border-radius:5px; flex-shrink:0; margin-top:1px; border:1.5px solid var(--bd-hi); display:flex; align-items:center; justify-content:center; transition:all .22s var(--ease) }
        .terms-box.checked { background:var(--g-brand); border-color:transparent; box-shadow:0 0 10px rgba(147,51,234,.4) }
        .terms-txt { font-size:.78rem; color:var(--tx-2); line-height:1.55 }
        .terms-txt a { color:var(--tx-1); border-bottom:1px solid rgba(255,255,255,.2); transition:color .2s,border-color .2s }
        .terms-txt a:hover { color:var(--tx-0); border-color:var(--tx-0) }

        /* Submit button */
        .aibms-btn-cta { width:100%; height:52px; border-radius:var(--r-md); border:none; cursor:pointer; position:relative; overflow:hidden; font-family:var(--f-d); font-size:.96rem; font-weight:700; color:#fff; background:var(--g-btn); box-shadow:0 0 0 1px rgba(124,58,237,.3),0 4px 18px rgba(124,58,237,.4); transition:transform .18s var(--ease-spr),box-shadow .22s var(--ease); letter-spacing:-.01em }
        .aibms-btn-cta:hover { transform:translateY(-1px); box-shadow:0 0 0 1px rgba(124,58,237,.4),0 8px 28px rgba(124,58,237,.5) }
        .aibms-btn-cta:active { transform:translateY(0) scale(.98) }
        .aibms-btn-cta:disabled { opacity:.6; cursor:not-allowed; transform:none }
        .aibms-btn-cta.success { background:linear-gradient(135deg,#10B981,#059669); box-shadow:0 0 0 1px rgba(16,185,129,.3),0 4px 18px rgba(16,185,129,.4) }

        /* Secondary/back button */
        .aibms-btn-back { display:flex; align-items:center; gap:7px; height:48px; padding:0 20px; background:var(--glass); border:1px solid var(--bd); border-radius:var(--r-md); font-family:var(--f-b); font-size:.85rem; font-weight:500; color:var(--tx-2); cursor:pointer; transition:background .22s,border-color .22s,color .22s; white-space:nowrap; flex-shrink:0 }
        .aibms-btn-back:hover { background:var(--glass-hi); border-color:var(--bd-hi); color:var(--tx-1) }

        /* Continue button (non-submit) */
        .aibms-btn-next { flex:1; height:48px; display:flex; align-items:center; justify-content:center; gap:8px; border-radius:var(--r-md); border:none; cursor:pointer; background:var(--g-btn); box-shadow:0 0 0 1px rgba(124,58,237,.3),0 4px 18px rgba(124,58,237,.35); font-family:var(--f-d); font-size:.9rem; font-weight:700; color:#fff; transition:transform .18s var(--ease-spr),box-shadow .22s; letter-spacing:-.01em }
        .aibms-btn-next:hover { transform:translateY(-1px); box-shadow:0 0 0 1px rgba(124,58,237,.4),0 6px 22px rgba(124,58,237,.45) }

        /* Error banner */
        .aibms-err-banner { padding:11px 14px; background:rgba(236,72,153,.08); border:1px solid rgba(236,72,153,.2); border-left:3px solid rgba(236,72,153,.7); border-radius:0 var(--r-md) var(--r-md) 0; font-size:.8rem; color:rgba(236,72,153,.9); margin-bottom:14px }

        /* Switch */
        .f-switch { text-align:center; margin-top:20px; font-size:.82rem; color:var(--tx-3); position:relative; z-index:1 }
        .f-switch a { color:var(--tx-1); font-weight:500; border-bottom:1px solid rgba(255,255,255,.2); transition:color .2s,border-color .2s }
        .f-switch a:hover { color:var(--tx-0); border-color:var(--tx-0) }

        /* Success */
        .aibms-success { text-align:center; animation:success-rise .6s var(--ease-exp) both; position:relative; z-index:1 }
        .success-icon { width:72px; height:72px; border-radius:50%; background:linear-gradient(135deg,rgba(16,185,129,.15),rgba(16,185,129,.05)); border:1.5px solid rgba(16,185,129,.3); display:flex; align-items:center; justify-content:center; margin:0 auto 20px; box-shadow:0 0 32px rgba(16,185,129,.2) }

        /* Partner cards */
        .partner-card { background:rgba(255,255,255,.022); border:1px solid var(--bd); border-radius:var(--r-md); padding:16px; margin-bottom:12px; position:relative }
        .partner-card-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px }
        .aibms-btn-remove { width:28px; height:28px; border-radius:var(--r-sm); background:rgba(236,72,153,.08); border:1px solid rgba(236,72,153,.15); display:flex; align-items:center; justify-content:center; cursor:pointer; color:rgba(236,72,153,.7); transition:all .2s }
        .aibms-btn-remove:hover { background:rgba(236,72,153,.18); color:rgba(236,72,153,1) }
        .aibms-btn-add { display:flex; align-items:center; justify-content:center; gap:8px; width:100%; height:42px; background:transparent; border:1.5px dashed rgba(124,58,237,.35); border-radius:var(--r-md); font-family:var(--f-b); font-size:.82rem; font-weight:500; color:rgba(124,58,237,.8); cursor:pointer; transition:all .22s }
        .aibms-btn-add:hover { border-color:rgba(124,58,237,.6); color:rgba(167,139,250,.9); background:rgba(124,58,237,.06) }

        /* Skip row */
        .skip-row { display:flex; align-items:center; gap:11px; padding:12px 14px; border-radius:var(--r-md); border:1px solid var(--bd); background:rgba(255,255,255,.022); cursor:pointer; margin-bottom:14px; transition:all .22s }
        .skip-row.active { border-color:rgba(245,158,11,.35); background:rgba(245,158,11,.06) }
        .skip-check { width:18px; height:18px; border-radius:5px; border:1.5px solid var(--bd-hi); display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:all .22s }
        .skip-check.checked { background:linear-gradient(135deg,#F59E0B,#D97706); border-color:transparent }

        /* Input mini (inside partner cards) */
        .partner-input { width:100%; height:42px; padding:0 12px; background:rgba(255,255,255,.04); border:1.5px solid var(--inp-bd); border-radius:var(--r-sm); font-family:var(--f-b); font-size:.84rem; color:var(--tx-0); outline:none; transition:border-color .22s,background .22s }
        .partner-input::placeholder { color:var(--tx-3) }
        .partner-input:focus { border-color:var(--inp-bd-foc); background:var(--inp-bg-foc); box-shadow:0 0 0 3px var(--inp-ring-foc) }
        .partner-input.has-err { border-color:var(--inp-bd-err); box-shadow:0 0 0 3px var(--inp-ring-err) }
        .partner-select { width:100%; height:42px; padding:0 36px 0 12px; background:rgba(255,255,255,.04); border:1.5px solid var(--inp-bd); border-radius:var(--r-sm); font-family:var(--f-b); font-size:.84rem; color:var(--tx-0); outline:none; appearance:none; cursor:pointer; transition:border-color .22s }
        .partner-select:focus { border-color:var(--inp-bd-foc); box-shadow:0 0 0 3px var(--inp-ring-foc) }
        .partner-select option { background:#0e0f1a }
        .partner-err { font-size:.7rem; color:rgba(236,72,153,.9); margin-top:4px }
        .partner-label { font-family:var(--f-m); font-size:.6rem; font-weight:500; text-transform:uppercase; letter-spacing:.08em; color:var(--tx-3); margin-bottom:6px; display:block }

        /* Step 1 inputs (plain style, no floating label) */
        .s1-input { width:100%; height:48px; padding:0 16px; background:var(--inp-bg); border:1.5px solid var(--inp-bd); border-radius:var(--r-md); font-family:var(--f-b); font-size:.9rem; color:var(--tx-0); outline:none; transition:border-color .22s,background .22s }
        .s1-input::placeholder { color:var(--tx-3) }
        .s1-input:focus { border-color:var(--inp-bd-foc); background:var(--inp-bg-foc); box-shadow:0 0 0 3px var(--inp-ring-foc) }
        .s1-input.has-err { border-color:var(--inp-bd-err); box-shadow:0 0 0 3px var(--inp-ring-err) }
        .s1-label { font-family:var(--f-m); font-size:.63rem; font-weight:500; text-transform:uppercase; letter-spacing:.09em; color:var(--tx-3); margin-bottom:8px; display:flex; align-items:center; gap:6px }
        .s1-err { font-size:.72rem; color:rgba(236,72,153,.9); margin-top:5px }
        .s1-info { font-size:.74rem; color:rgba(124,58,237,.8); background:rgba(124,58,237,.08); border:1px solid rgba(124,58,237,.18); border-radius:var(--r-sm); padding:8px 12px; margin-top:8px; display:flex; align-items:center; gap:7px }

        /* Scrollbar */
        .aibms-right::-webkit-scrollbar { width:5px }
        .aibms-right::-webkit-scrollbar-track { background:transparent }
        .aibms-right::-webkit-scrollbar-thumb { background:rgba(255,255,255,.1); border-radius:9px }
        .aibms-right::-webkit-scrollbar-thumb:hover { background:rgba(255,255,255,.18) }

        /* Scroll padding so content breathes at top/bottom */
        .aibms-scroll-inner { width:100%; max-width:520px; padding: 32px 0; }
      `}</style>

      <div style={{ display: 'flex', width: '100vw', height: '100vh', background: 'var(--bg)' }}>

        {/* ══ LEFT PANEL ══ */}
        <div className="aibms-left">
          <div className="l-bg" /><div className="l-grid" /><div className="l-aurora" />
          <ParticleCanvas />
          <div className="l-vig" />

          {/* Floating step chips */}
          <div style={{ position: 'absolute', inset: 0, zIndex: 3, pointerEvents: 'none' }}>
            <div className="aibms-step s1"><div className="st-num">1</div><div className="st-body"><span className="st-ttl">Quick setup</span><span className="st-dsc">Live in under 1 hour, no engineers needed</span></div></div>
            <div className="aibms-step s2"><div className="st-num">2</div><div className="st-body"><span className="st-ttl">Connect tools</span><span className="st-dsc">300+ integrations in one click</span></div></div>
            <div className="aibms-step s3"><div className="st-num">3</div><div className="st-body"><span className="st-ttl">AI takes over</span><span className="st-dsc">Automation starts working from day one</span></div></div>
            <div className="aibms-step s4">
              <div className="st-num" style={{ background: 'linear-gradient(135deg,#10B981,#059669)', boxShadow: '0 0 12px rgba(16,185,129,.4)' }}>✓</div>
              <div className="st-body"><span className="st-ttl">Results in days</span><span className="st-dsc">Average 40% efficiency gain in first week</span></div>
            </div>
          </div>

          <div className="l-inner">
            {/* Logo */}
            <div className="aibms-logo">
              <div className="logo-mark">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ position: 'relative', zIndex: 1 }}>
                  <path d="M10 2L18 17H2L10 2Z" stroke="white" strokeWidth="1.7" strokeLinejoin="round" />
                  <line x1="5.5" y1="12" x2="14.5" y2="12" stroke="white" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
              </div>
              <span className="logo-name">AI<span className="grad">BMS</span></span>
            </div>

            {/* Hero */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '24px 0' }}>
              <div className="l-eyebrow"><div className="ey-dot" />Join 1,200+ Businesses</div>
              <h1 className="l-title">Start automating<br />your business <span className="grad">with AI.</span></h1>
              <p className="l-sub">Create your account in 30 seconds. No credit card. No engineers. Just AI working for you from day one.</p>
              <div className="l-benefits">
                {['14-day free trial — no credit card required', 'Cancel anytime, no lock-in', 'SOC2 certified, GDPR compliant'].map((t, i) => (
                  <div key={i} className="b-row">
                    <div className="b-chk"><svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l2.8 3L9 1" stroke="#34D399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
                    {t}
                  </div>
                ))}
              </div>
            </div>

            {/* Trust badges */}
            <div className="l-trust">
              <div className="t-badge"><svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M5.5 1L7 4H10L7.5 6 8.5 9.5 5.5 7.5 2.5 9.5 3.5 6 1 4H4Z" stroke="currentColor" strokeWidth="1" /></svg>G2 Leader 2025</div>
              <div className="t-sep" />
              <div className="t-badge"><svg width="11" height="11" viewBox="0 0 11 11" fill="none"><circle cx="5.5" cy="5.5" r="4.5" stroke="currentColor" strokeWidth="1" /><path d="M3.5 5.5l1.5 1.5 2.5-2.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" /></svg>4.9★ on G2</div>
              <div className="t-sep" />
              <div className="t-badge"><svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M5.5 1L9.5 3.2v3.5C9.5 9 7.8 10.2 5.5 11 3.2 10.2 1.5 9 1.5 6.7V3.2L5.5 1Z" stroke="currentColor" strokeWidth="1" /></svg>Enterprise-grade</div>
            </div>
          </div>
        </div>

        {/* ══ RIGHT PANEL ══ */}
        <div className="aibms-right">
          <div className="aibms-scroll-inner">
            {success ? (
              <div className="aibms-success">
                <div className="success-icon">
                  <CheckCircle2 size={32} color="#10B981" />
                </div>
                <h2 style={{ fontFamily: 'var(--f-d)', fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-.04em', color: 'var(--tx-0)', marginBottom: 10 }}>Account Created!</h2>
                <p style={{ fontSize: '.88rem', color: 'var(--tx-2)', marginBottom: 24 }}>Business set up. Redirecting to your dashboard…</p>
                <div style={{ width: 32, height: 32, border: '2px solid rgba(16,185,129,.3)', borderTop: '2px solid #10B981', borderRadius: '50%', margin: '0 auto', animation: 'spin-border 1s linear infinite' }} />
              </div>
            ) : (
              <div className="aibms-form-box">
                <Link to="/" className="aibms-btn-back" style={{ alignSelf: 'flex-start', marginBottom: 20, padding: '0 12px', height: 36, display: 'inline-flex', width: 'fit-content', textDecoration: 'none' }}>
                  <ArrowLeft size={16} /> Back to Home
                </Link>
                <div className="form-head">
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div className="f-eyebrow"><div className="ey-dot" />Get Started Free</div>
                    <StepIndicator current={step} total={totalSteps} />
                  </div>
                  <h2 className="f-title">
                    {step === 1 ? 'Set up your Business' : step === 2 ? 'Create Your Account' : 'Add Partners'}
                  </h2>
                  <p className="f-sub">
                    {step === 1 ? 'Tell us about your business first.' : step === 2 ? 'Join thousands running smarter with AIBMS.' : `Adding co-owners for ${step1.businessType}.`}
                  </p>
                </div>

                {/* ── Social sign-up (step 1 only) ── */}
                {step === 1 && (
                  <>
                    <div className="aibms-socials">
                    </div>
                    <div className="aibms-divider">
                      <div className="div-line" /><span className="div-txt">or sign up with email</span><div className="div-line" />
                    </div>
                  </>
                )}

                {/* ════ STEP 1 — Business Info ════ */}
                {step === 1 && (
                  <div style={{ position: 'relative', zIndex: 1 }}>
                    {/* Business Name */}
                    <div style={{ marginBottom: 14 }}>
                      <label className="s1-label"><Building2 size={11} />Business Name *</label>
                      <input type="text" value={step1.businessName} onChange={s1('businessName')} placeholder="e.g. Agarwal & Co. LLP" className={`s1-input${errors1.businessName ? ' has-err' : ''}`} />
                      {errors1.businessName && <div className="s1-err">⚠ {errors1.businessName}</div>}
                    </div>

                    {/* Business Type */}
                    <div style={{ marginBottom: 14 }}>
                      <label className="s1-label">Business Type *</label>
                      <div style={{ position: 'relative' }}>
                        <select value={step1.businessType} onChange={s1('businessType')} className={`s1-input aibms-select${errors1.businessType ? ' has-err' : ''}`} style={{ paddingRight: 40, appearance: 'none', cursor: 'pointer' }}>
                          <option value="">Select business type</option>
                          {businessTypes.map(t => <option key={t}>{t}</option>)}
                        </select>
                        <ChevronDown size={14} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--tx-3)', pointerEvents: 'none' }} />
                      </div>
                      {errors1.businessType && <div className="s1-err">⚠ {errors1.businessType}</div>}
                      {isPartnership && (
                        <div className="s1-info"><Users size={12} style={{ flexShrink: 0 }} />You'll be able to add co-owners / partners in the next step.</div>
                      )}
                    </div>

                    {/* Industry */}
                    <div style={{ marginBottom: 14 }}>
                      <label className="s1-label">Industry <span style={{ color: 'var(--tx-4)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(Optional)</span></label>
                      <div style={{ position: 'relative' }}>
                        <select value={step1.industry} onChange={s1('industry')} className="s1-input aibms-select" style={{ paddingRight: 40, appearance: 'none', cursor: 'pointer' }}>
                          <option value="">Select industry</option>
                          {industries.map(i => <option key={i}>{i}</option>)}
                        </select>
                        <ChevronDown size={14} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--tx-3)', pointerEvents: 'none' }} />
                      </div>
                    </div>

                    {/* GSTIN */}
                    <div style={{ marginBottom: 14 }}>
                      <label className="s1-label">GSTIN <span style={{ color: 'var(--tx-4)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(Optional)</span></label>
                      <input type="text" value={step1.gstin} onChange={s1('gstin')} placeholder="e.g. 27AARCA1234A1Z5" maxLength={15} className="s1-input" style={{ textTransform: 'uppercase' }} />
                    </div>

                    {/* City & State */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                      <div>
                        <label className="s1-label">City *</label>
                        <input type="text" value={step1.city} onChange={s1('city')} placeholder="Mumbai" className={`s1-input${errors1.city ? ' has-err' : ''}`} />
                        {errors1.city && <div className="s1-err">⚠ {errors1.city}</div>}
                      </div>
                      <div>
                        <label className="s1-label">State</label>
                        <input type="text" value={step1.state} onChange={s1('state')} placeholder="Maharashtra" className="s1-input" />
                      </div>
                    </div>

                    <button type="button" onClick={handleNextFromStep1} className="aibms-btn-next" style={{ width: '100%' }}>
                      Continue to Step 2 <ArrowRight size={15} />
                    </button>
                  </div>
                )}

                {/* ════ STEP 2 — Owner Account ════ */}
                {step === 2 && (
                  <form onSubmit={isPartnership ? e => { e.preventDefault(); handleNextFromStep2() } : handleSubmit} style={{ position: 'relative', zIndex: 1 }}>

                    {/* Owner name */}
                    <Field id="ownerName" label={isPartnership ? 'Primary Owner / Managing Partner Name' : 'Owner / Admin Name'}
                      value={step2.ownerName} onChange={s2('ownerName')} autoComplete="name"
                      state={fieldState2('ownerName')} errorMsg={errors2.ownerName} />

                    {/* Email */}
                    <Field id="email2" type="email" label="Work email address"
                      value={step2.email} onChange={s2('email')} autoComplete="email"
                      state={fieldState2('email')} errorMsg={errors2.email} />

                    {/* Phone */}
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, height: 'var(--inp-h)', padding: '0 14px', background: 'var(--inp-bg)', border: '1.5px solid var(--inp-bd)', borderRadius: 'var(--r-md)', fontSize: '.85rem', color: 'var(--tx-2)', fontFamily: 'var(--f-m)', flexShrink: 0 }}>🇮🇳 +91</div>
                        <div className={`aibms-field${errors2.phone ? ' err' : step2.phone ? ' ok' : ''}`} style={{ flex: 1, marginBottom: 0 }}>
                          <div style={{ position: 'relative' }}>
                            <input id="phone" type="tel" value={step2.phone} onChange={s2('phone')} placeholder=" " autoComplete="tel" maxLength={10} className="aibms-fi" />
                            <label htmlFor="phone" className="aibms-fl">Mobile number</label>
                            <span className="aibms-fi-ico ico-ok"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8l4 4 6-6" stroke="#34D399" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
                            <span className="aibms-fi-ico ico-err"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="#EC4899" strokeWidth="1.4" /><path d="M8 5v3.5M8 11v.3" stroke="#EC4899" strokeWidth="1.5" strokeLinecap="round" /></svg></span>
                          </div>
                        </div>
                      </div>
                      {errors2.phone && <div className="aibms-f-err" style={{ marginTop: 5 }}><svg width="11" height="11" viewBox="0 0 11 11" fill="none"><circle cx="5.5" cy="5.5" r="4.5" stroke="currentColor" strokeWidth="1.1" /><path d="M5.5 3.5v2.5M5.5 7.5v.3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" /></svg>{errors2.phone}</div>}
                    </div>

                    {/* Password */}
                    <div>
                      <Field id="password" type={showPass ? 'text' : 'password'} label="Create password"
                        value={step2.password} onChange={s2('password')} autoComplete="new-password"
                        state={fieldState2('password')} errorMsg={errors2.password}
                        rightSlot={<EyeBtn show={showPass} onToggle={() => setShowPass(p => !p)} />} />
                      <PwStrength password={step2.password} />
                    </div>

                    {/* Confirm */}
                    <Field id="confirm" type={showConfirmPass ? 'text' : 'password'} label="Confirm password"
                      value={step2.confirmPassword} onChange={s2('confirmPassword')} autoComplete="new-password"
                      state={fieldState2('confirmPassword')} errorMsg={errors2.confirmPassword}
                      rightSlot={<EyeBtn show={showConfirmPass} onToggle={() => setShowConfirmPass(p => !p)} />} />

                    {/* Terms */}
                    <div className={`aibms-terms${termsShake ? ' shake' : ''}`} onClick={() => setTermsChecked(p => !p)}>
                      <div className={`terms-box${termsChecked ? ' checked' : ''}`}>
                        {termsChecked && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l2.8 3L9 1" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                      </div>
                      <p className="terms-txt">
                        I agree to AIBMS's <a href="#" onClick={e => e.stopPropagation()}>Terms of Service</a> and <a href="#" onClick={e => e.stopPropagation()}>Privacy Policy</a>. I understand my data is processed securely.
                      </p>
                    </div>

                    {error && <div className="aibms-err-banner">⚠ {error}</div>}

                    <div style={{ display: 'flex', gap: 10 }}>
                      <button type="button" onClick={() => setStep(1)} className="aibms-btn-back"><ArrowLeft size={14} />Back</button>
                      <button type="submit" disabled={loading} className="aibms-btn-next" style={{ flex: 1 }}>
                        {loading ? <><Loader2 size={15} style={{ animation: 'spin-border 1s linear infinite' }} />Creating…</>
                          : isPartnership ? <>Continue<ArrowRight size={15} /></>
                            : <>Create My Account →</>}
                      </button>
                    </div>
                  </form>
                )}

                {/* ════ STEP 3 — Partners ════ */}
                {step === 3 && isPartnership && (
                  <form onSubmit={handleSubmit} style={{ position: 'relative', zIndex: 1 }}>
                    {/* Skip toggle */}
                    <div className={`skip-row${skipPartners ? ' active' : ''}`} onClick={() => setSkipPartners(p => !p)}>
                      <div className={`skip-check${skipPartners ? ' checked' : ''}`}>
                        {skipPartners && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l2.8 3L9 1" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                      </div>
                      <div>
                        <p style={{ fontSize: '.82rem', fontWeight: 600, color: 'var(--tx-1)', marginBottom: 2 }}>Skip for now</p>
                        <p style={{ fontSize: '.72rem', color: 'var(--tx-3)' }}>You can invite partners from Settings later</p>
                      </div>
                    </div>

                    {!skipPartners && (
                      <>
                        <p style={{ fontSize: '.78rem', color: 'var(--tx-3)', lineHeight: 1.6, marginBottom: 14 }}>
                          Add your co-owners or partners below. Their accounts will be created automatically — they'll receive login details to join your business.
                        </p>

                        {partners.map((partner, idx) => (
                          <div key={idx} className="partner-card">
                            <div className="partner-card-header">
                              <p style={{ fontSize: '.78rem', fontWeight: 700, color: 'var(--tx-1)', display: 'flex', alignItems: 'center', gap: 7 }}>
                                <Users size={12} style={{ color: '#7C3AED' }} />Partner {idx + 1}
                              </p>
                              {partners.length > 1 && (
                                <button type="button" onClick={() => removePartner(idx)} className="aibms-btn-remove"><Trash2 size={12} /></button>
                              )}
                            </div>

                            {/* Name */}
                            <div style={{ marginBottom: 10 }}>
                              <label className="partner-label">Full Name *</label>
                              <input type="text" value={partner.name} onChange={e => updatePartner(idx, 'name', e.target.value)} placeholder="e.g. Priya Sharma" className={`partner-input${errors3[idx]?.name ? ' has-err' : ''}`} />
                              {errors3[idx]?.name && <p className="partner-err">⚠ {errors3[idx].name}</p>}
                            </div>

                            {/* Email + Phone */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                              <div>
                                <label className="partner-label">Email *</label>
                                <input type="email" value={partner.email} onChange={e => updatePartner(idx, 'email', e.target.value)} placeholder="partner@email.com" className={`partner-input${errors3[idx]?.email ? ' has-err' : ''}`} />
                                {errors3[idx]?.email && <p className="partner-err">⚠ {errors3[idx].email}</p>}
                              </div>
                              <div>
                                <label className="partner-label">Phone</label>
                                <input type="tel" value={partner.phone} onChange={e => updatePartner(idx, 'phone', e.target.value)} placeholder="98765 43210" maxLength={10} className="partner-input" />
                              </div>
                            </div>

                            {/* Role */}
                            <div>
                              <label className="partner-label">Role</label>
                              <div style={{ position: 'relative' }}>
                                <select value={partner.role} onChange={e => updatePartner(idx, 'role', e.target.value)} className="partner-select">
                                  {PARTNER_ROLE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                </select>
                                <ChevronDown size={12} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--tx-3)', pointerEvents: 'none' }} />
                              </div>
                              {partner.role === 'business_owner' && (
                                <p style={{ fontSize: '.7rem', color: '#10B981', background: 'rgba(16,185,129,.08)', border: '1px solid rgba(16,185,129,.18)', borderRadius: 'var(--r-sm)', padding: '6px 10px', marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <CheckCircle2 size={10} />This person will have full co-owner access
                                </p>
                              )}
                            </div>
                          </div>
                        ))}

                        {partners.length < 5 && (
                          <button type="button" onClick={addPartner} className="aibms-btn-add" style={{ marginBottom: 14 }}>
                            <Plus size={13} />Add Another Partner
                          </button>
                        )}
                      </>
                    )}

                    {error && <div className="aibms-err-banner">⚠ {error}</div>}

                    <div style={{ display: 'flex', gap: 10 }}>
                      <button type="button" onClick={() => setStep(2)} className="aibms-btn-back"><ArrowLeft size={14} />Back</button>
                      <button type="submit" disabled={loading} className="aibms-btn-next" style={{ flex: 1 }}>
                        {loading ? <><Loader2 size={15} style={{ animation: 'spin-border 1s linear infinite' }} />Creating account…</>
                          : <><CheckCircle2 size={15} />Create Account</>}
                      </button>
                    </div>

                    <p style={{ textAlign: 'center', fontSize: '.7rem', color: 'var(--tx-3)', marginTop: 14 }}>
                      Partner accounts are created automatically. They'll receive login details to get started.
                    </p>
                  </form>
                )}

                <div className="f-switch">
                  Already have an account? <Link to="/login">Sign in</Link>
                </div>
              </div>
            )}
          </div>{/* end aibms-scroll-inner */}
        </div>
      </div>
    </>
  )
}