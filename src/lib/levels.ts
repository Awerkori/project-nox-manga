/**
 * Project Nox — Centralized Level, Titles & Badges System (Levels 1 to 100)
 *
 * Seasonal progression:
 * - Every reader begins at Level 1 with 0 XP.
 * - XP accumulates within the active season.
 * - Level 1 immediately unlocks the starter achievement title: "Primeiro Desperto".
 * - 11 Achievement Titles are unlocked at progression milestones:
 *   Nv. 1, Nv. 10, Nv. 20, Nv. 30, Nv. 40, Nv. 50, Nv. 60, Nv. 70, Nv. 80, Nv. 90, Nv. 100.
 *
 * GOLDEN RULE OF RANKING:
 * - In the RANKING (Podium, Leaderboard rows, Personal Progress Card, Search results),
 *   the displayed title is ALWAYS the current Achievement Title corresponding to the reader's level.
 * - Readers can OPTIONALLY equip any unlocked achievement title in their profile,
 *   which will be displayed in public profiles and comments without overriding the ranking rule.
 */

export const MAX_LEVEL = 100;

export interface NoxTitle {
  id: string;
  name: string;
  minLevel: number;
  description: string;
  isTemporary?: boolean;
  isExclusiveWinner?: boolean;
  tier?: 'comum' | 'incomum' | 'rara' | 'epica' | 'lendaria' | 'mitica';
  color?: string;
}

export interface NoxBadge {
  id: string;
  name: string;
  minLevel: number;
  icon: string;
  svgUrl: string;
  tier: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';
  description: string;
}

export interface LevelProgress {
  currentLevel: number;
  nextLevel: number;
  currentXp: number;
  levelMinXp: number;
  levelMaxXp: number;
  xpInLevel: number;
  xpNeededForNext: number;
  progressPercent: number;
  isMaxLevel: boolean;
  currentAchievementTitle: NoxTitle;
  nextAchievementTitle: NoxTitle | null;
}

// Precomputed XP thresholds for Level 1 to 100
// Level 1: 0 XP
// Level 2: 150 XP
// Level 3: 400 XP
// Level 10: 4,950 XP
// Level 11: 6,000 XP
// Level 50: 124,950 XP
// Level 100: 499,950 XP (~500,000 XP)
const XP_THRESHOLDS = new Array<number>(MAX_LEVEL + 1);
XP_THRESHOLDS[0] = 0;
XP_THRESHOLDS[1] = 0;
for (let lvl = 2; lvl <= MAX_LEVEL; lvl++) {
  const n = lvl - 1;
  XP_THRESHOLDS[lvl] = 50 * n * n + 100 * n;
}

export function getXpForLevel(level: number): number {
  if (level <= 1) return 0;
  if (level >= MAX_LEVEL) return XP_THRESHOLDS[MAX_LEVEL];
  return XP_THRESHOLDS[level];
}

export function getLevelFromXp(xp: number): number {
  const safeXp = Math.max(0, Math.floor(xp || 0));
  const calculatedLevel = Math.floor(Math.sqrt(1 + safeXp / 50));
  return Math.min(MAX_LEVEL, Math.max(1, calculatedLevel));
}

/**
 * 11 Distinct, Short, Prestigious Achievement Titles (Unlocked at milestones from Level 1 to Level 100)
 * Free of generic repetitions, tightly structured, and memorable.
 */
export const NOX_SEASON_ACHIEVEMENT_TITLES: readonly NoxTitle[] = [
  {
    id: 'titulo-nv1-centelha-veu',
    name: 'Primeiro Desperto',
    minLevel: 1,
    description: 'Abriu os olhos para os primeiros mistérios ocultos na biblioteca.',
    isTemporary: true,
    tier: 'comum',
    color: '#818cf8'
  },
  {
    id: 'titulo-nv10-tecelao-sombras',
    name: 'Andarilho do Vazio',
    minLevel: 10,
    description: 'Caminha com destreza pelas fendas esquecidas do desconhecido.',
    isTemporary: true,
    tier: 'incomum',
    color: '#a78bfa'
  },
  {
    id: 'titulo-nv20-peregrino-eter',
    name: 'Navegador do Éter',
    minLevel: 20,
    description: 'Domina as correntes invisíveis que conectam os mundos escritos.',
    isTemporary: true,
    tier: 'rara',
    color: '#38bdf8'
  },
  {
    id: 'titulo-nv30-sentinela-eclipse',
    name: 'Vigia do Eclipse',
    minLevel: 30,
    description: 'Posto solitário no limiar onde a luz cede espaço ao mistério ancestral.',
    isTemporary: true,
    tier: 'rara',
    color: '#c084fc'
  },
  {
    id: 'titulo-nv40-geometra-constelacoes',
    name: 'Geômetra do Caos',
    minLevel: 40,
    description: 'Decifra padrões ocultos e a arquitetura secreta dos arcos narrativos.',
    isTemporary: true,
    tier: 'epica',
    color: '#f472b6'
  },
  {
    id: 'titulo-nv50-hierofante-abismo',
    name: 'Hierofante Abissal',
    minLevel: 50,
    description: 'Canalizador de ritos ancestrais e guardião dos tomos arcanos.',
    isTemporary: true,
    tier: 'epica',
    color: '#fb923c'
  },
  {
    id: 'titulo-nv60-suserano-noite',
    name: 'Regente da Noite',
    minLevel: 60,
    description: 'Autoridade imponente cuja presença ecoa por incontáveis páginas.',
    isTemporary: true,
    tier: 'lendaria',
    color: '#e879f9'
  },
  {
    id: 'titulo-nv70-oraculo-singularidade',
    name: 'Oráculo da Singularidade',
    minLevel: 70,
    description: 'Visão além do horizonte de eventos, antecipando o desfecho de toda era.',
    isTemporary: true,
    tier: 'lendaria',
    color: '#4ade80'
  },
  {
    id: 'titulo-nv80-arconte-primordial',
    name: 'Arconte do Limiar',
    minLevel: 80,
    description: 'Entidade venerada que habita a fronteira entre o real e o mito.',
    isTemporary: true,
    tier: 'mitica',
    color: '#2dd4bf'
  },
  {
    id: 'titulo-nv90-soberano-supremo',
    name: 'Juiz do Apogeu',
    minLevel: 90,
    description: 'Árbitro supremo do zênite mítico, reverenciado pelas eras.',
    isTemporary: true,
    tier: 'mitica',
    color: '#facc15'
  },
  {
    id: 'titulo-nv100-apex-nox',
    name: 'Apex Nox',
    minLevel: 100,
    description: 'A maestria máxima e encarnação lendária do universo Nox.',
    isTemporary: true,
    tier: 'mitica',
    color: '#f43f5e'
  }
];

export const NOX_SEASON_MILESTONE_TITLES = NOX_SEASON_ACHIEVEMENT_TITLES;

/**
 * Get the current achievement title corresponding to the reader's level.
 * Rule: returns the highest unlocked achievement title (minLevel <= level).
 */
export function getAchievementTitleForLevel(level: number): NoxTitle {
  const safeLevel = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level || 1)));
  let best = NOX_SEASON_ACHIEVEMENT_TITLES[0];
  for (const t of NOX_SEASON_ACHIEVEMENT_TITLES) {
    if (t.minLevel <= safeLevel) {
      best = t;
    } else {
      break;
    }
  }
  return best;
}

/**
 * Get the next upcoming achievement title after the current level.
 */
export function getNextAchievementTitle(level: number): NoxTitle | null {
  const safeLevel = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level || 1)));
  for (const t of NOX_SEASON_ACHIEVEMENT_TITLES) {
    if (t.minLevel > safeLevel) {
      return t;
    }
  }
  return null;
}

/**
 * Top 3 Permanent Hall of Fame Prestigious Titles
 * Awarded exclusively at season closing, survive all resets forever.
 */
export const NOX_HALL_OF_FAME_TITLES: readonly NoxTitle[] = [
  {
    id: 'hof-s1-campeao',
    name: 'Campeão da 1ª Temporada — Despertar Cósmico',
    minLevel: 0,
    description: '1º Lugar Supremo na Temporada 1: Despertar Cósmico. Título permanente imortalizado no Hall da Fama.',
    isExclusiveWinner: true,
    tier: 'mitica',
    color: '#fbbf24'
  },
  {
    id: 'hof-s1-vice',
    name: 'Vice-Campeão da 1ª Temporada — Despertar Cósmico',
    minLevel: 0,
    description: '2º Lugar no Pódio na Temporada 1: Despertar Cósmico. Título permanente imortalizado no Hall da Fama.',
    isExclusiveWinner: true,
    tier: 'lendaria',
    color: '#94a3b8'
  },
  {
    id: 'hof-s1-terceiro',
    name: 'Terceiro Colocado da 1ª Temporada — Despertar Cósmico',
    minLevel: 0,
    description: '3º Lugar no Pódio na Temporada 1: Despertar Cósmico. Título permanente imortalizado no Hall da Fama.',
    isExclusiveWinner: true,
    tier: 'epica',
    color: '#d97706'
  }
];

export const NOX_TITLES: readonly NoxTitle[] = [
  ...NOX_SEASON_ACHIEVEMENT_TITLES,
  ...NOX_HALL_OF_FAME_TITLES
];

export const NOX_BADGES: readonly NoxBadge[] = [
  {
    id: 'marca-inicial',
    name: 'Marca Inicial',
    minLevel: 1,
    icon: '◈',
    svgUrl: '/badges/badge-marca-inicial.svg',
    tier: 'common',
    description: 'A marca primordial gravada na jornada de todo membro Nox.'
  },
  {
    id: 'chama-novica',
    name: 'Chama Noviça',
    minLevel: 5,
    icon: '✧',
    svgUrl: '/badges/badge-chama-novica.svg',
    tier: 'common',
    description: 'A primeira faísca de paixão pela leitura acesa no peito.'
  },
  {
    id: 'prisma-noturno',
    name: 'Prisma Noturno',
    minLevel: 10,
    icon: '✦',
    svgUrl: '/badges/badge-prisma-noturno.svg',
    tier: 'uncommon',
    description: 'Refrata a essência de dezenas de histórias consumidas.'
  },
  {
    id: 'sigilo-prateado',
    name: 'Sigilo Prateado',
    minLevel: 20,
    icon: '⬡',
    svgUrl: '/badges/badge-sigilo-prateado.svg',
    tier: 'rare',
    description: 'Insígnia esculpida na prata pura reservada aos veteranos.'
  },
  {
    id: 'reliquia-astral',
    name: 'Relíquia Astral',
    minLevel: 35,
    icon: '❖',
    svgUrl: '/badges/badge-reliquia-astral.svg',
    tier: 'epic',
    description: 'Carregada com poeira cósmica colhida em incontáveis arcos.'
  },
  {
    id: 'coroa-de-onix',
    name: 'Coroa de Ônix',
    minLevel: 50,
    icon: '♛',
    svgUrl: '/badges/badge-coroa-de-onix.svg',
    tier: 'epic',
    description: 'Símbolo de prestígio imperial reconhecido por toda a comunidade.'
  },
  {
    id: 'olho-do-eter',
    name: 'Olho do Éter',
    minLevel: 75,
    icon: '✪',
    svgUrl: '/badges/badge-olho-do-eter.svg',
    tier: 'legendary',
    description: 'Visão onisciente que abrange todas as páginas já escritas.'
  },
  {
    id: 'brasao-apex',
    name: 'Brasão Apex',
    minLevel: 100,
    icon: '🜚',
    svgUrl: '/badges/badge-brasao-apex.svg',
    tier: 'mythic',
    description: 'O selo supremo. Raridade mitológica portada apenas pelos mestres absolutos.'
  }
];

export function getUnlockedTitles(level: number): NoxTitle[] {
  return NOX_SEASON_ACHIEVEMENT_TITLES.filter((t) => t.minLevel <= level);
}

export function getUnlockedBadges(level: number): NoxBadge[] {
  return NOX_BADGES.filter((b) => b.minLevel <= level);
}

export function getTitleById(id: string | null | undefined): NoxTitle {
  if (!id) return NOX_SEASON_ACHIEVEMENT_TITLES[0];
  const found = NOX_TITLES.find(
    (t) => t.id === id || t.name.toLowerCase() === id.toLowerCase()
  );
  return (
    found || {
      id: 'custom',
      name: id,
      minLevel: 1,
      description: 'Título personalizado do Project Nox.'
    }
  );
}

export function getBadgeById(id: string | null | undefined): NoxBadge {
  if (!id) return NOX_BADGES[0];
  return NOX_BADGES.find((b) => b.id === id) || NOX_BADGES[0];
}

export function getLevelProgress(xp: number): LevelProgress {
  const safeXp = Math.max(0, Math.floor(xp || 0));
  const currentLevel = getLevelFromXp(safeXp);
  const isMaxLevel = currentLevel >= MAX_LEVEL;
  const levelMinXp = getXpForLevel(currentLevel);
  const nextLevel = isMaxLevel ? MAX_LEVEL : currentLevel + 1;
  const levelMaxXp = isMaxLevel ? levelMinXp : getXpForLevel(nextLevel);

  const xpInLevel = safeXp - levelMinXp;
  const xpNeededForNext = isMaxLevel ? 0 : Math.max(0, levelMaxXp - safeXp);
  const levelSpan = levelMaxXp - levelMinXp || 1;
  const progressPercent = isMaxLevel
    ? 100
    : Math.min(100, Math.max(0, Math.round((xpInLevel / levelSpan) * 100)));

  return {
    currentLevel,
    nextLevel,
    currentXp: safeXp,
    levelMinXp,
    levelMaxXp,
    xpInLevel,
    xpNeededForNext,
    progressPercent,
    isMaxLevel,
    currentAchievementTitle: getAchievementTitleForLevel(currentLevel),
    nextAchievementTitle: getNextAchievementTitle(currentLevel)
  };
}

/**
 * Resolver for profile/comment rank presentation (takes into account optional equipped title).
 */
export function resolveMemberRank(
  xp: number,
  equippedTitleId?: string | null,
  equippedBadgeId?: string | null
): { level: number; title: string; badge: string; badgeIcon: string; badgeSvg: string; badgeTier: string } {
  const level = getLevelFromXp(xp);
  const badgeObj = getBadgeById(equippedBadgeId);

  let titleName = getAchievementTitleForLevel(level).name;

  if (equippedTitleId && equippedTitleId !== 'none') {
    const titleObj = getTitleById(equippedTitleId);
    if (titleObj.isExclusiveWinner || titleObj.id === 'custom' || titleObj.id.startsWith('title_')) {
      titleName = titleObj.name;
    } else if (titleObj.minLevel <= level) {
      titleName = titleObj.name;
    }
  }

  const validBadge =
    badgeObj.minLevel <= level
      ? badgeObj
      : [...getUnlockedBadges(level)].reverse()[0] || NOX_BADGES[0];

  return {
    level,
    title: titleName,
    badge: validBadge.icon,
    badgeIcon: validBadge.icon,
    badgeSvg: validBadge.svgUrl,
    badgeTier: validBadge.tier
  };
}

/**
 * Resolver for RANKING leaderboard (podium, list, search, personal progress):
 * By the Golden Rule, the title is STRICTLY the seasonal achievement title for the member's current level.
 */
export function resolveRankingDisplay(
  seasonXp: number,
  equippedBadgeId?: string | null
): { level: number; achievementTitle: NoxTitle; title: string; badge: string; badgeIcon: string } {
  const level = getLevelFromXp(seasonXp);
  const achievementTitle = getAchievementTitleForLevel(level);
  const badgeObj = getBadgeById(equippedBadgeId);
  const validBadge =
    badgeObj.minLevel <= level
      ? badgeObj
      : [...getUnlockedBadges(level)].reverse()[0] || NOX_BADGES[0];

  return {
    level,
    achievementTitle,
    title: achievementTitle.name,
    badge: validBadge.icon,
    badgeIcon: validBadge.icon
  };
}
