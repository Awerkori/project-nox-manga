/**
 * Curated Cosmetics Catalog for Project Nox
 * High-quality, verified, aesthetic items without placeholders or empty states.
 */

import { CURATED_BANNER_BACKGROUNDS } from './cosmetic-banners';

export interface ColorVariant {
  id: string;
  label: string;
  color: string;
}

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
  color_variants?: ColorVariant[];
}

export const CURATED_COSMETIC_ITEMS: CosmeticItem[] = [
  // =========================================================================
  // A. MOLDURAS DE AVATAR (12 itens únicos, 100% vetoriais CSS/SVG)
  // =========================================================================
  {
    id: 'frame_cosmic_nox',
    name: 'Borda Cósmica Nox',
    description: 'Anel sutil em violeta espacial com quatro gemas astrais nos pontos cardeais e microestrelas.',
    kind: 'AVATAR_FRAME',
    rarity: 'COMUM',
    price_xp: 200,
    min_level: 1,
    is_animated: true,
    order_index: 1,
    asset_url: '',
    style_data: {
      border: '2px solid #a78bfa',
      boxShadow: '0 0 10px rgba(167, 139, 250, 0.55)',
      theme: 'cosmic'
    },
    color_variants: [
      { id: 'default', label: 'Violeta Astral (Padrão)', color: '#a78bfa' },
      { id: 'gold', label: 'Dourado Estelar', color: '#fbbf24' },
      { id: 'cyan', label: 'Ciano Espacial', color: '#38bdf8' },
      { id: 'crimson', label: 'Carmesim Abissal', color: '#ef4444' },
      { id: 'emerald', label: 'Esmeralda', color: '#10b981' }
    ]
  },
  {
    id: 'frame_cyber_neon',
    name: 'Neon Cibernético',
    description: 'Circuito cibernético com traços de neon azul elétrico, pulsos em órbita e cantos chanfrados.',
    kind: 'AVATAR_FRAME',
    rarity: 'INCOMUM',
    price_xp: 450,
    min_level: 2,
    is_animated: true,
    order_index: 2,
    asset_url: '',
    style_data: {
      border: '2px solid #06b6d4',
      boxShadow: '0 0 12px rgba(6, 182, 212, 0.7), inset 0 0 6px rgba(6, 182, 212, 0.3)',
      theme: 'cyber'
    },
    color_variants: [
      { id: 'default', label: 'Ciano Neon (Padrão)', color: '#06b6d4' },
      { id: 'magenta', label: 'Magenta Cyber', color: '#f43f5e' },
      { id: 'green', label: 'Verde Matrix', color: '#22c55e' },
      { id: 'purple', label: 'Roxo Synth', color: '#a855f7' },
      { id: 'orange', label: 'Laranja Overdrive', color: '#f97316' }
    ]
  },
  {
    id: 'frame_emerald_veil',
    name: 'Véu de Esmeralda',
    description: 'Aura arcana viva em verde-esmeralda com respiração sutil de vinhas e esporos mágicos.',
    kind: 'AVATAR_FRAME',
    rarity: 'INCOMUM',
    price_xp: 500,
    min_level: 3,
    is_animated: true,
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
    description: 'Moldura pulsante com rotação de chamas solares e reflexos incandescentes da corona.',
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
      theme: 'solar'
    },
    color_variants: [
      { id: 'default', label: 'Chama Solar Ouro (Padrão)', color: '#f59e0b' },
      { id: 'blue', label: 'Fogo Azul Estelar', color: '#3b82f6' },
      { id: 'crimson', label: 'Chama Carmesim', color: '#ef4444' },
      { id: 'violet', label: 'Fogo Violeta Cósmico', color: '#a855f7' },
      { id: 'emerald', label: 'Chama Esmeralda', color: '#10b981' }
    ]
  },
  {
    id: 'frame_particle_stardust',
    name: 'Poeira Estelar',
    description: 'Micro-brilhos astrais em anéis giroscópicos contínuos em torno do avatar, inspirados no céu noturno.',
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
      theme: 'stardust'
    }
  },
  {
    id: 'frame_crystal_shards',
    name: 'Fragmentos de Prisma',
    description: 'Cristais facetados de quartzo cósmico em órbita harmônica octogonal com refração viva turquesa e magenta.',
    kind: 'AVATAR_FRAME',
    rarity: 'RARA',
    price_xp: 1200,
    min_level: 7,
    is_animated: true,
    order_index: 6,
    asset_url: '',
    style_data: {
      border: '2.5px solid #2dd4bf',
      boxShadow: '0 0 16px rgba(45, 212, 191, 0.75), inset 0 0 8px rgba(232, 121, 249, 0.4)',
      theme: 'crystal'
    }
  },
  {
    id: 'frame_lightning_storm',
    name: 'Tempestade Cósmica',
    description: 'Raios arcanos elétricos crepitantes com descargas de plasma violeta e ciano de alta voltagem.',
    kind: 'AVATAR_FRAME',
    rarity: 'EPICA',
    price_xp: 1900,
    min_level: 10,
    is_animated: true,
    order_index: 7,
    asset_url: '',
    style_data: {
      border: '2.8px solid #8b5cf6',
      boxShadow: '0 0 20px rgba(139, 92, 246, 0.85), 0 0 10px rgba(56, 189, 248, 0.6)',
      theme: 'lightning'
    }
  },
  {
    id: 'frame_aurora_mystic',
    name: 'Aurora Boreal Mística',
    description: 'Ondulação fluida de luzes boreais em gradiente espectral dinâmico violeta, ciano e menta.',
    kind: 'AVATAR_FRAME',
    rarity: 'EPICA',
    price_xp: 2200,
    min_level: 12,
    is_animated: true,
    order_index: 8,
    asset_url: '',
    style_data: {
      border: '3px solid #8b5cf6',
      boxShadow: '0 0 20px rgba(139, 92, 246, 0.8), inset 0 0 10px rgba(6, 182, 212, 0.5)',
      theme: 'aurora'
    }
  },
  {
    id: 'frame_crimson_eclipse',
    name: 'Eclipse Carmesim',
    description: 'Anel lunar vermelho profundo com corona escarlate viva, espinhos ardentes e pulsação incandescente.',
    kind: 'AVATAR_FRAME',
    rarity: 'LENDARIA',
    price_xp: 3200,
    min_level: 15,
    is_animated: true,
    order_index: 9,
    asset_url: '',
    style_data: {
      border: '3.5px solid #ef4444',
      boxShadow: '0 0 26px rgba(239, 68, 68, 0.9), inset 0 0 10px rgba(220, 38, 38, 0.6)',
      theme: 'crimson'
    }
  },
  {
    id: 'frame_void_vortex',
    name: 'Vórtice do Vazio',
    description: 'Singularidade gravitacional giratória com braços espirais de poeira dimensional e horizonte escuro do evento.',
    kind: 'AVATAR_FRAME',
    rarity: 'LENDARIA',
    price_xp: 3600,
    min_level: 17,
    is_animated: true,
    order_index: 10,
    asset_url: '',
    style_data: {
      border: '3.5px solid #7c3aed',
      boxShadow: '0 0 28px rgba(124, 58, 237, 0.9), inset 0 0 12px rgba(192, 132, 252, 0.5)',
      theme: 'vortex'
    }
  },
  {
    id: 'frame_astral_thorn_crown',
    name: 'Coroa de Espinhos da Noite',
    description: 'Diadema gótico entrelaçado com espinhos astrais afiados, rubis pulsantes e névoa abissal carmesim.',
    kind: 'AVATAR_FRAME',
    rarity: 'MITICA',
    price_xp: 5200,
    min_level: 20,
    is_animated: true,
    order_index: 11,
    asset_url: '',
    style_data: {
      border: '4px solid #f43f5e',
      boxShadow: '0 0 32px rgba(244, 63, 94, 0.9), 0 0 16px rgba(127, 29, 29, 0.8)',
      theme: 'thorn'
    }
  },
  {
    id: 'frame_celestial_sovereign',
    name: 'Coroa Celestial Nox',
    description: 'Diadema régio cósmico com filigrana dourada, gemas celestiais flutuantes e aura de constelações.',
    kind: 'AVATAR_FRAME',
    rarity: 'MITICA',
    price_xp: 5800,
    min_level: 22,
    is_animated: true,
    order_index: 12,
    asset_url: '',
    style_data: {
      border: '4px solid #fbbf24',
      boxShadow: '0 0 32px rgba(251, 191, 36, 0.95), 0 0 16px rgba(168, 85, 247, 0.7), inset 0 0 12px rgba(255, 255, 255, 0.8)',
      theme: 'celestial'
    }
  },

  // =========================================================================
  // B. CORES DE NOME (15 cores ricas de alto contraste no tema escuro)
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
    order_index: 13,
    asset_url: '',
    style_data: {
      color: '#a78bfa',
      textShadow: '0 0 8px rgba(167, 139, 250, 0.7)'
    }
  },
  {
    id: 'color_neon_cyan',
    name: 'Ciano Neon',
    description: 'Azul elétrico penetrante com destaque cristalino em qualquer fundo escuro.',
    kind: 'NAME_COLOR',
    rarity: 'COMUM',
    price_xp: 200,
    min_level: 1,
    is_animated: false,
    order_index: 14,
    asset_url: '',
    style_data: {
      color: '#38bdf8',
      textShadow: '0 0 8px rgba(56, 189, 248, 0.7)'
    }
  },
  {
    id: 'color_pure_starlight',
    name: 'Branco Estelar Puro',
    description: 'Branco celestial translúcido e nítido com halo perolado de altíssima legibilidade.',
    kind: 'NAME_COLOR',
    rarity: 'COMUM',
    price_xp: 250,
    min_level: 2,
    is_animated: false,
    order_index: 15,
    asset_url: '',
    style_data: {
      color: '#ffffff',
      textShadow: '0 0 10px rgba(255, 255, 255, 0.85), 0 0 2px #cbd5e1'
    }
  },
  {
    id: 'color_emerald_arcane',
    name: 'Esmeralda Arcana',
    description: 'Verde translúcido vibrante com vibração suave e excelente contraste.',
    kind: 'NAME_COLOR',
    rarity: 'INCOMUM',
    price_xp: 400,
    min_level: 3,
    is_animated: false,
    order_index: 16,
    asset_url: '',
    style_data: {
      color: '#34d399',
      textShadow: '0 0 8px rgba(52, 211, 153, 0.7)'
    }
  },
  {
    id: 'color_sapphire_astral',
    name: 'Azul Safira',
    description: 'Azul safira celestial profundo e elegante com brilho de constelação.',
    kind: 'NAME_COLOR',
    rarity: 'INCOMUM',
    price_xp: 450,
    min_level: 3,
    is_animated: false,
    order_index: 17,
    asset_url: '',
    style_data: {
      color: '#60a5fa',
      textShadow: '0 0 9px rgba(96, 165, 250, 0.8)'
    }
  },
  {
    id: 'color_toxic_neon',
    name: 'Verde Neon Tóxico',
    description: 'Verde cibernético ultra-aceso com irradiação brilhante que se sobressai no chat.',
    kind: 'NAME_COLOR',
    rarity: 'INCOMUM',
    price_xp: 500,
    min_level: 4,
    is_animated: false,
    order_index: 18,
    asset_url: '',
    style_data: {
      color: '#4ade80',
      textShadow: '0 0 10px rgba(74, 222, 128, 0.85)'
    }
  },
  {
    id: 'color_lunar_silver',
    name: 'Prata Lunar',
    description: 'Prata perolada límpida e refinada inspirada no brilho da lua cheia.',
    kind: 'NAME_COLOR',
    rarity: 'INCOMUM',
    price_xp: 500,
    min_level: 4,
    is_animated: false,
    order_index: 19,
    asset_url: '',
    style_data: {
      color: '#e2e8f0',
      textShadow: '0 0 10px rgba(226, 232, 240, 0.75)'
    }
  },
  {
    id: 'color_radiant_coral',
    name: 'Coral Radiante',
    description: 'Tom coral rosado incandescente com toque moderno, caloroso e marcante.',
    kind: 'NAME_COLOR',
    rarity: 'RARA',
    price_xp: 800,
    min_level: 5,
    is_animated: false,
    order_index: 20,
    asset_url: '',
    style_data: {
      color: '#fb7185',
      textShadow: '0 0 10px rgba(251, 113, 133, 0.75)'
    }
  },
  {
    id: 'color_glacial_turquoise',
    name: 'Turquesa Glacial',
    description: 'Turquesa gelada e cristalina com reflexo aquático luminoso de alta nitidez.',
    kind: 'NAME_COLOR',
    rarity: 'RARA',
    price_xp: 850,
    min_level: 6,
    is_animated: false,
    order_index: 21,
    asset_url: '',
    style_data: {
      color: '#2dd4bf',
      textShadow: '0 0 10px rgba(45, 212, 191, 0.8)'
    }
  },
  {
    id: 'color_solar_flare',
    name: 'Laranja Incandescente',
    description: 'Laranja solar vivo e flamejante emitindo calor estelar intenso.',
    kind: 'NAME_COLOR',
    rarity: 'RARA',
    price_xp: 900,
    min_level: 6,
    is_animated: false,
    order_index: 22,
    asset_url: '',
    style_data: {
      color: '#fb923c',
      textShadow: '0 0 10px rgba(251, 146, 60, 0.85), 0 0 4px #ea580c'
    }
  },
  {
    id: 'color_amethyst_magenta',
    name: 'Ametista Radiante',
    description: 'Magenta translúcido com energia arcana mística e contornos vívidos.',
    kind: 'NAME_COLOR',
    rarity: 'RARA',
    price_xp: 1100,
    min_level: 7,
    is_animated: false,
    order_index: 23,
    asset_url: '',
    style_data: {
      color: '#e879f9',
      textShadow: '0 0 11px rgba(232, 121, 249, 0.8)'
    }
  },
  {
    id: 'color_crimson_ruby',
    name: 'Vermelho Carmesim',
    description: 'Rubi abissal rubro e penetrante com aura flamejante de alta imponência.',
    kind: 'NAME_COLOR',
    rarity: 'EPICA',
    price_xp: 1600,
    min_level: 9,
    is_animated: false,
    order_index: 24,
    asset_url: '',
    style_data: {
      color: '#f87171',
      textShadow: '0 0 12px rgba(248, 113, 113, 0.85), 0 0 4px #dc2626'
    }
  },
  {
    id: 'color_solar_gold',
    name: 'Dourado Solar',
    description: 'Ouro radiante das estrelas com halo luminoso nobre e presença régia.',
    kind: 'NAME_COLOR',
    rarity: 'EPICA',
    price_xp: 1800,
    min_level: 10,
    is_animated: false,
    order_index: 25,
    asset_url: '',
    style_data: {
      color: '#fbbf24',
      textShadow: '0 0 12px rgba(251, 191, 36, 0.85), 0 0 4px #f59e0b'
    }
  },
  {
    id: 'color_twilight_gradient',
    name: 'Crepúsculo Cósmico',
    description: 'Gradiente animado de poente estelar (carmesim, âmbar e ouro) que reluz como o horizonte espacial.',
    kind: 'NAME_COLOR',
    rarity: 'LENDARIA',
    price_xp: 3200,
    min_level: 15,
    is_animated: true,
    order_index: 26,
    asset_url: '',
    style_data: {
      color: '#fb7185',
      backgroundImage: 'linear-gradient(90deg, #f43f5e 0%, #fb923c 50%, #fbbf24 100%)',
      textShadow: '0 0 14px rgba(244, 63, 94, 0.7)'
    }
  },
  {
    id: 'color_prism_gradient',
    name: 'Prisma Cósmico',
    description: 'Gradiente animado de três tons espectrais (violeta, ciano e menta) com reflexo luminoso dinâmico.',
    kind: 'NAME_COLOR',
    rarity: 'MITICA',
    price_xp: 4800,
    min_level: 20,
    is_animated: true,
    order_index: 27,
    asset_url: '',
    style_data: {
      color: '#c084fc',
      backgroundImage: 'linear-gradient(90deg, #c084fc 0%, #38bdf8 50%, #34d399 100%)',
      textShadow: '0 0 14px rgba(192, 132, 252, 0.7)'
    }
  },

  // =========================================================================
  // C. TÍTULOS CÓSMICOS (14 títulos temáticos imersivos da lore Nox)
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
    order_index: 28,
    asset_url: '',
    style_data: {
      color: '#a78bfa',
      badgeBorder: 'rgba(167, 139, 250, 0.4)',
      badgeBg: 'rgba(167, 139, 250, 0.12)'
    }
  },
  {
    id: 'title_vigia_nebulosa',
    name: 'Vigia da Nebulosa',
    description: 'Sentinela atento que observa o nascimento de novas histórias nas brumas cósmicas.',
    kind: 'TITLE',
    rarity: 'COMUM',
    price_xp: 250,
    min_level: 2,
    is_animated: false,
    order_index: 29,
    asset_url: '',
    style_data: {
      color: '#818cf8',
      badgeBorder: 'rgba(129, 140, 248, 0.4)',
      badgeBg: 'rgba(129, 140, 248, 0.12)'
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
    order_index: 30,
    asset_url: '',
    style_data: {
      color: '#38bdf8',
      badgeBorder: 'rgba(56, 189, 248, 0.4)',
      badgeBg: 'rgba(56, 189, 248, 0.12)'
    }
  },
  {
    id: 'title_portador_runas',
    name: 'Portador das Runas',
    description: 'Capaz de decifrar os glifos arcanos ocultos nas entrelinhas de cada capítulo.',
    kind: 'TITLE',
    rarity: 'INCOMUM',
    price_xp: 550,
    min_level: 4,
    is_animated: false,
    order_index: 31,
    asset_url: '',
    style_data: {
      color: '#2dd4bf',
      badgeBorder: 'rgba(45, 212, 191, 0.4)',
      badgeBg: 'rgba(45, 212, 191, 0.12)'
    }
  },
  {
    id: 'title_cronista_astral',
    name: 'Cronista Astral',
    description: 'Registrador fiel dos maiores épicos e das sagas mais memoráveis da comunidade.',
    kind: 'TITLE',
    rarity: 'RARA',
    price_xp: 850,
    min_level: 5,
    is_animated: false,
    order_index: 32,
    asset_url: '',
    style_data: {
      color: '#60a5fa',
      badgeBorder: 'rgba(96, 165, 250, 0.45)',
      badgeBg: 'rgba(96, 165, 250, 0.14)'
    }
  },
  {
    id: 'title_leitor_celestial',
    name: 'Leitor Celestial',
    description: 'Alcançou o cume das constelações de histórias mais aclamadas da plataforma.',
    kind: 'TITLE',
    rarity: 'RARA',
    price_xp: 950,
    min_level: 6,
    is_animated: false,
    order_index: 33,
    asset_url: '',
    style_data: {
      color: '#34d399',
      badgeBorder: 'rgba(52, 211, 153, 0.45)',
      badgeBg: 'rgba(52, 211, 153, 0.14)'
    }
  },
  {
    id: 'title_herdeiro_vazio',
    name: 'Herdeiro do Vazio',
    description: 'Aquele que carrega em seu espírito a vastidão infinita e o poder indomável do abismo estelar.',
    kind: 'TITLE',
    rarity: 'EPICA',
    price_xp: 1600,
    min_level: 9,
    is_animated: false,
    order_index: 34,
    asset_url: '',
    style_data: {
      color: '#c084fc',
      badgeBorder: 'rgba(192, 132, 252, 0.5)',
      badgeBg: 'rgba(192, 132, 252, 0.16)'
    }
  },
  {
    id: 'title_mestre_biblioteca',
    name: 'Mestre da Biblioteca Astral',
    description: 'Curador dos tomos mais raros e misteriosos guardados no coração do arquivo universal.',
    kind: 'TITLE',
    rarity: 'EPICA',
    price_xp: 2000,
    min_level: 11,
    is_animated: false,
    order_index: 35,
    asset_url: '',
    style_data: {
      color: '#facc15',
      badgeBorder: 'rgba(250, 204, 21, 0.5)',
      badgeBg: 'rgba(250, 204, 21, 0.16)'
    }
  },
  {
    id: 'title_arquiteto_constelacoes',
    name: 'Arquiteto de Constelações',
    description: 'Mapeador incansável de obras-primas e construtor de conexões cósmicas lendárias.',
    kind: 'TITLE',
    rarity: 'EPICA',
    price_xp: 2200,
    min_level: 12,
    is_animated: false,
    order_index: 36,
    asset_url: '',
    style_data: {
      color: '#e879f9',
      badgeBorder: 'rgba(232, 121, 249, 0.5)',
      badgeBg: 'rgba(232, 121, 249, 0.16)'
    }
  },
  {
    id: 'title_guardiao_eclipse',
    name: 'Guardião do Eclipse',
    description: 'Vigia do equilíbrio cósmico entre a luz ardente das estrelas e a sombra eterna do vácuo.',
    kind: 'TITLE',
    rarity: 'LENDARIA',
    price_xp: 3200,
    min_level: 15,
    is_animated: false,
    order_index: 37,
    asset_url: '',
    style_data: {
      color: '#f87171',
      badgeBorder: 'rgba(248, 113, 113, 0.55)',
      badgeBg: 'rgba(248, 113, 113, 0.16)'
    }
  },
  {
    id: 'title_senhor_constelacoes',
    name: 'Senhor das Constelações',
    description: 'Governante que traça os rumos dos astros e conecta as obras mais grandiosas do universo.',
    kind: 'TITLE',
    rarity: 'LENDARIA',
    price_xp: 3800,
    min_level: 17,
    is_animated: false,
    order_index: 38,
    asset_url: '',
    style_data: {
      color: '#38bdf8',
      badgeBorder: 'rgba(56, 189, 248, 0.55)',
      badgeBg: 'rgba(56, 189, 248, 0.16)'
    }
  },
  {
    id: 'title_soberano_estrelas',
    name: 'Soberano das Estrelas',
    description: 'Presença régia respeitada, cujo gosto guia as luzes mais brilhantes do firmamento.',
    kind: 'TITLE',
    rarity: 'LENDARIA',
    price_xp: 4200,
    min_level: 19,
    is_animated: false,
    order_index: 39,
    asset_url: '',
    style_data: {
      color: '#fbbf24',
      badgeBorder: 'rgba(251, 191, 36, 0.55)',
      badgeBg: 'rgba(251, 191, 36, 0.16)'
    }
  },
  {
    id: 'title_arauto_nox',
    name: 'Arauto do Nox',
    description: 'Mensageiro primordial que anuncia a chegada de uma nova era de leitura no Nox.',
    kind: 'TITLE',
    rarity: 'MITICA',
    price_xp: 5500,
    min_level: 21,
    is_animated: true,
    order_index: 40,
    asset_url: '',
    style_data: {
      color: '#f43f5e',
      textShadow: '0 0 10px #f43f5e, 0 0 18px #fb7185',
      badgeBorder: 'rgba(244, 63, 94, 0.65)',
      badgeBg: 'rgba(244, 63, 94, 0.2)'
    }
  },
  {
    id: 'title_lenda_do_nox',
    name: 'Lenda do Nox',
    description: 'O título supremo reservado aos ícones eternos gravados nos anais da plataforma.',
    kind: 'TITLE',
    rarity: 'MITICA',
    price_xp: 7000,
    min_level: 24,
    is_animated: true,
    order_index: 41,
    asset_url: '',
    style_data: {
      color: '#fbbf24',
      textShadow: '0 0 10px #fbbf24, 0 0 20px #f43f5e',
      badgeBorder: 'rgba(251, 191, 36, 0.7)',
      badgeBg: 'rgba(251, 191, 36, 0.2)'
    }
  },

  // =========================================================================
  // D. BANNERS DE PERFIL (6 banners procedurais animados em SVG/CSS)
  // =========================================================================
  {
    id: 'banner_nebulosa_vazio',
    name: 'Nebulosa do Vazio',
    description: 'Nuvem cósmica pulsante de poeira estelar violeta e azul profundo com constelações cintilantes.',
    kind: 'PROFILE_BANNER',
    rarity: 'COMUM',
    price_xp: 300,
    min_level: 2,
    is_animated: true,
    order_index: 42,
    asset_url: '',
    style_data: {
      background: CURATED_BANNER_BACKGROUNDS.banner_nebulosa_vazio
    }
  },
  {
    id: 'banner_aurora_astral',
    name: 'Aurora Astral',
    description: 'Cortinas ondulantes de luz etérea em ondas esmeralda e turquesa sobre a escuridão do espaço.',
    kind: 'PROFILE_BANNER',
    rarity: 'INCOMUM',
    price_xp: 600,
    min_level: 4,
    is_animated: true,
    order_index: 43,
    asset_url: '',
    style_data: {
      background: CURATED_BANNER_BACKGROUNDS.banner_aurora_astral
    }
  },
  {
    id: 'banner_energia_arcana',
    name: 'Energia Arcana',
    description: 'Vórtices de feitiçaria cósmica com astrolábio rúnico em rotação contínua e núcleo pulsante.',
    kind: 'PROFILE_BANNER',
    rarity: 'RARA',
    price_xp: 1000,
    min_level: 7,
    is_animated: true,
    order_index: 44,
    asset_url: '',
    style_data: {
      background: CURATED_BANNER_BACKGROUNDS.banner_energia_arcana
    }
  },
  {
    id: 'banner_eclipse_cosmico',
    name: 'Eclipse Cósmico',
    description: 'Corona solar viva em eclipse total com anel de fogo rubi emergente e feixe de diamante pulsante.',
    kind: 'PROFILE_BANNER',
    rarity: 'EPICA',
    price_xp: 1800,
    min_level: 10,
    is_animated: true,
    order_index: 45,
    asset_url: '',
    style_data: {
      background: CURATED_BANNER_BACKGROUNDS.banner_eclipse_cosmico
    }
  },
  {
    id: 'banner_biblioteca_estrelas',
    name: 'Biblioteca das Estrelas',
    description: 'Esfera armilar geométrica áurea em rotação celestial suave e constelações arcanas.',
    kind: 'PROFILE_BANNER',
    rarity: 'LENDARIA',
    price_xp: 3200,
    min_level: 15,
    is_animated: true,
    order_index: 46,
    asset_url: '',
    style_data: {
      background: CURATED_BANNER_BACKGROUNDS.banner_biblioteca_estrelas
    }
  },
  {
    id: 'banner_runas_primordiais',
    name: 'Fenda Rúnica',
    description: 'Fenda dimensional elétrica viva com glifos e monólitos arcanos flutuando em levitação mística.',
    kind: 'PROFILE_BANNER',
    rarity: 'MITICA',
    price_xp: 5000,
    min_level: 20,
    is_animated: true,
    order_index: 47,
    asset_url: '',
    style_data: {
      background: CURATED_BANNER_BACKGROUNDS.banner_runas_primordiais
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
