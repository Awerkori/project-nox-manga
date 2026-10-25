/**
 * Curated Cosmetics Catalog for Project Nox
 * High-quality, verified, aesthetic items without placeholders or empty states.
 */

export interface CosmeticItem {
  id: string;
  name: string;
  description: string;
  kind: 'AVATAR_FRAME' | 'NAME_COLOR' | 'TITLE' | 'PROFILE_BANNER';
  rarity: 'COMUM' | 'INCOMUM' | 'RARA' | 'EPICA' | 'LENDARIA' | 'MITICA';
  price_xp: number;
  min_level: number;
  is_animated: boolean;
  order_index: number;
  asset_url: string;
  style_data: Record<string, any>;
}

export const CURATED_COSMETIC_ITEMS: CosmeticItem[] = [
  // =========================================================================
  // A. MOLDURAS DE AVATAR (8 itens de alta qualidade, 100% CSS/SVG)
  // =========================================================================
  {
    id: 'frame_cosmic_nox',
    name: 'Borda Cósmica Nox',
    description: 'Anel sutil em violeta espacial com quatro gemas astrais nos pontos cardeais.',
    kind: 'AVATAR_FRAME',
    rarity: 'COMUM',
    price_xp: 200,
    min_level: 1,
    is_animated: false,
    order_index: 1,
    asset_url: '',
    style_data: {
      border: '2px solid #a78bfa',
      boxShadow: '0 0 10px rgba(167, 139, 250, 0.55)',
      theme: 'cosmic'
    }
  },
  {
    id: 'frame_cyber_neon',
    name: 'Neon Ciano',
    description: 'Circuito cibernético com traços de neon azul elétrico e cantos chanfrados.',
    kind: 'AVATAR_FRAME',
    rarity: 'INCOMUM',
    price_xp: 450,
    min_level: 2,
    is_animated: false,
    order_index: 2,
    asset_url: '',
    style_data: {
      border: '2px solid #06b6d4',
      boxShadow: '0 0 12px rgba(6, 182, 212, 0.7), inset 0 0 6px rgba(6, 182, 212, 0.3)',
      theme: 'cyber'
    }
  },
  {
    id: 'frame_emerald_veil',
    name: 'Véu de Esmeralda',
    description: 'Aura arcana viva em verde-esmeralda com respiração sutil de energia florestal.',
    kind: 'AVATAR_FRAME',
    rarity: 'INCOMUM',
    price_xp: 500,
    min_level: 3,
    is_animated: false,
    order_index: 3,
    asset_url: '',
    style_data: {
      border: '2.5px solid #10b981',
      boxShadow: '0 0 14px rgba(16, 185, 129, 0.65), inset 0 0 5px rgba(52, 211, 153, 0.3)',
      theme: 'emerald'
    }
  },
  {
    id: 'frame_solar_flare',
    name: 'Chama Solar',
    description: 'Moldura dourada pulsante com rotação de chamas solares e reflexos incandescentes.',
    kind: 'AVATAR_FRAME',
    rarity: 'RARA',
    price_xp: 900,
    min_level: 5,
    is_animated: true,
    order_index: 4,
    asset_url: '',
    style_data: {
      border: '2.5px solid #f59e0b',
      boxShadow: '0 0 16px rgba(245, 158, 11, 0.8)',
      animation: 'solarRotate 4s linear infinite',
      theme: 'solar'
    }
  },
  {
    id: 'frame_particle_stardust',
    name: 'Poeira Estelar',
    description: 'Micro-brilhos astrais em órbita contínua em torno do avatar, inspirados no céu noturno.',
    kind: 'AVATAR_FRAME',
    rarity: 'RARA',
    price_xp: 1100,
    min_level: 6,
    is_animated: true,
    order_index: 5,
    asset_url: '',
    style_data: {
      border: '2px solid #818cf8',
      boxShadow: '0 0 16px rgba(129, 140, 248, 0.75), inset 0 0 8px rgba(192, 132, 252, 0.4)',
      animation: 'stardustTwinkle 3s ease-in-out infinite',
      theme: 'stardust'
    }
  },
  {
    id: 'frame_aurora_mystic',
    name: 'Aurora Boreal Mística',
    description: 'Ondulação fluida de luzes boreais em gradiente espectral dinâmico violeta, ciano e menta.',
    kind: 'AVATAR_FRAME',
    rarity: 'EPICA',
    price_xp: 1800,
    min_level: 10,
    is_animated: true,
    order_index: 6,
    asset_url: '',
    style_data: {
      border: '3px solid #8b5cf6',
      boxShadow: '0 0 20px rgba(139, 92, 246, 0.8), inset 0 0 10px rgba(6, 182, 212, 0.5)',
      animation: 'auroraWave 4s ease-in-out infinite',
      theme: 'aurora'
    }
  },
  {
    id: 'frame_crimson_eclipse',
    name: 'Eclipse Carmesim',
    description: 'Anel lunar vermelho profundo com corona escarlate viva e pulsação incandescente.',
    kind: 'AVATAR_FRAME',
    rarity: 'LENDARIA',
    price_xp: 3200,
    min_level: 15,
    is_animated: true,
    order_index: 7,
    asset_url: '',
    style_data: {
      border: '3.5px solid #ef4444',
      boxShadow: '0 0 26px rgba(239, 68, 68, 0.9), inset 0 0 10px rgba(220, 38, 38, 0.6)',
      animation: 'crimsonPulse 2.5s ease-in-out infinite',
      theme: 'crimson'
    }
  },
  {
    id: 'frame_celestial_sovereign',
    name: 'Coroa Celestial Nox',
    description: 'Diadema régio cósmico com feixes dourados e aura divina de constelações.',
    kind: 'AVATAR_FRAME',
    rarity: 'MITICA',
    price_xp: 5500,
    min_level: 20,
    is_animated: true,
    order_index: 8,
    asset_url: '',
    style_data: {
      border: '4px solid #fbbf24',
      boxShadow: '0 0 32px rgba(251, 191, 36, 0.95), 0 0 16px rgba(168, 85, 247, 0.7), inset 0 0 12px rgba(255, 255, 255, 0.8)',
      animation: 'celestialSovereign 5s ease-in-out infinite',
      theme: 'celestial'
    }
  },

  // =========================================================================
  // B. CORES DE NOME (7 cores distintas com contraste e brilho)
  // =========================================================================
  {
    id: 'color_cosmic_violet',
    name: 'Violeta Cósmico',
    description: 'Tom púrpura espacial nobre com leve luminescência astral para seu nome.',
    kind: 'NAME_COLOR',
    rarity: 'COMUM',
    price_xp: 200,
    min_level: 1,
    is_animated: false,
    order_index: 9,
    asset_url: '',
    style_data: {
      color: '#a78bfa',
      textShadow: '0 0 8px rgba(167, 139, 250, 0.65)'
    }
  },
  {
    id: 'color_neon_cyan',
    name: 'Ciano Neon',
    description: 'Azul elétrico de alta definição com destaque penetrante em qualquer fundo escuro.',
    kind: 'NAME_COLOR',
    rarity: 'COMUM',
    price_xp: 200,
    min_level: 1,
    is_animated: false,
    order_index: 10,
    asset_url: '',
    style_data: {
      color: '#38bdf8',
      textShadow: '0 0 8px rgba(56, 189, 248, 0.65)'
    }
  },
  {
    id: 'color_emerald_arcane',
    name: 'Esmeralda',
    description: 'Verde translúcido vibrante com vibração suave e excelente leitura.',
    kind: 'NAME_COLOR',
    rarity: 'INCOMUM',
    price_xp: 400,
    min_level: 3,
    is_animated: false,
    order_index: 11,
    asset_url: '',
    style_data: {
      color: '#34d399',
      textShadow: '0 0 8px rgba(52, 211, 153, 0.65)'
    }
  },
  {
    id: 'color_lunar_silver',
    name: 'Prata Lunar',
    description: 'Prata perolada límpida e refinada inspirada no brilho da lua cheia.',
    kind: 'NAME_COLOR',
    rarity: 'INCOMUM',
    price_xp: 450,
    min_level: 3,
    is_animated: false,
    order_index: 12,
    asset_url: '',
    style_data: {
      color: '#e2e8f0',
      textShadow: '0 0 10px rgba(226, 232, 240, 0.7)'
    }
  },
  {
    id: 'color_radiant_coral',
    name: 'Coral Radiante',
    description: 'Tom coral rosado incandescente com toque moderno e caloroso.',
    kind: 'NAME_COLOR',
    rarity: 'RARA',
    price_xp: 800,
    min_level: 5,
    is_animated: false,
    order_index: 13,
    asset_url: '',
    style_data: {
      color: '#fb7185',
      textShadow: '0 0 10px rgba(251, 113, 133, 0.7)'
    }
  },
  {
    id: 'color_solar_gold',
    name: 'Dourado Solar',
    description: 'Ouro radiante das estrelas com halo luminoso nobre.',
    kind: 'NAME_COLOR',
    rarity: 'EPICA',
    price_xp: 1500,
    min_level: 8,
    is_animated: false,
    order_index: 14,
    asset_url: '',
    style_data: {
      color: '#fbbf24',
      textShadow: '0 0 12px rgba(251, 191, 36, 0.8), 0 0 4px #f59e0b'
    }
  },
  {
    id: 'color_prism_gradient',
    name: 'Prisma Cósmico',
    description: 'Gradiente animado de três tons (violeta, ciano e ouro) com reflexo luminoso dinâmico.',
    kind: 'NAME_COLOR',
    rarity: 'LENDARIA',
    price_xp: 3000,
    min_level: 12,
    is_animated: true,
    order_index: 15,
    asset_url: '',
    style_data: {
      color: '#c084fc',
      backgroundImage: 'linear-gradient(90deg, #c084fc 0%, #38bdf8 50%, #fbbf24 100%)',
      textShadow: '0 0 14px rgba(192, 132, 252, 0.7)'
    }
  },

  // =========================================================================
  // C. TÍTULOS CÓSMICOS (6 títulos canônicos com insígnias temáticas)
  // =========================================================================
  {
    id: 'title_viajante_estelar',
    name: 'Viajante Estelar',
    description: 'Dado aos primeiros passos na imensidão do cosmos e do catálogo Nox.',
    kind: 'TITLE',
    rarity: 'COMUM',
    price_xp: 150,
    min_level: 1,
    is_animated: false,
    order_index: 16,
    asset_url: '',
    style_data: {
      color: '#a78bfa',
      badgeBorder: 'rgba(167, 139, 250, 0.4)',
      badgeBg: 'rgba(167, 139, 250, 0.12)'
    }
  },
  {
    id: 'title_guardiao_do_vazio',
    name: 'Guardião do Vazio',
    description: 'Para leitores firmes que navegam destemidos pelas correntes misteriosas entre mundos.',
    kind: 'TITLE',
    rarity: 'INCOMUM',
    price_xp: 450,
    min_level: 3,
    is_animated: false,
    order_index: 17,
    asset_url: '',
    style_data: {
      color: '#38bdf8',
      badgeBorder: 'rgba(56, 189, 248, 0.4)',
      badgeBg: 'rgba(56, 189, 248, 0.12)'
    }
  },
  {
    id: 'title_leitor_celestial',
    name: 'Leitor Celestial',
    description: 'Alcançou o cume das constelações de histórias mais aclamadas da comunidade.',
    kind: 'TITLE',
    rarity: 'RARA',
    price_xp: 900,
    min_level: 6,
    is_animated: false,
    order_index: 18,
    asset_url: '',
    style_data: {
      color: '#34d399',
      badgeBorder: 'rgba(52, 211, 153, 0.4)',
      badgeBg: 'rgba(52, 211, 153, 0.12)'
    }
  },
  {
    id: 'title_arquiteto_constelacoes',
    name: 'Arquiteto de Constelações',
    description: 'Mapeador incansável de obras-primas e construtor de jornadas épicas.',
    kind: 'TITLE',
    rarity: 'EPICA',
    price_xp: 1800,
    min_level: 10,
    is_animated: false,
    order_index: 19,
    asset_url: '',
    style_data: {
      color: '#c084fc',
      badgeBorder: 'rgba(192, 132, 252, 0.45)',
      badgeBg: 'rgba(192, 132, 252, 0.15)'
    }
  },
  {
    id: 'title_soberano_estrelas',
    name: 'Soberano das Estrelas',
    description: 'Presença régia respeitada, cujo gosto guia as luzes mais brilhantes do firmamento.',
    kind: 'TITLE',
    rarity: 'LENDARIA',
    price_xp: 3500,
    min_level: 16,
    is_animated: false,
    order_index: 20,
    asset_url: '',
    style_data: {
      color: '#fbbf24',
      badgeBorder: 'rgba(251, 191, 36, 0.5)',
      badgeBg: 'rgba(251, 191, 36, 0.15)'
    }
  },
  {
    id: 'title_lenda_do_nox',
    name: 'Lenda do Nox',
    description: 'O título supremo reservado aos ícones eternos gravados nos anais da plataforma.',
    kind: 'TITLE',
    rarity: 'MITICA',
    price_xp: 6000,
    min_level: 22,
    is_animated: true,
    order_index: 21,
    asset_url: '',
    style_data: {
      color: '#f43f5e',
      textShadow: '0 0 10px #f43f5e, 0 0 20px #fbbf24',
      badgeBorder: 'rgba(244, 63, 94, 0.6)',
      badgeBg: 'rgba(244, 63, 94, 0.18)'
    }
  },

  // =========================================================================
  // D. BANNERS DE PERFIL (6 banners procedurais cósmicos em SVG/CSS)
  // =========================================================================
  {
    id: 'banner_nebulosa_vazio',
    name: 'Nebulosa do Vazio',
    description: 'Nuvem cósmica de poeira estelar violeta e azul profundo com constelações distantes.',
    kind: 'PROFILE_BANNER',
    rarity: 'COMUM',
    price_xp: 300,
    min_level: 2,
    is_animated: false,
    order_index: 22,
    asset_url: '',
    style_data: {
      background: 'radial-gradient(ellipse at 70% 30%, rgba(139, 92, 246, 0.45) 0%, rgba(15, 12, 38, 0.95) 75%), linear-gradient(135deg, #090814 0%, #171033 50%, #06050d 100%)'
    }
  },
  {
    id: 'banner_aurora_astral',
    name: 'Aurora Astral',
    description: 'Cortinas de luz etérea em ondas esmeralda e turquesa sobre a escuridão do espaço.',
    kind: 'PROFILE_BANNER',
    rarity: 'INCOMUM',
    price_xp: 600,
    min_level: 4,
    is_animated: false,
    order_index: 23,
    asset_url: '',
    style_data: {
      background: 'radial-gradient(ellipse at 30% 20%, rgba(16, 185, 129, 0.4) 0%, transparent 60%), radial-gradient(ellipse at 80% 80%, rgba(6, 182, 212, 0.35) 0%, transparent 60%), linear-gradient(135deg, #041217 0%, #062326 50%, #020a0d 100%)'
    }
  },
  {
    id: 'banner_energia_arcana',
    name: 'Energia Arcana',
    description: 'Vórtices de feitiçaria cósmica pulsando em tons de ametista e safira etérea.',
    kind: 'PROFILE_BANNER',
    rarity: 'RARA',
    price_xp: 1000,
    min_level: 7,
    is_animated: false,
    order_index: 24,
    asset_url: '',
    style_data: {
      background: 'radial-gradient(circle at 50% 50%, rgba(168, 85, 247, 0.4) 0%, rgba(30, 27, 75, 0.8) 55%, #070712 100%), linear-gradient(90deg, #1e1b4b 0%, #311042 100%)'
    }
  },
  {
    id: 'banner_eclipse_cosmico',
    name: 'Eclipse Cósmico',
    description: 'Corona solar em eclipse total com anel de fogo rubi emergindo sobre o vazio.',
    kind: 'PROFILE_BANNER',
    rarity: 'EPICA',
    price_xp: 1800,
    min_level: 10,
    is_animated: false,
    order_index: 25,
    asset_url: '',
    style_data: {
      background: 'radial-gradient(circle at 65% 50%, rgba(239, 68, 68, 0.5) 0%, rgba(185, 28, 28, 0.3) 35%, transparent 70%), linear-gradient(135deg, #1c0508 0%, #2b080d 50%, #0d0204 100%)'
    }
  },
  {
    id: 'banner_biblioteca_estrelas',
    name: 'Biblioteca das Estrelas',
    description: 'Padrões geométricos áureos e constelações gravadas na tapeçaria estelar.',
    kind: 'PROFILE_BANNER',
    rarity: 'LENDARIA',
    price_xp: 3200,
    min_level: 15,
    is_animated: false,
    order_index: 26,
    asset_url: '',
    style_data: {
      background: 'radial-gradient(ellipse at 50% 0%, rgba(251, 191, 36, 0.35) 0%, transparent 65%), linear-gradient(135deg, #171104 0%, #2e2007 50%, #0d0a02 100%)'
    }
  },
  {
    id: 'banner_runas_primordiais',
    name: 'Fenda Rúnica',
    description: 'Glifos arcanos ancestrais em ciano e púrpura flutuando numa fenda dimensional profunda.',
    kind: 'PROFILE_BANNER',
    rarity: 'MITICA',
    price_xp: 5000,
    min_level: 20,
    is_animated: true,
    order_index: 27,
    asset_url: '',
    style_data: {
      background: 'radial-gradient(circle at 25% 40%, rgba(192, 132, 252, 0.45) 0%, transparent 50%), radial-gradient(circle at 75% 60%, rgba(56, 189, 248, 0.4) 0%, transparent 50%), linear-gradient(135deg, #110524 0%, #07192e 50%, #04020a 100%)'
    }
  }
];

export function getCuratedCosmetics(activeOnly = true): CosmeticItem[] {
  return CURATED_COSMETIC_ITEMS;
}

export const CURATED_COSMETIC_IDS = new Set(CURATED_COSMETIC_ITEMS.map((item) => item.id));

export const ARCHIVED_SHOP_ITEM_IDS = new Set([
  // Legacy frames removed (placeholders, invisible, generic 2px borders)
  'frame_basic_gray',
  'frame_basic_blue',
  'frame_basic_purple',
  'frame_basic_green',
  'frame_basic_gold',
  'frame_neon_cyan',
  'frame_neon_purple',
  'frame_cyber_glitch',
  'frame_crimson_blood',
  'frame_toxic_waste',
  'frame_golden_royalty',
  'frame_obsidian_flame',
  'frame_celestial_star',
  'frame_celestial_arcane',
  'frame_abyssal_rift',
  'frame_glitch_overdrive',
  'frame_rainbow_chroma',
  'frame_supreme_sovereign',

  // Legacy colors replaced by curated balanced palette
  'color_basic_white',
  'color_soft_blue',
  'color_emerald_green',
  'color_violet_mystic',
  'color_ruby_red',

  // Generic legacy titles replaced by cosmic lore titles
  'title_iniciante',
  'title_leitor_assiduo',
  'title_devorador_de_obras',
  'title_critico_literario',
  'title_colecionador_de_gemas',
  'title_veterano_do_nox',
  'title_soberano_das_sombras',
  'title_arconte_celestial',
  'title_entidade_primordial',

  // Legacy banners with missing assets
  'banner_default',
  'banner_stars',
  'banner_cyberpunk',
  'banner_sakura',
  'banner_blood_moon',
  'banner_celestial'
]);
