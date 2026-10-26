/**
 * Curated Cosmetics Catalog for Project Nox (Round 4)
 * Premium catalog with 74 verified cosmetic items:
 * - 18 Animated Avatar Frames (15 with real-time color customization)
 * - 24 High-Contrast Name Colors (including 6 animated multi-stop cosmic gradients)
 * - 22 Immersive Lore Titles with custom insignias
 * - 10 High-Definition Procedural Animated Vector Banners (SVG/CSS Keyframes)
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
  // A. MOLDURAS DE AVATAR (18 itens vetoriais ricos, 15 personalizáveis em cor)
  // =========================================================================
  {
    id: 'frame_cosmic_nox',
    name: 'Borda Cósmica Nox',
    description: 'Anel sutil forjado em ametista espacial com quatro gemas astrais cardeais e microestrelas giratórias.',
    kind: 'AVATAR_FRAME',
    rarity: 'COMUM',
    price_xp: 200,
    min_level: 1,
    is_animated: true,
    order_index: 1,
    asset_url: '',
    style_data: { border: '2px solid #a78bfa', boxShadow: '0 0 10px rgba(167, 139, 250, 0.55)', theme: 'cosmic' },
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
    description: 'Circuito cibernético com traços angulares de neon azul, pulsos orbitais de dados e suportes chanfrados.',
    kind: 'AVATAR_FRAME',
    rarity: 'INCOMUM',
    price_xp: 450,
    min_level: 2,
    is_animated: true,
    order_index: 2,
    asset_url: '',
    style_data: { border: '2px solid #06b6d4', boxShadow: '0 0 12px rgba(6, 182, 212, 0.7)', theme: 'cyber' },
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
    description: 'Aura arcana viva inspirada nas florestas do éter, com vinhas místicas entrelaçadas e esporos mágicos pulsando.',
    kind: 'AVATAR_FRAME',
    rarity: 'INCOMUM',
    price_xp: 500,
    min_level: 3,
    is_animated: true,
    order_index: 3,
    asset_url: '',
    style_data: { border: '2.5px solid #10b981', boxShadow: '0 0 14px rgba(16, 185, 129, 0.65)', theme: 'emerald' }
  },
  {
    id: 'frame_solar_flare',
    name: 'Chama Solar',
    description: 'Moldura pulsante com doze labaredas em rotação contínua (360°), reflexos incandescentes e crista da corona.',
    kind: 'AVATAR_FRAME',
    rarity: 'RARA',
    price_xp: 900,
    min_level: 5,
    is_animated: true,
    order_index: 4,
    asset_url: '',
    style_data: { border: '2.5px solid #f59e0b', boxShadow: '0 0 16px rgba(245, 158, 11, 0.8)', theme: 'solar' },
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
    description: 'Anéis elípticos estilo giroscópio com rotação em direções opostas e micro-brilhos astrais cintilando suavemente.',
    kind: 'AVATAR_FRAME',
    rarity: 'RARA',
    price_xp: 1100,
    min_level: 6,
    is_animated: true,
    order_index: 5,
    asset_url: '',
    style_data: { border: '2px solid #818cf8', boxShadow: '0 0 16px rgba(129, 140, 248, 0.75)', theme: 'stardust' },
    color_variants: [
      { id: 'default', label: 'Ametista Noturna (Padrão)', color: '#818cf8' },
      { id: 'gold', label: 'Poeira Dourada', color: '#fbbf24' },
      { id: 'cyan', label: 'Azul Espacial', color: '#38bdf8' },
      { id: 'crimson', label: 'Brasa Cósmica', color: '#ef4444' },
      { id: 'emerald', label: 'Vaga-Lumes Astrais', color: '#10b981' }
    ]
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
    style_data: { border: '2.5px solid #2dd4bf', boxShadow: '0 0 16px rgba(45, 212, 191, 0.75)', theme: 'crystal' },
    color_variants: [
      { id: 'default', label: 'Turquesa Glacial (Padrão)', color: '#2dd4bf' },
      { id: 'magenta', label: 'Quartzo Rosa', color: '#ec4899' },
      { id: 'blue', label: 'Safira Abissal', color: '#3b82f6' },
      { id: 'emerald', label: 'Esmeralda Prismática', color: '#10b981' },
      { id: 'gold', label: 'Topázio Imperial', color: '#fbbf24' }
    ]
  },
  {
    id: 'frame_oceanic_tide',
    name: 'Maremoto Astral',
    description: 'Cristas de ondas abissais translúcidas rodopiando com pérolas bioluminescentes submersas no vazio.',
    kind: 'AVATAR_FRAME',
    rarity: 'RARA',
    price_xp: 1350,
    min_level: 8,
    is_animated: true,
    order_index: 7,
    asset_url: '',
    style_data: { border: '2.5px solid #0284c7', boxShadow: '0 0 16px rgba(2, 132, 199, 0.8)', theme: 'oceanic' },
    color_variants: [
      { id: 'default', label: 'Azul Abissal (Padrão)', color: '#0284c7' },
      { id: 'cyan', label: 'Águas Turquesa', color: '#06b6d4' },
      { id: 'magenta', label: 'Recife de Coral', color: '#f43f5e' },
      { id: 'violet', label: 'Fossa das Marianas', color: '#8b5cf6' }
    ]
  },
  {
    id: 'frame_lightning_storm',
    name: 'Tempestade Cósmica',
    description: 'Raios arcanos elétricos crepitantes com descargas de plasma violeta e ciano de altíssima voltagem.',
    kind: 'AVATAR_FRAME',
    rarity: 'EPICA',
    price_xp: 1900,
    min_level: 10,
    is_animated: true,
    order_index: 8,
    asset_url: '',
    style_data: { border: '2.8px solid #8b5cf6', boxShadow: '0 0 20px rgba(139, 92, 246, 0.85)', theme: 'lightning' },
    color_variants: [
      { id: 'default', label: 'Plasma Elétrico (Padrão)', color: '#8b5cf6' },
      { id: 'cyan', label: 'Choque Ciano', color: '#06b6d4' },
      { id: 'crimson', label: 'Relâmpago Escarlate', color: '#ef4444' },
      { id: 'gold', label: 'Trovão Solar', color: '#fbbf24' },
      { id: 'green', label: 'Raio de Radiação', color: '#22c55e' }
    ]
  },
  {
    id: 'frame_runic_monolith',
    name: 'Relicário Rúnico',
    description: 'Placas e monólitos ancestrais esculpidos em pedra rúnica que orbitam magneticamente com glifos pulsantes.',
    kind: 'AVATAR_FRAME',
    rarity: 'EPICA',
    price_xp: 2050,
    min_level: 11,
    is_animated: true,
    order_index: 9,
    asset_url: '',
    style_data: { border: '2.8px solid #d97706', boxShadow: '0 0 18px rgba(217, 119, 6, 0.85)', theme: 'monolith' },
    color_variants: [
      { id: 'default', label: 'Ouro Rúnico (Padrão)', color: '#d97706' },
      { id: 'cyan', label: 'Glifos Glaciais', color: '#0284c7' },
      { id: 'crimson', label: 'Runas de Sangue', color: '#b91c1c' },
      { id: 'emerald', label: 'Talismã Telúrico', color: '#047857' }
    ]
  },
  {
    id: 'frame_aurora_mystic',
    name: 'Aurora Boreal Mística',
    description: 'Ondulação fluida de luzes boreais em gradiente espectral dinâmico violeta, ciano e menta com diadema de estrelas.',
    kind: 'AVATAR_FRAME',
    rarity: 'EPICA',
    price_xp: 2200,
    min_level: 12,
    is_animated: true,
    order_index: 10,
    asset_url: '',
    style_data: { border: '3px solid #8b5cf6', boxShadow: '0 0 20px rgba(139, 92, 246, 0.8)', theme: 'aurora' }
  },
  {
    id: 'frame_blossom_astral',
    name: 'Lótus Astral',
    description: 'Pétalas majestosas de lótus cósmico que se abrem e fecham em respiração mística com orvalho estelar luminoso.',
    kind: 'AVATAR_FRAME',
    rarity: 'EPICA',
    price_xp: 2400,
    min_level: 13,
    is_animated: true,
    order_index: 11,
    asset_url: '',
    style_data: { border: '3px solid #db2777', boxShadow: '0 0 22px rgba(219, 39, 119, 0.85)', theme: 'blossom' },
    color_variants: [
      { id: 'default', label: 'Lótus Mística (Padrão)', color: '#db2777' },
      { id: 'cyan', label: 'Lótus Celestial', color: '#06b6d4' },
      { id: 'gold', label: 'Lótus Solar', color: '#d97706' },
      { id: 'violet', label: 'Orquídea Noturna', color: '#7c3aed' }
    ]
  },
  {
    id: 'frame_crimson_eclipse',
    name: 'Eclipse Carmesim',
    description: 'Corona solar em eclipse total com anel de fogo rubi, espinhos escarlates e labaredas de trevas estelares.',
    kind: 'AVATAR_FRAME',
    rarity: 'LENDARIA',
    price_xp: 3200,
    min_level: 15,
    is_animated: true,
    order_index: 12,
    asset_url: '',
    style_data: { border: '3.5px solid #ef4444', boxShadow: '0 0 26px rgba(239, 68, 68, 0.9)', theme: 'crimson' }
  },
  {
    id: 'frame_void_vortex',
    name: 'Vórtice do Vazio',
    description: 'Singularidade gravitacional giratória com 3 braços espirais de poeira dimensional e horizonte escuro do evento.',
    kind: 'AVATAR_FRAME',
    rarity: 'LENDARIA',
    price_xp: 3600,
    min_level: 17,
    is_animated: true,
    order_index: 13,
    asset_url: '',
    style_data: { border: '3.5px solid #7c3aed', boxShadow: '0 0 28px rgba(124, 58, 237, 0.9)', theme: 'vortex' },
    color_variants: [
      { id: 'default', label: 'Púrpura Abissal (Padrão)', color: '#7c3aed' },
      { id: 'crimson', label: 'Buraco Negro Carmesim', color: '#ef4444' },
      { id: 'cyan', label: 'Singularidade Quântica', color: '#06b6d4' },
      { id: 'gold', label: 'Horizonte Solar', color: '#fbbf24' }
    ]
  },
  {
    id: 'frame_cyber_glitch_v2',
    name: 'Sobrecarga Quântica',
    description: 'Moldura de laser holo-hacker com distorção cromática glitch, suportes HUD de overclocking e feixes de radar.',
    kind: 'AVATAR_FRAME',
    rarity: 'LENDARIA',
    price_xp: 3900,
    min_level: 18,
    is_animated: true,
    order_index: 14,
    asset_url: '',
    style_data: { border: '3.5px solid #10b981', boxShadow: '0 0 26px rgba(16, 185, 129, 0.9)', theme: 'glitch' },
    color_variants: [
      { id: 'default', label: 'Verde Matrix (Padrão)', color: '#10b981' },
      { id: 'cyan', label: 'Ciano Holo-Radar', color: '#06b6d4' },
      { id: 'magenta', label: 'Cyberpunk Pink', color: '#f43f5e' },
      { id: 'gold', label: 'Alerta de Sobrecarga', color: '#f59e0b' }
    ]
  },
  {
    id: 'frame_abyssal_infernal',
    name: 'Chifres do Abismo',
    description: 'Chifres góticos de obsidiana ardente esculpidos nas profundezas com lava incandescente e brasas ascendentes.',
    kind: 'AVATAR_FRAME',
    rarity: 'LENDARIA',
    price_xp: 4400,
    min_level: 19,
    is_animated: true,
    order_index: 15,
    asset_url: '',
    style_data: { border: '3.8px solid #ef4444', boxShadow: '0 0 30px rgba(239, 68, 68, 0.95)', theme: 'infernal' },
    color_variants: [
      { id: 'default', label: 'Fogo Infernal (Padrão)', color: '#ef4444' },
      { id: 'green', label: 'Fogo Fátuo Verde', color: '#22c55e' },
      { id: 'blue', label: 'Fogo Azul Espectral', color: '#3b82f6' },
      { id: 'violet', label: 'Fumaça Abissal', color: '#a855f7' }
    ]
  },
  {
    id: 'frame_astral_thorn_crown',
    name: 'Coroa de Espinhos da Noite',
    description: 'Diadema gótico entrelaçado com espinhos astrais pontiagudos, rubis pulsantes e névoa espectral de ébano.',
    kind: 'AVATAR_FRAME',
    rarity: 'MITICA',
    price_xp: 5200,
    min_level: 20,
    is_animated: true,
    order_index: 16,
    asset_url: '',
    style_data: { border: '4px solid #f43f5e', boxShadow: '0 0 32px rgba(244, 63, 94, 0.9)', theme: 'thorn' },
    color_variants: [
      { id: 'default', label: 'Rubi da Noite (Padrão)', color: '#f43f5e' },
      { id: 'gold', label: 'Espinhos Áureos', color: '#f59e0b' },
      { id: 'cyan', label: 'Gelo Mortífero', color: '#0284c7' },
      { id: 'violet', label: 'Veneno Astral', color: '#7c3aed' }
    ]
  },
  {
    id: 'frame_angelic_seraph',
    name: 'Asas do Serafim',
    description: 'Asas sagradas de penas douradas e alvas com halo celestial flutuante e penas de luz estelar caindo suavemente.',
    kind: 'AVATAR_FRAME',
    rarity: 'MITICA',
    price_xp: 5600,
    min_level: 21,
    is_animated: true,
    order_index: 17,
    asset_url: '',
    style_data: { border: '4px solid #fbbf24', boxShadow: '0 0 34px rgba(251, 191, 36, 0.95)', theme: 'angelic' },
    color_variants: [
      { id: 'default', label: 'Serafim Dourado (Padrão)', color: '#fbbf24' },
      { id: 'silver', label: 'Alva Pura Celestial', color: '#f8fafc' },
      { id: 'magenta', label: 'Querubim Místico', color: '#ec4899' },
      { id: 'blue', label: 'Arcanjo dos Céus', color: '#38bdf8' }
    ]
  },
  {
    id: 'frame_celestial_sovereign',
    name: 'Coroa Celestial Nox',
    description: 'Diadema régio cósmico com filigrana dourada, gemas celestiais flutuantes e aura divina de constelações.',
    kind: 'AVATAR_FRAME',
    rarity: 'MITICA',
    price_xp: 6000,
    min_level: 22,
    is_animated: true,
    order_index: 18,
    asset_url: '',
    style_data: { border: '4px solid #fbbf24', boxShadow: '0 0 36px rgba(251, 191, 36, 0.95)', theme: 'celestial' },
    color_variants: [
      { id: 'default', label: 'Ouro Imperial (Padrão)', color: '#fbbf24' },
      { id: 'silver', label: 'Prata Celestial', color: '#e2e8f0' },
      { id: 'crimson', label: 'Monarca Carmesim', color: '#ef4444' },
      { id: 'blue', label: 'Soberano Astral', color: '#38bdf8' }
    ]
  },

  // =========================================================================
  // B. CORES DE NOME (24 cores de alto contraste, incluindo gradientes animados)
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
    order_index: 19,
    asset_url: '',
    style_data: { color: '#a78bfa', textShadow: '0 0 8px rgba(167, 139, 250, 0.7)' }
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
    order_index: 20,
    asset_url: '',
    style_data: { color: '#38bdf8', textShadow: '0 0 8px rgba(56, 189, 248, 0.7)' }
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
    order_index: 21,
    asset_url: '',
    style_data: { color: '#ffffff', textShadow: '0 0 10px rgba(255, 255, 255, 0.85), 0 0 2px #cbd5e1' }
  },
  {
    id: 'color_astral_lavender',
    name: 'Lavanda Astral',
    description: 'Lavanda etérea suave e limpa inspirada nas auroras serenas do cosmos.',
    kind: 'NAME_COLOR',
    rarity: 'COMUM',
    price_xp: 280,
    min_level: 2,
    is_animated: false,
    order_index: 22,
    asset_url: '',
    style_data: { color: '#c4b5fd', textShadow: '0 0 9px rgba(196, 181, 253, 0.8)' }
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
    order_index: 23,
    asset_url: '',
    style_data: { color: '#34d399', textShadow: '0 0 8px rgba(52, 211, 153, 0.7)' }
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
    order_index: 24,
    asset_url: '',
    style_data: { color: '#60a5fa', textShadow: '0 0 9px rgba(96, 165, 250, 0.8)' }
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
    order_index: 25,
    asset_url: '',
    style_data: { color: '#4ade80', textShadow: '0 0 10px rgba(74, 222, 128, 0.85)' }
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
    order_index: 26,
    asset_url: '',
    style_data: { color: '#e2e8f0', textShadow: '0 0 10px rgba(226, 232, 240, 0.75)' }
  },
  {
    id: 'color_glacial_mint',
    name: 'Verde Menta Glacial',
    description: 'Menta cristalina com frescor polar e iluminação estelar límpida.',
    kind: 'NAME_COLOR',
    rarity: 'INCOMUM',
    price_xp: 550,
    min_level: 4,
    is_animated: false,
    order_index: 27,
    asset_url: '',
    style_data: { color: '#6ee7b7', textShadow: '0 0 10px rgba(110, 231, 183, 0.85)' }
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
    order_index: 28,
    asset_url: '',
    style_data: { color: '#fb7185', textShadow: '0 0 10px rgba(251, 113, 133, 0.75)' }
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
    order_index: 29,
    asset_url: '',
    style_data: { color: '#2dd4bf', textShadow: '0 0 10px rgba(45, 212, 191, 0.8)' }
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
    order_index: 30,
    asset_url: '',
    style_data: { color: '#fb923c', textShadow: '0 0 10px rgba(251, 146, 60, 0.85), 0 0 4px #ea580c' }
  },
  {
    id: 'color_shock_pink',
    name: 'Rosa Choque Cósmico',
    description: 'Fúcsia elétrico vibrante com impacto penetrante e brilho neon arrojado.',
    kind: 'NAME_COLOR',
    rarity: 'RARA',
    price_xp: 950,
    min_level: 6,
    is_animated: false,
    order_index: 31,
    asset_url: '',
    style_data: { color: '#ec4899', textShadow: '0 0 11px rgba(236, 72, 153, 0.85)' }
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
    order_index: 32,
    asset_url: '',
    style_data: { color: '#e879f9', textShadow: '0 0 11px rgba(232, 121, 249, 0.8)' }
  },
  {
    id: 'color_amber_flame',
    name: 'Âmbar Chama Viva',
    description: 'Âmbar ardente e profundo, forjado no coração de forjas cósmicas ancestrais.',
    kind: 'NAME_COLOR',
    rarity: 'RARA',
    price_xp: 1200,
    min_level: 8,
    is_animated: false,
    order_index: 33,
    asset_url: '',
    style_data: { color: '#d97706', textShadow: '0 0 11px rgba(217, 119, 6, 0.85)' }
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
    order_index: 34,
    asset_url: '',
    style_data: { color: '#f87171', textShadow: '0 0 12px rgba(248, 113, 113, 0.85), 0 0 4px #dc2626' }
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
    order_index: 35,
    asset_url: '',
    style_data: { color: '#fbbf24', textShadow: '0 0 12px rgba(251, 191, 36, 0.85), 0 0 4px #f59e0b' }
  },
  {
    id: 'color_imperial_gold',
    name: 'Ouro Real Imperial',
    description: 'Tom régio âmbar-dourado de realeza soberana, denso e glorioso.',
    kind: 'NAME_COLOR',
    rarity: 'EPICA',
    price_xp: 2000,
    min_level: 11,
    is_animated: false,
    order_index: 36,
    asset_url: '',
    style_data: { color: '#f59e0b', textShadow: '0 0 12px rgba(245, 158, 11, 0.9), 0 0 4px #b45309' }
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
    order_index: 37,
    asset_url: '',
    style_data: {
      color: '#fb7185',
      backgroundImage: 'linear-gradient(90deg, #f43f5e 0%, #fb923c 50%, #fbbf24 100%)',
      textShadow: '0 0 14px rgba(244, 63, 94, 0.7)'
    }
  },
  {
    id: 'color_spectral_aurora',
    name: 'Aurora Espectral',
    description: 'Gradiente animado boreal translúcido (ciano, esmeralda e ametista) com transição de fases viva.',
    kind: 'NAME_COLOR',
    rarity: 'LENDARIA',
    price_xp: 3500,
    min_level: 16,
    is_animated: true,
    order_index: 38,
    asset_url: '',
    style_data: {
      color: '#38bdf8',
      backgroundImage: 'linear-gradient(90deg, #38bdf8 0%, #34d399 50%, #a855f7 100%)',
      textShadow: '0 0 14px rgba(56, 189, 248, 0.75)'
    }
  },
  {
    id: 'color_phoenix_blaze',
    name: 'Chama da Fênix',
    description: 'Gradiente animado de fogo imortal em três tons incandescentes (rubi, âmbar e amarelo solar).',
    kind: 'NAME_COLOR',
    rarity: 'LENDARIA',
    price_xp: 3800,
    min_level: 17,
    is_animated: true,
    order_index: 39,
    asset_url: '',
    style_data: {
      color: '#ef4444',
      backgroundImage: 'linear-gradient(90deg, #ef4444 0%, #f97316 50%, #eab308 100%)',
      textShadow: '0 0 14px rgba(239, 68, 68, 0.8)'
    }
  },
  {
    id: 'color_galactic_abyss',
    name: 'Abismo Galáctico',
    description: 'Gradiente animado misterioso de nebulosa profunda (violeta, fúcsia e safira).',
    kind: 'NAME_COLOR',
    rarity: 'LENDARIA',
    price_xp: 4200,
    min_level: 18,
    is_animated: true,
    order_index: 40,
    asset_url: '',
    style_data: {
      color: '#8b5cf6',
      backgroundImage: 'linear-gradient(90deg, #8b5cf6 0%, #ec4899 50%, #3b82f6 100%)',
      textShadow: '0 0 14px rgba(139, 92, 246, 0.8)'
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
    order_index: 41,
    asset_url: '',
    style_data: {
      color: '#c084fc',
      backgroundImage: 'linear-gradient(90deg, #c084fc 0%, #38bdf8 50%, #34d399 100%)',
      textShadow: '0 0 14px rgba(192, 132, 252, 0.7)'
    }
  },
  {
    id: 'color_golden_supernova',
    name: 'Supernova Dourada',
    description: 'Gradiente animado supremo com pulso estelar em branco puro, ouro reluzente e âmbar nobre.',
    kind: 'NAME_COLOR',
    rarity: 'MITICA',
    price_xp: 5500,
    min_level: 22,
    is_animated: true,
    order_index: 42,
    asset_url: '',
    style_data: {
      color: '#ffffff',
      backgroundImage: 'linear-gradient(90deg, #ffffff 0%, #fde047 50%, #f59e0b 100%)',
      textShadow: '0 0 16px rgba(251, 191, 36, 0.9), 0 0 4px #ffffff'
    }
  },

  // =========================================================================
  // C. TÍTULOS CÓSMICOS (22 títulos da rica lore do Nox com descrições polidas)
  // =========================================================================
  {
    id: 'title_viajante_estelar',
    name: 'Viajante Estelar',
    description: 'Concedido a quem dá os primeiros passos nas infinitas constelações literárias do Project Nox.',
    kind: 'TITLE',
    rarity: 'COMUM',
    price_xp: 150,
    min_level: 1,
    is_animated: false,
    order_index: 43,
    asset_url: '',
    style_data: { color: '#a78bfa', badgeBorder: 'rgba(167, 139, 250, 0.4)', badgeBg: 'rgba(167, 139, 250, 0.12)' }
  },
  {
    id: 'title_vanguarda_infinito',
    name: 'Vanguarda do Infinito',
    description: 'Leitor pioneiro que desbrava lançamentos e obras recém-nascidas no firmamento da comunidade.',
    kind: 'TITLE',
    rarity: 'COMUM',
    price_xp: 180,
    min_level: 1,
    is_animated: false,
    order_index: 44,
    asset_url: '',
    style_data: { color: '#93c5fd', badgeBorder: 'rgba(147, 197, 253, 0.4)', badgeBg: 'rgba(147, 197, 253, 0.12)' }
  },
  {
    id: 'title_vigia_nebulosa',
    name: 'Vigia da Nebulosa',
    description: 'Sentinela atenta e vigilante que observa o nascimento de grandes tramas através das brumas espaciais.',
    kind: 'TITLE',
    rarity: 'COMUM',
    price_xp: 250,
    min_level: 2,
    is_animated: false,
    order_index: 45,
    asset_url: '',
    style_data: { color: '#818cf8', badgeBorder: 'rgba(129, 140, 248, 0.4)', badgeBg: 'rgba(129, 140, 248, 0.12)' }
  },
  {
    id: 'title_guardiao_do_vazio',
    name: 'Guardião do Vazio',
    description: 'Para mentes destemidas que navegam sem hesitar pelas correntes mais misteriosas e enigmáticas.',
    kind: 'TITLE',
    rarity: 'INCOMUM',
    price_xp: 450,
    min_level: 3,
    is_animated: false,
    order_index: 46,
    asset_url: '',
    style_data: { color: '#38bdf8', badgeBorder: 'rgba(56, 189, 248, 0.4)', badgeBg: 'rgba(56, 189, 248, 0.12)' }
  },
  {
    id: 'title_sentinela_mares',
    name: 'Sentinela das Marés Estelares',
    description: 'Guardião dos fluxos de leitura, atento às correntes épicas que moldam as marés do catálogo.',
    kind: 'TITLE',
    rarity: 'INCOMUM',
    price_xp: 480,
    min_level: 3,
    is_animated: false,
    order_index: 47,
    asset_url: '',
    style_data: { color: '#06b6d4', badgeBorder: 'rgba(6, 182, 212, 0.4)', badgeBg: 'rgba(6, 182, 212, 0.12)' }
  },
  {
    id: 'title_portador_runas',
    name: 'Portador das Runas',
    description: 'Mestre na arte de decifrar os glifos ocultos e simbolismos narrativos nas entrelinhas de cada capítulo.',
    kind: 'TITLE',
    rarity: 'INCOMUM',
    price_xp: 550,
    min_level: 4,
    is_animated: false,
    order_index: 48,
    asset_url: '',
    style_data: { color: '#2dd4bf', badgeBorder: 'rgba(45, 212, 191, 0.4)', badgeBg: 'rgba(45, 212, 191, 0.12)' }
  },
  {
    id: 'title_navegador_vacuo',
    name: 'Navegador do Vácuo Profundo',
    description: 'Capaz de traçar rotas seguras através dos gêneros mais densos e complexos da ficção universal.',
    kind: 'TITLE',
    rarity: 'INCOMUM',
    price_xp: 600,
    min_level: 4,
    is_animated: false,
    order_index: 49,
    asset_url: '',
    style_data: { color: '#34d399', badgeBorder: 'rgba(52, 211, 153, 0.4)', badgeBg: 'rgba(52, 211, 153, 0.12)' }
  },
  {
    id: 'title_cronista_astral',
    name: 'Cronista Astral',
    description: 'Historiador e registrador fiel das jornadas e debates mais memoráveis travados entre os leitores.',
    kind: 'TITLE',
    rarity: 'RARA',
    price_xp: 850,
    min_level: 5,
    is_animated: false,
    order_index: 50,
    asset_url: '',
    style_data: { color: '#60a5fa', badgeBorder: 'rgba(96, 165, 250, 0.45)', badgeBg: 'rgba(96, 165, 250, 0.14)' }
  },
  {
    id: 'title_tece_estrelas',
    name: 'Tece-Estrelas de Ébano',
    description: 'Aquele que conecta fios narrativos distantes, desvendando mistérios intrincados do cosmos.',
    kind: 'TITLE',
    rarity: 'RARA',
    price_xp: 900,
    min_level: 6,
    is_animated: false,
    order_index: 51,
    asset_url: '',
    style_data: { color: '#c084fc', badgeBorder: 'rgba(192, 132, 252, 0.45)', badgeBg: 'rgba(192, 132, 252, 0.14)' }
  },
  {
    id: 'title_leitor_celestial',
    name: 'Leitor Celestial',
    description: 'Alcançou o ápice do horizonte de obras aclamadas, reconhecido pelo olhar apurado e dedicação.',
    kind: 'TITLE',
    rarity: 'RARA',
    price_xp: 950,
    min_level: 6,
    is_animated: false,
    order_index: 52,
    asset_url: '',
    style_data: { color: '#34d399', badgeBorder: 'rgba(52, 211, 153, 0.45)', badgeBg: 'rgba(52, 211, 153, 0.14)' }
  },
  {
    id: 'title_cavaleiro_eclipse',
    name: 'Cavaleiro do Eclipse Eterno',
    description: 'Guerreiro estelar que permanece firme no limiar entre a luz ofuscante da glória e a escuridão do abismo.',
    kind: 'TITLE',
    rarity: 'RARA',
    price_xp: 1050,
    min_level: 7,
    is_animated: false,
    order_index: 53,
    asset_url: '',
    style_data: { color: '#f87171', badgeBorder: 'rgba(248, 113, 113, 0.45)', badgeBg: 'rgba(248, 113, 113, 0.14)' }
  },
  {
    id: 'title_herdeiro_vazio',
    name: 'Herdeiro do Vazio',
    description: 'Carrega em seu espírito a vastidão imutável e a serenidade inquebrantável do espaço profundo.',
    kind: 'TITLE',
    rarity: 'EPICA',
    price_xp: 1600,
    min_level: 9,
    is_animated: false,
    order_index: 54,
    asset_url: '',
    style_data: { color: '#c084fc', badgeBorder: 'rgba(192, 132, 252, 0.5)', badgeBg: 'rgba(192, 132, 252, 0.16)' }
  },
  {
    id: 'title_sacerdote_solar',
    name: 'Sacerdote das Chamas Solares',
    description: 'Guardião dos fogos primordiais do saber, iluminando discussões e celebrando obras-primas com paixão.',
    kind: 'TITLE',
    rarity: 'EPICA',
    price_xp: 1850,
    min_level: 10,
    is_animated: false,
    order_index: 55,
    asset_url: '',
    style_data: { color: '#fbbf24', badgeBorder: 'rgba(251, 191, 36, 0.5)', badgeBg: 'rgba(251, 191, 36, 0.16)' }
  },
  {
    id: 'title_mestre_biblioteca',
    name: 'Mestre da Biblioteca Astral',
    description: 'Curador dos tomos mais raros e proibidos preservados no templo imemorial dos arquivos do Nox.',
    kind: 'TITLE',
    rarity: 'EPICA',
    price_xp: 2000,
    min_level: 11,
    is_animated: false,
    order_index: 56,
    asset_url: '',
    style_data: { color: '#facc15', badgeBorder: 'rgba(250, 204, 21, 0.5)', badgeBg: 'rgba(250, 204, 21, 0.16)' }
  },
  {
    id: 'title_arquiteto_constelacoes',
    name: 'Arquiteto de Constelações',
    description: 'Mapeador incansável de obras e arquiteto de conexões cósmicas lendárias que guiam a comunidade.',
    kind: 'TITLE',
    rarity: 'EPICA',
    price_xp: 2200,
    min_level: 12,
    is_animated: false,
    order_index: 57,
    asset_url: '',
    style_data: { color: '#e879f9', badgeBorder: 'rgba(232, 121, 249, 0.5)', badgeBg: 'rgba(232, 121, 249, 0.16)' }
  },
  {
    id: 'title_guardiao_eclipse',
    name: 'Guardião do Eclipse',
    description: 'Vigia do equilíbrio cósmico entre a luz ardente das estrelas e a sombra eterna do vácuo espacial.',
    kind: 'TITLE',
    rarity: 'LENDARIA',
    price_xp: 3200,
    min_level: 15,
    is_animated: false,
    order_index: 58,
    asset_url: '',
    style_data: { color: '#f87171', badgeBorder: 'rgba(248, 113, 113, 0.55)', badgeBg: 'rgba(248, 113, 113, 0.16)' }
  },
  {
    id: 'title_senhor_horizonte',
    name: 'Senhor do Horizonte de Eventos',
    description: 'Aquele que transcendeu a fronteira do tempo e contempla a eternidade das histórias do universo.',
    kind: 'TITLE',
    rarity: 'LENDARIA',
    price_xp: 3600,
    min_level: 16,
    is_animated: false,
    order_index: 59,
    asset_url: '',
    style_data: { color: '#a855f7', badgeBorder: 'rgba(168, 85, 247, 0.55)', badgeBg: 'rgba(168, 85, 247, 0.16)' }
  },
  {
    id: 'title_senhor_constelacoes',
    name: 'Senhor das Constelações',
    description: 'Governante supremo que traça o rumo dos astros e conecta as obras mais grandiosas e imortais.',
    kind: 'TITLE',
    rarity: 'LENDARIA',
    price_xp: 3800,
    min_level: 17,
    is_animated: false,
    order_index: 60,
    asset_url: '',
    style_data: { color: '#38bdf8', badgeBorder: 'rgba(56, 189, 248, 0.55)', badgeBg: 'rgba(56, 189, 248, 0.16)' }
  },
  {
    id: 'title_soberano_estrelas',
    name: 'Soberano das Estrelas',
    description: 'Presença régia respeitada, cujo gosto e sabedoria guiam as luzes mais brilhantes do firmamento.',
    kind: 'TITLE',
    rarity: 'LENDARIA',
    price_xp: 4200,
    min_level: 19,
    is_animated: false,
    order_index: 61,
    asset_url: '',
    style_data: { color: '#fbbf24', badgeBorder: 'rgba(251, 191, 36, 0.55)', badgeBg: 'rgba(251, 191, 36, 0.16)' }
  },
  {
    id: 'title_arauto_nox',
    name: 'Arauto do Nox',
    description: 'Mensageiro primordial que anuncia com pompa as maiores novidades e épicos da plataforma.',
    kind: 'TITLE',
    rarity: 'MITICA',
    price_xp: 5500,
    min_level: 21,
    is_animated: true,
    order_index: 62,
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
    description: 'O título supremo reservado aos ícones eternos cujos passos estão gravados nos anais do Project Nox.',
    kind: 'TITLE',
    rarity: 'MITICA',
    price_xp: 7000,
    min_level: 24,
    is_animated: true,
    order_index: 63,
    asset_url: '',
    style_data: {
      color: '#fbbf24',
      textShadow: '0 0 10px #fbbf24, 0 0 20px #f43f5e',
      badgeBorder: 'rgba(251, 191, 36, 0.7)',
      badgeBg: 'rgba(251, 191, 36, 0.2)'
    }
  },
  {
    id: 'title_entidade_transcendental',
    name: 'Entidade Transcendental',
    description: 'Atingiu a onipresença cósmica: uma lenda imortal que habita o tecido fundamental do Nox.',
    kind: 'TITLE',
    rarity: 'MITICA',
    price_xp: 7500,
    min_level: 25,
    is_animated: true,
    order_index: 64,
    asset_url: '',
    style_data: {
      color: '#c084fc',
      textShadow: '0 0 12px #c084fc, 0 0 24px #38bdf8',
      badgeBorder: 'rgba(192, 132, 252, 0.75)',
      badgeBg: 'rgba(192, 132, 252, 0.22)'
    }
  },

  // =========================================================================
  // D. BANNERS DE PERFIL (10 banners animados vetoriais com movimento dinâmico)
  // =========================================================================
  {
    id: 'banner_nebulosa_vazio',
    name: 'Nebulosa do Vazio',
    description: 'Nuvem cósmica pulsante de poeira estelar violeta e azul profundo com constelações e estrelas cadentes.',
    kind: 'PROFILE_BANNER',
    rarity: 'COMUM',
    price_xp: 300,
    min_level: 2,
    is_animated: true,
    order_index: 65,
    asset_url: '',
    style_data: { background: CURATED_BANNER_BACKGROUNDS.banner_nebulosa_vazio }
  },
  {
    id: 'banner_aurora_astral',
    name: 'Aurora Astral',
    description: 'Cortinas ondulantes de luz etérea em ondas esmeralda e turquesa sobre cordilheiras cósmicas da noite.',
    kind: 'PROFILE_BANNER',
    rarity: 'INCOMUM',
    price_xp: 600,
    min_level: 4,
    is_animated: true,
    order_index: 66,
    asset_url: '',
    style_data: { background: CURATED_BANNER_BACKGROUNDS.banner_aurora_astral }
  },
  {
    id: 'banner_energia_arcana',
    name: 'Energia Arcana',
    description: 'Vórtices de feitiçaria cósmica com astrolábio rúnico em rotação contínua e núcleo místico pulsante.',
    kind: 'PROFILE_BANNER',
    rarity: 'RARA',
    price_xp: 1000,
    min_level: 7,
    is_animated: true,
    order_index: 67,
    asset_url: '',
    style_data: { background: CURATED_BANNER_BACKGROUNDS.banner_energia_arcana }
  },
  {
    id: 'banner_chuva_meteoros',
    name: 'Chuva de Meteoros Cósmica',
    description: 'Céu profundo cortado por chuvas de meteoros incandescentes sobre o anel dourado de um planeta gasoso gigante.',
    kind: 'PROFILE_BANNER',
    rarity: 'RARA',
    price_xp: 1200,
    min_level: 8,
    is_animated: true,
    order_index: 68,
    asset_url: '',
    style_data: { background: CURATED_BANNER_BACKGROUNDS.banner_chuva_meteoros }
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
    order_index: 69,
    asset_url: '',
    style_data: { background: CURATED_BANNER_BACKGROUNDS.banner_eclipse_cosmico }
  },
  {
    id: 'banner_portal_abissal',
    name: 'Portal do Vácuo Quântico',
    description: 'Portal dimensional oval em rotação rápida com anéis de contenção quântica e horizonte de singularidade violeta.',
    kind: 'PROFILE_BANNER',
    rarity: 'EPICA',
    price_xp: 2100,
    min_level: 12,
    is_animated: true,
    order_index: 70,
    asset_url: '',
    style_data: { background: CURATED_BANNER_BACKGROUNDS.banner_portal_abissal }
  },
  {
    id: 'banner_biblioteca_estrelas',
    name: 'Biblioteca das Estrelas',
    description: 'Esfera armilar geométrica áurea em rotação celestial majestosa com coordenadas e constelações astrais.',
    kind: 'PROFILE_BANNER',
    rarity: 'LENDARIA',
    price_xp: 3200,
    min_level: 15,
    is_animated: true,
    order_index: 71,
    asset_url: '',
    style_data: { background: CURATED_BANNER_BACKGROUNDS.banner_biblioteca_estrelas }
  },
  {
    id: 'banner_jardim_astral',
    name: 'Jardim Botânico Astral',
    description: 'Santuário botânico cósmico com flores de lótus bioluminescentes respirando sob a luz da lua e pólen flutuante.',
    kind: 'PROFILE_BANNER',
    rarity: 'LENDARIA',
    price_xp: 3600,
    min_level: 16,
    is_animated: true,
    order_index: 72,
    asset_url: '',
    style_data: { background: CURATED_BANNER_BACKGROUNDS.banner_jardim_astral }
  },
  {
    id: 'banner_cidadela_celestial',
    name: 'Cidadela Flutuante do Nox',
    description: 'Espirais arquitetônicas góticas flutuando nas nuvens astrais com feixes de farol cósmico e constelações reluzentes.',
    kind: 'PROFILE_BANNER',
    rarity: 'MITICA',
    price_xp: 5000,
    min_level: 20,
    is_animated: true,
    order_index: 73,
    asset_url: '',
    style_data: { background: CURATED_BANNER_BACKGROUNDS.banner_cidadela_celestial }
  },
  {
    id: 'banner_runas_primordiais',
    name: 'Fenda Rúnica',
    description: 'Fenda dimensional elétrica viva com glifos e monólitos arcanos flutuando em levitação gravitacional contínua.',
    kind: 'PROFILE_BANNER',
    rarity: 'MITICA',
    price_xp: 5500,
    min_level: 21,
    is_animated: true,
    order_index: 74,
    asset_url: '',
    style_data: { background: CURATED_BANNER_BACKGROUNDS.banner_runas_primordiais }
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
