import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

const HERO_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>AIBMS — AI Business Management System</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700;12..96,800&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet"/>
<style>
/* ═══════════════════════════════════════════════
   RESET
═══════════════════════════════════════════════ */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { width: 100%; } body { width: 100%; overflow-x: hidden; }
html { scroll-behavior: smooth; }
body {
  font-family: 'DM Sans', sans-serif;
  background: #03040e;
  color: #fff;
  -webkit-font-smoothing: antialiased;
  cursor: auto;
}

/* ═══════════════════════════════════════════════
   CSS VARS
═══════════════════════════════════════════════ */
:root {
  --c0: #4C6EF5;
  --c1: #7C3AED;
  --c2: #9C36B5;
  --c3: #E64980;
  --c4: #15AABF;
  --g:  linear-gradient(135deg, #4C6EF5 0%, #9C36B5 55%, #E64980 100%);
  --g2: linear-gradient(135deg, #15AABF 0%, #4C6EF5 50%, #9C36B5 100%);
}

/* ═══════════════════════════════════════════════
   PAGE TRANSITION OVERLAY
═══════════════════════════════════════════════ */
#page-transition {
  position: fixed; inset: 0; z-index: 99999;
  background: #03040e;
  pointer-events: none;
  opacity: 1;
  transition: opacity .72s cubic-bezier(.4,0,.2,1);
}
#page-transition.out { opacity: 0; }
#page-transition.in  { opacity: 1; }

/* ═══════════════════════════════════════════════
   NOISE LAYER
═══════════════════════════════════════════════ */
#grain {
  position: fixed; inset: 0; z-index: 9990;
  pointer-events: none; opacity: .028;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Cfilter id='f'%3E%3CfeTurbulence baseFrequency='.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23f)'/%3E%3C/svg%3E");
  background-size: 180px;
}

/* ═══════════════════════════════════════════════
   HERO SHELL
═══════════════════════════════════════════════ */
.hero {
  position: relative;
  width: 100vw; height: 100vh;
  overflow: hidden;
  display: flex; flex-direction: column;
}

/* canvas layers */
#bg-canvas, #aurora-canvas, #particle-canvas {
  position: absolute; inset: 0;
  width: 100%; height: 100%;
  pointer-events: none;
}
#bg-canvas     { z-index: 0; }
#aurora-canvas { z-index: 1; opacity: .7; }
#particle-canvas { z-index: 2; }

/* overlay stack */
.overlay-vignette {
  position: absolute; inset: 0; z-index: 3; pointer-events: none;
  background:
    /* heavy bottom for text legibility */
    linear-gradient(to top, rgba(2,3,12,.88) 0%, rgba(2,3,12,.3) 38%, transparent 65%),
    /* left scrim */
    linear-gradient(to right, rgba(2,3,12,.55) 0%, rgba(2,3,12,.1) 52%, transparent 75%),
    /* radial edge darkening */
    radial-gradient(ellipse 110% 100% at 50% 50%, transparent 28%, rgba(0,0,0,.6) 100%);
}
.overlay-grid {
  position: absolute; inset: 0; z-index: 4; pointer-events: none;
  background-image:
    linear-gradient(rgba(255,255,255,.024) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,.024) 1px, transparent 1px);
  background-size: 88px 88px;
  /* fade grid toward edges */
  mask-image: radial-gradient(ellipse 88% 75% at 50% 38%, black 15%, transparent 75%);
}
/* Aurora band — richer, two-tone sweep */
.overlay-aurora {
  position: absolute; top: 0; left: 0; right: 0; height: 340px; z-index: 1; pointer-events: none;
  background:
    radial-gradient(ellipse 70% 200% at 30% -30%, rgba(76,110,245,.18) 0%, transparent 65%),
    radial-gradient(ellipse 60% 180% at 75% -20%, rgba(156,54,181,.16) 0%, transparent 60%);
  animation: aurora-shift 12s ease-in-out infinite alternate;
}
@keyframes aurora-shift {
  0%   { opacity: .8; filter: hue-rotate(0deg); }
  100% { opacity: 1;  filter: hue-rotate(18deg); }
}

/* ═══════════════════════════════════════════════
   NAV
═══════════════════════════════════════════════ */
nav {
  position: relative; z-index: 100; flex-shrink: 0;
  height: 66px;
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 52px;
  background: rgba(3,4,14,.22);
  backdrop-filter: blur(18px) saturate(180%);
  border-bottom: none;
  /* entrance: translate on Y handled via JS class */
  opacity: 0;
  transform: translateY(-16px);
  transition: opacity .7s cubic-bezier(.22,1,.36,1),
              transform .7s cubic-bezier(.22,1,.36,1);
}
/* animated gradient bottom border */
nav::after {
  content: ''; position: absolute;
  bottom: 0; left: 0; right: 0; height: 1px;
  background: linear-gradient(90deg,
    transparent 0%,
    rgba(76,110,245,.35) 20%,
    rgba(156,54,181,.5) 40%,
    rgba(228,73,128,.45) 60%,
    rgba(156,54,181,.35) 80%,
    transparent 100%);
  background-size: 200% 100%;
  animation: nav-border-flow 6s linear infinite;
}
@keyframes nav-border-flow {
  0%   { background-position: 100% 0; }
  100% { background-position: -100% 0; }
}
nav.visible { opacity: 1; transform: translateY(0); }

.nav-logo {
  display: flex; align-items: center; gap: 10px;
  font-family: 'Bricolage Grotesque', sans-serif;
  font-size: 1.05rem; font-weight: 700; letter-spacing: -.025em;
  color: #fff; text-decoration: none;
}
.logo-gem {
  width: 32px; height: 32px; border-radius: 8px;
  background: var(--g);
  display: flex; align-items: center; justify-content: center;
  position: relative; overflow: hidden;
  box-shadow: 0 4px 20px rgba(156,54,181,.45);
  animation: gem-pulse 4s ease-in-out infinite;
}
@keyframes gem-pulse {
  0%,100% { box-shadow: 0 4px 20px rgba(156,54,181,.45); }
  50%     { box-shadow: 0 4px 28px rgba(156,54,181,.7), 0 0 40px rgba(76,110,245,.25); }
}
.logo-gem::after {
  content: ''; position: absolute; inset: 0;
  background: linear-gradient(135deg, rgba(255,255,255,.24) 0%, transparent 55%);
}
.logo-gem svg { position: relative; z-index: 1; }

/* mode pill */
.nav-mode {
  display: flex; align-items: center;
  background: rgba(255,255,255,.055);
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 100px; padding: 4px;
  backdrop-filter: blur(10px);
  /* sliding indicator */
  position: relative;
}
.nav-mode-bg {
  position: absolute;
  height: calc(100% - 8px); top: 4px; left: 4px;
  border-radius: 100px;
  background: var(--g);
  box-shadow: 0 2px 14px rgba(156,54,181,.5);
  will-change: transform, width;
  /* move via JS transform — no left/width transitions needed because we use transform */
  transition: transform .38s cubic-bezier(.34,1.56,.64,1),
              width .38s cubic-bezier(.34,1.56,.64,1);
}
.nav-pill {
  position: relative; z-index: 1;
  padding: 7px 22px; border-radius: 100px;
  font-size: .82rem; font-weight: 600;
  color: rgba(255,255,255,.5); cursor: none;
  user-select: none;
  transition: color .3s;
}
.nav-pill.active { color: #fff; }

.nav-links {
  display: flex; gap: 32px; list-style: none;
  position: absolute; left: 50%;
  transform: translateX(-50%) translateX(70px);
}
.nav-links a {
  font-size: .84rem; font-weight: 400;
  color: rgba(255,255,255,.52); text-decoration: none;
  transition: color .22s;
}
.nav-links a:hover { color: #fff; }

.nav-r { display: flex; align-items: center; gap: 14px; }
.nav-si {
  font-size: .84rem; color: rgba(255,255,255,.52);
  text-decoration: none; font-weight: 500; transition: color .22s;
}
.nav-si:hover { color: #fff; }
.nav-cta {
  position: relative; overflow: hidden;
  font-size: .84rem; font-weight: 700;
  font-family: 'DM Sans', sans-serif;
  background: var(--g); color: #fff;
  border: none; cursor: none;
  padding: 9px 22px; border-radius: 100px;
  text-decoration: none;
  box-shadow: 0 4px 22px rgba(156,54,181,.35);
  transition: box-shadow .3s cubic-bezier(.22,1,.36,1);
  will-change: transform;
}
.nav-cta::before {
  content: ''; position: absolute; inset: 0;
  background: linear-gradient(135deg, rgba(255,255,255,.18) 0%, transparent 55%);
}

/* ═══════════════════════════════════════════════
   HERO BODY
═══════════════════════════════════════════════ */
.hero-body {
  flex: 1; position: relative; z-index: 10;
  display: flex; align-items: flex-end;
  padding: 0 60px 68px;
}
.hero-text { max-width: 660px; }

/* ─ Headline ─
   Each word sits in an overflow:hidden line-box
   so the clip reveal is clean, not full-page
*/
.h1-line { overflow: hidden; line-height: 1.08; }
.h1-word {
  display: inline-block;
  opacity: 0;
  transform: translateY(100%);
  will-change: transform, opacity;
  transition: opacity .72s cubic-bezier(.22,1,.36,1),
              transform .72s cubic-bezier(.22,1,.36,1);
}
.h1-word.revealed {
  opacity: 1;
  transform: translateY(0);
}
.hero-h1 {
  font-family: 'Bricolage Grotesque', sans-serif;
  font-size: clamp(3rem, 5.6vw, 5.4rem);
  font-weight: 800; letter-spacing: -.045em; color: #fff;
  margin-bottom: 26px;
}
/* gradient word — hue gently drifts */
.h1-grad {
  background: var(--g);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: hue-drift 8s ease-in-out infinite;
  /* glow bloom behind the gradient text */
  filter: drop-shadow(0 0 28px rgba(156,54,181,.45)) drop-shadow(0 0 60px rgba(76,110,245,.25));
}
@keyframes hue-drift {
  0%,100% { filter: drop-shadow(0 0 24px rgba(156,54,181,.4)) drop-shadow(0 0 48px rgba(76,110,245,.2)) hue-rotate(0deg) brightness(1); }
  40%     { filter: drop-shadow(0 0 36px rgba(228,73,128,.55)) drop-shadow(0 0 70px rgba(156,54,181,.3)) hue-rotate(22deg) brightness(1.08); }
  75%     { filter: drop-shadow(0 0 28px rgba(76,110,245,.45)) drop-shadow(0 0 52px rgba(21,170,191,.25)) hue-rotate(-10deg) brightness(1.04); }
}

/* Hero badge */
.hero-badge {
  display: inline-flex; align-items: center; gap: 9px;
  margin-bottom: 28px;
  padding: 7px 18px 7px 10px;
  border-radius: 100px;
  font-size: .76rem; font-weight: 600;
  color: rgba(255,255,255,.68); letter-spacing: .02em;
  opacity: 0; transform: translateY(14px);
  transition: opacity .72s cubic-bezier(.22,1,.36,1),
              transform .72s cubic-bezier(.22,1,.36,1);
  /* animated gradient border via background-clip trick */
  background:
    linear-gradient(rgba(6,4,20,.85), rgba(6,4,20,.85)) padding-box,
    linear-gradient(90deg, #4C6EF5, #9C36B5, #E64980, #9C36B5, #4C6EF5) border-box;
  border: 1px solid transparent;
  background-size: 200% 100%, 300% 100%;
  animation: badge-border 4s linear infinite;
}
.hero-badge.revealed { opacity: 1; transform: translateY(0); }
@keyframes badge-border {
  0%   { background-position: 0 0, 0% 0; }
  100% { background-position: 0 0, 300% 0; }
}
.badge-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--c4);
  box-shadow: 0 0 6px var(--c4), 0 0 12px rgba(21,170,191,.5);
  animation: badge-dot-pulse 2.2s ease-in-out infinite;
  flex-shrink: 0;
}
@keyframes badge-dot-pulse {
  0%,100% { transform: scale(1); box-shadow: 0 0 5px var(--c4), 0 0 10px rgba(21,170,191,.45); }
  50%     { transform: scale(1.25); box-shadow: 0 0 10px var(--c4), 0 0 22px rgba(21,170,191,.7); }
}

/* ─ Subheading ─ */
.hero-sub {
  font-size: 1.07rem; font-weight: 300;
  color: rgba(255,255,255,.58);
  line-height: 1.72; max-width: 490px;
  margin-bottom: 40px;
  opacity: 0; transform: translateY(18px);
  transition: opacity .72s cubic-bezier(.22,1,.36,1),
              transform .72s cubic-bezier(.22,1,.36,1);
  will-change: transform, opacity;
}
.hero-sub.revealed { opacity: 1; transform: translateY(0); }

/* ─ CTAs ─ */
.hero-ctas {
  display: flex; align-items: center; gap: 14px;
  opacity: 0; transform: translateY(18px);
  transition: opacity .72s cubic-bezier(.22,1,.36,1),
              transform .72s cubic-bezier(.22,1,.36,1);
  will-change: transform, opacity;
}
.hero-ctas.revealed { opacity: 1; transform: translateY(0); }

/* Primary CTA */
.cta-p {
  position: relative; overflow: hidden;
  display: inline-flex; align-items: center; gap: 10px;
  font-family: 'Bricolage Grotesque', sans-serif;
  font-size: 1rem; font-weight: 700; letter-spacing: -.01em;
  color: #fff; text-decoration: none; cursor: none;
  padding: 16px 30px; border-radius: 100px;
  background: var(--g);
  /* layered shadow for depth */
  box-shadow:
    0 0 0 1px rgba(255,255,255,.1),
    0 8px 28px rgba(156,54,181,.38),
    0 2px 6px rgba(0,0,0,.3),
    inset 0 1px 0 rgba(255,255,255,.18);
  will-change: transform;
  /* transform via JS spring — no CSS transition on transform */
  transition: box-shadow .35s cubic-bezier(.22,1,.36,1);
}
/* sheen layer */
.cta-p::before {
  content: ''; position: absolute; inset: 0;
  background: linear-gradient(135deg, rgba(255,255,255,.22) 0%, transparent 55%);
  pointer-events: none;
}
/* shimmer sweep */
.cta-p::after {
  content: ''; position: absolute;
  top: 0; left: -110%; width: 70%; height: 100%;
  background: linear-gradient(90deg,
    transparent 0%, rgba(255,255,255,.16) 50%, transparent 100%);
  transform: skewX(-20deg);
  animation: sweep 4s ease-in-out infinite 2.2s;
}
@keyframes sweep {
  0%,100% { left: -110%; opacity: 1; }
  50%     { left: 130%;  opacity: 1; }
  50.01%  { opacity: 0;  }
  100%    { opacity: 0;  }
}
/* glow ring — opacity via class, size via transition */
.cta-ring {
  position: absolute; inset: -4px; border-radius: 100px;
  border: 1.5px solid rgba(228,73,128,.0);
  opacity: 0;
  transition: opacity .3s, border-color .3s, inset .3s;
  pointer-events: none;
}
.cta-p:hover .cta-ring {
  opacity: 1; inset: -5px;
  border-color: rgba(228,73,128,.65);
}
.cta-p:hover {
  box-shadow:
    0 0 0 1px rgba(255,255,255,.14),
    0 18px 50px rgba(156,54,181,.62),
    0 4px 10px rgba(0,0,0,.35),
    inset 0 1px 0 rgba(255,255,255,.22);
}

/* arrow pip */
.cta-arrow {
  display: flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; border-radius: 50%;
  background: rgba(255,255,255,.18);
  flex-shrink: 0;
  /* arrow moves via JS spring — no transition here */
}

/* Secondary CTA */
.cta-s {
  display: inline-flex; align-items: center; gap: 9px;
  font-size: .92rem; font-weight: 500;
  color: rgba(255,255,255,.68);
  background: rgba(255,255,255,.055);
  border: 1px solid rgba(255,255,255,.12);
  border-radius: 100px; padding: 15px 28px;
  text-decoration: none; cursor: none;
  backdrop-filter: blur(12px);
  /* transform via JS spring */
  transition: color .3s, border-color .3s, background .3s, box-shadow .3s;
}
.cta-s:hover {
  color: #fff;
  border-color: rgba(156,54,181,.45);
  background: rgba(156,54,181,.1);
  box-shadow: 0 0 28px rgba(156,54,181,.14);
}
.play-circle {
  width: 22px; height: 22px; border-radius: 50%;
  border: 1px solid rgba(255,255,255,.25);
  display: flex; align-items: center; justify-content: center;
  transition: border-color .3s, background .3s;
}
.cta-s:hover .play-circle {
  border-color: rgba(156,54,181,.7);
  background: rgba(156,54,181,.18);
}

/* ─ Social proof ─ */
.sp {
  display: flex; align-items: center; gap: 14px;
  margin-top: 30px;
  opacity: 0; transform: translateY(14px);
  transition: opacity .72s cubic-bezier(.22,1,.36,1),
              transform .72s cubic-bezier(.22,1,.36,1);
}
.sp.revealed { opacity: 1; transform: translateY(0); }
.sp-avs { display: flex; }
.sp-av {
  width: 28px; height: 28px; border-radius: 50%;
  border: 2px solid rgba(3,4,14,.8);
  margin-left: -8px; font-size: .52rem; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  font-family: 'Bricolage Grotesque', sans-serif;
}
.sp-av:first-child { margin-left: 0; }
.sp-div { width: 1px; height: 26px; background: rgba(255,255,255,.1); }
.sp-txt { font-size: .77rem; color: rgba(255,255,255,.42); line-height: 1.45; }
.sp-txt strong { color: rgba(255,255,255,.72); font-weight: 600; }
.sp-stars { color: #F59E0B; font-size: .7rem; letter-spacing: 1.5px; margin-bottom: 1px; }

/* ═══════════════════════════════════════════════
   FLOATING CARDS
   — position / float via JS spring physics
   — CSS only handles visual appearance
═══════════════════════════════════════════════ */
.f-cards-layer {
  position: absolute;
  right: 52px; top: 80px; bottom: 60px;
  width: 420px; z-index: 10;
  pointer-events: none; /* individual cards re-enable via JS */
}

/* Base card style */
.fc {
  position: absolute;
  background: rgba(6, 4, 20, .68);
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 18px;
  padding: 18px 20px;
  backdrop-filter: blur(20px) saturate(160%);
  box-shadow:
    0 0 0 1px rgba(255,255,255,.04),
    0 28px 60px rgba(0,0,0,.52),
    inset 0 1px 0 rgba(255,255,255,.06);
  overflow: hidden;
  opacity: 0;
  will-change: transform, opacity;
  pointer-events: auto;
  transition: opacity .6s cubic-bezier(.22,1,.36,1),
              border-color .4s cubic-bezier(.22,1,.36,1),
              box-shadow .4s cubic-bezier(.22,1,.36,1);
}
.fc.visible { opacity: 1; }
/* inner specular highlight — top-left corner catch light */
.fc::after {
  content: ''; position: absolute;
  top: 0; left: 0;
  width: 55%; height: 40%;
  background: radial-gradient(ellipse at 20% 20%, rgba(255,255,255,.05) 0%, transparent 70%);
  pointer-events: none; border-radius: 18px 0 0 0;
}
/* top accent line per card */
.fc::before {
  content: ''; position: absolute;
  top: 0; left: 0; right: 0; height: 1.5px;
  border-radius: 18px 18px 0 0;
  z-index: 1;
}
.fc-a { top: 4%;  right: 8px;  width: 232px; }
.fc-b { top: 36%; right: 208px; width: 208px; }
.fc-c { bottom: 10%; right: 32px; width: 256px; }
.fc-d { top: 60%; right: 224px; width: 178px; }

.fc-a::before { background: linear-gradient(90deg, transparent, #4C6EF5 40%, #7C3AED, transparent); }
.fc-b::before { background: linear-gradient(90deg, transparent, #9C36B5 40%, #E64980, transparent); }
.fc-c::before { background: linear-gradient(90deg, transparent, #E64980 40%, #9C36B5, transparent); }
.fc-d::before { background: linear-gradient(90deg, transparent, #15AABF 40%, #4C6EF5, transparent); }

/* ─ Card internals ─ */
.fc-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.fc-lbl { font-size: .6rem; font-weight: 600; text-transform: uppercase; letter-spacing: .09em; color: rgba(255,255,255,.35); }
.live-badge {
  display: flex; align-items: center; gap: 4px;
  font-size: .59rem; font-weight: 700; color: #34D399;
  background: rgba(52,211,153,.09);
  border: 1px solid rgba(52,211,153,.2);
  border-radius: 100px; padding: 2px 8px;
}
.live-dot {
  width: 5px; height: 5px; border-radius: 50%;
  background: #34D399;
  animation: live-pulse 2.4s ease-in-out infinite;
}
@keyframes live-pulse {
  0%,100% { opacity:1; box-shadow: 0 0 0 0 rgba(52,211,153,.6); }
  50%     { opacity:.5; box-shadow: 0 0 0 4px rgba(52,211,153,0); }
}
.fc-val {
  font-family: 'Bricolage Grotesque', sans-serif;
  font-size: 1.55rem; font-weight: 800;
  letter-spacing: -.04em; color: #fff; line-height: 1;
  margin-bottom: 3px;
}
.fc-caption { font-size: .67rem; color: rgba(255,255,255,.38); }
.delta {
  display: inline-flex; align-items: center; gap: 3px;
  font-size: .67rem; font-weight: 700;
  padding: 2px 8px; border-radius: 100px; margin-top: 7px;
}
.delta-up { background: rgba(52,211,153,.09); color: #34D399; border: 1px solid rgba(52,211,153,.18); }
.delta-dn { background: rgba(248,113,113,.08); color: #F87171; border: 1px solid rgba(248,113,113,.16); }

/* Mini bar chart */
.bars-wrap { display: flex; align-items: flex-end; gap: 4px; height: 46px; margin-top: 13px; }
.bar {
  flex: 1; border-radius: 3px 3px 0 0;
  background: var(--g);
  transition: opacity .25s, box-shadow .25s;
  opacity: .6;
}
.bars-wrap:hover .bar { opacity: .3; }
.bar:hover { opacity: 1 !important; box-shadow: 0 0 10px rgba(156,54,181,.55); }

/* Pipeline rows */
.pr {
  display: flex; justify-content: space-between; align-items: center;
  padding: 7px 9px;
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.06);
  border-radius: 7px; margin-bottom: 6px;
  transition: border-color .25s cubic-bezier(.22,1,.36,1),
              transform .25s cubic-bezier(.22,1,.36,1);
}
.pr:last-child { margin-bottom: 0; }
.pr:hover { border-color: rgba(156,54,181,.32); transform: translateX(3px); }
.pr-name { font-size: .74rem; font-weight: 600; color: #fff; }
.pr-sub  { font-size: .64rem; color: rgba(255,255,255,.38); margin-top: 1px; }
.badge {
  font-size: .6rem; font-weight: 700;
  padding: 2px 8px; border-radius: 100px;
}
.b-pu { background: rgba(156,54,181,.14); color: #C084FC; border: 1px solid rgba(156,54,181,.24); }
.b-gr { background: rgba(52,211,153,.1);  color: #34D399;  border: 1px solid rgba(52,211,153,.2); }
.b-ye { background: rgba(251,191,36,.09); color: #FBB824;  border: 1px solid rgba(251,191,36,.18); }

/* AI insight pills */
.ai-pill {
  display: flex; align-items: flex-start; gap: 8px;
  background: rgba(76,110,245,.09);
  border: 1px solid rgba(76,110,245,.2);
  border-radius: 9px; padding: 9px 11px; margin-bottom: 7px;
}
.ai-pill.green {
  background: rgba(52,211,153,.07);
  border-color: rgba(52,211,153,.18);
}
.ai-pill-icon { font-size: .88rem; line-height: 1.4; }
.ai-pill-text { font-size: .69rem; color: rgba(255,255,255,.6); line-height: 1.45; }
.ai-pill-text strong { font-weight: 600; color: #93C5FD; }
.ai-pill.green .ai-pill-text strong { color: #6EE7B7; }

/* Progress bar */
.pbar-row { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; margin-bottom: 5px; }
.pbar-lbl { font-size: .6rem; color: rgba(255,255,255,.36); }
.pbar-val { font-size: .68rem; font-weight: 700; color: #34D399; }
.pbar { width: 100%; height: 3px; background: rgba(255,255,255,.08); border-radius: 2px; overflow: hidden; }
.pbar-fill {
  height: 100%; border-radius: 2px;
  background: linear-gradient(90deg, var(--c4), var(--c0));
  box-shadow: 0 0 7px rgba(21,170,191,.45);
  animation: pbar-grow 1.6s cubic-bezier(.22,1,.36,1) 1.6s both;
}
@keyframes pbar-grow { from { width: 0; } }

/* Sparkline */
.spark { margin-top: 12px; width: 100%; display: block; }

/* ═══════════════════════════════════════════════
   CARD E — wide donut/ring stat card
═══════════════════════════════════════════════ */
.fc-e { top: 20%; right: 108px; width: 200px; }
.fc-e::before { background: linear-gradient(90deg, transparent, #34D399 40%, #15AABF, transparent); }

.donut-wrap {
  display: flex; align-items: center; gap: 14px;
  margin-top: 10px;
}
.donut-svg { flex-shrink: 0; }
.donut-track { fill: none; stroke: rgba(255,255,255,.07); stroke-width: 5; }
.donut-fill  {
  fill: none; stroke-width: 5; stroke-linecap: round;
  stroke: url(#dg);
  stroke-dasharray: 88 200;
  stroke-dashoffset: 22;
  animation: donut-spin 2s cubic-bezier(.22,1,.36,1) 1.4s both;
  transform-origin: center; transform: rotate(-90deg);
}
@keyframes donut-spin {
  from { stroke-dasharray: 0 200; }
  to   { stroke-dasharray: 88 200; }
}
.donut-label { text-align: left; }
.donut-pct {
  font-family: 'Bricolage Grotesque', sans-serif;
  font-size: 1.4rem; font-weight: 800;
  letter-spacing: -.04em; color: #34D399; line-height: 1;
}
.donut-sub { font-size: .62rem; color: rgba(255,255,255,.36); margin-top: 2px; }

/* ═══════════════════════════════════════════════
   LIVE TICKER STRIP — bottom-left under social proof
═══════════════════════════════════════════════ */
.ticker-wrap {
  margin-top: 24px;
  overflow: hidden;
  width: 490px; max-width: 100%;
  mask-image: linear-gradient(90deg, transparent, black 8%, black 92%, transparent);
  opacity: 0; transform: translateY(10px);
  transition: opacity .72s cubic-bezier(.22,1,.36,1),
              transform .72s cubic-bezier(.22,1,.36,1);
}
.ticker-wrap.revealed { opacity: 1; transform: translateY(0); }
.ticker-track {
  display: flex; gap: 0; width: max-content;
  animation: ticker-scroll 22s linear infinite;
}
.ticker-track:hover { animation-play-state: paused; }
@keyframes ticker-scroll {
  0%   { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
.ticker-item {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 18px; white-space: nowrap;
  border-right: 1px solid rgba(255,255,255,.07);
  font-size: .72rem; color: rgba(255,255,255,.38);
}
.ticker-item .ti-dot {
  width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0;
}
.ticker-item .ti-val { color: rgba(255,255,255,.68); font-weight: 600; }

/* ═══════════════════════════════════════════════
   HORIZON GLOW LINE — bottom edge atmosphere
═══════════════════════════════════════════════ */
.horizon-glow {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 120px; z-index: 5; pointer-events: none;
  /* the bright line itself */
  background:
    linear-gradient(to top,
      rgba(2,3,12,0) 0%,
      rgba(2,3,12,0) 50%,
      rgba(2,3,12,0) 100%);
}
.horizon-glow::before {
  content: ''; position: absolute;
  bottom: 0; left: 8%; right: 8%; height: 1.5px;
  background: linear-gradient(90deg,
    transparent 0%,
    rgba(76,110,245,.4) 18%,
    rgba(156,54,181,.65) 38%,
    rgba(228,73,128,.6) 52%,
    rgba(156,54,181,.5) 68%,
    rgba(76,110,245,.35) 82%,
    transparent 100%);
  filter: blur(.5px);
  animation: horizon-breathe 6s ease-in-out infinite;
}
.horizon-glow::after {
  content: ''; position: absolute;
  bottom: 0; left: 0; right: 0; height: 100px;
  background: radial-gradient(ellipse 60% 100% at 50% 100%,
    rgba(100,40,200,.14) 0%, transparent 70%);
  animation: horizon-breathe 6s ease-in-out infinite;
}
@keyframes horizon-breathe {
  0%,100% { opacity: .7; }
  50%     { opacity: 1; }
}

/* ═══════════════════════════════════════════════
   COUNT-UP NUMBERS in cards
═══════════════════════════════════════════════ */
.count-up { display: inline; }

/* ═══════════════════════════════════════════════
   MAGNETIC ZONE (CTA area glow background)
═══════════════════════════════════════════════ */
.cta-magnetic-zone {
  position: relative; display: inline-block;
}
/* soft glow halo that follows the button */
.cta-magnetic-zone::after {
  content: ''; position: absolute;
  inset: -20px; border-radius: 100px;
  background: radial-gradient(ellipse, rgba(156,54,181,.15) 0%, transparent 70%);
  pointer-events: none; opacity: 0;
  transition: opacity .4s;
}
.cta-magnetic-zone:hover::after { opacity: 1; }

/* ═══════════════════════════════════════════════
   SCROLL INDICATOR
═══════════════════════════════════════════════ */
.scroll-cue {
  position: absolute; bottom: 28px; left: 50%;
  transform: translateX(-50%);
  z-index: 20;
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  opacity: 0;
  transition: opacity .6s cubic-bezier(.22,1,.36,1);
}
.scroll-cue.visible { opacity: 1; }
.sc-mouse {
  width: 20px; height: 32px;
  border: 1.5px solid rgba(255,255,255,.2); border-radius: 100px;
  display: flex; justify-content: center;
}
.sc-dot {
  width: 3px; height: 6px; border-radius: 100px;
  background: rgba(255,255,255,.5);
  margin-top: 5px;
  animation: sc-drop 2.6s cubic-bezier(.455,.03,.515,.955) infinite;
}
@keyframes sc-drop {
  0%   { opacity:1; transform: translateY(0); }
  60%  { opacity:0; transform: translateY(12px); }
  61%  { opacity:0; transform: translateY(0); }
  100% { opacity:0; }
}
.sc-chevs { display: flex; flex-direction: column; gap: 3px; align-items: center; }
.sc-ch {
  width: 8px; height: 8px;
  border-right: 1.5px solid rgba(255,255,255,.3);
  border-bottom: 1.5px solid rgba(255,255,255,.3);
  transform: rotate(45deg);
}
.sc-ch:nth-child(1) { animation: sc-blink 2.6s ease-in-out infinite 0s; }
.sc-ch:nth-child(2) { animation: sc-blink 2.6s ease-in-out infinite .18s; opacity: .55; }
.sc-ch:nth-child(3) { animation: sc-blink 2.6s ease-in-out infinite .36s; opacity: .28; }
@keyframes sc-blink { 0%,100%{opacity:inherit}45%{opacity:.1} }
.sc-lbl { font-size: .59rem; color: rgba(255,255,255,.25); text-transform: uppercase; letter-spacing: .12em; }
</style>

<style>
/* ── CENTER LIVE PANEL ── */
.hero-center-panel {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-52%, -50%);
  width: 260px;
  z-index: 8;
  display: flex;
  flex-direction: column;
  gap: 10px;
  opacity: 0;
  transition: opacity 1s cubic-bezier(.22,1,.36,1);
  pointer-events: none;
}
.hero-center-panel.visible { opacity: 1; }

/* AI query terminal */
.hcp-terminal {
  background: rgba(6,4,20,.78);
  border: 1px solid rgba(76,110,245,.28);
  border-radius: 14px;
  padding: 14px 16px;
  backdrop-filter: blur(18px);
  box-shadow: 0 0 0 1px rgba(76,110,245,.1), 0 20px 48px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.06);
}
.hcp-term-bar {
  display: flex; align-items: center; gap: 6px;
  margin-bottom: 10px;
}
.hcp-dot { width: 7px; height: 7px; border-radius: 50%; }
.hcp-dot-r { background: #ff5f57; }
.hcp-dot-y { background: #febc2e; }
.hcp-dot-g { background: #28c840; }
.hcp-term-title {
  font-family: 'DM Mono', monospace;
  font-size: .58rem; color: rgba(255,255,255,.28);
  letter-spacing: .06em; flex: 1; text-align: center;
}
.hcp-query {
  font-family: 'DM Mono', monospace;
  font-size: .68rem; color: rgba(255,255,255,.55);
  line-height: 1.5; min-height: 18px;
}
.hcp-query .hcp-prompt { color: #4C6EF5; margin-right: 6px; }
.hcp-cursor {
  display: inline-block; width: 7px; height: 12px;
  background: #4C6EF5; border-radius: 1px;
  vertical-align: middle; margin-left: 1px;
  animation: hcp-blink .9s steps(1) infinite;
}
@keyframes hcp-blink { 0%,49%{opacity:1} 50%,100%{opacity:0} }

.hcp-response {
  font-family: 'DM Sans', sans-serif;
  font-size: .7rem; color: rgba(255,255,255,.72);
  line-height: 1.55; margin-top: 8px;
  min-height: 0; overflow: hidden;
}
.hcp-response .hcp-hi { color: #34D399; font-weight: 600; }
.hcp-response .hcp-hi2 { color: #93c5fd; font-weight: 600; }

/* Live metrics row */
.hcp-metrics {
  display: flex; gap: 8px;
}
.hcp-metric {
  flex: 1;
  background: rgba(6,4,20,.72);
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 10px;
  padding: 10px 12px;
  backdrop-filter: blur(14px);
  box-shadow: 0 8px 28px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.05);
  position: relative; overflow: hidden;
}
.hcp-metric-label {
  font-family: 'DM Mono', monospace;
  font-size: .52rem; color: rgba(255,255,255,.3);
  text-transform: uppercase; letter-spacing: .08em;
  margin-bottom: 5px;
}
.hcp-metric-val {
  font-family: 'Bricolage Grotesque', sans-serif;
  font-size: 1.12rem; font-weight: 800;
  letter-spacing: -.03em; line-height: 1;
}
.hcp-metric-sub {
  font-size: .55rem; color: rgba(255,255,255,.3);
  margin-top: 3px;
}
.hcp-metric-bar {
  position: absolute; bottom: 0; left: 0; right: 0;
  height: 2px; border-radius: 0 0 10px 10px;
}

/* Live status feed */
.hcp-feed {
  background: rgba(6,4,20,.72);
  border: 1px solid rgba(255,255,255,.07);
  border-radius: 12px;
  padding: 12px 14px;
  backdrop-filter: blur(14px);
  box-shadow: 0 8px 28px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.05);
  overflow: hidden;
}
.hcp-feed-row {
  display: flex; align-items: center; gap: 8px;
  padding: 5px 0;
  border-bottom: 1px solid rgba(255,255,255,.04);
  opacity: 0; transform: translateY(6px);
  transition: opacity .5s ease, transform .5s ease;
}
.hcp-feed-row:last-child { border-bottom: none; }
.hcp-feed-row.show { opacity: 1; transform: none; }
.hcp-feed-dot {
  width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;
}
.hcp-feed-dot.pulse {
  animation: hcp-pulse 2s ease-in-out infinite;
}
@keyframes hcp-pulse {
  0%,100% { box-shadow: 0 0 0 0 currentColor; opacity: 1; }
  50%      { box-shadow: 0 0 0 4px transparent; opacity: .7; }
}
.hcp-feed-text {
  font-family: 'DM Sans', sans-serif;
  font-size: .64rem; color: rgba(255,255,255,.5);
  flex: 1; line-height: 1.3;
}
.hcp-feed-text strong { color: rgba(255,255,255,.82); font-weight: 600; }
.hcp-feed-time {
  font-family: 'DM Mono', monospace;
  font-size: .52rem; color: rgba(255,255,255,.2);
  flex-shrink: 0;
}
</style>

</head>
<body>
<div id="page-transition"></div>
<div id="grain"></div>

<section class="hero" id="hero">
  <canvas id="hero-particles" style="position:absolute;inset:0;width:100%;height:100%;z-index:1;pointer-events:none;"></canvas>
  <canvas id="bg-canvas"></canvas>
  <canvas id="aurora-canvas"></canvas>
  <canvas id="particle-canvas"></canvas>
  <div class="overlay-aurora"></div>
  <div class="overlay-vignette"></div>
  <div class="overlay-grid"></div>

  <!-- ─── NAV ─── -->
  <nav id="nav">
    <a href="#" class="nav-logo">
      <div class="logo-gem">
        <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
          <path d="M9 2L3 5.5v7L9 16l6-3.5v-7L9 2z" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
          <path d="M9 2v14M3 5.5l6 3.5 6-3.5" stroke="white" stroke-width="1.2"/>
        </svg>
      </div>
      AIBMS
    </a>

    <ul class="nav-links">
      <li><a href="#" data-scroll="features">Product Features</a></li>
      <li><a href="#" data-scroll="contact">Contact Us</a></li>
    </ul>

    <div class="nav-r">
      <a href="#" class="nav-si">Sign in</a>
      <a href="#" class="nav-cta">Get started</a>
    </div>
  </nav>

  <!-- ─── FLOATING CARDS ─── -->
  <div class="f-cards-layer" aria-hidden="true">

    <!-- Card A: Revenue -->
    <div class="fc fc-a" id="fc-a">
      <div class="fc-head">
        <span class="fc-lbl">Total Revenue</span>
        <span class="live-badge"><span class="live-dot"></span>Live</span>
      </div>
      <div class="fc-val">$2.41M</div>
      <div class="fc-caption">All channels · this quarter</div>
      <span class="delta delta-up">↑ 18.3% vs last month</span>
      <div class="bars-wrap">
        <div class="bar" style="height:42%"></div>
        <div class="bar" style="height:57%"></div>
        <div class="bar" style="height:48%"></div>
        <div class="bar" style="height:72%"></div>
        <div class="bar" style="height:63%"></div>
        <div class="bar" style="height:88%"></div>
        <div class="bar" style="height:100%"></div>
      </div>
    </div>

    <!-- Card B: Pipeline -->
    <div class="fc fc-b" id="fc-b">
      <div class="fc-head">
        <span class="fc-lbl">Pipeline</span>
        <span style="font-size:.59rem;color:rgba(255,255,255,.32)">5 active</span>
      </div>
      <div class="pr">
        <div><div class="pr-name">Business</div><div class="pr-sub">$48K · 94%</div></div>
        <span class="badge b-pu">Proposal</span>
      </div>
      <div class="pr">
        <div><div class="pr-name">Nexus AI</div><div class="pr-sub">$91K · 88%</div></div>
        <span class="badge b-ye">Negot.</span>
      </div>
      <div class="pr" style="margin-bottom:0">
        <div><div class="pr-name">StarkMed</div><div class="pr-sub">$15K</div></div>
        <span class="badge b-gr">Won ✓</span>
      </div>
    </div>

    <!-- Card C: AI Insights -->
    <div class="fc fc-c" id="fc-c">
      <div class="fc-head">
        <span class="fc-lbl">AI Insights</span>
        <span class="live-badge"><span class="live-dot"></span>Active</span>
      </div>
      <div class="ai-pill">
        <div class="ai-pill-icon">⚠️</div>
        <div class="ai-pill-text"><strong>Risk:</strong> APAC pipeline slowing — re-engage Horizon Labs today.</div>
      </div>
      <div class="ai-pill green">
        <div class="ai-pill-icon">✅</div>
        <div class="ai-pill-text"><strong>EU expansion approved</strong> — AI confidence 96.4%</div>
      </div>
      <div class="pbar-row">
        <span class="pbar-lbl">System uptime</span>
        <span class="pbar-val">99.97%</span>
      </div>
      <div class="pbar"><div class="pbar-fill" style="width:99.97%"></div></div>
    </div>

    <!-- Card D: Automation -->
    <div class="fc fc-d" id="fc-d">
      <div class="fc-head">
        <span class="fc-lbl">Automated</span>
        <span class="live-badge"><span class="live-dot"></span>Live</span>
      </div>
      <div class="fc-val" style="font-size:1.35rem">98,402</div>
      <div class="fc-caption">AI tasks today</div>
      <span class="delta delta-up">↑ 32% this week</span>
      <svg class="spark" viewBox="0 0 160 36" fill="none" preserveAspectRatio="none">
        <defs>
          <linearGradient id="sl" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#4C6EF5"/><stop offset="100%" stop-color="#E64980"/>
          </linearGradient>
          <linearGradient id="sf" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#9C36B5" stop-opacity=".28"/>
            <stop offset="100%" stop-color="#9C36B5" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <path d="M0,30 C22,28 34,20 54,18 C74,16 82,23 104,14 C124,5 138,8 160,2 L160,36 L0,36Z" fill="url(#sf)"/>
        <path d="M0,30 C22,28 34,20 54,18 C74,16 82,23 104,14 C124,5 138,8 160,2" stroke="url(#sl)" stroke-width="1.8" stroke-linecap="round"/>
        <circle cx="160" cy="2" r="3" fill="#E64980"/>
        <circle cx="160" cy="2" r="7" fill="none" stroke="rgba(230,73,128,.3)" stroke-width="1.2"/>
      </svg>
    </div>
    <!-- Card E: Total Rate donut -->
    <div class="fc fc-e" id="fc-e">
      <div class="fc-head">
        <span class="fc-lbl">Total Rate</span>
        <span class="delta delta-up" style="margin-top:0">↓ 0.4%</span>
      </div>
      <div class="donut-wrap">
        <svg class="donut-svg" width="52" height="52" viewBox="0 0 36 36">
          <defs>
            <linearGradient id="dg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#34D399"/>
              <stop offset="100%" stop-color="#15AABF"/>
            </linearGradient>
          </defs>
          <circle class="donut-track" cx="18" cy="18" r="14"/>
          <circle class="donut-fill"  cx="18" cy="18" r="14"/>
        </svg>
        <div class="donut-label">
          <div class="donut-pct">1.2%</div>
          <div class="donut-sub">Retention 98.8%</div>
        </div>
      </div>
      <div class="pbar-row" style="margin-top:12px">
        <span class="pbar-lbl">AI intervention rate</span>
        <span class="pbar-val" style="color:#A78BFA">62%</span>
      </div>
      <div class="pbar">
        <div class="pbar-fill" style="width:62%;background:linear-gradient(90deg,#7C3AED,#9C36B5);box-shadow:0 0 7px rgba(124,58,237,.5)"></div>
      </div>
    </div>
  </div>

  <!-- HORIZON GLOW -->
  <div class="horizon-glow"></div>
  <div class="hero-body">
    <div class="hero-text">

      

      <h1 class="hero-h1">
        <div class="h1-line">
          <span class="h1-word" data-delay="80">Run&nbsp;Your&nbsp;</span><span class="h1-word" data-delay="160">Business</span>
        </div>
        <div class="h1-line">
          <span class="h1-word h1-grad" data-delay="260">Smarter</span>
        </div>
        <div class="h1-line">
          <span class="h1-word" data-delay="360">with&nbsp;</span><span class="h1-word" data-delay="430">AI.</span>
        </div>
      </h1>

      <p class="hero-sub" id="heroSub">
        Automate operations, surface real-time insights, and make confident decisions — from one intelligent platform built for teams that move fast.
      </p>

      <div class="hero-ctas" id="heroCtas">
        <div class="cta-magnetic-zone">
          <a href="#" class="cta-p" id="ctaPrimary">
            <span class="cta-ring"></span>
            Start
            <div class="cta-arrow" id="ctaArrow">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 6h8M6 2l4 4-4 4" stroke="white" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
          </a>
        </div>
          </div>
    
        </a>
      </div>


        </div>
        </div>
      </div>

      <!-- Live ticker strip -->
      <div class="ticker-wrap" id="tickerWrap">
        <div class="ticker-track">
          <div class="ticker-item"><span class="ti-dot" style="background:#34D399"></span>Cashflow <span class="ti-val">$84.2K</span></div>
          <div class="ticker-item"><span class="ti-dot" style="background:#4C6EF5"></span>Processed Docs <span class="ti-val">1,240</span></div>
          <div class="ticker-item"><span class="ti-dot" style="background:#E64980"></span>Automated Tasks <span class="ti-val">89%</span></div>
          <div class="ticker-item"><span class="ti-dot" style="background:#9C36B5"></span>AI queries today <span class="ti-val">98,402</span></div>
          <div class="ticker-item"><span class="ti-dot" style="background:#15AABF"></span>Uptime <span class="ti-val">99.97%</span></div>
          <div class="ticker-item"><span class="ti-dot" style="background:#F59E0B"></span>Active Alerts <span class="ti-val">3 pending</span></div>
          <div class="ticker-item"><span class="ti-dot" style="background:#34D399"></span>Automations <span class="ti-val">12 live</span></div>
          <!-- duplicate for seamless loop -->
          <div class="ticker-item"><span class="ti-dot" style="background:#34D399"></span>Cashflow <span class="ti-val">$84.2K</span></div>
          <div class="ticker-item"><span class="ti-dot" style="background:#4C6EF5"></span>Processed Docs <span class="ti-val">1,240</span></div>
          <div class="ticker-item"><span class="ti-dot" style="background:#E64980"></span>Automated Tasks <span class="ti-val">89%</span></div>
          <div class="ticker-item"><span class="ti-dot" style="background:#9C36B5"></span>AI queries today <span class="ti-val">98,402</span></div>
          <div class="ticker-item"><span class="ti-dot" style="background:#15AABF"></span>Uptime <span class="ti-val">99.97%</span></div>
          <div class="ticker-item"><span class="ti-dot" style="background:#F59E0B"></span>Active Alerts <span class="ti-val">3 pending</span></div>
          <div class="ticker-item"><span class="ti-dot" style="background:#34D399"></span>Automations <span class="ti-val">12 live</span></div>
        </div>
      </div>

    </div>
  </div>


<!-- ── HERO CENTER LIVE PANEL ── -->
<div class="hero-center-panel" id="heroCenterPanel">

  <!-- AI Terminal -->
  <div class="hcp-terminal">
    <div class="hcp-term-bar">
      <div class="hcp-dot hcp-dot-r"></div>
      <div class="hcp-dot hcp-dot-y"></div>
      <div class="hcp-dot hcp-dot-g"></div>
      <span class="hcp-term-title">aibms · ai agent</span>
    </div>
    <div class="hcp-query">
      <span class="hcp-prompt">›</span>
      <span id="hcpQueryText"></span><span class="hcp-cursor" id="hcpCursor"></span>
    </div>
    <div class="hcp-response" id="hcpResponse"></div>
  </div>

  <!-- Live Metrics -->
  <div class="hcp-metrics">
    <div class="hcp-metric">
      <div class="hcp-metric-label">MRR</div>
      <div class="hcp-metric-val" style="color:#34D399" id="hcpMrr">$0</div>
      <div class="hcp-metric-sub">↑ 18% MoM</div>
      <div class="hcp-metric-bar" style="background:linear-gradient(90deg,#10B981,#059669)"></div>
    </div>
    <div class="hcp-metric">
      <div class="hcp-metric-label">Tasks</div>
      <div class="hcp-metric-val" style="color:#93c5fd" id="hcpTasks">0</div>
      <div class="hcp-metric-sub">AI automated</div>
      <div class="hcp-metric-bar" style="background:linear-gradient(90deg,#4C6EF5,#7C3AED)"></div>
    </div>
  </div>

  <!-- Live Feed -->
  <div class="hcp-feed" id="hcpFeed">
    <div class="hcp-feed-row" id="hfr0">
      <div class="hcp-feed-dot pulse" style="background:#34D399;color:#34D399"></div>
      <div class="hcp-feed-text"><strong>Deal closed</strong> — Nexus AI $91K</div>
      <div class="hcp-feed-time">2s</div>
    </div>
    <div class="hcp-feed-row" id="hfr1">
      <div class="hcp-feed-dot pulse" style="background:#93c5fd;color:#93c5fd"></div>
      <div class="hcp-feed-text"><strong>Report ready</strong> — Q1 revenue</div>
      <div class="hcp-feed-time">18s</div>
    </div>
    <div class="hcp-feed-row" id="hfr2">
      <div class="hcp-feed-dot" style="background:#c084fc;color:#c084fc"></div>
      <div class="hcp-feed-text"><strong>Workflow</strong> — Invoice auto-sent</div>
      <div class="hcp-feed-time">41s</div>
    </div>
    <div class="hcp-feed-row" id="hfr3">
      <div class="hcp-feed-dot" style="background:#f9a8d4;color:#f9a8d4"></div>
      <div class="hcp-feed-text"><strong>AI alert</strong> — Total risk detected</div>
      <div class="hcp-feed-time">1m</div>
    </div>
  </div>

</div>

  <!-- ─── SCROLL CUE ─── -->
  <div class="scroll-cue" id="scrollCue">
    <div class="sc-mouse"><div class="sc-dot"></div></div>
    <div class="sc-chevs">
      <div class="sc-ch"></div>
      <div class="sc-ch"></div>
      <div class="sc-ch"></div>
    </div>
    <span class="sc-lbl">Scroll</span>
  </div>

</section>

<script>
/* ═══════════════════════════════════════════════════════════
   PAGE TRANSITION
   Overlay fades out on load (reveal), fades back in on any
   link click before navigating (exit), so every transition
   feels intentional and cinematic rather than a hard cut.
═══════════════════════════════════════════════════════════ */
const pt = document.getElementById('page-transition');

// Fade out on load — tiny rAF delay ensures the browser has painted
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    pt.classList.add('out');
  });
});

// Fade in before any same-page or external link navigation
document.addEventListener('click', e => {
  const link = e.target.closest('a[href]');
  if (!link) return;
  const href = link.getAttribute('href');
  // Skip hash-only links (#) — they don't navigate
  if (!href || href === '#' || href.startsWith('#')) return;

  e.preventDefault();
  pt.classList.remove('out');
  pt.classList.add('in');
  // Navigate after the fade completes (matches the .72s transition)
  setTimeout(() => { window.location.href = href; }, 750);
});

/* ═══════════════════════════════════════════════════════════
   UTILITY
═══════════════════════════════════════════════════════════ */
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/* ═══════════════════════════════════════════════════════════
   MASTER rAF LOOP
   Everything animated runs through ONE requestAnimationFrame
   so all motion is synchronised to the same frame.
═══════════════════════════════════════════════════════════ */
const tasks = [];  // { fn } registered by each system
function addTask(fn) { tasks.push(fn); }

let lastT = 0;
function masterLoop(t) {
  const dt = Math.min(t - lastT, 64); // cap delta at 64ms (tab focus switch safety)
  lastT = t;
  for (let i = 0; i < tasks.length; i++) tasks[i](t, dt);
  requestAnimationFrame(masterLoop);
}
requestAnimationFrame(masterLoop);

/* ═══════════════════════════════════════════════════════════
   AURORA BEAM LAYER
   Slow rotating translucent light shafts — like Northern Lights
   drawn as wide gradient-filled wedge shapes rotating around
   a point off the top of the screen.
═══════════════════════════════════════════════════════════ */
const auC   = document.getElementById('aurora-canvas');
const auCtx = auC.getContext('2d');
let AW, AH;

function resizeAu() { AW = auC.width = auC.offsetWidth; AH = auC.height = auC.offsetHeight; }
resizeAu();
window.addEventListener('resize', resizeAu);

// Each beam: angle offset, angular speed, colour, opacity
const beams = [
  { a: -0.55, spd: 0.00018, col: [76, 110, 245],  op: .10, w: 0.22 },
  { a:  0.10, spd: 0.00014, col: [156, 54, 181],  op: .09, w: 0.18 },
  { a:  0.65, spd: 0.00022, col: [228, 73, 128],  op: .07, w: 0.20 },
  { a: -0.20, spd: 0.00010, col: [21, 170, 191],  op: .06, w: 0.16 },
  { a:  0.40, spd: 0.00016, col: [124, 58, 237],  op: .08, w: 0.19 },
];

addTask((t) => {
  auCtx.clearRect(0, 0, AW, AH);

  // Origin point above top-centre
  const ox = AW * 0.5;
  const oy = -AH * 0.12;
  const len = AH * 2.4;

  beams.forEach(b => {
    const angle = b.a + t * b.spd;
    const halfW  = b.w * 0.5;

    const ax1 = ox + Math.cos(angle - halfW) * len;
    const ay1 = oy + Math.sin(angle - halfW) * len;
    const ax2 = ox + Math.cos(angle + halfW) * len;
    const ay2 = oy + Math.sin(angle + halfW) * len;

    // Gradient fades from origin outward
    const grad = auCtx.createRadialGradient(ox, oy, 0, ox, oy, len);
    grad.addColorStop(0,   \`rgba(\${b.col[0]},\${b.col[1]},\${b.col[2]},\${b.op})\`);
    grad.addColorStop(0.5, \`rgba(\${b.col[0]},\${b.col[1]},\${b.col[2]},\${b.op * .45})\`);
    grad.addColorStop(1,   \`rgba(\${b.col[0]},\${b.col[1]},\${b.col[2]},0)\`);

    auCtx.beginPath();
    auCtx.moveTo(ox, oy);
    auCtx.lineTo(ax1, ay1);
    auCtx.lineTo(ax2, ay2);
    auCtx.closePath();
    auCtx.fillStyle = grad;
    auCtx.fill();
  });
});

/* ═══════════════════════════════════════════════════════════
   BACKGROUND MESH GRADIENT
   Runs every frame — uses additive radial draws with
   globalCompositeOperation so blending is smooth.
═══════════════════════════════════════════════════════════ */
const bgC   = document.getElementById('bg-canvas');
const bgCtx = bgC.getContext('2d');
let BW, BH;

function resizeBg() { BW = bgC.width = bgC.offsetWidth; BH = bgC.height = bgC.offsetHeight; }
resizeBg();
window.addEventListener('resize', resizeBg);

// Each node has a centre (normalised), radius, colour, and orbital parameters
const nodes = [
  { cx:.17, cy:.24, r:.58, hex:'#1a3fa8', ox:.09, oy:.07, fps:.19, fpc:.14, ph:0.0, pc:0.0 },
  { cx:.74, cy:.16, r:.52, hex:'#5c1a9e', ox:.11, oy:.09, fps:.15, fpc:.12, ph:1.3, pc:0.8 },
  { cx:.44, cy:.62, r:.60, hex:'#8b1060', ox:.07, oy:.08, fps:.12, fpc:.10, ph:2.2, pc:1.5 },
  { cx:.14, cy:.78, r:.44, hex:'#0d6070', ox:.10, oy:.06, fps:.21, fpc:.17, ph:3.1, pc:0.5 },
  { cx:.82, cy:.66, r:.46, hex:'#1a2a8e', ox:.08, oy:.10, fps:.14, fpc:.19, ph:0.6, pc:2.3 },
  { cx:.58, cy:.35, r:.38, hex:'#701090', ox:.06, oy:.08, fps:.17, fpc:.13, ph:1.8, pc:1.1 },
];

// Smooth time accumulator — prevents jumps if tab is hidden
let bgTime = 0;
let lastBgRaf = 0;

addTask((t) => {
  bgTime = t * 0.00045;

  bgCtx.clearRect(0, 0, BW, BH);
  bgCtx.fillStyle = '#02030c';
  bgCtx.fillRect(0, 0, BW, BH);

  bgCtx.globalCompositeOperation = 'lighter';

  nodes.forEach(n => {
    const cx = (n.cx + n.ox * Math.sin(bgTime * n.fps + n.ph)) * BW;
    const cy = (n.cy + n.oy * Math.cos(bgTime * n.fpc + n.pc)) * BH;
    const r  = n.r * Math.min(BW, BH);

    const g = bgCtx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0,   n.hex + '5a');
    g.addColorStop(0.5, n.hex + '1e');
    g.addColorStop(1,   n.hex + '00');
    bgCtx.fillStyle = g;
    bgCtx.fillRect(0, 0, BW, BH);
  });

  bgCtx.globalCompositeOperation = 'source-over';
});

/* ═══════════════════════════════════════════════════════════
   PARTICLE FIELD
   — particles have position + velocity
   — velocity decays via drag (0.988 per frame)
   — gentle mouse repulsion within 130px
   — connections drawn at low opacity
═══════════════════════════════════════════════════════════ */
const pC   = document.getElementById('particle-canvas');
const pCtx = pC.getContext('2d');
let PW, PH, parts = [];
let pmx = -9999, pmy = -9999; // start offscreen so no initial burst

function resizePc() { PW = pC.width = pC.offsetWidth; PH = pC.height = pC.offsetHeight; }
resizePc();
window.addEventListener('resize', () => { resizePc(); buildParts(); });

const COLS = [
  [76, 110, 245],
  [156, 54, 181],
  [228, 73,  128],
  [21, 170, 191],
];

function buildParts() {
  parts = [];
  const n = Math.min(Math.floor(PW * PH / 8000), 120); // cap at 120 for perf
  for (let i = 0; i < n; i++) {
    const c = COLS[i % COLS.length];
    parts.push({
      x:  Math.random() * PW,
      y:  Math.random() * PH,
      vx: (Math.random() - .5) * .22,
      vy: (Math.random() - .5) * .22,
      r:  Math.random() * 1.2 + .35,
      a:  Math.random() * .4 + .1,
      r0: c[0], g0: c[1], b0: c[2],
    });
  }
}
buildParts();

document.addEventListener('mousemove', e => { pmx = e.clientX; pmy = e.clientY; });

// Large ambient orb-particles near card area (right side) — breathe slowly
const orbParticles = [
  { x: .72, y: .30, r: 30, col: [156,54,181], baseA: .065, phase: 0.0,  spd: .55 },
  { x: .86, y: .52, r: 22, col: [76,110,245], baseA: .055, phase: 1.3,  spd: .48 },
  { x: .62, y: .70, r: 20, col: [228,73,128], baseA: .045, phase: 2.5,  spd: .68 },
  { x: .80, y: .80, r: 26, col: [21,170,191], baseA: .050, phase: 0.9,  spd: .42 },
];

addTask((t) => {
  pCtx.clearRect(0, 0, PW, PH);

  const T = t * 0.001;

  // Draw slow breathing orb-particles first (below regular particles)
  orbParticles.forEach(o => {
    const a = o.baseA * (0.6 + 0.4 * Math.sin(T * o.spd + o.phase));
    const cx = o.x * PW, cy = o.y * PH;
    const grad = pCtx.createRadialGradient(cx, cy, 0, cx, cy, o.r);
    grad.addColorStop(0,   \`rgba(\${o.col[0]},\${o.col[1]},\${o.col[2]},\${a})\`);
    grad.addColorStop(0.6, \`rgba(\${o.col[0]},\${o.col[1]},\${o.col[2]},\${a * .3})\`);
    grad.addColorStop(1,   \`rgba(\${o.col[0]},\${o.col[1]},\${o.col[2]},0)\`);
    pCtx.beginPath();
    pCtx.arc(cx, cy, o.r, 0, Math.PI * 2);
    pCtx.fillStyle = grad;
    pCtx.fill();
  });

  const DRAG    = 0.988;
  const REPEL_R = 130;
  const REPEL_F = 0.038;
  const CONN_R  = 100;

  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];

    // Mouse repulsion — smooth, proportional to proximity
    const dx = p.x - pmx, dy = p.y - pmy;
    const d2 = dx * dx + dy * dy;
    if (d2 < REPEL_R * REPEL_R && d2 > 0.01) {
      const d   = Math.sqrt(d2);
      const str = (1 - d / REPEL_R) * REPEL_F;
      p.vx += (dx / d) * str;
      p.vy += (dy / d) * str;
    }

    // Velocity drag
    p.vx *= DRAG;
    p.vy *= DRAG;

    // Move
    p.x += p.vx;
    p.y += p.vy;

    // Wrap edges with tiny buffer so particles don't vanish mid-screen
    if (p.x < -4)       p.x = PW + 4;
    if (p.x > PW + 4)   p.x = -4;
    if (p.y < -4)       p.y = PH + 4;
    if (p.y > PH + 4)   p.y = -4;

    // Draw particle
    pCtx.beginPath();
    pCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    pCtx.fillStyle = \`rgba(\${p.r0},\${p.g0},\${p.b0},\${p.a})\`;
    pCtx.fill();

    // Draw connections (only to subsequent particles — avoid double-draw)
    for (let j = i + 1; j < parts.length; j++) {
      const q   = parts[j];
      const cdx = p.x - q.x, cdy = p.y - q.y;
      const cd  = Math.sqrt(cdx * cdx + cdy * cdy);
      if (cd < CONN_R) {
        const alpha = (1 - cd / CONN_R) * 0.065;
        pCtx.beginPath();
        pCtx.strokeStyle = \`rgba(156,54,181,\${alpha})\`;
        pCtx.lineWidth   = 0.7;
        pCtx.moveTo(p.x, p.y);
        pCtx.lineTo(q.x, q.y);
        pCtx.stroke();
      }
    }
  }
});

/* ═══════════════════════════════════════════════════════════
   FLOATING CARDS
   — each card has target + current state (spring physics)
   — idle float: sine on Y, slight rotation
   — mouse parallax: each card at different depth
   — hover tilt: cursor position relative to card → rotateXY
   — NO marginLeft/marginTop (causes layout reflow)
   — ONLY transform is mutated
═══════════════════════════════════════════════════════════ */
const cardDefs = [
  { el: document.getElementById('fc-a'), depth: 1.0, floatAmp: 10, floatSpeed: .55, floatOffset: 0.0   },
  { el: document.getElementById('fc-b'), depth: 1.4, floatAmp:  8, floatSpeed: .42, floatOffset: 1.1   },
  { el: document.getElementById('fc-c'), depth: 1.8, floatAmp: 12, floatSpeed: .48, floatOffset: 2.3   },
  { el: document.getElementById('fc-d'), depth: 2.2, floatAmp:  7, floatSpeed: .60, floatOffset: 0.7   },
  { el: document.getElementById('fc-e'), depth: 1.6, floatAmp:  9, floatSpeed: .38, floatOffset: 1.8   },
];

// Per-card spring state
cardDefs.forEach(cd => {
  cd.tx = 0; cd.ty = 0;          // translate target
  cd.cx = 0; cd.cy = 0;          // translate current
  cd.rx = 0; cd.ry = 0;          // tilt current
  cd.rtx = 0; cd.rty = 0;        // tilt target
  cd.scale = 1; cd.scaleTgt = 1;
  cd.hovered = false;

  cd.el.addEventListener('mouseenter', () => {
    cd.hovered = true;
    cd.scaleTgt = 1.04;
  });
  cd.el.addEventListener('mouseleave', () => {
    cd.hovered = false;
    cd.rtx = 0; cd.rty = 0;
    cd.scaleTgt = 1;
  });
  cd.el.addEventListener('mousemove', e => {
    if (!cd.hovered) return;
    const r = cd.el.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width  - 0.5;
    const ny = (e.clientY - r.top)  / r.height - 0.5;
    cd.rtx = nx * 12;   // rotateY
    cd.rty = -ny * 10;  // rotateX
  });
});

// Normalised mouse position for parallax
let nmx = 0, nmy = 0;
document.addEventListener('mousemove', e => {
  nmx = (e.clientX / window.innerWidth)  - 0.5;
  nmy = (e.clientY / window.innerHeight) - 0.5;
});

const CARD_SPRING  = 0.07;  // spring tightness for translate
const TILT_SPRING  = 0.10;  // spring tightness for tilt
const SCALE_SPRING = 0.10;

addTask((t) => {
  const T = t * 0.001;

  cardDefs.forEach(cd => {
    // Parallax target
    const par = cd.depth * 18;
    cd.tx = nmx * par;
    cd.ty = nmy * par * .65;

    // Spring translate
    cd.cx = lerp(cd.cx, cd.tx, CARD_SPRING);
    cd.cy = lerp(cd.cy, cd.ty, CARD_SPRING);

    // Idle float on Y (additive on top of parallax)
    const floatY = Math.sin(T * cd.floatSpeed + cd.floatOffset) * cd.floatAmp;

    // Spring tilt
    cd.rx = lerp(cd.rx, cd.rtx, TILT_SPRING);
    cd.ry = lerp(cd.ry, cd.rty, TILT_SPRING);

    // Spring scale
    cd.scale = lerp(cd.scale, cd.scaleTgt, SCALE_SPRING);

    // Apply — single transform, GPU-composited
    cd.el.style.transform =
      \`translate(\${cd.cx}px, \${cd.cy + floatY}px) \` +
      \`rotateX(\${cd.ry}deg) rotateY(\${cd.rx}deg) \` +
      \`scale(\${cd.scale})\`;

    // Dynamic shadow on tilt
    if (cd.hovered) {
      const sx = cd.rx * -.7, sy = cd.ry * -.7;
      cd.el.style.boxShadow =
        \`0 0 0 1px rgba(255,255,255,.06), \` +
        \`\${sx}px \${sy}px 50px rgba(0,0,0,.65), \` +
        \`0 28px 60px rgba(0,0,0,.5), \` +
        \`inset 0 1px 0 rgba(255,255,255,.08), \` +
        \`\${-sx*2}px \${-sy*2}px 28px rgba(156,54,181,.14)\`;
    } else {
      cd.el.style.boxShadow = '';
    }
  });
});

/* ═══════════════════════════════════════════════════════════
   PRIMARY CTA — spring lift + arrow spring
═══════════════════════════════════════════════════════════ */
const ctaEl    = document.getElementById('ctaPrimary');
const arrowEl  = document.getElementById('ctaArrow');
let ctaY = 0, ctaYT = 0, ctaSc = 1, ctaScT = 1;
let arrowX = 0, arrowXT = 0;

ctaEl.addEventListener('mouseenter', () => { ctaYT = -4; ctaScT = 1.025; arrowXT = 5; });
ctaEl.addEventListener('mouseleave', () => { ctaYT = 0;  ctaScT = 1;     arrowXT = 0; });
ctaEl.addEventListener('mousedown',  () => { ctaYT = -1; ctaScT = .98; });
ctaEl.addEventListener('mouseup',    () => { ctaYT = -4; ctaScT = 1.025; });

addTask(() => {
  ctaY  = lerp(ctaY,  ctaYT,  0.12);
  ctaSc = lerp(ctaSc, ctaScT, 0.12);
  arrowX = lerp(arrowX, arrowXT, 0.12);
  ctaEl.style.transform   = \`translateY(\${ctaY}px) scale(\${ctaSc})\`;
  arrowEl.style.transform = \`translateX(\${arrowX}px)\`;
});

// Ripple on click
ctaEl.addEventListener('mousedown', function(e) {
  const r = this.getBoundingClientRect();
  const sp = document.createElement('span');
  const size = 5;
  sp.style.cssText = \`
    position:absolute;border-radius:50%;pointer-events:none;z-index:20;
    width:\${size}px;height:\${size}px;
    left:\${e.clientX - r.left}px;top:\${e.clientY - r.top}px;
    background:rgba(255,255,255,.22);
    transform:translate(-50%,-50%) scale(0);
    animation:rpl .7s cubic-bezier(.22,1,.36,1) forwards;
  \`;
  this.appendChild(sp);
  setTimeout(() => sp.remove(), 750);
});

/* ═══════════════════════════════════════════════════════════
   NAV PILL SLIDER INDICATOR
   — measures pill DOM rects, slides a bg div with transform
═══════════════════════════════════════════════════════════ */
const modeBg    = document.getElementById('navModeBg');
const pills     = document.querySelectorAll('.nav-pill');
const modeWrap  = document.getElementById('navMode');
let   pilIdx    = 0;

function movePillBg(idx) {
  const pill  = pills[idx];
  const wRect = modeWrap.getBoundingClientRect();
  const pRect = pill.getBoundingClientRect();
  modeBg.style.width     = pRect.width  + 'px';
  modeBg.style.height    = pRect.height + 'px';
  modeBg.style.transform = \`translateX(\${pRect.left - wRect.left}px)\`;
}

pills.forEach((p, i) => {
  p.addEventListener('click', () => {
    pills.forEach(x => x.classList.remove('active'));
    p.classList.add('active');
    pilIdx = i;
    movePillBg(i);
  });
});

// Init bg position after layout
setTimeout(() => movePillBg(pilIdx), 60);

/* ═══════════════════════════════════════════════════════════
   ENTRANCE SEQUENCE
   Uses precise timeouts to trigger CSS transitions in order.
   Each element uses CSS transitions (not JS spring) for entrance
   because they only happen once and transitions are cleaner.
═══════════════════════════════════════════════════════════ */
function sequence(steps) {
  steps.forEach(([delay, fn]) => setTimeout(fn, delay));
}

sequence([
  [  80, () => document.getElementById('nav')?.classList.add('visible') ],
  
  [ 400, () => {
    document.querySelectorAll('.h1-word').forEach(w => {
      const delay = parseInt(w.dataset.delay || 0);
      setTimeout(() => w.classList.add('revealed'), delay);
    });
  }],
  [ 940, () => document.getElementById('heroSub')?.classList.add('revealed') ],
  [1100, () => document.getElementById('heroCtas')?.classList.add('revealed') ],
  [1280, () => document.getElementById('spRow')?.classList.add('revealed') ],
  [1480, () => document.getElementById('tickerWrap')?.classList.add('revealed') ],
  [1600, () => document.getElementById('scrollCue')?.classList.add('visible') ],
  [ 600, () => document.getElementById('fc-a')?.classList.add('visible') ],
  [ 760, () => document.getElementById('fc-b')?.classList.add('visible') ],
  [ 920, () => document.getElementById('fc-c')?.classList.add('visible') ],
  [1060, () => document.getElementById('fc-d')?.classList.add('visible') ],
  [ 840, () => document.getElementById('fc-e')?.classList.add('visible') ],
]);

/* ═══════════════════════════════════════════════════════════
   RIPPLE KEYFRAME (injected once)
═══════════════════════════════════════════════════════════ */
document.head.insertAdjacentHTML('beforeend',
  \`<style>
    @keyframes rpl { to { transform:translate(-50%,-50%) scale(90); opacity:0; } }
    /* Perspective on card layer for 3D tilt */
    .f-cards-layer { perspective: 900px; }
    .fc { transform-style: preserve-3d; }
  </style>\`
);

/* ═══════════════════════════════════════════════════════════
   NAV CTA spring (same pattern as primary)
═══════════════════════════════════════════════════════════ */
const navCta = document.querySelector('.nav-cta');
let ncY = 0, ncYT = 0;
navCta.addEventListener('mouseenter', () => ncYT = -2);
navCta.addEventListener('mouseleave', () => ncYT = 0);
addTask(() => {
  ncY = lerp(ncY, ncYT, 0.13);
  navCta.style.transform = \`translateY(\${ncY}px)\`;
});

/* ═══════════════════════════════════════════════════════════
   BAR HOVER — pointer-events on the card hover layer
═══════════════════════════════════════════════════════════ */
document.querySelectorAll('.bars-wrap').forEach(wrap => {
  wrap.style.pointerEvents = 'auto';
});

/* ═══════════════════════════════════════════════════════════
   MAGNETIC CTA
   Cursor gravitates toward the primary button within a radius.
   The button also moves subtly toward the cursor (magnetism).
═══════════════════════════════════════════════════════════ */
const magnetZone = document.querySelector('.cta-magnetic-zone');
const MAG_RADIUS = 110;
let magTx = 0, magTy = 0, magCx = 0, magCy = 0;
let isMagActive = false;

document.addEventListener('mousemove', e => {
  if (!magnetZone) return;
  const r  = magnetZone.getBoundingClientRect();
  const bx = r.left + r.width  * 0.5;
  const by = r.top  + r.height * 0.5;
  const dx = e.clientX - bx;
  const dy = e.clientY - by;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < MAG_RADIUS) {
    isMagActive = true;
    const pull = (1 - dist / MAG_RADIUS);
    magTx = dx * pull * 0.28;
    magTy = dy * pull * 0.28;
  } else {
    isMagActive = false;
    magTx = 0; magTy = 0;
  }
});

addTask(() => {
  magCx = lerp(magCx, magTx, 0.10);
  magCy = lerp(magCy, magTy, 0.10);
  if (magnetZone) {
    magnetZone.style.transform = \`translate(\${magCx}px, \${magCy}px)\`;
  }
});

/* ═══════════════════════════════════════════════════════════
   COUNT-UP — card values animate from 0 on first visibility
═══════════════════════════════════════════════════════════ */
function animateCountUp(el, target, prefix, suffix, decimals, duration) {
  const start = performance.now();
  function frame(now) {
    const p  = Math.min((now - start) / duration, 1);
    // easeOutExpo
    const ep = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
    const v  = target * ep;
    el.textContent = prefix + (decimals ? v.toFixed(decimals) : Math.round(v).toLocaleString()) + suffix;
    if (p < 1) requestAnimationFrame(frame);
    else el.textContent = prefix + (decimals ? target.toFixed(decimals) : target.toLocaleString()) + suffix;
  }
  requestAnimationFrame(frame);
}

// Define which elements to count up and their targets
const countTargets = [
  { selector: '#fc-a .fc-val',             prefix: '$', val: 2.41,  suffix: 'M', dec: 2, dur: 1400 },
  { selector: '#fc-d .fc-val',             prefix: '',  val: 98402, suffix: '',  dec: 0, dur: 1600 },
];

let countsStarted = false;
function tryStartCounts() {
  if (countsStarted) return;
  countsStarted = true;
  setTimeout(() => {
    countTargets.forEach(ct => {
      const el = document.querySelector(ct.selector);
      if (el) animateCountUp(el, ct.val, ct.prefix, ct.suffix, ct.dec, ct.dur);
    });
  }, 700);
}
// Trigger when cards become visible
setTimeout(tryStartCounts, 800);

/* ═══════════════════════════════════════════════════════════
   TEXT SCRAMBLE — headline "AI." scrambles in on reveal
   Uses a character-cycling effect before settling
═══════════════════════════════════════════════════════════ */
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%';
function scramble(el, finalText, duration) {
  const totalFrames = Math.round(duration / 16);
  let frame = 0;
  const interval = setInterval(() => {
    frame++;
    const progress = frame / totalFrames;
    const settledChars = Math.floor(progress * finalText.length);
    let display = '';
    for (let i = 0; i < finalText.length; i++) {
      if (finalText[i] === ' ') { display += ' '; continue; }
      if (i < settledChars) {
        display += finalText[i];
      } else {
        display += CHARS[Math.floor(Math.random() * CHARS.length)];
      }
    }
    el.textContent = display;
    if (frame >= totalFrames) {
      clearInterval(interval);
      el.textContent = finalText;
    }
  }, 16);
}

// Scramble the last word "AI." after it reveals
setTimeout(() => {
  const aiWord = document.querySelector('.h1-word[data-delay="430"]');
  if (aiWord) scramble(aiWord, 'AI.', 600);
}, 430 + 400 + 720); // delay + reveal-delay + transition-time

/* ═══════════════════════════════════════════════════════════
   SECONDARY CTA spring (same pattern as primary)
═══════════════════════════════════════════════════════════ */
const ctaS = document.getElementById('ctaSecondary');
let csY = 0, csYT = 0;
if (ctaS) {
  ctaS.addEventListener('mouseenter', () => csYT = -3);
  ctaS.addEventListener('mouseleave', () => csYT = 0);
  addTask(() => {
    csY = lerp(csY, csYT, 0.12);
    ctaS.style.transform = \`translateY(\${csY}px)\`;
  });
}

/* ═══════════════════════════════════════════════════════════
   CARD GLOW ON HOVER — border color lift via JS
   (complements the CSS transition defined on .fc)
═══════════════════════════════════════════════════════════ */
const glowColors = {
  'fc-a': 'rgba(76,110,245,.35)',
  'fc-b': 'rgba(156,54,181,.35)',
  'fc-c': 'rgba(228,73,128,.32)',
  'fc-d': 'rgba(21,170,191,.32)',
  'fc-e': 'rgba(52,211,153,.35)',
};
Object.entries(glowColors).forEach(([id, color]) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('mouseenter', () => {
    el.style.borderColor = color;
    el.style.boxShadow = \`0 0 0 1px rgba(255,255,255,.06), 0 32px 70px rgba(0,0,0,.6), 0 0 40px \${color}, inset 0 1px 0 rgba(255,255,255,.08)\`;
  });
  el.addEventListener('mouseleave', () => {
    el.style.borderColor = '';
    el.style.boxShadow   = '';
  });
});
</script>

<script>
(function(){
  // ── Typewriter + response cycle ──
  var queries = [
    { q: "Show pipeline health", r: '<span class="hcp-hi">$176K</span> active · <span class="hcp-hi2">3 deals</span> need attention' },
    { q: "Revenue this month?",  r: 'MRR <span class="hcp-hi">$84.2K</span> · up <span class="hcp-hi2">18.3%</span> vs last month' },
    { q: "Automate follow-ups",  r: '<span class="hcp-hi">12 emails</span> scheduled · <span class="hcp-hi2">AI drafting...</span>' },
    { q: "Top risk today?",      r: 'APAC pipeline <span class="hcp-hi2">slowing</span> — re-engage <span class="hcp-hi">Horizon Labs</span>' },
  ];
  var qi = 0;
  var qEl = document.getElementById('hcpQueryText');
  var rEl = document.getElementById('hcpResponse');
  var cursor = document.getElementById('hcpCursor');

  function typeQuery(text, cb) {
    qEl.textContent = '';
    rEl.innerHTML = '';
    var i = 0;
    cursor.style.display = 'inline-block';
    var iv = setInterval(function(){
      qEl.textContent += text[i++];
      if (i >= text.length) { clearInterval(iv); setTimeout(cb, 400); }
    }, 48);
  }

  function showResponse(html, cb) {
    rEl.innerHTML = html;
    rEl.style.maxHeight = '0';
    rEl.style.transition = 'max-height .5s ease';
    rEl.style.maxHeight = '60px';
    setTimeout(cb, 3200);
  }

  function eraseQuery(cb) {
    var text = qEl.textContent;
    var i = text.length;
    rEl.style.maxHeight = '0';
    var iv = setInterval(function(){
      qEl.textContent = text.slice(0, --i);
      if (i <= 0) { clearInterval(iv); cb(); }
    }, 28);
  }

  function runCycle() {
    var entry = queries[qi % queries.length]; qi++;
    typeQuery(entry.q, function(){
      showResponse(entry.r, function(){
        eraseQuery(function(){
          setTimeout(runCycle, 300);
        });
      });
    });
  }

  // ── Count-up for metrics ──
  function countUp(el, target, prefix, suffix, dur) {
    var start = performance.now();
    function frame(now) {
      var p = Math.min((now - start) / dur, 1);
      var ep = 1 - Math.pow(1 - p, 3);
      var v = Math.round(ep * target);
      el.textContent = prefix + v.toLocaleString() + suffix;
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  // ── Feed row stagger ──
  function showFeedRows() {
    [0,1,2,3].forEach(function(i){
      setTimeout(function(){
        var el = document.getElementById('hfr' + i);
        if (el) el.classList.add('show');
      }, i * 280);
    });
  }

  // ── Live feed cycling — replace oldest row with new event ──
  var feedEvents = [
    { color:'#34D399', text:'<strong>Deal closed</strong> — StarkMed $15K',    time:'now' },
    { color:'#93c5fd', text:'<strong>Forecast</strong> — Q2 target on track',   time:'now' },
    { color:'#c084fc', text:'<strong>Automation</strong> — 1,204 tasks done',   time:'now' },
    { color:'#f9a8d4', text:'<strong>Insight</strong> — EU expansion approved', time:'now' },
    { color:'#34D399', text:'<strong>Payment</strong> — Invoice #2041 paid',     time:'now' },
    { color:'#fcd34d', text:'<strong>Alert</strong> — APAC re-engagement sent', time:'now' },
  ];
  var feedIdx = 0;
  var feedRows = [
    document.getElementById('hfr0'),
    document.getElementById('hfr1'),
    document.getElementById('hfr2'),
    document.getElementById('hfr3'),
  ];
  var feedSlot = 0;

  function pushFeedEvent() {
    var ev = feedEvents[feedIdx % feedEvents.length]; feedIdx++;
    var row = feedRows[feedSlot % feedRows.length]; feedSlot++;
    if (!row) return;
    row.classList.remove('show');
    setTimeout(function(){
      var dot = row.querySelector('.hcp-feed-dot');
      var txt = row.querySelector('.hcp-feed-text');
      var tim = row.querySelector('.hcp-feed-time');
      dot.style.background = ev.color;
      dot.style.color = ev.color;
      txt.innerHTML = ev.text;
      tim.textContent = 'now';
      row.classList.add('show');
      // Age existing rows
      feedRows.forEach(function(r, i){
        var t = r.querySelector('.hcp-feed-time');
        if (t && t.textContent === 'now') t.textContent = (i * 8 + 4) + 's';
      });
    }, 300);
    setTimeout(pushFeedEvent, 3500);
  }

  // ── Init after entrance sequence ──
  setTimeout(function(){
    var panel = document.getElementById('heroCenterPanel');
    if (panel) panel.classList.add('visible');
    countUp(document.getElementById('hcpMrr'),   84200, '$', '', 1800);
    countUp(document.getElementById('hcpTasks'), 98402, '',  '', 2200);
    showFeedRows();
    setTimeout(runCycle, 600);
    setTimeout(pushFeedEvent, 4000);
  }, 1400);
})();
</script>

<script>
(function(){
  var cv = document.getElementById('hero-particles');
  if (!cv) return;
  var ctx = cv.getContext('2d');
  var W=0, H=0, RAF, t=0;
  var COLORS=[[76,110,245],[99,102,241],[124,58,237],[147,51,234],[79,70,229],[168,85,247]];
  function rand(a,b){return a+Math.random()*(b-a);}
  function createBall(){
    var c=COLORS[Math.floor(Math.random()*COLORS.length)];
    return {x:rand(0,W),y:rand(0,H),r:rand(10,28),vx:rand(-0.15,0.15),vy:rand(-0.12,0.12),
      phaseX:rand(0,Math.PI*2),phaseY:rand(0,Math.PI*2),
      ampX:rand(0.06,0.14),ampY:rand(0.05,0.12),
      freqX:rand(0.0004,0.0009),freqY:rand(0.0003,0.0008),
      alpha:rand(0.38,0.62),glow:rand(2.2,3.6),r_:c[0],g_:c[1],b_:c[2]};
  }
  function resize(){W=cv.width=cv.offsetWidth||window.innerWidth;H=cv.height=cv.offsetHeight||window.innerHeight;}
  var balls=[];
  function init(){
    resize();balls=[];
    for(var i=0;i<18;i++)balls.push(createBall());
    window.addEventListener('resize',function(){resize();balls.forEach(function(b){if(b.x>W)b.x=W*Math.random();if(b.y>H)b.y=H*Math.random();});});
  }
  function tick(){
    RAF=requestAnimationFrame(tick);t++;
    ctx.clearRect(0,0,W,H);
    balls.forEach(function(b){
      b.x+=b.vx+Math.sin(t*b.freqX+b.phaseX)*b.ampX;
      b.y+=b.vy+Math.cos(t*b.freqY+b.phaseY)*b.ampY;
      var m=b.r*2;
      if(b.x<-m)b.x=W+m;if(b.x>W+m)b.x=-m;
      if(b.y<-m)b.y=H+m;if(b.y>H+m)b.y=-m;
      var gr=b.r*b.glow;
      var grd=ctx.createRadialGradient(b.x,b.y,0,b.x,b.y,gr);
      grd.addColorStop(0,'rgba('+b.r_+','+b.g_+','+b.b_+','+b.alpha+')');
      grd.addColorStop(.3,'rgba('+b.r_+','+b.g_+','+b.b_+','+(b.alpha*.6)+')');
      grd.addColorStop(.65,'rgba('+b.r_+','+b.g_+','+b.b_+','+(b.alpha*.2)+')');
      grd.addColorStop(1,'rgba('+b.r_+','+b.g_+','+b.b_+',0)');
      ctx.beginPath();ctx.arc(b.x,b.y,gr,0,Math.PI*2);ctx.fillStyle=grd;ctx.fill();
    });
  }
  init();tick();
  document.addEventListener('visibilitychange',function(){if(document.hidden)cancelAnimationFrame(RAF);else{t=0;tick();}});
})();
</script>
<script>
(function(){
  document.addEventListener('click',function(e){
    var a=e.target.closest('a[href]');if(!a)return;
    var h=a.getAttribute('href');if(!h||h==='#')return;
    if(h.startsWith('/')){e.preventDefault();e.stopPropagation();window.parent.postMessage({type:'AIBMS_NAVIGATE',to:h},'*');}
  },true);
  window.addEventListener('load',function(){
    document.querySelectorAll('.nav-cta,.cta-p,#ctaPrimary').forEach(function(el){el.addEventListener('click',function(e){e.preventDefault();window.parent.postMessage({type:'AIBMS_NAVIGATE',to:'/signup'},'*');});});
    document.querySelectorAll('.nav-si').forEach(function(el){el.addEventListener('click',function(e){e.preventDefault();window.parent.postMessage({type:'AIBMS_NAVIGATE',to:'/login'},'*');});});
    document.querySelectorAll('.nav-links a[data-scroll]').forEach(function(el){
      el.addEventListener('click',function(e){
        e.preventDefault();
        var target=el.getAttribute('data-scroll');
        window.parent.postMessage({type:'AIBMS_SCROLL',to:target},'*');
      });
    });
  });
})();
</script>
</body>
</html>
`;
const MARQUEE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>AIBMS — Continuous Flow</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet"/>
<style>

/* ═══════════════════════════════════════════════
   RESET & BASE
═══════════════════════════════════════════════ */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; }
body {
  font-family: 'DM Sans', sans-serif;
  background: #05060f;
  color: #fff;
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
}

/* ═══════════════════════════════════════════════
   TOKENS
═══════════════════════════════════════════════ */
:root {
  --blue:   #4C6EF5;
  --violet: #7C3AED;
  --purple: #9333EA;
  --pink:   #EC4899;
  --cyan:   #06B6D4;
  --teal:   #0D9488;
  --amber:  #F59E0B;
  --rose:   #F43F5E;

  --ease-out: cubic-bezier(.25, 1, .5, 1);
}

/* ═══════════════════════════════════════════════
   SECTION SHELL
═══════════════════════════════════════════════ */
.flow-section {
  position: relative;
  padding: 120px 0 130px;
  overflow: hidden;
  isolation: isolate;
}

/* ── Deep layered background ── */
.flow-bg {
  position: absolute; inset: 0; z-index: 0; pointer-events: none;
  background:
    radial-gradient(ellipse 80% 60% at  0% 50%, rgba(76,110,245,.12) 0%, transparent 55%),
    radial-gradient(ellipse 60% 70% at 100% 30%, rgba(147,51,234,.10) 0%, transparent 55%),
    radial-gradient(ellipse 55% 55% at  50% 100%, rgba(236,72,153,.08) 0%, transparent 50%),
    radial-gradient(ellipse 45% 40% at  70% 10%, rgba(6,182,212,.07)  0%, transparent 50%);
  animation: bg-shift 18s ease-in-out infinite alternate;
}
@keyframes bg-shift {
  0%   { opacity:.8; filter:hue-rotate(0deg); }
  100% { opacity:1;  filter:hue-rotate(12deg); }
}

/* Parallax layer 1 — slow drifting orbs (moves opposite scroll direction via JS) */
.flow-parallax-slow {
  position: absolute; inset: 0; z-index: 1; pointer-events: none;
  will-change: transform;
}
.par-orb {
  position: absolute; border-radius: 50%; filter: blur(70px);
}
.po1 { width:480px;height:480px; top:-80px; left:-100px;
       background:radial-gradient(circle,rgba(76,110,245,.18),transparent 65%);
       animation: orb-drift1 22s ease-in-out infinite alternate; }
.po2 { width:380px;height:380px; bottom:-60px; right:-80px;
       background:radial-gradient(circle,rgba(147,51,234,.14),transparent 65%);
       animation: orb-drift2 28s ease-in-out infinite alternate; }
.po3 { width:320px;height:320px; top:30%; left:40%;
       background:radial-gradient(circle,rgba(236,72,153,.10),transparent 65%);
       animation: orb-drift3 20s ease-in-out infinite alternate; }
@keyframes orb-drift1{ 0%{transform:translate(0,0)} 100%{transform:translate(60px,80px)} }
@keyframes orb-drift2{ 0%{transform:translate(0,0)} 100%{transform:translate(-50px,-60px)} }
@keyframes orb-drift3{ 0%{transform:translate(0,0)} 100%{transform:translate(40px,-50px)} }

/* Fine grid */
.flow-grid {
  position: absolute; inset: 0; z-index: 1; pointer-events: none;
  background-image:
    linear-gradient(rgba(255,255,255,.028) 1px, transparent 1px),
    linear-gradient(90deg,rgba(255,255,255,.028) 1px, transparent 1px);
  background-size: 80px 80px;
  mask-image: radial-gradient(ellipse 100% 80% at 50% 50%, black 10%, transparent 80%);
}

/* Top / bottom gradient fade */
.flow-fade-top,
.flow-fade-bot {
  position: absolute; left: 0; right: 0; height: 160px; z-index: 10; pointer-events: none;
}
.flow-fade-top { top: 0;
  background: linear-gradient(to bottom, #05060f 0%, rgba(5,6,15,.6) 50%, transparent 100%); }
.flow-fade-bot { bottom: 0;
  background: linear-gradient(to top,   #05060f 0%, rgba(5,6,15,.6) 50%, transparent 100%); }

/* Left / right masks so cards vanish softly at edges */
.flow-mask-left,
.flow-mask-right {
  position: absolute; top: 0; bottom: 0; width: 220px; z-index: 9; pointer-events: none;
}
.flow-mask-left  { left:  0; background: linear-gradient(to right, #05060f 0%, transparent 100%); }
.flow-mask-right { right: 0; background: linear-gradient(to left,  #05060f 0%, transparent 100%); }

/* ═══════════════════════════════════════════════
   HEADER
═══════════════════════════════════════════════ */
.flow-header {
  position: relative; z-index: 5;
  text-align: center;
  padding: 0 24px;
  margin-bottom: 64px;
}
.flow-eyebrow {
  display: inline-flex; align-items: center; gap: 10px;
  font-size: .7rem; font-weight: 600; text-transform: uppercase;
  letter-spacing: .15em; color: rgba(255,255,255,.38);
  margin-bottom: 16px;
}
.flow-eyebrow-line {
  width: 24px; height: 1.5px; border-radius: 2px;
  background: linear-gradient(90deg,#4C6EF5,#9333EA);
  opacity: .7;
}
.flow-title {
  font-family: 'Bricolage Grotesque', sans-serif;
  font-size: clamp(1.9rem, 3.8vw, 3rem);
  font-weight: 800; letter-spacing: -.04em; line-height: 1.12;
  color: #fff; margin-bottom: 14px;
}
.flow-title .gt {
  background: linear-gradient(135deg, #a5c8ff 0%, #d4b5ff 50%, #fca5c8 100%);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  background-clip: text;
  filter: drop-shadow(0 0 18px rgba(147,51,234,.4));
}
.flow-sub {
  font-size: .96rem; font-weight: 300;
  color: rgba(255,255,255,.48); max-width: 480px; margin: 0 auto;
  line-height: 1.7;
}

/* ═══════════════════════════════════════════════
   LANES WRAPPER
═══════════════════════════════════════════════ */
.flow-lanes {
  position: relative; z-index: 5;
  display: flex; flex-direction: column; gap: 18px;
}

/* ═══════════════════════════════════════════════
   SINGLE LANE (one scrolling row)
═══════════════════════════════════════════════ */
.flow-lane {
  overflow: hidden;
  /* pause any child animation when lane is hovered */
}
/* The track — position driven entirely by JS rAF, no CSS animation */
.flow-track {
  display: flex; gap: 16px;
  width: max-content;
  will-change: transform;
  /* No animation property — JS owns the transform */
}

/* ═══════════════════════════════════════════════
   CARD BASE
═══════════════════════════════════════════════ */
.fc {
  flex-shrink: 0;
  display: flex; align-items: flex-start; gap: 14px;
  padding: 18px 22px;
  border-radius: 16px;
  border: 1px solid rgba(255,255,255,.09);
  background: rgba(12, 9, 28, .72);
  /* NO backdrop-filter on the card itself — it causes blur */
  box-shadow:
    0 0 0 1px rgba(255,255,255,.04),
    0 8px 28px rgba(0,0,0,.45),
    inset 0 1px 0 rgba(255,255,255,.06);
  cursor: default;
  position: relative; overflow: hidden;
  /* smooth hover */
  transition:
    transform    .42s cubic-bezier(.34,1.4,.64,1),
    border-color .35s var(--ease-out),
    box-shadow   .35s var(--ease-out);
  min-width: 260px;
}

/* Specular top-left highlight */
.fc::before {
  content: ''; position: absolute;
  top: 0; left: 0; width: 55%; height: 45%;
  background: radial-gradient(ellipse at 15% 15%, rgba(255,255,255,.055) 0%, transparent 65%);
  border-radius: 16px 0 0 0;
  pointer-events: none;
}

/* Bottom accent shimmer line */
.fc::after {
  content: ''; position: absolute;
  bottom: 0; left: 20%; right: 20%; height: 1px;
  background: var(--card-line, linear-gradient(90deg,transparent,rgba(147,51,234,.5),transparent));
  opacity: 0;
  transition: opacity .35s var(--ease-out);
}

/* Hover state */
.fc:hover {
  transform: translateY(-5px) scale(1.025);
  border-color: rgba(255,255,255,.18);
  box-shadow:
    0 0 0 1px rgba(255,255,255,.08),
    0 20px 48px rgba(0,0,0,.55),
    0 0 32px var(--card-glow, rgba(147,51,234,.18)),
    inset 0 1px 0 rgba(255,255,255,.09);
}
.fc:hover::after { opacity: 1; }

/* ─ Card icon ─ */
.fc-icon {
  width: 40px; height: 40px; min-width: 40px;
  border-radius: 11px;
  display: flex; align-items: center; justify-content: center;
  font-size: 1.1rem;
  border: 1px solid rgba(255,255,255,.08);
  position: relative; z-index: 1;
  flex-shrink: 0;
  transition: transform .42s cubic-bezier(.34,1.4,.64,1);
}
.fc:hover .fc-icon { transform: scale(1.1) rotate(-4deg); }

/* ─ Card text ─ */
.fc-text { position: relative; z-index: 1; }
.fc-name {
  font-family: 'Bricolage Grotesque', sans-serif;
  font-size: .88rem; font-weight: 700;
  letter-spacing: -.015em; color: #fff;
  margin-bottom: 4px; line-height: 1.2;
}
.fc-desc {
  font-size: .76rem; font-weight: 300;
  color: rgba(255,255,255,.45); line-height: 1.5;
}

/* ─ Stat variant ─ */
.fc.stat {
  flex-direction: column; gap: 6px;
  min-width: 180px; padding: 20px 22px;
}
.fc-stat-num {
  font-family: 'Bricolage Grotesque', sans-serif;
  font-size: 1.75rem; font-weight: 800;
  letter-spacing: -.04em; line-height: 1;
  background: var(--num-grad, linear-gradient(135deg,#a5c8ff,#d4b5ff));
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  background-clip: text;
}
.fc-stat-label {
  font-size: .72rem; color: rgba(255,255,255,.42); font-weight: 400; line-height: 1.4;
}

/* ─ Quote variant ─ */
.fc.quote {
  flex-direction: column; gap: 10px; min-width: 300px;
  padding: 20px 22px;
}
.fc-quote-text {
  font-size: .82rem; font-style: italic; font-weight: 300;
  color: rgba(255,255,255,.62); line-height: 1.55;
}
.fc-quote-author {
  display: flex; align-items: center; gap: 9px; margin-top: 2px;
}
.fc-avatar {
  width: 26px; height: 26px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: .6rem; font-weight: 800;
  border: 1px solid rgba(255,255,255,.12);
}
.fc-author-name { font-size: .72rem; font-weight: 600; color: rgba(255,255,255,.65); }
.fc-author-role { font-size: .64rem; color: rgba(255,255,255,.32); margin-top: 1px; }

/* ─ Tag/pill variant ─ */
.fc.pill-card {
  align-items: center; gap: 10px;
  padding: 14px 20px;
  min-width: auto;
}
.fc-pill-icon { font-size: 1.2rem; line-height: 1; }
.fc-pill-label {
  font-size: .84rem; font-weight: 600;
  color: rgba(255,255,255,.72); letter-spacing: -.01em;
  white-space: nowrap;
}

/* ─ Per-card colour themes ─ */
.c-blue   { --card-glow:rgba(76,110,245,.22);  --card-line:linear-gradient(90deg,transparent,rgba(76,110,245,.6),transparent); }
.c-violet { --card-glow:rgba(124,58,237,.22);  --card-line:linear-gradient(90deg,transparent,rgba(124,58,237,.6),transparent); }
.c-purple { --card-glow:rgba(147,51,234,.22);  --card-line:linear-gradient(90deg,transparent,rgba(147,51,234,.6),transparent); }
.c-pink   { --card-glow:rgba(236,72,153,.2);   --card-line:linear-gradient(90deg,transparent,rgba(236,72,153,.6),transparent); }
.c-cyan   { --card-glow:rgba(6,182,212,.2);    --card-line:linear-gradient(90deg,transparent,rgba(6,182,212,.6),transparent); }
.c-teal   { --card-glow:rgba(13,148,136,.2);   --card-line:linear-gradient(90deg,transparent,rgba(13,148,136,.6),transparent); }
.c-amber  { --card-glow:rgba(245,158,11,.18);  --card-line:linear-gradient(90deg,transparent,rgba(245,158,11,.5),transparent); }
.c-rose   { --card-glow:rgba(244,63,94,.2);    --card-line:linear-gradient(90deg,transparent,rgba(244,63,94,.55),transparent); }
.c-emerald{ --card-glow:rgba(16,185,129,.2);   --card-line:linear-gradient(90deg,transparent,rgba(16,185,129,.55),transparent); }

/* Icon backgrounds */
.ib-blue   { background:rgba(76,110,245,.14);  }
.ib-violet { background:rgba(124,58,237,.14);  }
.ib-purple { background:rgba(147,51,234,.14);  }
.ib-pink   { background:rgba(236,72,153,.12);  }
.ib-cyan   { background:rgba(6,182,212,.12);   }
.ib-teal   { background:rgba(13,148,136,.12);  }
.ib-amber  { background:rgba(245,158,11,.12);  }
.ib-rose   { background:rgba(244,63,94,.12);   }
.ib-emerald{ background:rgba(16,185,129,.12);  }

/* ═══════════════════════════════════════════════
   SCROLL REVEAL for header
═══════════════════════════════════════════════ */
.reveal {
  opacity: 0; transform: translateY(24px);
  transition: opacity .7s var(--ease-out), transform .7s var(--ease-out);
}
.reveal.vis { opacity: 1; transform: none; }
.reveal.d1 { transition-delay: .08s; }
.reveal.d2 { transition-delay: .16s; }

</style>
</head>
<body>

<!-- ═══════════════════════════════════════════════════════
     CONTINUOUS FLOW SECTION
═══════════════════════════════════════════════════════ -->
<section class="flow-section" id="flow">

  <!-- Background layers -->
  <div class="flow-bg"></div>
  <div class="flow-parallax-slow">
    <div class="par-orb po1"></div>
    <div class="par-orb po2"></div>
    <div class="par-orb po3"></div>
  </div>
  <div class="flow-grid"></div>
  <div class="flow-fade-top"></div>
  <div class="flow-fade-bot"></div>
  <div class="flow-mask-left"></div>
  <div class="flow-mask-right"></div>

  <!-- Header -->
  <div class="flow-header">
    <div class="flow-eyebrow reveal">
      <span class="flow-eyebrow-line"></span>
      Everything you need
      <span class="flow-eyebrow-line"></span>
    </div>
    <h2 class="flow-title reveal d1">
      Built for every layer<br/>of <span class="gt">your business</span>
    </h2>
    <p class="flow-sub reveal d2">
      AIBMS replaces your scattered stack with one AI-native layer — automation, intelligence, and action, unified.
    </p>
  </div>

  <!-- ═══ LANES ═══ -->
  <div class="flow-lanes">

    <!-- ── LANE 1: Features → moving left, normal speed ── -->
    <div class="flow-lane" id="lane1">
      <div class="flow-track" data-dir="-1" data-speed="0.22">

        <!-- Original set -->
        <div class="fc c-blue">
          <div class="fc-icon ib-blue">⚡</div>
          <div class="fc-text"><div class="fc-name">Workflow Automation</div><div class="fc-desc">300+ integrations, zero-code, AI-triggered actions</div></div>
        </div>
        <div class="fc c-violet">
          <div class="fc-icon ib-violet">🎯</div>
          <div class="fc-text"><div class="fc-name">Lead Scoring AI</div><div class="fc-desc">Score every lead 0–100 using real-time signals</div></div>
        </div>
        <div class="fc c-cyan">
          <div class="fc-icon ib-cyan">📊</div>
          <div class="fc-text"><div class="fc-name">Live Dashboard</div><div class="fc-desc">Every KPI in one glanceable, AI-summarised view</div></div>
        </div>
        <div class="fc c-pink">
          <div class="fc-icon ib-pink">💬</div>
          <div class="fc-text"><div class="fc-name">AI Chatbot</div><div class="fc-desc">Query CRM, trigger automations, get answers instantly</div></div>
        </div>
        <div class="fc c-teal">
          <div class="fc-icon ib-teal">🛡</div>
          <div class="fc-text"><div class="fc-name">SOC2 Security</div><div class="fc-desc">Enterprise-grade, end-to-end encrypted by default</div></div>
        </div>
        <div class="fc c-amber">
          <div class="fc-icon ib-amber">🔮</div>
          <div class="fc-text"><div class="fc-name">Revenue Forecast</div><div class="fc-desc">AI predicts Q4 close rates with confidence intervals</div></div>
        </div>
        <div class="fc c-purple">
          <div class="fc-icon ib-purple">🎙️</div>
          <div class="fc-text"><div class="fc-name">Voice Agent</div><div class="fc-desc">Run full BMS workflows hands-free, under 300ms latency</div></div>
        </div>
        <div class="fc c-rose">
          <div class="fc-icon ib-rose">⚠️</div>
          <div class="fc-text"><div class="fc-name">Anomaly Detection</div><div class="fc-desc">Flags revenue risk before it hits your bottom line</div></div>
        </div>
        <div class="fc c-emerald">
          <div class="fc-icon ib-emerald">🤝</div>
          <div class="fc-text"><div class="fc-name">Team Collaboration</div><div class="fc-desc">Shared dashboards, AI-assisted threads, real-time alerts</div></div>
        </div>
        <div class="fc c-blue">
          <div class="fc-icon ib-blue">📋</div>
          <div class="fc-text"><div class="fc-name">Smart Reports</div><div class="fc-desc">AI-written weekly briefs — board-ready in one click</div></div>
        </div>
        <div class="fc c-cyan">
          <div class="fc-icon ib-cyan">🔗</div>
          <div class="fc-text"><div class="fc-name">300+ Integrations</div><div class="fc-desc">Slack, Gmail, HubSpot, Stripe, Notion and more</div></div>
        </div>

        <!-- Duplicate for seamless loop -->
        <div class="fc c-blue">
          <div class="fc-icon ib-blue">⚡</div>
          <div class="fc-text"><div class="fc-name">Workflow Automation</div><div class="fc-desc">300+ integrations, zero-code, AI-triggered actions</div></div>
        </div>
        <div class="fc c-violet">
          <div class="fc-icon ib-violet">🎯</div>
          <div class="fc-text"><div class="fc-name">Lead Scoring AI</div><div class="fc-desc">Score every lead 0–100 using real-time signals</div></div>
        </div>
        <div class="fc c-cyan">
          <div class="fc-icon ib-cyan">📊</div>
          <div class="fc-text"><div class="fc-name">Live Dashboard</div><div class="fc-desc">Every KPI in one glanceable, AI-summarised view</div></div>
        </div>
        <div class="fc c-pink">
          <div class="fc-icon ib-pink">💬</div>
          <div class="fc-text"><div class="fc-name">AI Chatbot</div><div class="fc-desc">Query CRM, trigger automations, get answers instantly</div></div>
        </div>
        <div class="fc c-teal">
          <div class="fc-icon ib-teal">🛡</div>
          <div class="fc-text"><div class="fc-name">SOC2 Security</div><div class="fc-desc">Enterprise-grade, end-to-end encrypted by default</div></div>
        </div>
        <div class="fc c-amber">
          <div class="fc-icon ib-amber">🔮</div>
          <div class="fc-text"><div class="fc-name">Revenue Forecast</div><div class="fc-desc">AI predicts Q4 close rates with confidence intervals</div></div>
        </div>
        <div class="fc c-purple">
          <div class="fc-icon ib-purple">🎙️</div>
          <div class="fc-text"><div class="fc-name">Voice Agent</div><div class="fc-desc">Run full BMS workflows hands-free, under 300ms latency</div></div>
        </div>
        <div class="fc c-rose">
          <div class="fc-icon ib-rose">⚠️</div>
          <div class="fc-text"><div class="fc-name">Anomaly Detection</div><div class="fc-desc">Flags revenue risk before it hits your bottom line</div></div>
        </div>
        <div class="fc c-emerald">
          <div class="fc-icon ib-emerald">🤝</div>
          <div class="fc-text"><div class="fc-name">Team Collaboration</div><div class="fc-desc">Shared dashboards, AI-assisted threads, real-time alerts</div></div>
        </div>
        <div class="fc c-blue">
          <div class="fc-icon ib-blue">📋</div>
          <div class="fc-text"><div class="fc-name">Smart Reports</div><div class="fc-desc">AI-written weekly briefs — board-ready in one click</div></div>
        </div>
        <div class="fc c-cyan">
          <div class="fc-icon ib-cyan">🔗</div>
          <div class="fc-text"><div class="fc-name">300+ Integrations</div><div class="fc-desc">Slack, Gmail, HubSpot, Stripe, Notion and more</div></div>
        </div>

      </div>
    </div>

    <!-- ── LANE 2: Stats + Quotes → moving RIGHT (opposite direction) ── -->
    <div class="flow-lane" id="lane2">
      <div class="flow-track" data-dir="1" data-speed="0.17">

        <!-- Original -->
        <div class="fc stat c-violet" style="--num-grad:linear-gradient(135deg,#a5c8ff,#d4b5ff)">
          <div class="fc-stat-num">98.4%</div>
          <div class="fc-stat-label">Automation rate within 30 days</div>
        </div>
        <div class="fc quote c-blue">
          <div class="fc-quote-text">"We replaced 4 tools with AIBMS. The pipeline forecasting alone saved us $200K in missed deals."</div>
          <div class="fc-quote-author">
            <div class="fc-avatar" style="background:linear-gradient(135deg,#4C6EF5,#9333EA)">AK</div>
            <div><div class="fc-author-name">Alex Kim</div><div class="fc-author-role">VP Sales, NexusAI</div></div>
          </div>
        </div>
        <div class="fc stat c-pink" style="--num-grad:linear-gradient(135deg,#fca5c8,#d4b5ff)">
          <div class="fc-stat-num">+31%</div>
          <div class="fc-stat-label">Avg revenue lift in 6 months</div>
        </div>
        <div class="fc pill-card c-cyan">
          <div class="fc-pill-icon">🏆</div>
          <div class="fc-pill-label">G2 Leader — AI Business Tools 2025</div>
        </div>
        <div class="fc quote c-purple">
          <div class="fc-quote-text">"The voice agent is genuinely magic. I brief my entire team hands-free on my morning commute."</div>
          <div class="fc-quote-author">
            <div class="fc-avatar" style="background:linear-gradient(135deg,#9333EA,#EC4899)">MR</div>
            <div><div class="fc-author-name">Mia Reyes</div><div class="fc-author-role">CEO, CloudSpark</div></div>
          </div>
        </div>
        <div class="fc stat c-teal" style="--num-grad:linear-gradient(135deg,#6ee7b7,#a5c8ff)">
          <div class="fc-stat-num">300+</div>
          <div class="fc-stat-label">Native integrations built in</div>
        </div>
        <div class="fc pill-card c-amber">
          <div class="fc-pill-icon">⚡</div>
          <div class="fc-pill-label">Live in under 1 hour, no engineers needed</div>
        </div>
        <div class="fc quote c-rose">
          <div class="fc-quote-text">"AIBMS caught a $90K deal going cold that our team had missed. That's ROI on day one."</div>
          <div class="fc-quote-author">
            <div class="fc-avatar" style="background:linear-gradient(135deg,#F43F5E,#F59E0B)">JP</div>
            <div><div class="fc-author-name">Jake Park</div><div class="fc-author-role">Head of Revenue, StarkMed</div></div>
          </div>
        </div>
        <div class="fc stat c-emerald" style="--num-grad:linear-gradient(135deg,#6ee7b7,#22d3ee)">
          <div class="fc-stat-num">99.9%</div>
          <div class="fc-stat-label">Uptime SLA, enterprise-grade</div>
        </div>
        <div class="fc pill-card c-violet">
          <div class="fc-pill-icon">🔒</div>
          <div class="fc-pill-label">SOC2 Certified · GDPR Compliant</div>
        </div>
        <div class="fc stat c-blue" style="--num-grad:linear-gradient(135deg,#93c5fd,#6ee7b7)">
          <div class="fc-stat-num">14.2h</div>
          <div class="fc-stat-label">Manual work saved per team per day</div>
        </div>

        <!-- Duplicate -->
        <div class="fc stat c-violet" style="--num-grad:linear-gradient(135deg,#a5c8ff,#d4b5ff)">
          <div class="fc-stat-num">98.4%</div>
          <div class="fc-stat-label">Automation rate within 30 days</div>
        </div>
        <div class="fc quote c-blue">
          <div class="fc-quote-text">"We replaced 4 tools with AIBMS. The pipeline forecasting alone saved us $200K in missed deals."</div>
          <div class="fc-quote-author">
            <div class="fc-avatar" style="background:linear-gradient(135deg,#4C6EF5,#9333EA)">AK</div>
            <div><div class="fc-author-name">Alex Kim</div><div class="fc-author-role">VP Sales, NexusAI</div></div>
          </div>
        </div>
        <div class="fc stat c-pink" style="--num-grad:linear-gradient(135deg,#fca5c8,#d4b5ff)">
          <div class="fc-stat-num">+31%</div>
          <div class="fc-stat-label">Avg revenue lift in 6 months</div>
        </div>
        <div class="fc pill-card c-cyan">
          <div class="fc-pill-icon">🏆</div>
          <div class="fc-pill-label">G2 Leader — AI Business Tools 2025</div>
        </div>
        <div class="fc quote c-purple">
          <div class="fc-quote-text">"The voice agent is genuinely magic. I brief my entire team hands-free on my morning commute."</div>
          <div class="fc-quote-author">
            <div class="fc-avatar" style="background:linear-gradient(135deg,#9333EA,#EC4899)">MR</div>
            <div><div class="fc-author-name">Mia Reyes</div><div class="fc-author-role">CEO, CloudSpark</div></div>
          </div>
        </div>
        <div class="fc stat c-teal" style="--num-grad:linear-gradient(135deg,#6ee7b7,#a5c8ff)">
          <div class="fc-stat-num">300+</div>
          <div class="fc-stat-label">Native integrations built in</div>
        </div>
        <div class="fc pill-card c-amber">
          <div class="fc-pill-icon">⚡</div>
          <div class="fc-pill-label">Live in under 1 hour, no engineers needed</div>
        </div>
        <div class="fc quote c-rose">
          <div class="fc-quote-text">"AIBMS caught a $90K deal going cold that our team had missed. That's ROI on day one."</div>
          <div class="fc-quote-author">
            <div class="fc-avatar" style="background:linear-gradient(135deg,#F43F5E,#F59E0B)">JP</div>
            <div><div class="fc-author-name">Jake Park</div><div class="fc-author-role">Head of Revenue, StarkMed</div></div>
          </div>
        </div>
        <div class="fc stat c-emerald" style="--num-grad:linear-gradient(135deg,#6ee7b7,#22d3ee)">
          <div class="fc-stat-num">99.9%</div>
          <div class="fc-stat-label">Uptime SLA, enterprise-grade</div>
        </div>
        <div class="fc pill-card c-violet">
          <div class="fc-pill-icon">🔒</div>
          <div class="fc-pill-label">SOC2 Certified · GDPR Compliant</div>
        </div>
        <div class="fc stat c-blue" style="--num-grad:linear-gradient(135deg,#93c5fd,#6ee7b7)">
          <div class="fc-stat-num">14.2h</div>
          <div class="fc-stat-label">Manual work saved per team per day</div>
        </div>

      </div>
    </div>

    <!-- ── LANE 3: Use cases → moving left, slow ── -->
    <div class="flow-lane" id="lane3">
      <div class="flow-track" data-dir="-1" data-speed="0.13">

        <!-- Original -->
        <div class="fc pill-card c-blue">
          <div class="fc-pill-icon">📈</div>
          <div class="fc-pill-label">Scale from Seed to Series B without re-tooling</div>
        </div>
        <div class="fc c-violet">
          <div class="fc-icon ib-violet">🌍</div>
          <div class="fc-text"><div class="fc-name">Global Expansion</div><div class="fc-desc">Multi-region CRM, currencies, and compliance built in</div></div>
        </div>
        <div class="fc pill-card c-pink">
          <div class="fc-pill-icon">🤖</div>
          <div class="fc-pill-label">GPT-4o + Claude 3.5 dual-model intelligence</div>
        </div>
        <div class="fc c-cyan">
          <div class="fc-icon ib-cyan">📱</div>
          <div class="fc-text"><div class="fc-name">Mobile-First</div><div class="fc-desc">Full BMS access from iPhone, Android, or voice</div></div>
        </div>
        <div class="fc pill-card c-teal">
          <div class="fc-pill-icon">🔄</div>
          <div class="fc-pill-label">Replaces: HubSpot + Zapier + Tableau + Intercom</div>
        </div>
        <div class="fc c-amber">
          <div class="fc-icon ib-amber">📅</div>
          <div class="fc-text"><div class="fc-name">Daily AI Briefings</div><div class="fc-desc">Business summary delivered before you open your laptop</div></div>
        </div>
        <div class="fc pill-card c-rose">
          <div class="fc-pill-icon">⏱</div>
          <div class="fc-pill-label">Setup in under 1 hour — no engineers required</div>
        </div>
        <div class="fc c-emerald">
          <div class="fc-icon ib-emerald">🧠</div>
          <div class="fc-text"><div class="fc-name">Learns Your Business</div><div class="fc-desc">AI builds a unique model of your ops in minutes</div></div>
        </div>
        <div class="fc pill-card c-purple">
          <div class="fc-pill-icon">🎯</div>
          <div class="fc-pill-label">No credit card · 14-day free trial · Cancel anytime</div>
        </div>
        <div class="fc c-blue">
          <div class="fc-icon ib-blue">💡</div>
          <div class="fc-text"><div class="fc-name">Proactive Intelligence</div><div class="fc-desc">Surfaces opportunities before you know to ask</div></div>
        </div>

        <!-- Duplicate -->
        <div class="fc pill-card c-blue">
          <div class="fc-pill-icon">📈</div>
          <div class="fc-pill-label">Scale from Seed to Series B without re-tooling</div>
        </div>
        <div class="fc c-violet">
          <div class="fc-icon ib-violet">🌍</div>
          <div class="fc-text"><div class="fc-name">Global Expansion</div><div class="fc-desc">Multi-region CRM, currencies, and compliance built in</div></div>
        </div>
        <div class="fc pill-card c-pink">
          <div class="fc-pill-icon">🤖</div>
          <div class="fc-pill-label">GPT-4o + Claude 3.5 dual-model intelligence</div>
        </div>
        <div class="fc c-cyan">
          <div class="fc-icon ib-cyan">📱</div>
          <div class="fc-text"><div class="fc-name">Mobile-First</div><div class="fc-desc">Full BMS access from iPhone, Android, or voice</div></div>
        </div>
        <div class="fc pill-card c-teal">
          <div class="fc-pill-icon">🔄</div>
          <div class="fc-pill-label">Replaces: HubSpot + Zapier + Tableau + Intercom</div>
        </div>
        <div class="fc c-amber">
          <div class="fc-icon ib-amber">📅</div>
          <div class="fc-text"><div class="fc-name">Daily AI Briefings</div><div class="fc-desc">Business summary delivered before you open your laptop</div></div>
        </div>
        <div class="fc pill-card c-rose">
          <div class="fc-pill-icon">⏱</div>
          <div class="fc-pill-label">Setup in under 1 hour — no engineers required</div>
        </div>
        <div class="fc c-emerald">
          <div class="fc-icon ib-emerald">🧠</div>
          <div class="fc-text"><div class="fc-name">Learns Your Business</div><div class="fc-desc">AI builds a unique model of your ops in minutes</div></div>
        </div>
        <div class="fc pill-card c-purple">
          <div class="fc-pill-icon">🎯</div>
          <div class="fc-pill-label">No credit card · 14-day free trial · Cancel anytime</div>
        </div>
        <div class="fc c-blue">
          <div class="fc-icon ib-blue">💡</div>
          <div class="fc-text"><div class="fc-name">Proactive Intelligence</div><div class="fc-desc">Surfaces opportunities before you know to ask</div></div>
        </div>

      </div>
    </div>

  </div><!-- /flow-lanes -->

</section>

<script>
/* ═══════════════════════════════════════════════════════════
   SCROLL REVEAL
═══════════════════════════════════════════════════════════ */
const revIO = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('vis'); revIO.unobserve(e.target); }
  });
}, { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach(el => revIO.observe(el));

/* ═══════════════════════════════════════════════════════════
   PARALLAX
═══════════════════════════════════════════════════════════ */
const parallaxLayer = document.querySelector('.flow-parallax-slow');
const section       = document.getElementById('flow');
function updateParallax() {
  const rect   = section.getBoundingClientRect();
  const centre = rect.top + rect.height * 0.5;
  const offset = (window.innerHeight * 0.5 - centre) * 0.18;
  parallaxLayer.style.transform = \`translateY(\${offset}px)\`;
}
window.addEventListener('scroll', updateParallax, { passive: true });
updateParallax();

/* ═══════════════════════════════════════════════════════════
   SEAMLESS MARQUEE ENGINE
   ─────────────────────────────────────────────────────────
   Core idea:
   Each track holds EXACTLY 2 copies of its content.
   We measure halfWidth = scrollWidth / 2 (the exact width
   of one copy, including gaps).

   Each frame we add \`speed * dir * dt\` pixels to \`pos\`.
   When |pos| >= halfWidth, we snap back by halfWidth.
   Because the second copy is pixel-identical to the first,
   this is invisible — no flash, no jump.

   Key properties that prevent breaks:
   1. We use \`transform: translate3d(px,0,0)\` — pure GPU,
      no layout, no paint.
   2. \`dt\` is capped at 50ms so tab-switching never causes
      a large jump.
   3. Each lane has its own \`paused\` flag that lerps speed
      to 0 on hover and back on leave — no hard start/stop.
   4. We skip frames when the section is off-screen
      (IntersectionObserver) to save battery.
═══════════════════════════════════════════════════════════ */

const LERP_FACTOR   = 0.10; // speed lerp toward target (higher = snappier response)

/* Build lane descriptors from DOM */
const lanes = [...document.querySelectorAll('.flow-track')].map(track => {
  const dir   = parseInt(track.dataset.dir   || '-1', 10); // -1 = left, +1 = right
  const speed = parseFloat(track.dataset.speed || '0.35');  // pixels per ms

  return {
    el:        track,
    dir,
    speed,
    pos:       dir === 1 ? 0 : 0, // starting position (px)
    halfWidth: 0,                  // measured after first paint
    hovered:   false,
    curSpeed:  speed,              // current lerped speed (0 when paused)
  };
});

/* Measure half-widths after layout */
function measureLanes() {
  lanes.forEach(lane => {
    // scrollWidth is always the full double-set width
    lane.halfWidth = lane.el.scrollWidth / 2;
    // For rightward lanes, start at the halfway point so the
    // initial position looks identical to the leftward lanes
    if (lane.dir === 1) lane.pos = -lane.halfWidth;
  });
}

/* Hover pause — lerp to 0, then back to full speed */
document.querySelectorAll('.flow-lane').forEach((laneEl, i) => {
  const lane = lanes[i];
  laneEl.addEventListener('mouseenter', () => { lane.hovered = true; });
  laneEl.addEventListener('mouseleave', () => { lane.hovered = false; });
});

/* Visibility tracking — skip when off-screen */
let sectionVisible = false;
const visIO = new IntersectionObserver(entries => {
  sectionVisible = entries[0].isIntersecting;
}, { threshold: 0 });
visIO.observe(section);

/* ── Main rAF loop ── */
let lastTime = null;

function tick(now) {
  requestAnimationFrame(tick);

  if (!sectionVisible) { lastTime = null; return; }

  if (lastTime === null) { lastTime = now; return; }
  const rawDt = now - lastTime;
  lastTime = now;

  // Cap delta to 50ms so tab-switch / lag doesn't cause a jump
  const dt = Math.min(rawDt, 50);

  lanes.forEach(lane => {
    // Lerp speed toward target (0 if hovered, full speed otherwise)
    const targetSpeed = lane.hovered ? 0 : lane.speed;
    lane.curSpeed += (targetSpeed - lane.curSpeed) * LERP_FACTOR;

    // Advance position
    lane.pos += lane.curSpeed * lane.dir * dt;

    // Wrap — pixel-perfect snap using measured halfWidth
    if (lane.halfWidth > 0) {
      if (lane.pos <= -lane.halfWidth) lane.pos += lane.halfWidth;
      if (lane.pos >= 0)              lane.pos -= lane.halfWidth;
    }

    // Apply via translate3d — GPU composited, no layout
    lane.el.style.transform = \`translate3d(\${lane.pos}px, 0, 0)\`;
  });
}

/* Init after fonts + layout settle */
window.addEventListener('load', () => {
  measureLanes();
  window.addEventListener('resize', measureLanes);
  requestAnimationFrame(tick);
});

/* ═══════════════════════════════════════════════════════════
   CARD SIBLING DIM on hover
═══════════════════════════════════════════════════════════ */
document.querySelectorAll('.flow-lane').forEach(lane => {
  const cards = lane.querySelectorAll('.fc');
  cards.forEach(card => {
    card.addEventListener('mouseenter', () => {
      cards.forEach(c => { if (c !== card) c.style.opacity = '.48'; });
    });
    card.addEventListener('mouseleave', () => {
      cards.forEach(c => { c.style.opacity = ''; });
    });
  });
});
</script>
</body>
</html>
`;
const SHOWCASE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>AIBMS — Product Showcase</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700;12..96,800&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet"/>
<style>

/* ─────────────────────────────────────────────────────────
   BASE
───────────────────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; }
body {
  font-family: 'DM Sans', sans-serif;
  background: #05060f;
  color: #fff;
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
}

/* ─────────────────────────────────────────────────────────
   DESIGN TOKENS
───────────────────────────────────────────────────────── */
:root {
  --blue:   #4C6EF5;
  --violet: #7C3AED;
  --purple: #9333EA;
  --pink:   #EC4899;
  --cyan:   #06B6D4;
  --emerald:#10B981;

  --g-primary: linear-gradient(135deg, #4C6EF5 0%, #9333EA 55%, #EC4899 100%);
  --g-subtle:  linear-gradient(135deg, rgba(76,110,245,.15) 0%, rgba(147,51,234,.15) 100%);
  --g-text:    linear-gradient(135deg, #a5c8ff 0%, #d4b5ff 50%, #fca5c8 100%);

  --surface:  rgba(255,255,255,.04);
  --border:   rgba(255,255,255,.08);
  --border-hi:rgba(255,255,255,.14);

  --ease-out:    cubic-bezier(.25, 1, .5, 1);
  --ease-spring: cubic-bezier(.34, 1.4, .64, 1);
  --ease-in-out: cubic-bezier(.4, 0, .25, 1);
}

/* ─────────────────────────────────────────────────────────
   SECTION SHELL
───────────────────────────────────────────────────────── */
.showcase {
  position: relative;
  padding: 120px 0 140px;
  overflow: hidden;
}

/* Ambient background — mesh glow */
.showcase-bg {
  position: absolute; inset: 0; z-index: 0; pointer-events: none;
  background:
    radial-gradient(ellipse 65% 55% at 12% 48%, rgba(76,110,245,.16) 0%, transparent 60%),
    radial-gradient(ellipse 55% 65% at 88% 38%, rgba(147,51,234,.15) 0%, transparent 60%),
    radial-gradient(ellipse 50% 50% at 50% 92%, rgba(236,72,153,.11) 0%, transparent 55%),
    radial-gradient(ellipse 40% 40% at 70% 15%, rgba(6,182,212,.07)  0%, transparent 55%);
  animation: bg-breathe 12s ease-in-out infinite alternate;
}
@keyframes bg-breathe {
  0%   { opacity: .8;  filter: hue-rotate(0deg); }
  100% { opacity: 1;   filter: hue-rotate(14deg); }
}

/* Top + bottom fades to blend with adjacent sections */
.showcase::before,
.showcase::after {
  content: ''; position: absolute; left: 0; right: 0; height: 120px; z-index: 1; pointer-events: none;
}
.showcase::before { top: 0;    background: linear-gradient(to bottom, #05060f, transparent); }
.showcase::after  { bottom: 0; background: linear-gradient(to top,    #05060f, transparent); }

/* Fine grid */
.showcase-grid-lines {
  position: absolute; inset: 0; z-index: 0; pointer-events: none;
  background-image:
    linear-gradient(rgba(255,255,255,.032) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,.032) 1px, transparent 1px);
  background-size: 80px 80px;
  mask-image: radial-gradient(ellipse 90% 75% at 50% 50%, black 20%, transparent 80%);
}

.showcase-inner {
  position: relative; z-index: 2;
  max-width: 1180px; margin: 0 auto; padding: 0 48px;
}

/* ─────────────────────────────────────────────────────────
   SECTION HEADER
───────────────────────────────────────────────────────── */
.section-header {
  text-align: center;
  margin-bottom: 64px;
}
.section-eyebrow {
  display: inline-flex; align-items: center; gap: 9px;
  font-size: .72rem; font-weight: 600; text-transform: uppercase;
  letter-spacing: .14em; color: rgba(255,255,255,.4);
  margin-bottom: 18px;
}
.eyebrow-line {
  width: 28px; height: 1.5px;
  background: var(--g-primary);
  border-radius: 2px;
  opacity: .7;
}
.section-title {
  font-family: 'Bricolage Grotesque', sans-serif;
  font-size: clamp(2rem, 4vw, 3.2rem);
  font-weight: 800; letter-spacing: -.04em;
  line-height: 1.12; color: #fff;
  margin-bottom: 16px;
}
.section-title .grad {
  background: linear-gradient(135deg, #a5c8ff 0%, #d4b5ff 50%, #fca5c8 100%);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  background-clip: text;
  filter: drop-shadow(0 0 20px rgba(147,51,234,.35));
}
.section-sub {
  font-size: 1rem; font-weight: 300;
  color: rgba(255,255,255,.52); line-height: 1.72;
  max-width: 520px; margin: 0 auto;
}

/* ─────────────────────────────────────────────────────────
   TAB NAV
───────────────────────────────────────────────────────── */
.tab-nav {
  display: flex; align-items: center; justify-content: center;
  gap: 4px; margin-bottom: 56px;
  background: rgba(255,255,255,.04);
  border: 1px solid var(--border);
  border-radius: 14px; padding: 5px;
  width: fit-content; margin: 0 auto 56px;
  backdrop-filter: blur(12px);
  position: relative;
}

/* sliding highlight behind active tab */
.tab-btn.active{background:rgba(255,255,255,.08);border-radius:10px;border:1px solid rgba(255,255,255,.1);}

.tab-btn {
  position: relative; z-index: 1;
  display: flex; align-items: center; gap: 8px;
  padding: 10px 22px; border-radius: 10px;
  border: none; background: none; cursor: pointer;
  font-family: 'DM Sans', sans-serif;
  font-size: .84rem; font-weight: 500;
  color: rgba(255,255,255,.45);
  white-space: nowrap;
  transition: color .38s var(--ease-out);
  user-select: none;
}
.tab-btn .tab-icon {
  font-size: 1rem; line-height: 1;
  transition: transform .38s var(--ease-spring);
}
.tab-btn:hover { color: rgba(255,255,255,.75); }
.tab-btn:hover .tab-icon { transform: scale(1.14); }
.tab-btn.active { color: #fff; }

/* Animated underline on active */
.tab-btn::after {
  content: '';
  position: absolute; bottom: 4px; left: 22px; right: 22px;
  height: 1.5px; border-radius: 2px;
  background: var(--g-primary);
  transform: scaleX(0); transform-origin: left;
  transition: transform .52s var(--ease-out);
  opacity: .8;
}
.tab-btn.active::after { transform: scaleX(1); }

/* ─────────────────────────────────────────────────────────
   SLIDER VIEWPORT
───────────────────────────────────────────────────────── */
.slider-viewport {
  position: relative;
  overflow: hidden;
  border-radius: 24px;
}

/* The sliding track — contains all slides side by side */
.slider-track {
  display: flex;
  will-change: transform;
  transition: transform .88s cubic-bezier(.25, 1, .5, 1);
}

/* ─────────────────────────────────────────────────────────
   SINGLE SLIDE
───────────────────────────────────────────────────────── */
.slide {
  width: 100%; flex-shrink: 0;
  display: grid;
  grid-template-columns: 1fr 1.08fr;
  gap: 0;
  min-height: 540px;
  /* Richer dark background with a subtle top-left colour bleed */
  background:
    radial-gradient(ellipse 60% 50% at 0% 0%, rgba(76,110,245,.07) 0%, transparent 60%),
    rgba(12, 10, 28, .92);
  border-radius: 24px;
  overflow: hidden;
  position: relative;
  /* Gradient border via box-shadow outline — no bleed */
  box-shadow:
    0 0 0 1px rgba(255,255,255,.09),
    0 24px 64px rgba(0,0,0,.55),
    0 4px 16px rgba(0,0,0,.3);
}

/* Per-slide accent line — thicker + glow */
.slide::before {
  content: ''; position: absolute;
  top: 0; left: 0; right: 0; height: 2px;
  background: var(--accent-grad);
  z-index: 2;
  box-shadow: 0 0 18px var(--accent-glow, rgba(147,51,234,.5)),
              0 0 40px var(--accent-glow, rgba(147,51,234,.25));
}

/* ── LEFT: text pane ── */
.slide-text {
  padding: 60px 56px 56px;
  display: flex; flex-direction: column;
  justify-content: center;
  position: relative;
  border-right: 1px solid var(--border);
}

/* Glow orb behind text — crisper, more present */
.slide-text::before {
  content: ''; position: absolute;
  top: -80px; left: -80px;
  width: 360px; height: 360px;
  border-radius: 50%;
  background: var(--accent-orb);
  filter: blur(55px);
  pointer-events: none; z-index: 0;
  opacity: .55;
  transition: opacity .6s;
}

.slide-chip {
  display: inline-flex; align-items: center; gap: 7px;
  font-size: .68rem; font-weight: 700;
  text-transform: uppercase; letter-spacing: .1em;
  color: var(--chip-color, #A78BFA);
  background: var(--chip-bg, rgba(167,139,250,.12));
  border: 1px solid var(--chip-border, rgba(167,139,250,.28));
  border-radius: 100px; padding: 5px 14px;
  margin-bottom: 22px;
  width: fit-content;
  position: relative; z-index: 1;
  box-shadow: 0 0 18px var(--chip-bg, rgba(167,139,250,.08));
}
.chip-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: currentColor;
  box-shadow: 0 0 6px currentColor;
  animation: chip-pulse 2s ease-in-out infinite;
}
@keyframes chip-pulse { 0%,100%{opacity:1}50%{opacity:.4} }

.slide-h {
  font-family: 'Bricolage Grotesque', sans-serif;
  font-size: clamp(1.5rem, 2.4vw, 2.1rem);
  font-weight: 800; letter-spacing: -.04em;
  line-height: 1.15; color: #fff;
  margin-bottom: 16px;
  position: relative; z-index: 1;
}
.slide-h .hl {
  background: var(--g-text);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  background-clip: text;
  filter: drop-shadow(0 0 16px rgba(147,51,234,.4));
}

.slide-p {
  font-size: .9rem; font-weight: 300;
  color: rgba(255,255,255,.55); line-height: 1.72;
  margin-bottom: 32px;
  position: relative; z-index: 1;
}

/* Feature bullet list */
.slide-features {
  list-style: none;
  display: flex; flex-direction: column; gap: 11px;
  position: relative; z-index: 1;
}
.slide-features li {
  display: flex; align-items: flex-start; gap: 10px;
  font-size: .84rem; color: rgba(255,255,255,.55); line-height: 1.5;
}
.feat-check {
  width: 18px; height: 18px; min-width: 18px; min-height: 18px;
  border-radius: 50%;
  background: var(--chip-bg, rgba(167,139,250,.1));
  border: 1px solid var(--chip-border, rgba(167,139,250,.22));
  display: flex; align-items: center; justify-content: center;
  margin-top: 1px;
}
.feat-check svg { display: block; }

.slide-cta {
  margin-top: 36px;
  display: inline-flex; align-items: center; gap: 9px;
  font-size: .88rem; font-weight: 600;
  color: rgba(255,255,255,.7);
  background: rgba(255,255,255,.06);
  border: 1px solid var(--border-hi);
  border-radius: 100px; padding: 11px 24px;
  text-decoration: none; width: fit-content;
  position: relative; z-index: 1;
  transition:
    color       .38s var(--ease-out),
    border-color .38s var(--ease-out),
    background  .38s var(--ease-out),
    box-shadow  .38s var(--ease-out),
    transform   .38s var(--ease-spring);
}
.slide-cta:hover {
  color: #fff;
  border-color: rgba(255,255,255,.26);
  background: rgba(255,255,255,.1);
  box-shadow: 0 0 28px rgba(147,51,234,.12);
  transform: translateY(-1px);
}
.slide-cta svg { transition: transform .38s var(--ease-spring); }
.slide-cta:hover svg { transform: translateX(5px); }

/* ── RIGHT: visual pane ── */
.slide-visual {
  position: relative;
  background:
    radial-gradient(ellipse 70% 60% at 80% 20%, rgba(147,51,234,.08) 0%, transparent 60%),
    rgba(4, 3, 14, .7);
  display: flex; align-items: center; justify-content: center;
  padding: 36px;
  overflow: hidden;
}

/* Ambient glow inside visual pane — crisper */
.slide-visual::before {
  content: ''; position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: 75%; height: 75%;
  background: var(--accent-orb);
  filter: blur(48px);
  opacity: .25;
  border-radius: 50%;
  pointer-events: none;
}

/* ─────────────────────────────────────────────────────────
   MOCKUP WINDOWS
───────────────────────────────────────────────────────── */
.mockup {
  width: 100%; max-width: 460px;
  background: rgba(11, 8, 28, .97);
  border: 1px solid rgba(255,255,255,.13);
  border-radius: 16px;
  overflow: hidden;
  /* No backdrop-filter — it was causing blurriness */
  box-shadow:
    0 0 0 1px rgba(255,255,255,.06),
    0 2px 0 rgba(255,255,255,.05) inset,
    0 32px 72px rgba(0,0,0,.7),
    0 8px 24px rgba(0,0,0,.4),
    0 0 48px rgba(147,51,234,.12);
  position: relative; z-index: 1;
}
.mockup::before {
  content: ''; position: absolute;
  top: 0; left: 0; right: 0; height: 1.5px;
  background: var(--accent-grad);
}
.m-bar {
  height: 38px;
  background: rgba(255,255,255,.028);
  border-bottom: 1px solid rgba(255,255,255,.08);
  display: flex; align-items: center; gap: 6px; padding: 0 14px;
}
.m-dot { width: 9px; height: 9px; border-radius: 50%; }
.m-dot.r{background:#FF5F57}.m-dot.y{background:#FEBC2E}.m-dot.g{background:#28C840}
.m-url {
  margin-left: auto; margin-right: auto;
  font-size: .62rem; color: rgba(255,255,255,.28);
  background: rgba(255,255,255,.04); border-radius: 5px;
  padding: 2px 14px; font-family: monospace; letter-spacing: .03em;
}
.m-body { padding: 18px 20px; }

/* ── Mockup: Dashboard ── */
.mk-kpis { display: grid; grid-template-columns: repeat(3,1fr); gap: 8px; margin-bottom: 14px; }
.mk-kpi {
  background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.07);
  border-radius: 9px; padding: 11px 13px; position: relative; overflow: hidden;
}
.mk-kpi::before {
  content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
}
.mk-kpi.b::before{background:linear-gradient(90deg,#4C6EF5,#7C3AED)}
.mk-kpi.p::before{background:linear-gradient(90deg,#9333EA,#EC4899)}
.mk-kpi.c::before{background:linear-gradient(90deg,#06B6D4,#4C6EF5)}
.mk-kpi-l{font-size:.58rem;color:rgba(255,255,255,.35);text-transform:uppercase;letter-spacing:.07em;margin-bottom:5px}
.mk-kpi-v{font-size:1.1rem;font-weight:800;color:#fff;letter-spacing:-.03em;line-height:1}
.mk-kpi-d{font-size:.6rem;margin-top:4px;font-weight:600;color:#34D399}
.mk-chart {
  background: rgba(255,255,255,.025); border: 1px solid rgba(255,255,255,.06);
  border-radius: 9px; padding: 12px 14px;
}
.mk-chart-lbl{font-size:.58rem;color:rgba(255,255,255,.3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px}
.mk-bars{display:flex;align-items:flex-end;gap:5px;height:54px}
.mk-bar{flex:1;border-radius:3px 3px 0 0;background:linear-gradient(to top,#4C6EF5,#9333EA);opacity:.65;transition:opacity .2s}
.mk-bar:hover{opacity:1}

/* ── Mockup: Pipeline ── */
.mk-pipe { display: flex; flex-direction: column; gap: 7px; }
.mk-deal {
  display: flex; justify-content: space-between; align-items: center;
  padding: 9px 12px; background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.06); border-radius: 8px;
  transition: border-color .35s var(--ease-out), transform .35s var(--ease-spring);
}
.mk-deal:hover{border-color:rgba(147,51,234,.3);transform:translateX(4px)}
.mk-deal-name{font-size:.76rem;font-weight:600;color:#fff}
.mk-deal-val{font-size:.65rem;color:rgba(255,255,255,.38);margin-top:2px}
.mk-badge{font-size:.6rem;font-weight:700;padding:2px 9px;border-radius:100px}
.bpu{background:rgba(147,51,234,.14);color:#C084FC;border:1px solid rgba(147,51,234,.24)}
.bge{background:rgba(16,185,129,.12);color:#34D399;border:1px solid rgba(16,185,129,.22)}
.bye{background:rgba(245,158,11,.1);color:#FBB824;border:1px solid rgba(245,158,11,.2)}
.mk-ai-footer{
  background:rgba(76,110,245,.08);border:1px solid rgba(76,110,245,.18);
  border-radius:8px;padding:9px 12px;margin-top:4px;
}
.mk-ai-lbl{font-size:.6rem;color:#93C5FD;font-weight:700;margin-bottom:3px}
.mk-ai-txt{font-size:.7rem;color:rgba(255,255,255,.55)}

/* ── Mockup: Automation ── */
.mk-flow { display: flex; flex-direction: column; gap: 0; }
.mk-node {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid rgba(255,255,255,.05);
  position: relative;
}
.mk-node:last-child{border-bottom:none}
.mk-node-dot{
  width: 30px; height: 30px; min-width: 30px;
  border-radius: 8px; display: flex; align-items: center;
  justify-content: center; font-size: .62rem; font-weight: 800;
  margin-top: 1px;
}
.nd1{background:rgba(76,110,245,.18);color:#818CF8}
.nd2{background:rgba(147,51,234,.18);color:#C084FC}
.nd3{background:rgba(6,182,212,.14);color:#22D3EE}
.nd4{background:rgba(16,185,129,.12);color:#34D399}
.mk-node-name{font-size:.74rem;font-weight:600;color:#fff;margin-bottom:2px}
.mk-node-desc{font-size:.65rem;color:rgba(255,255,255,.38)}
.mk-status{
  margin-left:auto;font-size:.6rem;font-weight:700;
  padding:2px 8px;border-radius:100px;white-space:nowrap;
  background:rgba(16,185,129,.1);color:#34D399;
  border:1px solid rgba(16,185,129,.2);
}

/* ── Mockup: Analytics ── */
.mk-analytics {}
.mk-ana-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
.mk-ana-title{font-size:.72rem;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.07em}
.mk-ana-val{font-size:.72rem;font-weight:700;color:#34D399}
.mk-channel{display:flex;flex-direction:column;gap:9px;margin-bottom:14px}
.mk-ch-row{display:flex;align-items:center;gap:10px}
.mk-ch-name{width:60px;font-size:.68rem;color:rgba(255,255,255,.5);text-align:right;flex-shrink:0}
.mk-ch-track{flex:1;height:6px;background:rgba(255,255,255,.07);border-radius:3px;overflow:hidden}
.mk-ch-fill{height:100%;border-radius:3px;background:linear-gradient(90deg,#4C6EF5,#9333EA)}
.mk-ch-num{width:36px;font-size:.65rem;color:rgba(255,255,255,.5);font-weight:600}
.mk-stats-row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:7px;margin-top:2px}
.mk-stat-box{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:7px;padding:9px 10px}
.mk-stat-l{font-size:.58rem;color:rgba(255,255,255,.32);margin-bottom:3px}
.mk-stat-v{font-size:.9rem;font-weight:800;color:#fff;letter-spacing:-.02em}

/* ── Mockup: Billing ── */
.mk-billing {}
.mk-pay-logos{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px}
.mk-pay-logo{
  background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);
  border-radius:8px;padding:11px;display:flex;align-items:center;justify-content:center;
  font-size:.82rem;font-weight:700;transition:all .2s;
}
.mk-pay-logo:hover{background:rgba(76,110,245,.1);border-color:rgba(76,110,245,.25)}
.mk-payout{
  background:rgba(16,185,129,.07);border:1px solid rgba(16,185,129,.16);
  border-radius:8px;padding:11px 13px;
  display:flex;justify-content:space-between;align-items:center;
}
.mk-po-l{font-size:.65rem;color:#34D399;font-weight:600}
.mk-po-v{font-size:.9rem;font-weight:800;color:#fff}

/* ─────────────────────────────────────────────────────────
   SLIDE CONTENT ANIMATION
   Inactive: opacity 0, slight translateY (exit state)
   Active:   fades + slides up with generous stagger
   Exiting:  cross-fades out faster than the enter
───────────────────────────────────────────────────────── */
.slide-text > *,
.slide-visual > .mockup {
  opacity: 0;
  transform: translateY(14px);
  transition:
    opacity .55s var(--ease-out),
    transform .55s var(--ease-out);
}

/* Exit — content fades out quickly when slide loses .active */
.slide-text > *,
.slide-visual > .mockup {
  transition:
    opacity .3s cubic-bezier(.4, 0, 1, 1),
    transform .3s cubic-bezier(.4, 0, 1, 1);
}

/* Enter — content rises in smoothly when slide gains .active */
.slide.active .slide-text > *,
.slide.active .slide-visual > .mockup {
  opacity: 1;
  transform: translateY(0);
  transition:
    opacity .65s var(--ease-out),
    transform .65s var(--ease-out);
}

/* Staggered delays — spread wider for breathing room */
.slide.active .slide-chip           { transition-delay: .10s; }
.slide.active .slide-h              { transition-delay: .18s; }
.slide.active .slide-p              { transition-delay: .26s; }
.slide.active .slide-features       { transition-delay: .34s; }
.slide.active .slide-cta            { transition-delay: .44s; }
.slide.active .slide-visual > .mockup { transition-delay: .22s; }

/* ─────────────────────────────────────────────────────────
   PROGRESS BAR + DOTS
───────────────────────────────────────────────────────── */
.slider-footer {
  display: flex; align-items: center; justify-content: center;
  gap: 20px; margin-top: 36px;
}

/* Arrow buttons */
.slider-arrow {
  width: 40px; height: 40px; border-radius: 50%;
  border: 1px solid var(--border);
  background: var(--surface);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; color: rgba(255,255,255,.5);
  transition:
    border-color .35s var(--ease-out),
    color        .35s var(--ease-out),
    background   .35s var(--ease-out),
    transform    .35s var(--ease-spring);
  flex-shrink: 0;
}
.slider-arrow:hover {
  border-color: rgba(147,51,234,.45);
  color: #fff;
  background: rgba(147,51,234,.1);
  transform: scale(1.1);
}
.slider-arrow:active { transform: scale(.94); }

/* Dot + progress indicators */
.slider-dots {
  display: flex; align-items: center; gap: 8px;
}
.s-dot {
  position: relative;
  width: 7px; height: 7px; border-radius: 100px;
  background: rgba(255,255,255,.18); cursor: pointer;
  transition:
    background .4s var(--ease-out),
    width      .48s var(--ease-spring),
    transform  .3s  var(--ease-out);
  overflow: hidden;
}
.s-dot.active {
  width: 32px;
  background: rgba(255,255,255,.2);
}
.s-dot:hover:not(.active) {
  background: rgba(255,255,255,.32);
  transform: scale(1.18);
}

/* Fill bar inside active dot */
.s-dot-fill {
  position: absolute; top: 0; left: 0; bottom: 0; width: 0%;
  background: var(--g-primary);
  border-radius: 100px;
  transition: none; /* JS drives this */
}

/* ─────────────────────────────────────────────────────────
   SCROLL-IN REVEAL
───────────────────────────────────────────────────────── */
.reveal {
  opacity: 0; transform: translateY(28px);
  transition: opacity .75s var(--ease-out), transform .75s var(--ease-out);
}
.reveal.vis { opacity: 1; transform: none; }
.reveal.d1 { transition-delay: .07s; }
.reveal.d2 { transition-delay: .14s; }
.reveal.d3 { transition-delay: .21s; }

/* ─────────────────────────────────────────────────────────
   ── Mockup: AI Chatbot ──
───────────────────────────────────────────────────────── */
.mk-chat-header {
  display: flex; align-items: center; gap: 10px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(255,255,255,.06);
  margin-bottom: 12px;
}
.mk-chat-avatar {
  width: 32px; height: 32px; border-radius: 50%;
  background: linear-gradient(135deg, #06B6D4, #7C3AED);
  display: flex; align-items: center; justify-content: center;
  font-size: .62rem; font-weight: 800; color: #fff;
  flex-shrink: 0;
  box-shadow: 0 0 14px rgba(6,182,212,.35);
}
.mk-chat-name { font-size: .74rem; font-weight: 700; color: #fff; margin-bottom: 2px; }
.mk-chat-status {
  display: flex; align-items: center; gap: 5px;
  font-size: .6rem; color: rgba(255,255,255,.38);
}
.mk-chat-online {
  width: 6px; height: 6px; border-radius: 50%;
  background: #34D399;
  box-shadow: 0 0 6px #34D399;
  animation: chat-online-pulse 2s ease-in-out infinite;
}
@keyframes chat-online-pulse { 0%,100%{opacity:1}50%{opacity:.5} }
.mk-chat-model {
  margin-left: auto;
  font-size: .58rem; font-weight: 700;
  color: #67E8F9;
  background: rgba(6,182,212,.1);
  border: 1px solid rgba(6,182,212,.2);
  border-radius: 100px; padding: 2px 9px;
}
.mk-chat-msgs {
  display: flex; flex-direction: column; gap: 8px;
  margin-bottom: 12px;
}
.mk-msg { font-size: .72rem; line-height: 1.45; }
.mk-msg-user {
  align-self: flex-end;
  background: rgba(6,182,212,.12);
  border: 1px solid rgba(6,182,212,.2);
  border-radius: 12px 12px 3px 12px;
  padding: 7px 11px; color: rgba(255,255,255,.8);
  max-width: 86%;
}
.mk-msg-ai { align-self: flex-start; max-width: 94%; }
.mk-msg-ai-inner {
  background: rgba(255,255,255,.05);
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 3px 12px 12px 12px;
  padding: 9px 11px;
}
.mk-msg-text { color: rgba(255,255,255,.72); margin-bottom: 7px; }
.mk-msg-text strong { color: #fff; font-weight: 600; }
.mk-msg-card {
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 8px; padding: 8px 10px;
  display: flex; flex-direction: column; gap: 5px;
}
.mk-msg-card-row {
  display: flex; justify-content: space-between; align-items: center;
}
.mk-msg-label { font-size: .62rem; color: rgba(255,255,255,.38); }
.mk-msg-val   { font-size: .68rem; font-weight: 700; color: #fff; }
.mk-msg-action {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: .62rem; font-weight: 700; color: #34D399;
  background: rgba(52,211,153,.1);
  border: 1px solid rgba(52,211,153,.2);
  border-radius: 100px; padding: 3px 9px; margin-top: 5px;
  width: fit-content;
}
.mk-msg-action-icon { font-size: .7rem; }
.mk-typing {
  display: flex; align-items: center; gap: 4px;
  padding: 8px 12px;
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.07);
  border-radius: 3px 12px 12px 12px;
  width: fit-content;
}
.mk-typing-dot {
  width: 5px; height: 5px; border-radius: 50%;
  background: rgba(255,255,255,.35);
  animation: typing-bounce 1.4s ease-in-out infinite;
}
.mk-typing-dot:nth-child(2) { animation-delay: .2s; }
.mk-typing-dot:nth-child(3) { animation-delay: .4s; }
@keyframes typing-bounce { 0%,80%,100%{transform:scale(.8);opacity:.4} 40%{transform:scale(1);opacity:1} }
.mk-chat-input {
  display: flex; align-items: center; justify-content: space-between;
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 100px; padding: 8px 8px 8px 14px;
}
.mk-chat-placeholder { font-size: .68rem; color: rgba(255,255,255,.28); }
.mk-chat-send {
  width: 26px; height: 26px; border-radius: 50%;
  background: linear-gradient(135deg, #06B6D4, #7C3AED);
  display: flex; align-items: center; justify-content: center;
  color: #fff; flex-shrink: 0;
  box-shadow: 0 0 10px rgba(6,182,212,.35);
}

/* ─────────────────────────────────────────────────────────
   ── Mockup: Voice Agent ──
───────────────────────────────────────────────────────── */
.mk-voice-center {
  display: flex; flex-direction: column; align-items: center;
  padding: 14px 0 10px; margin-bottom: 12px;
}
.mk-voice-orb-wrap {
  position: relative;
  width: 72px; height: 72px;
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 10px;
}
.mk-voice-ring {
  position: absolute; border-radius: 50%;
  border: 1px solid;
  animation: voice-ring-expand 2.4s ease-out infinite;
}
.mk-vr1 { width:72px; height:72px; border-color:rgba(147,51,234,.5); animation-delay:0s; }
.mk-vr2 { width:72px; height:72px; border-color:rgba(147,51,234,.3); animation-delay:.7s; }
.mk-vr3 { width:72px; height:72px; border-color:rgba(147,51,234,.15); animation-delay:1.4s; }
@keyframes voice-ring-expand {
  0%   { transform:scale(1);   opacity:.9; }
  100% { transform:scale(1.9); opacity:0;  }
}
.mk-voice-orb {
  width: 56px; height: 56px; border-radius: 50%;
  background: linear-gradient(135deg, #9333EA, #EC4899);
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 0 28px rgba(147,51,234,.55), 0 0 56px rgba(147,51,234,.2);
  z-index: 1; position: relative;
  animation: orb-breathe 2.4s ease-in-out infinite;
}
@keyframes orb-breathe {
  0%,100%{ box-shadow:0 0 28px rgba(147,51,234,.55),0 0 56px rgba(147,51,234,.2); transform:scale(1); }
  50%    { box-shadow:0 0 40px rgba(236,72,153,.7), 0 0 80px rgba(147,51,234,.35); transform:scale(1.05); }
}
.mk-voice-label {
  font-size: .68rem; font-weight: 600; color: rgba(255,255,255,.5);
  letter-spacing: .06em; text-transform: uppercase; margin-bottom: 10px;
}
.mk-voice-wave {
  display: flex; align-items: center; gap: 3px; height: 28px;
}
.mk-vw-bar {
  width: 3px; border-radius: 100px;
  background: linear-gradient(to top, #9333EA, #EC4899);
  animation: voice-wave var(--spd, .7s) ease-in-out infinite alternate;
  height: var(--h, 50%);
}
.mk-vw-bar:nth-child(1){--spd:.55s}
.mk-vw-bar:nth-child(2){--spd:.72s;animation-delay:.1s}
.mk-vw-bar:nth-child(3){--spd:.48s;animation-delay:.2s}
.mk-vw-bar:nth-child(4){--spd:.65s;animation-delay:.05s}
.mk-vw-bar:nth-child(5){--spd:.80s;animation-delay:.15s}
.mk-vw-bar:nth-child(6){--spd:.58s;animation-delay:.25s}
.mk-vw-bar:nth-child(7){--spd:.68s;animation-delay:.08s}
.mk-vw-bar:nth-child(8){--spd:.52s;animation-delay:.18s}
.mk-vw-bar:nth-child(9){--spd:.75s;animation-delay:.12s}
@keyframes voice-wave {
  0%  { transform: scaleY(.35); opacity:.6; }
  100%{ transform: scaleY(1);   opacity:1; }
}
.mk-voice-transcript {
  display: flex; flex-direction: column; gap: 7px;
  background: rgba(255,255,255,.03);
  border: 1px solid rgba(255,255,255,.07);
  border-radius: 10px; padding: 10px 12px;
  margin-bottom: 10px; max-height: 130px; overflow: hidden;
}
.mk-vt-row { display: flex; flex-direction: column; gap: 2px; }
.mk-vt-who { font-size: .58rem; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; }
.mk-vt-user .mk-vt-who { color: #67E8F9; }
.mk-vt-ai .mk-vt-who   { color: #C4B5FD; }
.mk-vt-text { font-size: .68rem; color: rgba(255,255,255,.6); line-height: 1.45; }
.mk-vt-current .mk-vt-text { color: rgba(255,255,255,.8); }
.mk-cursor-blink { animation: cursor-blink .9s step-end infinite; }
@keyframes cursor-blink { 0%,100%{opacity:1}50%{opacity:0} }
.mk-voice-actions {
  display: flex; gap: 6px; flex-wrap: wrap;
}
.mk-va-chip {
  display: flex; align-items: center; gap: 5px;
  font-size: .6rem; font-weight: 600;
  background: rgba(255,255,255,.05);
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 100px; padding: 4px 10px;
  color: rgba(255,255,255,.55);
}
.mk-va-live {
  background: rgba(147,51,234,.12);
  border-color: rgba(147,51,234,.28);
  color: #C4B5FD;
  animation: va-live-pulse 2s ease-in-out infinite;
}
@keyframes va-live-pulse { 0%,100%{opacity:1}50%{opacity:.65} }

</style>
</head>
<body>

<!-- ═══════════════════════════════════════════════════════
     SHOWCASE SECTION
═══════════════════════════════════════════════════════ -->
<section class="showcase" id="showcase">
  <div class="showcase-bg"></div>
  <div class="showcase-grid-lines"></div>

  <div class="showcase-inner">

    <!-- Header -->
    <div class="section-header">
      <div class="section-eyebrow reveal">
        <span class="eyebrow-line"></span>
        Product
        <span class="eyebrow-line"></span>
      </div>
      <h2 class="section-title reveal d1">
        Explore every dimension<br/>of <span class="grad">AIBMS</span>
      </h2>
      <p class="section-sub reveal d2">
        Each module is AI-native, deeply integrated, and built to replace your entire scattered stack with one intelligent layer.
      </p>
    </div>

    <!-- Tab Nav -->
    <nav class="tab-nav reveal d3" id="tabNav" aria-label="Product tabs">
      

      <button class="tab-btn active" data-idx="0" aria-selected="true">
        <span class="tab-icon">📊</span> Dashboard
      </button>
      <button class="tab-btn" data-idx="1" aria-selected="false">
        <span class="tab-icon">🎯</span> CRM Pipeline
      </button>
      <button class="tab-btn" data-idx="2" aria-selected="false">
        <span class="tab-icon">⚡</span> Automation
      </button>
      <button class="tab-btn" data-idx="3" aria-selected="false">
        <span class="tab-icon">📈</span> Analytics
      </button>
      <button class="tab-btn" data-idx="4" aria-selected="false">
        <span class="tab-icon">💬</span> AI Chatbot
      </button>
      <button class="tab-btn" data-idx="5" aria-selected="false">
        <span class="tab-icon">🎙️</span> Voice Agent
      </button>
    </nav>

    <!-- Slider Viewport -->
    <div class="slider-viewport reveal" id="sliderViewport">
      <div class="slider-track" id="sliderTrack">

        <!-- ── SLIDE 0: Dashboard ── -->
        <div class="slide active"
             style="--accent-grad:linear-gradient(90deg,transparent,#4C6EF5 35%,#7C3AED,transparent);
                    --accent-orb:radial-gradient(circle,rgba(76,110,245,1),transparent);
                    --accent-glow:rgba(76,110,245,.55);
                    --chip-color:#93C5FD;
                    --chip-bg:rgba(76,110,245,.1);
                    --chip-border:rgba(76,110,245,.22);">
          <div class="slide-text">
            <div class="slide-chip">
              <span class="chip-dot"></span>
              AI Dashboard
            </div>
            <h3 class="slide-h">
              Your entire business,<br/>
              <span class="hl">at a glance.</span>
            </h3>
            <p class="slide-p">
              Real-time KPIs, revenue trends, and team pulse — all in one glanceable view. AI generates your daily briefing before you even open your laptop.
            </p>
            <ul class="slide-features">
              <li>
                <span class="feat-check">
                  <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6 8 1" stroke="#93C5FD" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </span>
                Revenue, margin, and cohort dashboards in one view
              </li>
              <li>
                <span class="feat-check">
                  <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6 8 1" stroke="#93C5FD" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </span>
                AI-generated weekly business summaries
              </li>
              <li>
                <span class="feat-check">
                  <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6 8 1" stroke="#93C5FD" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </span>
                Anomaly detection and smart alerting
              </li>
            </ul>
            <a href="#" class="slide-cta">
              Explore Dashboard
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </a>
          </div>
          <div class="slide-visual">
            <div class="mockup" style="--accent-grad:linear-gradient(90deg,transparent,#4C6EF5 35%,#7C3AED,transparent)">
              <div class="m-bar">
                <div class="m-dot r"></div><div class="m-dot y"></div><div class="m-dot g"></div>
                <span class="m-url">app.aibms.io/dashboard</span>
              </div>
              <div class="m-body">
                <div class="mk-kpis">
                  <div class="mk-kpi b"><div class="mk-kpi-l">Revenue</div><div class="mk-kpi-v">$2.41M</div><div class="mk-kpi-d">↑ 18.3%</div></div>
                  <div class="mk-kpi p"><div class="mk-kpi-l">Users</div><div class="mk-kpi-v">14,820</div><div class="mk-kpi-d">↑ 6.1%</div></div>
                  <div class="mk-kpi c"><div class="mk-kpi-l">Total</div><div class="mk-kpi-v">1.2%</div><div class="mk-kpi-d">↓ 0.4%</div></div>
                </div>
                <div class="mk-chart">
                  <div class="mk-chart-lbl">Revenue · 7 months</div>
                  <div class="mk-bars">
                    <div class="mk-bar" style="height:40%"></div>
                    <div class="mk-bar" style="height:55%"></div>
                    <div class="mk-bar" style="height:46%"></div>
                    <div class="mk-bar" style="height:70%"></div>
                    <div class="mk-bar" style="height:62%"></div>
                    <div class="mk-bar" style="height:85%"></div>
                    <div class="mk-bar" style="height:100%"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ── SLIDE 1: CRM Pipeline ── -->
        <div class="slide"
             style="--accent-grad:linear-gradient(90deg,transparent,#9333EA 35%,#EC4899,transparent);
                    --accent-orb:radial-gradient(circle,rgba(147,51,234,1),transparent);
                    --accent-glow:rgba(147,51,234,.55);
                    --chip-color:#C084FC;
                    --chip-bg:rgba(147,51,234,.1);
                    --chip-border:rgba(147,51,234,.24);">
          <div class="slide-text">
            <div class="slide-chip">
              <span class="chip-dot"></span>
              Smart CRM
            </div>
            <h3 class="slide-h">
              A pipeline that<br/>
              <span class="hl">closes itself.</span>
            </h3>
            <p class="slide-p">
              AI scores every lead, forecasts close probability, and nudges the right rep at the right time. Your pipeline moves forward — automatically.
            </p>
            <ul class="slide-features">
              <li>
                <span class="feat-check" style="--chip-bg:rgba(147,51,234,.1);--chip-border:rgba(147,51,234,.24)">
                  <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6 8 1" stroke="#C084FC" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </span>
                AI-scored lead prioritization and enrichment
              </li>
              <li>
                <span class="feat-check" style="--chip-bg:rgba(147,51,234,.1);--chip-border:rgba(147,51,234,.24)">
                  <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6 8 1" stroke="#C084FC" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </span>
                Revenue forecast with confidence intervals
              </li>
              <li>
                <span class="feat-check" style="--chip-bg:rgba(147,51,234,.1);--chip-border:rgba(147,51,234,.24)">
                  <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6 8 1" stroke="#C084FC" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </span>
                At-risk deal alerts before they go cold
              </li>
            </ul>
            <a href="#" class="slide-cta">
              Explore CRM
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </a>
          </div>
          <div class="slide-visual">
            <div class="mockup" style="--accent-grad:linear-gradient(90deg,transparent,#9333EA 35%,#EC4899,transparent)">
              <div class="m-bar">
                <div class="m-dot r"></div><div class="m-dot y"></div><div class="m-dot g"></div>
                <span class="m-url">app.aibms.io/crm</span>
              </div>
              <div class="m-body">
                <div class="mk-pipe">
                  <div class="mk-deal"><div><div class="mk-deal-name">Supplier Invoice</div><div class="mk-deal-val">$48K · Tech Corp</div></div><span class="mk-badge bpu">Pending</span></div>
                  <div class="mk-deal"><div><div class="mk-deal-name">Tax Assessment</div><div class="mk-deal-val">$12K · Processing</div></div><span class="mk-badge bye">Review</span></div>
                  <div class="mk-deal"><div><div class="mk-deal-name">Client Payment</div><div class="mk-deal-val">$15K · Cleared</div></div><span class="mk-badge bge">Paid ✓</span></div>
                  <div class="mk-deal"><div><div class="mk-deal-name">Branch Expense</div><div class="mk-deal-val">$22K · Submitted</div></div><span class="mk-badge bpu">Logged</span></div>
                </div>
                <div class="mk-ai-footer">
                  <div class="mk-ai-lbl">🤖 AI Forecast</div>
                  <div class="mk-ai-txt">$176K pipeline · 78% projected close this quarter</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ── SLIDE 2: Automation ── -->
        <div class="slide"
             style="--accent-grad:linear-gradient(90deg,transparent,#06B6D4 35%,#4C6EF5,transparent);
                    --accent-orb:radial-gradient(circle,rgba(6,182,212,1),transparent);
                    --accent-glow:rgba(6,182,212,.5);
                    --chip-color:#22D3EE;
                    --chip-bg:rgba(6,182,212,.1);
                    --chip-border:rgba(6,182,212,.22);">
          <div class="slide-text">
            <div class="slide-chip">
              <span class="chip-dot"></span>
              Automation
            </div>
            <h3 class="slide-h">
              Your ops layer,<br/>
              <span class="hl">fully automated.</span>
            </h3>
            <p class="slide-p">
              Build no-code workflows, trigger AI actions on any condition, and watch 300+ integrations move your business — without lifting a finger.
            </p>
            <ul class="slide-features">
              <li>
                <span class="feat-check" style="--chip-bg:rgba(6,182,212,.1);--chip-border:rgba(6,182,212,.22)">
                  <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6 8 1" stroke="#22D3EE" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </span>
                Visual no-code workflow builder
              </li>
              <li>
                <span class="feat-check" style="--chip-bg:rgba(6,182,212,.1);--chip-border:rgba(6,182,212,.22)">
                  <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6 8 1" stroke="#22D3EE" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </span>
                AI-triggered context-aware smart actions
              </li>
              <li>
                <span class="feat-check" style="--chip-bg:rgba(6,182,212,.1);--chip-border:rgba(6,182,212,.22)">
                  <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6 8 1" stroke="#22D3EE" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </span>
                Full audit trail and version history
              </li>
            </ul>
            <a href="#" class="slide-cta">
              Explore Automation
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </a>
          </div>
          <div class="slide-visual">
            <div class="mockup" style="--accent-grad:linear-gradient(90deg,transparent,#06B6D4 35%,#4C6EF5,transparent)">
              <div class="m-bar">
                <div class="m-dot r"></div><div class="m-dot y"></div><div class="m-dot g"></div>
                <span class="m-url">app.aibms.io/automations</span>
              </div>
              <div class="m-body">
                <div class="mk-flow">
                  <div class="mk-node"><div class="mk-node-dot nd1">⚡</div><div><div class="mk-node-name">Trigger — New CRM deal</div><div class="mk-node-desc">When deal value &gt; $10K · stage = "New"</div></div><span class="mk-status">Live</span></div>
                  <div class="mk-node"><div class="mk-node-dot nd2">AI</div><div><div class="mk-node-name">Score &amp; enrich lead</div><div class="mk-node-desc">Firmographic data + 0–100 AI score</div></div><span class="mk-status">Live</span></div>
                  <div class="mk-node"><div class="mk-node-dot nd3">✉</div><div><div class="mk-node-name">Slack alert to rep</div><div class="mk-node-desc">AI summary → #sales channel</div></div><span class="mk-status">Live</span></div>
                  <div class="mk-node"><div class="mk-node-dot nd4">✓</div><div><div class="mk-node-name">Log to timeline</div><div class="mk-node-desc">Full context stored automatically</div></div><span class="mk-status">Live</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ── SLIDE 3: Analytics ── -->
        <div class="slide"
             style="--accent-grad:linear-gradient(90deg,transparent,#EC4899 35%,#9333EA,transparent);
                    --accent-orb:radial-gradient(circle,rgba(236,72,153,1),transparent);
                    --accent-glow:rgba(236,72,153,.5);
                    --chip-color:#F9A8D4;
                    --chip-bg:rgba(236,72,153,.1);
                    --chip-border:rgba(236,72,153,.22);">
          <div class="slide-text">
            <div class="slide-chip">
              <span class="chip-dot"></span>
              Analytics
            </div>
            <h3 class="slide-h">
              Let your business<br/>
              <span class="hl">shine with data.</span>
            </h3>
            <p class="slide-p">
              Every metric that matters — cashflow, expenses, document intelligence — surfaced automatically. No more digging through spreadsheets.
            </p>
            <ul class="slide-features">
              <li>
                <span class="feat-check" style="--chip-bg:rgba(236,72,153,.1);--chip-border:rgba(236,72,153,.22)">
                  <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6 8 1" stroke="#F9A8D4" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </span>
                Revenue by channel, cohort, and region
              </li>
              <li>
                <span class="feat-check" style="--chip-bg:rgba(236,72,153,.1);--chip-border:rgba(236,72,153,.22)">
                  <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6 8 1" stroke="#F9A8D4" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </span>
                Anomaly detection with instant alerts
              </li>
              <li>
                <span class="feat-check" style="--chip-bg:rgba(236,72,153,.1);--chip-border:rgba(236,72,153,.22)">
                  <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6 8 1" stroke="#F9A8D4" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </span>
                One-click board-ready reports
              </li>
            </ul>
            <a href="#" class="slide-cta">
              Explore Analytics
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </a>
          </div>
          <div class="slide-visual">
            <div class="mockup" style="--accent-grad:linear-gradient(90deg,transparent,#EC4899 35%,#9333EA,transparent)">
              <div class="m-bar">
                <div class="m-dot r"></div><div class="m-dot y"></div><div class="m-dot g"></div>
                <span class="m-url">app.aibms.io/analytics</span>
              </div>
              <div class="m-body mk-analytics">
                <div class="mk-ana-header"><span class="mk-ana-title">Revenue by channel · Q3</span><span class="mk-ana-val">↑ 31% QoQ</span></div>
                <div class="mk-channel">
                  <div class="mk-ch-row"><div class="mk-ch-name">Direct</div><div class="mk-ch-track"><div class="mk-ch-fill" style="width:82%"></div></div><div class="mk-ch-num">$1.2M</div></div>
                  <div class="mk-ch-row"><div class="mk-ch-name">Inbound</div><div class="mk-ch-track"><div class="mk-ch-fill" style="width:64%"></div></div><div class="mk-ch-num">$840K</div></div>
                  <div class="mk-ch-row"><div class="mk-ch-name">Partner</div><div class="mk-ch-track"><div class="mk-ch-fill" style="width:48%"></div></div><div class="mk-ch-num">$560K</div></div>
                  <div class="mk-ch-row"><div class="mk-ch-name">PLG</div><div class="mk-ch-track"><div class="mk-ch-fill" style="width:35%"></div></div><div class="mk-ch-num">$320K</div></div>
                </div>
                <div class="mk-stats-row">
                  <div class="mk-stat-box"><div class="mk-stat-l">Cashflow</div><div class="mk-stat-v">$112K</div></div>
                  <div class="mk-stat-box"><div class="mk-stat-l">Docs Analyzed</div><div class="mk-stat-v" style="color:#34D399">840</div></div>
                  <div class="mk-stat-box"><div class="mk-stat-l">Active Issues</div><div class="mk-stat-v">3</div></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ── SLIDE 4: AI Chatbot ── -->
        <div class="slide"
             style="--accent-grad:linear-gradient(90deg,transparent,#06B6D4 35%,#7C3AED,transparent);
                    --accent-orb:radial-gradient(circle,rgba(6,182,212,1),transparent);
                    --accent-glow:rgba(6,182,212,.48);
                    --chip-color:#67E8F9;
                    --chip-bg:rgba(6,182,212,.1);
                    --chip-border:rgba(6,182,212,.24);">
          <div class="slide-text">
            <div class="slide-chip">
              <span class="chip-dot"></span>
              AI Chatbot
            </div>
            <h3 class="slide-h">
              Your entire BMS,<br/>
              <span class="hl">conversational.</span>
            </h3>
            <p class="slide-p">
              One intelligent chatbot that handles every workflow — from querying revenue to closing deals to triggering automations. Just ask, and AIBMS acts.
            </p>
            <ul class="slide-features">
              <li>
                <span class="feat-check" style="--chip-bg:rgba(6,182,212,.1);--chip-border:rgba(6,182,212,.24)">
                  <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6 8 1" stroke="#67E8F9" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </span>
                Full BMS access — CRM, analytics, automation via chat
              </li>
              <li>
                <span class="feat-check" style="--chip-bg:rgba(6,182,212,.1);--chip-border:rgba(6,182,212,.24)">
                  <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6 8 1" stroke="#67E8F9" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </span>
                Understands business context, not just commands
              </li>
              <li>
                <span class="feat-check" style="--chip-bg:rgba(6,182,212,.1);--chip-border:rgba(6,182,212,.24)">
                  <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6 8 1" stroke="#67E8F9" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </span>
                Embeds in Slack, WhatsApp, web, or your own app
              </li>
            </ul>
            <a href="#" class="slide-cta">
              Explore AI Chatbot
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </a>
          </div>
          <div class="slide-visual">
            <div class="mockup" style="--accent-grad:linear-gradient(90deg,transparent,#06B6D4 35%,#7C3AED,transparent)">
              <div class="m-bar">
                <div class="m-dot r"></div><div class="m-dot y"></div><div class="m-dot g"></div>
                <span class="m-url">app.aibms.io/chatbot</span>
              </div>
              <div class="m-body mk-chat">
                <!-- Chat header -->
                <div class="mk-chat-header">
                  <div class="mk-chat-avatar">AI</div>
                  <div>
                    <div class="mk-chat-name">AIBMS Assistant</div>
                    <div class="mk-chat-status"><span class="mk-chat-online"></span>Online · Full BMS access</div>
                  </div>
                  <div class="mk-chat-model">GPT-4o</div>
                </div>
                <!-- Messages -->
                <div class="mk-chat-msgs">
                  <div class="mk-msg mk-msg-user">Show me this week's pipeline health</div>
                  <div class="mk-msg mk-msg-ai">
                    <div class="mk-msg-ai-inner">
                      <div class="mk-msg-text">Cashbook is balanced with <strong>$176K</strong> in processed transactions. 3 invoices need attention — Horizon Labs payment is overdue by 8 days.</div>
                      <div class="mk-msg-card">
                        <div class="mk-msg-card-row"><span class="mk-msg-label">Pending Invoices</span><span class="mk-msg-val">24</span></div>
                        <div class="mk-msg-card-row"><span class="mk-msg-label">Action required</span><span class="mk-msg-val" style="color:#34D399">12 updates</span></div>
                        <div class="mk-msg-card-row"><span class="mk-msg-label">Overdue</span><span class="mk-msg-val" style="color:#FBB824">3 invoices</span></div>
                      </div>
                    </div>
                  </div>
                  <div class="mk-msg mk-msg-user">Trigger a follow-up sequence for Horizon Labs</div>
                  <div class="mk-msg mk-msg-ai">
                    <div class="mk-msg-ai-inner">
                      <div class="mk-msg-text">Done. Follow-up sequence triggered for <strong>Horizon Labs</strong> — email + Slack alert sent to Sarah (AE). I'll report back in 24hrs.</div>
                      <div class="mk-msg-action"><span class="mk-msg-action-icon">✓</span>Automation triggered</div>
                    </div>
                  </div>
                  <div class="mk-typing">
                    <div class="mk-typing-dot"></div>
                    <div class="mk-typing-dot"></div>
                    <div class="mk-typing-dot"></div>
                  </div>
                </div>
                <!-- Input -->
                <div class="mk-chat-input">
                  <span class="mk-chat-placeholder">Ask anything about your business…</span>
                  <div class="mk-chat-send">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6h8M6 2l4 4-4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ── SLIDE 5: Voice Agent ── -->
        <div class="slide"
             style="--accent-grad:linear-gradient(90deg,transparent,#9333EA 35%,#EC4899,transparent);
                    --accent-orb:radial-gradient(circle,rgba(147,51,234,1),transparent);
                    --accent-glow:rgba(147,51,234,.55);
                    --chip-color:#C4B5FD;
                    --chip-bg:rgba(147,51,234,.1);
                    --chip-border:rgba(147,51,234,.26);">
          <div class="slide-text">
            <div class="slide-chip">
              <span class="chip-dot"></span>
              Voice Agent
            </div>
            <h3 class="slide-h">
              Run your business<br/>
              <span class="hl">hands-free.</span>
            </h3>
            <p class="slide-p">
              A real-time AI voice agent that handles full BMS workflows by voice — query data, trigger actions, log expenses, and get briefings, all without touching a screen.
            </p>
            <ul class="slide-features">
              <li>
                <span class="feat-check" style="--chip-bg:rgba(147,51,234,.1);--chip-border:rgba(147,51,234,.26)">
                  <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6 8 1" stroke="#C4B5FD" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </span>
                Real-time voice understanding with &lt;300ms latency
              </li>
              <li>
                <span class="feat-check" style="--chip-bg:rgba(147,51,234,.1);--chip-border:rgba(147,51,234,.26)">
                  <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6 8 1" stroke="#C4B5FD" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </span>
                Handles complex multi-step BMS workflows by voice
              </li>
              <li>
                <span class="feat-check" style="--chip-bg:rgba(147,51,234,.1);--chip-border:rgba(147,51,234,.26)">
                  <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6 8 1" stroke="#C4B5FD" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </span>
                Works across phone, app, browser, and smart speakers
              </li>
            </ul>
            <a href="#" class="slide-cta">
              Explore Voice Agent
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </a>
          </div>
          <div class="slide-visual">
            <div class="mockup" style="--accent-grad:linear-gradient(90deg,transparent,#9333EA 35%,#EC4899,transparent)">
              <div class="m-bar">
                <div class="m-dot r"></div><div class="m-dot y"></div><div class="m-dot g"></div>
                <span class="m-url">app.aibms.io/voice</span>
              </div>
              <div class="m-body mk-voice">
                <!-- Voice orb + status -->
                <div class="mk-voice-center">
                  <div class="mk-voice-orb-wrap">
                    <div class="mk-voice-ring mk-vr3"></div>
                    <div class="mk-voice-ring mk-vr2"></div>
                    <div class="mk-voice-ring mk-vr1"></div>
                    <div class="mk-voice-orb">
                      <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                        <rect x="9" y="3" width="8" height="14" rx="4" fill="white" opacity=".9"/>
                        <path d="M5 13c0 4.4 3.6 8 8 8s8-3.6 8-8" stroke="white" stroke-width="1.8" stroke-linecap="round" opacity=".9"/>
                        <line x1="13" y1="21" x2="13" y2="24" stroke="white" stroke-width="1.8" stroke-linecap="round" opacity=".9"/>
                      </svg>
                    </div>
                  </div>
                  <div class="mk-voice-label">Listening…</div>
                  <div class="mk-voice-wave">
                    <div class="mk-vw-bar" style="--h:30%"></div>
                    <div class="mk-vw-bar" style="--h:65%"></div>
                    <div class="mk-vw-bar" style="--h:45%"></div>
                    <div class="mk-vw-bar" style="--h:100%"></div>
                    <div class="mk-vw-bar" style="--h:55%"></div>
                    <div class="mk-vw-bar" style="--h:80%"></div>
                    <div class="mk-vw-bar" style="--h:40%"></div>
                    <div class="mk-vw-bar" style="--h:70%"></div>
                    <div class="mk-vw-bar" style="--h:35%"></div>
                  </div>
                </div>
                <!-- Transcript -->
                <div class="mk-voice-transcript">
                  <div class="mk-vt-row mk-vt-user">
                    <span class="mk-vt-who">You</span>
                    <span class="mk-vt-text">"What's our revenue forecast for Q4?"</span>
                  </div>
                  <div class="mk-vt-row mk-vt-ai">
                    <span class="mk-vt-who">AIBMS</span>
                    <span class="mk-vt-text">"Q4 revenue is $2.8M — up 22% from last quarter. I've automatically reconciled the latest invoices. Want me to send a summary?"</span>
                  </div>
                  <div class="mk-vt-row mk-vt-user">
                    <span class="mk-vt-who">You</span>
                    <span class="mk-vt-text">"Yes, and flag the Horizon Labs risk."</span>
                  </div>
                  <div class="mk-vt-row mk-vt-ai mk-vt-current">
                    <span class="mk-vt-who">AIBMS</span>
                    <span class="mk-vt-text">"Done. Report sent. Horizon Labs flagged with 3-day follow-up reminder set for Sarah…"<span class="mk-cursor-blink">▌</span></span>
                  </div>
                </div>
                <!-- Action chips -->
                <div class="mk-voice-actions">
                  <div class="mk-va-chip"><span>📧</span> Report sent</div>
                  <div class="mk-va-chip"><span>🔔</span> Reminder set</div>
                  <div class="mk-va-chip mk-va-live"><span>🎙️</span> Listening</div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div><!-- /slider-track -->
    </div><!-- /slider-viewport -->

    <!-- Footer controls -->
    <div class="slider-footer">
      <button class="slider-arrow" id="btnPrev" aria-label="Previous">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>

      <div class="slider-dots" id="sliderDots"></div>

      <button class="slider-arrow" id="btnNext" aria-label="Next">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 2l5 5-5 5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
    </div>

  </div><!-- /showcase-inner -->
</section><!-- /showcase -->

<script>
/* ═══════════════════════════════════════════════════════════
   SCROLL REVEAL
═══════════════════════════════════════════════════════════ */
const revObserver = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('vis');
      revObserver.unobserve(e.target);
    }
  });
}, { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach(el => revObserver.observe(el));

/* ═══════════════════════════════════════════════════════════
   SLIDER ENGINE
═══════════════════════════════════════════════════════════ */
const SLIDE_COUNT   = 6;
const AUTO_INTERVAL = 2000;   // ms between auto-advances
const FILL_INTERVAL = 80;     // ms per progress fill tick

let current      = 0;
let autoTimer    = null;
let fillTimer    = null;
let fillProgress = 0;
let isHovered    = false;

const track      = document.getElementById('sliderTrack');
const tabBtns    = document.querySelectorAll('.tab-btn');
const slides     = document.querySelectorAll('.slide');
const dotsWrap   = document.getElementById('sliderDots');
const tabSlider=null;
const tabNav     = document.getElementById('tabNav');
const viewport   = document.getElementById('sliderViewport');

/* ── Build dot indicators ── */
let dots = [];
for (let i = 0; i < SLIDE_COUNT; i++) {
  const d = document.createElement('button');
  d.className = 's-dot' + (i === 0 ? ' active' : '');
  d.setAttribute('aria-label', \`Go to slide \${i + 1}\`);
  d.innerHTML = '<div class="s-dot-fill"></div>';
  d.addEventListener('click', () => goTo(i, true));
  dotsWrap.appendChild(d);
  dots.push(d);
}

/* ── Tab slider indicator (the moving bg pill) ── */
function positionTabSlider(btn){}

// Init on load (after layout)
requestAnimationFrame(() => {
  requestAnimationFrame(() => positionTabSlider(tabBtns[0]));
});

/* ── Core: go to slide ── */
function goTo(idx, manual = false) {
  if (idx === current && !manual) return;

  const prev = current;
  current = ((idx % SLIDE_COUNT) + SLIDE_COUNT) % SLIDE_COUNT;
  if (prev === current) return;

  // ── 1. Update tab + dot state immediately (visual feedback) ──
  tabBtns[prev].classList.remove('active');
  tabBtns[prev].setAttribute('aria-selected', 'false');
  tabBtns[current].classList.add('active');
  tabBtns[current].setAttribute('aria-selected', 'true');
  positionTabSlider(tabBtns[current]);

  dots[prev].classList.remove('active');
  // Reset old fill cleanly via setTimeout so the CSS 'none' transition
  // applies in a separate paint before any new transition starts
  const oldFill = dots[prev].querySelector('.s-dot-fill');
  setTimeout(() => {
    oldFill.style.transition = 'none';
    oldFill.style.width = '0%';
  }, 0);
  dots[current].classList.add('active');

  // ── 2. Slide the track ──
  track.style.transform = \`translateX(-\${current * 100}%)\`;

  // ── 3. Remove .active from old slide (triggers exit transition) ──
  slides[prev].classList.remove('active');

  // ── 4. Add .active to new slide after a brief pause so the
  //       exit transition has begun before the enter starts.
  //       This creates a clean cross-dissolve feel.
  setTimeout(() => {
    slides[current].classList.add('active');
  }, 80);

  // ── 5. Restart fill progress ──
  startFill();

  // ── 6. Restart auto if manually triggered ──
  if (manual) restartAuto();
}

/* ── Progress fill for active dot ── */
function startFill() {
  clearInterval(fillTimer);
  fillProgress = 0;

  // Give the dot's width transition time to expand before the fill starts
  setTimeout(() => {
    const fill = dots[current]?.querySelector('.s-dot-fill');
    if (!fill) return;

    // Reset without transition
    fill.style.transition = 'none';
    fill.style.width = '0%';

    // Force repaint, then begin filling
    fill.getBoundingClientRect();

    fillTimer = setInterval(() => {
      if (isHovered) return;
      fillProgress += 100 / (AUTO_INTERVAL / FILL_INTERVAL);
      const pct = Math.min(fillProgress, 100);
      fill.style.width = pct + '%';
      if (pct >= 100) clearInterval(fillTimer);
    }, FILL_INTERVAL);
  }, 60); // slight delay so dot width transition completes first
}

/* ── Auto advance ── */
function startAuto() {
  clearInterval(autoTimer);
  autoTimer = setInterval(() => {
    if (!isHovered) goTo(current + 1);
  }, AUTO_INTERVAL);
}

function restartAuto() {
  clearInterval(autoTimer);
  startAuto();
}

/* ── Tab click handlers ── */
tabBtns.forEach((btn, i) => {
  btn.addEventListener('click', () => goTo(i, true));
});

/* ── Arrow buttons ── */
document.getElementById('btnPrev').addEventListener('click', () => goTo(current - 1, true));
document.getElementById('btnNext').addEventListener('click', () => goTo(current + 1, true));

/* ── Pause on hover ── */
viewport.addEventListener('mouseenter', () => { isHovered = true; });
viewport.addEventListener('mouseleave', () => { isHovered = false; });
tabNav.addEventListener('mouseenter',   () => { isHovered = true; });
tabNav.addEventListener('mouseleave',   () => { isHovered = false; });

/* ── Keyboard navigation ── */
document.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft')  goTo(current - 1, true);
  if (e.key === 'ArrowRight') goTo(current + 1, true);
});

/* ── Touch / swipe ── */
let touchStartX = 0;
viewport.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
viewport.addEventListener('touchend',   e => {
  const dx = e.changedTouches[0].clientX - touchStartX;
  if (Math.abs(dx) > 48) { dx < 0 ? goTo(current + 1, true) : goTo(current - 1, true); }
});

/* ── Reposition tab slider on resize ── */
window.addEventListener('resize', () => positionTabSlider(tabBtns[current]));

/* ── Kick everything off ── */
startFill();
startAuto();

/* ═══════════════════════════════════════════════════════════
   MOCKUP BAR HOVER INTERACTION
   (pointer events re-enabled so bars are hoverable)
═══════════════════════════════════════════════════════════ */
document.querySelectorAll('.mk-bars').forEach(wrap => {
  wrap.style.pointerEvents = 'auto';
  wrap.querySelectorAll('.mk-bar').forEach(bar => {
    bar.addEventListener('mouseenter', () => {
      wrap.querySelectorAll('.mk-bar').forEach(b => b.style.opacity = '.28');
      bar.style.opacity = '1';
      bar.style.boxShadow = '0 0 10px rgba(147,51,234,.5)';
    });
    bar.addEventListener('mouseleave', () => {
      wrap.querySelectorAll('.mk-bar').forEach(b => {
        b.style.opacity = '';
        b.style.boxShadow = '';
      });
    });
  });
});
</script>
</body>
</html>
`;
const FULL_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>AIBMS — AI-Powered Business Management</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700;12..96,800&family=DM+Sans:wght@300;400;500&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet"/>
<style>
/* ═══════════════════════════════════════════════════════════════
   § 0  DESIGN TOKEN SYSTEM
   ─────────────────────────────────────────────────────────────
   Single :root block — every value used across analytics,
   CTA, and footer is defined once here. No local overrides.
═══════════════════════════════════════════════════════════════ */
:root {
  /* Backgrounds */
  --bg-page:    #04050d;          /* base page */
  --bg-footer:  #02030a;          /* footer — 1 step darker */
  --bg-card:    rgba(9, 6, 22, .84);
  --bg-surface: rgba(255,255,255,.052);
  --bg-surface2:rgba(255,255,255,.072);

  /* Brand palette */
  --blue:   #4C6EF5;
  --violet: #7C3AED;
  --purple: #9333EA;
  --pink:   #EC4899;
  --cyan:   #06B6D4;
  --green:  #10B981;
  --amber:  #F59E0B;

  /* Gradients */
  --g-brand:  linear-gradient(135deg, #4C6EF5 0%, #9333EA 55%, #EC4899 100%);
  --g-text:   linear-gradient(135deg, #93c5fd 0%, #c084fc 45%, #f9a8d4 100%);
  --g-bright: linear-gradient(120deg, #4C6EF5 0%, #7C3AED 42%, #EC4899 82%, #f97316 100%);
  --g-green:  linear-gradient(135deg, #10B981, #059669);

  /* Borders */
  --border:    rgba(255,255,255,.09);
  --border-hi: rgba(255,255,255,.17);
  --border-card:rgba(255,255,255,.09);

  /* Text opacity scale */
  --t0: rgba(255,255,255,1);     /* headings */
  --t1: rgba(255,255,255,.72);   /* sub-headings, strong body */
  --t2: rgba(255,255,255,.44);   /* body, muted */
  --t3: rgba(255,255,255,.28);   /* labels, captions */
  --t4: rgba(255,255,255,.18);   /* ghost / chart axis */

  /* Typography */
  --f-display: 'Bricolage Grotesque', sans-serif;
  --f-body:    'DM Sans', sans-serif;
  --f-mono:    'DM Mono', monospace;

  --sz-xs:   .60rem;
  --sz-sm:   .65rem;   /* mono labels */
  --sz-md:   .70rem;   /* eyebrow */
  --sz-base: 1rem;
  --sz-sub:  .96rem;   /* section subtitles */

  --w-light:  300;
  --w-reg:    400;
  --w-med:    500;
  --w-semi:   600;
  --w-bold:   800;

  /* Spacing */
  --sp-1:  6px;
  --sp-2:  8px;
  --sp-3: 12px;
  --sp-4: 16px;
  --sp-5: 20px;
  --sp-6: 24px;
  --sp-8: 32px;
  --sp-10:40px;
  --sp-12:48px;
  --sp-16:64px;
  --sp-20:80px;
  --sp-24:96px;
  --sp-30:120px;

  /* Layout */
  --max-w:    1180px;
  --pad-x:    48px;
  --section-y:120px;

  /* Radius */
  --r-xs:  4px;
  --r-sm:  8px;
  --r-md: 14px;
  --r-lg: 20px;
  --r-xl: 24px;
  --r-full:100px;

  /* Shadows */
  --shadow-card:
    0 0 0 1px rgba(255,255,255,.038),
    0 6px 32px rgba(0,0,0,.52),
    inset 0 1px 0 rgba(255,255,255,.055);
  --shadow-card-hover:
    0 0 0 1px rgba(255,255,255,.09),
    0 24px 64px rgba(0,0,0,.62),
    inset 0 1px 0 rgba(255,255,255,.1);

  /* Easings */
  --ease:      cubic-bezier(.25, 1, .5, 1);
  --ease-out:  cubic-bezier(.25, 1, .5, 1);
  --ease-spr:  cubic-bezier(.34, 1.56, .64, 1);
  --ease-expo: cubic-bezier(.16, 1, .3, 1);

  /* Durations */
  --t-fast:   .25s;
  --t-med:    .45s;
  --t-slow:   .75s;
  --t-reveal: .80s;

  /* Grid */
  --grid-px:  80px;
  --grid-col: rgba(255,255,255,.022);
}

/* ═══════════════════════════════════════════════════════════════
   § 1  RESET & BASE
═══════════════════════════════════════════════════════════════ */
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{
  font-family:var(--f-body);
  background:var(--bg-page);
  color:var(--t0);
  -webkit-font-smoothing:antialiased;
  -moz-osx-font-smoothing:grayscale;
  overflow-x:hidden;
}
a{text-decoration:none;color:inherit}

/* ═══════════════════════════════════════════════════════════════
   § 2  SCROLL REVEAL  — bidirectional (in + out)
   ─────────────────────────────────────────────────────────────
   .reveal:     hidden state  (exit — instant, no delay)
   .reveal.vis: visible state (enter — eased, with delay)
   .reveal.entering: applied momentarily on enter to re-enable
                     stagger delays without affecting exit speed
═══════════════════════════════════════════════════════════════ */
.reveal{
  opacity:0;
  transform:translateY(22px);
  /* Exit: fast fade-down, zero delay — snappy dismissal */
  transition:
    opacity   .32s cubic-bezier(.4,0,1,1),
    transform .32s cubic-bezier(.4,0,1,1);
  transition-delay:0s !important;
}
.reveal.entering,
.reveal.vis{
  /* Enter: expo-out ease, stagger delays restored */
  transition:
    opacity   var(--t-reveal) var(--ease-expo),
    transform var(--t-reveal) var(--ease-expo);
}
.reveal.vis{opacity:1;transform:none}

/* Stagger delays — only active during enter (.entering / .vis) */
.reveal.entering.d1,.reveal.vis.d1{transition-delay:.08s}
.reveal.entering.d2,.reveal.vis.d2{transition-delay:.16s}
.reveal.entering.d3,.reveal.vis.d3{transition-delay:.24s}
.reveal.entering.d4,.reveal.vis.d4{transition-delay:.32s}

/* Footer col stagger — same pattern */
.ft-col{
  opacity:0;transform:translateY(18px);
  transition:opacity .32s cubic-bezier(.4,0,1,1),transform .32s cubic-bezier(.4,0,1,1);
  transition-delay:0s !important;
}
.ft-col.entering,.ft-col.vis{
  transition:opacity var(--t-slow) var(--ease-expo),transform var(--t-slow) var(--ease-expo);
}
.ft-col.vis{opacity:1;transform:none}
.ft-col.entering:nth-child(2),.ft-col.vis:nth-child(2){transition-delay:.06s}
.ft-col.entering:nth-child(3),.ft-col.vis:nth-child(3){transition-delay:.12s}
.ft-col.entering:nth-child(4),.ft-col.vis:nth-child(4){transition-delay:.18s}

/* Footer status / bottom bar — bidirectional */
.ft-status,.ft-btm{
  opacity:0;transform:translateY(10px);
  transition:opacity .32s cubic-bezier(.4,0,1,1),transform .32s cubic-bezier(.4,0,1,1);
  transition-delay:0s !important;
}
.ft-status.entering,.ft-status.vis,
.ft-btm.entering,.ft-btm.vis{
  transition:opacity var(--t-slow) var(--ease-expo),transform var(--t-slow) var(--ease-expo);
}
.ft-status.vis,.ft-btm.vis{opacity:1;transform:none}
.ft-status.entering,.ft-status.vis{transition-delay:.28s}
.ft-btm.entering,.ft-btm.vis{transition-delay:.36s}

/* Card: bidirectional — exit resets to original entrance state */
.card{
  opacity:0;
  transform:translateY(26px) scale(.978);
  transition:
    opacity   var(--t-slow) var(--ease-expo),
    transform var(--t-slow) var(--ease-expo),
    box-shadow var(--t-med) var(--ease),
    border-color var(--t-med) var(--ease);
  will-change:transform,opacity;
}
.card.vis{opacity:1;transform:none}

/* ═══════════════════════════════════════════════════════════════
   § 3  SECTION SCAFFOLDING  (identical in every section)
═══════════════════════════════════════════════════════════════ */
.section{
  position:relative;
  padding:var(--section-y) 0;
  overflow:hidden;
  isolation:isolate;
}
.section-inner{
  position:relative;z-index:2;
  max-width:var(--max-w);
  margin:0 auto;
  padding:0 var(--pad-x);
}

/* Shared bg fade — same height/gradient in every section */
.s-fade{
  position:absolute;left:0;right:0;pointer-events:none;z-index:1;
}
.s-fade-top{top:0;height:140px;
  background:linear-gradient(to bottom,var(--bg-page) 15%,transparent)}
.s-fade-bot{bottom:0;height:140px;
  background:linear-gradient(to top,var(--bg-page) 15%,transparent)}

/* Shared grid overlay */
.s-grid{
  position:absolute;inset:0;z-index:0;pointer-events:none;
  background-image:
    linear-gradient(var(--grid-col) 1px,transparent 1px),
    linear-gradient(90deg,var(--grid-col) 1px,transparent 1px);
  background-size:var(--grid-px) var(--grid-px);
  mask-image:radial-gradient(ellipse 90% 75% at 50% 50%,black 15%,transparent 80%);
}

/* Shared ambient mesh — each section overrides --s-mesh-bg */
.s-bg{
  position:absolute;inset:0;z-index:0;pointer-events:none;
  background:var(--s-mesh-bg,none);
  animation:bg-breathe 14s ease-in-out infinite alternate;
}
@keyframes bg-breathe{
  0%  {opacity:.75;filter:hue-rotate(0deg)  brightness(1)}
  100%{opacity:1;  filter:hue-rotate(16deg) brightness(1.06)}
}

/* Shared aurora sweep */
.s-aurora{
  position:absolute;inset:0;z-index:0;pointer-events:none;
  background:linear-gradient(108deg,
    transparent 0%,
    rgba(76,110,245,.08) 22%,
    rgba(147,51,234,.14) 50%,
    rgba(236,72,153,.08) 78%,
    transparent 100%);
  background-size:280% 280%;
  animation:aurora 14s ease-in-out infinite alternate;
}
@keyframes aurora{
  0%  {background-position:0%  50%;opacity:.5}
  50% {background-position:100% 50%;opacity:1}
  100%{background-position:0%  50%;opacity:.65}
}

/* Shared radial vignette */
.s-vig{
  position:absolute;inset:0;z-index:3;pointer-events:none;
  background:radial-gradient(ellipse 88% 88% at 50% 50%,
    transparent 30%, rgba(4,5,13,.82) 100%);
}

/* ═══════════════════════════════════════════════════════════════
   § 4  SHARED HEADER COMPONENTS  (eyebrow + title + sub)
═══════════════════════════════════════════════════════════════ */
.sec-head{
  text-align:center;
  margin-bottom:var(--sp-16);
}

/* Eyebrow pill — same structure everywhere */
.eyebrow{
  display:inline-flex;align-items:center;gap:9px;
  padding:6px 16px 6px 8px;
  background:var(--bg-surface);
  border:1px solid rgba(255,255,255,.12);
  border-radius:var(--r-full);
  margin-bottom:var(--sp-6);
  box-shadow:
    0 0 0 1px rgba(255,255,255,.038),
    0 0 28px rgba(147,51,234,.16),
    inset 0 1px 0 rgba(255,255,255,.07);
}
.ey-dot{
  width:7px;height:7px;border-radius:50%;
  background:var(--g-brand);
  box-shadow:0 0 9px rgba(147,51,234,.9);
  flex-shrink:0;
  animation:dot-pulse 2.4s ease-in-out infinite;
}
@keyframes dot-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.46;transform:scale(.76)}}
.ey-txt{
  font-family:var(--f-mono);font-size:var(--sz-md);
  font-weight:var(--w-med);letter-spacing:.13em;
  text-transform:uppercase;color:var(--t1);
}
.ey-tag{
  font-family:var(--f-mono);font-size:.58rem;font-weight:700;
  letter-spacing:.1em;text-transform:uppercase;
  padding:2px 8px;border-radius:var(--r-full);
  background:linear-gradient(135deg,rgba(76,110,245,.28),rgba(236,72,153,.28));
  border:1px solid rgba(255,255,255,.13);color:var(--t1);
}

/* Section title */
.sec-title{
  font-family:var(--f-display);
  font-size:clamp(2rem,4vw,3.2rem);
  font-weight:var(--w-bold);
  letter-spacing:-.04em;line-height:1.1;
  color:var(--t0);margin-bottom:var(--sp-2);
}
.grad{
  background:var(--g-text);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
  filter:drop-shadow(0 0 20px rgba(147,51,234,.35));
}

/* Section subtitle */
.sec-sub{
  font-size:var(--sz-sub);font-weight:var(--w-light);
  color:var(--t2);line-height:1.75;
  max-width:520px;margin:var(--sp-2) auto 0;
}

/* ═══════════════════════════════════════════════════════════════
   § 5  CARD BASE SYSTEM
═══════════════════════════════════════════════════════════════ */
.card{
  background:var(--bg-card);
  border:1px solid var(--border-card);
  border-radius:var(--r-xl);
  position:relative;overflow:hidden;
  box-shadow:var(--shadow-card);
  cursor:default;
  /* entrance state */
  opacity:0;transform:translateY(26px) scale(.978);
  transition:
    opacity   var(--t-slow) var(--ease-expo),
    transform var(--t-slow) var(--ease-expo),
    box-shadow var(--t-med) var(--ease),
    border-color var(--t-med) var(--ease);
  will-change:transform,opacity;
}
.card.vis{opacity:1;transform:none}

/* Specular — top-left highlight */
.card::before{
  content:'';position:absolute;
  top:0;left:0;width:58%;height:50%;
  background:radial-gradient(ellipse at 10% 10%,rgba(255,255,255,.042) 0%,transparent 65%);
  border-radius:var(--r-xl) 0 0 0;pointer-events:none;z-index:0;
}
/* Bottom sweep reveal */
.card::after{
  content:'';position:absolute;
  bottom:0;left:12%;right:12%;height:1px;
  background:var(--c-sweep,linear-gradient(90deg,transparent,rgba(147,51,234,.55),transparent));
  opacity:0;transition:opacity var(--t-med) var(--ease);z-index:1;
}
.card:hover::after{opacity:1}
.card:hover{
  transform:translateY(-6px) scale(1.014);
  border-color:var(--border-hi);
  box-shadow:
    var(--shadow-card-hover),
    0 0 48px var(--c-glow,rgba(76,110,245,.2));
  transition:
    transform    var(--t-med) var(--ease-spr),
    box-shadow   var(--t-med) var(--ease),
    border-color var(--t-med) var(--ease);
}

/* Top accent stripe */
.c-stripe{
  position:absolute;top:0;left:0;right:0;
  height:2px;z-index:3;
  background:var(--c-stripe-grad);
  box-shadow:var(--c-stripe-glow);
}

/* ═══════════════════════════════════════════════════════════════
   § 6  ANALYTICS SECTION
═══════════════════════════════════════════════════════════════ */
#analytics{
  --s-mesh-bg:
    radial-gradient(ellipse 64% 54% at 11% 48%,rgba(76,110,245,.14) 0%,transparent 58%),
    radial-gradient(ellipse 54% 64% at 89% 37%,rgba(147,51,234,.13) 0%,transparent 58%),
    radial-gradient(ellipse 50% 50% at 50% 94%,rgba(236,72,153,.09) 0%,transparent 54%),
    radial-gradient(ellipse 40% 38% at 70% 9%, rgba(6,182,212,.06)  0%,transparent 54%);
}

/* — KPI grid — */
.kpi-grid{
  display:grid;
  grid-template-columns:repeat(4,1fr);
  gap:14px;margin-bottom:14px;
}
.kpi-card{padding:28px 24px}

/* Per-card colour tokens — blue / purple / pink / cyan */
.kpi-card[data-c="blue"]  {--c-glow:rgba(76,110,245,.24); --c-sweep:linear-gradient(90deg,transparent,rgba(76,110,245,.6),transparent); --c-stripe-grad:linear-gradient(90deg,transparent,#4C6EF5 40%,#7C3AED,transparent); --c-stripe-glow:0 0 18px rgba(76,110,245,.52),0 0 44px rgba(76,110,245,.18); --na:#93c5fd;--nb:#818cf8;--rgb:76,110,245}
.kpi-card[data-c="purple"]{--c-glow:rgba(147,51,234,.24); --c-sweep:linear-gradient(90deg,transparent,rgba(147,51,234,.6),transparent); --c-stripe-grad:linear-gradient(90deg,transparent,#7C3AED 40%,#9333EA,transparent); --c-stripe-glow:0 0 18px rgba(147,51,234,.52),0 0 44px rgba(147,51,234,.18); --na:#c084fc;--nb:#d4b5ff;--rgb:147,51,234}
.kpi-card[data-c="pink"]  {--c-glow:rgba(236,72,153,.22); --c-sweep:linear-gradient(90deg,transparent,rgba(236,72,153,.6),transparent); --c-stripe-grad:linear-gradient(90deg,transparent,#9333EA 40%,#EC4899,transparent); --c-stripe-glow:0 0 18px rgba(236,72,153,.52),0 0 44px rgba(236,72,153,.18); --na:#f9a8d4;--nb:#fca5c8;--rgb:236,72,153}
.kpi-card[data-c="cyan"]  {--c-glow:rgba(6,182,212,.22);  --c-sweep:linear-gradient(90deg,transparent,rgba(6,182,212,.55),transparent); --c-stripe-grad:linear-gradient(90deg,transparent,#06B6D4 40%,#4C6EF5,transparent); --c-stripe-glow:0 0 18px rgba(6,182,212,.52),0 0 44px rgba(6,182,212,.18); --na:#67e8f9;--nb:#22d3ee;--rgb:6,182,212}

/* KPI internals */
.kpi-top{
  display:flex;align-items:flex-start;justify-content:space-between;
  margin-bottom:18px;position:relative;z-index:1;
}
.kpi-icon{
  width:40px;height:40px;border-radius:var(--r-sm);
  display:flex;align-items:center;justify-content:center;
  font-size:1rem;
  border:1px solid rgba(255,255,255,.08);flex-shrink:0;
  transition:transform var(--t-med) var(--ease-spr);
}
.kpi-card:hover .kpi-icon{transform:scale(1.12) rotate(-5deg)}
.kpi-card[data-c="blue"]  .kpi-icon{background:rgba(76,110,245,.16); box-shadow:0 0 20px rgba(76,110,245,.3)}
.kpi-card[data-c="purple"].kpi-icon{background:rgba(147,51,234,.16); box-shadow:0 0 20px rgba(147,51,234,.3)}
.kpi-card[data-c="pink"]  .kpi-icon{background:rgba(236,72,153,.14); box-shadow:0 0 20px rgba(236,72,153,.26)}
.kpi-card[data-c="cyan"]  .kpi-icon{background:rgba(6,182,212,.14);  box-shadow:0 0 20px rgba(6,182,212,.26)}

.delta{
  font-family:var(--f-mono);font-size:var(--sz-xs);font-weight:700;
  padding:3px 8px;border-radius:var(--r-full);white-space:nowrap;
}
.d-up  {color:#34D399;background:rgba(16,185,129,.1); border:1px solid rgba(16,185,129,.2)}
.d-neu {color:#93c5fd;background:rgba(76,110,245,.1); border:1px solid rgba(76,110,245,.2)}

/* Number halo */
.kpi-num{position:relative;z-index:1;margin-bottom:4px}
.kpi-num::before{
  content:'';position:absolute;inset:-14px -18px;
  background:radial-gradient(ellipse 80% 70% at 28% 58%,rgba(var(--rgb),.15) 0%,transparent 68%);
  pointer-events:none;z-index:0;border-radius:var(--r-md);
  opacity:0;transition:opacity var(--t-med) var(--ease);
}
.card.vis .kpi-num::before{opacity:1}
.card:hover .kpi-num::before{opacity:2}

.kpi-val{
  font-family:var(--f-display);
  font-size:3.4rem;font-weight:var(--w-bold);
  letter-spacing:-.05em;line-height:.95;
  display:flex;align-items:baseline;gap:1px;
  position:relative;z-index:1;
  transition:filter var(--t-med) var(--ease);
}
.card:hover .kpi-val{filter:drop-shadow(0 2px 16px rgba(var(--rgb),.5))}

/* Slot counter */
.slot{overflow:hidden;display:inline-flex;align-items:baseline}
.slot-n{
  display:inline-block;
  transform:translateY(var(--sy,0%));
  transition:transform 1.1s cubic-bezier(.16,1,.3,1);
  font-variant-numeric:tabular-nums;
  font-feature-settings:"tnum";
  will-change:transform;
  background:linear-gradient(135deg,var(--na),var(--nb));
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
}
.kpi-sfx{
  font-size:1.72rem;font-weight:700;margin-left:1px;
  background:linear-gradient(135deg,var(--na),var(--nb));
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
  opacity:.72;
}

/* Label row */
.kpi-rule{
  width:28px;height:1.5px;
  background:linear-gradient(90deg,var(--na),transparent);
  border-radius:2px;margin:8px 0 10px;opacity:.42;
}
.kpi-lbl{
  font-family:var(--f-mono);font-size:var(--sz-sm);
  font-weight:var(--w-med);text-transform:uppercase;letter-spacing:.1em;
  color:var(--t3);margin-bottom:var(--sp-2);position:relative;z-index:1;
}
.kpi-trend{
  display:inline-flex;align-items:center;gap:5px;
  font-family:var(--f-mono);font-size:var(--sz-xs);font-weight:var(--w-med);
  padding:4px 10px;border-radius:var(--r-full);
  position:relative;z-index:1;
  transition:transform var(--t-fast) var(--ease-spr);
}
.card:hover .kpi-trend{transform:translateX(3px)}
.tr-up {color:#34D399;background:rgba(16,185,129,.1); border:1px solid rgba(16,185,129,.2)}
.tr-neu{color:#93c5fd;background:rgba(76,110,245,.1); border:1px solid rgba(76,110,245,.2)}

/* Bottom row */
.btm-grid{
  display:grid;
  grid-template-columns:1.85fr 1fr 1fr;
  gap:14px;
}

.chart-card{
  padding:30px;
  --c-glow: rgba(76,110,245,.2);
  --c-sweep:linear-gradient(90deg,transparent,rgba(76,110,245,.5),transparent);
  --c-stripe-grad:linear-gradient(90deg,transparent,#4C6EF5 35%,#7C3AED,transparent);
  --c-stripe-glow:0 0 18px rgba(76,110,245,.5),0 0 40px rgba(76,110,245,.18);
}
.mini-card{
  padding:28px;
  display:flex;flex-direction:column;justify-content:space-between;
}
.mini-card.donut{
  --c-glow: rgba(147,51,234,.2);
  --c-sweep:linear-gradient(90deg,transparent,rgba(147,51,234,.55),transparent);
  --c-stripe-grad:linear-gradient(90deg,transparent,#9333EA 35%,#EC4899,transparent);
  --c-stripe-glow:0 0 18px rgba(147,51,234,.5),0 0 40px rgba(147,51,234,.18);
  --na:#c084fc;--nb:#d4b5ff;--rgb:147,51,234;
}
.mini-card.bars{
  --c-glow: rgba(236,72,153,.18);
  --c-sweep:linear-gradient(90deg,transparent,rgba(236,72,153,.55),transparent);
  --c-stripe-grad:linear-gradient(90deg,transparent,#EC4899 35%,#9333EA,transparent);
  --c-stripe-glow:0 0 18px rgba(236,72,153,.5),0 0 40px rgba(236,72,153,.18);
  --na:#f9a8d4;--nb:#fca5c8;--rgb:236,72,153;
}

/* Chart card header */
.ch{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:20px;position:relative;z-index:1}
.ch-lbl{font-family:var(--f-mono);font-size:var(--sz-sm);text-transform:uppercase;letter-spacing:.1em;color:var(--t3);font-weight:var(--w-med);margin-bottom:6px}
.ch-val{font-family:var(--f-display);font-size:2.2rem;font-weight:var(--w-bold);letter-spacing:-.04em;display:flex;align-items:baseline;gap:3px;line-height:1}
.ch-val .slot-n{background:linear-gradient(135deg,#93c5fd,#818cf8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.rupee{background:linear-gradient(135deg,#93c5fd,#818cf8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;font-size:1.45rem;font-family:var(--f-display);font-weight:var(--w-bold)}
.arr-unit{font-size:.8rem;font-weight:var(--w-light);color:var(--t3);-webkit-text-fill-color:var(--t3);margin-left:2px}
.ch-tag{font-family:var(--f-mono);font-size:var(--sz-sm);font-weight:700;background:rgba(16,185,129,.1);color:#34D399;border:1px solid rgba(16,185,129,.2);padding:4px 12px;border-radius:var(--r-full);flex-shrink:0}

/* Mini card labels */
.mc-lbl{font-family:var(--f-mono);font-size:var(--sz-sm);font-weight:var(--w-med);text-transform:uppercase;letter-spacing:.1em;color:var(--t3);margin-bottom:9px;position:relative;z-index:1}
.mc-val{font-family:var(--f-display);font-size:2.8rem;font-weight:var(--w-bold);letter-spacing:-.04em;line-height:.95;margin-bottom:5px;position:relative;z-index:1;display:flex;align-items:baseline}
.mc-rule{width:26px;height:1.5px;background:linear-gradient(90deg,var(--na),transparent);border-radius:2px;margin:6px 0 8px;opacity:.4}
.mc-sub{font-size:var(--sz-sub);color:var(--t3);line-height:1.55;position:relative;z-index:1}

/* Donut chart */
.donut-wrap{display:flex;align-items:center;justify-content:center;margin:12px 0 10px}
.legend{display:flex;flex-direction:column;gap:9px;position:relative;z-index:1}
.leg-row{display:flex;align-items:center;gap:9px;font-size:.76rem}
.l-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
.l-name{color:var(--t3);flex:1}
.l-pct{font-family:var(--f-mono);font-weight:var(--w-med);font-size:.72rem}

/* Bar chart */
.bar-lbls{display:flex;justify-content:space-between;font-family:var(--f-mono);font-size:8px;color:var(--t4);margin-bottom:6px;position:relative;z-index:1}
.bar-row{display:flex;align-items:flex-end;gap:5px;height:54px;position:relative;z-index:1}
.bar{flex:1;border-radius:3px 3px 0 0;transform-origin:bottom;transform:scaleY(0);will-change:transform}

/* ═══════════════════════════════════════════════════════════════
   § 7  CTA SECTION
═══════════════════════════════════════════════════════════════ */
#cta{
  padding:calc(var(--section-y) * 1.15) 0;
  --s-mesh-bg:
    radial-gradient(ellipse 72% 60% at 7%  50%, rgba(76,110,245,.30) 0%,transparent 58%),
    radial-gradient(ellipse 60% 70% at 93% 34%, rgba(147,51,234,.38) 0%,transparent 58%),
    radial-gradient(ellipse 55% 55% at 50% 96%, rgba(236,72,153,.22) 0%,transparent 54%),
    radial-gradient(ellipse 44% 44% at 72% 7%,  rgba(6,182,212,.16)  0%,transparent 54%);
}
#cta .s-bg{animation-duration:11s}

/* Violet pulse orb */
.orb-hot{
  position:absolute;z-index:0;pointer-events:none;
  width:360px;height:360px;
  top:50%;left:50%;
  background:radial-gradient(circle,rgba(124,58,237,.38) 0%,transparent 62%);
  filter:blur(48px);
  animation:orb-hot 6s ease-in-out infinite alternate;
  will-change:transform,opacity;
}
@keyframes orb-hot{
  0%  {transform:translate(-50%,-50%) scale(1);  opacity:.65}
  100%{transform:translate(-50%,-50%) scale(1.6);opacity:1}
}
/* White spotlight cone */
.spotlight{
  position:absolute;z-index:2;pointer-events:none;
  top:-8%;left:50%;transform:translateX(-50%);
  width:820px;height:820px;
  background:radial-gradient(ellipse 50% 50% at 50% 0%,
    rgba(255,255,255,.06) 0%,rgba(255,255,255,.016) 42%,transparent 70%);
  animation:spotlight-breathe 9s ease-in-out infinite alternate;
}
@keyframes spotlight-breathe{0%{opacity:.6}100%{opacity:1}}

/* Particle canvas */
#cta-canvas{position:absolute;inset:0;z-index:1;pointer-events:none}

/* CTA content wrapper */
.cta-wrap{
  position:relative;z-index:10;
  max-width:820px;margin:0 auto;
  padding:0 var(--pad-x);
  text-align:center;
}

/* Big headline */
.cta-h{
  font-family:var(--f-display);
  font-size:clamp(2.8rem,7vw,5rem);
  font-weight:var(--w-bold);
  letter-spacing:-.045em;line-height:1.02;
  color:var(--t0);margin-bottom:26px;
  text-shadow:0 2px 40px rgba(0,0,0,.8);
}
.hl-acc{
  background:var(--g-text);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
  filter:drop-shadow(0 0 26px rgba(147,51,234,.58)) drop-shadow(0 0 52px rgba(236,72,153,.26));
  display:inline;
}
.hl-ai{display:inline-block;position:relative}
.hl-ai::after{
  content:'';position:absolute;
  bottom:5px;left:0;right:0;height:3px;
  background:var(--g-brand);
  border-radius:2px;
  animation:ai-bar 3.5s ease-in-out infinite alternate;
}
@keyframes ai-bar{
  0%  {box-shadow:0 0 10px rgba(76,110,245,.8),0 0 22px rgba(76,110,245,.28); filter:hue-rotate(0deg)}
  100%{box-shadow:0 0 16px rgba(236,72,153,.9),0 0 32px rgba(236,72,153,.32); filter:hue-rotate(38deg)}
}

/* CTA subtext */
.cta-sub{
  font-size:clamp(.96rem,2vw,1.16rem);font-weight:var(--w-light);
  color:rgba(255,255,255,.62);
  line-height:1.75;max-width:580px;margin:0 auto var(--sp-10);
}
.cta-sub strong{font-weight:var(--w-semi);color:var(--t1)}

/* Trust items */
.trust-row{
  display:flex;align-items:center;justify-content:center;
  gap:var(--sp-5);flex-wrap:wrap;
  margin-bottom:var(--sp-12);
}
.t-item{
  display:flex;align-items:center;gap:6px;
  font-family:var(--f-mono);font-size:var(--sz-md);font-weight:var(--w-med);
  color:rgba(255,255,255,.54);letter-spacing:.05em;white-space:nowrap;
}
.t-check{
  width:17px;height:17px;border-radius:50%;
  background:rgba(52,211,153,.12);border:1px solid rgba(52,211,153,.34);
  display:flex;align-items:center;justify-content:center;flex-shrink:0;
  box-shadow:0 0 8px rgba(52,211,153,.18);
}
.t-sep{width:3px;height:3px;border-radius:50%;background:rgba(255,255,255,.2)}

/* Button zone */
.btn-zone{
  display:flex;align-items:center;justify-content:center;
  gap:var(--sp-4);flex-wrap:wrap;
  margin-bottom:var(--sp-6);
}

/* Primary button */
.btn-p{
  position:relative;
  display:inline-flex;align-items:center;gap:11px;
  padding:18px 40px;
  border-radius:var(--r-full);
  border:none;cursor:pointer;
  font-family:var(--f-display);
  font-size:1.06rem;font-weight:var(--w-bold);letter-spacing:-.015em;
  color:#fff;text-decoration:none;
  overflow:hidden;isolation:isolate;will-change:transform;
  background:var(--g-bright);
  background-size:250% 250%;background-position:0% 50%;
  box-shadow:
    0 0 0 1.5px rgba(255,255,255,.17),
    0 5px 24px rgba(76,110,245,.48),
    0 10px 50px rgba(147,51,234,.38),
    0 18px 68px rgba(236,72,153,.2),
    inset 0 1px 0 rgba(255,255,255,.24);
  animation:btn-pulse 3.5s ease-in-out infinite;
  transition:
    transform var(--t-med) var(--ease-spr),
    box-shadow var(--t-med) var(--ease),
    background-position .6s var(--ease);
}
@keyframes btn-pulse{
  0%,100%{box-shadow:0 0 0 1.5px rgba(255,255,255,.17),0 5px 24px rgba(76,110,245,.48),0 10px 50px rgba(147,51,234,.38),0 18px 68px rgba(236,72,153,.2),inset 0 1px 0 rgba(255,255,255,.24)}
  50%{box-shadow:0 0 0 1.5px rgba(255,255,255,.24),0 6px 32px rgba(76,110,245,.62),0 12px 60px rgba(147,51,234,.52),0 20px 84px rgba(236,72,153,.3),inset 0 1px 0 rgba(255,255,255,.28)}
}
/* Shine sweep */
.btn-p::before{
  content:'';position:absolute;top:0;left:-115%;width:52%;height:100%;
  background:linear-gradient(90deg,transparent,rgba(255,255,255,.22),transparent);
  transform:skewX(-18deg);
  transition:left .6s var(--ease);pointer-events:none;
}
.btn-p:hover::before{left:165%}
/* Bloom ring */
.btn-p::after{
  content:'';position:absolute;inset:-5px;border-radius:var(--r-full);
  background:var(--g-bright);
  z-index:-1;opacity:0;filter:blur(18px);
  transition:opacity var(--t-med) var(--ease);
}
.btn-p:hover{
  animation:none;
  transform:translateY(-4px) scale(1.04);
  background-position:100% 50%;
  box-shadow:
    0 0 0 1.5px rgba(255,255,255,.26),
    0 10px 36px rgba(76,110,245,.62),
    0 18px 70px rgba(147,51,234,.5),
    0 28px 92px rgba(236,72,153,.3),
    inset 0 1px 0 rgba(255,255,255,.3);
}
.btn-p:hover::after{opacity:.68}
.btn-p:active{transform:translateY(-2px) scale(1.02);transition-duration:.1s}

.btn-arr{
  width:24px;height:24px;
  background:rgba(255,255,255,.2);border-radius:50%;
  display:flex;align-items:center;justify-content:center;
  transition:transform var(--t-med) var(--ease-spr),background var(--t-fast);
  flex-shrink:0;box-shadow:inset 0 1px 0 rgba(255,255,255,.18);
}
.btn-p:hover .btn-arr{transform:translateX(5px) scale(1.16);background:rgba(255,255,255,.3)}

/* Secondary button */
.btn-s{
  position:relative;
  display:inline-flex;align-items:center;gap:10px;
  padding:17px 30px;
  border-radius:var(--r-full);cursor:pointer;
  font-family:var(--f-display);
  font-size:1rem;font-weight:var(--w-semi);letter-spacing:-.01em;
  color:rgba(255,255,255,.78);text-decoration:none;
  background:rgba(255,255,255,.065);
  border:1.5px solid rgba(255,255,255,.17);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.09),0 4px 16px rgba(0,0,0,.36);
  overflow:hidden;isolation:isolate;will-change:transform;
  transition:
    transform var(--t-med) var(--ease-spr),
    box-shadow var(--t-med) var(--ease),
    border-color var(--t-fast) var(--ease),
    color var(--t-fast) var(--ease),
    background var(--t-fast) var(--ease);
}
.btn-s::before{
  content:'';position:absolute;inset:0;
  background:linear-gradient(135deg,rgba(76,110,245,.13),rgba(147,51,234,.09),rgba(236,72,153,.07));
  opacity:0;transition:opacity var(--t-fast);
}
.btn-s:hover{transform:translateY(-3px) scale(1.03);color:var(--t0);border-color:rgba(255,255,255,.3);background:rgba(255,255,255,.1);box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 8px 28px rgba(0,0,0,.44),0 0 36px rgba(147,51,234,.14)}
.btn-s:hover::before{opacity:1}
.btn-s:active{transform:translateY(-1px) scale(1.01);transition-duration:.1s}

.btn-play{
  width:22px;height:22px;border-radius:50%;
  background:rgba(255,255,255,.13);border:1.5px solid rgba(255,255,255,.17);
  display:flex;align-items:center;justify-content:center;
  transition:transform var(--t-med) var(--ease-spr),background var(--t-fast);
}
.btn-s:hover .btn-play{transform:scale(1.16);background:rgba(255,255,255,.2)}

/* Rating row */
.rating-row{display:flex;align-items:center;justify-content:center;gap:16px;flex-wrap:wrap}
.av-stack{display:flex;align-items:center}
.av{
  width:26px;height:26px;border-radius:50%;
  border:2px solid var(--bg-page);margin-left:-8px;
  font-family:var(--f-display);font-size:.54rem;font-weight:var(--w-bold);
  display:flex;align-items:center;justify-content:center;flex-shrink:0;
}
.av:first-child{margin-left:0}
.av-a{background:linear-gradient(135deg,#4C6EF5,#7C3AED)}
.av-b{background:linear-gradient(135deg,#9333EA,#EC4899)}
.av-c{background:linear-gradient(135deg,#EC4899,#f97316)}
.av-d{background:linear-gradient(135deg,#06B6D4,#4C6EF5)}
.av-m{background:rgba(255,255,255,.1);border:2px solid rgba(255,255,255,.15);color:var(--t2);font-family:var(--f-mono);font-size:.5rem}
.r-sep{width:1px;height:14px;background:rgba(255,255,255,.13)}
.stars{display:flex;align-items:center;gap:3px}
.star{width:13px;height:13px;background:#F59E0B;clip-path:polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%);box-shadow:0 0 5px rgba(245,158,11,.5)}
.r-score{font-family:var(--f-mono);font-size:var(--sz-md);color:var(--t2);letter-spacing:.05em}
.r-count{font-family:var(--f-mono);font-size:var(--sz-md);color:var(--t3);letter-spacing:.04em}

/* Floating chips */
.chips{position:absolute;inset:0;z-index:6;pointer-events:none}
.chip{
  position:absolute;
  display:flex;align-items:center;gap:9px;
  padding:9px 15px;
  background:var(--bg-card);
  border:1px solid var(--border-card);
  border-radius:var(--r-md);
  box-shadow:var(--shadow-card);
  white-space:nowrap;opacity:0;
  backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);
}
.chip.show{animation:chip-in .7s var(--ease-expo) var(--d,0s) forwards,chip-bob 5.5s ease-in-out var(--bd,1.5s) infinite}
@keyframes chip-in{from{opacity:0;transform:translateY(10px) scale(.96)}to{opacity:1;transform:none}}
@keyframes chip-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
.chip-ico{width:26px;height:26px;border-radius:var(--r-sm);display:flex;align-items:center;justify-content:center;font-size:.82rem;flex-shrink:0}
.chip-body{display:flex;flex-direction:column;gap:1px}
.chip-lbl{font-family:var(--f-mono);font-size:var(--sz-xs);font-weight:var(--w-med);color:var(--t3);letter-spacing:.04em;text-transform:uppercase}
.chip-val{font-family:var(--f-mono);font-size:.78rem;font-weight:700}
.c1{top:13%;left:4%;   --d:.85s;--bd:1.3s}
.c2{top:19%;right:3%;  --d:1.05s;--bd:1.7s}
.c3{top:52%;left:2%;   --d:1.25s;--bd:2.1s}
.c4{bottom:22%;right:3%;--d:1.45s;--bd:2.5s}
.c5{bottom:15%;left:3%;  --d:1.65s;--bd:2.9s}

/* ═══════════════════════════════════════════════════════════════
   § 8  FOOTER (COMPACT & MODERN)
═══════════════════════════════════════════════════════════════ */
.footer{
  position:relative;
  background:var(--bg-footer);
  overflow:hidden;isolation:isolate;
}

/* Top gradient line divider */
.ft-div{
  position:absolute;top:0;left:0;right:0;height:1px;z-index:2;
  background:linear-gradient(90deg,
    transparent 0%,
    rgba(147,51,234,.4) 40%,
    rgba(236,72,153,.4) 60%,
    transparent 100%);
}

.ft-bg{
  position:absolute;inset:0;z-index:0;pointer-events:none;
  background:
    radial-gradient(ellipse 50% 50% at 50% 120%,rgba(147,51,234,.08) 0%,transparent 70%);
}

.ft-inner{
  position:relative;z-index:3;
  max-width:var(--max-w);margin:0 auto;
  padding:60px var(--pad-x) 40px;
}

.ft-main{
  display:flex;justify-content:space-between;align-items:flex-start;
  gap:40px;padding-bottom:48px;flex-wrap:wrap;
}

.ft-info{max-width:340px}
.logo-wrap{display:flex;align-items:center;gap:10px;margin-bottom:16px}
.logo-icon{
  width:36px;height:36px;border-radius:10px;
  background:var(--g-brand);
  display:flex;align-items:center;justify-content:center;
  box-shadow:0 0 20px rgba(124,58,237,.3);
}
.logo-name{font-family:var(--f-display);font-size:1.15rem;font-weight:var(--w-bold);color:var(--t0)}
.logo-name span{background:var(--g-text);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}

.ft-tagline{
  font-size:.9rem;font-weight:var(--w-light);color:var(--t2);
  line-height:1.6;margin-bottom:24px;
}

.ft-contact-mini{display:flex;flex-direction:column;gap:6px}
.ct-lbl{font-family:var(--f-mono);font-size:.65rem;text-transform:uppercase;color:var(--t3);letter-spacing:.12em}
.ct-val{font-size:.9rem;color:var(--t1);text-decoration:none;transition:color .2s;font-weight:var(--w-med)}
.ct-val:hover{color:var(--t0)}

.ft-nav-compact{display:flex;gap:60px;flex-wrap:wrap}
.ft-nav-group{display:flex;flex-direction:column;gap:14px}
.ft-nav-hd{font-family:var(--f-display);font-size:.75rem;font-weight:var(--w-bold);color:var(--t0);text-transform:uppercase;letter-spacing:.08em}
.ft-nav-links{list-style:none;display:flex;flex-direction:column;gap:10px}
.ft-nav-links a{font-size:.88rem;color:var(--t2);transition:color .2s;display:inline-flex;align-items:center;gap:6px}
.ft-nav-links a:hover{color:var(--t0)}

.socials{display:flex;gap:12px}
.soc{
  width:36px;height:36px;
  background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);
  border-radius:10px;display:flex;align-items:center;justify-content:center;
  color:var(--t2);transition:all .3s cubic-bezier(.4,0,.2,1);
}
.soc:hover{transform:translateY(-3px);color:var(--t0);border-color:rgba(255,255,255,.15);background:rgba(255,255,255,.06);box-shadow:0 6px 16px rgba(0,0,0,.2)}

.ft-btm{
  display:flex;align-items:center;justify-content:space-between;
  padding-top:28px;border-top:1px solid rgba(255,255,255,.06);
  flex-wrap:wrap;gap:20px;
}
.copy{font-family:var(--f-mono);font-size:.78rem;color:var(--t3);letter-spacing:.02em}
.copy span{color:var(--t1);font-weight:700}
.legal{display:flex;gap:20px;align-items:center}
.legal a{font-family:var(--f-mono);font-size:.78rem;color:var(--t3);transition:color .2s}
.legal a:hover{color:var(--t2)}
.l-sep{width:3px;height:3px;border-radius:50%;background:rgba(255,255,255,.15)}
.made{
  font-family:var(--f-mono);font-size:var(--sz-sm);color:var(--t3);letter-spacing:.04em;
  display:flex;align-items:center;gap:5px;
}
.heart{
  background:var(--g-brand);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
  animation:heart-pulse 2.8s ease-in-out infinite;
}
@keyframes heart-pulse{
  0%,100%{filter:drop-shadow(0 0 0px transparent)}
  45%    {filter:drop-shadow(0 0 5px rgba(236,72,153,.65))}
}

/* ═══════════════════════════════════════════════════════════════
   § 9  RESPONSIVE
═══════════════════════════════════════════════════════════════ */
@media(max-width:1060px){
  .chips{display:none}
  .kpi-grid{grid-template-columns:repeat(2,1fr)}
  .btm-grid{grid-template-columns:1fr 1fr}
  .ft-main{justify-content:center;text-align:center}
  .ft-info{max-width:100%}
  .ft-nav-compact{justify-content:center;gap:32px}
  .ft-btm{justify-content:center;text-align:center}
}
@media(max-width:680px){
  :root{--pad-x:20px;--section-y:80px}
  .kpi-grid{grid-template-columns:1fr}
  .btm-grid{grid-template-columns:1fr}
  .kpi-val{font-size:2.8rem}
  .mc-val{font-size:2.4rem}
  .cta-h{font-size:clamp(2.2rem,9vw,3rem)}
  .trust-row{gap:12px}
  .t-sep{display:none}
  .ft-nav-compact{gap:24px 40px}
}
</style>
</head>
<body>

<!-- ═══════════════════════ ANALYTICS ═══════════════════════ -->
<section class="section" id="analytics">
  <div class="s-bg"></div>
  <div class="s-grid"></div>
  <div class="s-aurora"></div>
  <div class="s-fade s-fade-top"></div>
  <div class="s-fade s-fade-bot"></div>
  <div class="s-vig"></div>

  <div class="section-inner">
    <div class="sec-head">
      <div class="eyebrow reveal">
        <div class="ey-dot"></div>
        <span class="ey-txt">Live Impact Data</span>
        <span class="ey-tag">Real-time</span>
      </div>
      <h2 class="sec-title reveal d1">Measurable results,<br/><span class="grad">real business impact.</span></h2>
      <p class="sec-sub reveal d2">AIBMS transforms operations with AI-powered automation — delivering precision metrics that move the bottom line.</p>
    </div>

    <div class="kpi-grid">
      <div class="card kpi-card" data-c="blue" data-delay="0">
        <div class="c-stripe"></div>
        <div class="kpi-top"><div class="kpi-icon">⚡</div><span class="delta d-up">↑ YoY</span></div>
        <div class="kpi-num"><div class="kpi-val"><span class="slot"><span class="slot-n" data-t="40" data-d="0">0</span></span><span class="kpi-sfx">%</span></div></div>
        <div class="kpi-rule"></div>
        <div class="kpi-lbl">Efficiency Increase</div>
        <span class="kpi-trend tr-up">↑ vs industry avg</span>
      </div>
      <div class="card kpi-card" data-c="purple" data-delay="1">
        <div class="c-stripe"></div>
        <div class="kpi-top"><div class="kpi-icon">🚀</div><span class="delta d-up">↑ Speed</span></div>
        <div class="kpi-num"><div class="kpi-val"><span class="slot"><span class="slot-n" data-t="3" data-d="1">0</span></span><span class="kpi-sfx">×</span></div></div>
        <div class="kpi-rule"></div>
        <div class="kpi-lbl">Faster Operations</div>
        <span class="kpi-trend tr-up">↑ Speed multiplier</span>
      </div>
      <div class="card kpi-card" data-c="pink" data-delay="2">
        <div class="c-stripe"></div>
        <div class="kpi-top"><div class="kpi-icon">⏱</div><span class="delta d-up">↑ Daily</span></div>
        <div class="kpi-num"><div class="kpi-val"><span class="slot"><span class="slot-n" data-t="14" data-d="1">0</span></span><span class="kpi-sfx">h</span></div></div>
        <div class="kpi-rule"></div>
        <div class="kpi-lbl">Saved per team / day</div>
        <span class="kpi-trend tr-up">↑ Per team member</span>
      </div>
      <div class="card kpi-card" data-c="cyan" data-delay="3">
        <div class="c-stripe"></div>
        <div class="kpi-top"><div class="kpi-icon">🤖</div><span class="delta d-neu">→ Rate</span></div>
        <div class="kpi-num"><div class="kpi-val"><span class="slot"><span class="slot-n" data-t="98" data-d="1">0</span></span><span class="kpi-sfx">%</span></div></div>
        <div class="kpi-rule"></div>
        <div class="kpi-lbl">Automation coverage</div>
        <span class="kpi-trend tr-neu">→ Within 30 days</span>
      </div>
    </div>

    <div class="btm-grid">
      <!-- Revenue chart -->
      <div class="card chart-card" data-delay="4">
        <div class="c-stripe"></div>
        <div class="ch">
          <div>
            <div class="ch-lbl">Revenue Growth</div>
            <div class="ch-val"><span class="rupee">₹</span><span class="slot"><span class="slot-n" data-t="20" data-d="1">0</span></span><span class="arr-unit">Cr ARR</span></div>
          </div>
          <div class="ch-tag">↑ 64% YoY</div>
        </div>
        <div style="position:relative;z-index:1">
          <svg viewBox="0 0 480 148" xmlns="http://www.w3.org/2000/svg" width="100%" height="148" style="overflow:visible">
            <defs>
              <linearGradient id="aG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#4C6EF5" stop-opacity=".25"/><stop offset="55%" stop-color="#9333EA" stop-opacity=".07"/><stop offset="100%" stop-color="#EC4899" stop-opacity="0"/></linearGradient>
              <linearGradient id="lG" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#4C6EF5"/><stop offset="50%" stop-color="#9333EA"/><stop offset="100%" stop-color="#EC4899"/></linearGradient>
              <filter id="lgf" x="-8%" y="-50%" width="116%" height="200%"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
              <filter id="dgf" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            </defs>
            <line x1="0" y1="28"  x2="480" y2="28"  stroke="rgba(255,255,255,.045)" stroke-width="1"/>
            <line x1="0" y1="64"  x2="480" y2="64"  stroke="rgba(255,255,255,.045)" stroke-width="1"/>
            <line x1="0" y1="100" x2="480" y2="100" stroke="rgba(255,255,255,.045)" stroke-width="1"/>
            <path class="area-p" d="M0,128 C70,123 105,106 152,86 C196,66 222,56 267,40 C310,26 342,30 387,16 C416,8 450,6 480,4 L480,148 L0,148 Z" fill="url(#aG)" opacity="0"/>
            <path class="line-p" d="M0,128 C70,123 105,106 152,86 C196,66 222,56 267,40 C310,26 342,30 387,16 C416,8 450,6 480,4" fill="none" stroke="url(#lG)" stroke-width="2.5" stroke-dasharray="770" stroke-dashoffset="770" stroke-linecap="round" filter="url(#lgf)"/>
            <circle class="c-dot" cx="152" cy="86" r="3.5" fill="#7C3AED" opacity="0" filter="url(#dgf)"/>
            <circle class="c-dot" cx="267" cy="40" r="3.5" fill="#9333EA" opacity="0" filter="url(#dgf)"/>
            <circle class="c-dot" cx="387" cy="16" r="3.5" fill="#EC4899" opacity="0" filter="url(#dgf)"/>
            <circle class="c-dot" cx="480" cy="4"  r="5"   fill="#EC4899" stroke="rgba(4,5,13,.95)" stroke-width="2.5" opacity="0" filter="url(#dgf)"/>
            <text x="10"  y="142" fill="rgba(255,255,255,.18)" font-size="9" font-family="DM Mono,monospace">Q1</text>
            <text x="120" y="142" fill="rgba(255,255,255,.18)" font-size="9" font-family="DM Mono,monospace">Q2</text>
            <text x="238" y="142" fill="rgba(255,255,255,.18)" font-size="9" font-family="DM Mono,monospace">Q3</text>
            <text x="358" y="142" fill="rgba(255,255,255,.18)" font-size="9" font-family="DM Mono,monospace">Q4</text>
            <text x="456" y="142" fill="rgba(255,255,255,.18)" font-size="9" font-family="DM Mono,monospace">Q1'</text>
          </svg>
        </div>
      </div>

      <!-- Donut -->
      <div class="card mini-card donut" data-delay="5">
        <div class="c-stripe"></div>
        <div>
          <div class="mc-lbl">Automation Mix</div>
          <div class="mc-val"><span class="slot"><span class="slot-n" data-t="87" data-d="0">0</span></span><span style="font-size:1.42rem;font-weight:700;background:linear-gradient(135deg,#c084fc,#d4b5ff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;opacity:.72">%</span></div>
          <div class="mc-rule"></div>
          <div class="mc-sub" style="margin-bottom:2px">Tasks automated across<br/>all workflows</div>
          <div class="donut-wrap">
            <svg viewBox="0 0 120 120" width="106" height="106" xmlns="http://www.w3.org/2000/svg">
              <defs><filter id="df" x="-55%" y="-55%" width="210%" height="210%"><feGaussianBlur stdDeviation="1.8" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
              <circle cx="60" cy="60" r="44" fill="none" stroke="rgba(255,255,255,.042)" stroke-width="12"/>
              <circle class="d-seg" cx="60" cy="60" r="44" fill="none" stroke="#4C6EF5" stroke-width="12" stroke-linecap="butt" stroke-dasharray="138 138" stroke-dashoffset="138" transform="rotate(-90 60 60)" filter="url(#df)"/>
              <circle class="d-seg" cx="60" cy="60" r="44" fill="none" stroke="#9333EA" stroke-width="12" stroke-linecap="butt" stroke-dasharray="66 210" stroke-dashoffset="138" transform="rotate(-90 60 60)" filter="url(#df)"/>
              <circle class="d-seg" cx="60" cy="60" r="44" fill="none" stroke="#EC4899" stroke-width="12" stroke-linecap="butt" stroke-dasharray="36 240" stroke-dashoffset="138" transform="rotate(-90 60 60)" filter="url(#df)"/>
            </svg>
          </div>
          <div class="legend">
            <div class="leg-row"><div class="l-dot" style="background:#4C6EF5;box-shadow:0 0 7px rgba(76,110,245,.68)"></div><span class="l-name">Workflow AI</span><span class="l-pct" style="color:#93c5fd">50%</span></div>
            <div class="leg-row"><div class="l-dot" style="background:#9333EA;box-shadow:0 0 7px rgba(147,51,234,.68)"></div><span class="l-name">Data Pipelines</span><span class="l-pct" style="color:#c084fc">24%</span></div>
            <div class="leg-row"><div class="l-dot" style="background:#EC4899;box-shadow:0 0 7px rgba(236,72,153,.68)"></div><span class="l-name">Reporting</span><span class="l-pct" style="color:#f9a8d4">13%</span></div>
          </div>
        </div>
      </div>

      <!-- Bars -->
      <div class="card mini-card bars" data-delay="6">
        <div class="c-stripe"></div>
        <div>
          <div class="mc-lbl">Hours Recovered</div>
          <div class="mc-val"><span class="slot"><span class="slot-n" data-t="4280" data-d="0">0</span></span></div>
          <div class="mc-rule"></div>
          <div class="mc-sub">Total team hours saved<br/>this quarter</div>
        </div>
        <div>
          <div class="bar-lbls"><span>JAN</span><span>FEB</span><span>MAR</span><span>APR</span><span>MAY</span><span>JUN</span><span>JUL</span></div>
          <div class="bar-row">
            <div class="bar" style="height:50%;background:linear-gradient(to top,rgba(76,110,245,.6),rgba(76,110,245,.08))"></div>
            <div class="bar" style="height:58%;background:linear-gradient(to top,rgba(100,70,240,.62),rgba(100,70,240,.08))"></div>
            <div class="bar" style="height:66%;background:linear-gradient(to top,rgba(124,58,237,.65),rgba(124,58,237,.08))"></div>
            <div class="bar" style="height:78%;background:linear-gradient(to top,rgba(147,51,234,.68),rgba(147,51,234,.08))"></div>
            <div class="bar" style="height:70%;background:linear-gradient(to top,rgba(185,50,195,.7),rgba(185,50,195,.08))"></div>
            <div class="bar" style="height:90%;background:linear-gradient(to top,rgba(214,55,160,.73),rgba(214,55,160,.08))"></div>
            <div class="bar" style="height:100%;background:linear-gradient(to top,#EC4899,rgba(236,72,153,.2));box-shadow:0 0 18px rgba(236,72,153,.5)"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ═══════════════════════════ CTA ══════════════════════════ -->
<section class="section" id="cta">
  <div class="s-bg"></div>
  <div class="s-grid"></div>
  <div class="s-aurora"></div>
  <div class="orb-hot"></div>
  <div class="spotlight"></div>
  <canvas id="cta-canvas"></canvas>
  <div class="s-fade s-fade-top"></div>
  <div class="s-fade s-fade-bot"></div>
  <div class="s-vig"></div>

  <div class="chips" id="chips">
    <div class="chip c1"><div class="chip-ico" style="background:rgba(76,110,245,.18)">⚡</div><div class="chip-body"><span class="chip-lbl">Efficiency</span><span class="chip-val" style="color:#93c5fd">+40%</span></div></div>
    <div class="chip c2"><div class="chip-ico" style="background:rgba(52,211,153,.14)">✓</div><div class="chip-body"><span class="chip-lbl">Automation</span><span class="chip-val" style="color:#34D399">98.4%</span></div></div>
    <div class="chip c3"><div class="chip-ico" style="background:rgba(147,51,234,.18)">🚀</div><div class="chip-body"><span class="chip-lbl">Operations</span><span class="chip-val" style="color:#c084fc">3× faster</span></div></div>
    <div class="chip c4"><div class="chip-ico" style="background:rgba(236,72,153,.16)">⏱</div><div class="chip-body"><span class="chip-lbl">Time saved</span><span class="chip-val" style="color:#f9a8d4">14h / day</span></div></div>
    <div class="chip c5"><div class="chip-ico" style="background:rgba(245,158,11,.14)">📈</div><div class="chip-body"><span class="chip-lbl">Revenue</span><span class="chip-val" style="color:#fcd34d">+31% avg</span></div></div>
  </div>

  <div class="cta-wrap">
    <div class="eyebrow reveal" style="margin-bottom:var(--sp-6)">
      <div class="ey-dot"></div>
      <span class="ey-txt">AI-Powered Business Platform</span>
      <span class="ey-tag">Free Trial</span>
    </div>
    <h2 class="cta-h reveal d1">Start Managing Your<br/>Business <span class="hl-acc">Smarter</span><br/>with <span class="hl-acc hl-ai">AI</span></h2>
    <p class="cta-sub reveal d2">Replace your scattered tool stack with one intelligent layer — <strong>automate every workflow</strong>, unlock real-time insights, and take <strong>full control</strong> from a single dashboard.</p>
    <div class="trust-row reveal d3"> 
    </div>
    <div class="btn-zone reveal d4">
      <a href="#" class="btn-p" id="btnP">
        Start
        <span class="btn-arr"><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5h6M5 2l3 3-3 3" stroke="white" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
      </a>
      </a>
    </div>
    <div class="rating-row reveal">
    </div>
  </div>
</section>

<!-- ═══════════════════════════ FOOTER ════════════════════════ -->
<footer class="footer">
  <div class="ft-div"></div>
  <div class="ft-bg"></div>
  <div class="ft-inner">
    <div class="ft-main reveal">
      <!-- Brand & Description -->
      <div class="ft-info">
        <div class="logo-wrap">
          <div class="logo-icon">
            <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
              <path d="M11 3L19 19H3L11 3Z" fill="none" stroke="white" stroke-width="1.8" stroke-linejoin="round"/>
              <line x1="6.5" y1="13" x2="15.5" y2="13" stroke="white" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
          </div>
          <div class="logo-name">AI<span>BMS</span></div>
        </div>
        <p class="ft-tagline">AI-powered business management for modern enterprises. Automate, analyse, and accelerate — everything in one intelligent layer.</p>
        <div class="ft-contact-mini">
          <span class="ct-lbl">Direct Support</span>
          <a href="mailto:hello@aibms.com" class="ct-val">hello@aibms.com</a>
        </div>
      </div>

      <!-- Compact Navigation & Social -->
      <div class="ft-nav-compact">
        <div class="ft-nav-group">
          <span class="ft-nav-hd">Platform</span>
          <ul class="ft-nav-links">
            <li><a href="#">Features</a></li>
            <li><a href="#">Pricing</a></li>
            <li><a href="#">Security</a></li>
          </ul>
        </div>
        <div class="ft-nav-group">
          <span class="ft-nav-hd">Company</span>
          <ul class="ft-nav-links">
            <li><a href="#">About Us</a></li>
            <li><a href="#">Careers</a></li>
            <li><a href="#">Blog</a></li>
          </ul>
        </div>
        <div class="ft-nav-group">
          <span class="ft-nav-hd">Social</span>
          <div class="socials" style="margin-top:2px">
            <a class="soc tw" href="#" aria-label="Twitter"><svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M2 2.5L14 13.5M14 2.5L2 13.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></a>
            <a class="soc li" href="#" aria-label="LinkedIn"><svg width="15" height="15" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="4" height="4" rx="1" fill="currentColor"/><path d="M8 8c0-2 1-2 2-2s3 .5 3 3v3H11v-3c0-1-.5-1.5-1.5-1.5S8 8.2 8 9.5V14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/></svg></a>
            <a class="soc gh" href="#" aria-label="GitHub"><svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M8 2.5a5.5 5.5 0 0 0-1.7 10.7c.3.1.4-.1.4-.3v-1c-1.5.3-1.9-.7-1.9-.7-.3-.7-.7-.9-.7-.9-.5-.3 0-.3 0-.3.6 0 .9.6.9.6.5.8 1.3.6 1.6.4 0-.4.2-.6.4-.8-1.2-.1-2.5-.6-2.5-2.7 0-.6.2-1.1.6-1.5 0-.1-.2-.7.1-1.5 0 0 .5-.2 1.5.6a5 5 0 0 1 2.8 0c1-.8 1.5-.6 1.5-.6.3.8.1 1.4.1 1.5.4.4.6.9.6 1.5 0 2.1-1.3 2.6-2.5 2.7.2.2.4.6.4 1.2v1.8c0 .2.1.4.4.3A5.5 5.5 0 0 0 8 2.5z" fill="currentColor"/></svg></a>
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom Bar -->
    <div class="ft-btm reveal">
      <p class="copy">© 2026 <span>AIBMS</span>. All rights reserved.</p>
      <div class="legal">
        <a href="#">Privacy Policy</a>
        <div class="l-sep"></div>
        <a href="#">Terms of Service</a>
        <div class="l-sep"></div>
        <a href="#">Status</a>
      </div>
    </div>
  </div>
</footer>

<script>
/* ═══════════════════════════════════════════════════════════════
   § A  BIDIRECTIONAL SCROLL REVEAL
   ─────────────────────────────────────────────────────────────
   Both observers keep watching (no unobserve).
   On EXIT  → remove .vis + .entering instantly (fast fade-down)
   On ENTER → add .entering first (restores stagger delays for
              1 frame), then add .vis to trigger the animation.
              .entering is removed after the longest transition
              so delay classes don't persist on exit.
═══════════════════════════════════════════════════════════════ */

/* — Reveal elements (headers, eyebrows, CTA text, etc.) — */
const revealIO = new IntersectionObserver(entries => {
  entries.forEach(e => {
    const el = e.target;
    if (e.isIntersecting) {
      /* 1. Add .entering to restore stagger delay */
      el.classList.add('entering');
      /* 2. rAF so browser registers .entering before .vis */
      requestAnimationFrame(() => {
        el.classList.add('vis');
        /* 3. Clean up .entering after longest possible transition */
        setTimeout(() => el.classList.remove('entering'), 1200);
      });
    } else {
      /* Exit: strip both classes — CSS handles instant fade-down */
      el.classList.remove('vis', 'entering');
    }
  });
}, { threshold: .08, rootMargin: '0px 0px -28px 0px' });

document.querySelectorAll('.reveal, .ft-col, .ft-status, .ft-btm').forEach(el => revealIO.observe(el));

/* ═══════════════════════════════════════════════════════════════
   § B  CARD ENTRANCE — bidirectional with full animation replay
   ─────────────────────────────────────────────────────────────
   EXIT: removes .vis + resets all internal animations to 0
         (counters → "0", bars → scaleY(0), donut → offset=138,
          line → dashoffset=770, area → opacity=0)
         so everything is primed for the next enter.
   ENTER: plays entrance with stagger delay, then re-runs all
          internal animations (counter, bars, chart, donut).
═══════════════════════════════════════════════════════════════ */
const ks = document.createElement('style');
ks.textContent = \`
  @keyframes slot-pop {
    0%   { transform:translateY(var(--sy,0%)) scale(1) }
    40%  { transform:translateY(var(--sy,0%)) scale(1.05) }
    100% { transform:translateY(var(--sy,0%)) scale(1) }
  }
  .slot-n.pop { animation:slot-pop .2s cubic-bezier(.34,1.56,.64,1) forwards }
\`;
document.head.appendChild(ks);

const eExpo    = t => t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
const eElastic = t => {
  const c = 2 * Math.PI / 3;
  return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10*t) * Math.sin((t*10-.75)*c) + 1;
};

/* Active counter RAF handles — cancel on exit so they don't fight resets */
const activeCounters = new WeakMap();

function resetCard(el) {
  /* Cancel any running counter RAFs */
  el.querySelectorAll('.slot-n[data-t]').forEach(n => {
    const raf = activeCounters.get(n);
    if (raf) { cancelAnimationFrame(raf); activeCounters.delete(n); }
    n.textContent = '0';
    /* Reset slot position so enter slide-up works again */
    n.style.transition = 'none';
    n.style.setProperty('--sy', '0%');
  });

  /* Bars → collapse */
  el.querySelectorAll('.bar').forEach(b => {
    b.style.transition = 'transform .3s cubic-bezier(.4,0,1,1)';
    b.style.transform = 'scaleY(0)';
  });

  /* Donut → reset offsets (instant, no transition) */
  el.querySelectorAll('.d-seg').forEach(s => {
    s.style.transition = 'none';
    s.style.strokeDashoffset = '138';
  });

  /* SVG line chart → reset */
  const lp = el.querySelector('.line-p');
  if (lp) {
    lp.style.transition = 'none';
    lp.style.strokeDashoffset = '770';
  }
  const ap = el.querySelector('.area-p');
  if (ap) { ap.style.transition = 'none'; ap.style.opacity = '0'; }
  el.querySelectorAll('.c-dot').forEach(d => { d.style.transition = 'none'; d.style.opacity = '0'; });
}

function runCounter(el) {
  const target = parseFloat(el.dataset.t), dec = parseInt(el.dataset.d) || 0;
  const dur = 2400, t0 = performance.now();

  /* Slot slide-up entry */
  el.style.setProperty('--sy', '72%');
  el.style.transition = 'none';
  el.getBoundingClientRect(); /* force reflow */
  el.style.transition = 'transform 1.15s cubic-bezier(.16,1,.3,1)';
  el.style.setProperty('--sy', '0%');

  let last = -1;
  let rafId;
  (function tick(now) {
    const rt = Math.min((now - t0) / dur, 1);
    const et = rt < .82 ? eExpo(rt/.82)*.92 : .92 + eElastic((rt-.82)/.18)*.08;
    const v = et * target, ci = Math.floor(v);
    if (ci !== last && last !== -1) {
      el.classList.remove('pop'); void el.offsetWidth;
      el.classList.add('pop'); setTimeout(() => el.classList.remove('pop'), 220);
    }
    last = ci; el.textContent = v.toFixed(dec);
    if (rt < 1) { rafId = requestAnimationFrame(tick); activeCounters.set(el, rafId); }
    else { el.textContent = target.toFixed(dec); activeCounters.delete(el); }
  })(t0);
}

function playCardAnimations(el) {
  el.querySelectorAll('.slot-n[data-t]').forEach(n => runCounter(n));

  /* SVG line chart */
  const lp = el.querySelector('.line-p');
  if (lp) {
    lp.style.transition = 'stroke-dashoffset 2.3s cubic-bezier(.16,1,.3,1) .08s';
    lp.style.strokeDashoffset = '0';
    const ap = el.querySelector('.area-p');
    if (ap) { ap.style.transition = 'opacity 1.5s cubic-bezier(.16,1,.3,1) .9s'; ap.style.opacity = '1'; }
    el.querySelectorAll('.c-dot').forEach((d, i) => {
      d.style.transition = \`opacity .5s cubic-bezier(.16,1,.3,1) \${.75+i*.2}s\`;
      d.style.opacity = '1';
    });
  }

  /* Bars — staggered spring */
  el.querySelectorAll('.bar').forEach((b, i) => {
    b.style.transition = \`transform .72s cubic-bezier(.34,1.56,.64,1) \${i*100}ms\`;
    b.style.transform = 'scaleY(1)';
  });

  /* Donut segments */
  const segs = el.querySelectorAll('.d-seg');
  if (segs.length) {
    segs[0].style.transition = 'stroke-dashoffset 1.4s cubic-bezier(.16,1,.3,1) 0s';
    segs[1].style.transition = 'stroke-dashoffset 1.4s cubic-bezier(.16,1,.3,1) .14s';
    segs[2].style.transition = 'stroke-dashoffset 1.4s cubic-bezier(.16,1,.3,1) .28s';
    segs[0].style.strokeDashoffset = '0';
    segs[1].style.strokeDashoffset = '-138';
    segs[2].style.strokeDashoffset = '-204';
  }
}

const cardIO = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    const el = entry.target;
    const delay = (parseInt(el.dataset.delay) || 0) * 130;

    if (entry.isIntersecting) {
      /* ENTER: card fades + slides in, then run all inner animations */
      setTimeout(() => {
        el.classList.add('vis');
        playCardAnimations(el);
      }, delay);
    } else {
      /* EXIT: immediately hide card + reset all inner animations */
      el.classList.remove('vis');
      /* Small timeout so the exit CSS transition starts before reset */
      setTimeout(() => resetCard(el), 280);
    }
  });
}, { threshold: .1 });

document.querySelectorAll('.card').forEach(el => cardIO.observe(el));

/* ─── § C  PARTICLES ─── */
(function() {
  const cv = document.getElementById('cta-canvas'), ctx = cv.getContext('2d');
  const C = [[76,110,245],[124,58,237],[147,51,234],[236,72,153],[6,182,212],[249,163,22]];
  let W, H, pts = [];
  function resize() { W = cv.width = cv.offsetWidth; H = cv.height = cv.offsetHeight; }
  class P {
    constructor(ry) { this.init(ry); }
    init(ry) {
      this.x = Math.random()*W; this.y = ry ? Math.random()*H : H+60;
      this.r = .5+Math.random()*2.4; this.vy = -.12-Math.random()*.5; this.vx = (Math.random()-.5)*.2;
      this.life = 0; this.max = 240+Math.random()*220;
      this.col = C[Math.floor(Math.random()*C.length)];
      this.ph = Math.random()*Math.PI*2; this.ps = .012+Math.random()*.022;
    }
    tick() { this.x+=this.vx; this.y+=this.vy; this.life++; this.ph+=this.ps; if(this.life>this.max||this.y<-12)this.init(false); }
    draw() {
      const p=this.life/this.max,fi=Math.min(p/.12,1),fo=p>.78?1-(p-.78)/.22:1;
      const a=fi*fo*(.65+.35*Math.sin(this.ph))*.8;
      const [r,g,b]=this.col;
      ctx.beginPath(); ctx.arc(this.x,this.y,this.r,0,Math.PI*2);
      ctx.fillStyle=\`rgba(\${r},\${g},\${b},\${a})\`; ctx.fill();
      if(this.r>1.6) { ctx.beginPath(); ctx.arc(this.x,this.y,this.r*2.8,0,Math.PI*2); ctx.fillStyle=\`rgba(\${r},\${g},\${b},\${a*.15})\`; ctx.fill(); }
    }
  }
  function init() {
    resize();
    const n = Math.floor(W*H/12500);
    pts = Array.from({length:n}, () => new P(true));
    window.addEventListener('resize', () => { resize(); pts = Array.from({length:Math.floor(W*H/12500)}, ()=>new P(true)); });
  }
  function loop() { ctx.clearRect(0,0,W,H); pts.forEach(p=>{p.tick();p.draw();}); requestAnimationFrame(loop); }
  init(); loop();
})();

/* ─── § D  CTA CHIPS ─── */
window.addEventListener('load', () => document.querySelectorAll('.chip').forEach(c => c.classList.add('show')));

/* ─── § E  MAGNETIC BUTTONS ─── */
[['btnP',10],['btnS',6]].forEach(([id,str]) => {
  const el = document.getElementById(id); if (!el) return;
  el.addEventListener('mousemove', e => {
    const r = el.getBoundingClientRect();
    const dx = (e.clientX-r.left-r.width/2)/r.width;
    const dy = (e.clientY-r.top-r.height/2)/r.height;
    const sc = id==='btnP' ? 1.04 : 1.03, lift = id==='btnP' ? -4 : -3;
    el.style.transform = \`translateY(\${lift}px) scale(\${sc}) translate(\${dx*str}px,\${dy*str}px)\`;
    if (id==='btnP') el.style.animation = 'none';
  });
  el.addEventListener('mouseleave', () => {
    el.style.transform = '';
    if (id==='btnP') el.style.animation = 'btn-pulse 3.5s ease-in-out infinite';
  });
});

/* ─── § F  NEWSLETTER ─── */
const nlBtn = document.getElementById('nlBtn');
const nlInput = document.querySelector('.nl-input');
if (nlBtn && nlInput) {
  nlBtn.addEventListener('click', () => {
    if (!nlInput.value.trim()) {
      nlInput.style.borderColor = 'rgba(236,72,153,.48)';
      nlInput.style.boxShadow = '0 0 0 3px rgba(236,72,153,.12)';
      nlInput.focus();
      setTimeout(() => { nlInput.style.borderColor=''; nlInput.style.boxShadow=''; }, 1200);
      return;
    }
    nlBtn.innerHTML = \`<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8l4 4 6-6" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>\`;
    nlBtn.style.background = 'linear-gradient(135deg,#10B981,#059669)';
    nlInput.value = ''; nlInput.placeholder = "You're subscribed!";
    setTimeout(() => {
      nlBtn.innerHTML = \`<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 8h12M8 3l5 5-5 5" stroke="white" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>\`;
      nlBtn.style.background = '';
      nlInput.placeholder = 'you@company.com';
    }, 3000);
  });
}
</script>
<script>
(function(){
  window.addEventListener('load',function(){
    document.querySelectorAll('#btnP,.btn-p').forEach(function(el){el.addEventListener('click',function(e){e.preventDefault();window.parent.postMessage({type:'AIBMS_NAVIGATE',to:'/signup'},'*');});});
  });
})();
</script>
</body>
</html>
`;

function AutoFrame({ html, minHeight, frameId }) {
  const ref = useRef(null);
  useEffect(() => {
    const iframe = ref.current; if (!iframe) return;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    iframe.src = url;
    function expand() {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        const h = Math.max(doc.body.scrollHeight, doc.body.offsetHeight, doc.documentElement.scrollHeight, doc.documentElement.offsetHeight);
        if (h > 100) iframe.style.height = h + "px";
      } catch (e) { }
    }
    iframe.addEventListener("load", function () { expand(); setTimeout(expand, 400); setTimeout(expand, 1000); setTimeout(expand, 2500); });
    return () => URL.revokeObjectURL(url);
  }, [html]);
  return (<iframe id={frameId} ref={ref} scrolling="no" style={{ width: "100%", height: minHeight || "200px", border: "none", display: "block", background: "#03040e" }} />);
}

export default function LandingPage() {
  const navigate = useNavigate();
  useEffect(() => {
    document.documentElement.style.scrollBehavior = "smooth";
    return () => { document.documentElement.style.scrollBehavior = ""; };
  }, []);
  useEffect(() => {
    const handler = (e) => {
      if (e.data?.type === "AIBMS_NAVIGATE") navigate(e.data.to);
      if (e.data?.type === "AIBMS_SCROLL") {
        const map = {
          features: "frame-showcase",
          impact: "frame-full",
          contact: "frame-full",
        };
        const frameId = map[e.data.to];
        if (!frameId) return;
        const iframe = document.getElementById(frameId);
        if (!iframe) return;
        // For 'contact' and 'impact' scroll to bottom of full frame, else top of frame
        const rect = iframe.getBoundingClientRect();
        const scrollY = window.scrollY + rect.top + (e.data.to === 'features' ? 0 : e.data.to === 'impact' ? rect.height * 0.42 : rect.height * 0.88);
        window.scrollTo({ top: scrollY - 70, behavior: 'smooth' });
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [navigate]);
  return (
    <div style={{ background: "#03040e", overflowX: "hidden" }}>
      <AutoFrame html={HERO_HTML} minHeight="100vh" frameId="frame-hero" />
      <AutoFrame html={MARQUEE_HTML} minHeight="700px" frameId="frame-marquee" />
      <AutoFrame html={SHOWCASE_HTML} minHeight="1000px" frameId="frame-showcase" />
      <AutoFrame html={FULL_HTML} minHeight="1600px" frameId="frame-full" />
    </div>
  );
}