/**
 * High-definition Procedural Animated Cosmic Vector Banners for Project Nox (Round 5 Refined)
 * 50 Pure SVG vectors with completely distinct compositions, motifs, and animations.
 * 100% vector, zero external asset dependencies, GPU-accelerated 60fps.
 */

function svgToDataUri(svg: string): string {
  const clean = svg.replace(/\s+/g, ' ').trim();
  return `url("data:image/svg+xml,${encodeURIComponent(clean)}") center/cover no-repeat`;
}

// Nebulosa do Vazio & Constelações
export const BANNER_NEBULOSA_VAZIO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="nv-bg" cx="50%" cy="50%" r="75%"><stop offset="0%" stop-color="#180e38"/><stop offset="50%" stop-color="#0b071c"/><stop offset="100%" stop-color="#030208"/></radialGradient>
    <radialGradient id="nv-c1" cx="75%" cy="35%" r="50%"><stop offset="0%" stop-color="rgba(168, 85, 247, 0.6)"/><stop offset="50%" stop-color="rgba(139, 92, 246, 0.25)"/><stop offset="100%" stop-color="transparent"/></radialGradient>
    <radialGradient id="nv-c2" cx="25%" cy="65%" r="45%"><stop offset="0%" stop-color="rgba(56, 189, 248, 0.5)"/><stop offset="60%" stop-color="rgba(99, 102, 241, 0.2)"/><stop offset="100%" stop-color="transparent"/></radialGradient>
  </defs>
  <style>
    @keyframes nvDrift1 { 0%, 100% { transform: translate(0,0) scale(1); opacity: 0.8; } 50% { transform: translate(-30px, 15px) scale(1.08); opacity: 1; } }
    @keyframes nvDrift2 { 0%, 100% { transform: translate(0,0) scale(1); opacity: 0.7; } 50% { transform: translate(25px, -15px) scale(1.1); opacity: 0.95; } }
    @keyframes meteorStreak { 0% { transform: translate(-100px, -50px); opacity: 0; } 15% { opacity: 1; } 40% { transform: translate(350px, 175px); opacity: 0; } 100% { transform: translate(350px, 175px); opacity: 0; } }
    @keyframes starTwinkle { 0%, 100% { opacity: 0.3; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.3); } }
    .c1 { animation: nvDrift1 11s ease-in-out infinite; transform-origin: 75% 35%; }
    .c2 { animation: nvDrift2 13s ease-in-out infinite; transform-origin: 25% 65%; }
    .m1 { animation: meteorStreak 6s linear infinite; }
    .st { animation: starTwinkle 2.5s ease-in-out infinite; transform-origin: center; }
  </style>
  <rect width="1200" height="400" fill="url(#nv-bg)"/>
  <rect class="c1" width="1200" height="400" fill="url(#nv-c1)"/>
  <rect class="c2" width="1200" height="400" fill="url(#nv-c2)"/>
  <g stroke="#ffffff" stroke-width="2" stroke-linecap="round" opacity="0.9">
    <line x1="250" y1="30" x2="320" y2="65" class="m1" filter="drop-shadow(0 0 6px #c084fc)"/>
  </g>
  <g fill="#ffffff" class="st">
    <circle cx="120" cy="80" r="1.5"/><circle cx="340" cy="220" r="2"/><circle cx="580" cy="90" r="1.6"/><circle cx="820" cy="180" r="2.2"/><circle cx="1040" cy="110" r="1.8"/>
  </g>
</svg>`;

// Aurora Astral & Fitas Polares
export const BANNER_AURORA_ASTRAL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="aa-bg" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#02141d"/><stop offset="65%" stop-color="#041f26"/><stop offset="100%" stop-color="#01090d"/></linearGradient>
    <linearGradient id="aa-ribbon1" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="transparent"/><stop offset="30%" stop-color="rgba(16, 185, 129, 0.75)"/><stop offset="65%" stop-color="rgba(56, 189, 248, 0.75)"/><stop offset="100%" stop-color="transparent"/></linearGradient>
    <linearGradient id="aa-ribbon2" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="transparent"/><stop offset="40%" stop-color="rgba(168, 85, 247, 0.65)"/><stop offset="80%" stop-color="rgba(52, 211, 153, 0.7)"/><stop offset="100%" stop-color="transparent"/></linearGradient>
  </defs>
  <style>
    @keyframes waveRibbon1 { 0%, 100% { transform: translateY(0) scaleY(1); } 50% { transform: translateY(-32px) scaleY(1.18); } }
    @keyframes waveRibbon2 { 0%, 100% { transform: translateY(0) scaleY(1); } 50% { transform: translateY(26px) scaleY(0.88); } }
    .r1 { animation: waveRibbon1 7s ease-in-out infinite; transform-origin: 50% 50%; }
    .r2 { animation: waveRibbon2 9s ease-in-out infinite; transform-origin: 50% 50%; }
  </style>
  <rect width="1200" height="400" fill="url(#aa-bg)"/>
  <path class="r1" d="M0,140 Q300,50 600,150 T1200,130 L1200,280 Q900,340 600,270 T0,280 Z" fill="url(#aa-ribbon1)" opacity="0.85"/>
  <path class="r2" d="M0,200 Q300,280 600,190 T1200,210 L1200,330 Q900,390 600,320 T0,330 Z" fill="url(#aa-ribbon2)" opacity="0.8"/>
  <!-- Mountain Horizon Silhouette -->
  <polygon points="0,400 0,330 80,310 170,340 280,290 390,340 500,280 640,350 780,270 910,330 1040,290 1150,330 1200,300 1200,400" fill="#01090d"/>
</svg>`;

// Energia Arcana & Astrolábio
export const BANNER_ENERGIA_ARCANA_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="ea-bg" cx="50%" cy="50%" r="70%"><stop offset="0%" stop-color="#190a36"/><stop offset="60%" stop-color="#0c041c"/><stop offset="100%" stop-color="#04020a"/></radialGradient>
    <radialGradient id="ea-core" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#ffffff"/><stop offset="35%" stop-color="rgba(192, 132, 252, 0.95)"/><stop offset="70%" stop-color="rgba(147, 51, 234, 0.5)"/><stop offset="100%" stop-color="transparent"/></radialGradient>
  </defs>
  <style>
    @keyframes spinCw { 100% { transform: rotate(360deg); } }
    @keyframes spinCcw { 100% { transform: rotate(-360deg); } }
    @keyframes corePulse { 0%, 100% { transform: scale(0.92); opacity: 0.85; } 50% { transform: scale(1.15); opacity: 1; } }
    .rotCw { animation: spinCw 25s linear infinite; transform-origin: 880px 200px; }
    .rotCcw { animation: spinCcw 18s linear infinite; transform-origin: 880px 200px; }
    .core { animation: corePulse 3s ease-in-out infinite; transform-origin: 880px 200px; }
  </style>
  <rect width="1200" height="400" fill="url(#ea-bg)"/>
  <circle cx="880" cy="200" r="160" class="core" fill="url(#ea-core)"/>
  <g class="rotCw" stroke="rgba(216, 180, 254, 0.8)" stroke-width="2" fill="none">
    <circle cx="880" cy="200" r="150" stroke-dasharray="16 8"/>
    <circle cx="880" cy="200" r="110"/>
    <polygon points="880,90 975,255 785,255"/>
  </g>
  <g class="rotCcw" stroke="rgba(56, 189, 248, 0.75)" stroke-width="1.8" fill="none">
    <circle cx="880" cy="200" r="130" stroke-dasharray="8 6"/>
    <polygon points="880,310 785,145 975,145"/>
  </g>
</svg>`;

// Eclipse Cósmico & Corona Solar
export const BANNER_ECLIPSE_COSMICO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="ec-bg" cx="50%" cy="50%" r="70%"><stop offset="0%" stop-color="#240713"/><stop offset="50%" stop-color="#12040b"/><stop offset="100%" stop-color="#040103"/></radialGradient>
    <radialGradient id="ec-corona" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#ffffff"/><stop offset="25%" stop-color="#f97316"/><stop offset="55%" stop-color="#ef4444"/><stop offset="100%" stop-color="transparent"/></radialGradient>
  </defs>
  <style>
    @keyframes ecPulse { 0%, 100% { transform: scale(1); opacity: 0.85; } 50% { transform: scale(1.14); opacity: 1; } }
    @keyframes ecSpin { 100% { transform: rotate(360deg); } }
    .ecP { animation: ecPulse 3.5s ease-in-out infinite; transform-origin: 320px 200px; }
    .ecS { animation: ecSpin 40s linear infinite; transform-origin: 320px 200px; }
  </style>
  <rect width="1200" height="400" fill="url(#ec-bg)"/>
  <circle cx="320" cy="200" r="185" class="ecP" fill="url(#ec-corona)"/>
  <g class="ecS" stroke="rgba(251, 146, 60, 0.75)" stroke-width="2.5">
    <line x1="320" y1="15" x2="320" y2="385"/><line x1="135" y1="200" x2="505" y2="200"/>
    <line x1="189" y1="69" x2="451" y2="331"/><line x1="189" y1="331" x2="451" y2="69"/>
  </g>
  <circle cx="320" cy="200" r="95" fill="#040103" stroke="#f97316" stroke-width="3" filter="drop-shadow(0 0 16px rgba(239, 68, 68, 0.95))"/>
</svg>`;

// Biblioteca das Estrelas
export const BANNER_BIBLIOTECA_ESTRELAS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="be-bg" cx="50%" cy="50%" r="70%"><stop offset="0%" stop-color="#1f1807"/><stop offset="60%" stop-color="#0f0b02"/><stop offset="100%" stop-color="#040300"/></radialGradient>
  </defs>
  <style>
    @keyframes armSpin1 { 100% { transform: rotate(360deg); } }
    @keyframes armSpin2 { 100% { transform: rotate(-360deg); } }
    @keyframes bookHover { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
    .arm1 { animation: armSpin1 24s linear infinite; transform-origin: 920px 200px; }
    .arm2 { animation: armSpin2 18s linear infinite; transform-origin: 920px 200px; }
    .book { animation: bookHover 4s ease-in-out infinite; }
  </style>
  <rect width="1200" height="400" fill="url(#be-bg)"/>
  <g class="arm1" stroke="#fbbf24" stroke-width="2.2" fill="none">
    <circle cx="920" cy="200" r="145" stroke-dasharray="18 10"/>
    <ellipse cx="920" cy="200" rx="145" ry="55"/>
  </g>
  <g class="arm2" stroke="#fef08a" stroke-width="1.8" fill="none">
    <ellipse cx="920" cy="200" rx="145" ry="55" transform="rotate(60 920 200)"/>
    <circle cx="920" cy="200" r="28" fill="#fbbf24" filter="drop-shadow(0 0 18px #fbbf24)"/>
  </g>
  <!-- Open Grimoire on Left -->
  <g class="book" transform="translate(240, 180)">
    <path d="M-60,30 Q-30,-20 0,0 Q30,-20 60,30 L60,50 Q30,0 0,20 Q-30,0 -60,50 Z" fill="#451a03" stroke="#fbbf24" stroke-width="2"/>
    <path d="M-55,28 Q-28,-16 0,2 Q28,-16 55,28" fill="none" stroke="#fef08a" stroke-width="1.2"/>
  </g>
</svg>`;

// Fenda Rúnica & Monólitos
export const BANNER_FENDA_RUNICA_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="fr-bg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#05081c"/><stop offset="50%" stop-color="#0c1236"/><stop offset="100%" stop-color="#02040e"/></linearGradient>
  </defs>
  <style>
    @keyframes monoF1 { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-20px); } }
    @keyframes monoF2 { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(18px); } }
    @keyframes riftFlash { 0%, 100% { stroke-width: 3.5; opacity: 0.8; } 50% { stroke-width: 7; opacity: 1; } }
    .mf1 { animation: monoF1 5.5s ease-in-out infinite; }
    .mf2 { animation: monoF2 6.5s ease-in-out infinite; }
    .rf { animation: riftFlash 2.2s ease-in-out infinite; }
  </style>
  <rect width="1200" height="400" fill="url(#fr-bg)"/>
  <path class="rf" d="M600,0 Q580,120 620,200 Q590,300 600,400" stroke="#38bdf8" fill="none" filter="drop-shadow(0 0 14px #38bdf8)"/>
  <polygon class="mf1" points="470,130 520,120 505,250 455,260" fill="#1e293b" stroke="#38bdf8" stroke-width="2.2"/>
  <polygon class="mf2" points="710,150 760,140 745,270 695,280" fill="#1e293b" stroke="#38bdf8" stroke-width="2.2"/>
</svg>`;

// Chuva de Meteoros Cósmica
export const BANNER_CHUVA_METEOROS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs><radialGradient id="cm-bg" cx="50%" cy="50%" r="75%"><stop offset="0%" stop-color="#140b2b"/><stop offset="100%" stop-color="#030209"/></radialGradient></defs>
  <style>
    @keyframes mRain { 0% { transform: translate(-120px, -90px); opacity: 0; } 15% { opacity: 1; } 85% { opacity: 1; } 100% { transform: translate(650px, 480px); opacity: 0; } }
    .m1 { animation: mRain 2.8s linear infinite; }
    .m2 { animation: mRain 3.9s linear infinite 1.1s; }
    .m3 { animation: mRain 3.4s linear infinite 2s; }
  </style>
  <rect width="1200" height="400" fill="url(#cm-bg)"/>
  <circle cx="950" cy="110" r="50" fill="#cbd5e1" opacity="0.8" filter="drop-shadow(0 0 15px rgba(255,255,255,0.4))"/>
  <g stroke="#ffffff" stroke-width="2.5" stroke-linecap="round">
    <line x1="180" y1="10" x2="270" y2="75" class="m1" filter="drop-shadow(0 0 8px #f43f5e)"/>
    <line x1="550" y1="15" x2="640" y2="80" class="m2" filter="drop-shadow(0 0 8px #38bdf8)"/>
    <line x1="850" y1="20" x2="940" y2="85" class="m3" filter="drop-shadow(0 0 8px #fbbf24)"/>
  </g>
</svg>`;

// Portal do Vácuo Quântico
export const BANNER_PORTAL_ABISSAL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs><radialGradient id="pa-bg" cx="50%" cy="50%" r="70%"><stop offset="0%" stop-color="#260633"/><stop offset="100%" stop-color="#040106"/></radialGradient></defs>
  <style>
    @keyframes spinCw { 100% { transform: rotate(360deg); } }
    @keyframes spinCcw { 100% { transform: rotate(-360deg); } }
    .pr1 { animation: spinCw 13s linear infinite; transform-origin: 600px 200px; }
    .pr2 { animation: spinCcw 9s linear infinite; transform-origin: 600px 200px; }
  </style>
  <rect width="1200" height="400" fill="url(#pa-bg)"/>
  <g class="pr1" stroke="#ec4899" stroke-width="2.5" fill="none">
    <ellipse cx="600" cy="200" rx="170" ry="85"/><circle cx="600" cy="200" r="145" stroke-dasharray="22 14"/>
  </g>
  <g class="pr2" stroke="#8b5cf6" stroke-width="2.2" fill="none">
    <ellipse cx="600" cy="200" rx="85" ry="170"/><circle cx="600" cy="200" r="65" fill="#040106" stroke="#ffffff" filter="drop-shadow(0 0 22px #a855f7)"/>
  </g>
</svg>`;

// Jardim Botânico Astral
export const BANNER_JARDIM_ASTRAL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs><linearGradient id="ja-bg" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#031e18"/><stop offset="100%" stop-color="#010806"/></linearGradient></defs>
  <style>
    @keyframes sporeUp { 0%, 100% { transform: translateY(0); opacity: 0.3; } 50% { transform: translateY(-35px); opacity: 1; } }
    @keyframes lotusB { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }
    .sp { animation: sporeUp 4.2s ease-in-out infinite; }
    .lot { animation: lotusB 5s ease-in-out infinite; transform-origin: center; }
  </style>
  <rect width="1200" height="400" fill="url(#ja-bg)"/>
  <!-- Glowing Pond -->
  <ellipse cx="600" cy="330" rx="350" ry="50" fill="#064e3b" opacity="0.6"/>
  <g class="lot" transform="translate(600, 270)">
    <circle cx="0" cy="0" r="48" fill="none" stroke="#10b981" stroke-width="2.5"/>
    <path d="M-35,10 Q0,-45 35,10 Q0,25 -35,10 Z" fill="#34d399" opacity="0.85"/>
  </g>
  <g fill="#6ee7b7" class="sp">
    <circle cx="220" cy="220" r="4"/><circle cx="430" cy="160" r="3"/><circle cx="780" cy="210" r="4.5"/><circle cx="990" cy="170" r="3"/>
  </g>
</svg>`;

// Cidadela Flutuante do Nox
export const BANNER_CIDADELA_CELESTIAL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs><linearGradient id="cc-bg" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#0f172a"/><stop offset="100%" stop-color="#020617"/></linearGradient></defs>
  <style>
    @keyframes citF { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-18px); } }
    @keyframes beamP { 0%, 100% { opacity: 0.35; } 50% { opacity: 0.95; } }
    .cf { animation: citF 6s ease-in-out infinite; }
    .bp { animation: beamP 3s ease-in-out infinite; }
  </style>
  <rect width="1200" height="400" fill="url(#cc-bg)"/>
  <g class="bp" stroke="#38bdf8" stroke-width="1.8" opacity="0.6">
    <line x1="600" y1="0" x2="600" y2="400"/><line x1="440" y1="40" x2="440" y2="360"/><line x1="760" y1="40" x2="760" y2="360"/>
  </g>
  <g class="cf">
    <polygon points="480,280 600,130 720,280 600,330" fill="#1e293b" stroke="#0ea5e9" stroke-width="2.5" filter="drop-shadow(0 0 20px #0284c7)"/>
    <polygon points="565,130 600,80 635,130" fill="#38bdf8"/>
  </g>
</svg>`;

// Ruínas Celestes da Antiguidade
export const BANNER_RUINAS_CELESTES_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs><linearGradient id="rc-bg" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#1e1b4b"/><stop offset="100%" stop-color="#090514"/></linearGradient></defs>
  <style>
    @keyframes colFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-14px); } }
    @keyframes runeGlow { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; filter: drop-shadow(0 0 8px #fbbf24); } }
    .cFloat { animation: colFloat 6s ease-in-out infinite; }
    .rGlow { animation: runeGlow 3s ease-in-out infinite; }
  </style>
  <rect width="1200" height="400" fill="url(#rc-bg)"/>
  <!-- Broken Colonnade -->
  <g class="cFloat" fill="#334155" stroke="#94a3b8" stroke-width="2">
    <!-- Pediment -->
    <polygon points="350,140 600,50 850,140 350,140"/>
    <!-- Columns -->
    <rect x="400" y="140" width="35" height="170"/>
    <rect x="500" y="140" width="35" height="170"/>
    <rect x="665" y="140" width="35" height="170"/>
    <rect x="765" y="140" width="35" height="170"/>
    <!-- Broken chunk on right -->
    <polygon points="900,220 950,200 930,290 880,300" stroke="#fbbf24"/>
  </g>
  <text x="600" y="110" font-size="24" fill="#fbbf24" class="rGlow" text-anchor="middle" font-family="serif">Α Ω Ψ Φ</text>
</svg>`;

// Céu das Três Luas Astrais
export const BANNER_LUAS_MULTIPLAS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs><radialGradient id="lm-bg" cx="50%" cy="30%" r="80%"><stop offset="0%" stop-color="#0c192c"/><stop offset="100%" stop-color="#020408"/></radialGradient></defs>
  <style>
    @keyframes moonOrbit { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
    .mOrb { animation: moonOrbit 5s ease-in-out infinite; }
  </style>
  <rect width="1200" height="400" fill="url(#lm-bg)"/>
  <!-- Moon 1: Giant Cratered Moon -->
  <circle cx="320" cy="160" r="90" fill="#e2e8f0" class="mOrb" filter="drop-shadow(0 0 25px rgba(226,232,240,0.6))"/>
  <circle cx="300" cy="130" r="18" fill="#94a3b8" opacity="0.6"/>
  <circle cx="350" cy="180" r="22" fill="#94a3b8" opacity="0.6"/>
  <!-- Moon 2: Golden Crescent Moon -->
  <path d="M680,60 A65,65 0 0,0 730,170 A55,55 0 0,1 680,60 Z" fill="#fbbf24" filter="drop-shadow(0 0 20px #fbbf24)"/>
  <!-- Moon 3: Mini Ringed Violet Moon -->
  <circle cx="980" cy="140" r="45" fill="#c084fc" filter="drop-shadow(0 0 16px #a855f7)"/>
  <ellipse cx="980" cy="140" rx="75" ry="14" fill="none" stroke="#e9d5ff" stroke-width="2.5" transform="rotate(-20 980 140)"/>
</svg>`;

// Vulcão Cósmico de Antimatéria
export const BANNER_VULCAO_COSMICO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs><linearGradient id="vc-bg" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#3b0505"/><stop offset="60%" stop-color="#170202"/><stop offset="100%" stop-color="#050000"/></linearGradient></defs>
  <style>
    @keyframes magmaBlast { 0%, 100% { transform: scale(1); opacity: 0.8; } 50% { transform: scale(1.2); opacity: 1; } }
    @keyframes emberRise { 0% { transform: translateY(0); opacity: 1; } 100% { transform: translateY(-160px); opacity: 0; } }
    .blast { animation: magmaBlast 2.5s ease-in-out infinite; transform-origin: 600px 140px; }
    .emb { animation: emberRise 3s linear infinite; }
  </style>
  <rect width="1200" height="400" fill="url(#vc-bg)"/>
  <!-- Volcano Cone -->
  <polygon points="350,400 550,150 650,150 850,400" fill="#1c0505" stroke="#ef4444" stroke-width="2"/>
  <!-- Magma Plume -->
  <path class="blast" d="M570,140 Q600,30 630,140 Q600,100 570,140 Z" fill="#f97316" filter="drop-shadow(0 0 25px #ef4444)"/>
  <!-- Flying Embers -->
  <g fill="#fde047" class="emb">
    <circle cx="580" cy="120" r="3"/><circle cx="620" cy="110" r="3.5"/><circle cx="600" cy="80" r="4"/><circle cx="560" cy="90" r="2.5"/><circle cx="640" cy="70" r="3"/>
  </g>
</svg>`;

// Céu Infernal do Abismo
export const BANNER_CEU_INFERNAL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs><radialGradient id="ci-bg" cx="50%" cy="50%" r="70%"><stop offset="0%" stop-color="#4a0404"/><stop offset="100%" stop-color="#0a0000"/></radialGradient></defs>
  <style>
    @keyframes lightningFlash { 0%, 100% { opacity: 0.1; } 48% { opacity: 0.1; } 50% { opacity: 1; } 52% { opacity: 0.2; } 54% { opacity: 1; } 60% { opacity: 0.1; } }
    .lFlash { animation: lightningFlash 4s infinite; }
  </style>
  <rect width="1200" height="400" fill="url(#ci-bg)"/>
  <!-- Jagged Spikes from Ground -->
  <polygon points="0,400 60,260 120,400 220,290 320,400 900,400 1000,270 1100,400 1160,280 1200,400" fill="#120202"/>
  <!-- Crimson Lightning -->
  <path d="M450,0 L420,120 L480,180 L440,300" class="lFlash" stroke="#f43f5e" stroke-width="3" fill="none" filter="drop-shadow(0 0 12px #ef4444)"/>
  <path d="M750,0 L780,110 L730,190 L770,320" class="lFlash" stroke="#f43f5e" stroke-width="2.5" fill="none" filter="drop-shadow(0 0 12px #ef4444)"/>
</svg>`;

// Santuário Dourado Solar
export const BANNER_SANTUARIO_DOURADO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs><linearGradient id="sd-bg" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#2d1c02"/><stop offset="100%" stop-color="#0a0600"/></linearGradient></defs>
  <style>
    @keyframes godRays { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.9; } }
    .rays { animation: godRays 4s ease-in-out infinite; }
  </style>
  <rect width="1200" height="400" fill="url(#sd-bg)"/>
  <!-- Slanted God Rays -->
  <g class="rays" fill="#fef08a" opacity="0.4">
    <polygon points="400,0 550,400 480,400 360,0"/>
    <polygon points="600,0 760,400 690,400 560,0"/>
    <polygon points="800,0 980,400 910,400 760,0"/>
  </g>
  <!-- Cathedral Arches -->
  <path d="M300,400 L300,180 Q450,60 600,180 L600,400 L600,180 Q750,60 900,180 L900,400" fill="none" stroke="#fbbf24" stroke-width="3" filter="drop-shadow(0 0 15px #f59e0b)"/>
  <circle cx="600" cy="180" r="40" fill="#fbbf24" opacity="0.9" filter="drop-shadow(0 0 20px #fbbf24)"/>
</svg>`;

// Tempestade Estelar Elétrica
export const BANNER_TEMPESTADE_ESTELAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs><linearGradient id="te-bg" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#1e1035"/><stop offset="100%" stop-color="#07030d"/></linearGradient></defs>
  <style>
    @keyframes lightningFork { 0%, 100% { opacity: 0.15; } 45% { opacity: 0.15; } 48% { opacity: 1; stroke-width: 4; } 52% { opacity: 0.2; } 55% { opacity: 1; } 60% { opacity: 0.15; } }
    .fork { animation: lightningFork 3.5s infinite; }
  </style>
  <rect width="1200" height="400" fill="url(#te-bg)"/>
  <path d="M600,0 L570,90 L630,130 L580,210 L620,270 L590,400" class="fork" stroke="#c084fc" stroke-width="3" fill="none" filter="drop-shadow(0 0 16px #a855f7)"/>
  <path d="M630,130 L700,190 L680,240" class="fork" stroke="#38bdf8" stroke-width="2" fill="none" filter="drop-shadow(0 0 10px #38bdf8)"/>
  <path d="M250,0 L290,140 L260,220 L310,350" class="fork" stroke="#a855f7" stroke-width="2.5" fill="none" filter="drop-shadow(0 0 14px #a855f7)"/>
</svg>`;

// Altar das Runas Vivas
export const BANNER_RUNAS_VIVAS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs><radialGradient id="rv-bg" cx="50%" cy="50%" r="70%"><stop offset="0%" stop-color="#022c22"/><stop offset="100%" stop-color="#010a08"/></radialGradient></defs>
  <style>
    @keyframes runeRotate { 100% { transform: rotate(360deg); } }
    @keyframes altarPulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; filter: drop-shadow(0 0 18px #2dd4bf); } }
    .rRot { animation: runeRotate 28s linear infinite; transform-origin: 600px 200px; }
    .aPulse { animation: altarPulse 3s ease-in-out infinite; }
  </style>
  <rect width="1200" height="400" fill="url(#rv-bg)"/>
  <!-- Central Stone Dais -->
  <polygon points="450,330 750,330 850,380 350,380" fill="#0f172a" stroke="#2dd4bf" stroke-width="2"/>
  <!-- Orbiting Rune Ring -->
  <g class="rRot" stroke="#2dd4bf" stroke-width="2" fill="none">
    <circle cx="600" cy="200" r="130" stroke-dasharray="14 10"/>
    <text x="600" y="80" font-size="28" fill="#2dd4bf" stroke="none" class="aPulse" text-anchor="middle">ᚠ</text>
    <text x="720" y="200" font-size="28" fill="#2dd4bf" stroke="none" class="aPulse" text-anchor="middle">ᚢ</text>
    <text x="600" y="320" font-size="28" fill="#2dd4bf" stroke="none" class="aPulse" text-anchor="middle">ᚦ</text>
    <text x="480" y="200" font-size="28" fill="#2dd4bf" stroke="none" class="aPulse" text-anchor="middle">ᚨ</text>
  </g>
</svg>`;

// Oceano Celestial de Netuno
export const BANNER_OCEANO_CELESTIAL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs><linearGradient id="oc-bg" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#021c30"/><stop offset="100%" stop-color="#010910"/></linearGradient></defs>
  <style>
    @keyframes whaleSwim { 0%, 100% { transform: translate(0, 0) rotate(0deg); } 50% { transform: translate(40px, -20px) rotate(2deg); } }
    @keyframes waveRoll { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
    .whale { animation: whaleSwim 8s ease-in-out infinite; }
    .wRoll { animation: waveRoll 5s ease-in-out infinite; }
  </style>
  <rect width="1200" height="400" fill="url(#oc-bg)"/>
  <!-- Cosmic Whale Silhouette -->
  <g class="whale" fill="#0284c7" opacity="0.85" filter="drop-shadow(0 0 14px #38bdf8)">
    <path d="M400,210 Q500,160 620,180 Q720,200 800,170 Q760,220 700,230 Q580,245 480,230 Q430,230 400,210 Z"/>
    <!-- Tail fin -->
    <polygon points="380,180 410,210 370,235"/>
  </g>
  <!-- Bioluminescent Waves at bottom -->
  <path class="wRoll" d="M0,320 Q300,280 600,320 T1200,300 L1200,400 L0,400 Z" fill="#0369a1" opacity="0.6"/>
  <path class="wRoll" d="M0,350 Q300,310 600,350 T1200,330 L1200,400 L0,400 Z" fill="#0284c7" opacity="0.4"/>
</svg>`;

// Observatório Astronômico Ancestral
export const BANNER_TEMPLO_ASTRONOMICO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs><radialGradient id="ta-bg" cx="50%" cy="20%" r="80%"><stop offset="0%" stop-color="#0f172a"/><stop offset="100%" stop-color="#020617"/></radialGradient></defs>
  <style>
    @keyframes galaxySpin { 100% { transform: rotate(360deg); } }
    .gSpin { animation: galaxySpin 50s linear infinite; transform-origin: 850px 100px; }
  </style>
  <rect width="1200" height="400" fill="url(#ta-bg)"/>
  <!-- Spiral Galaxy in sky -->
  <g class="gSpin" stroke="#38bdf8" stroke-width="2" fill="none" opacity="0.75">
    <path d="M850,100 Q880,70 920,90 Q950,120 930,150 Q900,170 860,160 Q820,140 820,100 Q830,60 880,50"/>
    <circle cx="850" cy="100" r="10" fill="#ffffff" filter="drop-shadow(0 0 12px #38bdf8)"/>
  </g>
  <!-- Observatory Dome Structure -->
  <path d="M200,400 L200,260 Q350,110 500,260 L500,400 Z" fill="#1e293b" stroke="#64748b" stroke-width="2.5"/>
  <!-- Slit and Giant Telescope -->
  <rect x="335" y="140" width="30" height="260" fill="#0f172a"/>
  <line x1="320" y1="280" x2="420" y2="120" stroke="#f59e0b" stroke-width="8" stroke-linecap="round" filter="drop-shadow(0 0 10px #fbbf24)"/>
</svg>`;

// Buraco Negro Gargântua
export const BANNER_BURACO_NEGRO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="bn-bg" cx="50%" cy="50%" r="75%"><stop offset="0%" stop-color="#1c0b02"/><stop offset="100%" stop-color="#000000"/></radialGradient>
    <linearGradient id="bn-disc" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#ea580c"/><stop offset="50%" stop-color="#fef08a"/><stop offset="100%" stop-color="#ea580c"/></linearGradient>
  </defs>
  <style>
    @keyframes discGlow { 0%, 100% { opacity: 0.85; transform: scaleY(1); } 50% { opacity: 1; transform: scaleY(1.08); } }
    .dGlow { animation: discGlow 3s ease-in-out infinite; transform-origin: 600px 200px; }
  </style>
  <rect width="1200" height="400" fill="url(#bn-bg)"/>
  <!-- Accretion Disc Upper Warp -->
  <path class="dGlow" d="M350,200 Q600,60 850,200 Q600,100 350,200 Z" fill="url(#bn-disc)" filter="drop-shadow(0 0 20px #f97316)"/>
  <!-- Horizontal Disc -->
  <ellipse cx="600" cy="200" rx="350" ry="30" fill="url(#bn-disc)" class="dGlow" filter="drop-shadow(0 0 25px #ea580c)"/>
  <!-- Event Horizon Sphere -->
  <circle cx="600" cy="200" r="90" fill="#000000" stroke="#fef08a" stroke-width="2" filter="drop-shadow(0 0 12px #f97316)"/>
</svg>`;

// Floresta de Cristais Astrais
export const BANNER_FLORESTA_CRISTAL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs><linearGradient id="fc-bg" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#082f49"/><stop offset="100%" stop-color="#020b12"/></linearGradient></defs>
  <style>
    @keyframes crystalPrism { 0%, 100% { filter: drop-shadow(0 0 10px #38bdf8); } 50% { filter: drop-shadow(0 0 24px #ec4899); } }
    .cPrism { animation: crystalPrism 4s ease-in-out infinite; }
  </style>
  <rect width="1200" height="400" fill="url(#fc-bg)"/>
  <!-- Spire 1 -->
  <polygon points="250,400 290,180 320,120 350,180 390,400 320,400" fill="#0284c7" stroke="#7dd3fc" stroke-width="2" class="cPrism"/>
  <!-- Spire 2 (Center Giant) -->
  <polygon points="540,400 580,120 620,50 660,120 700,400 620,400" fill="#0369a1" stroke="#38bdf8" stroke-width="2.5" class="cPrism"/>
  <!-- Spire 3 -->
  <polygon points="850,400 880,190 910,130 940,190 970,400 910,400" fill="#0284c7" stroke="#7dd3fc" stroke-width="2" class="cPrism"/>
</svg>`;

// Metrópole Cyberpunk Neon
export const BANNER_CIDADE_CYBERPUNK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs><linearGradient id="cy-bg" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#1f0729"/><stop offset="100%" stop-color="#050108"/></linearGradient></defs>
  <style>
    @keyframes neonFlicker { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } 52% { opacity: 1; } 75% { opacity: 0.6; } }
    @keyframes carFly { 0% { transform: translateX(0); } 100% { transform: translateX(1300px); } }
    .nFlick { animation: neonFlicker 3s infinite; }
    .cFly { animation: carFly 5s linear infinite; }
  </style>
  <rect width="1200" height="400" fill="url(#cy-bg)"/>
  <!-- Skylines -->
  <rect x="100" y="140" width="90" height="260" fill="#0f0717" stroke="#f43f5e" stroke-width="1.5"/>
  <rect x="250" y="80" width="120" height="320" fill="#0b0412" stroke="#06b6d4" stroke-width="1.5"/>
  <rect x="450" y="120" width="100" height="280" fill="#0f0717" stroke="#f43f5e" stroke-width="1.5"/>
  <rect x="620" y="60" width="140" height="340" fill="#0b0412" stroke="#06b6d4" stroke-width="2"/>
  <rect x="830" y="110" width="110" height="290" fill="#0f0717" stroke="#a855f7" stroke-width="1.5"/>
  <rect x="1000" y="150" width="130" height="250" fill="#0b0412" stroke="#f43f5e" stroke-width="1.5"/>
  <!-- Billboard Sign -->
  <text x="690" y="110" fill="#f43f5e" font-size="20" font-family="monospace" class="nFlick" text-anchor="middle">NOX-2099</text>
  <!-- Flying Vehicle -->
  <g class="cFly" transform="translate(-100, 220)">
    <line x1="0" y1="0" x2="40" y2="0" stroke="#06b6d4" stroke-width="3" filter="drop-shadow(0 0 6px #06b6d4)"/>
    <circle cx="40" cy="0" r="3" fill="#ffffff"/>
  </g>
</svg>`;

// Voo da Fênix Celestial
export const BANNER_FENIX_ASCENDENTE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs><radialGradient id="fn-bg" cx="50%" cy="50%" r="75%"><stop offset="0%" stop-color="#3d0a0a"/><stop offset="100%" stop-color="#080101"/></radialGradient></defs>
  <style>
    @keyframes phoenixFlap { 0%, 100% { transform: translateY(0) scaleY(1); } 50% { transform: translateY(-16px) scaleY(1.08); } }
    .phx { animation: phoenixFlap 4s ease-in-out infinite; transform-origin: 600px 180px; }
  </style>
  <rect width="1200" height="400" fill="url(#fn-bg)"/>
  <g class="phx" fill="#f97316" stroke="#fbbf24" stroke-width="2" filter="drop-shadow(0 0 20px #ef4444)">
    <!-- Body & Head -->
    <path d="M600,100 Q605,80 615,85 Q620,95 605,120 L600,220 Z"/>
    <!-- Left Wing -->
    <path d="M600,130 C450,40 320,70 200,140 C340,160 460,180 595,200 Z"/>
    <!-- Right Wing -->
    <path d="M600,130 C750,40 880,70 1000,140 C860,160 740,180 605,200 Z"/>
    <!-- Tail Plumes -->
    <path d="M595,210 Q560,320 540,380 M600,210 Q600,330 600,390 M605,210 Q640,320 660,380" stroke="#f59e0b" stroke-width="3" fill="none"/>
  </g>
</svg>`;

// Mar de Estrelas Infinito
export const BANNER_MAR_DE_ESTRELAS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs><linearGradient id="ms-bg" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#030712"/><stop offset="60%" stop-color="#0f172a"/><stop offset="100%" stop-color="#020617"/></linearGradient></defs>
  <style>
    @keyframes surfBreath { 0%, 100% { transform: scaleY(1); opacity: 0.7; } 50% { transform: scaleY(1.05); opacity: 0.95; } }
    .surf { animation: surfBreath 4.5s ease-in-out infinite; transform-origin: center bottom; }
  </style>
  <rect width="1200" height="400" fill="url(#ms-bg)"/>
  <!-- Distant Stars & Giant Arching Nebula -->
  <path d="M100,220 Q600,-40 1100,220" stroke="#38bdf8" stroke-width="40" fill="none" opacity="0.25" filter="blur(20px)"/>
  <!-- Shoreline Wet Sand Reflection -->
  <polygon points="0,400 0,250 1200,230 1200,400" fill="#020617"/>
  <!-- Bioluminescent Surf Water -->
  <path class="surf" d="M0,260 Q300,230 600,250 T1200,240 L1200,330 Q900,360 600,340 T0,350 Z" fill="#06b6d4" opacity="0.6" filter="drop-shadow(0 0 12px #22d3ee)"/>
</svg>`;

// Vale dos Cometas Glaciais
export const BANNER_CACADOR_COMETAS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs><linearGradient id="vg-bg" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#041f33"/><stop offset="100%" stop-color="#01080e"/></linearGradient></defs>
  <style>
    @keyframes cometFly { 0% { transform: translate(-100px, -60px); opacity: 0; } 20% { opacity: 1; } 80% { opacity: 1; } 100% { transform: translate(500px, 300px); opacity: 0; } }
    .cFly { animation: cometFly 4s linear infinite; }
  </style>
  <rect width="1200" height="400" fill="url(#vg-bg)"/>
  <!-- Ice Mountain Wall Silhouette -->
  <polygon points="0,400 0,180 180,240 320,160 500,260 700,170 920,270 1080,180 1200,220 1200,400" fill="#021422" stroke="#7dd3fc" stroke-width="2"/>
  <!-- Massive Comet -->
  <g class="cFly" transform="translate(450, 40)">
    <line x1="0" y1="0" x2="-220" y2="-130" stroke="#38bdf8" stroke-width="4" stroke-linecap="round" opacity="0.85" filter="drop-shadow(0 0 15px #38bdf8)"/>
    <circle cx="0" cy="0" r="10" fill="#ffffff" filter="drop-shadow(0 0 20px #38bdf8)"/>
  </g>
</svg>`;

// Labirinto dos Espelhos Dimensionais
export const BANNER_LABIRINTO_ESPELHO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs><radialGradient id="le-bg" cx="50%" cy="50%" r="70%"><stop offset="0%" stop-color="#18181b"/><stop offset="100%" stop-color="#09090b"/></radialGradient></defs>
  <style>
    @keyframes mirrorGlint { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; filter: drop-shadow(0 0 18px #a855f7); } }
    .mGlint { animation: mirrorGlint 3.6s ease-in-out infinite; }
  </style>
  <rect width="1200" height="400" fill="url(#le-bg)"/>
  <!-- Tilted Glass Panels -->
  <polygon points="200,80 340,40 300,320 160,360" fill="rgba(168, 85, 247, 0.25)" stroke="#c084fc" stroke-width="2" class="mGlint"/>
  <polygon points="460,50 620,90 580,350 420,310" fill="rgba(56, 189, 248, 0.25)" stroke="#38bdf8" stroke-width="2.5" class="mGlint"/>
  <polygon points="760,70 900,30 870,330 730,370" fill="rgba(244, 63, 94, 0.25)" stroke="#fb7185" stroke-width="2" class="mGlint"/>
  <polygon points="980,100 1100,60 1070,300 950,340" fill="rgba(251, 191, 36, 0.25)" stroke="#fbbf24" stroke-width="2" class="mGlint"/>
</svg>`;

// Castelo Gótico Sob a Lua Vermelha
export const BANNER_CASTELO_GOTICO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs><radialGradient id="cg-bg" cx="50%" cy="40%" r="75%"><stop offset="0%" stop-color="#3d0303"/><stop offset="100%" stop-color="#080000"/></radialGradient></defs>
  <style>
    @keyframes bloodMoonBreathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.06); filter: drop-shadow(0 0 35px #dc2626); } }
    .bMoon { animation: bloodMoonBreathe 4s ease-in-out infinite; transform-origin: 600px 150px; }
  </style>
  <rect width="1200" height="400" fill="url(#cg-bg)"/>
  <!-- Giant Blood Moon -->
  <circle cx="600" cy="150" r="95" fill="#991b1b" stroke="#ef4444" stroke-width="2" class="bMoon" filter="drop-shadow(0 0 25px #b91c1c)"/>
  <!-- Spire Castle Silhouette -->
  <polygon points="0,400 0,330 350,330 400,210 420,160 440,210 470,330 520,240 540,110 560,240 640,240 660,110 680,240 730,330 760,210 780,160 800,210 850,330 1200,330 1200,400" fill="#0f0101"/>
</svg>`;

// Travessia dos Anéis Planetários
export const BANNER_ANEIS_SATURNO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs><radialGradient id="as-bg" cx="20%" cy="80%" r="80%"><stop offset="0%" stop-color="#2d1c05"/><stop offset="100%" stop-color="#040200"/></radialGradient></defs>
  <style>
    @keyframes ringFlow { 0%, 100% { opacity: 0.8; } 50% { opacity: 1; stroke-width: 8; } }
    .rFlow { animation: ringFlow 3.5s ease-in-out infinite; }
  </style>
  <rect width="1200" height="400" fill="url(#as-bg)"/>
  <!-- Giant Gas Planet Rim on Left -->
  <circle cx="-100" cy="450" r="420" fill="#b45309" stroke="#fde68a" stroke-width="3" filter="drop-shadow(0 0 30px #f59e0b)"/>
  <!-- Vast Ring Bands Flying Toward Viewer -->
  <line x1="0" y1="280" x2="1200" y2="90" stroke="#fde68a" stroke-width="6" class="rFlow" opacity="0.85"/>
  <line x1="0" y1="310" x2="1200" y2="120" stroke="#d97706" stroke-width="12" opacity="0.7"/>
  <line x1="0" y1="340" x2="1200" y2="150" stroke="#fef3c7" stroke-width="4" opacity="0.9"/>
  <!-- Floating Asteroid Chunks -->
  <polygon points="650,130 670,120 685,140 660,150" fill="#78350f" stroke="#fbbf24"/>
  <polygon points="900,105 915,95 930,110 910,120" fill="#78350f" stroke="#fbbf24"/>
</svg>`;

// Ponte do Arco-Íris Astral
export const BANNER_PONTE_BIFROST_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs><radialGradient id="pb-bg" cx="50%" cy="50%" r="75%"><stop offset="0%" stop-color="#140624"/><stop offset="100%" stop-color="#020005"/></radialGradient></defs>
  <style>
    @keyframes bifrostFlow { 0%, 100% { filter: drop-shadow(0 0 15px #38bdf8); } 50% { filter: drop-shadow(0 0 30px #ec4899); } }
    .bStream { animation: bifrostFlow 4s ease-in-out infinite; }
  </style>
  <rect width="1200" height="400" fill="url(#pb-bg)"/>
  <!-- Arched Rainbow Ribbon -->
  <g class="bStream" fill="none" stroke-width="6">
    <path d="M-100,380 Q600,20 1300,380" stroke="#ef4444"/>
    <path d="M-100,388 Q600,28 1300,388" stroke="#f97316"/>
    <path d="M-100,396 Q600,36 1300,396" stroke="#eab308"/>
    <path d="M-100,404 Q600,44 1300,404" stroke="#22c55e"/>
    <path d="M-100,412 Q600,52 1300,412" stroke="#06b6d4"/>
    <path d="M-100,420 Q600,60 1300,420" stroke="#a855f7"/>
  </g>
</svg>`;

// Covil do Dragão Estelar
export const BANNER_DRAGAO_CELESTE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs><radialGradient id="dc-bg" cx="50%" cy="50%" r="70%"><stop offset="0%" stop-color="#0b1b36"/><stop offset="100%" stop-color="#01040a"/></radialGradient></defs>
  <style>
    @keyframes dragonGlide { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-14px); } }
    .dGlide { animation: dragonGlide 5s ease-in-out infinite; }
  </style>
  <rect width="1200" height="400" fill="url(#dc-bg)"/>
  <!-- Moon behind dragon -->
  <circle cx="600" cy="200" r="110" fill="#38bdf8" opacity="0.3" filter="drop-shadow(0 0 35px #0284c7)"/>
  <!-- Serpentine Dragon Body -->
  <path class="dGlide" d="M300,280 Q450,120 600,240 T900,160" fill="none" stroke="#60a5fa" stroke-width="16" stroke-linecap="round" filter="drop-shadow(0 0 15px #38bdf8)"/>
  <!-- Dragon Head with Horns -->
  <polygon points="900,160 950,130 940,170 960,190 910,180" fill="#93c5fd" class="dGlide"/>
</svg>`;

// Arquipélago Flutuante do Éter
export const BANNER_ILHA_FLUTUANTE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs><linearGradient id="if-bg" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#022c22"/><stop offset="100%" stop-color="#010806"/></linearGradient></defs>
  <style>
    @keyframes islandBob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-16px); } }
    @keyframes fallWater { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }
    .iBob { animation: islandBob 6s ease-in-out infinite; }
    .wFall { animation: fallWater 2s infinite; }
  </style>
  <rect width="1200" height="400" fill="url(#if-bg)"/>
  <!-- Main Floating Island -->
  <g class="iBob">
    <!-- Rock Underbelly -->
    <polygon points="400,200 800,200 640,360 520,330" fill="#1e293b" stroke="#0f766e" stroke-width="2"/>
    <!-- Grass Top -->
    <rect x="380" y="190" width="440" height="20" rx="10" fill="#10b981"/>
    <!-- Great Tree -->
    <rect x="585" y="110" width="30" height="90" fill="#451a03"/>
    <circle cx="600" cy="90" r="50" fill="#059669" filter="drop-shadow(0 0 10px #34d399)"/>
    <!-- Waterfalls falling off rock -->
    <line x1="450" y1="200" x2="450" y2="390" stroke="#38bdf8" stroke-width="3" class="wFall"/>
    <line x1="720" y1="200" x2="720" y2="370" stroke="#38bdf8" stroke-width="2.5" class="wFall"/>
  </g>
</svg>`;

// A Grande Forja Estelar
export const BANNER_FORJA_ESTELAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs><linearGradient id="fe-bg" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#3b1103"/><stop offset="100%" stop-color="#080200"/></linearGradient></defs>
  <style>
    @keyframes hammerBlow { 0%, 100% { transform: rotate(0deg); } 45% { transform: rotate(-35deg); } 50% { transform: rotate(0deg); } }
    @keyframes sparkBurst { 0%, 100% { opacity: 0.2; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.4); } }
    .hammer { animation: hammerBlow 3s ease-in-out infinite; transform-origin: 640px 140px; }
    .sparks { animation: sparkBurst 3s ease-in-out infinite; }
  </style>
  <rect width="1200" height="400" fill="url(#fe-bg)"/>
  <!-- Giant Anvil Base -->
  <polygon points="450,380 750,380 720,240 780,210 420,210 480,240" fill="#1c1917" stroke="#f97316" stroke-width="3"/>
  <!-- Molten Star on Anvil -->
  <circle cx="600" cy="205" r="25" fill="#fef08a" filter="drop-shadow(0 0 20px #fbbf24)"/>
  <!-- Divine Hammer -->
  <g class="hammer">
    <rect x="585" y="80" width="30" height="90" fill="#d97706"/>
    <rect x="550" y="50" width="100" height="45" fill="#78350f" stroke="#fbbf24" stroke-width="2"/>
  </g>
  <g class="sparks" stroke="#ffffff" stroke-width="2">
    <line x1="600" y1="200" x2="520" y2="130"/><line x1="600" y1="200" x2="680" y2="130"/>
    <line x1="600" y1="200" x2="480" y2="180"/><line x1="600" y1="200" x2="720" y2="180"/>
  </g>
</svg>`;

// Fossa Abissal das Criaturas Arcanas
export const BANNER_FUNDO_MARINHO_ABISSAL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs><linearGradient id="fa-bg" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#021726"/><stop offset="100%" stop-color="#00050a"/></linearGradient></defs>
  <style>
    @keyframes jellyFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-24px); } }
    .jelly { animation: jellyFloat 4.5s ease-in-out infinite; }
  </style>
  <rect width="1200" height="400" fill="url(#fa-bg)"/>
  <!-- Bioluminescent Jellyfish 1 -->
  <g class="jelly" transform="translate(380, 150)">
    <path d="M-40,0 Q0,-40 40,0 Z" fill="#06b6d4" opacity="0.8" filter="drop-shadow(0 0 15px #22d3ee)"/>
    <path d="M-30,0 Q-20,40 -25,80 M0,0 Q10,40 0,90 M30,0 Q20,40 25,80" stroke="#67e8f9" stroke-width="2" fill="none"/>
  </g>
  <!-- Bioluminescent Jellyfish 2 -->
  <g class="jelly" transform="translate(820, 180)">
    <path d="M-50,0 Q0,-50 50,0 Z" fill="#a855f7" opacity="0.8" filter="drop-shadow(0 0 15px #c084fc)"/>
    <path d="M-35,0 Q-25,50 -30,95 M0,0 Q-10,50 0,105 M35,0 Q25,50 30,95" stroke="#d8b4fe" stroke-width="2.2" fill="none"/>
  </g>
</svg>`;

// Fluxo de Dados Matrix
export const BANNER_MATRIX_DIGITAL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs><linearGradient id="md-bg" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#022013"/><stop offset="100%" stop-color="#000804"/></linearGradient></defs>
  <style>
    @keyframes matrixDrop { 0% { stroke-dashoffset: 200; } 100% { stroke-dashoffset: 0; } }
    .mCol { stroke: #22c55e; stroke-width: 3; stroke-dasharray: 6 6; animation: matrixDrop 2s linear infinite; filter: drop-shadow(0 0 8px #10b981); }
  </style>
  <rect width="1200" height="400" fill="url(#md-bg)"/>
  <!-- Perspective Floor Grid -->
  <g stroke="#14532d" stroke-width="1.5">
    <line x1="0" y1="400" x2="600" y2="280"/><line x1="200" y1="400" x2="600" y2="280"/>
    <line x1="400" y1="400" x2="600" y2="280"/><line x1="600" y1="400" x2="600" y2="280"/>
    <line x1="800" y1="400" x2="600" y2="280"/><line x1="1000" y1="400" x2="600" y2="280"/>
    <line x1="1200" y1="400" x2="600" y2="280"/>
  </g>
  <!-- Falling Code Columns -->
  <line x1="150" y1="20" x2="150" y2="280" class="mCol"/>
  <line x1="320" y1="10" x2="320" y2="290" class="mCol" style="animation-duration: 1.6s;"/>
  <line x1="500" y1="30" x2="500" y2="270" class="mCol" style="animation-duration: 2.3s;"/>
  <line x1="700" y1="15" x2="700" y2="285" class="mCol" style="animation-duration: 1.8s;"/>
  <line x1="880" y1="25" x2="880" y2="275" class="mCol" style="animation-duration: 2.1s;"/>
  <line x1="1050" y1="10" x2="1050" y2="290" class="mCol" style="animation-duration: 1.5s;"/>
</svg>`;

// Bosque de Cerejeiras Sob o Cosmos
export const BANNER_SAKURA_NOTURNA_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs><radialGradient id="sn-bg" cx="50%" cy="30%" r="70%"><stop offset="0%" stop-color="#2a0d24"/><stop offset="100%" stop-color="#060105"/></radialGradient></defs>
  <style>
    @keyframes petalDrift { 0% { transform: translate(0,0) rotate(0deg); opacity: 0; } 20% { opacity: 1; } 100% { transform: translate(320px, 180px) rotate(360deg); opacity: 0; } }
    .petal { animation: petalDrift 5s linear infinite; }
  </style>
  <rect width="1200" height="400" fill="url(#sn-bg)"/>
  <!-- Full Moon -->
  <circle cx="600" cy="140" r="75" fill="#fce7f3" filter="drop-shadow(0 0 25px rgba(251, 113, 133, 0.6))"/>
  <!-- Japanese Torii Gate -->
  <g fill="#991b1b" stroke="#f43f5e" stroke-width="2">
    <!-- Top lintel curved -->
    <path d="M480,180 Q600,165 720,180 L720,195 Q600,180 480,195 Z"/>
    <!-- Second lintel -->
    <rect x="500" y="205" width="200" height="12"/>
    <!-- Pillars -->
    <rect x="525" y="195" width="20" height="205"/>
    <rect x="655" y="195" width="20" height="205"/>
  </g>
  <!-- Swirling Sakura Petals -->
  <g fill="#fb7185" class="petal">
    <ellipse cx="400" cy="80" rx="8" ry="4"/><ellipse cx="550" cy="50" rx="7" ry="3.5"/>
    <ellipse cx="680" cy="70" rx="8" ry="4"/><ellipse cx="750" cy="110" rx="7" ry="4"/>
  </g>
</svg>`;

// Torre do Relógio da Eternidade
export const BANNER_TORRE_RELOGIO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs><radialGradient id="tr-bg" cx="50%" cy="50%" r="70%"><stop offset="0%" stop-color="#2b1a03"/><stop offset="100%" stop-color="#080400"/></radialGradient></defs>
  <style>
    @keyframes gearCw { 100% { transform: rotate(360deg); } }
    @keyframes gearCcw { 100% { transform: rotate(-360deg); } }
    .gCw { animation: gearCw 20s linear infinite; transform-origin: 600px 200px; }
    .gCcw { animation: gearCcw 14s linear infinite; transform-origin: 600px 200px; }
  </style>
  <rect width="1200" height="400" fill="url(#tr-bg)"/>
  <!-- Giant Clock Face -->
  <circle cx="600" cy="200" r="150" fill="#1c1917" stroke="#d97706" stroke-width="4" filter="drop-shadow(0 0 20px #b45309)"/>
  <!-- Clock Cogs -->
  <g class="gCw" stroke="#fbbf24" stroke-width="3" fill="none">
    <circle cx="600" cy="200" r="130" stroke-dasharray="14 10"/>
  </g>
  <g class="gCcw" stroke="#fef08a" stroke-width="2" fill="none">
    <circle cx="600" cy="200" r="90" stroke-dasharray="8 6"/>
  </g>
  <!-- Clock Hands -->
  <line x1="600" y1="200" x2="600" y2="90" stroke="#fef08a" stroke-width="4" stroke-linecap="round"/>
  <line x1="600" y1="200" x2="680" y2="200" stroke="#fbbf24" stroke-width="5" stroke-linecap="round"/>
  <circle cx="600" cy="200" r="8" fill="#ffffff"/>
</svg>`;

// Pradaria dos Vagalumes Astrais
export const BANNER_PRADARIA_ASTRAL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs><linearGradient id="pa-bg" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#032115"/><stop offset="100%" stop-color="#000a06"/></linearGradient></defs>
  <style>
    @keyframes fireflyFloat { 0%, 100% { transform: translateY(0) scale(0.8); opacity: 0.3; } 50% { transform: translateY(-28px) scale(1.2); opacity: 1; } }
    .ff { animation: fireflyFloat 3.8s ease-in-out infinite; }
  </style>
  <rect width="1200" height="400" fill="url(#pa-bg)"/>
  <!-- Rolling Hills of Grass -->
  <path d="M0,400 L0,290 Q300,240 600,280 T1200,250 L1200,400 Z" fill="#042f2e"/>
  <path d="M0,400 L0,330 Q400,270 800,310 T1200,280 L1200,400 Z" fill="#022c22"/>
  <!-- Glowing Fireflies -->
  <g fill="#fde047" class="ff">
    <circle cx="200" cy="260" r="4" filter="drop-shadow(0 0 8px #facc15)"/>
    <circle cx="450" cy="210" r="4.5" filter="drop-shadow(0 0 8px #facc15)"/>
    <circle cx="680" cy="240" r="3.5" filter="drop-shadow(0 0 8px #facc15)"/>
    <circle cx="920" cy="190" r="4.5" filter="drop-shadow(0 0 8px #facc15)"/>
    <circle cx="1080" cy="230" r="3.5" filter="drop-shadow(0 0 8px #facc15)"/>
  </g>
</svg>`;

// O Quasar da Alvorada
export const BANNER_QUASAR_SUPREMO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs><radialGradient id="qs-bg" cx="50%" cy="50%" r="70%"><stop offset="0%" stop-color="#2a053b"/><stop offset="100%" stop-color="#050008"/></radialGradient></defs>
  <style>
    @keyframes jetSurge { 0%, 100% { opacity: 0.7; stroke-width: 6; } 50% { opacity: 1; stroke-width: 14; } }
    .jSurge { animation: jetSurge 2.6s ease-in-out infinite; }
  </style>
  <rect width="1200" height="400" fill="url(#qs-bg)"/>
  <!-- Relativistic Bipolar Jets -->
  <line x1="600" y1="0" x2="600" y2="400" stroke="#f43f5e" class="jSurge" filter="drop-shadow(0 0 25px #fb7185)"/>
  <line x1="600" y1="0" x2="600" y2="400" stroke="#ffffff" stroke-width="3"/>
  <!-- Dense Gaseous Donut Torus -->
  <ellipse cx="600" cy="200" rx="220" ry="40" fill="#701a75" stroke="#e879f9" stroke-width="3" filter="drop-shadow(0 0 20px #a21caf)"/>
  <!-- Blinding Core -->
  <circle cx="600" cy="200" r="28" fill="#ffffff" filter="drop-shadow(0 0 30px #ffffff)"/>
</svg>`;

// Templo da Deusa da Lua
export const BANNER_SANTUARIO_LUA_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs><linearGradient id="sl-bg" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#0f172a"/><stop offset="100%" stop-color="#020617"/></linearGradient></defs>
  <style>
    @keyframes waterRipple { 0%, 100% { opacity: 0.6; } 50% { opacity: 0.95; } }
    .wRip { animation: waterRipple 4s ease-in-out infinite; }
  </style>
  <rect width="1200" height="400" fill="url(#sl-bg)"/>
  <!-- Giant Silver Moon -->
  <circle cx="600" cy="140" r="85" fill="#f1f5f9" filter="drop-shadow(0 0 35px rgba(241, 245, 249, 0.7))"/>
  <!-- Water Lake at Bottom -->
  <rect x="0" y="270" width="1200" height="130" fill="#080e1a"/>
  <line x1="450" y1="310" x2="750" y2="310" stroke="#cbd5e1" stroke-width="2" class="wRip"/>
  <line x1="500" y1="340" x2="700" y2="340" stroke="#cbd5e1" stroke-width="1.5" class="wRip"/>
  <!-- Pavilion Columns -->
  <rect x="420" y="220" width="16" height="60" fill="#e2e8f0"/>
  <rect x="520" y="220" width="16" height="60" fill="#e2e8f0"/>
  <rect x="664" y="220" width="16" height="60" fill="#e2e8f0"/>
  <rect x="764" y="220" width="16" height="60" fill="#e2e8f0"/>
  <polygon points="380,220 600,165 820,220" fill="#e2e8f0" stroke="#94a3b8" stroke-width="2"/>
</svg>`;

// Fratura no Tecido Temporal
export const BANNER_FENDA_TEMPO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs><linearGradient id="ft-bg" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#451a03"/><stop offset="50%" stop-color="#18181b"/><stop offset="100%" stop-color="#022c22"/></linearGradient></defs>
  <style>
    @keyframes crackPulse { 0%, 100% { stroke-width: 2.5; filter: drop-shadow(0 0 8px #67e8f9); } 50% { stroke-width: 5; filter: drop-shadow(0 0 18px #ffffff); } }
    .cPulse { animation: crackPulse 2.8s ease-in-out infinite; }
  </style>
  <rect width="1200" height="400" fill="url(#ft-bg)"/>
  <!-- Left Side: Ancient Desert Pyramid -->
  <polygon points="120,380 250,220 380,380" fill="#78350f" stroke="#fbbf24" stroke-width="2"/>
  <!-- Right Side: Cyber Hologram Spire -->
  <rect x="900" y="160" width="60" height="220" fill="#042f2e" stroke="#22d3ee" stroke-width="2"/>
  <circle cx="930" cy="140" r="15" fill="#22d3ee" filter="drop-shadow(0 0 12px #22d3ee)"/>
  <!-- Shattered Glass Seam in Center -->
  <path d="M600,0 L570,120 L640,190 L590,280 L620,400" class="cPulse" stroke="#e0f2fe" fill="none"/>
</svg>`;

// Altar Ritualístico de Sangue
export const BANNER_ALTAR_SACRIFICIO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs><radialGradient id="as-bg" cx="50%" cy="50%" r="70%"><stop offset="0%" stop-color="#360209"/><stop offset="100%" stop-color="#080002"/></radialGradient></defs>
  <style>
    @keyframes pentagramSpin { 100% { transform: rotate(360deg); } }
    @keyframes candleFlicker { 0%, 100% { opacity: 0.7; } 50% { opacity: 1; filter: drop-shadow(0 0 8px #ef4444); } }
    .pSpin { animation: pentagramSpin 35s linear infinite; transform-origin: 600px 220px; }
    .cFlick { animation: candleFlicker 1.8s infinite; }
  </style>
  <rect width="1200" height="400" fill="url(#as-bg)"/>
  <!-- Rotating Pentagram / Sigil -->
  <g class="pSpin" stroke="#dc2626" stroke-width="2" fill="none" opacity="0.8">
    <circle cx="600" cy="220" r="110"/>
    <polygon points="600,110 665,290 510,180 690,180 535,290"/>
  </g>
  <!-- Stone Altar with Skulls -->
  <rect x="480" y="270" width="240" height="60" fill="#18181b" stroke="#7f1d1d" stroke-width="2"/>
  <!-- Red Candles -->
  <rect x="500" y="245" width="10" height="25" fill="#450a0a"/>
  <circle cx="505" cy="240" r="4" fill="#f87171" class="cFlick"/>
  <rect x="690" y="245" width="10" height="25" fill="#450a0a"/>
  <circle cx="695" cy="240" r="4" fill="#f87171" class="cFlick"/>
</svg>`;

// Salto para o Hiperespaço
export const BANNER_VIAGEM_HIPERESPACO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs><radialGradient id="vh-bg" cx="50%" cy="50%" r="70%"><stop offset="0%" stop-color="#1e3a8a"/><stop offset="100%" stop-color="#020617"/></radialGradient></defs>
  <style>
    @keyframes warpStreak { 0% { stroke-dashoffset: 400; opacity: 0.2; } 50% { opacity: 1; } 100% { stroke-dashoffset: 0; opacity: 0.2; } }
    .warp { stroke: #60a5fa; stroke-width: 2.5; stroke-dasharray: 80 40; animation: warpStreak 1.8s linear infinite; }
  </style>
  <rect width="1200" height="400" fill="url(#vh-bg)"/>
  <g class="warp">
    <line x1="600" y1="200" x2="0" y2="0"/>
    <line x1="600" y1="200" x2="300" y2="0"/>
    <line x1="600" y1="200" x2="600" y2="0"/>
    <line x1="600" y1="200" x2="900" y2="0"/>
    <line x1="600" y1="200" x2="1200" y2="0"/>
    <line x1="600" y1="200" x2="0" y2="200"/>
    <line x1="600" y1="200" x2="1200" y2="200"/>
    <line x1="600" y1="200" x2="0" y2="400"/>
    <line x1="600" y1="200" x2="300" y2="400"/>
    <line x1="600" y1="200" x2="600" y2="400"/>
    <line x1="600" y1="200" x2="900" y2="400"/>
    <line x1="600" y1="200" x2="1200" y2="400"/>
  </g>
  <circle cx="600" cy="200" r="16" fill="#ffffff" filter="drop-shadow(0 0 25px #93c5fd)"/>
</svg>`;

// Picos Gelados de Titã
export const BANNER_MONTANHAS_NEVE_COSMICA_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs><linearGradient id="tc-bg" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#075985"/><stop offset="100%" stop-color="#031522"/></linearGradient></defs>
  <style>
    @keyframes snowFall { 0% { transform: translateY(0); } 100% { transform: translateY(400px); } }
    .snow { animation: snowFall 6s linear infinite; }
  </style>
  <rect width="1200" height="400" fill="url(#tc-bg)"/>
  <!-- Sharp Mountain Peaks -->
  <polygon points="100,400 300,140 500,400" fill="#0c4a6e" stroke="#e0f2fe" stroke-width="2"/>
  <polygon points="400,400 650,80 900,400" fill="#082f49" stroke="#ffffff" stroke-width="2.5"/>
  <polygon points="800,400 1000,160 1200,400" fill="#0c4a6e" stroke="#e0f2fe" stroke-width="2"/>
  <!-- Falling Snow -->
  <g fill="#ffffff" class="snow" opacity="0.8">
    <circle cx="150" cy="30" r="2"/><circle cx="350" cy="60" r="2.5"/><circle cx="550" cy="20" r="2"/><circle cx="750" cy="40" r="2.5"/><circle cx="950" cy="70" r="2"/><circle cx="1150" cy="30" r="2.5"/>
  </g>
</svg>`;

// Cemitério de Naves Estelares
export const BANNER_CEMITERIO_NAVES_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs><radialGradient id="cn-bg" cx="50%" cy="50%" r="70%"><stop offset="0%" stop-color="#1e1b4b"/><stop offset="100%" stop-color="#05030a"/></radialGradient></defs>
  <style>
    @keyframes hulkDrift { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(2deg) translateY(-8px); } }
    @keyframes beaconBlink { 0%, 100% { opacity: 0.2; } 50% { opacity: 1; filter: drop-shadow(0 0 8px #ef4444); } }
    .hulk { animation: hulkDrift 8s ease-in-out infinite; transform-origin: center; }
    .bBlink { animation: beaconBlink 2s infinite; }
  </style>
  <rect width="1200" height="400" fill="url(#cn-bg)"/>
  <!-- Derelict Cruiser 1 -->
  <g class="hulk" fill="#1e293b" stroke="#64748b" stroke-width="2" transform="translate(300, 160)">
    <polygon points="-120,0 80,-40 140,-10 60,30 -100,20"/>
    <circle cx="120" cy="-10" r="3" fill="#ef4444" class="bBlink"/>
  </g>
  <!-- Derelict Cruiser 2 -->
  <g class="hulk" fill="#0f172a" stroke="#475569" stroke-width="2" transform="translate(850, 180) rotate(-15)">
    <polygon points="-140,10 60,-50 120,0 40,40 -120,30"/>
    <circle cx="100" cy="0" r="3.5" fill="#ef4444" class="bBlink"/>
  </g>
</svg>`;

// Megasustrutura da Esfera de Dyson
export const BANNER_ESFERA_DYSON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs><radialGradient id="ed-bg" cx="50%" cy="50%" r="70%"><stop offset="0%" stop-color="#1e293b"/><stop offset="100%" stop-color="#020617"/></radialGradient></defs>
  <style>
    @keyframes dysonOrbit { 100% { transform: rotate(360deg); } }
    .dOrbit { animation: dysonOrbit 40s linear infinite; transform-origin: 600px 200px; }
  </style>
  <rect width="1200" height="400" fill="url(#ed-bg)"/>
  <!-- Central Star -->
  <circle cx="600" cy="200" r="75" fill="#facc15" filter="drop-shadow(0 0 35px #eab308)"/>
  <!-- Hexagonal Collector Ring -->
  <g class="dOrbit" stroke="#fde047" stroke-width="2.5" fill="none">
    <circle cx="600" cy="200" r="145" stroke-dasharray="24 12"/>
    <polygon points="600,55 725,127 725,273 600,345 475,273 475,127"/>
  </g>
</svg>`;

// Campo das Valquírias
export const BANNER_VALQUIRIA_CAMPO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs><linearGradient id="vk-bg" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#1e1b4b"/><stop offset="100%" stop-color="#05030f"/></linearGradient></defs>
  <style>
    @keyframes swordGlow { 0%, 100% { filter: drop-shadow(0 0 6px #c084fc); } 50% { filter: drop-shadow(0 0 18px #ffffff); } }
    .sGlow { animation: swordGlow 3s ease-in-out infinite; }
  </style>
  <rect width="1200" height="400" fill="url(#vk-bg)"/>
  <!-- Hill -->
  <path d="M0,400 L0,320 Q600,220 1200,320 L1200,400 Z" fill="#0f172a"/>
  <!-- Central Great Sword in Ground -->
  <g class="sGlow" transform="translate(600, 160)">
    <line x1="0" y1="0" x2="0" y2="150" stroke="#ffffff" stroke-width="5"/>
    <line x1="-30" y1="30" x2="30" y2="30" stroke="#fbbf24" stroke-width="4"/>
    <circle cx="0" cy="0" r="6" fill="#fbbf24"/>
  </g>
  <!-- Flanking Swords -->
  <g class="sGlow" transform="translate(450, 200)">
    <line x1="0" y1="0" x2="0" y2="120" stroke="#e2e8f0" stroke-width="4"/>
    <line x1="-20" y1="25" x2="20" y2="25" stroke="#fbbf24" stroke-width="3"/>
  </g>
  <g class="sGlow" transform="translate(750, 200)">
    <line x1="0" y1="0" x2="0" y2="120" stroke="#e2e8f0" stroke-width="4"/>
    <line x1="-20" y1="25" x2="20" y2="25" stroke="#fbbf24" stroke-width="3"/>
  </g>
</svg>`;

// Floresta de Cogumelos Cósmicos
export const BANNER_FLORESTA_FUNGOS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs><linearGradient id="ff-bg" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#022c22"/><stop offset="100%" stop-color="#010a08"/></linearGradient></defs>
  <style>
    @keyframes mushroomBreathe { 0%, 100% { transform: scaleY(1); } 50% { transform: scaleY(1.08); filter: drop-shadow(0 0 18px #34d399); } }
    .mBreathe { animation: mushroomBreathe 4s ease-in-out infinite; transform-origin: bottom; }
  </style>
  <rect width="1200" height="400" fill="url(#ff-bg)"/>
  <!-- Giant Mushroom 1 -->
  <g class="mBreathe" transform="translate(350, 180)">
    <rect x="-15" y="0" width="30" height="220" fill="#042f2e" stroke="#10b981"/>
    <path d="M-90,0 Q0,-90 90,0 Z" fill="#059669" filter="drop-shadow(0 0 14px #34d399)"/>
    <circle cx="-30" cy="-30" r="8" fill="#a7f3d0"/><circle cx="30" cy="-30" r="8" fill="#a7f3d0"/>
  </g>
  <!-- Giant Mushroom 2 (Center) -->
  <g class="mBreathe" transform="translate(750, 150)">
    <rect x="-18" y="0" width="36" height="250" fill="#042f2e" stroke="#10b981"/>
    <path d="M-110,0 Q0,-110 110,0 Z" fill="#0d9488" filter="drop-shadow(0 0 18px #2dd4bf)"/>
    <circle cx="-40" cy="-40" r="10" fill="#99f6e4"/><circle cx="40" cy="-40" r="10" fill="#99f6e4"/>
  </g>
</svg>`;

// Geodo Gigante de Ametista
export const BANNER_CAVERNA_AMETISTA_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs><radialGradient id="ga-bg" cx="50%" cy="50%" r="70%"><stop offset="0%" stop-color="#2e1065"/><stop offset="100%" stop-color="#090117"/></radialGradient></defs>
  <style>
    @keyframes crystalFacet { 0%, 100% { opacity: 0.7; } 50% { opacity: 1; filter: drop-shadow(0 0 15px #e879f9); } }
    .cFacet { animation: crystalFacet 3.2s ease-in-out infinite; }
  </style>
  <rect width="1200" height="400" fill="url(#ga-bg)"/>
  <!-- Top Stalactites of Amethyst -->
  <polygon points="150,0 200,160 250,0" fill="#7e22ce" stroke="#e879f9" stroke-width="2" class="cFacet"/>
  <polygon points="350,0 420,200 490,0" fill="#6b21a8" stroke="#d8b4fe" stroke-width="2.5" class="cFacet"/>
  <polygon points="700,0 770,220 840,0" fill="#6b21a8" stroke="#d8b4fe" stroke-width="2.5" class="cFacet"/>
  <polygon points="950,0 1000,160 1050,0" fill="#7e22ce" stroke="#e879f9" stroke-width="2" class="cFacet"/>
  <!-- Bottom Stalagmites -->
  <polygon points="250,400 300,240 350,400" fill="#6b21a8" stroke="#e879f9" stroke-width="2" class="cFacet"/>
  <polygon points="550,400 620,190 690,400" fill="#7e22ce" stroke="#f472b6" stroke-width="2.5" class="cFacet"/>
  <polygon points="850,400 900,250 950,400" fill="#6b21a8" stroke="#e879f9" stroke-width="2" class="cFacet"/>
</svg>`;

// O Nexus dos Quatro Elementos
export const BANNER_NEXUS_ELEMENTOS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs><radialGradient id="ne-bg" cx="50%" cy="50%" r="70%"><stop offset="0%" stop-color="#1e1b4b"/><stop offset="100%" stop-color="#020108"/></radialGradient></defs>
  <style>
    @keyframes nexusClash { 100% { transform: rotate(360deg); } }
    .nClash { animation: nexusClash 25s linear infinite; transform-origin: 600px 200px; }
  </style>
  <rect width="1200" height="400" fill="url(#ne-bg)"/>
  <!-- 4 Colliding Elemental Nodes -->
  <g class="nClash">
    <!-- Fire (Top) -->
    <circle cx="600" cy="90" r="45" fill="#ef4444" filter="drop-shadow(0 0 20px #f97316)"/>
    <!-- Ice (Right) -->
    <circle cx="710" cy="200" r="45" fill="#06b6d4" filter="drop-shadow(0 0 20px #38bdf8)"/>
    <!-- Earth (Bottom) -->
    <circle cx="600" cy="310" r="45" fill="#10b981" filter="drop-shadow(0 0 20px #34d399)"/>
    <!-- Lightning (Left) -->
    <circle cx="490" cy="200" r="45" fill="#a855f7" filter="drop-shadow(0 0 20px #c084fc)"/>
  </g>
  <!-- Central White Fusion Core -->
  <circle cx="600" cy="200" r="22" fill="#ffffff" filter="drop-shadow(0 0 25px #ffffff)"/>
</svg>`;

// A Sala do Trono do Project Nox
export const BANNER_TRONO_SOBERANO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs><linearGradient id="ts-bg" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#180e29"/><stop offset="100%" stop-color="#05020a"/></linearGradient></defs>
  <style>
    @keyframes throneAura { 0%, 100% { filter: drop-shadow(0 0 15px #fbbf24); } 50% { filter: drop-shadow(0 0 35px #f59e0b); } }
    .tAura { animation: throneAura 3.5s ease-in-out infinite; }
  </style>
  <rect width="1200" height="400" fill="url(#ts-bg)"/>
  <!-- High Stained Glass Window with Galaxy -->
  <polygon points="480,0 720,0 700,240 500,240" fill="#3b0764" opacity="0.6"/>
  <!-- Carpet Dais Steps -->
  <polygon points="350,400 850,400 750,290 450,290" fill="#7f1d1d" stroke="#fbbf24" stroke-width="2"/>
  <!-- Grand Obsidian & Gold Throne -->
  <g class="tAura" fill="#0f172a" stroke="#fbbf24" stroke-width="2.5">
    <!-- Backrest -->
    <polygon points="560,110 600,60 640,110 635,280 565,280"/>
    <!-- Seat -->
    <rect x="550" y="260" width="100" height="30" fill="#450a0a"/>
    <!-- Armrests -->
    <rect x="535" y="240" width="15" height="40" fill="#fbbf24"/>
    <rect x="650" y="240" width="15" height="40" fill="#fbbf24"/>
  </g>
</svg>`;

export const CURATED_BANNER_BACKGROUNDS: Record<string, string> = {
  'banner_nebulosa_vazio': svgToDataUri(BANNER_NEBULOSA_VAZIO_SVG),
  'banner_aurora_astral': svgToDataUri(BANNER_AURORA_ASTRAL_SVG),
  'banner_energia_arcana': svgToDataUri(BANNER_ENERGIA_ARCANA_SVG),
  'banner_eclipse_cosmico': svgToDataUri(BANNER_ECLIPSE_COSMICO_SVG),
  'banner_biblioteca_estrelas': svgToDataUri(BANNER_BIBLIOTECA_ESTRELAS_SVG),
  'banner_fenda_runica': svgToDataUri(BANNER_FENDA_RUNICA_SVG),
  'banner_chuva_meteoros': svgToDataUri(BANNER_CHUVA_METEOROS_SVG),
  'banner_portal_abissal': svgToDataUri(BANNER_PORTAL_ABISSAL_SVG),
  'banner_jardim_astral': svgToDataUri(BANNER_JARDIM_ASTRAL_SVG),
  'banner_cidadela_celestial': svgToDataUri(BANNER_CIDADELA_CELESTIAL_SVG),
  'banner_ruinas_celestes': svgToDataUri(BANNER_RUINAS_CELESTES_SVG),
  'banner_luas_multiplas': svgToDataUri(BANNER_LUAS_MULTIPLAS_SVG),
  'banner_vulcao_cosmico': svgToDataUri(BANNER_VULCAO_COSMICO_SVG),
  'banner_ceu_infernal': svgToDataUri(BANNER_CEU_INFERNAL_SVG),
  'banner_santuario_dourado': svgToDataUri(BANNER_SANTUARIO_DOURADO_SVG),
  'banner_tempestade_estelar': svgToDataUri(BANNER_TEMPESTADE_ESTELAR_SVG),
  'banner_runas_vivas': svgToDataUri(BANNER_RUNAS_VIVAS_SVG),
  'banner_oceano_celestial': svgToDataUri(BANNER_OCEANO_CELESTIAL_SVG),
  'banner_templo_astronomico': svgToDataUri(BANNER_TEMPLO_ASTRONOMICO_SVG),
  'banner_buraco_negro': svgToDataUri(BANNER_BURACO_NEGRO_SVG),
  'banner_floresta_cristal': svgToDataUri(BANNER_FLORESTA_CRISTAL_SVG),
  'banner_cidade_cyberpunk': svgToDataUri(BANNER_CIDADE_CYBERPUNK_SVG),
  'banner_fenix_ascendente': svgToDataUri(BANNER_FENIX_ASCENDENTE_SVG),
  'banner_mar_de_estrelas': svgToDataUri(BANNER_MAR_DE_ESTRELAS_SVG),
  'banner_cacador_cometas': svgToDataUri(BANNER_CACADOR_COMETAS_SVG),
  'banner_labirinto_espelho': svgToDataUri(BANNER_LABIRINTO_ESPELHO_SVG),
  'banner_castelo_gotico': svgToDataUri(BANNER_CASTELO_GOTICO_SVG),
  'banner_aneis_saturno': svgToDataUri(BANNER_ANEIS_SATURNO_SVG),
  'banner_ponte_bifrost': svgToDataUri(BANNER_PONTE_BIFROST_SVG),
  'banner_dragao_celeste': svgToDataUri(BANNER_DRAGAO_CELESTE_SVG),
  'banner_ilha_flutuante': svgToDataUri(BANNER_ILHA_FLUTUANTE_SVG),
  'banner_forja_estelar': svgToDataUri(BANNER_FORJA_ESTELAR_SVG),
  'banner_fundo_marinho_abissal': svgToDataUri(BANNER_FUNDO_MARINHO_ABISSAL_SVG),
  'banner_matrix_digital': svgToDataUri(BANNER_MATRIX_DIGITAL_SVG),
  'banner_sakura_noturna': svgToDataUri(BANNER_SAKURA_NOTURNA_SVG),
  'banner_torre_relogio': svgToDataUri(BANNER_TORRE_RELOGIO_SVG),
  'banner_pradaria_astral': svgToDataUri(BANNER_PRADARIA_ASTRAL_SVG),
  'banner_quasar_supremo': svgToDataUri(BANNER_QUASAR_SUPREMO_SVG),
  'banner_santuario_lua': svgToDataUri(BANNER_SANTUARIO_LUA_SVG),
  'banner_fenda_tempo': svgToDataUri(BANNER_FENDA_TEMPO_SVG),
  'banner_altar_sacrificio': svgToDataUri(BANNER_ALTAR_SACRIFICIO_SVG),
  'banner_viagem_hiperespaco': svgToDataUri(BANNER_VIAGEM_HIPERESPACO_SVG),
  'banner_montanhas_neve_cosmica': svgToDataUri(BANNER_MONTANHAS_NEVE_COSMICA_SVG),
  'banner_cemiterio_naves': svgToDataUri(BANNER_CEMITERIO_NAVES_SVG),
  'banner_esfera_dyson': svgToDataUri(BANNER_ESFERA_DYSON_SVG),
  'banner_valquiria_campo': svgToDataUri(BANNER_VALQUIRIA_CAMPO_SVG),
  'banner_floresta_fungos': svgToDataUri(BANNER_FLORESTA_FUNGOS_SVG),
  'banner_caverna_ametista': svgToDataUri(BANNER_CAVERNA_AMETISTA_SVG),
  'banner_nexus_elementos': svgToDataUri(BANNER_NEXUS_ELEMENTOS_SVG),
  'banner_trono_soberano': svgToDataUri(BANNER_TRONO_SOBERANO_SVG),
};
