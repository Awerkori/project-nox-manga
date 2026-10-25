/**
 * High-definition Procedural Cosmic Vector Banners for Project Nox
 * Pure SVG vectors with rich compositions: constellations, eclipses, auroras,
 * arcane glyphs, astrolabes, and spacetime rifts.
 * 100% vector, zero external asset dependencies, zero 404s.
 */

function svgToDataUri(svg: string): string {
  const clean = svg.replace(/\s+/g, ' ').trim();
  return `url("data:image/svg+xml,${encodeURIComponent(clean)}") center/cover no-repeat`;
}

// 1. Nebulosa do Vazio & Constelações
export const BANNER_NEBULOSA_VAZIO_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="nv-bg" cx="50%" cy="50%" r="70%">
      <stop offset="0%" stop-color="#140c2e"/>
      <stop offset="50%" stop-color="#0a0618"/>
      <stop offset="100%" stop-color="#04020a"/>
    </radialGradient>
    <radialGradient id="nv-cloud-1" cx="72%" cy="38%" r="45%">
      <stop offset="0%" stop-color="rgba(168, 85, 247, 0.45)"/>
      <stop offset="50%" stop-color="rgba(139, 92, 246, 0.2)"/>
      <stop offset="100%" stop-color="transparent"/>
    </radialGradient>
    <radialGradient id="nv-cloud-2" cx="28%" cy="65%" r="40%">
      <stop offset="0%" stop-color="rgba(56, 189, 248, 0.35)"/>
      <stop offset="60%" stop-color="rgba(99, 102, 241, 0.15)"/>
      <stop offset="100%" stop-color="transparent"/>
    </radialGradient>
    <radialGradient id="nv-cloud-3" cx="50%" cy="20%" r="35%">
      <stop offset="0%" stop-color="rgba(236, 72, 153, 0.25)"/>
      <stop offset="100%" stop-color="transparent"/>
    </radialGradient>
    <radialGradient id="nv-star-glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="30%" stop-color="rgba(192, 132, 252, 0.8)"/>
      <stop offset="100%" stop-color="transparent"/>
    </radialGradient>
  </defs>

  <rect width="1200" height="400" fill="url(#nv-bg)"/>
  <rect width="1200" height="400" fill="url(#nv-cloud-1)"/>
  <rect width="1200" height="400" fill="url(#nv-cloud-2)"/>
  <rect width="1200" height="400" fill="url(#nv-cloud-3)"/>

  <!-- Distant Starfield -->
  <g fill="#ffffff" opacity="0.55">
    <circle cx="45" cy="82" r="1"/><circle cx="112" cy="240" r="1.2"/><circle cx="178" cy="45" r="0.8"/>
    <circle cx="240" cy="310" r="1.4"/><circle cx="310" cy="180" r="0.9"/><circle cx="390" cy="70" r="1.3"/>
    <circle cx="460" cy="290" r="1"/><circle cx="530" cy="120" r="1.2"/><circle cx="610" cy="260" r="0.9"/>
    <circle cx="680" cy="50" r="1.1"/><circle cx="750" cy="330" r="1.3"/><circle cx="820" cy="110" r="0.8"/>
    <circle cx="890" cy="270" r="1.2"/><circle cx="960" cy="85" r="1.5"/><circle cx="1040" cy="315" r="0.9"/>
    <circle cx="1110" cy="140" r="1.1"/><circle cx="1175" cy="65" r="1.3"/><circle cx="80" cy="150" r="1.2"/>
    <circle cx="150" cy="340" r="0.8"/><circle cx="670" cy="190" r="1.4"/><circle cx="1080" cy="230" r="1"/>
  </g>

  <!-- Constellation 1: Coroa de Nox (Left-Center) -->
  <g>
    <polyline points="140,110 230,160 340,120 420,195 520,135 600,210" 
      stroke="rgba(192, 132, 252, 0.45)" stroke-width="1.5" stroke-dasharray="4,4" fill="none"/>
    <circle cx="140" cy="110" r="2.5" fill="#e9d5ff"/>
    <circle cx="230" cy="160" r="2" fill="#c084fc"/>
    <circle cx="340" cy="120" r="4" fill="url(#nv-star-glow)"/>
    <path d="M340,110 L340,130 M330,120 L350,120" stroke="#ffffff" stroke-width="1.2"/>
    <circle cx="420" cy="195" r="2.5" fill="#e9d5ff"/>
    <circle cx="520" cy="135" r="3" fill="#c084fc"/>
    <circle cx="600" cy="210" r="2.5" fill="#e9d5ff"/>
  </g>

  <!-- Constellation 2: Serpente do Vazio (Right-Center) -->
  <g>
    <polyline points="720,250 810,190 910,225 1000,140 1090,175 1150,115" 
      stroke="rgba(56, 189, 248, 0.45)" stroke-width="1.5" stroke-dasharray="4,4" fill="none"/>
    <circle cx="720" cy="250" r="2.5" fill="#bae6fd"/>
    <circle cx="810" cy="190" r="2" fill="#38bdf8"/>
    <circle cx="910" cy="225" r="2.5" fill="#bae6fd"/>
    <circle cx="1000" cy="140" r="4.5" fill="url(#nv-star-glow)"/>
    <path d="M1000,128 L1000,152 M988,140 L1012,140" stroke="#ffffff" stroke-width="1.2"/>
    <circle cx="1090" cy="175" r="2.5" fill="#38bdf8"/>
    <circle cx="1150" cy="115" r="3" fill="#bae6fd"/>
  </g>
</svg>
`;

// 2. Aurora Astral & Cordilheira Cósmica
export const BANNER_AURORA_ASTRAL_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="aa-bg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#020910"/>
      <stop offset="60%" stop-color="#04181c"/>
      <stop offset="100%" stop-color="#020a0d"/>
    </linearGradient>
    <linearGradient id="aa-wave-1" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="rgba(16, 185, 129, 0)"/>
      <stop offset="25%" stop-color="rgba(16, 185, 129, 0.55)"/>
      <stop offset="50%" stop-color="rgba(6, 182, 212, 0.6)"/>
      <stop offset="75%" stop-color="rgba(52, 211, 153, 0.5)"/>
      <stop offset="100%" stop-color="rgba(6, 182, 212, 0)"/>
    </linearGradient>
    <linearGradient id="aa-wave-2" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="rgba(6, 182, 212, 0)"/>
      <stop offset="30%" stop-color="rgba(56, 189, 248, 0.45)"/>
      <stop offset="60%" stop-color="rgba(139, 92, 246, 0.4)"/>
      <stop offset="90%" stop-color="rgba(16, 185, 129, 0.35)"/>
      <stop offset="100%" stop-color="rgba(139, 92, 246, 0)"/>
    </linearGradient>
  </defs>

  <rect width="1200" height="400" fill="url(#aa-bg)"/>

  <!-- Vertical Light Curtains -->
  <g opacity="0.25">
    <line x1="200" y1="40" x2="200" y2="280" stroke="#34d399" stroke-width="24" filter="blur(6px)"/>
    <line x1="380" y1="20" x2="380" y2="260" stroke="#06b6d4" stroke-width="32" filter="blur(8px)"/>
    <line x1="580" y1="50" x2="580" y2="290" stroke="#10b981" stroke-width="40" filter="blur(10px)"/>
    <line x1="780" y1="30" x2="780" y2="270" stroke="#38bdf8" stroke-width="28" filter="blur(8px)"/>
    <line x1="980" y1="45" x2="980" y2="280" stroke="#8b5cf6" stroke-width="36" filter="blur(8px)"/>
  </g>

  <!-- Aurora Ribbon 1 -->
  <path d="M-50,140 Q250,40 550,120 T1150,60 Q1220,50 1250,80 L1250,330 L-50,330 Z" 
    fill="url(#aa-wave-1)" opacity="0.75"/>

  <!-- Aurora Ribbon 2 -->
  <path d="M-50,180 Q350,80 700,160 T1250,100 L1250,350 L-50,350 Z" 
    fill="url(#aa-wave-2)" opacity="0.65"/>

  <!-- Starfield shining through aurora -->
  <g fill="#ffffff" opacity="0.65">
    <circle cx="90" cy="50" r="1.2"/><circle cx="180" cy="90" r="1"/><circle cx="280" cy="40" r="1.5"/>
    <circle cx="370" cy="110" r="0.9"/><circle cx="480" cy="65" r="1.3"/><circle cx="620" cy="35" r="1.6"/>
    <circle cx="740" cy="95" r="1.1"/><circle cx="860" cy="45" r="1.4"/><circle cx="990" cy="80" r="1.2"/>
    <circle cx="1110" cy="30" r="1.5"/><circle cx="1160" cy="115" r="1"/>
  </g>

  <!-- Mountain Silhouette at Bottom -->
  <polygon points="-50,400 -50,340 80,315 210,345 350,295 480,340 640,285 790,335 940,305 1070,345 1250,310 1250,400" 
    fill="#02070a"/>
  <!-- Mountain Rim Starlight Highlight -->
  <polyline points="-50,340 80,315 210,345 350,295 480,340 640,285 790,335 940,305 1070,345 1250,310" 
    stroke="rgba(52, 211, 153, 0.35)" stroke-width="1.2" fill="none"/>
</svg>
`;

// 3. Energia Arcana & Círculo Rúnico
export const BANNER_ENERGIA_ARCANA_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="ea-bg" cx="50%" cy="50%" r="70%">
      <stop offset="0%" stop-color="#160c2e"/>
      <stop offset="60%" stop-color="#0a0518"/>
      <stop offset="100%" stop-color="#04020a"/>
    </radialGradient>
    <radialGradient id="ea-vortex" cx="82%" cy="50%" r="55%">
      <stop offset="0%" stop-color="rgba(192, 132, 252, 0.45)"/>
      <stop offset="40%" stop-color="rgba(147, 51, 234, 0.25)"/>
      <stop offset="100%" stop-color="transparent"/>
    </radialGradient>
  </defs>

  <rect width="1200" height="400" fill="url(#ea-bg)"/>
  <rect width="1200" height="400" fill="url(#ea-vortex)"/>

  <!-- Energy Wave Filaments flowing from right to left -->
  <g fill="none" opacity="0.45">
    <path d="M1200,200 C900,160 700,240 400,180 T0,220" stroke="#c084fc" stroke-width="2"/>
    <path d="M1200,180 C850,220 650,140 350,210 T0,170" stroke="#818cf8" stroke-width="1.5"/>
    <path d="M1200,220 C950,140 750,260 500,190 T0,240" stroke="#e879f9" stroke-width="1.2"/>
  </g>

  <!-- Arcane Magic Circle / Astrolabe at (980, 200) -->
  <g transform="translate(980, 200)">
    <!-- Outer Rune Ring -->
    <circle cx="0" cy="0" r="160" stroke="rgba(192, 132, 252, 0.45)" stroke-width="2" stroke-dasharray="10,6" fill="none"/>
    <circle cx="0" cy="0" r="148" stroke="rgba(168, 85, 247, 0.35)" stroke-width="1" fill="none"/>
    <!-- Middle Glyphic Ring -->
    <circle cx="0" cy="0" r="125" stroke="rgba(232, 121, 249, 0.5)" stroke-width="2.5" fill="none"/>
    <!-- 8 Cardinal Nodes -->
    <circle cx="0" cy="-125" r="4.5" fill="#f0abfc"/>
    <circle cx="0" cy="125" r="4.5" fill="#f0abfc"/>
    <circle cx="-125" cy="0" r="4.5" fill="#f0abfc"/>
    <circle cx="125" cy="0" r="4.5" fill="#f0abfc"/>
    <circle cx="-88" cy="-88" r="3.5" fill="#c084fc"/>
    <circle cx="88" cy="-88" r="3.5" fill="#c084fc"/>
    <circle cx="-88" cy="88" r="3.5" fill="#c084fc"/>
    <circle cx="88" cy="88" r="3.5" fill="#c084fc"/>
    <!-- Interlocking Sacred Triangles / Hexagram -->
    <polygon points="0,-100 86.6,50 -86.6,50" stroke="rgba(192, 132, 252, 0.55)" stroke-width="1.5" fill="none"/>
    <polygon points="0,100 86.6,-50 -86.6,-50" stroke="rgba(192, 132, 252, 0.55)" stroke-width="1.5" fill="none"/>
    <!-- Inner Core Orb -->
    <circle cx="0" cy="0" r="40" stroke="rgba(240, 171, 252, 0.7)" stroke-width="2" fill="none"/>
    <circle cx="0" cy="0" r="18" fill="rgba(240, 171, 252, 0.8)"/>
  </g>

  <!-- Floating Arcane Particles -->
  <g fill="#f0abfc" opacity="0.65">
    <circle cx="840" cy="120" r="2.5"/><circle cx="780" cy="270" r="2"/><circle cx="680" cy="150" r="3"/>
    <circle cx="560" cy="240" r="1.8"/><circle cx="450" cy="110" r="2.2"/><circle cx="320" cy="260" r="1.5"/>
    <circle cx="210" cy="140" r="2.5"/><circle cx="95" cy="230" r="1.8"/>
  </g>
</svg>
`;

// 4. Eclipse Cósmico & Corona Solar
export const BANNER_ECLIPSE_COSMICO_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="ec-bg" cx="50%" cy="50%" r="70%">
      <stop offset="0%" stop-color="#1c050a"/>
      <stop offset="60%" stop-color="#0a0204"/>
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
      <stop offset="70%" stop-color="rgba(249, 115, 22, 0.4)"/>
      <stop offset="100%" stop-color="transparent"/>
    </radialGradient>
  </defs>

  <rect width="1200" height="400" fill="url(#ec-bg)"/>

  <!-- Crimson Cosmic Dust Cloud -->
  <ellipse cx="800" cy="180" rx="420" ry="240" fill="rgba(220, 38, 38, 0.18)" filter="blur(20px)"/>

  <!-- Solar Eclipse Corona Burst -->
  <circle cx="820" cy="180" r="190" fill="url(#ec-corona)" opacity="0.95"/>

  <!-- Coronal Prominence Streamers -->
  <g stroke="rgba(251, 191, 36, 0.65)" stroke-width="2" fill="none">
    <path d="M820,180 L820,0 M820,180 L820,360"/>
    <path d="M820,180 L640,60 M820,180 L1000,300"/>
    <path d="M820,180 L640,300 M820,180 L1000,60"/>
    <path d="M820,180 L620,180 M820,180 L1020,180"/>
  </g>

  <!-- Total Dark Moon Silhouette -->
  <circle cx="820" cy="180" r="115" fill="#090104"/>

  <!-- Diamond Flare on Eclipse Rim (Upper Left) -->
  <g transform="translate(740, 100)">
    <circle cx="0" cy="0" r="32" fill="url(#ec-flare)"/>
    <path d="M0,-40 L0,40 M-40,0 L40,0" stroke="#ffffff" stroke-width="2"/>
    <circle cx="0" cy="0" r="6" fill="#ffffff"/>
  </g>

  <!-- Drifting Embers & Starfield -->
  <g fill="#fca5a5" opacity="0.6">
    <circle cx="120" cy="80" r="1.2"/><circle cx="210" cy="220" r="1.5"/><circle cx="340" cy="130" r="1"/>
    <circle cx="450" cy="270" r="1.8"/><circle cx="560" cy="90" r="1.3"/><circle cx="670" cy="310" r="2"/>
    <circle cx="1020" cy="95" r="1.4"/><circle cx="1120" cy="250" r="1.6"/>
  </g>
</svg>
`;

// 5. Biblioteca das Estrelas & Astrolábio Dourado
export const BANNER_BIBLIOTECA_ESTRELAS_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="be-bg" cx="50%" cy="50%" r="70%">
      <stop offset="0%" stop-color="#121829"/>
      <stop offset="60%" stop-color="#0a0d18"/>
      <stop offset="100%" stop-color="#03050a"/>
    </radialGradient>
    <radialGradient id="be-gold-glow" cx="50%" cy="30%" r="60%">
      <stop offset="0%" stop-color="rgba(251, 191, 36, 0.3)"/>
      <stop offset="50%" stop-color="rgba(217, 119, 6, 0.15)"/>
      <stop offset="100%" stop-color="transparent"/>
    </radialGradient>
  </defs>

  <rect width="1200" height="400" fill="url(#be-bg)"/>
  <rect width="1200" height="400" fill="url(#be-gold-glow)"/>

  <!-- Celestial Astrolabe Coordinates & Armillary Arcs -->
  <g stroke="rgba(251, 191, 36, 0.35)" fill="none" stroke-width="1.2">
    <!-- Big Armillary Ring -->
    <circle cx="600" cy="200" r="180" stroke-dasharray="6,4"/>
    <circle cx="600" cy="200" r="170"/>
    <circle cx="600" cy="200" r="120" stroke-dasharray="3,3"/>
    <!-- Coordinate Longitudes -->
    <ellipse cx="600" cy="200" rx="180" ry="70"/>
    <ellipse cx="600" cy="200" rx="180" ry="130"/>
    <line x1="600" y1="20" x2="600" y2="380" stroke-dasharray="4,4"/>
    <line x1="420" y1="200" x2="780" y2="200" stroke-dasharray="4,4"/>
  </g>

  <!-- Architectural Columns / Arches Silhouettes on Flanks -->
  <g fill="rgba(8, 14, 26, 0.85)" stroke="rgba(251, 191, 36, 0.25)" stroke-width="1">
    <path d="M0,0 L140,0 L140,400 L0,400 Z"/>
    <path d="M140,0 Q180,100 180,400 L140,400 Z"/>
    <path d="M1200,0 L1060,0 L1060,400 L1200,400 Z"/>
    <path d="M1060,0 Q1020,100 1020,400 L1060,400 Z"/>
  </g>

  <!-- Golden Constellation Nodes -->
  <g fill="#fde68a" stroke="#fbbf24" stroke-width="1">
    <circle cx="600" cy="30" r="4"/><circle cx="600" cy="370" r="4"/>
    <circle cx="430" cy="200" r="4"/><circle cx="770" cy="200" r="4"/>
    <circle cx="480" cy="110" r="3"/><circle cx="720" cy="110" r="3"/>
    <circle cx="480" cy="290" r="3"/><circle cx="720" cy="290" r="3"/>
  </g>

  <!-- Starlight Flare in Astrolabe Center -->
  <g transform="translate(600, 200)">
    <circle cx="0" cy="0" r="12" fill="#fef08a"/>
    <path d="M0,-24 L0,24 M-24,0 L24,0" stroke="#fbbf24" stroke-width="1.8"/>
  </g>

  <!-- Golden Floating Star Dust -->
  <g fill="#fde68a" opacity="0.6">
    <circle cx="260" cy="90" r="1.5"/><circle cx="340" cy="280" r="1.8"/><circle cx="860" cy="120" r="1.5"/>
    <circle cx="940" cy="290" r="2"/><circle cx="520" cy="70" r="1.2"/><circle cx="680" cy="330" r="1.4"/>
  </g>
</svg>
`;

// 6. Fenda Rúnica & Abismo Dimensional
export const BANNER_RUNAS_PRIMORDIAIS_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="rp-bg" cx="50%" cy="50%" r="70%">
      <stop offset="0%" stop-color="#100320"/>
      <stop offset="60%" stop-color="#05010c"/>
      <stop offset="100%" stop-color="#020005"/>
    </radialGradient>
    <linearGradient id="rp-rift-core" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#06b6d4"/>
      <stop offset="35%" stop-color="#ffffff"/>
      <stop offset="70%" stop-color="#d946ef"/>
      <stop offset="100%" stop-color="#06b6d4"/>
    </linearGradient>
  </defs>

  <rect width="1200" height="400" fill="url(#rp-bg)"/>

  <!-- Distortion Ambient Glow -->
  <ellipse cx="600" cy="200" rx="550" ry="180" fill="rgba(217, 70, 239, 0.18)" filter="blur(30px)" transform="rotate(-12 600 200)"/>
  <ellipse cx="600" cy="200" rx="450" ry="100" fill="rgba(6, 182, 212, 0.22)" filter="blur(20px)" transform="rotate(-12 600 200)"/>

  <!-- Spacetime Gravitational Rings -->
  <g stroke="rgba(6, 182, 212, 0.35)" stroke-width="1.5" fill="none" stroke-dasharray="8,6" transform="rotate(-12 600 200)">
    <ellipse cx="600" cy="200" rx="350" ry="70"/>
    <ellipse cx="600" cy="200" rx="240" ry="45"/>
    <ellipse cx="600" cy="200" rx="140" ry="25"/>
  </g>

  <!-- Jagged Spacetime Fracture Core -->
  <path d="M120,-30 L280,70 L340,55 L480,160 L540,140 L700,230 L760,215 L920,320 L1010,295 L1120,430" 
    stroke="url(#rp-rift-core)" stroke-width="5" fill="none" stroke-linecap="round"/>
  <path d="M120,-30 L280,70 L340,55 L480,160 L540,140 L700,230 L760,215 L920,320 L1010,295 L1120,430" 
    stroke="#ffffff" stroke-width="2" fill="none" stroke-linecap="round"/>

  <!-- Secondary Fractures -->
  <path d="M340,55 L390,20 M700,230 L660,290 M920,320 L960,370" 
    stroke="rgba(217, 70, 239, 0.7)" stroke-width="1.8" fill="none"/>

  <!-- Floating Primordial Runic Monoliths -->
  <g fill="rgba(15, 6, 30, 0.9)" stroke="rgba(6, 182, 212, 0.65)" stroke-width="1.5">
    <!-- Shard 1 -->
    <polygon points="260,180 290,160 300,220 270,240"/>
    <line x1="280" y1="180" x2="285" y2="220" stroke="#67e8f9" stroke-width="1.2"/>
    <!-- Shard 2 -->
    <polygon points="450,280 480,260 490,320 460,335"/>
    <line x1="470" y1="275" x2="475" y2="315" stroke="#f0abfc" stroke-width="1.2"/>
    <!-- Shard 3 -->
    <polygon points="840,90 870,75 880,135 850,150"/>
    <line x1="860" y1="90" x2="865" y2="130" stroke="#67e8f9" stroke-width="1.2"/>
  </g>

  <!-- Swirling Vortex Particles -->
  <g fill="#67e8f9" opacity="0.75">
    <circle cx="210" cy="110" r="2.5"/><circle cx="380" cy="190" r="3"/><circle cx="580" cy="170" r="3.5"/>
    <circle cx="650" cy="260" r="2.8"/><circle cx="800" cy="210" r="3.2"/><circle cx="950" cy="270" r="2.2"/>
    <circle cx="1060" cy="360" r="2.8"/>
  </g>
</svg>
`;

export const CURATED_BANNER_BACKGROUNDS: Record<string, string> = {
  banner_nebulosa_vazio: svgToDataUri(BANNER_NEBULOSA_VAZIO_SVG),
  banner_aurora_astral: svgToDataUri(BANNER_AURORA_ASTRAL_SVG),
  banner_energia_arcana: svgToDataUri(BANNER_ENERGIA_ARCANA_SVG),
  banner_eclipse_cosmico: svgToDataUri(BANNER_ECLIPSE_COSMICO_SVG),
  banner_biblioteca_estrelas: svgToDataUri(BANNER_BIBLIOTECA_ESTRELAS_SVG),
  banner_runas_primordiais: svgToDataUri(BANNER_RUNAS_PRIMORDIAIS_SVG)
};
