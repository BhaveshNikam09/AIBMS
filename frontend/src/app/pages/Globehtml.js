// GlobeHtml.js — plain JS module, NOT .jsx
// Babel will NOT apply JSX transforms here.
// Import in Landing.jsx: import { GLOBE_HTML } from './GlobeHtml';

export const GLOBE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>AIBMS — Global Layer</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700;12..96,800&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,400&display=swap" rel="stylesheet"/>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{width:100%;overflow-x:hidden;-webkit-font-smoothing:antialiased}
body{
  font-family:'DM Sans',sans-serif;
  background:#03040e;
  color:#fff;
  min-height:100vh;
}

:root{
  --c0:#4C6EF5;
  --c1:#7C3AED;
  --c2:#9C36B5;
  --c3:#E64980;
  --c4:#15AABF;
  --g:linear-gradient(135deg,#4C6EF5 0%,#9C36B5 55%,#E64980 100%);
  --g2:linear-gradient(135deg,#15AABF 0%,#4C6EF5 50%,#9C36B5 100%);
}

/* ── SECTION SHELL ── */
.globe-section{
  position:relative;
  width:100%;
  min-height:100vh;
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  overflow:hidden;
  padding:80px 24px 100px;
}

/* ── BACKGROUND ── */
.bg-deep{
  position:absolute;inset:0;z-index:0;
  background:
    radial-gradient(ellipse 90% 70% at 50% 50%,rgba(12,14,40,1) 0%,#03040e 70%),
    radial-gradient(ellipse 60% 40% at 50% 100%,rgba(76,110,245,.07) 0%,transparent 60%);
}
.bg-grid{
  position:absolute;inset:0;z-index:1;pointer-events:none;
  background-image:
    linear-gradient(rgba(255,255,255,.018) 1px,transparent 1px),
    linear-gradient(90deg,rgba(255,255,255,.018) 1px,transparent 1px);
  background-size:80px 80px;
  mask-image:radial-gradient(ellipse 85% 80% at 50% 50%,black 10%,transparent 80%);
}
.bg-glow-left{
  position:absolute;top:10%;left:-10%;
  width:600px;height:600px;border-radius:50%;
  background:radial-gradient(circle,rgba(76,110,245,.09) 0%,transparent 70%);
  z-index:1;pointer-events:none;
  animation:glow-drift 18s ease-in-out infinite alternate;
}
.bg-glow-right{
  position:absolute;bottom:5%;right:-10%;
  width:500px;height:500px;border-radius:50%;
  background:radial-gradient(circle,rgba(228,73,128,.08) 0%,transparent 70%);
  z-index:1;pointer-events:none;
  animation:glow-drift 22s ease-in-out infinite alternate-reverse;
}
@keyframes glow-drift{
  0%{transform:translate(0,0);}
  100%{transform:translate(40px,-40px);}
}

/* ── LAYOUT ── */
.section-inner{
  position:relative;z-index:10;
  width:100%;max-width:1280px;
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:60px;
  align-items:center;
}
@media(max-width:900px){
  .section-inner{grid-template-columns:1fr;gap:48px;}
  .text-col{text-align:center;align-items:center;}
  .cta-row{justify-content:center;}
}

/* ── TEXT COLUMN ── */
.text-col{
  display:flex;flex-direction:column;
  gap:28px;
  align-items:flex-start;
}

.eyebrow{
  display:flex;align-items:center;gap:10px;
  font-size:.75rem;font-weight:600;letter-spacing:.18em;
  color:rgba(255,255,255,.45);text-transform:uppercase;
}
.eyebrow-line{
  width:32px;height:1px;
  background:linear-gradient(90deg,var(--c0),var(--c2));
  opacity:.7;
}

.headline{
  font-family:'Bricolage Grotesque',sans-serif;
  font-size:clamp(2.2rem,4.5vw,3.6rem);
  font-weight:800;
  line-height:1.08;
  letter-spacing:-.03em;
  color:#fff;
}
.headline em{
  font-style:normal;
  background:var(--g);
  -webkit-background-clip:text;
  -webkit-text-fill-color:transparent;
  background-clip:text;
}

.subheadline{
  font-size:1.05rem;
  font-weight:400;
  line-height:1.7;
  color:rgba(255,255,255,.55);
  max-width:420px;
}
.support-line{
  font-size:.88rem;
  font-weight:400;
  font-style:italic;
  color:rgba(255,255,255,.32);
  max-width:380px;
}

/* ── STAT PILLS ── */
.stat-row{
  display:flex;gap:16px;flex-wrap:wrap;margin-top:4px;
}
.stat-pill{
  display:flex;flex-direction:column;
  padding:14px 20px;
  background:rgba(255,255,255,.04);
  border:1px solid rgba(255,255,255,.08);
  border-radius:14px;
  backdrop-filter:blur(12px);
  gap:2px;
  transition:border-color .3s,background .3s;
}
.stat-pill:hover{
  background:rgba(76,110,245,.08);
  border-color:rgba(76,110,245,.25);
}
.stat-val{
  font-family:'Bricolage Grotesque',sans-serif;
  font-size:1.4rem;font-weight:700;
  background:var(--g);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
}
.stat-lbl{
  font-size:.72rem;color:rgba(255,255,255,.38);letter-spacing:.04em;font-weight:500;
}

/* ── CTA ROW ── */
.cta-row{
  display:flex;gap:14px;align-items:center;flex-wrap:wrap;
  margin-top:8px;
}
.btn-primary{
  display:inline-flex;align-items:center;gap:8px;
  padding:13px 28px;
  background:var(--g);
  border-radius:100px;
  font-size:.92rem;font-weight:600;
  color:#fff;border:none;cursor:pointer;
  box-shadow:0 4px 28px rgba(124,58,237,.4);
  transition:transform .25s cubic-bezier(.34,1.56,.64,1),box-shadow .25s;
  text-decoration:none;
}
.btn-primary:hover{
  transform:translateY(-3px) scale(1.03);
  box-shadow:0 8px 40px rgba(124,58,237,.55);
}
.btn-secondary{
  display:inline-flex;align-items:center;gap:8px;
  padding:13px 24px;
  background:rgba(255,255,255,.06);
  border:1px solid rgba(255,255,255,.12);
  border-radius:100px;
  font-size:.92rem;font-weight:500;
  color:rgba(255,255,255,.75);
  cursor:pointer;
  backdrop-filter:blur(10px);
  transition:background .25s,border-color .25s,color .25s,transform .25s;
  text-decoration:none;
}
.btn-secondary:hover{
  background:rgba(255,255,255,.1);
  border-color:rgba(255,255,255,.22);
  color:#fff;transform:translateY(-2px);
}

/* ── GLOBE COLUMN ── */
.globe-col{
  position:relative;
  display:flex;
  align-items:center;
  justify-content:center;
  height:560px;
}
#globe-canvas{
  position:absolute;
  inset:0;
  width:100%;height:100%;
}

/* ── TOOLTIP ── */
.tooltip{
  position:fixed;z-index:9999;
  pointer-events:none;
  padding:8px 14px;
  background:rgba(8,10,30,.85);
  border:1px solid rgba(76,110,245,.35);
  border-radius:10px;
  backdrop-filter:blur(16px);
  font-size:.78rem;font-weight:600;
  color:#fff;
  white-space:nowrap;
  opacity:0;
  transition:opacity .18s;
  box-shadow:0 4px 24px rgba(0,0,0,.5),0 0 0 1px rgba(76,110,245,.15);
}
.tooltip.vis{opacity:1;}
.tooltip-dot{
  display:inline-block;width:7px;height:7px;border-radius:50%;
  background:var(--g);margin-right:7px;
  box-shadow:0 0 6px rgba(124,58,237,.7);
}

/* ── FEATURE TAGS (below globe) ── */
.feature-tags{
  position:absolute;
  bottom:-10px;left:50%;transform:translateX(-50%);
  display:flex;gap:10px;flex-wrap:wrap;justify-content:center;
  z-index:20;
}
.f-tag{
  display:flex;align-items:center;gap:6px;
  padding:7px 14px;
  background:rgba(255,255,255,.05);
  border:1px solid rgba(255,255,255,.1);
  border-radius:100px;
  font-size:.74rem;font-weight:500;
  color:rgba(255,255,255,.6);
  backdrop-filter:blur(10px);
  animation:tag-float 4s ease-in-out infinite;
}
.f-tag:nth-child(2){animation-delay:.6s;}
.f-tag:nth-child(3){animation-delay:1.2s;}
.f-tag:nth-child(4){animation-delay:1.8s;}
.f-tag-dot{
  width:6px;height:6px;border-radius:50%;
  background:var(--g);
  box-shadow:0 0 6px rgba(76,110,245,.6);
  flex-shrink:0;
}
@keyframes tag-float{
  0%,100%{transform:translateY(0);}
  50%{transform:translateY(-4px);}
}

/* ── GRAIN ── */
#grain{
  position:fixed;inset:0;z-index:9990;
  pointer-events:none;opacity:.022;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Cfilter id='f'%3E%3CfeTurbulence baseFrequency='.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23f)'/%3E%3C/svg%3E");
  background-size:180px;
}

/* entrance animations */
.text-col > *{
  opacity:0;transform:translateY(24px);
  animation:fade-up .7s cubic-bezier(.22,1,.36,1) forwards;
}
.text-col > *:nth-child(1){animation-delay:.1s;}
.text-col > *:nth-child(2){animation-delay:.22s;}
.text-col > *:nth-child(3){animation-delay:.34s;}
.text-col > *:nth-child(4){animation-delay:.44s;}
.text-col > *:nth-child(5){animation-delay:.54s;}
.text-col > *:nth-child(6){animation-delay:.64s;}
@keyframes fade-up{to{opacity:1;transform:none;}}

.globe-col{
  opacity:0;animation:fade-in .9s cubic-bezier(.22,1,.36,1) .3s forwards;
}
@keyframes fade-in{to{opacity:1;}}
</style>
</head>
<body>

<div id="grain"></div>

<!-- Tooltip -->
<div class="tooltip" id="tooltip">
  <span class="tooltip-dot"></span>
  <span id="tooltip-text">Node</span>
</div>

<section class="globe-section">
  <div class="bg-deep"></div>
  <div class="bg-grid"></div>
  <div class="bg-glow-left"></div>
  <div class="bg-glow-right"></div>

  <div class="section-inner">

    <!-- TEXT -->
    <div class="text-col">
      <div class="eyebrow">
        <div class="eyebrow-line"></div>
        Everything you need
        <div class="eyebrow-line"></div>
      </div>

      <h2 class="headline">
        Built for every layer<br>of <em>your business</em>
      </h2>

      <p class="subheadline">
        One intelligent system connecting your finance,
        operations, and decision-making — in real time.
      </p>

      <p class="support-line">
        From local shops to multi-branch enterprises, everything stays in sync.
      </p>

      <div class="stat-row">
        <div class="stat-pill">
          <span class="stat-val">14.2h</span>
          <span class="stat-lbl">Saved per team / day</span>
        </div>
        <div class="stat-pill">
          <span class="stat-val">98.4%</span>
          <span class="stat-lbl">Automation rate</span>
        </div>
        <div class="stat-pill">
          <span class="stat-val">+31%</span>
          <span class="stat-lbl">Avg revenue lift</span>
        </div>
      </div>

      <div class="cta-row">
        <a href="#" class="btn-primary" id="btnP">
          Get Started
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 7h10M7 2l5 5-5 5" stroke="white" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </a>
        <a href="#" class="btn-secondary">
          View Demo
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.4"/>
            <path d="M5.5 5l3 2-3 2V5z" fill="currentColor"/>
          </svg>
        </a>
      </div>
    </div>

    <!-- GLOBE -->
    <div class="globe-col">
      <canvas id="globe-canvas"></canvas>
      <div class="feature-tags">
        <div class="f-tag"><div class="f-tag-dot"></div>Multi-Branch Sync</div>
        <div class="f-tag"><div class="f-tag-dot"></div>Real-time Cashflow</div>
        <div class="f-tag"><div class="f-tag-dot"></div>AI Insights</div>
        <div class="f-tag"><div class="f-tag-dot"></div>Compliance Tracking</div>
      </div>
    </div>

  </div>
</section>

<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script>
(function(){
'use strict';

// ── CONFIG ──────────────────────────────────────────────────────────────
const CFG = {
  radius: 1.8,
  rotSpeed: 0.0012,
  dotCount: 2200,
  nodeCount: 18,
  particleCount: 550,
  colors: {
    globe:    0x0d1033,
    dot:      0x1e2a6e,
    glow:     0x4C6EF5,
    node:     [0x4C6EF5, 0x9C36B5, 0xE64980, 0x15AABF, 0x7C3AED],
    line:     [0x4C6EF5, 0x7C3AED, 0x9C36B5],
    particle: [0x4C6EF5, 0x9C36B5, 0xE64980, 0x15AABF],
    atmo:     0x1a2a8a,
  },
};

const NODE_LABELS = [
  "Multi-Branch Sync","Real-time Cashflow","AI Insights","Compliance Tracking",
  "Inventory Control","GST Automation","Payroll Engine","Sales Forecast",
  "Supply Chain","Customer CRM","Audit Trail","Budget Planner",
  "POS Integration","WhatsApp Alerts","Bank Sync","Data Vault",
  "Staff Attendance","Tax Filing",
];

// ── SCENE SETUP ──────────────────────────────────────────────────────────
const canvas = document.getElementById('globe-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
camera.position.set(0, 0, 6.5);

function resize() {
  const w = canvas.offsetWidth, h = canvas.offsetHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}
resize();
window.addEventListener('resize', resize);

// ── HELPERS ──────────────────────────────────────────────────────────────
function latLonToVec3(lat, lon, r) {
  const phi = (90 - lat) * Math.PI / 180;
  const theta = (lon + 180) * Math.PI / 180;
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
     r * Math.cos(phi),
     r * Math.sin(phi) * Math.sin(theta)
  );
}

function randSpherePoint(r) {
  const u = Math.random(), v = Math.random();
  const theta = 2 * Math.PI * u;
  const phi = Math.acos(2 * v - 1);
  return new THREE.Vector3(
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta)
  );
}

function lerp(a, b, t) { return a + (b - a) * t; }

// ── ATMOSPHERE ───────────────────────────────────────────────────────────
{
  const atmoGeo = new THREE.SphereGeometry(CFG.radius * 1.15, 64, 64);
  const atmoMat = new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.BackSide,
    uniforms: {
      glowColor: { value: new THREE.Color(CFG.colors.atmo) },
      rim: { value: 0.7 },
    },
    vertexShader: \`
      varying vec3 vNormal;
      void main(){
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.);
      }
    \`,
    fragmentShader: \`
      uniform vec3 glowColor;
      uniform float rim;
      varying vec3 vNormal;
      void main(){
        float d = dot(vNormal, vec3(0.,0.,1.));
        float g = pow(1.0 - abs(d), 3.5) * rim;
        gl_FragColor = vec4(glowColor, g * 0.55);
      }
    \`,
  });
  scene.add(new THREE.Mesh(atmoGeo, atmoMat));
}

// ── GLOBE BASE ───────────────────────────────────────────────────────────
const globeGroup = new THREE.Group();
scene.add(globeGroup);

{
  const geo = new THREE.SphereGeometry(CFG.radius, 80, 80);
  const mat = new THREE.MeshPhongMaterial({
    color: CFG.colors.globe,
    shininess: 18,
    transparent: true,
    opacity: 0.92,
  });
  globeGroup.add(new THREE.Mesh(geo, mat));
}

// ── LIGHTS ───────────────────────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0x334466, 1.2));
const dirLight = new THREE.DirectionalLight(0x4C6EF5, 1.0);
dirLight.position.set(5, 3, 4);
scene.add(dirLight);
const rimLight = new THREE.DirectionalLight(0x9C36B5, 0.6);
rimLight.position.set(-4, -2, -3);
scene.add(rimLight);

// ── WIREFRAME DOTS (lat/lon grid look) ───────────────────────────────────
{
  const positions = [];
  const colors = [];
  const col = new THREE.Color(CFG.colors.dot);

  for (let i = 0; i < CFG.dotCount; i++) {
    const lat = (Math.random() * 180) - 90;
    const lon = (Math.random() * 360) - 180;
    // avoid polar extremes a bit
    if (Math.abs(lat) > 82) continue;
    const v = latLonToVec3(lat, lon, CFG.radius + 0.005);
    positions.push(v.x, v.y, v.z);
    // slight color variation
    const t = Math.random();
    colors.push(
      lerp(col.r, 0.35, t * 0.3),
      lerp(col.g, 0.4, t * 0.3),
      lerp(col.b, 0.9, t * 0.3)
    );
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.022, vertexColors: true, transparent: true, opacity: 0.55,
    sizeAttenuation: true,
  });
  globeGroup.add(new THREE.Points(geo, mat));
}

// ── STRATEGIC NODES (business hubs) ──────────────────────────────────────
const NODE_POSITIONS = [
  // India & nearby
  { lat: 19.07, lon: 72.88 }, // Mumbai
  { lat: 28.61, lon: 77.21 }, // Delhi
  { lat: 12.97, lon: 77.59 }, // Bangalore
  { lat: 22.57, lon: 88.36 }, // Kolkata
  { lat: 17.38, lon: 78.49 }, // Hyderabad
  // Asia
  { lat: 1.35,  lon: 103.82 }, // Singapore
  { lat: 35.68, lon: 139.69 }, // Tokyo
  { lat: 31.23, lon: 121.47 }, // Shanghai
  { lat: 25.20, lon: 55.27  }, // Dubai
  // Europe
  { lat: 51.51, lon: -0.13  }, // London
  { lat: 48.86, lon: 2.35   }, // Paris
  { lat: 52.52, lon: 13.40  }, // Berlin
  // Americas
  { lat: 40.71, lon: -74.01 }, // New York
  { lat: 37.77, lon: -122.42 }, // San Francisco
  { lat: -23.55, lon: -46.63 }, // São Paulo
  // Africa / Oceania
  { lat: -33.87, lon: 151.21 }, // Sydney
  { lat: -26.20, lon: 28.04  }, // Johannesburg
  { lat: 6.52,   lon: 3.38   }, // Lagos
];

const nodes = [];
const nodeGroup = new THREE.Group();
globeGroup.add(nodeGroup);

NODE_POSITIONS.forEach((pos, i) => {
  const v = latLonToVec3(pos.lat, pos.lon, CFG.radius + 0.03);
  const color = CFG.colors.node[i % CFG.colors.node.length];

  // Outer ring
  const ringGeo = new THREE.RingGeometry(0.055, 0.082, 32);
  const ringMat = new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0.6, side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);

  // Core dot
  const dotGeo = new THREE.CircleGeometry(0.038, 24);
  const dotMat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
  const dot = new THREE.Mesh(dotGeo, dotMat);

  // Group
  const g = new THREE.Group();
  g.add(ring, dot);

  // Orient to sphere surface
  g.position.copy(v);
  g.lookAt(0, 0, 0);
  g.rotateX(Math.PI / 2);

  nodeGroup.add(g);
  nodes.push({
    group: g, ring, dot,
    pos: v.clone(),
    color,
    label: NODE_LABELS[i % NODE_LABELS.length],
    baseScale: 1,
    hovered: false,
    pulsePhase: Math.random() * Math.PI * 2,
  });
});

// ── CONNECTION LINES ──────────────────────────────────────────────────────
const CONNECTIONS = [
  [0,2],[0,1],[1,3],[2,4],[0,8],[8,9],[9,10],[10,11],
  [12,13],[9,12],[8,7],[7,6],[5,7],[5,6],[14,13],[15,16],
  [0,5],[1,8],[3,5],[4,5],[11,12],[10,12],[16,17],
];

const lineGroup = new THREE.Group();
globeGroup.add(lineGroup);

const lineObjects = [];

function greatCirclePoints(a, b, segments = 60) {
  const pts = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const v = new THREE.Vector3().lerpVectors(a, b, t).normalize().multiplyScalar(CFG.radius + 0.04);
    pts.push(v);
  }
  return pts;
}

CONNECTIONS.forEach(([ai, bi], ci) => {
  if (!NODE_POSITIONS[ai] || !NODE_POSITIONS[bi]) return;
  const a = nodes[ai].pos;
  const b = nodes[bi].pos;
  const pts = greatCirclePoints(a, b);
  const curve = new THREE.CatmullRomCurve3(pts);
  const points = curve.getPoints(80);
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  const color = CFG.colors.line[ci % CFG.colors.line.length];
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.22 });
  const line = new THREE.Line(geo, mat);
  lineGroup.add(line);

  // travelling pulse on this line
  const pulseGeo = new THREE.BufferGeometry();
  const pulsePts = [];
  for (let k = 0; k < 6; k++) pulsePts.push(new THREE.Vector3());
  pulseGeo.setFromPoints(pulsePts);
  const pulseMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.0 });
  const pulseLine = new THREE.Line(pulseGeo, pulseMat);
  lineGroup.add(pulseLine);

  lineObjects.push({
    line, pulseLine, pulseMat, points,
    speed: 0.18 + Math.random() * 0.22,
    progress: Math.random(),
    active: true,
    color,
  });
});

// ── AMBIENT PARTICLES (floating around globe) ─────────────────────────────
const particleGroup = new THREE.Group();
scene.add(particleGroup);
const particleData = [];

{
  const pos = [];
  const col = [];
  for (let i = 0; i < CFG.particleCount; i++) {
    const r = CFG.radius * (1.15 + Math.random() * 0.7);
    const v = randSpherePoint(r);
    pos.push(v.x, v.y, v.z);
    const c = new THREE.Color(CFG.colors.particle[i % CFG.colors.particle.length]);
    col.push(c.r, c.g, c.b);
    particleData.push({
      baseRadius: r,
      theta: Math.random() * Math.PI * 2,
      phi: Math.random() * Math.PI,
      speed: (Math.random() - 0.5) * 0.004,
      offset: Math.random() * Math.PI * 2,
    });
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.028, vertexColors: true, transparent: true, opacity: 0.35,
    sizeAttenuation: true,
  });
  particleGroup.particlesMesh = new THREE.Points(geo, mat);
  particleGroup.add(particleGroup.particlesMesh);
}

// ── RAYCASTER (hover) ─────────────────────────────────────────────────────
const raycaster = new THREE.Raycaster();
raycaster.params.Points.threshold = 0.08;
const mouse = new THREE.Vector2(-10, -10);
const tooltip = document.getElementById('tooltip');
const tooltipText = document.getElementById('tooltip-text');

canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  mouse.x =  ((e.clientX - rect.left)  / rect.width)  * 2 - 1;
  mouse.y = -((e.clientY - rect.top)   / rect.height) * 2 + 1;

  tooltip.style.left = (e.clientX + 16) + 'px';
  tooltip.style.top  = (e.clientY - 8)  + 'px';
});
canvas.addEventListener('mouseleave', () => {
  mouse.set(-10, -10);
  tooltip.classList.remove('vis');
});

// ── CLOCK ────────────────────────────────────────────────────────────────
const clock = new THREE.Clock();
let hoveredNode = null;

// ── ANIMATE ──────────────────────────────────────────────────────────────
function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();
  const dt = clock.getDelta ? clock.getDelta() || 0.016 : 0.016;

  // Globe rotate
  globeGroup.rotation.y += CFG.rotSpeed;

  // Ambient particles drift
  const posArr = particleGroup.particlesMesh.geometry.attributes.position.array;
  particleData.forEach((p, i) => {
    p.theta += p.speed;
    const r = p.baseRadius + Math.sin(t * 0.4 + p.offset) * 0.05;
    posArr[i*3]   = r * Math.sin(p.phi) * Math.cos(p.theta);
    posArr[i*3+1] = r * Math.cos(p.phi);
    posArr[i*3+2] = r * Math.sin(p.phi) * Math.sin(p.theta);
  });
  particleGroup.particlesMesh.geometry.attributes.position.needsUpdate = true;

  // Node pulse & hover
  raycaster.setFromCamera(mouse, camera);
  let foundHover = false;

  nodes.forEach((n, ni) => {
    const s = 1 + Math.sin(t * 1.8 + n.pulsePhase) * 0.18;

    // Check hover using dot world position
    const worldPos = n.pos.clone();
    // account for globe rotation
    worldPos.applyEuler(globeGroup.rotation);
    const screenPos = worldPos.clone().project(camera);
    const dist = Math.sqrt(
      Math.pow(screenPos.x - mouse.x, 2) +
      Math.pow(screenPos.y - mouse.y, 2)
    );

    if (dist < 0.07 && worldPos.z > 0) {
      n.hovered = true;
      foundHover = true;
      hoveredNode = ni;
      n.group.scale.setScalar(s * 1.7);
      n.ring.material.opacity = 0.9;
      canvas.style.cursor = 'pointer';

      tooltipText.textContent = n.label;
      tooltip.classList.add('vis');
    } else {
      n.hovered = false;
      n.group.scale.setScalar(s);
      n.ring.material.opacity = 0.5 + Math.sin(t * 1.4 + n.pulsePhase) * 0.1;
    }
  });

  if (!foundHover) {
    hoveredNode = null;
    canvas.style.cursor = 'default';
    tooltip.classList.remove('vis');
  }

  // Travelling pulses on connections
  lineObjects.forEach((lo) => {
    lo.progress += lo.speed * 0.008;
    if (lo.progress > 1) lo.progress = 0;

    const n = lo.points.length;
    const head = Math.floor(lo.progress * n);
    const tail = Math.max(0, head - 8);
    const slicePts = lo.points.slice(tail, head + 1);

    if (slicePts.length > 1) {
      lo.pulseLine.geometry.setFromPoints(slicePts);
      lo.pulseLine.geometry.attributes.position.needsUpdate = true;
      lo.pulseMat.opacity = 0.75;
    } else {
      lo.pulseMat.opacity = 0;
    }
  });

  renderer.render(scene, camera);
}

// Start
animate();
resize();

})();
</script>
</body>
</html>`;