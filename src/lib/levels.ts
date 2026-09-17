/**
 * Project Nox — Centralized Level, Titles & Badges System (Levels 1 to 100)
 */

export const MAX_LEVEL = 100;

export interface NoxTitle {
  id: string;
  name: string;
  minLevel: number;
  description: string;
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
}

// Precompute cumulative XP thresholds for levels 1 to 100
// Formula: XP(L) = 50 * (L-1)^2 + 100 * (L-1)
// Invertible as: L = floor(sqrt(1 + XP / 50))
// Level 1: 0 XP
// Level 2: 150 XP
// Level 5: 1,200 XP
// Level 10: 4,950 XP
// Level 20: 19,950 XP
// Level 50: 124,950 XP
// Level 75: 281,200 XP
// Level 100: 499,950 XP
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

export function getLevelProgress(xp: number): LevelProgress {
  const safeXp = Math.max(0, Math.floor(xp || 0));
  const currentLevel = getLevelFromXp(safeXp);
  const isMaxLevel = currentLevel >= MAX_LEVEL;
  const levelMinXp = getXpForLevel(currentLevel);
  const nextLevel = isMaxLevel ? MAX_LEVEL : currentLevel + 1;
  const levelMaxXp = isMaxLevel ? levelMinXp : getXpForLevel(nextLevel);

  const xpInLevel = safeXp - levelMinXp;
  const xpNeededForNext = isMaxLevel ? 0 : levelMaxXp - safeXp;
  const levelSpan = levelMaxXp - levelMinXp;
  const progressPercent = isMaxLevel
    ? 100
    : Math.min(100, Math.max(0, Math.round((xpInLevel / (levelSpan || 1)) * 100)));

  return {
    currentLevel,
    nextLevel,
    currentXp: safeXp,
    levelMinXp,
    levelMaxXp,
    xpInLevel,
    xpNeededForNext,
    progressPercent,
    isMaxLevel
  };
}

export const NOX_TITLES: readonly NoxTitle[] = [
  {
    id: 'nox-reader',
    name: 'Nox Reader',
    minLevel: 1,
    description: 'Primeiros passos pelo vu de sombras da biblioteca.'
  },
  {
    id: 'aficionado',
    name: 'Aficionado',
    minLevel: 5,
    description: 'Ateno constante voltada aos novos lanamentos da Nox.'
  },
  {
    id: 'colecionador',
    name: 'Colecionador',
    minLevel: 10,
    description: 'Dezenas de tomos guardados na estante pessoal.'
  },
  {
    id: 'curador',
    name: 'Curador',
    minLevel: 15,
    description: 'Olhar apurado para narrativas refinadas e cativantes.'
  },
  {
    id: 'bibliofilo',
    name: 'Biblifilo',
    minLevel: 20,
    description: 'Amor devoto aos arcos e universos mais memorveis.'
  },
  {
    id: 'vanguarda',
    name: 'Vanguarda',
    minLevel: 30,
    description: 'Sempre na linha de frente dos grandes arcos da biblioteca.'
  },
  {
    id: 'virtuoso',
    name: 'Virtuoso',
    minLevel: 40,
    description: 'Mestre na arte de apreciar cada detalhe narrativo.'
  },
  {
    id: 'eminencia',
    name: 'Eminncia',
    minLevel: 50,
    description: 'Figura de prestgio e respeito nos corredores da Nox.'
  },
  {
    id: 'monolito',
    name: 'Monlito',
    minLevel: 60,
    description: 'Presena slida e inabalvel na comunidade.'
  },
  {
    id: 'luminar',
    name: 'Luminar',
    minLevel: 70,
    description: 'Luz radiante que guia novos leitores pela escurido.'
  },
  {
    id: 'primor',
    name: 'Primor',
    minLevel: 80,
    description: 'O pice do bom gosto e dedicao contnua.'
  },
  {
    id: 'zenite',
    name: 'Znite',
    minLevel: 90,
    description: 'Nas mais altas altitudes onde apenas os supremos alcanam.'
  },
  {
    id: 'apex-nox',
    name: 'Apex Nox',
    minLevel: 100,
    description: 'O topo absoluto da Project Nox. Uma lenda viva e imortal.'
  }
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
    name: 'Chama Novia',
    minLevel: 5,
    icon: '✧',
    svgUrl: '/badges/badge-chama-novica.svg',
    tier: 'common',
    description: 'A primeira fasca de paixo pela leitura acesa no peito.'
  },
  {
    id: 'prisma-noturno',
    name: 'Prisma Noturno',
    minLevel: 10,
    icon: '✦',
    svgUrl: '/badges/badge-prisma-noturno.svg',
    tier: 'uncommon',
    description: 'Refrata a essncia de dezenas de histrias consumidas.'
  },
  {
    id: 'sigilo-prateado',
    name: 'Sigilo Prateado',
    minLevel: 20,
    icon: '⬡',
    svgUrl: '/badges/badge-sigilo-prateado.svg',
    tier: 'rare',
    description: 'Insgnia esculpida na prata pura reservada aos veteranos.'
  },
  {
    id: 'reliquia-astral',
    name: 'Relquia Astral',
    minLevel: 35,
    icon: '❖',
    svgUrl: '/badges/badge-reliquia-astral.svg',
    tier: 'epic',
    description: 'Carregada com poeira csmica colhida em incontveis arcos.'
  },
  {
    id: 'coroa-de-onix',
    name: 'Coroa de nix',
    minLevel: 50,
    icon: '♛',
    svgUrl: '/badges/badge-coroa-de-onix.svg',
    tier: 'epic',
    description: 'Smbolo de prestgio imperial reconhecido por toda a comunidade.'
  },
  {
    id: 'olho-do-eter',
    name: 'Olho do ter',
    minLevel: 75,
    icon: '✪',
    svgUrl: '/badges/badge-olho-do-eter.svg',
    tier: 'legendary',
    description: 'Viso onisciente que abrange todas as pginas j escritas.'
  },
  {
    id: 'brasao-apex',
    name: 'Braso Apex',
    minLevel: 100,
    icon: '🜚',
    svgUrl: '/badges/badge-brasao-apex.svg',
    tier: 'mythic',
    description: 'O selo supremo. Raridade mitolgica portada apenas pelos supremos.'
  }
];

export function getUnlockedTitles(level: number): NoxTitle[] {
  return NOX_TITLES.filter((t) => t.minLevel <= level);
}

export function getUnlockedBadges(level: number): NoxBadge[] {
  return NOX_BADGES.filter((b) => b.minLevel <= level);
}

export function getTitleById(id: string | null | undefined): NoxTitle {
  if (!id) return NOX_TITLES[0];
  return NOX_TITLES.find((t) => t.id === id) || NOX_TITLES[0];
}

export function getBadgeById(id: string | null | undefined): NoxBadge {
  if (!id) return NOX_BADGES[0];
  return NOX_BADGES.find((b) => b.id === id) || NOX_BADGES[0];
}

export function resolveMemberRank(
  xp: number,
  equippedTitleId?: string | null,
  equippedBadgeId?: string | null
): { level: number; title: string; badge: string; badgeIcon: string; badgeSvg: string; badgeTier: string } {
  const level = getLevelFromXp(xp);
  const titleObj = getTitleById(equippedTitleId);
  const badgeObj = getBadgeById(equippedBadgeId);

  // Safety fallback: if equipped is higher than member's actual level, fallback to highest unlocked
  const validTitle =
    titleObj.minLevel <= level
      ? titleObj
      : [...getUnlockedTitles(level)].reverse()[0] || NOX_TITLES[0];

  const validBadge =
    badgeObj.minLevel <= level
      ? badgeObj
      : [...getUnlockedBadges(level)].reverse()[0] || NOX_BADGES[0];

  return {
    level,
    title: validTitle.name,
    badge: validBadge.icon,
    badgeIcon: validBadge.icon,
    badgeSvg: validBadge.svgUrl,
    badgeTier: validBadge.tier
  };
}
