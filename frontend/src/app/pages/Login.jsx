import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, ArrowRight, ArrowLeft, Loader2 } from 'lucide-react'
import { normalizeRole } from '../utils/rbac'

// ─── unchanged from original ──────────────────────────────────────────────────
const API_BASE = (import.meta.env.VITE_API_BASE || (import.meta.env.PROD ? 'https://aibms-8mx2.onrender.com' : 'http://localhost:8000'))

// ─── Inject scoped CSS once (no stylesheet file needed) ───────────────────────
const CSS_ID = 'aibms-login-css'
if (!document.getElementById(CSS_ID)) {
  const el = document.createElement('style')
  el.id = CSS_ID
  el.textContent = `
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&family=DM+Mono:wght@400;500&display=swap');

/* ── tokens ──────────────────────────────────────── */
.aibms-login-root {
  --bg:           #04050d;
  --g-brand:      linear-gradient(135deg,#4C6EF5 0%,#9333EA 55%,#EC4899 100%);
  --g-text:       linear-gradient(135deg,#93c5fd 0%,#c084fc 45%,#f9a8d4 100%);
  --g-btn:        linear-gradient(120deg,#4C6EF5 0%,#7C3AED 50%,#9333EA 100%);
  --tx-0: #fff;
  --tx-1: rgba(255,255,255,.78);
  --tx-2: rgba(255,255,255,.50);
  --tx-3: rgba(255,255,255,.32);
  --bd:   rgba(255,255,255,.08);
  --bd-hi:rgba(255,255,255,.16);
  --inp-bg:       rgba(255,255,255,.040);
  --inp-bg-foc:   rgba(255,255,255,.062);
  --inp-bd:       rgba(255,255,255,.10);
  --inp-bd-foc:   rgba(124,58,237,.72);
  --inp-bd-ok:    rgba(16,185,129,.55);
  --inp-bd-err:   rgba(236,72,153,.65);
  --inp-ring-foc: rgba(124,58,237,.16);
  --inp-ring-ok:  rgba(16,185,129,.12);
  --inp-ring-err: rgba(236,72,153,.14);
  --f-d: 'Bricolage Grotesque', sans-serif;
  --f-b: 'DM Sans', sans-serif;
  --f-m: 'DM Mono', monospace;
  --ease:     cubic-bezier(.25,1,.5,1);
  --ease-spr: cubic-bezier(.34,1.56,.64,1);
  --ease-exp: cubic-bezier(.16,1,.3,1);
  --r-sm: 8px;
  --r-md: 14px;
  /* input geometry */
  --inp-h:      56px;
  --inp-px:     18px;
  --inp-pt:     22px;
  --inp-pb:     10px;
  --lbl-rest:   50%;
  --lbl-flt:    11px;
  --lbl-flt-sz: .62rem;
}

/* ── page shell ──────────────────────────────────── */
.aibms-login-root {
  display: flex;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  font-family: var(--f-b);
  background: var(--bg);
  color: var(--tx-0);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* ── left panel ──────────────────────────────────── */
.alr-left {
  flex: 0 0 54%;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 44px 56px 48px;
}
.alr-l-bg {
  position: absolute; inset: 0; z-index: 0;
  background:
    radial-gradient(ellipse 82% 72% at 14% 56%, rgba(76,110,245,.26) 0%, transparent 60%),
    radial-gradient(ellipse 66% 66% at 86% 18%, rgba(147,51,234,.20) 0%, transparent 60%),
    radial-gradient(ellipse 56% 56% at 56% 96%, rgba(236,72,153,.16) 0%, transparent 55%),
    radial-gradient(ellipse 44% 44% at 4%   4%, rgba(6,182,212,.10)  0%, transparent 55%);
  animation: alr-bgshift 18s ease-in-out infinite alternate;
}
@keyframes alr-bgshift {
  0%   { filter: hue-rotate(0deg)  brightness(1);   opacity: .82 }
  100% { filter: hue-rotate(20deg) brightness(1.08); opacity: 1   }
}
.alr-l-grid {
  position: absolute; inset: 0; z-index: 1; pointer-events: none;
  background-image:
    linear-gradient(rgba(255,255,255,.022) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,.022) 1px, transparent 1px);
  background-size: 72px 72px;
  mask-image: radial-gradient(ellipse 90% 90% at 50% 50%, black 18%, transparent 82%);
  -webkit-mask-image: radial-gradient(ellipse 90% 90% at 50% 50%, black 18%, transparent 82%);
}
.alr-l-aurora {
  position: absolute; inset: 0; z-index: 1; pointer-events: none;
  background: linear-gradient(110deg,
    transparent 0%, rgba(76,110,245,.07) 22%,
    rgba(147,51,234,.12) 50%, rgba(236,72,153,.07) 78%, transparent 100%);
  background-size: 260% 260%;
  animation: alr-aurora 16s ease-in-out infinite alternate;
}
@keyframes alr-aurora {
  0%   { background-position: 0%   50%; opacity: .45 }
  50%  { background-position: 100% 50%; opacity: 1   }
  100% { background-position: 0%   50%; opacity: .6  }
}
.alr-l-vig {
  position: absolute; inset: 0; z-index: 2; pointer-events: none;
  background: radial-gradient(ellipse 88% 88% at 50% 50%, transparent 32%, rgba(4,5,13,.8) 100%);
}
.alr-canvas {
  position: absolute; inset: 0; z-index: 1; pointer-events: none;
}

/* floating metric chips */
.alr-chips { position: absolute; inset: 0; z-index: 3; pointer-events: none; }
.alr-chip {
  position: absolute;
  display: flex; align-items: center; gap: 10px;
  padding: 10px 16px;
  background: rgba(8,5,20,.82);
  border: 1px solid rgba(255,255,255,.11);
  border-radius: var(--r-md);
  box-shadow: 0 8px 28px rgba(0,0,0,.48), inset 0 1px 0 rgba(255,255,255,.06);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  opacity: 0;
}
.alr-chip-ico {
  width: 28px; height: 28px; border-radius: var(--r-sm);
  display: flex; align-items: center; justify-content: center;
  font-size: .88rem; flex-shrink: 0;
}
.alr-chip-body { display: flex; flex-direction: column; gap: 1px; }
.alr-chip-lbl {
  font-family: var(--f-m); font-size: .58rem; font-weight: 500;
  color: var(--tx-3); letter-spacing: .07em; text-transform: uppercase;
}
.alr-chip-val { font-family: var(--f-m); font-size: .82rem; font-weight: 700; }

/* left inner content */
.alr-l-inner {
  position: relative; z-index: 4;
  display: flex; flex-direction: column;
  justify-content: space-between; height: 100%;
}

/* logo */
.alr-logo {
  display: flex; align-items: center; gap: 10px;
  opacity: 0; animation: alr-fadeup .8s var(--ease-exp) .2s forwards;
}
.alr-logo-mark {
  width: 36px; height: 36px; border-radius: 9px;
  background: var(--g-brand);
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 0 20px rgba(124,58,237,.4);
  position: relative; overflow: hidden; flex-shrink: 0;
}
.alr-logo-mark::before {
  content: ''; position: absolute; inset: 0;
  background: radial-gradient(ellipse at 30% 25%, rgba(255,255,255,.22) 0%, transparent 60%);
}
.alr-logo-mark svg { position: relative; z-index: 1; }
.alr-logo-name { font-family: var(--f-d); font-size: 1.15rem; font-weight: 800; letter-spacing: -.03em; }
.alr-logo-grad {
  background: var(--g-text);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
}

/* hero section */
.alr-l-hero { flex: 1; display: flex; flex-direction: column; justify-content: center; padding: 24px 0; }
.alr-l-eyebrow {
  display: inline-flex; align-items: center; gap: 8px;
  font-family: var(--f-m); font-size: .67rem; font-weight: 500;
  text-transform: uppercase; letter-spacing: .13em; color: var(--tx-2);
  margin-bottom: 22px;
  opacity: 0; animation: alr-fadeup .8s var(--ease-exp) .35s forwards;
}
.alr-ey-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--g-brand); box-shadow: 0 0 8px rgba(147,51,234,.8);
  flex-shrink: 0; animation: alr-dotpulse 2.4s ease-in-out infinite;
}
@keyframes alr-dotpulse {
  0%,100% { opacity: 1; transform: scale(1); }
  50%     { opacity: .44; transform: scale(.74); }
}
.alr-l-title {
  font-family: var(--f-d);
  font-size: clamp(2rem, 3.4vw, 2.9rem);
  font-weight: 800; letter-spacing: -.04em; line-height: 1.08;
  color: var(--tx-0); margin-bottom: 18px;
  text-shadow: 0 2px 40px rgba(0,0,0,.7);
  opacity: 0; animation: alr-fadeup .8s var(--ease-exp) .48s forwards;
}
.alr-title-grad {
  background: var(--g-text);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
  filter: drop-shadow(0 0 18px rgba(147,51,234,.45));
}
.alr-l-sub {
  font-size: .95rem; font-weight: 300; color: var(--tx-2); line-height: 1.74; max-width: 340px;
  opacity: 0; animation: alr-fadeup .8s var(--ease-exp) .6s forwards;
}
@keyframes alr-fadeup { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }

/* trust badges */
.alr-l-trust {
  display: flex; align-items: center; gap: 18px; flex-wrap: wrap;
  opacity: 0; animation: alr-fadeup .8s var(--ease-exp) .75s forwards;
}
.alr-t-badge {
  display: flex; align-items: center; gap: 6px;
  font-family: var(--f-m); font-size: .6rem; font-weight: 500;
  color: var(--tx-3); letter-spacing: .05em;
}
.alr-t-badge svg { opacity: .48; }
.alr-t-sep { width: 3px; height: 3px; border-radius: 50%; background: rgba(255,255,255,.18); }

/* ── right panel ─────────────────────────────────── */
.alr-right {
  flex: 0 0 46%;
  position: relative;
  display: flex; align-items: center; justify-content: center;
  padding: 48px 52px;
  background: rgba(255,255,255,.014);
  border-left: 1px solid var(--bd);
  overflow-y: auto; overflow-x: hidden;
}
.alr-right::before {
  content: ''; position: absolute; inset: 0; pointer-events: none; z-index: 0;
  background:
    radial-gradient(ellipse 70% 45% at 50% -5%,  rgba(76,110,245,.055) 0%, transparent 65%),
    radial-gradient(ellipse 55% 40% at 50% 108%, rgba(147,51,234,.04)  0%, transparent 62%);
}

/* ── glassmorphic form card ──────────────────────── */
.alr-form-box {
  position: relative; z-index: 1;
  width: 100%; max-width: 420px;
  background: rgba(255,255,255,.032);
  border: 1px solid rgba(255,255,255,.09);
  border-radius: 24px;
  padding: 40px 36px 36px;
  box-shadow:
    0 0 0 1px rgba(255,255,255,.04),
    0 20px 60px rgba(0,0,0,.42),
    inset 0 2px 0 rgba(255,255,255,.05);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  overflow: hidden;
  opacity: 0; transform: translateY(24px) scale(.978);
  animation: alr-boxenter 1s var(--ease-exp) .28s forwards;
}
.alr-form-box::before {
  content: ''; position: absolute; top: 0; left: 0; width: 62%; height: 48%;
  background: radial-gradient(ellipse at 12% 12%, rgba(255,255,255,.045) 0%, transparent 68%);
  border-radius: 24px 0 0 0; pointer-events: none; z-index: 0;
}
.alr-form-box::after {
  content: ''; position: absolute; top: 0; left: 15%; right: 15%; height: 1px; z-index: 1;
  background: linear-gradient(90deg,
    transparent 0%, rgba(76,110,245,.5) 30%,
    rgba(147,51,234,.7) 50%, rgba(236,72,153,.5) 70%, transparent 100%);
  box-shadow: 0 0 16px rgba(147,51,234,.28);
}
@keyframes alr-boxenter { to { opacity: 1; transform: none; } }

/* ── form header ─────────────────────────────────── */
.alr-form-head { position: relative; z-index: 1; margin-bottom: 32px; }
.alr-f-eyebrow {
  display: inline-flex; align-items: center; gap: 7px;
  font-family: var(--f-m); font-size: .64rem; font-weight: 500;
  text-transform: uppercase; letter-spacing: .13em;
  color: var(--tx-3); margin-bottom: 14px;
}
.alr-f-title {
  font-family: var(--f-d);
  font-size: clamp(1.65rem, 2.5vw, 2rem);
  font-weight: 800; letter-spacing: -.04em; line-height: 1.12;
  color: var(--tx-0); margin-bottom: 10px;
}
.alr-f-sub { font-size: .88rem; font-weight: 300; color: var(--tx-2); line-height: 1.65; font-style: italic; }

/* ── floating-label field ────────────────────────── */
.alr-field { position: relative; margin-bottom: 20px; }
.alr-field-wrap { position: relative; }

/* input */
.alr-fi {
  width: 100%;
  height: var(--inp-h);
  padding: var(--inp-pt) var(--inp-px) var(--inp-pb);
  background: var(--inp-bg);
  border: 1.5px solid var(--inp-bd);
  border-radius: var(--r-md);
  font-family: var(--f-b); font-size: .96rem; font-weight: 400;
  color: var(--tx-0);
  outline: none;
  -webkit-appearance: none;
  transition: border-color .28s var(--ease), background .28s var(--ease), box-shadow .28s var(--ease);
  will-change: border-color, background, box-shadow;
}
.alr-fi::placeholder { color: transparent; }
.alr-fi:focus {
  border-color: var(--inp-bd-foc);
  background: var(--inp-bg-foc);
  box-shadow: 0 0 0 3.5px var(--inp-ring-foc), 0 2px 18px rgba(124,58,237,.07);
}

/* floating label */
.alr-fl {
  position: absolute;
  left: var(--inp-px); top: var(--lbl-rest);
  transform: translateY(-50%);
  pointer-events: none;
  font-family: var(--f-b); font-size: .96rem; font-weight: 400; color: var(--tx-3);
  transition:
    top .22s var(--ease), transform .22s var(--ease),
    font-size .22s var(--ease), font-weight .22s var(--ease),
    color .22s var(--ease), letter-spacing .22s var(--ease);
  transform-origin: left top;
  white-space: nowrap;
}
.alr-fi:focus ~ .alr-fl,
.alr-fi:not(:placeholder-shown) ~ .alr-fl {
  top: var(--lbl-flt); transform: none;
  font-size: var(--lbl-flt-sz); font-weight: 500;
  letter-spacing: .07em; text-transform: uppercase; color: var(--tx-3);
}
.alr-fi:focus ~ .alr-fl { color: rgba(167,139,250,.92); }

/* field states */
.alr-field--ok .alr-fi  { border-color: var(--inp-bd-ok);  box-shadow: 0 0 0 3px var(--inp-ring-ok);  }
.alr-field--ok .alr-fl  { color: rgba(52,211,153,.8); }
.alr-field--err .alr-fi { border-color: var(--inp-bd-err); box-shadow: 0 0 0 3px var(--inp-ring-err); animation: alr-shake .38s var(--ease-spr); }
.alr-field--err .alr-fl { color: rgba(236,72,153,.88); }
@keyframes alr-shake {
  0%,100% { transform: translateX(0);  }
  20%     { transform: translateX(-5px); }
  40%     { transform: translateX(5px);  }
  60%     { transform: translateX(-3px); }
  80%     { transform: translateX(3px);  }
}

/* right-side state icons */
.alr-fi-ico {
  position: absolute; right: 14px; top: 50%;
  display: flex; align-items: center; justify-content: center;
  width: 22px; height: 22px; pointer-events: none;
  opacity: 0; transform: translateY(-50%) scale(.7);
  transition: opacity .28s var(--ease), transform .3s var(--ease-spr);
}
.alr-field--ok  .alr-fi-ico.ico-ok  { opacity: 1; transform: translateY(-50%) scale(1); }
.alr-field--err .alr-fi-ico.ico-err { opacity: 1; transform: translateY(-50%) scale(1); }

/* eye toggle */
.alr-fi-eye {
  position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
  width: 32px; height: 32px; border-radius: var(--r-sm);
  background: none; border: none; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  color: var(--tx-3);
  transition: color .2s, background .2s, transform .2s var(--ease-spr);
}
.alr-fi-eye:hover  { color: var(--tx-1); background: rgba(255,255,255,.06); transform: translateY(-50%) scale(1.08); }
.alr-fi-eye:active { transform: translateY(-50%) scale(.94); }

/* error message pill */
.alr-f-err {
  display: flex; align-items: center; gap: 6px;
  padding: 7px 12px; margin-top: 6px;
  background: rgba(236,72,153,.07);
  border: 1px solid rgba(236,72,153,.15);
  border-left: 2.5px solid rgba(236,72,153,.6);
  border-radius: 0 var(--r-sm) var(--r-sm) 0;
  font-size: .72rem; color: rgba(236,72,153,.9);
  opacity: 0; transform: translateY(-6px);
  transition: opacity .28s var(--ease), transform .28s var(--ease-spr);
}
.alr-field--err .alr-f-err { opacity: 1; transform: none; }

/* API-level error message */
.alr-api-err {
  display: flex; align-items: center; gap: 7px;
  padding: 10px 14px; margin-bottom: 16px;
  background: rgba(236,72,153,.07);
  border: 1px solid rgba(236,72,153,.15);
  border-left: 2.5px solid rgba(236,72,153,.6);
  border-radius: 0 10px 10px 0;
  font-size: .78rem; color: rgba(236,72,153,.95);
}

/* ── forgot-password row ─────────────────────────── */
.alr-forgot-row { display: flex; justify-content: flex-end; margin-top: -6px; margin-bottom: 24px; }
.alr-forgot {
  font-family: var(--f-m); font-size: .65rem; font-weight: 500;
  color: var(--tx-3); letter-spacing: .04em;
  text-decoration: none; position: relative;
  transition: color .22s;
}
.alr-forgot::after {
  content: ''; position: absolute; bottom: -1px; left: 0;
  width: 0; height: 1px; background: var(--g-brand);
  transition: width .26s var(--ease);
}
.alr-forgot:hover { color: var(--tx-2); }
.alr-forgot:hover::after { width: 100%; }

/* ── primary button ──────────────────────────────── */
.alr-btn-cta {
  width: 100%; padding: 17px;
  border: none; border-radius: var(--r-md); cursor: pointer;
  font-family: var(--f-d); font-size: 1rem; font-weight: 700; letter-spacing: -.01em;
  color: #fff;
  background: var(--g-btn); background-size: 200% 200%; background-position: 0% 50%;
  position: relative; overflow: hidden; isolation: isolate;
  box-shadow:
    0 0 0 1px rgba(255,255,255,.14),
    0 4px 18px rgba(76,110,245,.4),
    0 8px 36px rgba(147,51,234,.26),
    inset 0 1px 0 rgba(255,255,255,.2);
  animation: alr-btnidle 3.8s ease-in-out infinite;
  transition: transform .38s var(--ease-spr), box-shadow .38s var(--ease), background-position .55s var(--ease);
  will-change: transform;
}
@keyframes alr-btnidle {
  0%,100% {
    box-shadow:
      0 0 0 1px rgba(255,255,255,.14), 0 4px 18px rgba(76,110,245,.4),
      0 8px 36px rgba(147,51,234,.26), inset 0 1px 0 rgba(255,255,255,.2);
  }
  50% {
    box-shadow:
      0 0 0 1px rgba(255,255,255,.2),  0 5px 26px rgba(76,110,245,.56),
      0 10px 48px rgba(147,51,234,.38), inset 0 1px 0 rgba(255,255,255,.24);
  }
}
.alr-btn-cta::before {
  content: ''; position: absolute; top: 0; left: -115%; width: 50%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.22), transparent);
  transform: skewX(-18deg); pointer-events: none;
  transition: left .55s var(--ease);
}
.alr-btn-cta::after {
  content: ''; position: absolute; inset: -4px; border-radius: var(--r-md);
  background: var(--g-btn); z-index: -1; opacity: 0; filter: blur(14px);
  transition: opacity .38s var(--ease);
}
.alr-btn-cta:hover {
  animation: none;
  transform: translateY(-2px) scale(1.018);
  background-position: 100% 50%;
  box-shadow:
    0 0 0 1px rgba(255,255,255,.22),
    0 8px 28px rgba(76,110,245,.56),
    0 14px 50px rgba(147,51,234,.4),
    inset 0 1px 0 rgba(255,255,255,.26);
}
.alr-btn-cta:hover::before { left: 165%; }
.alr-btn-cta:hover::after  { opacity: .55; }
.alr-btn-cta:active        { transform: translateY(0) scale(.988); transition-duration: .1s; }
.alr-btn-cta:disabled      { opacity: .7; pointer-events: none; animation: none; }
.alr-btn-inner {
  display: flex; align-items: center; justify-content: center;
  gap: 9px; position: relative; z-index: 1;
}

/* ── divider ─────────────────────────────────────── */
.alr-divider { display: flex; align-items: center; gap: 14px; margin: 24px 0 20px; }
.alr-div-line { flex: 1; height: 1px; background: var(--bd); }
.alr-div-txt  { font-family: var(--f-m); font-size: .6rem; color: var(--tx-3); letter-spacing: .09em; white-space: nowrap; }

/* ── social buttons ──────────────────────────────── */
.alr-socials { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.alr-btn-soc {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  height: 44px; padding: 0 16px;
  background: rgba(255,255,255,.044); border: 1px solid var(--bd); border-radius: var(--r-md);
  font-family: var(--f-b); font-size: .84rem; font-weight: 500;
  color: var(--tx-1); cursor: pointer;
  transition: background .25s var(--ease), border-color .25s var(--ease),
              transform .3s var(--ease-spr), box-shadow .25s var(--ease);
}
.alr-btn-soc:hover  { background: rgba(255,255,255,.076); border-color: var(--bd-hi); transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,.3); }
.alr-btn-soc:active { transform: scale(.97); transition-duration: .1s; }

/* ── switch link ─────────────────────────────────── */
.alr-f-switch { text-align: center; font-size: .84rem; font-weight: 300; color: var(--tx-2); margin-top: 24px; position: relative; z-index: 1; }
.alr-f-switch-link {
  font-weight: 500; text-decoration: none;
  background: var(--g-text);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
  position: relative;
}
.alr-f-switch-link::after {
  content: ''; position: absolute; bottom: -1px; left: 0; right: 0; height: 1px;
  background: var(--g-brand); transform: scaleX(0);
  transition: transform .26s var(--ease);
}
.alr-f-switch-link:hover::after { transform: scaleX(1); }

/* ── responsive ──────────────────────────────────── */
@media (max-width: 900px) {
  .alr-left  { display: none; }
  .alr-right { flex: 1; padding: 40px 28px; border-left: none; background: var(--bg); }
  .aibms-login-root { overflow-y: auto; overflow-x: hidden; height: auto; min-height: 100vh; }
}
@media (max-width: 480px) {
  .alr-right    { padding: 24px 16px; }
  .alr-form-box { padding: 28px 20px 24px; border-radius: 20px; }
}
`
  document.head.appendChild(el)
}

// ─── Particle engine (runs in left-panel canvas) ───────────────────────────────
function startParticles(canvas) {
  const ctx = canvas.getContext('2d')
  const C = [[76, 110, 245], [124, 58, 237], [147, 51, 234], [236, 72, 153], [6, 182, 212]]
  let W, H, pts = [], raf

  const resize = () => { W = canvas.width = canvas.offsetWidth; H = canvas.height = canvas.offsetHeight }

  class P {
    constructor(ry) { this.init(ry) }
    init(ry) {
      this.x = Math.random() * W
      this.y = ry ? Math.random() * H : H + 50
      this.r = 0.4 + Math.random() * 2
      this.vy = -0.1 - Math.random() * 0.4
      this.vx = (Math.random() - 0.5) * 0.18
      this.life = 0; this.max = 260 + Math.random() * 200
      this.col = C[Math.floor(Math.random() * C.length)]
      this.ph = Math.random() * Math.PI * 2
      this.ps = 0.012 + Math.random() * 0.022
    }
    tick() {
      this.x += this.vx; this.y += this.vy; this.life++; this.ph += this.ps
      if (this.life > this.max || this.y < -10) this.init(false)
    }
    draw() {
      const p = this.life / this.max
      const fi = Math.min(p / 0.12, 1)
      const fo = p > 0.8 ? 1 - (p - 0.8) / 0.2 : 1
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

  const init = () => { resize(); pts = Array.from({ length: Math.floor(W * H / 11000) }, () => new P(true)) }
  const loop = () => { ctx.clearRect(0, 0, W, H); pts.forEach(p => { p.tick(); p.draw() }); raf = requestAnimationFrame(loop) }
  const onResize = () => { resize(); pts = Array.from({ length: Math.floor(W * H / 11000) }, () => new P(true)) }

  window.addEventListener('resize', onResize)
  init(); loop()
  return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize) }
}

// ─── Static chip data ──────────────────────────────────────────────────────────
const CHIPS = [
  { style: { top: '16%', left: '6%', '--cd': '.9s', '--cb': '1.4s' }, bg: 'rgba(76,110,245,.18)', icon: '⚡', lbl: 'Efficiency', val: '+40%', color: '#93c5fd' },
  { style: { top: '27%', right: '7%', '--cd': '1.1s', '--cb': '1.9s' }, bg: 'rgba(52,211,153,.14)', icon: '✓', lbl: 'Automation', val: '98.4%', color: '#34D399' },
  { style: { bottom: '28%', left: '5%', '--cd': '1.3s', '--cb': '2.4s' }, bg: 'rgba(147,51,234,.18)', icon: '🚀', lbl: 'Operations', val: '3× faster', color: '#c084fc' },
  { style: { bottom: '18%', right: '6%', '--cd': '1.5s', '--cb': '2.9s' }, bg: 'rgba(245,158,11,.14)', icon: '📈', lbl: 'Revenue', val: '+31% avg', color: '#fcd34d' },
]

// ─── SVGs reused in JSX ────────────────────────────────────────────────────────
const IcoOk = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M3 8l4 4 6-6" stroke="#34D399" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
const IcoErr = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="8" r="6" stroke="#EC4899" strokeWidth="1.4" />
    <path d="M8 5v3.5M8 11v.3" stroke="#EC4899" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)
const IcoErrSm = () => (
  <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
    <circle cx="5.5" cy="5.5" r="4.5" stroke="currentColor" strokeWidth="1.1" />
    <path d="M5.5 3.5v2.5M5.5 7.5v.3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
  </svg>
)
const GoogleSvg = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <path d="M17 9.2c0-.6-.06-1.2-.16-1.8H9v3.4h4.5A3.85 3.85 0 0 1 11.7 13v2.2h2.8C16.2 13.5 17 11.5 17 9.2Z" fill="#4285F4" />
    <path d="M9 17c2.3 0 4.2-.75 5.6-2l-2.8-2.2a5.2 5.2 0 0 1-7.8-2.8H1v2.3C2.4 15.4 5.5 17 9 17Z" fill="#34A853" />
    <path d="M4 10A5.2 5.2 0 0 1 4 8V5.7H1A8.4 8.4 0 0 0 1 13L4 10Z" fill="#FBBC05" />
    <path d="M9 3.5c1.3 0 2.5.45 3.4 1.3L14.7 2.6A8.8 8.8 0 0 0 9 1 8.6 8.6 0 0 0 1 5.7L4 8c.6-1.8 2.3-4.5 5-4.5Z" fill="#EA4335" />
  </svg>
)
const GitHubSvg = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <path d="M9 1.5A7.5 7.5 0 0 0 1.5 9a7.5 7.5 0 0 0 5.1 7.1c.37.07.5-.17.5-.37v-1.3c-2.06.45-2.49-.99-2.49-.99a1.96 1.96 0 0 0-.82-1.08c-.67-.46.05-.45.05-.45.74.05 1.13.76 1.13.76.66 1.13 1.73.8 2.15.61.07-.48.26-.8.47-.98-1.64-.19-3.37-.82-3.37-3.65 0-.81.29-1.47.76-1.99-.08-.18-.33-.94.07-1.96 0 0 .62-.2 2.03.76A7.1 7.1 0 0 1 9 5.6c.63 0 1.26.08 1.85.24 1.41-.96 2.03-.76 2.03-.76.4 1.02.15 1.78.07 1.96.47.52.76 1.18.76 1.99 0 2.84-1.73 3.46-3.38 3.65.27.23.5.69.5 1.39v2.07c0 .2.14.44.52.36A7.5 7.5 0 0 0 9 1.5Z" fill="currentColor" opacity=".88" />
  </svg>
)

// ══════════════════════════════════════════════════════════════════════════════
//  COMPONENT — all logic identical to the original Login.jsx
// ══════════════════════════════════════════════════════════════════════════════
export function Login() {
  const navigate = useNavigate()

  // ── state — unchanged from original ──────────────────────────────────────
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPwd, setShowPwd] = useState(false)

  // ── field validation UI state (new — purely visual) ───────────────────────
  const [emailState, setEmailState] = useState('')  // '' | 'ok' | 'err'
  const [passState, setPassState] = useState('')

  const canvasRef = useRef(null)
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  // Start particle engine on mount, clean up on unmount
  useEffect(() => {
    if (!canvasRef.current) return
    return startParticles(canvasRef.current)
  }, [])

  // ── helpers ───────────────────────────────────────────────────────────────
  const validateEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())

  const handleEmailBlur = () => {
    if (!form.email) return setEmailState('')
    setEmailState(validateEmail(form.email) ? 'ok' : 'err')
  }
  const handlePassBlur = () => {
    if (!form.password) return setPassState('')
    setPassState(form.password.length >= 8 ? 'ok' : 'err')
  }

  // field className helper
  const fieldCls = state =>
    `alr-field${state === 'ok' ? ' alr-field--ok' : state === 'err' ? ' alr-field--err' : ''}`

  // ── submit — ZERO changes from original ──────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!form.email.trim() || !form.password) {
      setError('Email and password are required.')
      if (!form.email.trim()) setEmailState('err')
      if (!form.password) setPassState('err')
      return
    }

    setLoading(true)
    try {
      // ── 1. Login ──────────────────────────────────────────────────────────
      const res = await fetch(`${API_BASE}/api/v1/auth/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, password: form.password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.message || 'Login failed. Please check your credentials.')
        return
      }

      const payload = data.data || data
      const tokens = payload.tokens || {}
      const accessToken = tokens.access || payload.access || ''
      const refreshToken = tokens.refresh || payload.refresh || ''
      const user = payload.user || {}

      if (!accessToken) {
        setError('Login failed. No token received.')
        return
      }

      localStorage.setItem('access_token', accessToken)
      localStorage.setItem('refresh_token', refreshToken)
      localStorage.setItem('user', JSON.stringify(user))

      const authHead = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      }

      // ── 2. Fetch businesses ───────────────────────────────────────────────
      let resolvedBizId = user.business_id || ''
      let resolvedBizName = ''
      let bizRole = normalizeRole(user.business_role || user.bizRole || user.role || 'staff') || 'staff'

      try {
        const bizRes = await fetch(`${API_BASE}/api/v1/business/my/`, { headers: authHead })
        if (bizRes.ok) {
          const bizData = await bizRes.json()
          const bizList = bizData.data || []
          const list = Array.isArray(bizList) ? bizList : []
          if (list.length > 0) {
            const biz = list[0]
            resolvedBizId = biz.id
            resolvedBizName = biz.name || ''
            localStorage.setItem('business_id', biz.id)
            localStorage.setItem('business_name', biz.name || '')
          }
        }
      } catch { }

      // ── 4. Store resolved user ────────────────────────────────────────────
      const userWithRole = { ...user, bizRole }
      localStorage.setItem('user', JSON.stringify(userWithRole))

      // ── 5. Fetch assigned branches for non-owners ─────────────────────────
      let assignedBranches = null
      const shouldScopeBranches = bizRole === 'manager' || bizRole === 'staff'
      if (shouldScopeBranches && resolvedBizId) {
        try {
          const brRes = await fetch(`${API_BASE}/api/v1/branches/my/`, { headers: authHead })
          if (brRes.ok) {
            const brData = await brRes.json()
            const brList = brData.data || brData.results || brData || []
            assignedBranches = Array.isArray(brList)
              ? brList.filter(b => b.business === resolvedBizId || b.business_id === resolvedBizId)
              : []
          }
        } catch { }
      }

      if (assignedBranches !== null) {
        localStorage.setItem('assigned_branches', JSON.stringify(assignedBranches))
      } else {
        localStorage.removeItem('assigned_branches')
      }

      if (shouldScopeBranches) {
        const allowedIds = new Set((assignedBranches || []).map(b => String(b.id)))
        const selectedBranchId = localStorage.getItem('selected_branch_id')
        if (!assignedBranches || assignedBranches.length === 0) {
          localStorage.removeItem('selected_branch_id')
          localStorage.removeItem('selected_branch_name')
        } else if (assignedBranches.length === 1) {
          localStorage.setItem('selected_branch_id', assignedBranches[0].id)
          localStorage.setItem('selected_branch_name', assignedBranches[0].name)
        } else if (selectedBranchId && !allowedIds.has(String(selectedBranchId))) {
          localStorage.removeItem('selected_branch_id')
          localStorage.removeItem('selected_branch_name')
        }
      }

      // ── 6. Role-based redirect ────────────────────────────────────────────
      if (bizRole === 'staff') {
        navigate('/dashboard/cashbook')
      } else {
        navigate('/dashboard')
      }

    } catch {
      setError('Server error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="aibms-login-root">

      {/* ══ LEFT PANEL ══ */}
      <div className="alr-left">
        <div className="alr-l-bg" />
        <div className="alr-l-grid" />
        <div className="alr-l-aurora" />
        <canvas ref={canvasRef} className="alr-canvas" />
        <div className="alr-l-vig" />

        {/* Floating metric chips */}
        <div className="alr-chips">
          {CHIPS.map((c, i) => (
            <div key={i} className="alr-chip" style={{
              ...c.style,
              animationName: 'alr-chip-rise, alr-chip-bob',
              animationDuration: '.7s, 5.5s',
              animationTimingFunction: 'cubic-bezier(.16,1,.3,1), ease-in-out',
              animationDelay: `${c.style['--cd']}, ${c.style['--cb']}`,
              animationFillMode: 'forwards, none',
              animationIterationCount: '1, infinite',
            }}>
              <div className="alr-chip-ico" style={{ background: c.bg }}>{c.icon}</div>
              <div className="alr-chip-body">
                <span className="alr-chip-lbl">{c.lbl}</span>
                <span className="alr-chip-val" style={{ color: c.color }}>{c.val}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Inject chip keyframes if not already present */}
        <style>{`
          @keyframes alr-chip-rise { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }
          @keyframes alr-chip-bob  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        `}</style>

        <div className="alr-l-inner">
          {/* Logo */}
          <div className="alr-logo">
            <div className="alr-logo-mark">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 2L18 17H2L10 2Z" stroke="white" strokeWidth="1.7" strokeLinejoin="round" />
                <line x1="5.5" y1="12" x2="14.5" y2="12" stroke="white" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            </div>
            <span className="alr-logo-name">AI<span className="alr-logo-grad">BMS</span></span>
          </div>

          {/* Hero */}
          <div className="alr-l-hero">
            <div className="alr-l-eyebrow">
              <div className="alr-ey-dot" />
              AI-Powered Business Platform
            </div>
            <h1 className="alr-l-title">
              Your business,<br />
              <span className="alr-title-grad">intelligently managed.</span>
            </h1>
            <p className="alr-l-sub">
              Welcome back to the platform trusted by 1,200+ modern enterprises.
              Every workflow, insight, and decision — unified in one AI layer.
            </p>
          </div>

          {/* Trust strip */}
          <div className="alr-l-trust">
            <div className="alr-t-badge">
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M5.5 1L7 4H10L7.5 6 8.5 9.5 5.5 7.5 2.5 9.5 3.5 6 1 4H4Z" stroke="currentColor" strokeWidth="1" /></svg>
              SOC2 Certified
            </div>
            <div className="alr-t-sep" />
            <div className="alr-t-badge">
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M5.5 1L9.5 3.5v3.5C9.5 9 7.8 10.2 5.5 11 3.2 10.2 1.5 9 1.5 7V3.5L5.5 1Z" stroke="currentColor" strokeWidth="1" /></svg>
              GDPR Compliant
            </div>
            <div className="alr-t-sep" />
            <div className="alr-t-badge">
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1.5 6a4 4 0 0 1 8 0" stroke="currentColor" strokeWidth="1" strokeLinecap="round" /><line x1="5.5" y1="1" x2="5.5" y2="2.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" /></svg>
              99.98% Uptime
            </div>
          </div>
        </div>
      </div>

      {/* ══ RIGHT PANEL ══ */}
      <div className="alr-right">
        <div className="alr-form-box">
          <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 36, padding: '0 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, fontFamily: 'var(--f-b)', fontSize: '.85rem', fontWeight: 500, color: 'var(--tx-2)', textDecoration: 'none', alignSelf: 'flex-start', marginBottom: 20, width: 'fit-content', transition: 'all 0.2s', cursor: 'pointer' }} onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--tx-1)'; e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.16)' }} onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--tx-2)'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}>
            <ArrowLeft size={16} /> Back to Home
          </Link>

          {/* Header */}
          <div className="alr-form-head">
            <div className="alr-f-eyebrow">
              <div className="alr-ey-dot" />
              Secure Login
            </div>
            <h2 className="alr-f-title">Welcome Back</h2>
            <p className="alr-f-sub">Sign in to your dashboard and pick up where you left off.</p>
          </div>

          <form onSubmit={handleSubmit} noValidate>

            {/* ── Email ── */}
            <div className={fieldCls(emailState)}>
              <div className="alr-field-wrap">
                <input
                  className="alr-fi"
                  type="email"
                  id="alr-email"
                  name="email"
                  placeholder=" "
                  autoComplete="email"
                  value={form.email}
                  onChange={set('email')}
                  onBlur={handleEmailBlur}
                />
                <label className="alr-fl" htmlFor="alr-email">Email address</label>
                <span className="alr-fi-ico ico-ok"><IcoOk /></span>
                <span className="alr-fi-ico ico-err"><IcoErr /></span>
              </div>
              {emailState === 'err' && (
                <div className="alr-f-err"><IcoErrSm /> Please enter a valid email address.</div>
              )}
            </div>

            {/* ── Password ── */}
            <div className={fieldCls(passState)}>
              <div className="alr-field-wrap">
                <input
                  className="alr-fi"
                  type={showPwd ? 'text' : 'password'}
                  id="alr-password"
                  name="password"
                  placeholder=" "
                  autoComplete="current-password"
                  value={form.password}
                  onChange={set('password')}
                  onBlur={handlePassBlur}
                  style={{ paddingRight: 50 }}
                />
                <label className="alr-fl" htmlFor="alr-password">Password</label>
                <button
                  type="button"
                  className="alr-fi-eye"
                  onClick={() => setShowPwd(v => !v)}
                  aria-label="Toggle password visibility"
                >
                  {showPwd ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
              {passState === 'err' && (
                <div className="alr-f-err"><IcoErrSm /> Password is required.</div>
              )}
            </div>

            {/* Forgot password */}
            <div className="alr-forgot-row">
            </div>

            {/* API error */}
            {error && (
              <div className="alr-api-err">
                <IcoErrSm />
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              className="alr-btn-cta"
              disabled={loading}
            >
              <div className="alr-btn-inner">
                {loading
                  ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Signing in…</>
                  : <><span>Sign In to AIBMS</span><ArrowRight size={15} /></>
                }
              </div>
            </button>

            {/* Divider */}
            <div className="alr-divider">
              <div className="alr-div-line" />
              <span className="alr-div-txt">or continue with</span>
              <div className="alr-div-line" />
            </div>

            {/* Social */}
            <div className="alr-socials">
            </div>

          </form>

          {/* Switch to signup */}
          <p className="alr-f-switch">
            Don't have an account?{' '}
            <Link to="/signup" className="alr-f-switch-link">Create one — it's free</Link>
          </p>

        </div>
      </div>
    </div>
  )
}
