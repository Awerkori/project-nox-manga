/**
 * High-definition Procedural Animated Cosmic Vector Banners for Project Nox (Round 4)
 * Pure SVG vectors with rich compositions and native CSS keyframe animations:
 * shooting stars, aurora waves, rotating astrolabes, event horizons, celestial citadels,
 * and quantum portals.
 * 100% vector, zero external asset dependencies, GPU-accelerated 60fps.
 */

function svgToDataUri(svg: string): string {
  const clean = svg.replace(/\s+/g, ' ').trim();
  return `url("data:image/svg+xml,${encodeURIComponent(clean)}") center/cover no-repeat`;
}

// 1. Nebulosa do Vazio & Constelações (Animado - Movimento Acentuado)
export const BANNER_NEBULOSA_VAZIO_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="nv-bg" cx="50%" cy="50%" r="75%">
      <stop offset="0%" stop-color="#180e38"/>
      <stop offset="50%" stop-color="#0b071c"/>
      <stop offset="100%" stop-color="#030208"/>
    </radialGradient>
    <radialGradient id="nv-cloud-1" cx="72%" cy="38%" r="48%">
      <stop offset="0%" stop-color="rgba(168, 85, 247, 0.55)"/>
      <stop offset="45%" stop-color="rgba(139, 92, 246, 0.28)"/>
      <stop offset="100%" stop-color="transparent"/>
    </radialGradient>
    <radialGradient id="nv-cloud-2" cx="28%" cy="65%" r="45%">
      <stop offset="0%" stop-color="rgba(56, 189, 248, 0.45)"/>
      <stop offset="55%" stop-color="rgba(99, 102, 241, 0.22)"/>
      <stop offset="100%" stop-color="transparent"/>
    </radialGradient>
    <radialGradient id="nv-cloud-3" cx="50%" cy="25%" r="40%">
      <stop offset="0%" stop-color="rgba(236, 72, 153, 0.35)"/>
      <stop offset="100%" stop-color="transparent"/>
    </radialGradient>
    <radialGradient id="nv-star-glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="30%" stop-color="rgba(192, 132, 252, 0.95)"/>
      <stop offset="100%" stop-color="transparent"/>
    </radialGradient>
  </defs>

  <style>
    @keyframes nvDrift1 { 0%, 100% { opacity: 0.8; transform: translate(0,0) scale(1); } 50% { opacity: 1; transform: translate(-25px, 14px) scale(1.08); } }
    @keyframes nvDrift2 { 0%, 100% { opacity: 0.7; transform: translate(0,0) scale(1); } 50% { opacity: 0.95; transform: translate(22px, -16px) scale(1.1); } }
    @keyframes starPulse1 { 0%, 100% { opacity: 0.25; transform: scale(0.85); } 50% { opacity: 1; transform: scale(1.25); } }
    @keyframes starPulse2 { 0%, 100% { opacity: 1; transform: scale(1.2); } 50% { opacity: 0.2; transform: scale(0.8); } }
    @keyframes constBreathe { 0%, 100% { stroke-opacity: 0.35; stroke-dashoffset: 0; } 50% { stroke-opacity: 0.95; stroke-dashoffset: 16; } }
    @keyframes meteorStreak { 0% { transform: translate(-100px, -50px); opacity: 0; } 15% { opacity: 1; } 35% { transform: translate(320px, 160px); opacity: 0; } 100% { transform: translate(320px, 160px); opacity: 0; } }
    .nv-c1 { animation: nvDrift1 10s ease-in-out infinite; transform-origin: 72% 38%; }
    .nv-c2 { animation: nvDrift2 12s ease-in-out infinite; transform-origin: 28% 65%; }
    .star-a { animation: starPulse1 2.8s ease-in-out infinite; transform-origin: center; }
    .star-b { animation: starPulse2 3.2s ease-in-out infinite; transform-origin: center; }
    .const-line { animation: constBreathe 4s ease-in-out infinite; }
    .meteor-1 { animation: meteorStreak 6s linear infinite; }
    .meteor-2 { animation: meteorStreak 7.5s linear infinite 3s; }
  </style>

  <rect width="1200" height="400" fill="url(#nv-bg)"/>
  <rect class="nv-c1" width="1200" height="400" fill="url(#nv-cloud-1)"/>
  <rect class="nv-c2" width="1200" height="400" fill="url(#nv-cloud-2)"/>
  <rect width="1200" height="400" fill="url(#nv-cloud-3)"/>

  <!-- Occasional Shooting Star Streaks -->
  <g stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" opacity="0.85">
    <line x1="200" y1="30" x2="260" y2="60" class="meteor-1" filter="drop-shadow(0 0 6px #c084fc)"/>
    <line x1="750" y1="20" x2="820" y2="55" class="meteor-2" filter="drop-shadow(0 0 6px #38bdf8)"/>
  </g>

  <!-- Distant Starfield with Dynamic Twinkle -->
  <g fill="#ffffff">
    <g class="star-a">
      <circle cx="45" cy="82" r="1.3"/><circle cx="178" cy="45" r="1.1"/><circle cx="310" cy="180" r="1.2"/>
      <circle cx="460" cy="290" r="1.3"/><circle cx="610" cy="260" r="1.1"/><circle cx="750" cy="330" r="1.5"/>
      <circle cx="890" cy="270" r="1.4"/><circle cx="1040" cy="315" r="1.2"/><circle cx="1175" cy="65" r="1.5"/>
    </g>
    <g class="star-b">
      <circle cx="112" cy="240" r="1.4"/><circle cx="240" cy="310" r="1.6"/><circle cx="390" cy="70" r="1.5"/>
      <circle cx="530" cy="120" r="1.4"/><circle cx="680" cy="50" r="1.3"/><circle cx="820" cy="110" r="1.1"/>
      <circle cx="960" cy="85" r="1.7"/><circle cx="1110" cy="140" r="1.3"/><circle cx="670" cy="190" r="1.6"/>
    </g>
  </g>

  <!-- Constellation 1: Coroa de Nox -->
  <g>
    <polyline points="140,110 230,160 340,120 420,195 520,135 600,210" 
      stroke="rgba(192, 132, 252, 0.75)" stroke-width="1.8" stroke-dasharray="6,4" fill="none" class="const-line"/>
    <circle cx="140" cy="110" r="2.8" fill="#e9d5ff"/>
    <circle cx="230" cy="160" r="2.5" fill="#c084fc"/>
    <circle cx="340" cy="120" r="5.5" fill="url(#nv-star-glow)" class="star-a"/>
    <path d="M340,108 L340,132 M328,120 L352,120" stroke="#ffffff" stroke-width="1.5" class="star-a"/>
    <circle cx="420" cy="195" r="2.8" fill="#e9d5ff"/>
    <circle cx="520" cy="135" r="3.5" fill="#c084fc"/>
    <circle cx="600" cy="210" r="2.8" fill="#e9d5ff"/>
  </g>

  <!-- Constellation 2: Serpente do Vazio -->
  <g>
    <polyline points="720,250 810,190 910,225 1000,140 1090,175 1150,115" 
      stroke="rgba(56, 189, 248, 0.75)" stroke-width="1.8" stroke-dasharray="6,4" fill="none" class="const-line"/>
    <circle cx="720" cy="250" r="2.8" fill="#bae6fd"/>
    <circle cx="810" cy="190" r="2.5" fill="#38bdf8"/>
    <circle cx="910" cy="225" r="2.8" fill="#bae6fd"/>
    <circle cx="1000" cy="140" r="6" fill="url(#nv-star-glow)" class="star-b"/>
    <path d="M1000,126 L1000,154 M986,140 L1014,140" stroke="#ffffff" stroke-width="1.5" class="star-b"/>
    <circle cx="1090" cy="175" r="2.8" fill="#38bdf8"/>
    <circle cx="1150" cy="115" r="3.5" fill="#bae6fd"/>
  </g>
</svg>
`;

// 2. Aurora Astral & Cordilheira Cósmica (Animado - Ondulação Marcante)
export const BANNER_AURORA_ASTRAL_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="aa-bg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#020e17"/>
      <stop offset="60%" stop-color="#042026"/>
      <stop offset="100%" stop-color="#020d12"/>
    </linearGradient>
    <linearGradient id="aa-wave-1" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="rgba(16, 185, 129, 0)"/>
      <stop offset="25%" stop-color="rgba(16, 185, 129, 0.75)"/>
      <stop offset="50%" stop-color="rgba(6, 182, 212, 0.8)"/>
      <stop offset="75%" stop-color="rgba(52, 211, 153, 0.7)"/>
      <stop offset="100%" stop-color="rgba(6, 182, 212, 0)"/>
    </linearGradient>
    <linearGradient id="aa-wave-2" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="rgba(6, 182, 212, 0)"/>
      <stop offset="30%" stop-color="rgba(56, 189, 248, 0.65)"/>
      <stop offset="60%" stop-color="rgba(139, 92, 246, 0.6)"/>
      <stop offset="90%" stop-color="rgba(16, 185, 129, 0.5)"/>
      <stop offset="100%" stop-color="rgba(139, 92, 246, 0)"/>
    </linearGradient>
  </defs>

  <style>
    @keyframes curtainWaveWide { 0%, 100% { opacity: 0.25; transform: translate(0, 0); } 50% { opacity: 0.5; transform: translate(-20px, -18px); } }
    @keyframes ribbonShift1 { 0%, 100% { transform: translateY(0) scaleY(1); opacity: 0.8; } 50% { transform: translateY(-20px) scaleY(1.15); opacity: 0.98; } }
    @keyframes ribbonShift2 { 0%, 100% { transform: translateY(0) scaleY(1); opacity: 0.7; } 50% { transform: translateY(18px) scaleY(1.12); opacity: 0.92; } }
    @keyframes auroraParticleFloat { 0%, 100% { transform: translateY(0) scale(1); opacity: 0.4; } 50% { transform: translateY(-15px) scale(1.3); opacity: 1; } }
    .curtain-grp { animation: curtainWaveWide 6s ease-in-out infinite; }
    .ribbon-1 { animation: ribbonShift1 6.5s ease-in-out infinite; }
    .ribbon-2 { animation: ribbonShift2 8s ease-in-out infinite; }
    .spore-dot { animation: auroraParticleFloat 3.5s ease-in-out infinite; }
  </style>

  <rect width="1200" height="400" fill="url(#aa-bg)"/>

  <!-- Vertical Light Curtains (Enhanced Sway) -->
  <g class="curtain-grp">
    <line x1="200" y1="30" x2="200" y2="290" stroke="#34d399" stroke-width="32" filter="blur(8px)"/>
    <line x1="380" y1="10" x2="380" y2="270" stroke="#06b6d4" stroke-width="40" filter="blur(10px)"/>
    <line x1="580" y1="40" x2="580" y2="300" stroke="#10b981" stroke-width="48" filter="blur(12px)"/>
    <line x1="780" y1="20" x2="780" y2="280" stroke="#38bdf8" stroke-width="36" filter="blur(10px)"/>
    <line x1="980" y1="35" x2="980" y2="290" stroke="#8b5cf6" stroke-width="44" filter="blur(10px)"/>
  </g>

  <!-- Aurora Ribbon 1 -->
  <path class="ribbon-1" d="M-50,140 Q250,30 550,110 T1150,50 Q1220,40 1250,70 L1250,340 L-50,340 Z" 
    fill="url(#aa-wave-1)"/>

  <!-- Aurora Ribbon 2 -->
  <path class="ribbon-2" d="M-50,180 Q350,70 700,150 T1250,90 L1250,360 L-50,360 Z" 
    fill="url(#aa-wave-2)"/>

  <!-- Floating Aurora Spores -->
  <g fill="#a7f3d0" class="spore-dot">
    <circle cx="180" cy="110" r="2.5"/><circle cx="340" cy="80" r="3"/><circle cx="520" cy="130" r="2.8"/>
    <circle cx="710" cy="90" r="3.2"/><circle cx="890" cy="140" r="2.6"/><circle cx="1060" cy="70" r="3"/>
  </g>

  <!-- Mountain Silhouette at Bottom -->
  <polygon points="-50,400 -50,340 80,315 210,345 350,295 480,340 640,285 790,335 940,305 1070,345 1250,310 1250,400" 
    fill="#02080d"/>
  <!-- Mountain Rim Starlight Highlight -->
  <polyline points="-50,340 80,315 210,345 350,295 480,340 640,285 790,335 940,305 1070,345 1250,310" 
    stroke="rgba(52, 211, 153, 0.6)" stroke-width="1.6" fill="none"/>
</svg>
`;

// 3. Energia Arcana & Círculo Rúnico (Animado - Rotação Dinâmica)
export const BANNER_ENERGIA_ARCANA_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="ea-bg" cx="50%" cy="50%" r="70%">
      <stop offset="0%" stop-color="#1c0f38"/>
      <stop offset="60%" stop-color="#0d0620"/>
      <stop offset="100%" stop-color="#04020a"/>
    </radialGradient>
    <radialGradient id="ea-vortex" cx="82%" cy="50%" r="55%">
      <stop offset="0%" stop-color="rgba(192, 132, 252, 0.55)"/>
      <stop offset="40%" stop-color="rgba(147, 51, 234, 0.3)"/>
      <stop offset="100%" stop-color="transparent"/>
    </radialGradient>
  </defs>

  <style>
    @keyframes astrolabeSpinCwFast { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    @keyframes astrolabeSpinCcwFast { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
    @keyframes coreIntenseBreathe { 0%, 100% { transform: scale(1); opacity: 0.85; filter: drop-shadow(0 0 8px #f0abfc); } 50% { transform: scale(1.22); opacity: 1; filter: drop-shadow(0 0 24px #e879f9); } }
    @keyframes filamentRush { 0%, 100% { opacity: 0.35; stroke-dashoffset: 0; } 50% { opacity: 0.8; stroke-dashoffset: 40; } }
    .spin-cw { animation: astrolabeSpinCwFast 22s linear infinite; transform-origin: 980px 200px; }
    .spin-ccw { animation: astrolabeSpinCcwFast 16s linear infinite; transform-origin: 980px 200px; }
    .orb-pulse { animation: coreIntenseBreathe 2.5s ease-in-out infinite; transform-origin: 980px 200px; }
    .filaments { animation: filamentRush 4s ease-in-out infinite; }
  </style>

  <rect width="1200" height="400" fill="url(#ea-bg)"/>
  <rect width="1200" height="400" fill="url(#ea-vortex)"/>

  <!-- Energy Wave Filaments -->
  <g fill="none" class="filaments" stroke-dasharray="12,6">
    <path d="M1200,200 C900,150 700,250 400,170 T0,220" stroke="#c084fc" stroke-width="2.4"/>
    <path d="M1200,180 C850,230 650,130 350,210 T0,160" stroke="#818cf8" stroke-width="1.8"/>
    <path d="M1200,220 C950,130 750,270 500,190 T0,250" stroke="#e879f9" stroke-width="1.6"/>
  </g>

  <!-- Arcane Magic Circle / Astrolabe at (980, 200) -->
  <g>
    <!-- Outer Rune Ring (CW) -->
    <g class="spin-cw">
      <circle cx="980" cy="200" r="160" stroke="rgba(192, 132, 252, 0.65)" stroke-width="2.4" stroke-dasharray="12,8" fill="none"/>
      <circle cx="980" cy="200" r="148" stroke="rgba(168, 85, 247, 0.5)" stroke-width="1.4" fill="none"/>
    </g>

    <!-- Middle Glyphic Ring & 8 Cardinal Nodes (CCW) -->
    <g class="spin-ccw">
      <circle cx="980" cy="200" r="125" stroke="rgba(232, 121, 249, 0.75)" stroke-width="2.8" fill="none"/>
      <circle cx="980" cy="75" r="5.5" fill="#f0abfc"/>
      <circle cx="980" cy="325" r="5.5" fill="#f0abfc"/>
      <circle cx="855" cy="200" r="5.5" fill="#f0abfc"/>
      <circle cx="1105" cy="200" r="5.5" fill="#f0abfc"/>
      <circle cx="892" cy="112" r="4" fill="#c084fc"/>
      <circle cx="1068" cy="112" r="4" fill="#c084fc"/>
      <circle cx="892" cy="288" r="4" fill="#c084fc"/>
      <circle cx="1068" cy="288" r="4" fill="#c084fc"/>
    </g>

    <!-- Interlocking Sacred Triangles / Hexagram (CW) -->
    <g class="spin-cw">
      <polygon points="980,100 1066.6,250 893.4,250" stroke="rgba(192, 132, 252, 0.8)" stroke-width="2" fill="none"/>
      <polygon points="980,300 1066.6,150 893.4,150" stroke="rgba(192, 132, 252, 0.8)" stroke-width="2" fill="none"/>
    </g>

    <!-- Inner Core Orb (Intense Pulse) -->
    <g class="orb-pulse">
      <circle cx="980" cy="200" r="44" stroke="rgba(240, 171, 252, 0.9)" stroke-width="2.5" fill="none"/>
      <circle cx="980" cy="200" r="22" fill="rgba(240, 171, 252, 0.95)"/>
    </g>
  </g>
</svg>
`;

// 4. Eclipse Cósmico & Corona Solar (Animado - Corona Viva)
export const BANNER_ECLIPSE_COSMICO_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="ec-bg" cx="50%" cy="50%" r="70%">
      <stop offset="0%" stop-color="#24060d"/>
      <stop offset="60%" stop-color="#0c0205"/>
      <stop offset="100%" stop-color="#040102"/>
    </radialGradient>
    <radialGradient id="ec-corona" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="25%" stop-color="#fbbf24"/>
      <stop offset="55%" stop-color="#ef4444"/>
      <stop offset="85%" stop-color="#991b1b"/>
      <stop offset="100%" stop-color="transparent"/>
    </radialGradient>
    <radialGradient id="ec-flare" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="35%" stop-color="#fde047"/>
      <stop offset="70%" stop-color="rgba(249, 115, 22, 0.6)"/>
      <stop offset="100%" stop-color="transparent"/>
    </radialGradient>
  </defs>

  <style>
    @keyframes coronaIntensePulse { 0%, 100% { transform: scale(1); opacity: 0.88; } 50% { transform: scale(1.12); opacity: 1; filter: drop-shadow(0 0 20px #ef4444); } }
    @keyframes prominenceRoar { 0%, 100% { transform: rotate(0deg) scale(1); } 50% { transform: rotate(10deg) scale(1.06); } }
    @keyframes diamondGlintSparks { 0%, 100% { transform: scale(0.9) rotate(0deg); opacity: 0.85; } 50% { transform: scale(1.3) rotate(90deg); opacity: 1; } }
    @keyframes emberRise { 0% { transform: translateY(0); opacity: 0.2; } 50% { opacity: 0.85; } 100% { transform: translateY(-40px); opacity: 0; } }
    .corona-layer { animation: coronaIntensePulse 3.5s ease-in-out infinite; transform-origin: 820px 180px; }
    .prominence-layer { animation: prominenceRoar 5s ease-in-out infinite; transform-origin: 820px 180px; }
    .diamond-flare { animation: diamondGlintSparks 2.5s ease-in-out infinite; transform-origin: 740px 100px; }
    .embers circle { animation: emberRise 4s linear infinite; }
  </style>

  <rect width="1200" height="400" fill="url(#ec-bg)"/>

  <!-- Crimson Cosmic Dust Cloud -->
  <ellipse cx="800" cy="180" rx="440" ry="250" fill="rgba(220, 38, 38, 0.28)" filter="blur(22px)"/>

  <!-- Solar Eclipse Corona Burst -->
  <circle class="corona-layer" cx="820" cy="180" r="200" fill="url(#ec-corona)"/>

  <!-- Coronal Prominence Streamers -->
  <g class="prominence-layer" stroke="rgba(251, 191, 36, 0.85)" stroke-width="2.6" fill="none">
    <path d="M820,180 L820, -20 M820,180 L820,380"/>
    <path d="M820,180 L620,40 M820,180 L1020,320"/>
    <path d="M820,180 L620,320 M820,180 L1020,40"/>
    <path d="M820,180 L600,180 M820,180 L1040,180"/>
  </g>

  <!-- Total Dark Moon Silhouette -->
  <circle cx="820" cy="180" r="115" fill="#090104"/>

  <!-- Diamond Flare on Eclipse Rim -->
  <g class="diamond-flare" transform="translate(740, 100)">
    <circle cx="0" cy="0" r="36" fill="url(#ec-flare)"/>
    <path d="M0,-46 L0,46 M-46,0 L46,0" stroke="#ffffff" stroke-width="2.6"/>
    <circle cx="0" cy="0" r="8" fill="#ffffff"/>
  </g>

  <!-- Drifting Embers -->
  <g fill="#fca5a5" class="embers">
    <circle cx="120" cy="80" r="1.5"/><circle cx="210" cy="220" r="1.8"/><circle cx="340" cy="130" r="1.4"/>
    <circle cx="450" cy="270" r="2.2"/><circle cx="560" cy="90" r="1.6"/><circle cx="670" cy="310" r="2.4"/>
    <circle cx="1020" cy="95" r="1.8"/><circle cx="1120" cy="250" r="2"/>
  </g>
</svg>
`;

// 5. Biblioteca das Estrelas & Astrolábio Dourado (Animado)
export const BANNER_BIBLIOTECA_ESTRELAS_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="be-bg" cx="50%" cy="50%" r="70%">
      <stop offset="0%" stop-color="#161e33"/>
      <stop offset="60%" stop-color="#0b101f"/>
      <stop offset="100%" stop-color="#03060d"/>
    </radialGradient>
    <radialGradient id="be-gold-glow" cx="50%" cy="30%" r="60%">
      <stop offset="0%" stop-color="rgba(251, 191, 36, 0.4)"/>
      <stop offset="50%" stop-color="rgba(217, 119, 6, 0.22)"/>
      <stop offset="100%" stop-color="transparent"/>
    </radialGradient>
  </defs>

  <style>
    @keyframes armillarySpinFast { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    @keyframes flarePulseActive { 0%, 100% { transform: scale(1) rotate(0deg); opacity: 0.9; } 50% { transform: scale(1.35) rotate(90deg); opacity: 1; } }
    @keyframes goldDustRise { 0% { transform: translateY(0); opacity: 0.3; } 50% { opacity: 0.95; } 100% { transform: translateY(-30px); opacity: 0.2; } }
    .armillary-spin { animation: armillarySpinFast 32s linear infinite; transform-origin: 600px 200px; }
    .flare-center { animation: flarePulseActive 3s ease-in-out infinite; transform-origin: 600px 200px; }
    .gold-dust { animation: goldDustRise 4s ease-in-out infinite; }
  </style>

  <rect width="1200" height="400" fill="url(#be-bg)"/>
  <rect width="1200" height="400" fill="url(#be-gold-glow)"/>

  <!-- Celestial Astrolabe Coordinates & Armillary Arcs -->
  <g class="armillary-spin" stroke="rgba(251, 191, 36, 0.55)" fill="none" stroke-width="1.5">
    <circle cx="600" cy="200" r="185" stroke-dasharray="8,5"/>
    <circle cx="600" cy="200" r="172"/>
    <circle cx="600" cy="200" r="120" stroke-dasharray="4,4"/>
    <ellipse cx="600" cy="200" rx="185" ry="75"/>
    <ellipse cx="600" cy="200" rx="185" ry="135"/>
    <line x1="600" y1="15" x2="600" y2="385" stroke-dasharray="4,4"/>
    <line x1="415" y1="200" x2="785" y2="200" stroke-dasharray="4,4"/>
  </g>

  <!-- Architectural Columns -->
  <g fill="rgba(8, 14, 26, 0.88)" stroke="rgba(251, 191, 36, 0.35)" stroke-width="1.2">
    <path d="M0,0 L140,0 L140,400 L0,400 Z"/>
    <path d="M140,0 Q180,100 180,400 L140,400 Z"/>
    <path d="M1200,0 L1060,0 L1060,400 L1200,400 Z"/>
    <path d="M1060,0 Q1020,100 1020,400 L1060,400 Z"/>
  </g>

  <!-- Starlight Flare in Astrolabe Center -->
  <g class="flare-center">
    <circle cx="600" cy="200" r="16" fill="#fef08a"/>
    <path d="M600,168 L600,232 M568,200 L632,200" stroke="#fbbf24" stroke-width="2.5"/>
  </g>

  <!-- Golden Floating Star Dust -->
  <g class="gold-dust" fill="#fde68a">
    <circle cx="260" cy="90" r="2"/><circle cx="340" cy="280" r="2.4"/><circle cx="860" cy="120" r="2"/>
    <circle cx="940" cy="290" r="2.5"/><circle cx="520" cy="70" r="1.8"/><circle cx="680" cy="330" r="2"/>
  </g>
</svg>
`;

// 6. Fenda Rúnica & Abismo Dimensional (Animado)
export const BANNER_RUNAS_PRIMORDIAIS_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="rp-bg" cx="50%" cy="50%" r="70%">
      <stop offset="0%" stop-color="#140428"/>
      <stop offset="60%" stop-color="#070112"/>
      <stop offset="100%" stop-color="#020005"/>
    </radialGradient>
    <linearGradient id="rp-rift-core" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#06b6d4"/>
      <stop offset="35%" stop-color="#ffffff"/>
      <stop offset="70%" stop-color="#d946ef"/>
      <stop offset="100%" stop-color="#06b6d4"/>
    </linearGradient>
  </defs>

  <style>
    @keyframes riftPlasmaSurge { 0%, 100% { stroke-width: 5px; opacity: 0.88; filter: drop-shadow(0 0 8px #06b6d4); } 50% { stroke-width: 8px; opacity: 1; filter: drop-shadow(0 0 24px #d946ef); } }
    @keyframes shardLevitateA { 0%, 100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-14px) rotate(4deg); } }
    @keyframes shardLevitateB { 0%, 100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(12px) rotate(-3deg); } }
    @keyframes gravityRingSurge { 0%, 100% { opacity: 0.35; transform: rotate(-12deg) scale(1); } 50% { opacity: 0.8; transform: rotate(-12deg) scale(1.05); } }
    .rift-pulse { animation: riftPlasmaSurge 2.8s ease-in-out infinite; }
    .shard-a { animation: shardLevitateA 4.5s ease-in-out infinite; }
    .shard-b { animation: shardLevitateB 5.2s ease-in-out infinite; }
    .gravity-rings { animation: gravityRingSurge 4s ease-in-out infinite; transform-origin: 600px 200px; }
  </style>

  <rect width="1200" height="400" fill="url(#rp-bg)"/>

  <!-- Distortion Ambient Glow -->
  <ellipse cx="600" cy="200" rx="560" ry="190" fill="rgba(217, 70, 239, 0.28)" filter="blur(32px)" transform="rotate(-12 600 200)"/>
  <ellipse cx="600" cy="200" rx="460" ry="110" fill="rgba(6, 182, 212, 0.32)" filter="blur(22px)" transform="rotate(-12 600 200)"/>

  <!-- Spacetime Gravitational Rings -->
  <g class="gravity-rings" stroke="rgba(6, 182, 212, 0.55)" stroke-width="1.6" fill="none" stroke-dasharray="10,6">
    <ellipse cx="600" cy="200" rx="360" ry="75"/>
    <ellipse cx="600" cy="200" rx="250" ry="48"/>
    <ellipse cx="600" cy="200" rx="150" ry="28"/>
  </g>

  <!-- Jagged Spacetime Fracture Core -->
  <path class="rift-pulse" d="M120,-30 L280,70 L340,55 L480,160 L540,140 L700,230 L760,215 L920,320 L1010,295 L1120,430" 
    stroke="url(#rp-rift-core)" stroke-width="6" fill="none" stroke-linecap="round"/>
  <path d="M120,-30 L280,70 L340,55 L480,160 L540,140 L700,230 L760,215 L920,320 L1010,295 L1120,430" 
    stroke="#ffffff" stroke-width="2.4" fill="none" stroke-linecap="round"/>

  <!-- Floating Primordial Runic Monoliths -->
  <g fill="rgba(15, 6, 30, 0.95)" stroke="rgba(6, 182, 212, 0.85)" stroke-width="1.8">
    <g class="shard-a">
      <polygon points="260,180 290,160 300,220 270,240"/>
      <line x1="280" y1="180" x2="285" y2="220" stroke="#67e8f9" stroke-width="1.5"/>
    </g>
    <g class="shard-b">
      <polygon points="450,280 480,260 490,320 460,335"/>
      <line x1="470" y1="275" x2="475" y2="315" stroke="#f0abfc" stroke-width="1.5"/>
    </g>
    <g class="shard-a">
      <polygon points="840,90 870,75 880,135 850,150"/>
      <line x1="860" y1="90" x2="865" y2="130" stroke="#67e8f9" stroke-width="1.5"/>
    </g>
  </g>
</svg>
`;

// =========================================================================
// ROUND 4 NOVO: 7. Chuva de Meteoros Cósmica (Shooting Stars & Planet Ring)
// =========================================================================
export const BANNER_CHUVA_METEOROS_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="cm-bg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#0f0728"/>
      <stop offset="50%" stop-color="#1a0c3b"/>
      <stop offset="100%" stop-color="#070214"/>
    </linearGradient>
    <radialGradient id="cm-planet" cx="35%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#a855f7"/>
      <stop offset="60%" stop-color="#4c1d95"/>
      <stop offset="100%" stop-color="#1e0b38"/>
    </radialGradient>
    <linearGradient id="cm-ring" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="rgba(192, 132, 252, 0.1)"/>
      <stop offset="50%" stop-color="rgba(251, 191, 36, 0.8)"/>
      <stop offset="100%" stop-color="rgba(236, 72, 153, 0.2)"/>
    </linearGradient>
  </defs>

  <style>
    @keyframes meteorRain1 { 0% { transform: translate(-120px, -60px); opacity: 0; } 10% { opacity: 1; } 30% { transform: translate(450px, 220px); opacity: 0; } 100% { transform: translate(450px, 220px); opacity: 0; } }
    @keyframes meteorRain2 { 0% { transform: translate(-80px, -40px); opacity: 0; } 15% { opacity: 1; } 35% { transform: translate(500px, 250px); opacity: 0; } 100% { transform: translate(500px, 250px); opacity: 0; } }
    @keyframes meteorRain3 { 0% { transform: translate(-140px, -70px); opacity: 0; } 8% { opacity: 1; } 28% { transform: translate(480px, 240px); opacity: 0; } 100% { transform: translate(480px, 240px); opacity: 0; } }
    @keyframes ringGlowPulse { 0%, 100% { opacity: 0.65; transform: rotate(-18deg) scale(1); } 50% { opacity: 0.95; transform: rotate(-18deg) scale(1.03); } }
    .m-streak-1 { animation: meteorRain1 4s linear infinite; }
    .m-streak-2 { animation: meteorRain2 5.5s linear infinite 1.8s; }
    .m-streak-3 { animation: meteorRain3 4.8s linear infinite 3.2s; }
    .ring-pulse { animation: ringGlowPulse 4s ease-in-out infinite; transform-origin: 920px 220px; }
  </style>

  <rect width="1200" height="400" fill="url(#cm-bg)"/>

  <!-- Giant Ringed Planet at (920, 220) -->
  <g>
    <!-- Back half of ring -->
    <ellipse cx="920" cy="220" rx="220" ry="45" fill="none" stroke="url(#cm-ring)" stroke-width="12" class="ring-pulse" opacity="0.4"/>
    <!-- Planet Sphere -->
    <circle cx="920" cy="220" r="105" fill="url(#cm-planet)" filter="drop-shadow(0 0 25px rgba(168, 85, 247, 0.6))"/>
    <!-- Front half of ring -->
    <path d="M700,220 A220,45 0 0,0 1140,220" fill="none" stroke="url(#cm-ring)" stroke-width="14" class="ring-pulse"/>
  </g>

  <!-- Meteor Showers Cutting the Atmosphere -->
  <g stroke="#ffffff" stroke-linecap="round" opacity="0.9">
    <line x1="80" y1="20" x2="220" y2="90" stroke-width="2.8" class="m-streak-1" filter="drop-shadow(0 0 8px #fbbf24)"/>
    <line x1="380" y1="10" x2="540" y2="90" stroke-width="2.4" class="m-streak-2" filter="drop-shadow(0 0 8px #38bdf8)"/>
    <line x1="680" y1="30" x2="820" y2="100" stroke-width="3" class="m-streak-3" filter="drop-shadow(0 0 10px #f43f5e)"/>
  </g>

  <!-- Twinkling Sky Nodes -->
  <g fill="#ffffff" opacity="0.75">
    <circle cx="140" cy="90" r="1.5"/><circle cx="280" cy="180" r="1.8"/><circle cx="420" cy="110" r="1.4"/>
    <circle cx="560" cy="260" r="2"/><circle cx="700" cy="130" r="1.6"/><circle cx="840" cy="70" r="2.2"/>
  </g>
</svg>
`;

// =========================================================================
// ROUND 4 NOVO: 8. Portal do Vácuo Quântico (Quantum Portal & Singularity)
// =========================================================================
export const BANNER_PORTAL_ABISSAL_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="pq-bg" cx="50%" cy="50%" r="75%">
      <stop offset="0%" stop-color="#0a1224"/>
      <stop offset="50%" stop-color="#050814"/>
      <stop offset="100%" stop-color="#020308"/>
    </radialGradient>
    <radialGradient id="pq-portal-core" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="25%" stop-color="#38bdf8"/>
      <stop offset="60%" stop-color="#818cf8"/>
      <stop offset="90%" stop-color="#4f46e5"/>
      <stop offset="100%" stop-color="transparent"/>
    </radialGradient>
  </defs>

  <style>
    @keyframes portalSpinClockwise { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    @keyframes portalSpinCounter { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
    @keyframes portalBreath { 0%, 100% { transform: scale(1); opacity: 0.85; filter: drop-shadow(0 0 15px #38bdf8); } 50% { transform: scale(1.18); opacity: 1; filter: drop-shadow(0 0 32px #818cf8); } }
    .portal-cw { animation: portalSpinClockwise 20s linear infinite; transform-origin: 900px 200px; }
    .portal-ccw { animation: portalSpinCounter 14s linear infinite; transform-origin: 900px 200px; }
    .portal-pulse { animation: portalBreath 3s ease-in-out infinite; transform-origin: 900px 200px; }
  </style>

  <rect width="1200" height="400" fill="url(#pq-bg)"/>

  <!-- Portal Inflow Horizon (900, 200) -->
  <g>
    <!-- Outer Inflow Vortex -->
    <g class="portal-cw">
      <ellipse cx="900" cy="200" rx="190" ry="140" stroke="rgba(56, 189, 248, 0.45)" stroke-width="2.5" stroke-dasharray="16,8" fill="none"/>
      <ellipse cx="900" cy="200" rx="160" ry="110" stroke="rgba(129, 140, 248, 0.55)" stroke-width="2" fill="none"/>
    </g>

    <!-- Mid Quantum Ring (CCW) -->
    <g class="portal-ccw">
      <ellipse cx="900" cy="200" rx="130" ry="85" stroke="rgba(192, 132, 252, 0.75)" stroke-width="2.8" stroke-dasharray="10,6" fill="none"/>
      <circle cx="900" cy="115" r="5" fill="#38bdf8"/>
      <circle cx="900" cy="285" r="5" fill="#38bdf8"/>
      <circle cx="770" cy="200" r="5" fill="#c084fc"/>
      <circle cx="1030" cy="200" r="5" fill="#c084fc"/>
    </g>

    <!-- Inner Core Singularity -->
    <ellipse class="portal-pulse" cx="900" cy="200" rx="85" ry="50" fill="url(#pq-portal-core)"/>
  </g>

  <!-- Quantum Grid Lines spreading leftwards -->
  <g stroke="rgba(56, 189, 248, 0.25)" stroke-width="1.2" fill="none">
    <path d="M900,200 L0,80 M900,200 L0,160 M900,200 L0,240 M900,200 L0,320"/>
  </g>
</svg>
`;

// =========================================================================
// ROUND 4 NOVO: 9. Jardim Botânico Astral (Astral Lotus & Bioluminescent Flora)
// =========================================================================
export const BANNER_JARDIM_ASTRAL_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="ja-bg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#08141e"/>
      <stop offset="50%" stop-color="#0d2424"/>
      <stop offset="100%" stop-color="#040c10"/>
    </linearGradient>
    <radialGradient id="ja-lotus-glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#fdf4ff"/>
      <stop offset="35%" stop-color="#f472b6"/>
      <stop offset="70%" stop-color="#2dd4bf"/>
      <stop offset="100%" stop-color="transparent"/>
    </radialGradient>
  </defs>

  <style>
    @keyframes lotusBreatheA { 0%, 100% { transform: scale(1) translateY(0); opacity: 0.85; } 50% { transform: scale(1.1) translateY(-6px); opacity: 1; filter: drop-shadow(0 0 16px #f472b6); } }
    @keyframes pollenDrift { 0% { transform: translate(0, 0); opacity: 0.2; } 50% { opacity: 0.9; } 100% { transform: translate(40px, -50px); opacity: 0; } }
    .lotus-pulse { animation: lotusBreatheA 3.6s ease-in-out infinite; transform-origin: center; }
    .pollen-grp circle { animation: pollenDrift 4.5s linear infinite; }
  </style>

  <rect width="1200" height="400" fill="url(#ja-bg)"/>

  <!-- Bioluminescent Water Surface & Reeds -->
  <path d="M0,350 Q300,320 600,350 T1200,340 L1200,400 L0,400 Z" fill="#031014" stroke="rgba(45, 212, 191, 0.4)" stroke-width="1.5"/>

  <!-- Lotus Flower 1 (Main Right: 880, 260) -->
  <g class="lotus-pulse" transform="translate(880, 260)">
    <ellipse cx="0" cy="15" rx="75" ry="18" fill="rgba(45, 212, 191, 0.35)"/>
    <!-- Lotus Petals Outer -->
    <path d="M0,-50 Q-45,-10 -60,10 Q-30,20 0,20 Q30,20 60,10 Q45,-10 0,-50 Z" fill="url(#ja-lotus-glow)"/>
    <!-- Lotus Core -->
    <circle cx="0" cy="-5" r="14" fill="#fef08a" filter="drop-shadow(0 0 10px #f472b6)"/>
  </g>

  <!-- Lotus Flower 2 (Mid Left: 320, 290) -->
  <g class="lotus-pulse" transform="translate(320, 290) scale(0.75)">
    <ellipse cx="0" cy="15" rx="75" ry="18" fill="rgba(45, 212, 191, 0.35)"/>
    <path d="M0,-50 Q-45,-10 -60,10 Q-30,20 0,20 Q30,20 60,10 Q45,-10 0,-50 Z" fill="url(#ja-lotus-glow)"/>
    <circle cx="0" cy="-5" r="14" fill="#fef08a"/>
  </g>

  <!-- Rising Pollen Motes -->
  <g fill="#67e8f9" class="pollen-grp">
    <circle cx="820" cy="240" r="2.5"/><circle cx="860" cy="210" r="3"/><circle cx="910" cy="230" r="2.8"/>
    <circle cx="950" cy="250" r="2.2"/><circle cx="300" cy="270" r="2.4"/><circle cx="350" cy="250" r="2.8"/>
  </g>
</svg>
`;

// =========================================================================
// ROUND 4 NOVO: 10. Cidadela Flutuante do Nox (Gothic Spire & Celestial Beacons)
// =========================================================================
export const BANNER_CIDADELA_CELESTIAL_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="cc-bg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#120c24"/>
      <stop offset="50%" stop-color="#1d1238"/>
      <stop offset="100%" stop-color="#080412"/>
    </linearGradient>
    <radialGradient id="cc-beacon" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="35%" stop-color="#fbbf24"/>
      <stop offset="80%" stop-color="#c084fc"/>
      <stop offset="100%" stop-color="transparent"/>
    </radialGradient>
  </defs>

  <style>
    @keyframes islandHover { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
    @keyframes beaconBeamSweep { 0%, 100% { opacity: 0.6; transform: rotate(0deg); } 50% { opacity: 0.95; transform: rotate(8deg); } }
    @keyframes cloudDriftSlow { 0%, 100% { transform: translateX(0); opacity: 0.35; } 50% { transform: translateX(25px); opacity: 0.55; } }
    .island-grp { animation: islandHover 5s ease-in-out infinite; }
    .beacon-light { animation: beaconBeamSweep 4s ease-in-out infinite; transform-origin: 850px 110px; }
    .cloud-layer { animation: cloudDriftSlow 8s ease-in-out infinite; }
  </style>

  <rect width="1200" height="400" fill="url(#cc-bg)"/>

  <!-- Celestial Clouds in Midground -->
  <ellipse class="cloud-layer" cx="600" cy="280" rx="550" ry="80" fill="rgba(168, 85, 247, 0.25)" filter="blur(25px)"/>

  <!-- Floating Citadel Spire Island (Center Right: 850) -->
  <g class="island-grp">
    <!-- Beacon Beam -->
    <polygon points="850,110 700,-50 1000,-50" fill="url(#cc-beacon)" class="beacon-light" opacity="0.6"/>

    <!-- Gothic Citadel Architecture Silhouettes -->
    <g fill="#0c071a" stroke="rgba(251, 191, 36, 0.45)" stroke-width="1.4">
      <!-- Main Spire -->
      <polygon points="850,90 865,180 835,180"/>
      <rect x="838" y="180" width="24" height="60"/>
      <!-- Flank Spires -->
      <polygon points="810,130 822,200 798,200"/>
      <polygon points="890,130 902,200 878,200"/>
      <!-- Floating Island Rock Base -->
      <polygon points="770,220 930,220 890,300 850,330 810,290"/>
    </g>

    <!-- Beacon Orb at Spire Apex -->
    <circle cx="850" cy="95" r="7" fill="#fbbf24" filter="drop-shadow(0 0 12px #fbbf24)"/>
  </g>

  <!-- Distant Left Floating Island -->
  <g class="island-grp" style="animation-delay: 2s;">
    <polygon points="320,160 330,220 310,220" fill="#0c071a" stroke="rgba(192, 132, 252, 0.4)" stroke-width="1.2"/>
    <polygon points="290,220 350,220 330,270 310,260" fill="#0c071a" stroke="rgba(192, 132, 252, 0.4)" stroke-width="1.2"/>
  </g>
</svg>
`;

export const CURATED_BANNER_BACKGROUNDS: Record<string, string> = {
  banner_nebulosa_vazio: svgToDataUri(BANNER_NEBULOSA_VAZIO_SVG),
  banner_aurora_astral: svgToDataUri(BANNER_AURORA_ASTRAL_SVG),
  banner_energia_arcana: svgToDataUri(BANNER_ENERGIA_ARCANA_SVG),
  banner_eclipse_cosmico: svgToDataUri(BANNER_ECLIPSE_COSMICO_SVG),
  banner_biblioteca_estrelas: svgToDataUri(BANNER_BIBLIOTECA_ESTRELAS_SVG),
  banner_runas_primordiais: svgToDataUri(BANNER_RUNAS_PRIMORDIAIS_SVG),
  // Round 4 new banners:
  banner_chuva_meteoros: svgToDataUri(BANNER_CHUVA_METEOROS_SVG),
  banner_portal_abissal: svgToDataUri(BANNER_PORTAL_ABISSAL_SVG),
  banner_jardim_astral: svgToDataUri(BANNER_JARDIM_ASTRAL_SVG),
  banner_cidadela_celestial: svgToDataUri(BANNER_CIDADELA_CELESTIAL_SVG)
};
