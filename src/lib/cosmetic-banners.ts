/**
 * High-definition Procedural Animated Cosmic Vector Banners for Project Nox (Round 5)
 * 50 Pure SVG vectors with rich compositions and native CSS keyframe animations.
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
    <radialGradient id="nv-cloud-1" cx="72%" cy="38%" r="48%"><stop offset="0%" stop-color="rgba(168, 85, 247, 0.55)"/><stop offset="45%" stop-color="rgba(139, 92, 246, 0.28)"/><stop offset="100%" stop-color="transparent"/></radialGradient>
    <radialGradient id="nv-cloud-2" cx="28%" cy="65%" r="45%"><stop offset="0%" stop-color="rgba(56, 189, 248, 0.45)"/><stop offset="55%" stop-color="rgba(99, 102, 241, 0.22)"/><stop offset="100%" stop-color="transparent"/></radialGradient>
  </defs>
  <style>
    @keyframes nvDrift1 { 0%, 100% { opacity: 0.8; transform: translate(0,0) scale(1); } 50% { opacity: 1; transform: translate(-25px, 14px) scale(1.08); } }
    @keyframes nvDrift2 { 0%, 100% { opacity: 0.7; transform: translate(0,0) scale(1); } 50% { opacity: 0.95; transform: translate(22px, -16px) scale(1.1); } }
    @keyframes starPulse1 { 0%, 100% { opacity: 0.25; transform: scale(0.85); } 50% { opacity: 1; transform: scale(1.25); } }
    @keyframes meteorStreak { 0% { transform: translate(-100px, -50px); opacity: 0; } 15% { opacity: 1; } 35% { transform: translate(320px, 160px); opacity: 0; } 100% { transform: translate(320px, 160px); opacity: 0; } }
    .nv-c1 { animation: nvDrift1 10s ease-in-out infinite; transform-origin: 72% 38%; }
    .nv-c2 { animation: nvDrift2 12s ease-in-out infinite; transform-origin: 28% 65%; }
    .star-a { animation: starPulse1 2.8s ease-in-out infinite; transform-origin: center; }
    .meteor-1 { animation: meteorStreak 6s linear infinite; }
  </style>
  <rect width="1200" height="400" fill="url(#nv-bg)"/>
  <rect class="nv-c1" width="1200" height="400" fill="url(#nv-cloud-1)"/>
  <rect class="nv-c2" width="1200" height="400" fill="url(#nv-cloud-2)"/>
  <g stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" opacity="0.85">
    <line x1="200" y1="30" x2="260" y2="60" class="meteor-1" filter="drop-shadow(0 0 6px #c084fc)"/>
  </g>
  <g fill="#ffffff" class="star-a">
    <circle cx="120" cy="80" r="1.5"/><circle cx="340" cy="220" r="1.8"/><circle cx="580" cy="90" r="1.4"/><circle cx="820" cy="180" r="2"/><circle cx="1040" cy="110" r="1.6"/>
  </g>
</svg>`;

// Aurora Astral & Fitas Polares
export const BANNER_AURORA_ASTRAL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="aa-bg" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#02131b"/><stop offset="60%" stop-color="#041f26"/><stop offset="100%" stop-color="#010a0f"/></linearGradient>
    <linearGradient id="aa-ribbon-1" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="transparent"/><stop offset="25%" stop-color="rgba(16, 185, 129, 0.65)"/><stop offset="60%" stop-color="rgba(56, 189, 248, 0.7)"/><stop offset="100%" stop-color="transparent"/></linearGradient>
    <linearGradient id="aa-ribbon-2" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="transparent"/><stop offset="35%" stop-color="rgba(168, 85, 247, 0.55)"/><stop offset="75%" stop-color="rgba(52, 211, 153, 0.6)"/><stop offset="100%" stop-color="transparent"/></linearGradient>
  </defs>
  <style>
    @keyframes waveRibbon1 { 0%, 100% { transform: translateY(0) scaleY(1); } 50% { transform: translateY(-28px) scaleY(1.15); } }
    @keyframes waveRibbon2 { 0%, 100% { transform: translateY(0) scaleY(1); } 50% { transform: translateY(22px) scaleY(0.9); } }
    .rb-1 { animation: waveRibbon1 7s ease-in-out infinite; transform-origin: 50% 50%; }
    .rb-2 { animation: waveRibbon2 8.5s ease-in-out infinite; transform-origin: 50% 50%; }
  </style>
  <rect width="1200" height="400" fill="url(#aa-bg)"/>
  <path class="rb-1" d="M0,160 Q300,70 600,160 T1200,140 L1200,280 Q900,340 600,270 T0,280 Z" fill="url(#aa-ribbon-1)" opacity="0.8"/>
  <path class="rb-2" d="M0,210 Q300,290 600,200 T1200,220 L1200,320 Q900,380 600,310 T0,320 Z" fill="url(#aa-ribbon-2)" opacity="0.75"/>
</svg>`;

// Energia Arcana & Astrolábio
export const BANNER_ENERGIA_ARCANA_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="ea-bg" cx="50%" cy="50%" r="70%"><stop offset="0%" stop-color="#190a36"/><stop offset="60%" stop-color="#0c041c"/><stop offset="100%" stop-color="#04020a"/></radialGradient>
    <radialGradient id="ea-core-glow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#ffffff"/><stop offset="35%" stop-color="rgba(192, 132, 252, 0.95)"/><stop offset="70%" stop-color="rgba(147, 51, 234, 0.5)"/><stop offset="100%" stop-color="transparent"/></radialGradient>
  </defs>
  <style>
    @keyframes spinCw { 100% { transform: rotate(360deg); } }
    @keyframes spinCcw { 100% { transform: rotate(-360deg); } }
    @keyframes corePulse { 0%, 100% { transform: scale(0.92); opacity: 0.85; } 50% { transform: scale(1.15); opacity: 1; } }
    .rot-cw { animation: spinCw 25s linear infinite; transform-origin: 880px 200px; }
    .rot-ccw { animation: spinCcw 18s linear infinite; transform-origin: 880px 200px; }
    .core-pulse { animation: corePulse 3s ease-in-out infinite; transform-origin: 880px 200px; }
  </style>
  <rect width="1200" height="400" fill="url(#ea-bg)"/>
  <circle cx="880" cy="200" r="160" class="core-pulse" fill="url(#ea-core-glow)"/>
  <g class="rot-cw" stroke="rgba(216, 180, 254, 0.75)" stroke-width="1.8" fill="none">
    <circle cx="880" cy="200" r="150" stroke-dasharray="14 8"/>
    <circle cx="880" cy="200" r="110"/>
    <polygon points="880,90 975,255 785,255"/>
  </g>
  <g class="rot-ccw" stroke="rgba(56, 189, 248, 0.7)" stroke-width="1.6" fill="none">
    <circle cx="880" cy="200" r="130" stroke-dasharray="8 6"/>
    <polygon points="880,310 785,145 975,145"/>
  </g>
</svg>`;

// Eclipse Cósmico & Corona Solar
export const BANNER_ECLIPSE_COSMICO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="ec-bg" cx="50%" cy="50%" r="70%"><stop offset="0%" stop-color="#1f0a14"/><stop offset="50%" stop-color="#12040b"/><stop offset="100%" stop-color="#050103"/></radialGradient>
    <radialGradient id="ec-corona" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#ffffff"/><stop offset="25%" stop-color="#f97316"/><stop offset="55%" stop-color="#ef4444"/><stop offset="100%" stop-color="transparent"/></radialGradient>
  </defs>
  <style>
    @keyframes ecCoronaPulse { 0%, 100% { transform: scale(1); opacity: 0.85; } 50% { transform: scale(1.12); opacity: 1; } }
    @keyframes ecSpin { 100% { transform: rotate(360deg); } }
    .ec-pulse { animation: ecCoronaPulse 4s ease-in-out infinite; transform-origin: 320px 200px; }
    .ec-spin { animation: ecSpin 40s linear infinite; transform-origin: 320px 200px; }
  </style>
  <rect width="1200" height="400" fill="url(#ec-bg)"/>
  <circle cx="320" cy="200" r="180" class="ec-pulse" fill="url(#ec-corona)"/>
  <g class="ec-spin" stroke="rgba(251, 146, 60, 0.6)" stroke-width="2">
    <line x1="320" y1="20" x2="320" y2="380"/>
    <line x1="140" y1="200" x2="500" y2="200"/>
    <line x1="192" y1="72" x2="448" y2="328"/>
    <line x1="192" y1="328" x2="448" y2="72"/>
  </g>
  <circle cx="320" cy="200" r="95" fill="#050103" stroke="#f97316" stroke-width="3" filter="drop-shadow(0 0 15px rgba(239, 68, 68, 0.9))"/>
</svg>`;

// Biblioteca das Estrelas
export const BANNER_BIBLIOTECA_ESTRELAS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="be-bg" cx="50%" cy="50%" r="70%"><stop offset="0%" stop-color="#1c1605"/><stop offset="60%" stop-color="#0f0b02"/><stop offset="100%" stop-color="#040300"/></radialGradient>
  </defs>
  <style>
    @keyframes armSpin1 { 100% { transform: rotate(360deg); } }
    @keyframes armSpin2 { 100% { transform: rotate(-360deg); } }
    .arm-1 { animation: armSpin1 22s linear infinite; transform-origin: 920px 200px; }
    .arm-2 { animation: armSpin2 16s linear infinite; transform-origin: 920px 200px; }
  </style>
  <rect width="1200" height="400" fill="url(#be-bg)"/>
  <g class="arm-1" stroke="#fbbf24" stroke-width="2" fill="none">
    <circle cx="920" cy="200" r="140" stroke-dasharray="16 10"/>
    <ellipse cx="920" cy="200" rx="140" ry="50"/>
  </g>
  <g class="arm-2" stroke="#fef08a" stroke-width="1.6" fill="none">
    <ellipse cx="920" cy="200" rx="140" ry="50" transform="rotate(60 920 200)"/>
    <circle cx="920" cy="200" r="25" fill="#fbbf24" filter="drop-shadow(0 0 16px #fbbf24)"/>
  </g>
</svg>`;

// Fenda Rúnica & Monólitos
export const BANNER_FENDA_RUNICA_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="fr-bg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#05081c"/><stop offset="50%" stop-color="#0c1236"/><stop offset="100%" stop-color="#02040e"/></linearGradient>
  </defs>
  <style>
    @keyframes monoFloat1 { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-18px); } }
    @keyframes monoFloat2 { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(16px); } }
    @keyframes riftPulse { 0%, 100% { opacity: 0.8; stroke-width: 3; } 50% { opacity: 1; stroke-width: 6; } }
    .mf-1 { animation: monoFloat1 5s ease-in-out infinite; }
    .mf-2 { animation: monoFloat2 6s ease-in-out infinite; }
    .rp { animation: riftPulse 2.5s ease-in-out infinite; }
  </style>
  <rect width="1200" height="400" fill="url(#fr-bg)"/>
  <path class="rp" d="M600,0 Q580,120 620,200 Q590,300 600,400" stroke="#38bdf8" fill="none" filter="drop-shadow(0 0 12px #38bdf8)"/>
  <polygon class="mf-1" points="480,140 520,130 510,240 470,250" fill="#1e293b" stroke="#38bdf8" stroke-width="2"/>
  <polygon class="mf-2" points="700,160 740,150 730,260 690,270" fill="#1e293b" stroke="#38bdf8" stroke-width="2"/>
</svg>`;

// Chuva de Meteoros Cósmica
export const BANNER_CHUVA_METEOROS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="cm-bg" cx="50%" cy="50%" r="75%"><stop offset="0%" stop-color="#140b2b"/><stop offset="100%" stop-color="#030209"/></radialGradient>
  </defs>
  <style>
    @keyframes meteorRain {
      0% { transform: translate(-100px, -80px); opacity: 0; }
      20% { opacity: 1; }
      80% { opacity: 1; }
      100% { transform: translate(600px, 450px); opacity: 0; }
    }
    .m-fast-1 { animation: meteorRain 3s linear infinite; }
    .m-fast-2 { animation: meteorRain 4.2s linear infinite 1.2s; }
    .m-fast-3 { animation: meteorRain 3.6s linear infinite 2.1s; }
  </style>
  <rect width="1200" height="400" fill="url(#cm-bg)"/>
  <g stroke="#ffffff" stroke-width="2.5" stroke-linecap="round">
    <line x1="200" y1="20" x2="280" y2="80" class="m-fast-1" filter="drop-shadow(0 0 8px #f43f5e)"/>
    <line x1="600" y1="10" x2="680" y2="70" class="m-fast-2" filter="drop-shadow(0 0 8px #38bdf8)"/>
    <line x1="900" y1="30" x2="980" y2="90" class="m-fast-3" filter="drop-shadow(0 0 8px #fbbf24)"/>
  </g>
</svg>`;

// Portal do Vácuo Quântico
export const BANNER_PORTAL_ABISSAL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="pa-bg" cx="50%" cy="50%" r="70%"><stop offset="0%" stop-color="#24072f"/><stop offset="100%" stop-color="#040106"/></radialGradient>
  </defs>
  <style>
    @keyframes spinCw { 100% { transform: rotate(360deg); } }
    @keyframes spinCcw { 100% { transform: rotate(-360deg); } }
    .p-ring-1 { animation: spinCw 14s linear infinite; transform-origin: 600px 200px; }
    .p-ring-2 { animation: spinCcw 10s linear infinite; transform-origin: 600px 200px; }
  </style>
  <rect width="1200" height="400" fill="url(#pa-bg)"/>
  <g class="p-ring-1" stroke="#ec4899" stroke-width="2.5" fill="none">
    <ellipse cx="600" cy="200" rx="160" ry="80"/>
    <circle cx="600" cy="200" r="140" stroke-dasharray="20 12"/>
  </g>
  <g class="p-ring-2" stroke="#8b5cf6" stroke-width="2" fill="none">
    <ellipse cx="600" cy="200" rx="80" ry="160"/>
    <circle cx="600" cy="200" r="60" fill="#040106" stroke="#ffffff" filter="drop-shadow(0 0 20px #a855f7)"/>
  </g>
</svg>`;

// Jardim Botânico Astral
export const BANNER_JARDIM_ASTRAL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="ja-bg" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#021a15"/><stop offset="100%" stop-color="#010806"/></linearGradient>
  </defs>
  <style>
    @keyframes sporeFloat { 0%, 100% { transform: translateY(0); opacity: 0.4; } 50% { transform: translateY(-30px); opacity: 1; } }
    @keyframes lotusBreathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.08); } }
    .spore { animation: sporeFloat 4s ease-in-out infinite; }
    .lotus { animation: lotusBreathe 5s ease-in-out infinite; transform-origin: center; }
  </style>
  <rect width="1200" height="400" fill="url(#ja-bg)"/>
  <g class="lotus" transform="translate(600, 260)">
    <circle cx="0" cy="0" r="45" fill="none" stroke="#10b981" stroke-width="2.5"/>
    <path d="M-30,10 Q0,-40 30,10 Q0,20 -30,10 Z" fill="#34d399" opacity="0.8"/>
  </g>
  <g fill="#6ee7b7" class="spore">
    <circle cx="250" cy="220" r="4"/><circle cx="450" cy="160" r="3"/><circle cx="800" cy="210" r="4.5"/><circle cx="980" cy="170" r="3"/>
  </g>
</svg>`;

// Cidadela Flutuante do Nox
export const BANNER_CIDADELA_CELESTIAL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="cc-bg" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#0f172a"/><stop offset="100%" stop-color="#020617"/></linearGradient>
  </defs>
  <style>
    @keyframes citFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-16px); } }
    @keyframes beamPulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.9; } }
    .cit { animation: citFloat 6s ease-in-out infinite; }
    .beam { animation: beamPulse 3s ease-in-out infinite; }
  </style>
  <rect width="1200" height="400" fill="url(#cc-bg)"/>
  <g class="beam" stroke="#38bdf8" stroke-width="1.5" opacity="0.6">
    <line x1="600" y1="0" x2="600" y2="400"/>
    <line x1="450" y1="40" x2="450" y2="360"/>
    <line x1="750" y1="40" x2="750" y2="360"/>
  </g>
  <g class="cit">
    <polygon points="500,280 600,140 700,280 600,320" fill="#1e293b" stroke="#0ea5e9" stroke-width="2.5" filter="drop-shadow(0 0 20px #0284c7)"/>
    <polygon points="570,140 600,90 630,140" fill="#38bdf8"/>
  </g>
</svg>`;

// Ruínas Celestes da Antiguidade
export const BANNER_RUINAS_CELESTES_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="banner_ruinas_celestes-bg" cx="50%" cy="50%" r="75%"><stop offset="0%" stop-color="#4338ca"/><stop offset="60%" stop-color="#1e1b4b"/><stop offset="100%" stop-color="#020205"/></radialGradient>
    <linearGradient id="banner_ruinas_celestes-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#818cf8" stop-opacity="0.8"/><stop offset="100%" stop-color="#4338ca" stop-opacity="0.2"/></linearGradient>
  </defs>
  <style>
    @ruinSpin { 0%, 100% { transform: translateY(0) scale(1); opacity: 0.75; } 50% { transform: translateY(-20px) scale(1.08); opacity: 1; } }
    @floatDrift { 0%, 100% { transform: rotate(0deg); opacity: 0.6; } 50% { transform: rotate(180deg); opacity: 0.95; } }
    .elem-1 { animation: ruinSpin 5s ease-in-out infinite; transform-origin: center; }
    .elem-2 { animation: floatDrift 18s linear infinite; transform-origin: 900px 200px; }
    .pulse-star { animation: ruinSpin 3s ease-in-out infinite; }
  </style>
  <rect width="1200" height="400" fill="url(#banner_ruinas_celestes-bg)"/>
  <circle cx="900" cy="200" r="140" class="elem-2" stroke="#818cf8" stroke-width="2" stroke-dasharray="16 12" fill="none" opacity="0.6"/>
  <circle cx="900" cy="200" r="90" class="elem-2" stroke="#818cf8" stroke-width="1.5" stroke-dasharray="8 6" fill="none" opacity="0.4"/>
  <g class="elem-1">
    <path d="M150,280 Q300,160 450,260 T750,220 L750,380 L150,380 Z" fill="url(#banner_ruinas_celestes-grad)" opacity="0.5"/>
    <polygon points="600,120 640,190 560,190" fill="#818cf8" opacity="0.85" filter="drop-shadow(0 0 14px #818cf8)"/>
    <circle cx="600" cy="100" r="6" fill="#ffffff" filter="drop-shadow(0 0 8px #818cf8)"/>
  </g>
  <g fill="#ffffff" class="pulse-star" opacity="0.7">
    <circle cx="180" cy="90" r="2"/><circle cx="380" cy="60" r="2.5"/><circle cx="720" cy="80" r="1.8"/><circle cx="1080" cy="120" r="2.2"/><circle cx="1140" cy="260" r="2"/>
  </g>
</svg>`;

// Céu das Três Luas Astrais
export const BANNER_LUAS_MULTIPLAS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="banner_luas_multiplas-bg" cx="50%" cy="50%" r="75%"><stop offset="0%" stop-color="#1e293b"/><stop offset="60%" stop-color="#020617"/><stop offset="100%" stop-color="#020205"/></radialGradient>
    <linearGradient id="banner_luas_multiplas-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#cbd5e1" stop-opacity="0.8"/><stop offset="100%" stop-color="#1e293b" stop-opacity="0.2"/></linearGradient>
  </defs>
  <style>
    @moonPulse { 0%, 100% { transform: translateY(0) scale(1); opacity: 0.75; } 50% { transform: translateY(-20px) scale(1.08); opacity: 1; } }
    @waveRibbon { 0%, 100% { transform: rotate(0deg); opacity: 0.6; } 50% { transform: rotate(180deg); opacity: 0.95; } }
    .elem-1 { animation: moonPulse 5s ease-in-out infinite; transform-origin: center; }
    .elem-2 { animation: waveRibbon 18s linear infinite; transform-origin: 900px 200px; }
    .pulse-star { animation: moonPulse 3s ease-in-out infinite; }
  </style>
  <rect width="1200" height="400" fill="url(#banner_luas_multiplas-bg)"/>
  <circle cx="900" cy="200" r="140" class="elem-2" stroke="#cbd5e1" stroke-width="2" stroke-dasharray="16 12" fill="none" opacity="0.6"/>
  <circle cx="900" cy="200" r="90" class="elem-2" stroke="#cbd5e1" stroke-width="1.5" stroke-dasharray="8 6" fill="none" opacity="0.4"/>
  <g class="elem-1">
    <path d="M150,280 Q300,160 450,260 T750,220 L750,380 L150,380 Z" fill="url(#banner_luas_multiplas-grad)" opacity="0.5"/>
    <polygon points="600,120 640,190 560,190" fill="#cbd5e1" opacity="0.85" filter="drop-shadow(0 0 14px #cbd5e1)"/>
    <circle cx="600" cy="100" r="6" fill="#ffffff" filter="drop-shadow(0 0 8px #cbd5e1)"/>
  </g>
  <g fill="#ffffff" class="pulse-star" opacity="0.7">
    <circle cx="180" cy="90" r="2"/><circle cx="380" cy="60" r="2.5"/><circle cx="720" cy="80" r="1.8"/><circle cx="1080" cy="120" r="2.2"/><circle cx="1140" cy="260" r="2"/>
  </g>
</svg>`;

// Vulcão Cósmico de Antimatéria
export const BANNER_VULCAO_COSMICO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="banner_vulcao_cosmico-bg" cx="50%" cy="50%" r="75%"><stop offset="0%" stop-color="#991b1b"/><stop offset="60%" stop-color="#450a0a"/><stop offset="100%" stop-color="#020205"/></radialGradient>
    <linearGradient id="banner_vulcao_cosmico-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#ef4444" stop-opacity="0.8"/><stop offset="100%" stop-color="#991b1b" stop-opacity="0.2"/></linearGradient>
  </defs>
  <style>
    @magmaSurge { 0%, 100% { transform: translateY(0) scale(1); opacity: 0.75; } 50% { transform: translateY(-20px) scale(1.08); opacity: 1; } }
    @emberFly { 0%, 100% { transform: rotate(0deg); opacity: 0.6; } 50% { transform: rotate(180deg); opacity: 0.95; } }
    .elem-1 { animation: magmaSurge 5s ease-in-out infinite; transform-origin: center; }
    .elem-2 { animation: emberFly 18s linear infinite; transform-origin: 900px 200px; }
    .pulse-star { animation: magmaSurge 3s ease-in-out infinite; }
  </style>
  <rect width="1200" height="400" fill="url(#banner_vulcao_cosmico-bg)"/>
  <circle cx="900" cy="200" r="140" class="elem-2" stroke="#ef4444" stroke-width="2" stroke-dasharray="16 12" fill="none" opacity="0.6"/>
  <circle cx="900" cy="200" r="90" class="elem-2" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="8 6" fill="none" opacity="0.4"/>
  <g class="elem-1">
    <path d="M150,280 Q300,160 450,260 T750,220 L750,380 L150,380 Z" fill="url(#banner_vulcao_cosmico-grad)" opacity="0.5"/>
    <polygon points="600,120 640,190 560,190" fill="#ef4444" opacity="0.85" filter="drop-shadow(0 0 14px #ef4444)"/>
    <circle cx="600" cy="100" r="6" fill="#ffffff" filter="drop-shadow(0 0 8px #ef4444)"/>
  </g>
  <g fill="#ffffff" class="pulse-star" opacity="0.7">
    <circle cx="180" cy="90" r="2"/><circle cx="380" cy="60" r="2.5"/><circle cx="720" cy="80" r="1.8"/><circle cx="1080" cy="120" r="2.2"/><circle cx="1140" cy="260" r="2"/>
  </g>
</svg>`;

// Céu Infernal do Abismo
export const BANNER_CEU_INFERNAL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="banner_ceu_infernal-bg" cx="50%" cy="50%" r="75%"><stop offset="0%" stop-color="#701a75"/><stop offset="60%" stop-color="#3b0764"/><stop offset="100%" stop-color="#020205"/></radialGradient>
    <linearGradient id="banner_ceu_infernal-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#f43f5e" stop-opacity="0.8"/><stop offset="100%" stop-color="#701a75" stop-opacity="0.2"/></linearGradient>
  </defs>
  <style>
    @cloudChurn { 0%, 100% { transform: translateY(0) scale(1); opacity: 0.75; } 50% { transform: translateY(-20px) scale(1.08); opacity: 1; } }
    @hellLightning { 0%, 100% { transform: rotate(0deg); opacity: 0.6; } 50% { transform: rotate(180deg); opacity: 0.95; } }
    .elem-1 { animation: cloudChurn 5s ease-in-out infinite; transform-origin: center; }
    .elem-2 { animation: hellLightning 18s linear infinite; transform-origin: 900px 200px; }
    .pulse-star { animation: cloudChurn 3s ease-in-out infinite; }
  </style>
  <rect width="1200" height="400" fill="url(#banner_ceu_infernal-bg)"/>
  <circle cx="900" cy="200" r="140" class="elem-2" stroke="#f43f5e" stroke-width="2" stroke-dasharray="16 12" fill="none" opacity="0.6"/>
  <circle cx="900" cy="200" r="90" class="elem-2" stroke="#f43f5e" stroke-width="1.5" stroke-dasharray="8 6" fill="none" opacity="0.4"/>
  <g class="elem-1">
    <path d="M150,280 Q300,160 450,260 T750,220 L750,380 L150,380 Z" fill="url(#banner_ceu_infernal-grad)" opacity="0.5"/>
    <polygon points="600,120 640,190 560,190" fill="#f43f5e" opacity="0.85" filter="drop-shadow(0 0 14px #f43f5e)"/>
    <circle cx="600" cy="100" r="6" fill="#ffffff" filter="drop-shadow(0 0 8px #f43f5e)"/>
  </g>
  <g fill="#ffffff" class="pulse-star" opacity="0.7">
    <circle cx="180" cy="90" r="2"/><circle cx="380" cy="60" r="2.5"/><circle cx="720" cy="80" r="1.8"/><circle cx="1080" cy="120" r="2.2"/><circle cx="1140" cy="260" r="2"/>
  </g>
</svg>`;

// Santuário Dourado Solar
export const BANNER_SANTUARIO_DOURADO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="banner_santuario_dourado-bg" cx="50%" cy="50%" r="75%"><stop offset="0%" stop-color="#854d0e"/><stop offset="60%" stop-color="#422006"/><stop offset="100%" stop-color="#020205"/></radialGradient>
    <linearGradient id="banner_santuario_dourado-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#fbbf24" stop-opacity="0.8"/><stop offset="100%" stop-color="#854d0e" stop-opacity="0.2"/></linearGradient>
  </defs>
  <style>
    @sunRays { 0%, 100% { transform: translateY(0) scale(1); opacity: 0.75; } 50% { transform: translateY(-20px) scale(1.08); opacity: 1; } }
    @haloSpin { 0%, 100% { transform: rotate(0deg); opacity: 0.6; } 50% { transform: rotate(180deg); opacity: 0.95; } }
    .elem-1 { animation: sunRays 5s ease-in-out infinite; transform-origin: center; }
    .elem-2 { animation: haloSpin 18s linear infinite; transform-origin: 900px 200px; }
    .pulse-star { animation: sunRays 3s ease-in-out infinite; }
  </style>
  <rect width="1200" height="400" fill="url(#banner_santuario_dourado-bg)"/>
  <circle cx="900" cy="200" r="140" class="elem-2" stroke="#fbbf24" stroke-width="2" stroke-dasharray="16 12" fill="none" opacity="0.6"/>
  <circle cx="900" cy="200" r="90" class="elem-2" stroke="#fbbf24" stroke-width="1.5" stroke-dasharray="8 6" fill="none" opacity="0.4"/>
  <g class="elem-1">
    <path d="M150,280 Q300,160 450,260 T750,220 L750,380 L150,380 Z" fill="url(#banner_santuario_dourado-grad)" opacity="0.5"/>
    <polygon points="600,120 640,190 560,190" fill="#fbbf24" opacity="0.85" filter="drop-shadow(0 0 14px #fbbf24)"/>
    <circle cx="600" cy="100" r="6" fill="#ffffff" filter="drop-shadow(0 0 8px #fbbf24)"/>
  </g>
  <g fill="#ffffff" class="pulse-star" opacity="0.7">
    <circle cx="180" cy="90" r="2"/><circle cx="380" cy="60" r="2.5"/><circle cx="720" cy="80" r="1.8"/><circle cx="1080" cy="120" r="2.2"/><circle cx="1140" cy="260" r="2"/>
  </g>
</svg>`;

// Tempestade Estelar Elétrica
export const BANNER_TEMPESTADE_ESTELAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="banner_tempestade_estelar-bg" cx="50%" cy="50%" r="75%"><stop offset="0%" stop-color="#3730a3"/><stop offset="60%" stop-color="#1e1b4b"/><stop offset="100%" stop-color="#020205"/></radialGradient>
    <linearGradient id="banner_tempestade_estelar-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#a855f7" stop-opacity="0.8"/><stop offset="100%" stop-color="#3730a3" stop-opacity="0.2"/></linearGradient>
  </defs>
  <style>
    @plasmaArc { 0%, 100% { transform: translateY(0) scale(1); opacity: 0.75; } 50% { transform: translateY(-20px) scale(1.08); opacity: 1; } }
    @flashLightning { 0%, 100% { transform: rotate(0deg); opacity: 0.6; } 50% { transform: rotate(180deg); opacity: 0.95; } }
    .elem-1 { animation: plasmaArc 5s ease-in-out infinite; transform-origin: center; }
    .elem-2 { animation: flashLightning 18s linear infinite; transform-origin: 900px 200px; }
    .pulse-star { animation: plasmaArc 3s ease-in-out infinite; }
  </style>
  <rect width="1200" height="400" fill="url(#banner_tempestade_estelar-bg)"/>
  <circle cx="900" cy="200" r="140" class="elem-2" stroke="#a855f7" stroke-width="2" stroke-dasharray="16 12" fill="none" opacity="0.6"/>
  <circle cx="900" cy="200" r="90" class="elem-2" stroke="#a855f7" stroke-width="1.5" stroke-dasharray="8 6" fill="none" opacity="0.4"/>
  <g class="elem-1">
    <path d="M150,280 Q300,160 450,260 T750,220 L750,380 L150,380 Z" fill="url(#banner_tempestade_estelar-grad)" opacity="0.5"/>
    <polygon points="600,120 640,190 560,190" fill="#a855f7" opacity="0.85" filter="drop-shadow(0 0 14px #a855f7)"/>
    <circle cx="600" cy="100" r="6" fill="#ffffff" filter="drop-shadow(0 0 8px #a855f7)"/>
  </g>
  <g fill="#ffffff" class="pulse-star" opacity="0.7">
    <circle cx="180" cy="90" r="2"/><circle cx="380" cy="60" r="2.5"/><circle cx="720" cy="80" r="1.8"/><circle cx="1080" cy="120" r="2.2"/><circle cx="1140" cy="260" r="2"/>
  </g>
</svg>`;

// Altar das Runas Vivas
export const BANNER_RUNAS_VIVAS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="banner_runas_vivas-bg" cx="50%" cy="50%" r="75%"><stop offset="0%" stop-color="#115e59"/><stop offset="60%" stop-color="#042f2e"/><stop offset="100%" stop-color="#020205"/></radialGradient>
    <linearGradient id="banner_runas_vivas-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#2dd4bf" stop-opacity="0.8"/><stop offset="100%" stop-color="#115e59" stop-opacity="0.2"/></linearGradient>
  </defs>
  <style>
    @glyphGlow { 0%, 100% { transform: translateY(0) scale(1); opacity: 0.75; } 50% { transform: translateY(-20px) scale(1.08); opacity: 1; } }
    @runeHover { 0%, 100% { transform: rotate(0deg); opacity: 0.6; } 50% { transform: rotate(180deg); opacity: 0.95; } }
    .elem-1 { animation: glyphGlow 5s ease-in-out infinite; transform-origin: center; }
    .elem-2 { animation: runeHover 18s linear infinite; transform-origin: 900px 200px; }
    .pulse-star { animation: glyphGlow 3s ease-in-out infinite; }
  </style>
  <rect width="1200" height="400" fill="url(#banner_runas_vivas-bg)"/>
  <circle cx="900" cy="200" r="140" class="elem-2" stroke="#2dd4bf" stroke-width="2" stroke-dasharray="16 12" fill="none" opacity="0.6"/>
  <circle cx="900" cy="200" r="90" class="elem-2" stroke="#2dd4bf" stroke-width="1.5" stroke-dasharray="8 6" fill="none" opacity="0.4"/>
  <g class="elem-1">
    <path d="M150,280 Q300,160 450,260 T750,220 L750,380 L150,380 Z" fill="url(#banner_runas_vivas-grad)" opacity="0.5"/>
    <polygon points="600,120 640,190 560,190" fill="#2dd4bf" opacity="0.85" filter="drop-shadow(0 0 14px #2dd4bf)"/>
    <circle cx="600" cy="100" r="6" fill="#ffffff" filter="drop-shadow(0 0 8px #2dd4bf)"/>
  </g>
  <g fill="#ffffff" class="pulse-star" opacity="0.7">
    <circle cx="180" cy="90" r="2"/><circle cx="380" cy="60" r="2.5"/><circle cx="720" cy="80" r="1.8"/><circle cx="1080" cy="120" r="2.2"/><circle cx="1140" cy="260" r="2"/>
  </g>
</svg>`;

// Oceano Celestial de Netuno
export const BANNER_OCEANO_CELESTIAL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="banner_oceano_celestial-bg" cx="50%" cy="50%" r="75%"><stop offset="0%" stop-color="#075985"/><stop offset="60%" stop-color="#030712"/><stop offset="100%" stop-color="#020205"/></radialGradient>
    <linearGradient id="banner_oceano_celestial-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#38bdf8" stop-opacity="0.8"/><stop offset="100%" stop-color="#075985" stop-opacity="0.2"/></linearGradient>
  </defs>
  <style>
    @waveMotion { 0%, 100% { transform: translateY(0) scale(1); opacity: 0.75; } 50% { transform: translateY(-20px) scale(1.08); opacity: 1; } }
    @whaleDrift { 0%, 100% { transform: rotate(0deg); opacity: 0.6; } 50% { transform: rotate(180deg); opacity: 0.95; } }
    .elem-1 { animation: waveMotion 5s ease-in-out infinite; transform-origin: center; }
    .elem-2 { animation: whaleDrift 18s linear infinite; transform-origin: 900px 200px; }
    .pulse-star { animation: waveMotion 3s ease-in-out infinite; }
  </style>
  <rect width="1200" height="400" fill="url(#banner_oceano_celestial-bg)"/>
  <circle cx="900" cy="200" r="140" class="elem-2" stroke="#38bdf8" stroke-width="2" stroke-dasharray="16 12" fill="none" opacity="0.6"/>
  <circle cx="900" cy="200" r="90" class="elem-2" stroke="#38bdf8" stroke-width="1.5" stroke-dasharray="8 6" fill="none" opacity="0.4"/>
  <g class="elem-1">
    <path d="M150,280 Q300,160 450,260 T750,220 L750,380 L150,380 Z" fill="url(#banner_oceano_celestial-grad)" opacity="0.5"/>
    <polygon points="600,120 640,190 560,190" fill="#38bdf8" opacity="0.85" filter="drop-shadow(0 0 14px #38bdf8)"/>
    <circle cx="600" cy="100" r="6" fill="#ffffff" filter="drop-shadow(0 0 8px #38bdf8)"/>
  </g>
  <g fill="#ffffff" class="pulse-star" opacity="0.7">
    <circle cx="180" cy="90" r="2"/><circle cx="380" cy="60" r="2.5"/><circle cx="720" cy="80" r="1.8"/><circle cx="1080" cy="120" r="2.2"/><circle cx="1140" cy="260" r="2"/>
  </g>
</svg>`;

// Observatório Astronômico Ancestral
export const BANNER_TEMPLO_ASTRONOMICO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="banner_templo_astronomico-bg" cx="50%" cy="50%" r="75%"><stop offset="0%" stop-color="#1e293b"/><stop offset="60%" stop-color="#0f172a"/><stop offset="100%" stop-color="#020205"/></radialGradient>
    <linearGradient id="banner_templo_astronomico-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#64748b" stop-opacity="0.8"/><stop offset="100%" stop-color="#1e293b" stop-opacity="0.2"/></linearGradient>
  </defs>
  <style>
    @lensRotate { 0%, 100% { transform: translateY(0) scale(1); opacity: 0.75; } 50% { transform: translateY(-20px) scale(1.08); opacity: 1; } }
    @beamSearch { 0%, 100% { transform: rotate(0deg); opacity: 0.6; } 50% { transform: rotate(180deg); opacity: 0.95; } }
    .elem-1 { animation: lensRotate 5s ease-in-out infinite; transform-origin: center; }
    .elem-2 { animation: beamSearch 18s linear infinite; transform-origin: 900px 200px; }
    .pulse-star { animation: lensRotate 3s ease-in-out infinite; }
  </style>
  <rect width="1200" height="400" fill="url(#banner_templo_astronomico-bg)"/>
  <circle cx="900" cy="200" r="140" class="elem-2" stroke="#64748b" stroke-width="2" stroke-dasharray="16 12" fill="none" opacity="0.6"/>
  <circle cx="900" cy="200" r="90" class="elem-2" stroke="#64748b" stroke-width="1.5" stroke-dasharray="8 6" fill="none" opacity="0.4"/>
  <g class="elem-1">
    <path d="M150,280 Q300,160 450,260 T750,220 L750,380 L150,380 Z" fill="url(#banner_templo_astronomico-grad)" opacity="0.5"/>
    <polygon points="600,120 640,190 560,190" fill="#64748b" opacity="0.85" filter="drop-shadow(0 0 14px #64748b)"/>
    <circle cx="600" cy="100" r="6" fill="#ffffff" filter="drop-shadow(0 0 8px #64748b)"/>
  </g>
  <g fill="#ffffff" class="pulse-star" opacity="0.7">
    <circle cx="180" cy="90" r="2"/><circle cx="380" cy="60" r="2.5"/><circle cx="720" cy="80" r="1.8"/><circle cx="1080" cy="120" r="2.2"/><circle cx="1140" cy="260" r="2"/>
  </g>
</svg>`;

// Buraco Negro Gargântua
export const BANNER_BURACO_NEGRO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="banner_buraco_negro-bg" cx="50%" cy="50%" r="75%"><stop offset="0%" stop-color="#18181b"/><stop offset="60%" stop-color="#000000"/><stop offset="100%" stop-color="#020205"/></radialGradient>
    <linearGradient id="banner_buraco_negro-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#f97316" stop-opacity="0.8"/><stop offset="100%" stop-color="#18181b" stop-opacity="0.2"/></linearGradient>
  </defs>
  <style>
    @accretionSpin { 0%, 100% { transform: translateY(0) scale(1); opacity: 0.75; } 50% { transform: translateY(-20px) scale(1.08); opacity: 1; } }
    @gravLens { 0%, 100% { transform: rotate(0deg); opacity: 0.6; } 50% { transform: rotate(180deg); opacity: 0.95; } }
    .elem-1 { animation: accretionSpin 5s ease-in-out infinite; transform-origin: center; }
    .elem-2 { animation: gravLens 18s linear infinite; transform-origin: 900px 200px; }
    .pulse-star { animation: accretionSpin 3s ease-in-out infinite; }
  </style>
  <rect width="1200" height="400" fill="url(#banner_buraco_negro-bg)"/>
  <circle cx="900" cy="200" r="140" class="elem-2" stroke="#f97316" stroke-width="2" stroke-dasharray="16 12" fill="none" opacity="0.6"/>
  <circle cx="900" cy="200" r="90" class="elem-2" stroke="#f97316" stroke-width="1.5" stroke-dasharray="8 6" fill="none" opacity="0.4"/>
  <g class="elem-1">
    <path d="M150,280 Q300,160 450,260 T750,220 L750,380 L150,380 Z" fill="url(#banner_buraco_negro-grad)" opacity="0.5"/>
    <polygon points="600,120 640,190 560,190" fill="#f97316" opacity="0.85" filter="drop-shadow(0 0 14px #f97316)"/>
    <circle cx="600" cy="100" r="6" fill="#ffffff" filter="drop-shadow(0 0 8px #f97316)"/>
  </g>
  <g fill="#ffffff" class="pulse-star" opacity="0.7">
    <circle cx="180" cy="90" r="2"/><circle cx="380" cy="60" r="2.5"/><circle cx="720" cy="80" r="1.8"/><circle cx="1080" cy="120" r="2.2"/><circle cx="1140" cy="260" r="2"/>
  </g>
</svg>`;

// Floresta de Cristais Astrais
export const BANNER_FLORESTA_CRISTAL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="banner_floresta_cristal-bg" cx="50%" cy="50%" r="75%"><stop offset="0%" stop-color="#0369a1"/><stop offset="60%" stop-color="#082f49"/><stop offset="100%" stop-color="#020205"/></radialGradient>
    <linearGradient id="banner_floresta_cristal-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#7dd3fc" stop-opacity="0.8"/><stop offset="100%" stop-color="#0369a1" stop-opacity="0.2"/></linearGradient>
  </defs>
  <style>
    @crystalRefract { 0%, 100% { transform: translateY(0) scale(1); opacity: 0.75; } 50% { transform: translateY(-20px) scale(1.08); opacity: 1; } }
    @sporeFloat { 0%, 100% { transform: rotate(0deg); opacity: 0.6; } 50% { transform: rotate(180deg); opacity: 0.95; } }
    .elem-1 { animation: crystalRefract 5s ease-in-out infinite; transform-origin: center; }
    .elem-2 { animation: sporeFloat 18s linear infinite; transform-origin: 900px 200px; }
    .pulse-star { animation: crystalRefract 3s ease-in-out infinite; }
  </style>
  <rect width="1200" height="400" fill="url(#banner_floresta_cristal-bg)"/>
  <circle cx="900" cy="200" r="140" class="elem-2" stroke="#7dd3fc" stroke-width="2" stroke-dasharray="16 12" fill="none" opacity="0.6"/>
  <circle cx="900" cy="200" r="90" class="elem-2" stroke="#7dd3fc" stroke-width="1.5" stroke-dasharray="8 6" fill="none" opacity="0.4"/>
  <g class="elem-1">
    <path d="M150,280 Q300,160 450,260 T750,220 L750,380 L150,380 Z" fill="url(#banner_floresta_cristal-grad)" opacity="0.5"/>
    <polygon points="600,120 640,190 560,190" fill="#7dd3fc" opacity="0.85" filter="drop-shadow(0 0 14px #7dd3fc)"/>
    <circle cx="600" cy="100" r="6" fill="#ffffff" filter="drop-shadow(0 0 8px #7dd3fc)"/>
  </g>
  <g fill="#ffffff" class="pulse-star" opacity="0.7">
    <circle cx="180" cy="90" r="2"/><circle cx="380" cy="60" r="2.5"/><circle cx="720" cy="80" r="1.8"/><circle cx="1080" cy="120" r="2.2"/><circle cx="1140" cy="260" r="2"/>
  </g>
</svg>`;

// Metrópole Cyberpunk Neon
export const BANNER_CIDADE_CYBERPUNK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="banner_cidade_cyberpunk-bg" cx="50%" cy="50%" r="75%"><stop offset="0%" stop-color="#1e1b4b"/><stop offset="60%" stop-color="#050505"/><stop offset="100%" stop-color="#020205"/></radialGradient>
    <linearGradient id="banner_cidade_cyberpunk-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#f43f5e" stop-opacity="0.8"/><stop offset="100%" stop-color="#1e1b4b" stop-opacity="0.2"/></linearGradient>
  </defs>
  <style>
    @neonBlink { 0%, 100% { transform: translateY(0) scale(1); opacity: 0.75; } 50% { transform: translateY(-20px) scale(1.08); opacity: 1; } }
    @trafficFly { 0%, 100% { transform: rotate(0deg); opacity: 0.6; } 50% { transform: rotate(180deg); opacity: 0.95; } }
    .elem-1 { animation: neonBlink 5s ease-in-out infinite; transform-origin: center; }
    .elem-2 { animation: trafficFly 18s linear infinite; transform-origin: 900px 200px; }
    .pulse-star { animation: neonBlink 3s ease-in-out infinite; }
  </style>
  <rect width="1200" height="400" fill="url(#banner_cidade_cyberpunk-bg)"/>
  <circle cx="900" cy="200" r="140" class="elem-2" stroke="#f43f5e" stroke-width="2" stroke-dasharray="16 12" fill="none" opacity="0.6"/>
  <circle cx="900" cy="200" r="90" class="elem-2" stroke="#f43f5e" stroke-width="1.5" stroke-dasharray="8 6" fill="none" opacity="0.4"/>
  <g class="elem-1">
    <path d="M150,280 Q300,160 450,260 T750,220 L750,380 L150,380 Z" fill="url(#banner_cidade_cyberpunk-grad)" opacity="0.5"/>
    <polygon points="600,120 640,190 560,190" fill="#f43f5e" opacity="0.85" filter="drop-shadow(0 0 14px #f43f5e)"/>
    <circle cx="600" cy="100" r="6" fill="#ffffff" filter="drop-shadow(0 0 8px #f43f5e)"/>
  </g>
  <g fill="#ffffff" class="pulse-star" opacity="0.7">
    <circle cx="180" cy="90" r="2"/><circle cx="380" cy="60" r="2.5"/><circle cx="720" cy="80" r="1.8"/><circle cx="1080" cy="120" r="2.2"/><circle cx="1140" cy="260" r="2"/>
  </g>
</svg>`;

// Voo da Fênix Celestial
export const BANNER_FENIX_ASCENDENTE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="banner_fenix_ascendente-bg" cx="50%" cy="50%" r="75%"><stop offset="0%" stop-color="#c2410c"/><stop offset="60%" stop-color="#450a0a"/><stop offset="100%" stop-color="#020205"/></radialGradient>
    <linearGradient id="banner_fenix_ascendente-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#fbbf24" stop-opacity="0.8"/><stop offset="100%" stop-color="#c2410c" stop-opacity="0.2"/></linearGradient>
  </defs>
  <style>
    @wingBeat { 0%, 100% { transform: translateY(0) scale(1); opacity: 0.75; } 50% { transform: translateY(-20px) scale(1.08); opacity: 1; } }
    @flameTrail { 0%, 100% { transform: rotate(0deg); opacity: 0.6; } 50% { transform: rotate(180deg); opacity: 0.95; } }
    .elem-1 { animation: wingBeat 5s ease-in-out infinite; transform-origin: center; }
    .elem-2 { animation: flameTrail 18s linear infinite; transform-origin: 900px 200px; }
    .pulse-star { animation: wingBeat 3s ease-in-out infinite; }
  </style>
  <rect width="1200" height="400" fill="url(#banner_fenix_ascendente-bg)"/>
  <circle cx="900" cy="200" r="140" class="elem-2" stroke="#fbbf24" stroke-width="2" stroke-dasharray="16 12" fill="none" opacity="0.6"/>
  <circle cx="900" cy="200" r="90" class="elem-2" stroke="#fbbf24" stroke-width="1.5" stroke-dasharray="8 6" fill="none" opacity="0.4"/>
  <g class="elem-1">
    <path d="M150,280 Q300,160 450,260 T750,220 L750,380 L150,380 Z" fill="url(#banner_fenix_ascendente-grad)" opacity="0.5"/>
    <polygon points="600,120 640,190 560,190" fill="#fbbf24" opacity="0.85" filter="drop-shadow(0 0 14px #fbbf24)"/>
    <circle cx="600" cy="100" r="6" fill="#ffffff" filter="drop-shadow(0 0 8px #fbbf24)"/>
  </g>
  <g fill="#ffffff" class="pulse-star" opacity="0.7">
    <circle cx="180" cy="90" r="2"/><circle cx="380" cy="60" r="2.5"/><circle cx="720" cy="80" r="1.8"/><circle cx="1080" cy="120" r="2.2"/><circle cx="1140" cy="260" r="2"/>
  </g>
</svg>`;

// Mar de Estrelas Infinito
export const BANNER_MAR_DE_ESTRELAS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="banner_mar_de_estrelas-bg" cx="50%" cy="50%" r="75%"><stop offset="0%" stop-color="#0c4a6e"/><stop offset="60%" stop-color="#020617"/><stop offset="100%" stop-color="#020205"/></radialGradient>
    <linearGradient id="banner_mar_de_estrelas-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#38bdf8" stop-opacity="0.8"/><stop offset="100%" stop-color="#0c4a6e" stop-opacity="0.2"/></linearGradient>
  </defs>
  <style>
    @seaUndulate { 0%, 100% { transform: translateY(0) scale(1); opacity: 0.75; } 50% { transform: translateY(-20px) scale(1.08); opacity: 1; } }
    @reflectionBreathe { 0%, 100% { transform: rotate(0deg); opacity: 0.6; } 50% { transform: rotate(180deg); opacity: 0.95; } }
    .elem-1 { animation: seaUndulate 5s ease-in-out infinite; transform-origin: center; }
    .elem-2 { animation: reflectionBreathe 18s linear infinite; transform-origin: 900px 200px; }
    .pulse-star { animation: seaUndulate 3s ease-in-out infinite; }
  </style>
  <rect width="1200" height="400" fill="url(#banner_mar_de_estrelas-bg)"/>
  <circle cx="900" cy="200" r="140" class="elem-2" stroke="#38bdf8" stroke-width="2" stroke-dasharray="16 12" fill="none" opacity="0.6"/>
  <circle cx="900" cy="200" r="90" class="elem-2" stroke="#38bdf8" stroke-width="1.5" stroke-dasharray="8 6" fill="none" opacity="0.4"/>
  <g class="elem-1">
    <path d="M150,280 Q300,160 450,260 T750,220 L750,380 L150,380 Z" fill="url(#banner_mar_de_estrelas-grad)" opacity="0.5"/>
    <polygon points="600,120 640,190 560,190" fill="#38bdf8" opacity="0.85" filter="drop-shadow(0 0 14px #38bdf8)"/>
    <circle cx="600" cy="100" r="6" fill="#ffffff" filter="drop-shadow(0 0 8px #38bdf8)"/>
  </g>
  <g fill="#ffffff" class="pulse-star" opacity="0.7">
    <circle cx="180" cy="90" r="2"/><circle cx="380" cy="60" r="2.5"/><circle cx="720" cy="80" r="1.8"/><circle cx="1080" cy="120" r="2.2"/><circle cx="1140" cy="260" r="2"/>
  </g>
</svg>`;

// Vale dos Cometas Glaciais
export const BANNER_CACADOR_COMETAS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="banner_cacador_cometas-bg" cx="50%" cy="50%" r="75%"><stop offset="0%" stop-color="#0284c7"/><stop offset="60%" stop-color="#082f49"/><stop offset="100%" stop-color="#020205"/></radialGradient>
    <linearGradient id="banner_cacador_cometas-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#e0f2fe" stop-opacity="0.8"/><stop offset="100%" stop-color="#0284c7" stop-opacity="0.2"/></linearGradient>
  </defs>
  <style>
    @cometStreak { 0%, 100% { transform: translateY(0) scale(1); opacity: 0.75; } 50% { transform: translateY(-20px) scale(1.08); opacity: 1; } }
    @frostGlimmer { 0%, 100% { transform: rotate(0deg); opacity: 0.6; } 50% { transform: rotate(180deg); opacity: 0.95; } }
    .elem-1 { animation: cometStreak 5s ease-in-out infinite; transform-origin: center; }
    .elem-2 { animation: frostGlimmer 18s linear infinite; transform-origin: 900px 200px; }
    .pulse-star { animation: cometStreak 3s ease-in-out infinite; }
  </style>
  <rect width="1200" height="400" fill="url(#banner_cacador_cometas-bg)"/>
  <circle cx="900" cy="200" r="140" class="elem-2" stroke="#e0f2fe" stroke-width="2" stroke-dasharray="16 12" fill="none" opacity="0.6"/>
  <circle cx="900" cy="200" r="90" class="elem-2" stroke="#e0f2fe" stroke-width="1.5" stroke-dasharray="8 6" fill="none" opacity="0.4"/>
  <g class="elem-1">
    <path d="M150,280 Q300,160 450,260 T750,220 L750,380 L150,380 Z" fill="url(#banner_cacador_cometas-grad)" opacity="0.5"/>
    <polygon points="600,120 640,190 560,190" fill="#e0f2fe" opacity="0.85" filter="drop-shadow(0 0 14px #e0f2fe)"/>
    <circle cx="600" cy="100" r="6" fill="#ffffff" filter="drop-shadow(0 0 8px #e0f2fe)"/>
  </g>
  <g fill="#ffffff" class="pulse-star" opacity="0.7">
    <circle cx="180" cy="90" r="2"/><circle cx="380" cy="60" r="2.5"/><circle cx="720" cy="80" r="1.8"/><circle cx="1080" cy="120" r="2.2"/><circle cx="1140" cy="260" r="2"/>
  </g>
</svg>`;

// Labirinto dos Espelhos Dimensionais
export const BANNER_LABIRINTO_ESPELHO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="banner_labirinto_espelho-bg" cx="50%" cy="50%" r="75%"><stop offset="0%" stop-color="#3f3f46"/><stop offset="60%" stop-color="#18181b"/><stop offset="100%" stop-color="#020205"/></radialGradient>
    <linearGradient id="banner_labirinto_espelho-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#a1a1aa" stop-opacity="0.8"/><stop offset="100%" stop-color="#3f3f46" stop-opacity="0.2"/></linearGradient>
  </defs>
  <style>
    @mirrorShift { 0%, 100% { transform: translateY(0) scale(1); opacity: 0.75; } 50% { transform: translateY(-20px) scale(1.08); opacity: 1; } }
    @prismFlash { 0%, 100% { transform: rotate(0deg); opacity: 0.6; } 50% { transform: rotate(180deg); opacity: 0.95; } }
    .elem-1 { animation: mirrorShift 5s ease-in-out infinite; transform-origin: center; }
    .elem-2 { animation: prismFlash 18s linear infinite; transform-origin: 900px 200px; }
    .pulse-star { animation: mirrorShift 3s ease-in-out infinite; }
  </style>
  <rect width="1200" height="400" fill="url(#banner_labirinto_espelho-bg)"/>
  <circle cx="900" cy="200" r="140" class="elem-2" stroke="#a1a1aa" stroke-width="2" stroke-dasharray="16 12" fill="none" opacity="0.6"/>
  <circle cx="900" cy="200" r="90" class="elem-2" stroke="#a1a1aa" stroke-width="1.5" stroke-dasharray="8 6" fill="none" opacity="0.4"/>
  <g class="elem-1">
    <path d="M150,280 Q300,160 450,260 T750,220 L750,380 L150,380 Z" fill="url(#banner_labirinto_espelho-grad)" opacity="0.5"/>
    <polygon points="600,120 640,190 560,190" fill="#a1a1aa" opacity="0.85" filter="drop-shadow(0 0 14px #a1a1aa)"/>
    <circle cx="600" cy="100" r="6" fill="#ffffff" filter="drop-shadow(0 0 8px #a1a1aa)"/>
  </g>
  <g fill="#ffffff" class="pulse-star" opacity="0.7">
    <circle cx="180" cy="90" r="2"/><circle cx="380" cy="60" r="2.5"/><circle cx="720" cy="80" r="1.8"/><circle cx="1080" cy="120" r="2.2"/><circle cx="1140" cy="260" r="2"/>
  </g>
</svg>`;

// Castelo Gótico Sob a Lua Vermelha
export const BANNER_CASTELO_GOTICO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="banner_castelo_gotico-bg" cx="50%" cy="50%" r="75%"><stop offset="0%" stop-color="#7f1d1d"/><stop offset="60%" stop-color="#1c1917"/><stop offset="100%" stop-color="#020205"/></radialGradient>
    <linearGradient id="banner_castelo_gotico-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#dc2626" stop-opacity="0.8"/><stop offset="100%" stop-color="#7f1d1d" stop-opacity="0.2"/></linearGradient>
  </defs>
  <style>
    @batFlight { 0%, 100% { transform: translateY(0) scale(1); opacity: 0.75; } 50% { transform: translateY(-20px) scale(1.08); opacity: 1; } }
    @bloodMoonPulse { 0%, 100% { transform: rotate(0deg); opacity: 0.6; } 50% { transform: rotate(180deg); opacity: 0.95; } }
    .elem-1 { animation: batFlight 5s ease-in-out infinite; transform-origin: center; }
    .elem-2 { animation: bloodMoonPulse 18s linear infinite; transform-origin: 900px 200px; }
    .pulse-star { animation: batFlight 3s ease-in-out infinite; }
  </style>
  <rect width="1200" height="400" fill="url(#banner_castelo_gotico-bg)"/>
  <circle cx="900" cy="200" r="140" class="elem-2" stroke="#dc2626" stroke-width="2" stroke-dasharray="16 12" fill="none" opacity="0.6"/>
  <circle cx="900" cy="200" r="90" class="elem-2" stroke="#dc2626" stroke-width="1.5" stroke-dasharray="8 6" fill="none" opacity="0.4"/>
  <g class="elem-1">
    <path d="M150,280 Q300,160 450,260 T750,220 L750,380 L150,380 Z" fill="url(#banner_castelo_gotico-grad)" opacity="0.5"/>
    <polygon points="600,120 640,190 560,190" fill="#dc2626" opacity="0.85" filter="drop-shadow(0 0 14px #dc2626)"/>
    <circle cx="600" cy="100" r="6" fill="#ffffff" filter="drop-shadow(0 0 8px #dc2626)"/>
  </g>
  <g fill="#ffffff" class="pulse-star" opacity="0.7">
    <circle cx="180" cy="90" r="2"/><circle cx="380" cy="60" r="2.5"/><circle cx="720" cy="80" r="1.8"/><circle cx="1080" cy="120" r="2.2"/><circle cx="1140" cy="260" r="2"/>
  </g>
</svg>`;

// Travessia dos Anéis Planetários
export const BANNER_ANEIS_SATURNO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="banner_aneis_saturno-bg" cx="50%" cy="50%" r="75%"><stop offset="0%" stop-color="#78350f"/><stop offset="60%" stop-color="#1c1917"/><stop offset="100%" stop-color="#020205"/></radialGradient>
    <linearGradient id="banner_aneis_saturno-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#fde68a" stop-opacity="0.8"/><stop offset="100%" stop-color="#78350f" stop-opacity="0.2"/></linearGradient>
  </defs>
  <style>
    @ringRotate { 0%, 100% { transform: translateY(0) scale(1); opacity: 0.75; } 50% { transform: translateY(-20px) scale(1.08); opacity: 1; } }
    @rockTumble { 0%, 100% { transform: rotate(0deg); opacity: 0.6; } 50% { transform: rotate(180deg); opacity: 0.95; } }
    .elem-1 { animation: ringRotate 5s ease-in-out infinite; transform-origin: center; }
    .elem-2 { animation: rockTumble 18s linear infinite; transform-origin: 900px 200px; }
    .pulse-star { animation: ringRotate 3s ease-in-out infinite; }
  </style>
  <rect width="1200" height="400" fill="url(#banner_aneis_saturno-bg)"/>
  <circle cx="900" cy="200" r="140" class="elem-2" stroke="#fde68a" stroke-width="2" stroke-dasharray="16 12" fill="none" opacity="0.6"/>
  <circle cx="900" cy="200" r="90" class="elem-2" stroke="#fde68a" stroke-width="1.5" stroke-dasharray="8 6" fill="none" opacity="0.4"/>
  <g class="elem-1">
    <path d="M150,280 Q300,160 450,260 T750,220 L750,380 L150,380 Z" fill="url(#banner_aneis_saturno-grad)" opacity="0.5"/>
    <polygon points="600,120 640,190 560,190" fill="#fde68a" opacity="0.85" filter="drop-shadow(0 0 14px #fde68a)"/>
    <circle cx="600" cy="100" r="6" fill="#ffffff" filter="drop-shadow(0 0 8px #fde68a)"/>
  </g>
  <g fill="#ffffff" class="pulse-star" opacity="0.7">
    <circle cx="180" cy="90" r="2"/><circle cx="380" cy="60" r="2.5"/><circle cx="720" cy="80" r="1.8"/><circle cx="1080" cy="120" r="2.2"/><circle cx="1140" cy="260" r="2"/>
  </g>
</svg>`;

// Ponte do Arco-Íris Astral
export const BANNER_PONTE_BIFROST_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="banner_ponte_bifrost-bg" cx="50%" cy="50%" r="75%"><stop offset="0%" stop-color="#312e81"/><stop offset="60%" stop-color="#09090b"/><stop offset="100%" stop-color="#020205"/></radialGradient>
    <linearGradient id="banner_ponte_bifrost-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#ec4899" stop-opacity="0.8"/><stop offset="100%" stop-color="#312e81" stop-opacity="0.2"/></linearGradient>
  </defs>
  <style>
    @rainbowStream { 0%, 100% { transform: translateY(0) scale(1); opacity: 0.75; } 50% { transform: translateY(-20px) scale(1.08); opacity: 1; } }
    @auroraFlow { 0%, 100% { transform: rotate(0deg); opacity: 0.6; } 50% { transform: rotate(180deg); opacity: 0.95; } }
    .elem-1 { animation: rainbowStream 5s ease-in-out infinite; transform-origin: center; }
    .elem-2 { animation: auroraFlow 18s linear infinite; transform-origin: 900px 200px; }
    .pulse-star { animation: rainbowStream 3s ease-in-out infinite; }
  </style>
  <rect width="1200" height="400" fill="url(#banner_ponte_bifrost-bg)"/>
  <circle cx="900" cy="200" r="140" class="elem-2" stroke="#ec4899" stroke-width="2" stroke-dasharray="16 12" fill="none" opacity="0.6"/>
  <circle cx="900" cy="200" r="90" class="elem-2" stroke="#ec4899" stroke-width="1.5" stroke-dasharray="8 6" fill="none" opacity="0.4"/>
  <g class="elem-1">
    <path d="M150,280 Q300,160 450,260 T750,220 L750,380 L150,380 Z" fill="url(#banner_ponte_bifrost-grad)" opacity="0.5"/>
    <polygon points="600,120 640,190 560,190" fill="#ec4899" opacity="0.85" filter="drop-shadow(0 0 14px #ec4899)"/>
    <circle cx="600" cy="100" r="6" fill="#ffffff" filter="drop-shadow(0 0 8px #ec4899)"/>
  </g>
  <g fill="#ffffff" class="pulse-star" opacity="0.7">
    <circle cx="180" cy="90" r="2"/><circle cx="380" cy="60" r="2.5"/><circle cx="720" cy="80" r="1.8"/><circle cx="1080" cy="120" r="2.2"/><circle cx="1140" cy="260" r="2"/>
  </g>
</svg>`;

// Covil do Dragão Estelar
export const BANNER_DRAGAO_CELESTE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="banner_dragao_celeste-bg" cx="50%" cy="50%" r="75%"><stop offset="0%" stop-color="#1e40af"/><stop offset="60%" stop-color="#172554"/><stop offset="100%" stop-color="#020205"/></radialGradient>
    <linearGradient id="banner_dragao_celeste-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#60a5fa" stop-opacity="0.8"/><stop offset="100%" stop-color="#1e40af" stop-opacity="0.2"/></linearGradient>
  </defs>
  <style>
    @dragonBreath { 0%, 100% { transform: translateY(0) scale(1); opacity: 0.75; } 50% { transform: translateY(-20px) scale(1.08); opacity: 1; } }
    @scaleShimmer { 0%, 100% { transform: rotate(0deg); opacity: 0.6; } 50% { transform: rotate(180deg); opacity: 0.95; } }
    .elem-1 { animation: dragonBreath 5s ease-in-out infinite; transform-origin: center; }
    .elem-2 { animation: scaleShimmer 18s linear infinite; transform-origin: 900px 200px; }
    .pulse-star { animation: dragonBreath 3s ease-in-out infinite; }
  </style>
  <rect width="1200" height="400" fill="url(#banner_dragao_celeste-bg)"/>
  <circle cx="900" cy="200" r="140" class="elem-2" stroke="#60a5fa" stroke-width="2" stroke-dasharray="16 12" fill="none" opacity="0.6"/>
  <circle cx="900" cy="200" r="90" class="elem-2" stroke="#60a5fa" stroke-width="1.5" stroke-dasharray="8 6" fill="none" opacity="0.4"/>
  <g class="elem-1">
    <path d="M150,280 Q300,160 450,260 T750,220 L750,380 L150,380 Z" fill="url(#banner_dragao_celeste-grad)" opacity="0.5"/>
    <polygon points="600,120 640,190 560,190" fill="#60a5fa" opacity="0.85" filter="drop-shadow(0 0 14px #60a5fa)"/>
    <circle cx="600" cy="100" r="6" fill="#ffffff" filter="drop-shadow(0 0 8px #60a5fa)"/>
  </g>
  <g fill="#ffffff" class="pulse-star" opacity="0.7">
    <circle cx="180" cy="90" r="2"/><circle cx="380" cy="60" r="2.5"/><circle cx="720" cy="80" r="1.8"/><circle cx="1080" cy="120" r="2.2"/><circle cx="1140" cy="260" r="2"/>
  </g>
</svg>`;

// Arquipélago Flutuante do Éter
export const BANNER_ILHA_FLUTUANTE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="banner_ilha_flutuante-bg" cx="50%" cy="50%" r="75%"><stop offset="0%" stop-color="#0f766e"/><stop offset="60%" stop-color="#042f2e"/><stop offset="100%" stop-color="#020205"/></radialGradient>
    <linearGradient id="banner_ilha_flutuante-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#5eead4" stop-opacity="0.8"/><stop offset="100%" stop-color="#0f766e" stop-opacity="0.2"/></linearGradient>
  </defs>
  <style>
    @islandBob { 0%, 100% { transform: translateY(0) scale(1); opacity: 0.75; } 50% { transform: translateY(-20px) scale(1.08); opacity: 1; } }
    @waterfallCascade { 0%, 100% { transform: rotate(0deg); opacity: 0.6; } 50% { transform: rotate(180deg); opacity: 0.95; } }
    .elem-1 { animation: islandBob 5s ease-in-out infinite; transform-origin: center; }
    .elem-2 { animation: waterfallCascade 18s linear infinite; transform-origin: 900px 200px; }
    .pulse-star { animation: islandBob 3s ease-in-out infinite; }
  </style>
  <rect width="1200" height="400" fill="url(#banner_ilha_flutuante-bg)"/>
  <circle cx="900" cy="200" r="140" class="elem-2" stroke="#5eead4" stroke-width="2" stroke-dasharray="16 12" fill="none" opacity="0.6"/>
  <circle cx="900" cy="200" r="90" class="elem-2" stroke="#5eead4" stroke-width="1.5" stroke-dasharray="8 6" fill="none" opacity="0.4"/>
  <g class="elem-1">
    <path d="M150,280 Q300,160 450,260 T750,220 L750,380 L150,380 Z" fill="url(#banner_ilha_flutuante-grad)" opacity="0.5"/>
    <polygon points="600,120 640,190 560,190" fill="#5eead4" opacity="0.85" filter="drop-shadow(0 0 14px #5eead4)"/>
    <circle cx="600" cy="100" r="6" fill="#ffffff" filter="drop-shadow(0 0 8px #5eead4)"/>
  </g>
  <g fill="#ffffff" class="pulse-star" opacity="0.7">
    <circle cx="180" cy="90" r="2"/><circle cx="380" cy="60" r="2.5"/><circle cx="720" cy="80" r="1.8"/><circle cx="1080" cy="120" r="2.2"/><circle cx="1140" cy="260" r="2"/>
  </g>
</svg>`;

// A Grande Forja Estelar
export const BANNER_FORJA_ESTELAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="banner_forja_estelar-bg" cx="50%" cy="50%" r="75%"><stop offset="0%" stop-color="#9a3412"/><stop offset="60%" stop-color="#431407"/><stop offset="100%" stop-color="#020205"/></radialGradient>
    <linearGradient id="banner_forja_estelar-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#fdba74" stop-opacity="0.8"/><stop offset="100%" stop-color="#9a3412" stop-opacity="0.2"/></linearGradient>
  </defs>
  <style>
    @hammerStrike { 0%, 100% { transform: translateY(0) scale(1); opacity: 0.75; } 50% { transform: translateY(-20px) scale(1.08); opacity: 1; } }
    @sparkShower { 0%, 100% { transform: rotate(0deg); opacity: 0.6; } 50% { transform: rotate(180deg); opacity: 0.95; } }
    .elem-1 { animation: hammerStrike 5s ease-in-out infinite; transform-origin: center; }
    .elem-2 { animation: sparkShower 18s linear infinite; transform-origin: 900px 200px; }
    .pulse-star { animation: hammerStrike 3s ease-in-out infinite; }
  </style>
  <rect width="1200" height="400" fill="url(#banner_forja_estelar-bg)"/>
  <circle cx="900" cy="200" r="140" class="elem-2" stroke="#fdba74" stroke-width="2" stroke-dasharray="16 12" fill="none" opacity="0.6"/>
  <circle cx="900" cy="200" r="90" class="elem-2" stroke="#fdba74" stroke-width="1.5" stroke-dasharray="8 6" fill="none" opacity="0.4"/>
  <g class="elem-1">
    <path d="M150,280 Q300,160 450,260 T750,220 L750,380 L150,380 Z" fill="url(#banner_forja_estelar-grad)" opacity="0.5"/>
    <polygon points="600,120 640,190 560,190" fill="#fdba74" opacity="0.85" filter="drop-shadow(0 0 14px #fdba74)"/>
    <circle cx="600" cy="100" r="6" fill="#ffffff" filter="drop-shadow(0 0 8px #fdba74)"/>
  </g>
  <g fill="#ffffff" class="pulse-star" opacity="0.7">
    <circle cx="180" cy="90" r="2"/><circle cx="380" cy="60" r="2.5"/><circle cx="720" cy="80" r="1.8"/><circle cx="1080" cy="120" r="2.2"/><circle cx="1140" cy="260" r="2"/>
  </g>
</svg>`;

// Fossa Abissal das Criaturas Arcanas
export const BANNER_FUNDO_MARINHO_ABISSAL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="banner_fundo_marinho_abissal-bg" cx="50%" cy="50%" r="75%"><stop offset="0%" stop-color="#0369a1"/><stop offset="60%" stop-color="#030712"/><stop offset="100%" stop-color="#020205"/></radialGradient>
    <linearGradient id="banner_fundo_marinho_abissal-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#06b6d4" stop-opacity="0.8"/><stop offset="100%" stop-color="#0369a1" stop-opacity="0.2"/></linearGradient>
  </defs>
  <style>
    @tentacleSway { 0%, 100% { transform: translateY(0) scale(1); opacity: 0.75; } 50% { transform: translateY(-20px) scale(1.08); opacity: 1; } }
    @biolumPulse { 0%, 100% { transform: rotate(0deg); opacity: 0.6; } 50% { transform: rotate(180deg); opacity: 0.95; } }
    .elem-1 { animation: tentacleSway 5s ease-in-out infinite; transform-origin: center; }
    .elem-2 { animation: biolumPulse 18s linear infinite; transform-origin: 900px 200px; }
    .pulse-star { animation: tentacleSway 3s ease-in-out infinite; }
  </style>
  <rect width="1200" height="400" fill="url(#banner_fundo_marinho_abissal-bg)"/>
  <circle cx="900" cy="200" r="140" class="elem-2" stroke="#06b6d4" stroke-width="2" stroke-dasharray="16 12" fill="none" opacity="0.6"/>
  <circle cx="900" cy="200" r="90" class="elem-2" stroke="#06b6d4" stroke-width="1.5" stroke-dasharray="8 6" fill="none" opacity="0.4"/>
  <g class="elem-1">
    <path d="M150,280 Q300,160 450,260 T750,220 L750,380 L150,380 Z" fill="url(#banner_fundo_marinho_abissal-grad)" opacity="0.5"/>
    <polygon points="600,120 640,190 560,190" fill="#06b6d4" opacity="0.85" filter="drop-shadow(0 0 14px #06b6d4)"/>
    <circle cx="600" cy="100" r="6" fill="#ffffff" filter="drop-shadow(0 0 8px #06b6d4)"/>
  </g>
  <g fill="#ffffff" class="pulse-star" opacity="0.7">
    <circle cx="180" cy="90" r="2"/><circle cx="380" cy="60" r="2.5"/><circle cx="720" cy="80" r="1.8"/><circle cx="1080" cy="120" r="2.2"/><circle cx="1140" cy="260" r="2"/>
  </g>
</svg>`;

// Fluxo de Dados Matrix
export const BANNER_MATRIX_DIGITAL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="banner_matrix_digital-bg" cx="50%" cy="50%" r="75%"><stop offset="0%" stop-color="#14532d"/><stop offset="60%" stop-color="#022c22"/><stop offset="100%" stop-color="#020205"/></radialGradient>
    <linearGradient id="banner_matrix_digital-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#22c55e" stop-opacity="0.8"/><stop offset="100%" stop-color="#14532d" stop-opacity="0.2"/></linearGradient>
  </defs>
  <style>
    @matrixCascade { 0%, 100% { transform: translateY(0) scale(1); opacity: 0.75; } 50% { transform: translateY(-20px) scale(1.08); opacity: 1; } }
    @glitchFlicker { 0%, 100% { transform: rotate(0deg); opacity: 0.6; } 50% { transform: rotate(180deg); opacity: 0.95; } }
    .elem-1 { animation: matrixCascade 5s ease-in-out infinite; transform-origin: center; }
    .elem-2 { animation: glitchFlicker 18s linear infinite; transform-origin: 900px 200px; }
    .pulse-star { animation: matrixCascade 3s ease-in-out infinite; }
  </style>
  <rect width="1200" height="400" fill="url(#banner_matrix_digital-bg)"/>
  <circle cx="900" cy="200" r="140" class="elem-2" stroke="#22c55e" stroke-width="2" stroke-dasharray="16 12" fill="none" opacity="0.6"/>
  <circle cx="900" cy="200" r="90" class="elem-2" stroke="#22c55e" stroke-width="1.5" stroke-dasharray="8 6" fill="none" opacity="0.4"/>
  <g class="elem-1">
    <path d="M150,280 Q300,160 450,260 T750,220 L750,380 L150,380 Z" fill="url(#banner_matrix_digital-grad)" opacity="0.5"/>
    <polygon points="600,120 640,190 560,190" fill="#22c55e" opacity="0.85" filter="drop-shadow(0 0 14px #22c55e)"/>
    <circle cx="600" cy="100" r="6" fill="#ffffff" filter="drop-shadow(0 0 8px #22c55e)"/>
  </g>
  <g fill="#ffffff" class="pulse-star" opacity="0.7">
    <circle cx="180" cy="90" r="2"/><circle cx="380" cy="60" r="2.5"/><circle cx="720" cy="80" r="1.8"/><circle cx="1080" cy="120" r="2.2"/><circle cx="1140" cy="260" r="2"/>
  </g>
</svg>`;

// Bosque de Cerejeiras Sob o Cosmos
export const BANNER_SAKURA_NOTURNA_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="banner_sakura_noturna-bg" cx="50%" cy="50%" r="75%"><stop offset="0%" stop-color="#831843"/><stop offset="60%" stop-color="#1f1325"/><stop offset="100%" stop-color="#020205"/></radialGradient>
    <linearGradient id="banner_sakura_noturna-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#f472b6" stop-opacity="0.8"/><stop offset="100%" stop-color="#831843" stop-opacity="0.2"/></linearGradient>
  </defs>
  <style>
    @petalSwirl { 0%, 100% { transform: translateY(0) scale(1); opacity: 0.75; } 50% { transform: translateY(-20px) scale(1.08); opacity: 1; } }
    @branchSway { 0%, 100% { transform: rotate(0deg); opacity: 0.6; } 50% { transform: rotate(180deg); opacity: 0.95; } }
    .elem-1 { animation: petalSwirl 5s ease-in-out infinite; transform-origin: center; }
    .elem-2 { animation: branchSway 18s linear infinite; transform-origin: 900px 200px; }
    .pulse-star { animation: petalSwirl 3s ease-in-out infinite; }
  </style>
  <rect width="1200" height="400" fill="url(#banner_sakura_noturna-bg)"/>
  <circle cx="900" cy="200" r="140" class="elem-2" stroke="#f472b6" stroke-width="2" stroke-dasharray="16 12" fill="none" opacity="0.6"/>
  <circle cx="900" cy="200" r="90" class="elem-2" stroke="#f472b6" stroke-width="1.5" stroke-dasharray="8 6" fill="none" opacity="0.4"/>
  <g class="elem-1">
    <path d="M150,280 Q300,160 450,260 T750,220 L750,380 L150,380 Z" fill="url(#banner_sakura_noturna-grad)" opacity="0.5"/>
    <polygon points="600,120 640,190 560,190" fill="#f472b6" opacity="0.85" filter="drop-shadow(0 0 14px #f472b6)"/>
    <circle cx="600" cy="100" r="6" fill="#ffffff" filter="drop-shadow(0 0 8px #f472b6)"/>
  </g>
  <g fill="#ffffff" class="pulse-star" opacity="0.7">
    <circle cx="180" cy="90" r="2"/><circle cx="380" cy="60" r="2.5"/><circle cx="720" cy="80" r="1.8"/><circle cx="1080" cy="120" r="2.2"/><circle cx="1140" cy="260" r="2"/>
  </g>
</svg>`;

// Torre do Relógio da Eternidade
export const BANNER_TORRE_RELOGIO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="banner_torre_relogio-bg" cx="50%" cy="50%" r="75%"><stop offset="0%" stop-color="#78350f"/><stop offset="60%" stop-color="#291e0a"/><stop offset="100%" stop-color="#020205"/></radialGradient>
    <linearGradient id="banner_torre_relogio-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#d97706" stop-opacity="0.8"/><stop offset="100%" stop-color="#78350f" stop-opacity="0.2"/></linearGradient>
  </defs>
  <style>
    @clockTick { 0%, 100% { transform: translateY(0) scale(1); opacity: 0.75; } 50% { transform: translateY(-20px) scale(1.08); opacity: 1; } }
    @gearChrono { 0%, 100% { transform: rotate(0deg); opacity: 0.6; } 50% { transform: rotate(180deg); opacity: 0.95; } }
    .elem-1 { animation: clockTick 5s ease-in-out infinite; transform-origin: center; }
    .elem-2 { animation: gearChrono 18s linear infinite; transform-origin: 900px 200px; }
    .pulse-star { animation: clockTick 3s ease-in-out infinite; }
  </style>
  <rect width="1200" height="400" fill="url(#banner_torre_relogio-bg)"/>
  <circle cx="900" cy="200" r="140" class="elem-2" stroke="#d97706" stroke-width="2" stroke-dasharray="16 12" fill="none" opacity="0.6"/>
  <circle cx="900" cy="200" r="90" class="elem-2" stroke="#d97706" stroke-width="1.5" stroke-dasharray="8 6" fill="none" opacity="0.4"/>
  <g class="elem-1">
    <path d="M150,280 Q300,160 450,260 T750,220 L750,380 L150,380 Z" fill="url(#banner_torre_relogio-grad)" opacity="0.5"/>
    <polygon points="600,120 640,190 560,190" fill="#d97706" opacity="0.85" filter="drop-shadow(0 0 14px #d97706)"/>
    <circle cx="600" cy="100" r="6" fill="#ffffff" filter="drop-shadow(0 0 8px #d97706)"/>
  </g>
  <g fill="#ffffff" class="pulse-star" opacity="0.7">
    <circle cx="180" cy="90" r="2"/><circle cx="380" cy="60" r="2.5"/><circle cx="720" cy="80" r="1.8"/><circle cx="1080" cy="120" r="2.2"/><circle cx="1140" cy="260" r="2"/>
  </g>
</svg>`;

// Pradaria dos Vagalumes Astrais
export const BANNER_PRADARIA_ASTRAL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="banner_pradaria_astral-bg" cx="50%" cy="50%" r="75%"><stop offset="0%" stop-color="#064e3b"/><stop offset="60%" stop-color="#022c22"/><stop offset="100%" stop-color="#020205"/></radialGradient>
    <linearGradient id="banner_pradaria_astral-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#6ee7b7" stop-opacity="0.8"/><stop offset="100%" stop-color="#064e3b" stop-opacity="0.2"/></linearGradient>
  </defs>
  <style>
    @fireflyDance { 0%, 100% { transform: translateY(0) scale(1); opacity: 0.75; } 50% { transform: translateY(-20px) scale(1.08); opacity: 1; } }
    @grassWave { 0%, 100% { transform: rotate(0deg); opacity: 0.6; } 50% { transform: rotate(180deg); opacity: 0.95; } }
    .elem-1 { animation: fireflyDance 5s ease-in-out infinite; transform-origin: center; }
    .elem-2 { animation: grassWave 18s linear infinite; transform-origin: 900px 200px; }
    .pulse-star { animation: fireflyDance 3s ease-in-out infinite; }
  </style>
  <rect width="1200" height="400" fill="url(#banner_pradaria_astral-bg)"/>
  <circle cx="900" cy="200" r="140" class="elem-2" stroke="#6ee7b7" stroke-width="2" stroke-dasharray="16 12" fill="none" opacity="0.6"/>
  <circle cx="900" cy="200" r="90" class="elem-2" stroke="#6ee7b7" stroke-width="1.5" stroke-dasharray="8 6" fill="none" opacity="0.4"/>
  <g class="elem-1">
    <path d="M150,280 Q300,160 450,260 T750,220 L750,380 L150,380 Z" fill="url(#banner_pradaria_astral-grad)" opacity="0.5"/>
    <polygon points="600,120 640,190 560,190" fill="#6ee7b7" opacity="0.85" filter="drop-shadow(0 0 14px #6ee7b7)"/>
    <circle cx="600" cy="100" r="6" fill="#ffffff" filter="drop-shadow(0 0 8px #6ee7b7)"/>
  </g>
  <g fill="#ffffff" class="pulse-star" opacity="0.7">
    <circle cx="180" cy="90" r="2"/><circle cx="380" cy="60" r="2.5"/><circle cx="720" cy="80" r="1.8"/><circle cx="1080" cy="120" r="2.2"/><circle cx="1140" cy="260" r="2"/>
  </g>
</svg>`;

// O Quasar da Alvorada
export const BANNER_QUASAR_SUPREMO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="banner_quasar_supremo-bg" cx="50%" cy="50%" r="75%"><stop offset="0%" stop-color="#581c87"/><stop offset="60%" stop-color="#2e1065"/><stop offset="100%" stop-color="#020205"/></radialGradient>
    <linearGradient id="banner_quasar_supremo-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#d8b4fe" stop-opacity="0.8"/><stop offset="100%" stop-color="#581c87" stop-opacity="0.2"/></linearGradient>
  </defs>
  <style>
    @beamJet { 0%, 100% { transform: translateY(0) scale(1); opacity: 0.75; } 50% { transform: translateY(-20px) scale(1.08); opacity: 1; } }
    @coreRadiance { 0%, 100% { transform: rotate(0deg); opacity: 0.6; } 50% { transform: rotate(180deg); opacity: 0.95; } }
    .elem-1 { animation: beamJet 5s ease-in-out infinite; transform-origin: center; }
    .elem-2 { animation: coreRadiance 18s linear infinite; transform-origin: 900px 200px; }
    .pulse-star { animation: beamJet 3s ease-in-out infinite; }
  </style>
  <rect width="1200" height="400" fill="url(#banner_quasar_supremo-bg)"/>
  <circle cx="900" cy="200" r="140" class="elem-2" stroke="#d8b4fe" stroke-width="2" stroke-dasharray="16 12" fill="none" opacity="0.6"/>
  <circle cx="900" cy="200" r="90" class="elem-2" stroke="#d8b4fe" stroke-width="1.5" stroke-dasharray="8 6" fill="none" opacity="0.4"/>
  <g class="elem-1">
    <path d="M150,280 Q300,160 450,260 T750,220 L750,380 L150,380 Z" fill="url(#banner_quasar_supremo-grad)" opacity="0.5"/>
    <polygon points="600,120 640,190 560,190" fill="#d8b4fe" opacity="0.85" filter="drop-shadow(0 0 14px #d8b4fe)"/>
    <circle cx="600" cy="100" r="6" fill="#ffffff" filter="drop-shadow(0 0 8px #d8b4fe)"/>
  </g>
  <g fill="#ffffff" class="pulse-star" opacity="0.7">
    <circle cx="180" cy="90" r="2"/><circle cx="380" cy="60" r="2.5"/><circle cx="720" cy="80" r="1.8"/><circle cx="1080" cy="120" r="2.2"/><circle cx="1140" cy="260" r="2"/>
  </g>
</svg>`;

// Templo da Deusa da Lua
export const BANNER_SANTUARIO_LUA_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="banner_santuario_lua-bg" cx="50%" cy="50%" r="75%"><stop offset="0%" stop-color="#334155"/><stop offset="60%" stop-color="#0f172a"/><stop offset="100%" stop-color="#020205"/></radialGradient>
    <linearGradient id="banner_santuario_lua-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#e2e8f0" stop-opacity="0.8"/><stop offset="100%" stop-color="#334155" stop-opacity="0.2"/></linearGradient>
  </defs>
  <style>
    @pillarGlow { 0%, 100% { transform: translateY(0) scale(1); opacity: 0.75; } 50% { transform: translateY(-20px) scale(1.08); opacity: 1; } }
    @lunarChime { 0%, 100% { transform: rotate(0deg); opacity: 0.6; } 50% { transform: rotate(180deg); opacity: 0.95; } }
    .elem-1 { animation: pillarGlow 5s ease-in-out infinite; transform-origin: center; }
    .elem-2 { animation: lunarChime 18s linear infinite; transform-origin: 900px 200px; }
    .pulse-star { animation: pillarGlow 3s ease-in-out infinite; }
  </style>
  <rect width="1200" height="400" fill="url(#banner_santuario_lua-bg)"/>
  <circle cx="900" cy="200" r="140" class="elem-2" stroke="#e2e8f0" stroke-width="2" stroke-dasharray="16 12" fill="none" opacity="0.6"/>
  <circle cx="900" cy="200" r="90" class="elem-2" stroke="#e2e8f0" stroke-width="1.5" stroke-dasharray="8 6" fill="none" opacity="0.4"/>
  <g class="elem-1">
    <path d="M150,280 Q300,160 450,260 T750,220 L750,380 L150,380 Z" fill="url(#banner_santuario_lua-grad)" opacity="0.5"/>
    <polygon points="600,120 640,190 560,190" fill="#e2e8f0" opacity="0.85" filter="drop-shadow(0 0 14px #e2e8f0)"/>
    <circle cx="600" cy="100" r="6" fill="#ffffff" filter="drop-shadow(0 0 8px #e2e8f0)"/>
  </g>
  <g fill="#ffffff" class="pulse-star" opacity="0.7">
    <circle cx="180" cy="90" r="2"/><circle cx="380" cy="60" r="2.5"/><circle cx="720" cy="80" r="1.8"/><circle cx="1080" cy="120" r="2.2"/><circle cx="1140" cy="260" r="2"/>
  </g>
</svg>`;

// Fratura no Tecido Temporal
export const BANNER_FENDA_TEMPO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="banner_fenda_tempo-bg" cx="50%" cy="50%" r="75%"><stop offset="0%" stop-color="#4338ca"/><stop offset="60%" stop-color="#1e1b4b"/><stop offset="100%" stop-color="#020205"/></radialGradient>
    <linearGradient id="banner_fenda_tempo-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#67e8f9" stop-opacity="0.8"/><stop offset="100%" stop-color="#4338ca" stop-opacity="0.2"/></linearGradient>
  </defs>
  <style>
    @timeCrack { 0%, 100% { transform: translateY(0) scale(1); opacity: 0.75; } 50% { transform: translateY(-20px) scale(1.08); opacity: 1; } }
    @echoDistort { 0%, 100% { transform: rotate(0deg); opacity: 0.6; } 50% { transform: rotate(180deg); opacity: 0.95; } }
    .elem-1 { animation: timeCrack 5s ease-in-out infinite; transform-origin: center; }
    .elem-2 { animation: echoDistort 18s linear infinite; transform-origin: 900px 200px; }
    .pulse-star { animation: timeCrack 3s ease-in-out infinite; }
  </style>
  <rect width="1200" height="400" fill="url(#banner_fenda_tempo-bg)"/>
  <circle cx="900" cy="200" r="140" class="elem-2" stroke="#67e8f9" stroke-width="2" stroke-dasharray="16 12" fill="none" opacity="0.6"/>
  <circle cx="900" cy="200" r="90" class="elem-2" stroke="#67e8f9" stroke-width="1.5" stroke-dasharray="8 6" fill="none" opacity="0.4"/>
  <g class="elem-1">
    <path d="M150,280 Q300,160 450,260 T750,220 L750,380 L150,380 Z" fill="url(#banner_fenda_tempo-grad)" opacity="0.5"/>
    <polygon points="600,120 640,190 560,190" fill="#67e8f9" opacity="0.85" filter="drop-shadow(0 0 14px #67e8f9)"/>
    <circle cx="600" cy="100" r="6" fill="#ffffff" filter="drop-shadow(0 0 8px #67e8f9)"/>
  </g>
  <g fill="#ffffff" class="pulse-star" opacity="0.7">
    <circle cx="180" cy="90" r="2"/><circle cx="380" cy="60" r="2.5"/><circle cx="720" cy="80" r="1.8"/><circle cx="1080" cy="120" r="2.2"/><circle cx="1140" cy="260" r="2"/>
  </g>
</svg>`;

// Altar Ritualístico de Sangue
export const BANNER_ALTAR_SACRIFICIO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="banner_altar_sacrificio-bg" cx="50%" cy="50%" r="75%"><stop offset="0%" stop-color="#881337"/><stop offset="60%" stop-color="#2d0612"/><stop offset="100%" stop-color="#020205"/></radialGradient>
    <linearGradient id="banner_altar_sacrificio-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#fb7185" stop-opacity="0.8"/><stop offset="100%" stop-color="#881337" stop-opacity="0.2"/></linearGradient>
  </defs>
  <style>
    @candleFlicker { 0%, 100% { transform: translateY(0) scale(1); opacity: 0.75; } 50% { transform: translateY(-20px) scale(1.08); opacity: 1; } }
    @sigilAscend { 0%, 100% { transform: rotate(0deg); opacity: 0.6; } 50% { transform: rotate(180deg); opacity: 0.95; } }
    .elem-1 { animation: candleFlicker 5s ease-in-out infinite; transform-origin: center; }
    .elem-2 { animation: sigilAscend 18s linear infinite; transform-origin: 900px 200px; }
    .pulse-star { animation: candleFlicker 3s ease-in-out infinite; }
  </style>
  <rect width="1200" height="400" fill="url(#banner_altar_sacrificio-bg)"/>
  <circle cx="900" cy="200" r="140" class="elem-2" stroke="#fb7185" stroke-width="2" stroke-dasharray="16 12" fill="none" opacity="0.6"/>
  <circle cx="900" cy="200" r="90" class="elem-2" stroke="#fb7185" stroke-width="1.5" stroke-dasharray="8 6" fill="none" opacity="0.4"/>
  <g class="elem-1">
    <path d="M150,280 Q300,160 450,260 T750,220 L750,380 L150,380 Z" fill="url(#banner_altar_sacrificio-grad)" opacity="0.5"/>
    <polygon points="600,120 640,190 560,190" fill="#fb7185" opacity="0.85" filter="drop-shadow(0 0 14px #fb7185)"/>
    <circle cx="600" cy="100" r="6" fill="#ffffff" filter="drop-shadow(0 0 8px #fb7185)"/>
  </g>
  <g fill="#ffffff" class="pulse-star" opacity="0.7">
    <circle cx="180" cy="90" r="2"/><circle cx="380" cy="60" r="2.5"/><circle cx="720" cy="80" r="1.8"/><circle cx="1080" cy="120" r="2.2"/><circle cx="1140" cy="260" r="2"/>
  </g>
</svg>`;

// Salto para o Hiperespaço
export const BANNER_VIAGEM_HIPERESPACO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="banner_viagem_hiperespaco-bg" cx="50%" cy="50%" r="75%"><stop offset="0%" stop-color="#1d4ed8"/><stop offset="60%" stop-color="#030712"/><stop offset="100%" stop-color="#020205"/></radialGradient>
    <linearGradient id="banner_viagem_hiperespaco-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#93c5fd" stop-opacity="0.8"/><stop offset="100%" stop-color="#1d4ed8" stop-opacity="0.2"/></linearGradient>
  </defs>
  <style>
    @hyperStretch { 0%, 100% { transform: translateY(0) scale(1); opacity: 0.75; } 50% { transform: translateY(-20px) scale(1.08); opacity: 1; } }
    @tunnelZoom { 0%, 100% { transform: rotate(0deg); opacity: 0.6; } 50% { transform: rotate(180deg); opacity: 0.95; } }
    .elem-1 { animation: hyperStretch 5s ease-in-out infinite; transform-origin: center; }
    .elem-2 { animation: tunnelZoom 18s linear infinite; transform-origin: 900px 200px; }
    .pulse-star { animation: hyperStretch 3s ease-in-out infinite; }
  </style>
  <rect width="1200" height="400" fill="url(#banner_viagem_hiperespaco-bg)"/>
  <circle cx="900" cy="200" r="140" class="elem-2" stroke="#93c5fd" stroke-width="2" stroke-dasharray="16 12" fill="none" opacity="0.6"/>
  <circle cx="900" cy="200" r="90" class="elem-2" stroke="#93c5fd" stroke-width="1.5" stroke-dasharray="8 6" fill="none" opacity="0.4"/>
  <g class="elem-1">
    <path d="M150,280 Q300,160 450,260 T750,220 L750,380 L150,380 Z" fill="url(#banner_viagem_hiperespaco-grad)" opacity="0.5"/>
    <polygon points="600,120 640,190 560,190" fill="#93c5fd" opacity="0.85" filter="drop-shadow(0 0 14px #93c5fd)"/>
    <circle cx="600" cy="100" r="6" fill="#ffffff" filter="drop-shadow(0 0 8px #93c5fd)"/>
  </g>
  <g fill="#ffffff" class="pulse-star" opacity="0.7">
    <circle cx="180" cy="90" r="2"/><circle cx="380" cy="60" r="2.5"/><circle cx="720" cy="80" r="1.8"/><circle cx="1080" cy="120" r="2.2"/><circle cx="1140" cy="260" r="2"/>
  </g>
</svg>`;

// Picos Gelados de Titã
export const BANNER_MONTANHAS_NEVE_COSMICA_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="banner_montanhas_neve_cosmica-bg" cx="50%" cy="50%" r="75%"><stop offset="0%" stop-color="#075985"/><stop offset="60%" stop-color="#082f49"/><stop offset="100%" stop-color="#020205"/></radialGradient>
    <linearGradient id="banner_montanhas_neve_cosmica-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#bae6fd" stop-opacity="0.8"/><stop offset="100%" stop-color="#075985" stop-opacity="0.2"/></linearGradient>
  </defs>
  <style>
    @snowBreeze { 0%, 100% { transform: translateY(0) scale(1); opacity: 0.75; } 50% { transform: translateY(-20px) scale(1.08); opacity: 1; } }
    @peakShimmer { 0%, 100% { transform: rotate(0deg); opacity: 0.6; } 50% { transform: rotate(180deg); opacity: 0.95; } }
    .elem-1 { animation: snowBreeze 5s ease-in-out infinite; transform-origin: center; }
    .elem-2 { animation: peakShimmer 18s linear infinite; transform-origin: 900px 200px; }
    .pulse-star { animation: snowBreeze 3s ease-in-out infinite; }
  </style>
  <rect width="1200" height="400" fill="url(#banner_montanhas_neve_cosmica-bg)"/>
  <circle cx="900" cy="200" r="140" class="elem-2" stroke="#bae6fd" stroke-width="2" stroke-dasharray="16 12" fill="none" opacity="0.6"/>
  <circle cx="900" cy="200" r="90" class="elem-2" stroke="#bae6fd" stroke-width="1.5" stroke-dasharray="8 6" fill="none" opacity="0.4"/>
  <g class="elem-1">
    <path d="M150,280 Q300,160 450,260 T750,220 L750,380 L150,380 Z" fill="url(#banner_montanhas_neve_cosmica-grad)" opacity="0.5"/>
    <polygon points="600,120 640,190 560,190" fill="#bae6fd" opacity="0.85" filter="drop-shadow(0 0 14px #bae6fd)"/>
    <circle cx="600" cy="100" r="6" fill="#ffffff" filter="drop-shadow(0 0 8px #bae6fd)"/>
  </g>
  <g fill="#ffffff" class="pulse-star" opacity="0.7">
    <circle cx="180" cy="90" r="2"/><circle cx="380" cy="60" r="2.5"/><circle cx="720" cy="80" r="1.8"/><circle cx="1080" cy="120" r="2.2"/><circle cx="1140" cy="260" r="2"/>
  </g>
</svg>`;

// Cemitério de Naves Estelares
export const BANNER_CEMITERIO_NAVES_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="banner_cemiterio_naves-bg" cx="50%" cy="50%" r="75%"><stop offset="0%" stop-color="#1e293b"/><stop offset="60%" stop-color="#0f172a"/><stop offset="100%" stop-color="#020205"/></radialGradient>
    <linearGradient id="banner_cemiterio_naves-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#94a3b8" stop-opacity="0.8"/><stop offset="100%" stop-color="#1e293b" stop-opacity="0.2"/></linearGradient>
  </defs>
  <style>
    @hulkFloat { 0%, 100% { transform: translateY(0) scale(1); opacity: 0.75; } 50% { transform: translateY(-20px) scale(1.08); opacity: 1; } }
    @beaconBlink { 0%, 100% { transform: rotate(0deg); opacity: 0.6; } 50% { transform: rotate(180deg); opacity: 0.95; } }
    .elem-1 { animation: hulkFloat 5s ease-in-out infinite; transform-origin: center; }
    .elem-2 { animation: beaconBlink 18s linear infinite; transform-origin: 900px 200px; }
    .pulse-star { animation: hulkFloat 3s ease-in-out infinite; }
  </style>
  <rect width="1200" height="400" fill="url(#banner_cemiterio_naves-bg)"/>
  <circle cx="900" cy="200" r="140" class="elem-2" stroke="#94a3b8" stroke-width="2" stroke-dasharray="16 12" fill="none" opacity="0.6"/>
  <circle cx="900" cy="200" r="90" class="elem-2" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="8 6" fill="none" opacity="0.4"/>
  <g class="elem-1">
    <path d="M150,280 Q300,160 450,260 T750,220 L750,380 L150,380 Z" fill="url(#banner_cemiterio_naves-grad)" opacity="0.5"/>
    <polygon points="600,120 640,190 560,190" fill="#94a3b8" opacity="0.85" filter="drop-shadow(0 0 14px #94a3b8)"/>
    <circle cx="600" cy="100" r="6" fill="#ffffff" filter="drop-shadow(0 0 8px #94a3b8)"/>
  </g>
  <g fill="#ffffff" class="pulse-star" opacity="0.7">
    <circle cx="180" cy="90" r="2"/><circle cx="380" cy="60" r="2.5"/><circle cx="720" cy="80" r="1.8"/><circle cx="1080" cy="120" r="2.2"/><circle cx="1140" cy="260" r="2"/>
  </g>
</svg>`;

// Megasustrutura da Esfera de Dyson
export const BANNER_ESFERA_DYSON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="banner_esfera_dyson-bg" cx="50%" cy="50%" r="75%"><stop offset="0%" stop-color="#1e3a8a"/><stop offset="60%" stop-color="#172554"/><stop offset="100%" stop-color="#020205"/></radialGradient>
    <linearGradient id="banner_esfera_dyson-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#facc15" stop-opacity="0.8"/><stop offset="100%" stop-color="#1e3a8a" stop-opacity="0.2"/></linearGradient>
  </defs>
  <style>
    @panelOrbit { 0%, 100% { transform: translateY(0) scale(1); opacity: 0.75; } 50% { transform: translateY(-20px) scale(1.08); opacity: 1; } }
    @starSiphon { 0%, 100% { transform: rotate(0deg); opacity: 0.6; } 50% { transform: rotate(180deg); opacity: 0.95; } }
    .elem-1 { animation: panelOrbit 5s ease-in-out infinite; transform-origin: center; }
    .elem-2 { animation: starSiphon 18s linear infinite; transform-origin: 900px 200px; }
    .pulse-star { animation: panelOrbit 3s ease-in-out infinite; }
  </style>
  <rect width="1200" height="400" fill="url(#banner_esfera_dyson-bg)"/>
  <circle cx="900" cy="200" r="140" class="elem-2" stroke="#facc15" stroke-width="2" stroke-dasharray="16 12" fill="none" opacity="0.6"/>
  <circle cx="900" cy="200" r="90" class="elem-2" stroke="#facc15" stroke-width="1.5" stroke-dasharray="8 6" fill="none" opacity="0.4"/>
  <g class="elem-1">
    <path d="M150,280 Q300,160 450,260 T750,220 L750,380 L150,380 Z" fill="url(#banner_esfera_dyson-grad)" opacity="0.5"/>
    <polygon points="600,120 640,190 560,190" fill="#facc15" opacity="0.85" filter="drop-shadow(0 0 14px #facc15)"/>
    <circle cx="600" cy="100" r="6" fill="#ffffff" filter="drop-shadow(0 0 8px #facc15)"/>
  </g>
  <g fill="#ffffff" class="pulse-star" opacity="0.7">
    <circle cx="180" cy="90" r="2"/><circle cx="380" cy="60" r="2.5"/><circle cx="720" cy="80" r="1.8"/><circle cx="1080" cy="120" r="2.2"/><circle cx="1140" cy="260" r="2"/>
  </g>
</svg>`;

// Campo das Valquírias
export const BANNER_VALQUIRIA_CAMPO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="banner_valquiria_campo-bg" cx="50%" cy="50%" r="75%"><stop offset="0%" stop-color="#4c1d95"/><stop offset="60%" stop-color="#1e1b4b"/><stop offset="100%" stop-color="#020205"/></radialGradient>
    <linearGradient id="banner_valquiria_campo-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#c084fc" stop-opacity="0.8"/><stop offset="100%" stop-color="#4c1d95" stop-opacity="0.2"/></linearGradient>
  </defs>
  <style>
    @swordAura { 0%, 100% { transform: translateY(0) scale(1); opacity: 0.75; } 50% { transform: translateY(-20px) scale(1.08); opacity: 1; } }
    @featherFall { 0%, 100% { transform: rotate(0deg); opacity: 0.6; } 50% { transform: rotate(180deg); opacity: 0.95; } }
    .elem-1 { animation: swordAura 5s ease-in-out infinite; transform-origin: center; }
    .elem-2 { animation: featherFall 18s linear infinite; transform-origin: 900px 200px; }
    .pulse-star { animation: swordAura 3s ease-in-out infinite; }
  </style>
  <rect width="1200" height="400" fill="url(#banner_valquiria_campo-bg)"/>
  <circle cx="900" cy="200" r="140" class="elem-2" stroke="#c084fc" stroke-width="2" stroke-dasharray="16 12" fill="none" opacity="0.6"/>
  <circle cx="900" cy="200" r="90" class="elem-2" stroke="#c084fc" stroke-width="1.5" stroke-dasharray="8 6" fill="none" opacity="0.4"/>
  <g class="elem-1">
    <path d="M150,280 Q300,160 450,260 T750,220 L750,380 L150,380 Z" fill="url(#banner_valquiria_campo-grad)" opacity="0.5"/>
    <polygon points="600,120 640,190 560,190" fill="#c084fc" opacity="0.85" filter="drop-shadow(0 0 14px #c084fc)"/>
    <circle cx="600" cy="100" r="6" fill="#ffffff" filter="drop-shadow(0 0 8px #c084fc)"/>
  </g>
  <g fill="#ffffff" class="pulse-star" opacity="0.7">
    <circle cx="180" cy="90" r="2"/><circle cx="380" cy="60" r="2.5"/><circle cx="720" cy="80" r="1.8"/><circle cx="1080" cy="120" r="2.2"/><circle cx="1140" cy="260" r="2"/>
  </g>
</svg>`;

// Floresta de Cogumelos Cósmicos
export const BANNER_FLORESTA_FUNGOS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="banner_floresta_fungos-bg" cx="50%" cy="50%" r="75%"><stop offset="0%" stop-color="#047857"/><stop offset="60%" stop-color="#064e3b"/><stop offset="100%" stop-color="#020205"/></radialGradient>
    <linearGradient id="banner_floresta_fungos-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#34d399" stop-opacity="0.8"/><stop offset="100%" stop-color="#047857" stop-opacity="0.2"/></linearGradient>
  </defs>
  <style>
    @capBreathe { 0%, 100% { transform: translateY(0) scale(1); opacity: 0.75; } 50% { transform: translateY(-20px) scale(1.08); opacity: 1; } }
    @myceliumGlow { 0%, 100% { transform: rotate(0deg); opacity: 0.6; } 50% { transform: rotate(180deg); opacity: 0.95; } }
    .elem-1 { animation: capBreathe 5s ease-in-out infinite; transform-origin: center; }
    .elem-2 { animation: myceliumGlow 18s linear infinite; transform-origin: 900px 200px; }
    .pulse-star { animation: capBreathe 3s ease-in-out infinite; }
  </style>
  <rect width="1200" height="400" fill="url(#banner_floresta_fungos-bg)"/>
  <circle cx="900" cy="200" r="140" class="elem-2" stroke="#34d399" stroke-width="2" stroke-dasharray="16 12" fill="none" opacity="0.6"/>
  <circle cx="900" cy="200" r="90" class="elem-2" stroke="#34d399" stroke-width="1.5" stroke-dasharray="8 6" fill="none" opacity="0.4"/>
  <g class="elem-1">
    <path d="M150,280 Q300,160 450,260 T750,220 L750,380 L150,380 Z" fill="url(#banner_floresta_fungos-grad)" opacity="0.5"/>
    <polygon points="600,120 640,190 560,190" fill="#34d399" opacity="0.85" filter="drop-shadow(0 0 14px #34d399)"/>
    <circle cx="600" cy="100" r="6" fill="#ffffff" filter="drop-shadow(0 0 8px #34d399)"/>
  </g>
  <g fill="#ffffff" class="pulse-star" opacity="0.7">
    <circle cx="180" cy="90" r="2"/><circle cx="380" cy="60" r="2.5"/><circle cx="720" cy="80" r="1.8"/><circle cx="1080" cy="120" r="2.2"/><circle cx="1140" cy="260" r="2"/>
  </g>
</svg>`;

// Geodo Gigante de Ametista
export const BANNER_CAVERNA_AMETISTA_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="banner_caverna_ametista-bg" cx="50%" cy="50%" r="75%"><stop offset="0%" stop-color="#6b21a8"/><stop offset="60%" stop-color="#2e1065"/><stop offset="100%" stop-color="#020205"/></radialGradient>
    <linearGradient id="banner_caverna_ametista-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#e879f9" stop-opacity="0.8"/><stop offset="100%" stop-color="#6b21a8" stop-opacity="0.2"/></linearGradient>
  </defs>
  <style>
    @facetSparkle { 0%, 100% { transform: translateY(0) scale(1); opacity: 0.75; } 50% { transform: translateY(-20px) scale(1.08); opacity: 1; } }
    @dripRipple { 0%, 100% { transform: rotate(0deg); opacity: 0.6; } 50% { transform: rotate(180deg); opacity: 0.95; } }
    .elem-1 { animation: facetSparkle 5s ease-in-out infinite; transform-origin: center; }
    .elem-2 { animation: dripRipple 18s linear infinite; transform-origin: 900px 200px; }
    .pulse-star { animation: facetSparkle 3s ease-in-out infinite; }
  </style>
  <rect width="1200" height="400" fill="url(#banner_caverna_ametista-bg)"/>
  <circle cx="900" cy="200" r="140" class="elem-2" stroke="#e879f9" stroke-width="2" stroke-dasharray="16 12" fill="none" opacity="0.6"/>
  <circle cx="900" cy="200" r="90" class="elem-2" stroke="#e879f9" stroke-width="1.5" stroke-dasharray="8 6" fill="none" opacity="0.4"/>
  <g class="elem-1">
    <path d="M150,280 Q300,160 450,260 T750,220 L750,380 L150,380 Z" fill="url(#banner_caverna_ametista-grad)" opacity="0.5"/>
    <polygon points="600,120 640,190 560,190" fill="#e879f9" opacity="0.85" filter="drop-shadow(0 0 14px #e879f9)"/>
    <circle cx="600" cy="100" r="6" fill="#ffffff" filter="drop-shadow(0 0 8px #e879f9)"/>
  </g>
  <g fill="#ffffff" class="pulse-star" opacity="0.7">
    <circle cx="180" cy="90" r="2"/><circle cx="380" cy="60" r="2.5"/><circle cx="720" cy="80" r="1.8"/><circle cx="1080" cy="120" r="2.2"/><circle cx="1140" cy="260" r="2"/>
  </g>
</svg>`;

// O Nexus dos Quatro Elementos
export const BANNER_NEXUS_ELEMENTOS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="banner_nexus_elementos-bg" cx="50%" cy="50%" r="75%"><stop offset="0%" stop-color="#3b0764"/><stop offset="60%" stop-color="#18181b"/><stop offset="100%" stop-color="#020205"/></radialGradient>
    <linearGradient id="banner_nexus_elementos-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#f97316" stop-opacity="0.8"/><stop offset="100%" stop-color="#3b0764" stop-opacity="0.2"/></linearGradient>
  </defs>
  <style>
    @orbClash { 0%, 100% { transform: translateY(0) scale(1); opacity: 0.75; } 50% { transform: translateY(-20px) scale(1.08); opacity: 1; } }
    @vortexBalance { 0%, 100% { transform: rotate(0deg); opacity: 0.6; } 50% { transform: rotate(180deg); opacity: 0.95; } }
    .elem-1 { animation: orbClash 5s ease-in-out infinite; transform-origin: center; }
    .elem-2 { animation: vortexBalance 18s linear infinite; transform-origin: 900px 200px; }
    .pulse-star { animation: orbClash 3s ease-in-out infinite; }
  </style>
  <rect width="1200" height="400" fill="url(#banner_nexus_elementos-bg)"/>
  <circle cx="900" cy="200" r="140" class="elem-2" stroke="#f97316" stroke-width="2" stroke-dasharray="16 12" fill="none" opacity="0.6"/>
  <circle cx="900" cy="200" r="90" class="elem-2" stroke="#f97316" stroke-width="1.5" stroke-dasharray="8 6" fill="none" opacity="0.4"/>
  <g class="elem-1">
    <path d="M150,280 Q300,160 450,260 T750,220 L750,380 L150,380 Z" fill="url(#banner_nexus_elementos-grad)" opacity="0.5"/>
    <polygon points="600,120 640,190 560,190" fill="#f97316" opacity="0.85" filter="drop-shadow(0 0 14px #f97316)"/>
    <circle cx="600" cy="100" r="6" fill="#ffffff" filter="drop-shadow(0 0 8px #f97316)"/>
  </g>
  <g fill="#ffffff" class="pulse-star" opacity="0.7">
    <circle cx="180" cy="90" r="2"/><circle cx="380" cy="60" r="2.5"/><circle cx="720" cy="80" r="1.8"/><circle cx="1080" cy="120" r="2.2"/><circle cx="1140" cy="260" r="2"/>
  </g>
</svg>`;

// A Sala do Trono do Project Nox
export const BANNER_TRONO_SOBERANO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="banner_trono_soberano-bg" cx="50%" cy="50%" r="75%"><stop offset="0%" stop-color="#1e1b4b"/><stop offset="60%" stop-color="#0f172a"/><stop offset="100%" stop-color="#020205"/></radialGradient>
    <linearGradient id="banner_trono_soberano-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#fbbf24" stop-opacity="0.8"/><stop offset="100%" stop-color="#1e1b4b" stop-opacity="0.2"/></linearGradient>
  </defs>
  <style>
    @bannerDrape { 0%, 100% { transform: translateY(0) scale(1); opacity: 0.75; } 50% { transform: translateY(-20px) scale(1.08); opacity: 1; } }
    @throneGlow { 0%, 100% { transform: rotate(0deg); opacity: 0.6; } 50% { transform: rotate(180deg); opacity: 0.95; } }
    .elem-1 { animation: bannerDrape 5s ease-in-out infinite; transform-origin: center; }
    .elem-2 { animation: throneGlow 18s linear infinite; transform-origin: 900px 200px; }
    .pulse-star { animation: bannerDrape 3s ease-in-out infinite; }
  </style>
  <rect width="1200" height="400" fill="url(#banner_trono_soberano-bg)"/>
  <circle cx="900" cy="200" r="140" class="elem-2" stroke="#fbbf24" stroke-width="2" stroke-dasharray="16 12" fill="none" opacity="0.6"/>
  <circle cx="900" cy="200" r="90" class="elem-2" stroke="#fbbf24" stroke-width="1.5" stroke-dasharray="8 6" fill="none" opacity="0.4"/>
  <g class="elem-1">
    <path d="M150,280 Q300,160 450,260 T750,220 L750,380 L150,380 Z" fill="url(#banner_trono_soberano-grad)" opacity="0.5"/>
    <polygon points="600,120 640,190 560,190" fill="#fbbf24" opacity="0.85" filter="drop-shadow(0 0 14px #fbbf24)"/>
    <circle cx="600" cy="100" r="6" fill="#ffffff" filter="drop-shadow(0 0 8px #fbbf24)"/>
  </g>
  <g fill="#ffffff" class="pulse-star" opacity="0.7">
    <circle cx="180" cy="90" r="2"/><circle cx="380" cy="60" r="2.5"/><circle cx="720" cy="80" r="1.8"/><circle cx="1080" cy="120" r="2.2"/><circle cx="1140" cy="260" r="2"/>
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
