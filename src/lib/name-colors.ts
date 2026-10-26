/**
 * src/lib/name-colors.ts
 * Type definitions, registry, and resolution helper for Project Nox Animated Name Colors.
 * 10 distinct, visible animation engines across exactly 50 curated name colors.
 */

export interface NameColorConfig {
  id: string;
  name: string;
  animClass: string;
  inlineStyle: string;
  isGradient: boolean;
  rawColor?: string;
}

export const NAME_COLOR_REGISTRY: Record<string, NameColorConfig> = {
  // 1. Dynamic Gradient Flow (5 items)
  color_twilight_gradient: {
    id: 'color_twilight_gradient',
    name: 'Crepúsculo Cósmico',
    animClass: 'nox-anim-grad-flow',
    inlineStyle: 'background-image: linear-gradient(135deg, #a855f7, #ec4899, #3b82f6);',
    isGradient: true
  },
  color_nebula_dream: {
    id: 'color_nebula_dream',
    name: 'Sonho de Nebulosa',
    animClass: 'nox-anim-grad-flow',
    inlineStyle: 'background-image: linear-gradient(135deg, #ec4899, #8b5cf6, #06b6d4);',
    isGradient: true
  },
  color_cosmic_prism: {
    id: 'color_cosmic_prism',
    name: 'Prisma Cósmico',
    animClass: 'nox-anim-grad-flow',
    inlineStyle: 'background-image: linear-gradient(135deg, #f43f5e, #fbbf24, #10b981, #3b82f6);',
    isGradient: true
  },
  color_celestial_dawn: {
    id: 'color_celestial_dawn',
    name: 'Alvorada Celestial',
    animClass: 'nox-anim-grad-flow',
    inlineStyle: 'background-image: linear-gradient(135deg, #fbbf24, #f43f5e, #c084fc);',
    isGradient: true
  },
  color_quantum_flux: {
    id: 'color_quantum_flux',
    name: 'Fluxo Quântico',
    animClass: 'nox-anim-grad-flow',
    inlineStyle: 'background-image: linear-gradient(135deg, #06b6d4, #8b5cf6, #f43f5e);',
    isGradient: true
  },

  // 2. Shifting Angle Gradient (5 items)
  color_spectral_aurora: {
    id: 'color_spectral_aurora',
    name: 'Aurora Espectral',
    animClass: 'nox-anim-grad-shift',
    inlineStyle: 'background-image: linear-gradient(45deg, #10b981, #06b6d4, #8b5cf6);',
    isGradient: true
  },
  color_cyberpunk_neon: {
    id: 'color_cyberpunk_neon',
    name: 'Neon Cyberpunk',
    animClass: 'nox-anim-grad-shift',
    inlineStyle: 'background-image: linear-gradient(45deg, #f43f5e, #06b6d4, #a855f7);',
    isGradient: true
  },
  color_mystic_emerald_stream: {
    id: 'color_mystic_emerald_stream',
    name: 'Corrente Esmeralda',
    animClass: 'nox-anim-grad-shift',
    inlineStyle: 'background-image: linear-gradient(45deg, #10b981, #34d399, #059669);',
    isGradient: true
  },
  color_hologram_matrix: {
    id: 'color_hologram_matrix',
    name: 'Matriz Holográfica',
    animClass: 'nox-anim-grad-shift',
    inlineStyle: 'background-image: linear-gradient(45deg, #06b6d4, #3b82f6, #6366f1);',
    isGradient: true
  },
  color_oceanic_pearl: {
    id: 'color_oceanic_pearl',
    name: 'Pérola Oceânica',
    animClass: 'nox-anim-grad-shift',
    inlineStyle: 'background-image: linear-gradient(45deg, #38bdf8, #818cf8, #c084fc);',
    isGradient: true
  },

  // 3. Radiant Shimmer Beam (5 items)
  color_pure_starlight: {
    id: 'color_pure_starlight',
    name: 'Branco Estelar Puro',
    animClass: 'nox-anim-shimmer',
    inlineStyle: 'background-image: linear-gradient(90deg, #94a3b8 0%, #ffffff 35%, #38bdf8 50%, #ffffff 65%, #94a3b8 100%);',
    isGradient: true
  },
  color_lunar_silver: {
    id: 'color_lunar_silver',
    name: 'Prata Lunar',
    animClass: 'nox-anim-shimmer',
    inlineStyle: 'background-image: linear-gradient(90deg, #64748b 0%, #e2e8f0 35%, #ffffff 50%, #e2e8f0 65%, #64748b 100%);',
    isGradient: true
  },
  color_diamond_sparkle: {
    id: 'color_diamond_sparkle',
    name: 'Brilho de Diamante',
    animClass: 'nox-anim-shimmer',
    inlineStyle: 'background-image: linear-gradient(90deg, #93c5fd 0%, #ffffff 35%, #bfdbfe 50%, #ffffff 65%, #93c5fd 100%);',
    isGradient: true
  },
  color_starlight_gold: {
    id: 'color_starlight_gold',
    name: 'Ouro Estelar',
    animClass: 'nox-anim-shimmer',
    inlineStyle: 'background-image: linear-gradient(90deg, #d97706 0%, #fbbf24 35%, #ffffff 50%, #fbbf24 65%, #d97706 100%);',
    isGradient: true
  },
  color_cosmic_comet: {
    id: 'color_cosmic_comet',
    name: 'Cometa Cósmico',
    animClass: 'nox-anim-shimmer',
    inlineStyle: 'background-image: linear-gradient(90deg, #0284c7 0%, #38bdf8 35%, #ffffff 50%, #38bdf8 65%, #0284c7 100%);',
    isGradient: true
  },

  // 4. Deep Luminous Aura Breathing (5 items)
  color_cosmic_violet: {
    id: 'color_cosmic_violet',
    name: 'Violeta Cósmico',
    animClass: 'nox-anim-glow-breathe',
    inlineStyle: 'color: #c084fc; text-shadow: 0 0 10px rgba(192, 132, 252, 0.85);',
    isGradient: false,
    rawColor: '#c084fc'
  },
  color_sapphire_blue: {
    id: 'color_sapphire_blue',
    name: 'Azul Safira',
    animClass: 'nox-anim-glow-breathe',
    inlineStyle: 'color: #60a5fa; text-shadow: 0 0 10px rgba(96, 165, 250, 0.85);',
    isGradient: false,
    rawColor: '#60a5fa'
  },
  color_amethyst_radiant: {
    id: 'color_amethyst_radiant',
    name: 'Ametista Radiante',
    animClass: 'nox-anim-glow-breathe',
    inlineStyle: 'color: #d8b4fe; text-shadow: 0 0 10px rgba(216, 180, 254, 0.85);',
    isGradient: false,
    rawColor: '#d8b4fe'
  },
  color_stellar_lapis: {
    id: 'color_stellar_lapis',
    name: 'Lápis-lazúli Estelar',
    animClass: 'nox-anim-glow-breathe',
    inlineStyle: 'color: #818cf8; text-shadow: 0 0 10px rgba(129, 140, 248, 0.85);',
    isGradient: false,
    rawColor: '#818cf8'
  },
  color_ethereal_turquoise: {
    id: 'color_ethereal_turquoise',
    name: 'Turquesa Etéreo',
    animClass: 'nox-anim-glow-breathe',
    inlineStyle: 'color: #2dd4bf; text-shadow: 0 0 10px rgba(45, 212, 191, 0.85);',
    isGradient: false,
    rawColor: '#2dd4bf'
  },

  // 5. Incandescent Flame Heatwave (5 items)
  color_phoenix_blaze: {
    id: 'color_phoenix_blaze',
    name: 'Labareda da Fênix',
    animClass: 'nox-anim-flame',
    inlineStyle: 'color: #f97316; text-shadow: 0 0 12px rgba(249, 115, 22, 0.9);',
    isGradient: false,
    rawColor: '#f97316'
  },
  color_blazing_orange: {
    id: 'color_blazing_orange',
    name: 'Laranja Flamejante',
    animClass: 'nox-anim-flame',
    inlineStyle: 'color: #fb923c; text-shadow: 0 0 10px rgba(251, 146, 60, 0.85);',
    isGradient: false,
    rawColor: '#fb923c'
  },
  color_dragon_fire: {
    id: 'color_dragon_fire',
    name: 'Fogo de Dragão',
    animClass: 'nox-anim-flame',
    inlineStyle: 'color: #ef4444; text-shadow: 0 0 12px rgba(239, 68, 68, 0.9);',
    isGradient: false,
    rawColor: '#ef4444'
  },
  color_infernal_sulfur: {
    id: 'color_infernal_sulfur',
    name: 'Enxofre Infernal',
    animClass: 'nox-anim-flame',
    inlineStyle: 'color: #f59e0b; text-shadow: 0 0 10px rgba(245, 158, 11, 0.85);',
    isGradient: false,
    rawColor: '#f59e0b'
  },
  color_blood_moon: {
    id: 'color_blood_moon',
    name: 'Lua de Sangue',
    animClass: 'nox-anim-flame',
    inlineStyle: 'color: #dc2626; text-shadow: 0 0 12px rgba(220, 38, 38, 0.9);',
    isGradient: false,
    rawColor: '#dc2626'
  },

  // 6. Electric Plasma Crepitation (5 items)
  color_neon_cyan: {
    id: 'color_neon_cyan',
    name: 'Ciano Neon',
    animClass: 'nox-anim-plasma',
    inlineStyle: 'color: #38bdf8; text-shadow: 0 0 12px rgba(56, 189, 248, 0.9);',
    isGradient: false,
    rawColor: '#38bdf8'
  },
  color_toxic_neon_green: {
    id: 'color_toxic_neon_green',
    name: 'Verde Neon Tóxico',
    animClass: 'nox-anim-plasma',
    inlineStyle: 'color: #4ade80; text-shadow: 0 0 12px rgba(74, 222, 128, 0.9);',
    isGradient: false,
    rawColor: '#4ade80'
  },
  color_cyber_acid_green: {
    id: 'color_cyber_acid_green',
    name: 'Verde Ácido Cibernético',
    animClass: 'nox-anim-plasma',
    inlineStyle: 'color: #a3e635; text-shadow: 0 0 12px rgba(163, 230, 53, 0.9);',
    isGradient: false,
    rawColor: '#a3e635'
  },
  color_plasma_storm: {
    id: 'color_plasma_storm',
    name: 'Tempestade de Plasma',
    animClass: 'nox-anim-plasma',
    inlineStyle: 'color: #06b6d4; text-shadow: 0 0 12px rgba(6, 182, 212, 0.9);',
    isGradient: false,
    rawColor: '#06b6d4'
  },
  color_electric_violet: {
    id: 'color_electric_violet',
    name: 'Violeta Elétrico',
    animClass: 'nox-anim-plasma',
    inlineStyle: 'color: #a855f7; text-shadow: 0 0 12px rgba(168, 85, 247, 0.9);',
    isGradient: false,
    rawColor: '#a855f7'
  },

  // 7. Spectral Chromatic Rotation (5 items)
  color_solar_gold: {
    id: 'color_solar_gold',
    name: 'Ouro Solar',
    animClass: 'nox-anim-chroma',
    inlineStyle: 'color: #fde047; text-shadow: 0 0 10px rgba(253, 224, 71, 0.85);',
    isGradient: false,
    rawColor: '#fde047'
  },
  color_imperial_gold: {
    id: 'color_imperial_gold',
    name: 'Ouro Imperial',
    animClass: 'nox-anim-chroma',
    inlineStyle: 'color: #fbbf24; text-shadow: 0 0 10px rgba(251, 191, 36, 0.85);',
    isGradient: false,
    rawColor: '#fbbf24'
  },
  color_radiant_coral: {
    id: 'color_radiant_coral',
    name: 'Coral Radiante',
    animClass: 'nox-anim-chroma',
    inlineStyle: 'color: #fb7185; text-shadow: 0 0 10px rgba(251, 113, 133, 0.85);',
    isGradient: false,
    rawColor: '#fb7185'
  },
  color_valkyrie_wings: {
    id: 'color_valkyrie_wings',
    name: 'Asas da Valquíria',
    animClass: 'nox-anim-chroma',
    inlineStyle: 'color: #f472b6; text-shadow: 0 0 10px rgba(244, 114, 182, 0.85);',
    isGradient: false,
    rawColor: '#f472b6'
  },
  color_supreme_sovereign: {
    id: 'color_supreme_sovereign',
    name: 'Soberano Supremo',
    animClass: 'nox-anim-chroma',
    inlineStyle: 'color: #eab308; text-shadow: 0 0 14px rgba(234, 179, 8, 0.95);',
    isGradient: false,
    rawColor: '#eab308'
  },

  // 8. Star Twinkle (5 items)
  color_emerald_arcane: {
    id: 'color_emerald_arcane',
    name: 'Esmeralda Arcana',
    animClass: 'nox-anim-twinkle',
    inlineStyle: 'color: #34d399; text-shadow: 0 0 10px rgba(52, 211, 153, 0.85);',
    isGradient: false,
    rawColor: '#34d399'
  },
  color_glacial_turquoise: {
    id: 'color_glacial_turquoise',
    name: 'Turquesa Glacial',
    animClass: 'nox-anim-twinkle',
    inlineStyle: 'color: #22d3ee; text-shadow: 0 0 10px rgba(34, 211, 238, 0.85);',
    isGradient: false,
    rawColor: '#22d3ee'
  },
  color_cosmic_pink: {
    id: 'color_cosmic_pink',
    name: 'Rosa Cósmico',
    animClass: 'nox-anim-twinkle',
    inlineStyle: 'color: #f472b6; text-shadow: 0 0 10px rgba(244, 114, 182, 0.85);',
    isGradient: false,
    rawColor: '#f472b6'
  },
  color_supergiant_star: {
    id: 'color_supergiant_star',
    name: 'Estrela Supergigante',
    animClass: 'nox-anim-twinkle',
    inlineStyle: 'color: #f87171; text-shadow: 0 0 10px rgba(248, 113, 113, 0.85);',
    isGradient: false,
    rawColor: '#f87171'
  },
  color_sakura_petal: {
    id: 'color_sakura_petal',
    name: 'Pétala de Sakura',
    animClass: 'nox-anim-twinkle',
    inlineStyle: 'color: #fda4af; text-shadow: 0 0 10px rgba(253, 164, 175, 0.85);',
    isGradient: false,
    rawColor: '#fda4af'
  },

  // 9. Void Dark Matter Inversion (5 items)
  color_galactic_abyss: {
    id: 'color_galactic_abyss',
    name: 'Abismo Galáctico',
    animClass: 'nox-anim-abyss',
    inlineStyle: 'color: #818cf8; text-shadow: 0 0 12px rgba(129, 140, 248, 0.9);',
    isGradient: false,
    rawColor: '#818cf8'
  },
  color_void_singularity: {
    id: 'color_void_singularity',
    name: 'Singularidade do Vazio',
    animClass: 'nox-anim-abyss',
    inlineStyle: 'color: #a78bfa; text-shadow: 0 0 12px rgba(167, 139, 250, 0.9);',
    isGradient: false,
    rawColor: '#a78bfa'
  },
  color_abyssal_deep: {
    id: 'color_abyssal_deep',
    name: 'Profundeza Abissal',
    animClass: 'nox-anim-abyss',
    inlineStyle: 'color: #38bdf8; text-shadow: 0 0 12px rgba(56, 189, 248, 0.9);',
    isGradient: false,
    rawColor: '#38bdf8'
  },
  color_dark_matter: {
    id: 'color_dark_matter',
    name: 'Matéria Escura',
    animClass: 'nox-anim-abyss',
    inlineStyle: 'color: #c084fc; text-shadow: 0 0 12px rgba(192, 132, 252, 0.9);',
    isGradient: false,
    rawColor: '#c084fc'
  },
  color_crimson_red: {
    id: 'color_crimson_red',
    name: 'Carmesim Sombrio',
    animClass: 'nox-anim-abyss',
    inlineStyle: 'color: #ef4444; text-shadow: 0 0 12px rgba(239, 68, 68, 0.9);',
    isGradient: false,
    rawColor: '#ef4444'
  },

  // 10. Supernova Flare Surge (5 items)
  color_golden_supernova: {
    id: 'color_golden_supernova',
    name: 'Supernova Dourada',
    animClass: 'nox-anim-supernova',
    inlineStyle: 'color: #f59e0b; text-shadow: 0 0 14px rgba(245, 158, 11, 0.9);',
    isGradient: false,
    rawColor: '#f59e0b'
  },
  color_solar_eclipse: {
    id: 'color_solar_eclipse',
    name: 'Eclipse Solar',
    animClass: 'nox-anim-supernova',
    inlineStyle: 'color: #ea580c; text-shadow: 0 0 12px rgba(234, 88, 12, 0.9);',
    isGradient: false,
    rawColor: '#ea580c'
  },
  color_chrono_amber: {
    id: 'color_chrono_amber',
    name: 'Âmbar do Tempo',
    animClass: 'nox-anim-supernova',
    inlineStyle: 'color: #d97706; text-shadow: 0 0 12px rgba(217, 119, 6, 0.9);',
    isGradient: false,
    rawColor: '#d97706'
  },
  color_arcane_runes: {
    id: 'color_arcane_runes',
    name: 'Runas Arcanas',
    animClass: 'nox-anim-supernova',
    inlineStyle: 'color: #e11d48; text-shadow: 0 0 12px rgba(225, 29, 72, 0.9);',
    isGradient: false,
    rawColor: '#e11d48'
  },
  color_blood_ruby: {
    id: 'color_blood_ruby',
    name: 'Rubi de Sangue',
    animClass: 'nox-anim-supernova',
    inlineStyle: 'color: #b91c1c; text-shadow: 0 0 14px rgba(185, 28, 28, 0.95);',
    isGradient: false,
    rawColor: '#b91c1c'
  }
};

/**
 * Resolves animation class and CSS styling for any name color ID or raw color value.
 */
export function getNameColorInfo(idOrValue: string | null | undefined): {
  className: string;
  style: string;
  isAnimated: boolean;
  rawColor: string | null;
} {
  if (!idOrValue) {
    return { className: '', style: '', isAnimated: false, rawColor: null };
  }

  const trimmed = idOrValue.trim();

  // 1. Direct registry lookup by catalog ID
  if (NAME_COLOR_REGISTRY[trimmed]) {
    const config = NAME_COLOR_REGISTRY[trimmed];
    return {
      className: config.animClass,
      style: config.inlineStyle,
      isAnimated: true,
      rawColor: config.rawColor || null
    };
  }

  // 2. Linear gradient raw value
  if (trimmed.includes('gradient')) {
    return {
      className: 'nox-anim-grad-flow',
      style: `background-image: ${trimmed};`,
      isAnimated: true,
      rawColor: null
    };
  }

  // 3. Hex code or rgb/hsl color string (legacy or direct color values)
  if (trimmed.startsWith('#') || trimmed.startsWith('rgb') || trimmed.startsWith('hsl')) {
    return {
      className: 'nox-anim-glow-breathe',
      style: `color: ${trimmed}; text-shadow: 0 0 10px ${trimmed};`,
      isAnimated: true,
      rawColor: trimmed
    };
  }

  return { className: '', style: '', isAnimated: false, rawColor: null };
}
