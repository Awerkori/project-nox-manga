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
  },

  // =========================================================================
  // ROUND FINAL: 50 NOVAS CORES DE NOME ÚNICAS (51 - 100)
  // =========================================================================
  color_obsidian_black: {
      "id": "color_obsidian_black",
      "name": "Obsidiana Abissal",
      "animClass": "nox-color-static",
      "inlineStyle": "color: #94a3b8; text-shadow: 0 0 10px rgba(148, 163, 184, 0.4), 0 0 2px #0f172a;",
      "isAnimated": false,
      "isGradient": false,
      "rawColor": "#94a3b8"
  },
  color_ruby_blood: {
      "id": "color_ruby_blood",
      "name": "Rubi Carmesim Puro",
      "animClass": "nox-color-static",
      "inlineStyle": "color: #e11d48; text-shadow: 0 0 10px rgba(225, 29, 72, 0.45);",
      "isAnimated": false,
      "isGradient": false,
      "rawColor": "#e11d48"
  },
  color_celestial_lapislazuli: {
      "id": "color_celestial_lapislazuli",
      "name": "Lápis-Lazúli Celestial",
      "animClass": "nox-color-static",
      "inlineStyle": "color: #2563eb; text-shadow: 0 0 10px rgba(37, 99, 235, 0.45);",
      "isAnimated": false,
      "isGradient": false,
      "rawColor": "#2563eb"
  },
  color_sunstone_amber: {
      "id": "color_sunstone_amber",
      "name": "Âmbar Solar Radiante",
      "animClass": "nox-color-static",
      "inlineStyle": "color: #d97706; text-shadow: 0 0 10px rgba(217, 119, 6, 0.45);",
      "isAnimated": false,
      "isGradient": false,
      "rawColor": "#d97706"
  },
  color_malachite_arcane: {
      "id": "color_malachite_arcane",
      "name": "Malaquita Arcana",
      "animClass": "nox-color-static",
      "inlineStyle": "color: #059669; text-shadow: 0 0 10px rgba(5, 150, 105, 0.45);",
      "isAnimated": false,
      "isGradient": false,
      "rawColor": "#059669"
  },
  color_platinum_imperial: {
      "id": "color_platinum_imperial",
      "name": "Platina Imperial",
      "animClass": "nox-color-static",
      "inlineStyle": "color: #cbd5e1; text-shadow: 0 0 10px rgba(203, 213, 225, 0.5);",
      "isAnimated": false,
      "isGradient": false,
      "rawColor": "#cbd5e1"
  },
  color_amethyst_royal: {
      "id": "color_amethyst_royal",
      "name": "Ametista da Realeza",
      "animClass": "nox-color-static",
      "inlineStyle": "color: #7c3aed; text-shadow: 0 0 10px rgba(124, 58, 237, 0.5);",
      "isAnimated": false,
      "isGradient": false,
      "rawColor": "#7c3aed"
  },
  color_topaz_golden: {
      "id": "color_topaz_golden",
      "name": "Topázio das Dunas",
      "animClass": "nox-color-static",
      "inlineStyle": "color: #eab308; text-shadow: 0 0 10px rgba(234, 179, 8, 0.45);",
      "isAnimated": false,
      "isGradient": false,
      "rawColor": "#eab308"
  },
  color_spinel_rose: {
      "id": "color_spinel_rose",
      "name": "Espinélio Rosa Choque",
      "animClass": "nox-color-static",
      "inlineStyle": "color: #db2777; text-shadow: 0 0 10px rgba(219, 39, 119, 0.45);",
      "isAnimated": false,
      "isGradient": false,
      "rawColor": "#db2777"
  },
  color_aquamarine_abyss: {
      "id": "color_aquamarine_abyss",
      "name": "Água-Marinha Glacial",
      "animClass": "nox-color-static",
      "inlineStyle": "color: #0ea5e9; text-shadow: 0 0 10px rgba(14, 165, 233, 0.45);",
      "isAnimated": false,
      "isGradient": false,
      "rawColor": "#0ea5e9"
  },
  color_moonstone_pale: {
      "id": "color_moonstone_pale",
      "name": "Pedra da Lua Alva",
      "animClass": "nox-color-static",
      "inlineStyle": "color: #f1f5f9; text-shadow: 0 0 10px rgba(241, 245, 249, 0.5);",
      "isAnimated": false,
      "isGradient": false,
      "rawColor": "#f1f5f9"
  },
  color_garnet_crimson: {
      "id": "color_garnet_crimson",
      "name": "Granada Nobre",
      "animClass": "nox-color-static",
      "inlineStyle": "color: #991b1b; text-shadow: 0 0 10px rgba(153, 27, 27, 0.5);",
      "isAnimated": false,
      "isGradient": false,
      "rawColor": "#991b1b"
  },
  color_peridot_mystic: {
      "id": "color_peridot_mystic",
      "name": "Peridoto Primavera",
      "animClass": "nox-color-static",
      "inlineStyle": "color: #65a30d; text-shadow: 0 0 10px rgba(101, 163, 13, 0.45);",
      "isAnimated": false,
      "isGradient": false,
      "rawColor": "#65a30d"
  },
  color_tanzanite_dusk: {
      "id": "color_tanzanite_dusk",
      "name": "Tanzanita Crepuscular",
      "animClass": "nox-color-static",
      "inlineStyle": "color: #4f46e5; text-shadow: 0 0 10px rgba(79, 70, 229, 0.45);",
      "isAnimated": false,
      "isGradient": false,
      "rawColor": "#4f46e5"
  },
  color_onyx_starlight: {
      "id": "color_onyx_starlight",
      "name": "Ônix Estrelado",
      "animClass": "nox-color-static",
      "inlineStyle": "color: #64748b; text-shadow: 0 0 10px rgba(100, 116, 139, 0.5), 0 0 2px #fff;",
      "isAnimated": false,
      "isGradient": false,
      "rawColor": "#64748b"
  },
  color_sakura_breeze: {
      "id": "color_sakura_breeze",
      "name": "Brisa de Sakura Astral",
      "animClass": "nox-anim-grad-flow",
      "inlineStyle": "background-image: linear-gradient(135deg, #f472b6, #fb7185, #fda4af, #f472b6);",
      "isAnimated": true,
      "isGradient": true
  },
  color_ocean_trench: {
      "id": "color_ocean_trench",
      "name": "Fossa Mariana Abissal",
      "animClass": "nox-anim-grad-flow",
      "inlineStyle": "background-image: linear-gradient(135deg, #0284c7, #0d9488, #06b6d4, #0284c7);",
      "isAnimated": true,
      "isGradient": true
  },
  color_dragon_breath: {
      "id": "color_dragon_breath",
      "name": "Respiração Dracônica",
      "animClass": "nox-anim-grad-flow",
      "inlineStyle": "background-image: linear-gradient(135deg, #dc2626, #f97316, #eab308, #dc2626);",
      "isAnimated": true,
      "isGradient": true
  },
  color_arcane_alchemy: {
      "id": "color_arcane_alchemy",
      "name": "Transmutação Alquímica",
      "animClass": "nox-anim-grad-flow",
      "inlineStyle": "background-image: linear-gradient(135deg, #10b981, #6366f1, #d97706, #10b981);",
      "isAnimated": true,
      "isGradient": true
  },
  color_arctic_blizzard: {
      "id": "color_arctic_blizzard",
      "name": "Nevasca Ártica Eterna",
      "animClass": "nox-anim-grad-flow",
      "inlineStyle": "background-image: linear-gradient(135deg, #38bdf8, #818cf8, #e0f2fe, #38bdf8);",
      "isAnimated": true,
      "isGradient": true
  },
  color_solar_eclipse_corona: {
      "id": "color_solar_eclipse_corona",
      "name": "Coroa Solar do Eclipse",
      "animClass": "nox-anim-grad-flow",
      "inlineStyle": "background-image: linear-gradient(135deg, #fbbf24, #f59e0b, #b45309, #fbbf24);",
      "isAnimated": true,
      "isGradient": true
  },
  color_astral_forest: {
      "id": "color_astral_forest",
      "name": "Floresta Astral Fluida",
      "animClass": "nox-anim-grad-flow",
      "inlineStyle": "background-image: linear-gradient(135deg, #34d399, #a78bfa, #38bdf8, #34d399);",
      "isAnimated": true,
      "isGradient": true
  },
  color_damascus_steel: {
      "id": "color_damascus_steel",
      "name": "Aço Damasco Reluzente",
      "animClass": "nox-anim-shimmer",
      "inlineStyle": "background-image: linear-gradient(90deg, #64748b 0%, #cbd5e1 45%, #ffffff 50%, #cbd5e1 55%, #64748b 100%);",
      "isAnimated": true,
      "isGradient": true
  },
  color_rose_gold_royal: {
      "id": "color_rose_gold_royal",
      "name": "Ouro Rosa da Rainha",
      "animClass": "nox-anim-shimmer",
      "inlineStyle": "background-image: linear-gradient(90deg, #f43f5e 0%, #fda4af 45%, #ffffff 50%, #fda4af 55%, #f43f5e 100%);",
      "isAnimated": true,
      "isGradient": true
  },
  color_titanium_white: {
      "id": "color_titanium_white",
      "name": "Titânio Alvo Nobre",
      "animClass": "nox-anim-shimmer",
      "inlineStyle": "background-image: linear-gradient(90deg, #94a3b8 0%, #e2e8f0 45%, #ffffff 50%, #e2e8f0 55%, #94a3b8 100%);",
      "isAnimated": true,
      "isGradient": true
  },
  color_black_iron: {
      "id": "color_black_iron",
      "name": "Ferro Negro das Forjas",
      "animClass": "nox-anim-shimmer",
      "inlineStyle": "background-image: linear-gradient(90deg, #334155 0%, #f97316 45%, #fef08a 50%, #f97316 55%, #334155 100%);",
      "isAnimated": true,
      "isGradient": true
  },
  color_bronze_ancient: {
      "id": "color_bronze_ancient",
      "name": "Bronze dos Titãs",
      "animClass": "nox-anim-shimmer",
      "inlineStyle": "background-image: linear-gradient(90deg, #b45309 0%, #fde68a 45%, #ffffff 50%, #fde68a 55%, #b45309 100%);",
      "isAnimated": true,
      "isGradient": true
  },
  color_mithril_elven: {
      "id": "color_mithril_elven",
      "name": "Mithril Élfico Puro",
      "animClass": "nox-anim-shimmer",
      "inlineStyle": "background-image: linear-gradient(90deg, #60a5fa 0%, #bae6fd 45%, #ffffff 50%, #bae6fd 55%, #60a5fa 100%);",
      "isAnimated": true,
      "isGradient": true
  },
  color_orichalcum_gleam: {
      "id": "color_orichalcum_gleam",
      "name": "Oricalco Lendário",
      "animClass": "nox-anim-shimmer",
      "inlineStyle": "background-image: linear-gradient(90deg, #ea580c 0%, #fed7aa 45%, #ffffff 50%, #fed7aa 55%, #ea580c 100%);",
      "isAnimated": true,
      "isGradient": true
  },
  color_opal_fire: {
      "id": "color_opal_fire",
      "name": "Opala de Fogo Australiana",
      "animClass": "nox-anim-hologram",
      "inlineStyle": "background-image: linear-gradient(135deg, #f97316, #ec4899, #10b981, #3b82f6);",
      "isAnimated": true,
      "isGradient": true
  },
  color_cyber_vaporwave: {
      "id": "color_cyber_vaporwave",
      "name": "Vaporwave Cósmico",
      "animClass": "nox-anim-hologram",
      "inlineStyle": "background-image: linear-gradient(135deg, #06b6d4, #ec4899, #8b5cf6, #facc15);",
      "isAnimated": true,
      "isGradient": true
  },
  color_nebula_silk: {
      "id": "color_nebula_silk",
      "name": "Seda da Nebulosa",
      "animClass": "nox-anim-hologram",
      "inlineStyle": "background-image: linear-gradient(135deg, #c084fc, #f472b6, #38bdf8, #818cf8);",
      "isAnimated": true,
      "isGradient": true
  },
  color_soap_bubble_astral: {
      "id": "color_soap_bubble_astral",
      "name": "Bolha Astral Perolada",
      "animClass": "nox-anim-hologram",
      "inlineStyle": "background-image: linear-gradient(135deg, #e0e7ff, #fce7f3, #cffafe, #dcfce7);",
      "isAnimated": true,
      "isGradient": true
  },
  color_chameleon_scale: {
      "id": "color_chameleon_scale",
      "name": "Escama de Camaleão Estelar",
      "animClass": "nox-anim-hologram",
      "inlineStyle": "background-image: linear-gradient(135deg, #10b981, #06b6d4, #8b5cf6, #10b981);",
      "isAnimated": true,
      "isGradient": true
  },
  color_mirage_desert: {
      "id": "color_mirage_desert",
      "name": "Miragem Dimensional",
      "animClass": "nox-anim-hologram",
      "inlineStyle": "background-image: linear-gradient(135deg, #f59e0b, #06b6d4, #a855f7, #f59e0b);",
      "isAnimated": true,
      "isGradient": true
  },
  color_biolum_jellyfish: {
      "id": "color_biolum_jellyfish",
      "name": "Medusa Bioluminescente",
      "animClass": "nox-anim-hologram",
      "inlineStyle": "background-image: linear-gradient(135deg, #22d3ee, #f43f5e, #a78bfa, #22d3ee);",
      "isAnimated": true,
      "isGradient": true
  },
  color_comet_tail_glint: {
      "id": "color_comet_tail_glint",
      "name": "Cauda de Cometa Reluzente",
      "animClass": "nox-anim-glint",
      "inlineStyle": "background-image: linear-gradient(90deg, #1e3a8a 0%, #3b82f6 30%, #93c5fd 48%, #ffffff 50%, #93c5fd 52%, #3b82f6 70%, #1e3a8a 100%);",
      "isAnimated": true,
      "isGradient": true
  },
  color_shooting_star: {
      "id": "color_shooting_star",
      "name": "Estrela Cadente Noturna",
      "animClass": "nox-anim-glint",
      "inlineStyle": "background-image: linear-gradient(90deg, #312e81 0%, #6366f1 35%, #a5b4fc 48%, #ffffff 50%, #a5b4fc 52%, #6366f1 65%, #312e81 100%);",
      "isAnimated": true,
      "isGradient": true
  },
  color_cat_eye_chrysoberyl: {
      "id": "color_cat_eye_chrysoberyl",
      "name": "Olho de Gato de Crisoberilo",
      "animClass": "nox-anim-glint",
      "inlineStyle": "background-image: linear-gradient(90deg, #4d7c0f 0%, #84cc16 35%, #bef264 48%, #ffffff 50%, #bef264 52%, #84cc16 65%, #4d7c0f 100%);",
      "isAnimated": true,
      "isGradient": true
  },
  color_rough_diamond_glint: {
      "id": "color_rough_diamond_glint",
      "name": "Cintilação de Diamante Bruto",
      "animClass": "nox-anim-glint",
      "inlineStyle": "background-image: linear-gradient(90deg, #475569 0%, #94a3b8 35%, #e2e8f0 48%, #ffffff 50%, #e2e8f0 52%, #94a3b8 65%, #475569 100%);",
      "isAnimated": true,
      "isGradient": true
  },
  color_volcanic_spark: {
      "id": "color_volcanic_spark",
      "name": "Faísca Vulcânica Noturna",
      "animClass": "nox-anim-glint",
      "inlineStyle": "background-image: linear-gradient(90deg, #7c2d12 0%, #ea580c 35%, #fed7aa 48%, #ffffff 50%, #fed7aa 52%, #ea580c 65%, #7c2d12 100%);",
      "isAnimated": true,
      "isGradient": true
  },
  color_starlight_glimmer: {
      "id": "color_starlight_glimmer",
      "name": "Vislumbre Estelar Puro",
      "animClass": "nox-anim-glint",
      "inlineStyle": "background-image: linear-gradient(90deg, #1e1b4b 0%, #4338ca 35%, #c7d2fe 48%, #ffffff 50%, #c7d2fe 52%, #4338ca 65%, #1e1b4b 100%);",
      "isAnimated": true,
      "isGradient": true
  },
  color_emerald_flash: {
      "id": "color_emerald_flash",
      "name": "Clarão de Esmeralda Antiga",
      "animClass": "nox-anim-glint",
      "inlineStyle": "background-image: linear-gradient(90deg, #064e3b 0%, #059669 35%, #a7f3d0 48%, #ffffff 50%, #a7f3d0 52%, #059669 65%, #064e3b 100%);",
      "isAnimated": true,
      "isGradient": true
  },
  color_dimension_rift_shift: {
      "id": "color_dimension_rift_shift",
      "name": "Fenda Dimensional",
      "animClass": "nox-anim-grad-shift",
      "inlineStyle": "background-image: linear-gradient(45deg, #701a75, #ec4899, #38bdf8, #701a75);",
      "isAnimated": true,
      "isGradient": true
  },
  color_twilight_aurora_shift: {
      "id": "color_twilight_aurora_shift",
      "name": "Deriva da Aurora Crepuscular",
      "animClass": "nox-anim-grad-shift",
      "inlineStyle": "background-image: linear-gradient(45deg, #0369a1, #f43f5e, #10b981, #0369a1);",
      "isAnimated": true,
      "isGradient": true
  },
  color_supernova_collapse: {
      "id": "color_supernova_collapse",
      "name": "Colapso de Supernova",
      "animClass": "nox-anim-grad-shift",
      "inlineStyle": "background-image: linear-gradient(45deg, #f59e0b, #ef4444, #7e22ce, #f59e0b);",
      "isAnimated": true,
      "isGradient": true
  },
  color_matrix_hyperdrive: {
      "id": "color_matrix_hyperdrive",
      "name": "Hiperdrive Digital",
      "animClass": "nox-anim-grad-shift",
      "inlineStyle": "background-image: linear-gradient(45deg, #047857, #10b981, #06b6d4, #047857);",
      "isAnimated": true,
      "isGradient": true
  },
  color_crimson_nebula_drift: {
      "id": "color_crimson_nebula_drift",
      "name": "Deriva da Nebulosa Rubra",
      "animClass": "nox-anim-grad-shift",
      "inlineStyle": "background-image: linear-gradient(45deg, #991b1b, #dc2626, #c084fc, #991b1b);",
      "isAnimated": true,
      "isGradient": true
  },
  color_celestial_river: {
      "id": "color_celestial_river",
      "name": "Rio Celestial Estelar",
      "animClass": "nox-anim-grad-shift",
      "inlineStyle": "background-image: linear-gradient(45deg, #1d4ed8, #60a5fa, #c084fc, #1d4ed8);",
      "isAnimated": true,
      "isGradient": true
  },
  color_cosmic_chaos_drift: {
      "id": "color_cosmic_chaos_drift",
      "name": "Caos Cósmico Transcendente",
      "animClass": "nox-anim-grad-shift",
      "inlineStyle": "background-image: linear-gradient(45deg, #8b5cf6, #ec4899, #f59e0b, #10b981, #8b5cf6);",
      "isAnimated": true,
      "isGradient": true
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
