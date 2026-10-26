/**
 * src/lib/name-colors.ts
 * Curated registry and resolver for Project Nox 50 Name Colors.
 *
 * Distributed across:
 * - 15 Static Nobles & Luxury Gradients (Completely static, crisp, no motion)
 * - 7 Smooth Gradient Waves (nox-anim-grad-flow)
 * - 7 Metallic Shimmer Beams (nox-anim-shimmer)
 * - 7 Holographic Iridescence (nox-anim-hologram)
 * - 7 Localized Traveling Glints (nox-anim-glint)
 * - 7 Diagonal Angular Drifts (nox-anim-grad-shift)
 */

export interface NameColorConfig {
  id: string;
  name: string;
  animClass: string;
  inlineStyle: string;
  isAnimated: boolean;
  isGradient: boolean;
  rawColor?: string;
}

export const NAME_COLOR_REGISTRY: Record<string, NameColorConfig> = {
  // =========================================================================
  // GROUP 1: 15 CORES ESTÁTICAS ELEGANTES (Zero movimento, foco em tipografia)
  // =========================================================================
  color_pure_starlight: {
    id: 'color_pure_starlight',
    name: 'Branco Estelar Puro',
    animClass: 'nox-color-static',
    inlineStyle: 'color: #ffffff; text-shadow: 0 0 8px rgba(255, 255, 255, 0.45);',
    isAnimated: false,
    isGradient: false,
    rawColor: '#ffffff'
  },
  color_lunar_silver: {
    id: 'color_lunar_silver',
    name: 'Prata Lunar',
    animClass: 'nox-color-static',
    inlineStyle: 'color: #e2e8f0; text-shadow: 0 0 8px rgba(226, 232, 240, 0.4);',
    isAnimated: false,
    isGradient: false,
    rawColor: '#e2e8f0'
  },
  color_cosmic_violet: {
    id: 'color_cosmic_violet',
    name: 'Violeta Cósmico Sólido',
    animClass: 'nox-color-static',
    inlineStyle: 'color: #c084fc; text-shadow: 0 0 8px rgba(192, 132, 252, 0.4);',
    isAnimated: false,
    isGradient: false,
    rawColor: '#c084fc'
  },
  color_sapphire_blue: {
    id: 'color_sapphire_blue',
    name: 'Azul Safira Real',
    animClass: 'nox-color-static',
    inlineStyle: 'color: #60a5fa; text-shadow: 0 0 8px rgba(96, 165, 250, 0.4);',
    isAnimated: false,
    isGradient: false,
    rawColor: '#60a5fa'
  },
  color_emerald_arcane: {
    id: 'color_emerald_arcane',
    name: 'Esmeralda Arcana Pura',
    animClass: 'nox-color-static',
    inlineStyle: 'color: #34d399; text-shadow: 0 0 8px rgba(52, 211, 153, 0.4);',
    isAnimated: false,
    isGradient: false,
    rawColor: '#34d399'
  },
  color_solar_gold: {
    id: 'color_solar_gold',
    name: 'Ouro Imperial Sólido',
    animClass: 'nox-color-static',
    inlineStyle: 'color: #fbbf24; text-shadow: 0 0 8px rgba(251, 191, 36, 0.4);',
    isAnimated: false,
    isGradient: false,
    rawColor: '#fbbf24'
  },
  color_crimson_red: {
    id: 'color_crimson_red',
    name: 'Carmesim Nobre',
    animClass: 'nox-color-static',
    inlineStyle: 'color: #ef4444; text-shadow: 0 0 8px rgba(239, 68, 68, 0.4);',
    isAnimated: false,
    isGradient: false,
    rawColor: '#ef4444'
  },
  color_neon_cyan: {
    id: 'color_neon_cyan',
    name: 'Ciano Neon Sólido',
    animClass: 'nox-color-static',
    inlineStyle: 'color: #38bdf8; text-shadow: 0 0 8px rgba(56, 189, 248, 0.4);',
    isAnimated: false,
    isGradient: false,
    rawColor: '#38bdf8'
  },
  color_amethyst_radiant: {
    id: 'color_amethyst_radiant',
    name: 'Ametista Real',
    animClass: 'nox-color-static',
    inlineStyle: 'color: #d8b4fe; text-shadow: 0 0 8px rgba(216, 180, 254, 0.4);',
    isAnimated: false,
    isGradient: false,
    rawColor: '#d8b4fe'
  },
  color_blazing_orange: {
    id: 'color_blazing_orange',
    name: 'Laranja Âmbar Sólido',
    animClass: 'nox-color-static',
    inlineStyle: 'color: #fb923c; text-shadow: 0 0 8px rgba(251, 146, 60, 0.4);',
    isAnimated: false,
    isGradient: false,
    rawColor: '#fb923c'
  },
  color_cosmic_pink: {
    id: 'color_cosmic_pink',
    name: 'Rosa Choque Nobre',
    animClass: 'nox-color-static',
    inlineStyle: 'color: #f472b6; text-shadow: 0 0 8px rgba(244, 114, 182, 0.4);',
    isAnimated: false,
    isGradient: false,
    rawColor: '#f472b6'
  },
  color_toxic_neon_green: {
    id: 'color_toxic_neon_green',
    name: 'Verde Cibernético Sólido',
    animClass: 'nox-color-static',
    inlineStyle: 'color: #4ade80; text-shadow: 0 0 8px rgba(74, 222, 128, 0.4);',
    isAnimated: false,
    isGradient: false,
    rawColor: '#4ade80'
  },
  color_stellar_lapis: {
    id: 'color_stellar_lapis',
    name: 'Lápis-lazúli Estático',
    animClass: 'nox-color-static',
    inlineStyle: 'color: #818cf8; text-shadow: 0 0 8px rgba(129, 140, 248, 0.4);',
    isAnimated: false,
    isGradient: false,
    rawColor: '#818cf8'
  },
  color_blood_ruby: {
    id: 'color_blood_ruby',
    name: 'Rubi Escarlate Sólido',
    animClass: 'nox-color-static',
    inlineStyle: 'color: #b91c1c; text-shadow: 0 0 8px rgba(185, 28, 28, 0.4);',
    isAnimated: false,
    isGradient: false,
    rawColor: '#b91c1c'
  },
  color_radiant_coral: {
    id: 'color_radiant_coral',
    name: 'Coral Astral Sólido',
    animClass: 'nox-color-static',
    inlineStyle: 'color: #fb7185; text-shadow: 0 0 8px rgba(251, 113, 133, 0.4);',
    isAnimated: false,
    isGradient: false,
    rawColor: '#fb7185'
  },

  // =========================================================================
  // GROUP 2: 7 GRADIENTES EM DESLIZAMENTO SUAVE (Ondas contínuas sem pulso)
  // =========================================================================
  color_twilight_gradient: {
    id: 'color_twilight_gradient',
    name: 'Crepúsculo Cósmico',
    animClass: 'nox-anim-grad-flow',
    inlineStyle: 'background-image: linear-gradient(135deg, #a855f7, #ec4899, #3b82f6, #a855f7);',
    isAnimated: true,
    isGradient: true
  },
  color_nebula_dream: {
    id: 'color_nebula_dream',
    name: 'Sonho de Nebulosa',
    animClass: 'nox-anim-grad-flow',
    inlineStyle: 'background-image: linear-gradient(135deg, #ec4899, #8b5cf6, #06b6d4, #ec4899);',
    isAnimated: true,
    isGradient: true
  },
  color_celestial_dawn: {
    id: 'color_celestial_dawn',
    name: 'Alvorada Celestial',
    animClass: 'nox-anim-grad-flow',
    inlineStyle: 'background-image: linear-gradient(135deg, #fbbf24, #f43f5e, #c084fc, #fbbf24);',
    isAnimated: true,
    isGradient: true
  },
  color_cosmic_prism: {
    id: 'color_cosmic_prism',
    name: 'Prisma Cósmico',
    animClass: 'nox-anim-grad-flow',
    inlineStyle: 'background-image: linear-gradient(135deg, #f43f5e, #fbbf24, #10b981, #3b82f6, #f43f5e);',
    isAnimated: true,
    isGradient: true
  },
  color_quantum_flux: {
    id: 'color_quantum_flux',
    name: 'Fluxo Quântico',
    animClass: 'nox-anim-grad-flow',
    inlineStyle: 'background-image: linear-gradient(135deg, #06b6d4, #8b5cf6, #f43f5e, #06b6d4);',
    isAnimated: true,
    isGradient: true
  },
  color_dragon_fire: {
    id: 'color_dragon_fire',
    name: 'Fogo de Dragão',
    animClass: 'nox-anim-grad-flow',
    inlineStyle: 'background-image: linear-gradient(135deg, #ef4444, #f97316, #fbbf24, #ef4444);',
    isAnimated: true,
    isGradient: true
  },
  color_oceanic_pearl: {
    id: 'color_oceanic_pearl',
    name: 'Pérola Oceânica',
    animClass: 'nox-anim-grad-flow',
    inlineStyle: 'background-image: linear-gradient(135deg, #38bdf8, #818cf8, #c084fc, #38bdf8);',
    isAnimated: true,
    isGradient: true
  },

  // =========================================================================
  // GROUP 3: 7 REFLEXOS METÁLICOS SHIMMER (Varredura reluzente elegante)
  // =========================================================================
  color_diamond_sparkle: {
    id: 'color_diamond_sparkle',
    name: 'Reflexo de Diamante',
    animClass: 'nox-anim-shimmer',
    inlineStyle: 'background-image: linear-gradient(90deg, #93c5fd 0%, #ffffff 35%, #bfdbfe 50%, #ffffff 65%, #93c5fd 100%);',
    isAnimated: true,
    isGradient: true
  },
  color_starlight_gold: {
    id: 'color_starlight_gold',
    name: 'Reflexo de Ouro Nobre',
    animClass: 'nox-anim-shimmer',
    inlineStyle: 'background-image: linear-gradient(90deg, #d97706 0%, #fbbf24 35%, #ffffff 50%, #fbbf24 65%, #d97706 100%);',
    isAnimated: true,
    isGradient: true
  },
  color_cosmic_comet: {
    id: 'color_cosmic_comet',
    name: 'Feixe de Cometa',
    animClass: 'nox-anim-shimmer',
    inlineStyle: 'background-image: linear-gradient(90deg, #0284c7 0%, #38bdf8 35%, #ffffff 50%, #38bdf8 65%, #0284c7 100%);',
    isAnimated: true,
    isGradient: true
  },
  color_imperial_gold: {
    id: 'color_imperial_gold',
    name: 'Ouro Imperial Cromado',
    animClass: 'nox-anim-shimmer',
    inlineStyle: 'background-image: linear-gradient(90deg, #b45309 0%, #facc15 35%, #ffffff 50%, #facc15 65%, #b45309 100%);',
    isAnimated: true,
    isGradient: true
  },
  color_glacial_turquoise: {
    id: 'color_glacial_turquoise',
    name: 'Reflexo de Gelo Eterno',
    animClass: 'nox-anim-shimmer',
    inlineStyle: 'background-image: linear-gradient(90deg, #0891b2 0%, #22d3ee 35%, #ffffff 50%, #22d3ee 65%, #0891b2 100%);',
    isAnimated: true,
    isGradient: true
  },
  color_arcane_runes: {
    id: 'color_arcane_runes',
    name: 'Inscrição Rúnica Polida',
    animClass: 'nox-anim-shimmer',
    inlineStyle: 'background-image: linear-gradient(90deg, #991b1b 0%, #f43f5e 35%, #ffffff 50%, #f43f5e 65%, #991b1b 100%);',
    isAnimated: true,
    isGradient: true
  },
  color_cyber_acid_green: {
    id: 'color_cyber_acid_green',
    name: 'Feixe Cibernético',
    animClass: 'nox-anim-shimmer',
    inlineStyle: 'background-image: linear-gradient(90deg, #4d7c0f 0%, #a3e635 35%, #ffffff 50%, #a3e635 65%, #4d7c0f 100%);',
    isAnimated: true,
    isGradient: true
  },

  // =========================================================================
  // GROUP 4: 7 EFEITOS HOLOGRÁFICOS IRIDISCENTES (Transições suaves peroladas)
  // =========================================================================
  color_hologram_matrix: {
    id: 'color_hologram_matrix',
    name: 'Holograma Prisma',
    animClass: 'nox-anim-hologram',
    inlineStyle: 'background-image: linear-gradient(135deg, #a5b4fc, #67e8f9, #fbcfe8, #a5b4fc);',
    isAnimated: true,
    isGradient: true
  },
  color_spectral_aurora: {
    id: 'color_spectral_aurora',
    name: 'Aurora Holográfica',
    animClass: 'nox-anim-hologram',
    inlineStyle: 'background-image: linear-gradient(135deg, #6ee7b7, #38bdf8, #c084fc, #6ee7b7);',
    isAnimated: true,
    isGradient: true
  },
  color_cyberpunk_neon: {
    id: 'color_cyberpunk_neon',
    name: 'Neon Holográfico',
    animClass: 'nox-anim-hologram',
    inlineStyle: 'background-image: linear-gradient(135deg, #f472b6, #38bdf8, #a78bfa, #f472b6);',
    isAnimated: true,
    isGradient: true
  },
  color_valkyrie_wings: {
    id: 'color_valkyrie_wings',
    name: 'Asas Holográficas',
    animClass: 'nox-anim-hologram',
    inlineStyle: 'background-image: linear-gradient(135deg, #fbcfe8, #bae6fd, #e0e7ff, #fbcfe8);',
    isAnimated: true,
    isGradient: true
  },
  color_ethereal_turquoise: {
    id: 'color_ethereal_turquoise',
    name: 'Turquesa Iridiscente',
    animClass: 'nox-anim-hologram',
    inlineStyle: 'background-image: linear-gradient(135deg, #5eead4, #93c5fd, #c4b5fd, #5eead4);',
    isAnimated: true,
    isGradient: true
  },
  color_sakura_petal: {
    id: 'color_sakura_petal',
    name: 'Pétala Holográfica',
    animClass: 'nox-anim-hologram',
    inlineStyle: 'background-image: linear-gradient(135deg, #fda4af, #fef08a, #fbcfe8, #fda4af);',
    isAnimated: true,
    isGradient: true
  },
  color_plasma_storm: {
    id: 'color_plasma_storm',
    name: 'Plasma Iridiscente',
    animClass: 'nox-anim-hologram',
    inlineStyle: 'background-image: linear-gradient(135deg, #c084fc, #38bdf8, #f472b6, #c084fc);',
    isAnimated: true,
    isGradient: true
  },

  // =========================================================================
  // GROUP 5: 7 BRILHOS LOCALIZADOS GLINT (Ponto de luz estelar deslizando)
  // =========================================================================
  color_golden_supernova: {
    id: 'color_golden_supernova',
    name: 'Brilho Supernova',
    animClass: 'nox-anim-glint',
    inlineStyle: 'background-image: linear-gradient(90deg, #d97706 0%, #fbbf24 40%, #ffffff 50%, #fbbf24 60%, #d97706 100%);',
    isAnimated: true,
    isGradient: true
  },
  color_solar_eclipse: {
    id: 'color_solar_eclipse',
    name: 'Corona do Eclipse',
    animClass: 'nox-anim-glint',
    inlineStyle: 'background-image: linear-gradient(90deg, #c2410c 0%, #f97316 40%, #fef08a 50%, #f97316 60%, #c2410c 100%);',
    isAnimated: true,
    isGradient: true
  },
  color_chrono_amber: {
    id: 'color_chrono_amber',
    name: 'Âmbar Temporal',
    animClass: 'nox-anim-glint',
    inlineStyle: 'background-image: linear-gradient(90deg, #b45309 0%, #d97706 40%, #fef3c7 50%, #d97706 60%, #b45309 100%);',
    isAnimated: true,
    isGradient: true
  },
  color_supergiant_star: {
    id: 'color_supergiant_star',
    name: 'Ponto Supergigante',
    animClass: 'nox-anim-glint',
    inlineStyle: 'background-image: linear-gradient(90deg, #b91c1c 0%, #ef4444 40%, #ffffff 50%, #ef4444 60%, #b91c1c 100%);',
    isAnimated: true,
    isGradient: true
  },
  color_electric_violet: {
    id: 'color_electric_violet',
    name: 'Centelha Violeta',
    animClass: 'nox-anim-glint',
    inlineStyle: 'background-image: linear-gradient(90deg, #7e22ce 0%, #a855f7 40%, #ffffff 50%, #a855f7 60%, #7e22ce 100%);',
    isAnimated: true,
    isGradient: true
  },
  color_supreme_sovereign: {
    id: 'color_supreme_sovereign',
    name: 'Glint Soberano',
    animClass: 'nox-anim-glint',
    inlineStyle: 'background-image: linear-gradient(90deg, #a16207 0%, #eab308 40%, #ffffff 50%, #eab308 60%, #a16207 100%);',
    isAnimated: true,
    isGradient: true
  },
  color_phoenix_blaze: {
    id: 'color_phoenix_blaze',
    name: 'Centelha da Fênix',
    animClass: 'nox-anim-glint',
    inlineStyle: 'background-image: linear-gradient(90deg, #c2410c 0%, #ea580c 40%, #fed7aa 50%, #ea580c 60%, #c2410c 100%);',
    isAnimated: true,
    isGradient: true
  },

  // =========================================================================
  // GROUP 6: 7 DESLOCAMENTOS ANGULARES DIAGONAIS (Transição diagonal contínua)
  // =========================================================================
  color_mystic_emerald_stream: {
    id: 'color_mystic_emerald_stream',
    name: 'Corrente Esmeralda',
    animClass: 'nox-anim-grad-shift',
    inlineStyle: 'background-image: linear-gradient(45deg, #10b981, #34d399, #059669, #10b981);',
    isAnimated: true,
    isGradient: true
  },
  color_galactic_abyss: {
    id: 'color_galactic_abyss',
    name: 'Fenda Galáctica',
    animClass: 'nox-anim-grad-shift',
    inlineStyle: 'background-image: linear-gradient(45deg, #312e81, #6366f1, #38bdf8, #312e81);',
    isAnimated: true,
    isGradient: true
  },
  color_void_singularity: {
    id: 'color_void_singularity',
    name: 'Singularidade do Vazio',
    animClass: 'nox-anim-grad-shift',
    inlineStyle: 'background-image: linear-gradient(45deg, #1e1b4b, #7c3aed, #a78bfa, #1e1b4b);',
    isAnimated: true,
    isGradient: true
  },
  color_abyssal_deep: {
    id: 'color_abyssal_deep',
    name: 'Profundeza Abissal',
    animClass: 'nox-anim-grad-shift',
    inlineStyle: 'background-image: linear-gradient(45deg, #0369a1, #38bdf8, #0284c7, #0369a1);',
    isAnimated: true,
    isGradient: true
  },
  color_dark_matter: {
    id: 'color_dark_matter',
    name: 'Matéria Escura Fluida',
    animClass: 'nox-anim-grad-shift',
    inlineStyle: 'background-image: linear-gradient(45deg, #581c87, #9333ea, #c084fc, #581c87);',
    isAnimated: true,
    isGradient: true
  },
  color_infernal_sulfur: {
    id: 'color_infernal_sulfur',
    name: 'Enxofre Magmático',
    animClass: 'nox-anim-grad-shift',
    inlineStyle: 'background-image: linear-gradient(45deg, #b45309, #f59e0b, #ea580c, #b45309);',
    isAnimated: true,
    isGradient: true
  },
  color_blood_moon: {
    id: 'color_blood_moon',
    name: 'Mar de Sangue',
    animClass: 'nox-anim-grad-shift',
    inlineStyle: 'background-image: linear-gradient(45deg, #7f1d1d, #ef4444, #991b1b, #7f1d1d);',
    isAnimated: true,
    isGradient: true
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
      isAnimated: config.isAnimated,
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
      className: 'nox-color-static',
      style: `color: ${trimmed}; text-shadow: 0 0 8px ${trimmed}66;`,
      isAnimated: false,
      rawColor: trimmed
    };
  }

  return { className: '', style: '', isAnimated: false, rawColor: null };
}
