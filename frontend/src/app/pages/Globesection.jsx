import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

const GLOBE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>AIBMS</title>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=DM+Sans:ital,wght@0,400;0,500;1,400&display=swap" rel="stylesheet"/>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{width:100%;height:100%;overflow:hidden;-webkit-font-smoothing:antialiased}
body{font-family:'DM Sans',sans-serif;background:#03040e;color:#fff}
:root{--g:linear-gradient(135deg,#4C6EF5 0%,#9C36B5 55%,#E64980 100%);--c0:#4C6EF5;--c1:#9C36B5;--c2:#E64980;--c3:#15AABF;}
.wrap{position:relative;width:100vw;height:100vh;display:grid;grid-template-columns:370px 1fr;overflow:hidden;}
.bg{position:absolute;inset:0;z-index:0;background:radial-gradient(ellipse 85% 85% at 65% 50%,rgba(6,9,32,.99) 0%,#03040e 72%);}
.grid-bg{position:absolute;inset:0;z-index:1;pointer-events:none;
  background-image:linear-gradient(rgba(255,255,255,.012) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.012) 1px,transparent 1px);
  background-size:66px 66px;mask-image:radial-gradient(ellipse 90% 90% at 50% 50%,black 10%,transparent 82%);}
#grain{position:fixed;inset:0;z-index:9990;pointer-events:none;opacity:.018;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='f'%3E%3CfeTurbulence baseFrequency='.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23f)'/%3E%3C/svg%3E");
  background-size:160px;}
.left{position:relative;z-index:10;display:flex;flex-direction:column;justify-content:center;padding:0 28px 0 42px;gap:16px;overflow:hidden;}
.eyebrow{display:flex;align-items:center;gap:8px;font-size:.66rem;font-weight:600;letter-spacing:.16em;color:rgba(255,255,255,.3);text-transform:uppercase;}
.eline{width:20px;height:1px;background:linear-gradient(90deg,var(--c0),var(--c1));opacity:.5;}
.headline{font-family:'Bricolage Grotesque',sans-serif;font-size:clamp(1.4rem,1.9vw,1.95rem);font-weight:800;line-height:1.12;letter-spacing:-.03em;}
.headline em{font-style:normal;background:var(--g);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
.tcard{position:relative;padding:16px 18px;background:rgba(255,255,255,.036);border:1px solid rgba(255,255,255,.072);border-radius:13px;backdrop-filter:blur(14px);}
.tcard::before{content:'';position:absolute;top:-1px;left:14px;right:14px;height:1px;background:linear-gradient(90deg,transparent,rgba(76,110,245,.48),rgba(228,73,128,.36),transparent);}
.qmark{font-family:'Bricolage Grotesque',sans-serif;font-size:2.2rem;line-height:.68;font-weight:800;background:var(--g);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;display:block;margin-bottom:4px;}
.qtext{font-size:.8rem;line-height:1.62;color:rgba(255,255,255,.64);font-style:italic;}
.qauthor{display:flex;align-items:center;gap:9px;margin-top:11px;}
.avatar{width:28px;height:28px;border-radius:50%;background:var(--g);display:flex;align-items:center;justify-content:center;font-family:'Bricolage Grotesque',sans-serif;font-size:.65rem;font-weight:700;flex-shrink:0;box-shadow:0 2px 10px rgba(124,58,237,.38);}
.aname{font-size:.73rem;font-weight:600;}.arole{font-size:.62rem;color:rgba(255,255,255,.32);}
.metrics{display:flex;gap:7px;}
.met{flex:1;padding:10px 11px;background:rgba(255,255,255,.036);border:1px solid rgba(255,255,255,.062);border-radius:10px;display:flex;flex-direction:column;gap:2px;}
.mv{font-family:'Bricolage Grotesque',sans-serif;font-size:1.05rem;font-weight:700;background:var(--g);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
.ml{font-size:.59rem;color:rgba(255,255,255,.28);letter-spacing:.02em;}
.trust-lbl{font-size:.59rem;color:rgba(255,255,255,.2);letter-spacing:.1em;text-transform:uppercase;}
.trust-row{display:flex;gap:5px;flex-wrap:wrap;margin-top:5px;}
.ttag{padding:3px 9px;background:rgba(255,255,255,.036);border:1px solid rgba(255,255,255,.062);border-radius:6px;font-size:.63rem;font-weight:600;color:rgba(255,255,255,.3);}
.hint{font-size:.59rem;color:rgba(255,255,255,.16);letter-spacing:.04em;display:flex;align-items:center;gap:5px;}
.hint-k{display:inline-flex;align-items:center;justify-content:center;width:15px;height:15px;border:1px solid rgba(255,255,255,.14);border-radius:3px;font-size:.5rem;}
.right{position:relative;z-index:10;display:flex;align-items:center;justify-content:center;overflow:hidden;cursor:grab;user-select:none;}
.right:active{cursor:grabbing;}
#gc{display:block;width:min(84vh,100%);height:min(84vh,100%);}
.tooltip{position:fixed;z-index:9999;pointer-events:none;padding:6px 11px;background:rgba(3,4,18,.94);border:1px solid rgba(76,110,245,.38);border-radius:8px;backdrop-filter:blur(18px);font-size:.7rem;font-weight:600;color:#fff;white-space:nowrap;opacity:0;transition:opacity .14s;box-shadow:0 4px 18px rgba(0,0,0,.6);}
.tooltip.vis{opacity:1;}.tdot{display:inline-block;width:5px;height:5px;border-radius:50%;background:var(--g);margin-right:5px;vertical-align:middle;}
.left>*{opacity:0;transform:translateY(13px);animation:fup .55s cubic-bezier(.22,1,.36,1) forwards;}
.left>*:nth-child(1){animation-delay:.04s;}.left>*:nth-child(2){animation-delay:.10s;}.left>*:nth-child(3){animation-delay:.16s;}.left>*:nth-child(4){animation-delay:.22s;}.left>*:nth-child(5){animation-delay:.28s;}.left>*:nth-child(6){animation-delay:.34s;}.left>*:nth-child(7){animation-delay:.40s;}
@keyframes fup{to{opacity:1;transform:none;}}
.right{opacity:0;animation:fin .65s ease .08s forwards;}@keyframes fin{to{opacity:1;}}
</style>
</head>
<body>
<div id="grain"></div>
<div class="tooltip" id="tt"><span class="tdot"></span><span id="tt-text"></span></div>
<div class="wrap">
  <div class="bg"></div><div class="grid-bg"></div>
  <div class="left">
    <div class="eyebrow"><div class="eline"></div>Trusted by businesses<div class="eline"></div></div>
    <h2 class="headline">The platform that keeps<br><em>everything connected</em></h2>
    <div class="tcard">
      <span class="qmark">&ldquo;</span>
      <p class="qtext">We replaced 4 tools with AIBMS. The pipeline forecasting alone saved us &#8377;18L in missed deals &mdash; and our team actually uses it every day.</p>
      <div class="qauthor">
        <div class="avatar">RK</div>
        <div><div class="aname">Rahul Kapoor</div><div class="arole">Founder, NexusTech Pvt. Ltd.</div></div>
      </div>
    </div>
    <div class="metrics">
      <div class="met"><span class="mv">4,200+</span><span class="ml">Businesses on AIBMS</span></div>
      <div class="met"><span class="mv">&#8377;340Cr</span><span class="ml">Revenue tracked</span></div>
      <div class="met"><span class="mv">99.8%</span><span class="ml">Uptime SLA</span></div>
    </div>
    <div>
      <div class="trust-lbl">Integrates with</div>
      <div class="trust-row">
        <div class="ttag">Tally</div><div class="ttag">WhatsApp</div><div class="ttag">Razorpay</div><div class="ttag">GST Portal</div><div class="ttag">Zoho</div>
      </div>
    </div>
    <div class="hint">
      <span class="hint-k">&#8592;</span><span class="hint-k">&#8594;</span><span class="hint-k">&#8593;</span><span class="hint-k">&#8595;</span>
      Arrow keys or drag to rotate
    </div>
  </div>
  <div class="right" id="right-panel">
    <canvas id="gc"></canvas>
  </div>
</div>
<div class="tooltip" id="tt"><span class="tdot"></span><span id="tt-text"></span></div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script>
(function(){
'use strict';

// ── DATA ──────────────────────────────────────────────────────────────────────
var LAND_DOTS = [[28.6, 77.2], [19.1, 72.9], [13.0, 77.6], [22.6, 88.4], [17.4, 78.5], [26.9, 80.9], [23.3, 85.3], [21.1, 79.1], [18.5, 73.9], [15.3, 74.0], [12.3, 76.7], [25.4, 81.8], [24.5, 78.0], [27.2, 78.0], [20.3, 85.8], [22.7, 75.9], [23.2, 72.7], [19.7, 75.3], [11.0, 77.0], [28.0, 73.3], [26.1, 91.7], [25.6, 85.1], [30.9, 75.9], [29.0, 77.7], [23.0, 80.0], [24.0, 74.0], [16.5, 81.5], [14.5, 79.5], [17.7, 83.3], [21.5, 86.7], [26.5, 92.8], [27.5, 95.0], [25.0, 93.7], [24.8, 89.0], [23.7, 90.4], [22.3, 91.8], [20.5, 92.9], [10.8, 76.3], [8.5, 77.0], [9.9, 78.1], [11.7, 78.7], [13.6, 79.4], [15.8, 80.5], [17.0, 82.2], [18.8, 84.0], [20.9, 83.0], [22.0, 87.0], [23.5, 87.8], [24.5, 88.0], [25.3, 86.5], [26.8, 83.0], [27.8, 80.0], [29.5, 79.5], [30.5, 78.0], [31.2, 77.5], [32.2, 76.3], [33.0, 74.8], [34.1, 77.6], [25.0, 70.0], [24.0, 69.0], [22.5, 70.5], [21.5, 71.0], [20.8, 71.6], [22.3, 68.9], [40.7, -74.0], [34.0, -118.2], [41.8, -87.6], [29.8, -95.4], [33.4, -112.1], [32.7, -117.2], [47.6, -122.3], [25.8, -80.2], [42.4, -71.1], [45.5, -73.6], [43.7, -79.4], [49.2, -123.1], [51.0, -114.1], [53.5, -113.5], [45.4, -75.7], [44.7, -63.6], [38.9, -77.0], [37.8, -122.4], [36.2, -86.8], [35.2, -97.4], [30.3, -97.7], [32.8, -96.8], [39.8, -86.1], [41.5, -81.7], [42.3, -83.0], [39.1, -84.5], [38.3, -85.8], [40.4, -79.9], [39.9, -75.2], [41.3, -72.9], [42.7, -73.8], [43.0, -76.2], [43.5, -80.5], [44.0, -78.9], [44.5, -88.0], [44.9, -93.1], [46.8, -100.8], [47.9, -97.0], [48.3, -89.3], [46.5, -84.3], [43.6, -70.3], [44.3, -69.8], [59.0, -135.4], [61.2, -149.9], [64.8, -147.7], [60.7, -135.1], [58.3, -134.4], [56.5, -132.4], [54.3, -130.4], [52.1, -128.2], [50.1, -125.0], [48.5, -123.4], [46.9, -124.0], [45.5, -124.0], [42.0, -124.2], [37.5, -122.0], [35.4, -120.9], [34.4, -120.5], [34.0, -117.1], [32.6, -116.4], [31.9, -116.6], [20.9, -86.8], [25.0, -77.3], [18.5, -69.9], [10.5, -66.9], [23.1, -82.4], [15.5, -88.0], [9.9, -84.1], [8.0, -79.5], [6.1, -75.6], [-23.5, -46.6], [-33.5, -70.6], [-12.0, -77.0], [-0.2, -78.5], [-34.9, -56.2], [-25.3, -57.6], [-16.5, -68.1], [10.5, -66.9], [4.7, -74.1], [-2.2, -79.9], [-8.1, -34.9], [-3.7, -38.5], [-1.5, -48.5], [-5.1, -42.8], [-15.8, -47.9], [-19.9, -43.9], [-22.9, -43.2], [-27.6, -48.5], [-30.0, -51.2], [-32.0, -52.1], [-34.6, -58.4], [-38.0, -57.6], [-44.0, -65.1], [-50.0, -68.5], [-53.2, -70.9], [-4.0, -40.0], [-10.0, -37.0], [-8.0, -35.0], [0.0, -60.0], [5.0, -60.0], [8.0, -63.5], [11.0, -74.0], [-1.0, -75.0], [-5.0, -80.0], [-10.0, -75.0], [-15.0, -73.0], [-20.0, -70.0], [-25.0, -70.0], [-30.0, -71.0], [-35.0, -71.0], [-40.0, -73.0], [-45.0, -73.0], [51.5, -0.1], [48.9, 2.4], [52.5, 13.4], [41.4, 2.2], [40.4, -3.7], [38.7, -9.1], [37.0, 15.1], [41.9, 12.5], [59.3, 18.1], [55.7, 37.6], [50.1, 14.4], [47.5, 19.1], [44.8, 20.5], [44.0, 17.4], [45.8, 15.6], [46.1, 14.5], [48.2, 16.4], [47.4, 8.5], [46.5, 6.6], [50.9, 4.4], [52.1, 5.3], [56.2, 10.2], [60.4, 5.3], [59.9, 10.8], [64.1, -21.9], [53.3, -6.3], [55.9, -3.2], [57.2, -2.2], [56.5, -4.0], [54.6, -5.9], [60.2, 25.0], [59.4, 24.7], [56.9, 24.1], [54.7, 25.3], [54.5, 18.5], [52.2, 21.0], [50.1, 19.9], [48.7, 21.2], [47.2, 18.9], [46.1, 23.6], [44.3, 26.1], [42.7, 23.3], [37.9, 23.7], [36.9, 22.4], [40.6, 20.8], [41.3, 19.8], [43.8, 20.5], [44.8, 13.9], [45.3, 14.5], [43.5, 16.4], [42.7, 18.1], [43.0, 17.0], [36.4, 6.6], [36.8, 10.2], [33.9, 9.6], [37.3, 9.8], [30.1, 31.2], [6.5, 3.4], [-26.2, 28.0], [-33.9, 18.4], [0.3, 32.6], [-1.3, 36.8], [-4.0, 39.7], [15.6, 32.5], [12.4, 15.0], [9.0, 38.7], [11.9, 42.8], [2.0, 45.3], [-20.2, 57.5], [-18.9, 47.5], [-4.3, 15.3], [4.4, 18.6], [3.9, 11.5], [6.4, 2.4], [5.6, -0.2], [7.6, -5.3], [12.4, -16.6], [14.7, -17.4], [15.6, -13.4], [12.4, -12.0], [9.5, -13.7], [8.5, -11.2], [6.3, -10.8], [5.3, -4.0], [4.0, -9.7], [2.0, -9.9], [4.4, -7.5], [6.4, -5.6], [7.3, -5.3], [9.0, -1.2], [10.0, 2.1], [11.0, 4.1], [12.0, 8.7], [13.5, 11.1], [14.0, 15.3], [13.5, 2.1], [11.8, -13.7], [8.0, -8.0], [-1.3, 11.9], [-4.3, 15.3], [-4.3, 22.5], [-6.1, 23.7], [-8.8, 13.2], [-12.0, 15.0], [-16.0, 14.0], [-15.0, 28.0], [-13.0, 32.5], [-10.0, 34.0], [-8.0, 35.5], [-6.0, 35.0], [-4.0, 39.6], [-2.0, 29.5], [0.0, 24.0], [2.0, 21.5], [4.0, 18.5], [6.0, 20.0], [8.0, 22.0], [10.0, 19.0], [12.0, 16.5], [-20.0, 44.4], [-25.0, 46.9], [-23.4, 43.7], [-15.0, 46.0], [-18.0, 49.0], [-12.0, 49.0], [-22.0, 30.0], [-27.0, 27.0], [-30.0, 25.0], [-33.0, 22.0], [-34.0, 19.0], [-29.0, 31.0], [-25.0, 32.0], [-20.0, 34.0], [-15.0, 35.0], [-10.0, 40.0], [-5.0, 40.0], [0.0, 42.0], [5.0, 41.0], [10.0, 44.0], [15.0, 39.0], [20.0, 37.0], [25.0, 37.0], [30.0, 33.0], [35.0, 37.0], [35.7, 139.7], [31.2, 121.5], [39.9, 116.4], [22.3, 114.2], [1.3, 103.8], [3.1, 101.7], [13.8, 100.5], [10.8, 106.7], [14.1, 108.3], [16.1, 108.2], [21.0, 105.8], [25.0, 102.5], [30.6, 114.3], [39.5, 106.0], [41.8, 123.4], [43.8, 126.6], [45.7, 126.6], [43.5, 116.1], [47.9, 106.9], [51.2, 71.5], [43.2, 76.9], [55.0, 73.4], [56.5, 84.9], [53.7, 87.1], [52.3, 104.3], [51.8, 107.6], [52.0, 113.5], [50.3, 127.5], [48.5, 135.1], [43.1, 131.9], [45.0, 141.9], [43.8, 144.1], [41.8, 140.7], [36.1, 136.9], [35.7, 140.1], [34.7, 135.5], [33.6, 130.4], [31.6, 130.6], [26.2, 127.7], [24.5, 124.0], [25.7, 55.3], [24.5, 54.4], [23.6, 58.6], [22.3, 59.6], [21.3, 57.5], [17.0, 54.1], [15.4, 44.2], [12.8, 45.0], [11.6, 43.1], [21.5, 39.2], [24.7, 46.7], [24.9, 67.0], [31.5, 74.3], [30.2, 67.0], [25.2, 62.3], [27.5, 68.8], [33.7, 73.1], [34.5, 69.2], [36.7, 67.1], [38.6, 68.8], [38.5, 65.8], [37.9, 58.4], [36.3, 59.6], [35.7, 51.4], [32.4, 53.7], [29.6, 52.5], [35.6, 44.4], [33.3, 44.4], [36.2, 37.2], [37.0, 35.3], [39.9, 32.9], [41.0, 29.0], [40.2, 29.4], [38.4, 27.1], [37.9, 23.7], [40.6, 22.9], [41.1, 25.3], [42.7, 19.7], [55.8, 37.6], [59.9, 30.3], [56.8, 60.6], [55.0, 82.9], [57.2, 65.5], [54.5, 36.3], [-33.9, 151.2], [-37.8, 145.0], [-27.5, 153.0], [-31.9, 115.9], [-34.9, 138.6], [-17.7, 122.2], [-12.5, 130.8], [-19.3, 146.8], [-23.7, 133.9], [-25.3, 152.0], [-20.3, 118.6], [-22.9, 113.7], [-26.3, 113.4], [-29.7, 115.1], [-32.0, 115.7], [-35.0, 117.9], [-34.0, 122.0], [-33.0, 136.0], [-32.0, 133.0], [-31.0, 130.0], [-30.0, 121.0], [-27.0, 114.0], [-24.0, 113.8], [-21.0, 115.0], [-18.0, 122.2], [-15.0, 129.0], [-14.3, 132.0], [-13.5, 135.9], [-12.5, 136.8], [-14.0, 141.5], [-16.9, 145.8], [-19.3, 147.0], [-22.0, 149.8], [-24.0, 151.9], [-26.0, 153.0], [-28.0, 153.5], [-29.5, 153.0], [-35.0, 150.0], [-38.0, 145.5], [-38.0, 147.0], [-37.0, 140.0], [-36.0, 137.0], [-35.5, 138.6], [-34.0, 136.0], [-33.0, 134.0], [-32.0, 133.0], [-5.0, 147.0], [-9.4, 160.0], [-17.7, 168.3], [-21.1, 175.2], [-36.9, 174.8], [-41.3, 174.8], [-43.5, 172.6], [-46.0, 168.4], [55.8, 37.6], [59.9, 30.3], [54.8, 56.0], [56.8, 60.6], [55.0, 73.4], [56.5, 84.9], [53.7, 87.1], [52.3, 104.3], [51.8, 107.6], [52.0, 113.5], [50.3, 127.5], [48.5, 135.1], [43.1, 131.9], [66.5, 86.5], [68.0, 77.0], [70.0, 68.0], [65.0, 60.0], [62.0, 50.0], [60.0, 28.0], [64.0, 40.0], [67.0, 32.0], [69.5, 25.5], [71.0, 25.0], [70.5, 29.0], [69.0, 33.0], [68.0, 39.0], [67.0, 43.0], [65.5, 52.0], [63.0, 56.5], [61.0, 68.0], [60.0, 62.0], [61.0, 69.0], [63.0, 74.0], [64.0, 87.0], [66.0, 77.0], [67.0, 70.0], [68.0, 66.0], [69.0, 61.0], [70.0, 61.5], [71.0, 68.0], [72.0, 80.0], [71.0, 90.0], [70.0, 97.5], [69.5, 104.0], [68.5, 112.0], [67.5, 118.0], [67.0, 125.0], [67.5, 134.0], [68.0, 143.0], [69.0, 152.0], [70.0, 161.0], [70.5, 170.0], [76.0, -42.0], [78.0, -30.0], [80.0, -18.0], [77.0, -18.0], [74.0, -20.0], [72.0, -24.0], [68.0, -30.0], [66.0, -38.0], [64.0, -40.0], [63.0, -50.0], [65.0, -53.0], [68.0, -52.0], [70.0, -52.0], [72.0, -55.0], [74.0, -58.0], [76.0, -65.0], [78.0, -70.0], [80.0, -56.0], [82.0, -42.0], [83.0, -30.0], [83.5, -22.0], [83.0, -15.0], [81.0, -16.0], [51.5, -0.1], [52.5, -1.9], [53.5, -2.2], [54.6, -5.9], [55.9, -3.2], [57.5, -4.2], [58.5, -3.5], [57.0, -2.0], [52.0, -8.5], [53.3, -6.3], [54.2, -8.5], [53.0, -9.0], [-6.2, 106.8], [-7.8, 110.4], [-8.7, 115.2], [3.6, 98.7], [1.6, 110.3], [5.4, 100.4], [14.1, 100.5], [18.0, 102.6], [16.1, 108.2], [10.8, 106.7], [15.0, 103.0], [13.0, 103.0], [11.6, 104.9], [12.5, 104.9], [-8.5, 122.0], [-10.0, 123.5], [-8.6, 125.6], [-8.0, 128.0], [-1.0, 130.0], [0.5, 127.5], [1.5, 128.2], [-0.9, 119.4], [0.5, 101.5], [-2.0, 107.0], [5.8, 116.1], [6.2, 117.9], [5.0, 118.2], [4.0, 117.5], [3.0, 114.0], [1.5, 110.5], [37.6, 127.0], [37.0, 127.8], [35.2, 129.1], [33.5, 126.5], [34.9, 128.6], [37.5, 128.9], [39.0, 125.7], [40.0, 124.4], [41.5, 129.9], [42.5, 130.6]];

var NODE_POS=[
  {a:19.07,o:72.88,l:'Mumbai'},{a:28.61,o:77.21,l:'Delhi'},{a:12.97,o:77.59,l:'Bangalore'},
  {a:22.57,o:88.36,l:'Kolkata'},{a:17.38,o:78.49,l:'Hyderabad'},
  {a:1.35,o:103.82,l:'Singapore'},{a:35.68,o:139.69,l:'Tokyo'},{a:31.23,o:121.47,l:'Shanghai'},
  {a:25.20,o:55.27,l:'Dubai'},{a:51.51,o:-0.13,l:'London'},{a:48.86,o:2.35,l:'Paris'},
  {a:40.71,o:-74.01,l:'New York'},{a:37.77,o:-122.42,l:'San Francisco'},
  {a:-23.55,o:-46.63,l:'Sao Paulo'},{a:-33.87,o:151.21,l:'Sydney'},
  {a:-26.20,o:28.04,l:'Johannesburg'},{a:6.52,o:3.38,l:'Lagos'}
];

var LABELS=['Multi-Branch Sync','Real-time Cashflow','AI Insights','Compliance Tracking',
  'Inventory Control','GST Automation','Payroll Engine','Sales Forecast',
  'Supply Chain','Customer CRM','Audit Trail','Budget Planner',
  'POS Integration','WhatsApp Alerts','Bank Sync','Data Vault','Staff Attendance'];

var CONNS=[[0,1],[0,2],[1,3],[2,4],[0,8],[8,9],[9,10],[9,11],[11,12],[12,13],[9,15],[15,16],[0,5],[5,6],[5,7],[7,6],[14,13],[14,15],[10,11],[2,5],[1,8],[0,9],[3,7]];
var NCOLS=[0x4C6EF5,0x9C36B5,0xE64980,0x15AABF,0x7C3AED];
var LCOLS=[0x4C6EF5,0x15AABF,0x9C36B5,0xE64980,0x7C3AED];

// ── THREE.JS ──────────────────────────────────────────────────────────────────
var cv=document.getElementById('gc');
var R=new THREE.WebGLRenderer({canvas:cv,antialias:true,alpha:true});
R.setPixelRatio(Math.min(window.devicePixelRatio,2));
R.setClearColor(0,0);

var scene=new THREE.Scene();
var cam=new THREE.PerspectiveCamera(36,1,0.1,100);
cam.position.z=5.5;

var GR=1.85; // globe radius

function resize(){
  var w=cv.offsetWidth,h=cv.offsetHeight;
  if(!w||!h)return;
  cam.aspect=w/h;cam.updateProjectionMatrix();
  R.setSize(w,h,false);
}
resize();
window.addEventListener('resize',function(){setTimeout(resize,60);});

function llv(lat,lon,r){
  var phi=(90-lat)*Math.PI/180,theta=(lon+180)*Math.PI/180;
  return new THREE.Vector3(-r*Math.sin(phi)*Math.cos(theta),r*Math.cos(phi),r*Math.sin(phi)*Math.sin(theta));
}

var gg=new THREE.Group();scene.add(gg);

// Lights
scene.add(new THREE.AmbientLight(0x1a2a55,2.0));
var sun=new THREE.DirectionalLight(0x5577cc,1.4);sun.position.set(5,3,5);scene.add(sun);
var rim=new THREE.DirectionalLight(0x5522aa,0.5);rim.position.set(-5,-2,-4);scene.add(rim);

// Ocean base — deep navy
gg.add(new THREE.Mesh(
  new THREE.SphereGeometry(GR,80,80),
  new THREE.MeshPhongMaterial({color:0x040a1e,shininess:40,specular:0x112244})
));

// Outer atmosphere
var atmoMat=new THREE.ShaderMaterial({
  transparent:true,side:THREE.BackSide,
  uniforms:{c:{value:new THREE.Color(0x1a44cc)}},
  vertexShader:'varying vec3 vN;void main(){vN=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:'uniform vec3 c;varying vec3 vN;void main(){float f=pow(1.-abs(dot(vN,vec3(0,0,1))),2.5);gl_FragColor=vec4(c,f*0.72);}'
});
scene.add(new THREE.Mesh(new THREE.SphereGeometry(GR*1.13,64,64),atmoMat));

// Inner rim
var rimMat=new THREE.ShaderMaterial({
  transparent:true,side:THREE.FrontSide,
  uniforms:{c:{value:new THREE.Color(0x2255dd)}},
  vertexShader:'varying vec3 vN;void main(){vN=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:'uniform vec3 c;varying vec3 vN;void main(){float f=pow(1.-abs(dot(vN,vec3(0,0,1))),5.5);gl_FragColor=vec4(c,f*0.32);}'
});
gg.add(new THREE.Mesh(new THREE.SphereGeometry(GR,80,80),rimMat));

// ── LAND DOTS from real coordinates ───────────────────────────────────────────
(function(){
  var pos=[],col=[];
  var c1=new THREE.Color(0x2255aa);
  var c2=new THREE.Color(0x3377cc);
  var c3=new THREE.Color(0x4499ee); // brighter for India region

  LAND_DOTS.forEach(function(d){
    var lat=d[0],lon=d[1];
    // Vary density — more dots near India
    var isIndia=(lat>8&&lat<37&&lon>68&&lon<98);
    var count=isIndia?8:3;
    for(var k=0;k<count;k++){
      var jLat=lat+(Math.random()-0.5)*1.8;
      var jLon=lon+(Math.random()-0.5)*1.8;
      var v=llv(jLat,jLon,GR+0.004);
      pos.push(v.x,v.y,v.z);
      var t=Math.random();
      var r2=isIndia?c3:c2;
      col.push(c1.r+(r2.r-c1.r)*t, c1.g+(r2.g-c1.g)*t, c1.b+(r2.b-c1.b)*t);
    }
    // Base dot
    var v0=llv(lat,lon,GR+0.004);
    pos.push(v0.x,v0.y,v0.z);
    col.push(c2.r,c2.g,c2.b);
  });

  var geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  geo.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
  gg.add(new THREE.Points(geo,new THREE.PointsMaterial({size:0.013,vertexColors:true,transparent:true,opacity:0.92,sizeAttenuation:true})));
})();

// ── OCEAN GRID (subtle) ───────────────────────────────────────────────────────
(function(){
  var pos=[],col=[];
  var oc=new THREE.Color(0x081528);
  for(var i=0;i<1800;i++){
    var lat=(Math.random()*168)-84,lon=(Math.random()*360)-180;
    var v=llv(lat,lon,GR+0.001);
    pos.push(v.x,v.y,v.z);col.push(oc.r,oc.g,oc.b+Math.random()*.03);
  }
  var geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  geo.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
  gg.add(new THREE.Points(geo,new THREE.PointsMaterial({size:0.007,vertexColors:true,transparent:true,opacity:0.35,sizeAttenuation:true})));
})();

// ── NODES ─────────────────────────────────────────────────────────────────────
var nodes=[];
var ng=new THREE.Group();gg.add(ng);

NODE_POS.forEach(function(p,i){
  var v=llv(p.a,p.o,GR+0.022);
  var col=NCOLS[i%NCOLS.length];
  var g=new THREE.Group();

  var ring=new THREE.Mesh(new THREE.RingGeometry(0.038,0.058,32),
    new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:0.75,side:THREE.DoubleSide}));
  var core=new THREE.Mesh(new THREE.CircleGeometry(0.022,24),
    new THREE.MeshBasicMaterial({color:col,side:THREE.DoubleSide}));
  var pulse=new THREE.Mesh(new THREE.RingGeometry(0.058,0.072,32),
    new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:0,side:THREE.DoubleSide}));

  g.add(ring,core,pulse);
  g.position.copy(v);g.lookAt(0,0,0);g.rotateX(Math.PI/2);
  ng.add(g);

  nodes.push({g,ringM:ring.material,pulseM:pulse.material,
    pos:v.clone(),label:LABELS[i%LABELS.length]+' · '+p.l,
    pp:Math.random()*Math.PI*2, isIndia:i<5});
});

// ── CONNECTION ARCS ───────────────────────────────────────────────────────────
var arcObjs=[];
var ag=new THREE.Group();gg.add(ag);

CONNS.forEach(function(c,ci){
  var ai=c[0],bi=c[1];
  if(!nodes[ai]||!nodes[bi])return;
  var a=nodes[ai].pos,b=nodes[bi].pos;
  var pts=[];
  for(var i=0;i<=90;i++){
    var t=i/90;
    var lift=0.055+0.13*Math.sin(t*Math.PI);
    pts.push(new THREE.Vector3().lerpVectors(a,b,t).normalize().multiplyScalar(GR+lift));
  }
  var col=LCOLS[ci%LCOLS.length];

  // Static faint arc
  ag.add(new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({color:col,transparent:true,opacity:0.14})
  ));

  // Animated pulse
  var PLEN=16;
  var pgeo=new THREE.BufferGeometry();
  var ip=[];for(var k=0;k<PLEN;k++)ip.push(new THREE.Vector3());
  pgeo.setFromPoints(ip);
  var pmat=new THREE.LineBasicMaterial({color:col,transparent:true,opacity:0});
  var pl=new THREE.Line(pgeo,pmat);
  ag.add(pl);
  arcObjs.push({pts,pl,pmat,prog:Math.random(),spd:0.12+Math.random()*0.16,plen:PLEN,col});
});

// ── CONTROLS ──────────────────────────────────────────────────────────────────
var rotX=0.1,rotY=0,tRotX=0.1,tRotY=0;
var dragging=false,prevX=0,prevY=0,velX=0,velY=0;
var keys={};

var rp=document.getElementById('right-panel');
rp.addEventListener('mousedown',function(e){dragging=true;velX=velY=0;prevX=e.clientX;prevY=e.clientY;});
window.addEventListener('mousemove',function(e){
  if(!dragging)return;
  var dx=e.clientX-prevX,dy=e.clientY-prevY;
  velX=dx*.006;velY=dy*.006;
  tRotY+=dx*.006;tRotX+=dy*.006;
  tRotX=Math.max(-1.3,Math.min(1.3,tRotX));
  prevX=e.clientX;prevY=e.clientY;
});
window.addEventListener('mouseup',function(){dragging=false;});
rp.addEventListener('touchstart',function(e){
  dragging=true;velX=velY=0;
  var t=e.touches[0];prevX=t.clientX;prevY=t.clientY;
},{passive:true});
window.addEventListener('touchmove',function(e){
  if(!dragging)return;
  var t=e.touches[0];
  var dx=t.clientX-prevX,dy=t.clientY-prevY;
  velX=dx*.006;velY=dy*.006;
  tRotY+=dx*.006;tRotX+=dy*.006;
  tRotX=Math.max(-1.3,Math.min(1.3,tRotX));
  prevX=t.clientX;prevY=t.clientY;
},{passive:true});
window.addEventListener('touchend',function(){dragging=false;});
window.addEventListener('keydown',function(e){keys[e.key]=true;});
window.addEventListener('keyup',function(e){keys[e.key]=false;});

// ── HOVER ─────────────────────────────────────────────────────────────────────
var mouse=new THREE.Vector2(-10,-10);
var ttEl=document.getElementById('tt');
var ttTxt=document.getElementById('tt-text');
cv.addEventListener('mousemove',function(e){
  var rc=cv.getBoundingClientRect();
  mouse.x=((e.clientX-rc.left)/rc.width)*2-1;
  mouse.y=-((e.clientY-rc.top)/rc.height)*2+1;
  ttEl.style.left=(e.clientX+14)+'px';ttEl.style.top=(e.clientY-8)+'px';
});
cv.addEventListener('mouseleave',function(){mouse.set(-10,-10);ttEl.classList.remove('vis');});

// ── RENDER LOOP ───────────────────────────────────────────────────────────────
var clock=new THREE.Clock();

function animate(){
  requestAnimationFrame(animate);
  var t=clock.getElapsedTime();

  // Arrow key controls
  var spd=0.022;
  if(keys['ArrowLeft']||keys['a']){tRotY-=spd;velX=-spd;}
  if(keys['ArrowRight']||keys['d']){tRotY+=spd;velX=spd;}
  if(keys['ArrowUp']||keys['w']){tRotX-=spd*.75;tRotX=Math.max(-1.3,tRotX);}
  if(keys['ArrowDown']||keys['s']){tRotX+=spd*.75;tRotX=Math.min(1.3,tRotX);}

  // Auto rotate + inertia when idle
  var anyKey=keys['ArrowLeft']||keys['ArrowRight']||keys['ArrowUp']||keys['ArrowDown']||keys['a']||keys['d']||keys['w']||keys['s'];
  if(!dragging&&!anyKey){
    tRotY+=0.0011;
    velX*=0.90;velY*=0.90;
    tRotY+=velX;tRotX+=velY;
    tRotX=Math.max(-1.3,Math.min(1.3,tRotX));
  }

  // Smooth lerp
  rotY+=(tRotY-rotY)*0.075;
  rotX+=(tRotX-rotX)*0.075;
  gg.rotation.set(rotX,rotY,0,'YXZ');

  // Arc pulses
  arcObjs.forEach(function(ao){
    ao.prog+=ao.spd*0.007;
    if(ao.prog>1)ao.prog=0;
    var n=ao.pts.length;
    var head=Math.floor(ao.prog*n);
    var tail=Math.max(0,head-ao.plen);
    var sl=ao.pts.slice(tail,head+1);
    if(sl.length>1){
      ao.pl.geometry.setFromPoints(sl);
      ao.pl.geometry.attributes.position.needsUpdate=true;
      ao.pmat.opacity=0.9*(sl.length/ao.plen);
    }else ao.pmat.opacity=0;
  });

  // Nodes
  var found=false;
  nodes.forEach(function(n){
    var s=1+Math.sin(t*2+n.pp)*.17;
    var wp=n.pos.clone().applyEuler(new THREE.Euler(rotX,rotY,0,'YXZ'));
    var sp=wp.clone().project(cam);
    var d=Math.hypot(sp.x-mouse.x,sp.y-mouse.y);
    var pr=((t*0.65+n.pp)%(Math.PI*2))/(Math.PI*2);
    n.pulseM.opacity=Math.max(0,0.5*(1-pr*2));

    if(d<0.07&&wp.z>0){
      found=true;
      n.g.scale.setScalar(s*2.0);n.ringM.opacity=1;
      cv.style.cursor='pointer';
      ttTxt.textContent=n.label;ttEl.classList.add('vis');
    }else{
      n.g.scale.setScalar(s);n.ringM.opacity=0.55+Math.sin(t*1.5+n.pp)*.1;
    }
  });
  if(!found){cv.style.cursor='default';ttEl.classList.remove('vis');}
  R.render(scene,cam);
}
animate();
setTimeout(resize,100);setTimeout(resize,600);
})();
</script>
</body>
</html>`;

function AutoFrame({ html, minHeight }) {
  const ref = useRef(null);
  useEffect(() => {
    const iframe = ref.current;
    if (!iframe) return;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    iframe.src = url;
    function expand() {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        const h = Math.max(doc.body.scrollHeight, doc.body.offsetHeight,
          doc.documentElement.scrollHeight, doc.documentElement.offsetHeight);
        if (h > 100) iframe.style.height = h + "px";
      } catch (e) {}
    }
    iframe.addEventListener("load", function () {
      expand(); setTimeout(expand, 400); setTimeout(expand, 1200);
    });
    return () => URL.revokeObjectURL(url);
  }, [html]);
  return (
    <iframe ref={ref} scrolling="no"
      style={{ width:"100%", height:minHeight||"200px", border:"none", display:"block", background:"#03040e" }}
    />
  );
}

export default function GlobeSection() {
  const navigate = useNavigate();
  useEffect(() => {
    const handler = (e) => { if (e?.data?.type === "AIBMS_NAVIGATE") navigate(e.data.to); };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [navigate]);
  return (
    <div style={{ background: "#03040e", overflowX: "hidden" }}>
      <AutoFrame html={GLOBE_HTML} minHeight="100vh" />
    </div>
  );
}