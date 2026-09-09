import { describe, it, expect } from 'vitest';
import {
  MAX_LEVEL,
  getXpForLevel,
  getLevelFromXp,
  getLevelProgress,
  NOX_TITLES,
  NOX_BADGES,
  getUnlockedTitles,
  getUnlockedBadges,
  resolveMemberRank
} from '../src/lib/levels';

describe('Project Nox Level System (1 to 100)', () => {
  it('defines max level as 100', () => {
    expect(MAX_LEVEL).toBe(100);
  });

  it('calculates XP thresholds progressively', () => {
    expect(getXpForLevel(1)).toBe(0);
    expect(getXpForLevel(2)).toBe(150); // 50*1^2 + 100*1 = 150
    expect(getXpForLevel(3)).toBe(400); // 50*4 + 100*2 = 400
    expect(getXpForLevel(5)).toBe(1200); // 50*16 + 100*4 = 1200
    expect(getXpForLevel(10)).toBe(4950); // 50*81 + 100*9 = 4950
    expect(getXpForLevel(100)).toBe(499950);
    expect(getXpForLevel(105)).toBe(499950); // Clamped at 100
  });

  it('determines level correctly from accumulated XP', () => {
    expect(getLevelFromXp(0)).toBe(1);
    expect(getLevelFromXp(-10)).toBe(1);
    expect(getLevelFromXp(149)).toBe(1);
    expect(getLevelFromXp(150)).toBe(2);
    expect(getLevelFromXp(151)).toBe(2);
    expect(getLevelFromXp(399)).toBe(2);
    expect(getLevelFromXp(400)).toBe(3);
    expect(getLevelFromXp(499950)).toBe(100);
    expect(getLevelFromXp(999999)).toBe(100);
  });

  it('computes detailed level progress and percentage accurately', () => {
    // 0 XP -> Level 1, 0% progress towards Level 2 (150 XP needed)
    const p1 = getLevelProgress(0);
    expect(p1.currentLevel).toBe(1);
    expect(p1.nextLevel).toBe(2);
    expect(p1.xpNeededForNext).toBe(150);
    expect(p1.progressPercent).toBe(0);
    expect(p1.isMaxLevel).toBe(false);

    // 75 XP (3 chapters read) -> Level 1, 50% progress towards Level 2 (150 XP)
    const p2 = getLevelProgress(75);
    expect(p2.currentLevel).toBe(1);
    expect(p2.nextLevel).toBe(2);
    expect(p2.xpNeededForNext).toBe(75);
    expect(p2.progressPercent).toBe(50);

    // Level 100 (Max Level)
    const pMax = getLevelProgress(600000);
    expect(pMax.currentLevel).toBe(100);
    expect(pMax.nextLevel).toBe(100);
    expect(pMax.xpNeededForNext).toBe(0);
    expect(pMax.progressPercent).toBe(100);
    expect(pMax.isMaxLevel).toBe(true);
  });

  it('unlocks titles strictly based on required levels', () => {
    const titlesLvl1 = getUnlockedTitles(1);
    expect(titlesLvl1.some((t) => t.id === 'nox-reader')).toBe(true);
    expect(titlesLvl1.some((t) => t.id === 'apex-nox')).toBe(false);

    const titlesLvl20 = getUnlockedTitles(20);
    expect(titlesLvl20.some((t) => t.id === 'bibliofilo')).toBe(true);
    expect(titlesLvl20.some((t) => t.id === 'vanguarda')).toBe(false);

    const titlesLvl100 = getUnlockedTitles(100);
    expect(titlesLvl100.length).toBe(NOX_TITLES.length);
    expect(titlesLvl100.some((t) => t.id === 'apex-nox')).toBe(true);
  });

  it('unlocks badges strictly based on required levels', () => {
    const badgesLvl1 = getUnlockedBadges(1);
    expect(badgesLvl1.some((b) => b.id === 'marca-inicial')).toBe(true);
    expect(badgesLvl1.some((b) => b.id === 'brasao-apex')).toBe(false);

    const badgesLvl50 = getUnlockedBadges(50);
    expect(badgesLvl50.some((b) => b.id === 'coroa-de-onix')).toBe(true);
    expect(badgesLvl50.some((b) => b.id === 'olho-do-eter')).toBe(false);

    const badgesLvl100 = getUnlockedBadges(100);
    expect(badgesLvl100.length).toBe(NOX_BADGES.length);
    expect(badgesLvl100.some((b) => b.id === 'brasao-apex')).toBe(true);
  });

  it('resolves member rank with equipped items or falls back safely', () => {
    // Level 1 member tries to equip Level 100 title -> falls back to highest unlocked
    const rank1 = resolveMemberRank(0, 'apex-nox', 'brasao-apex');
    expect(rank1.level).toBe(1);
    expect(rank1.title).toBe('Nox Reader');
    expect(rank1.badge).toBe('◈');
    expect(rank1.badgeSvg).toBe('/badges/badge-marca-inicial.svg');

    // Level 20 member equips valid title and badge
    const xpLvl20 = getXpForLevel(20);
    const rank20 = resolveMemberRank(xpLvl20, 'bibliofilo', 'sigilo-prateado');
    expect(rank20.level).toBe(20);
    expect(rank20.title).toBe('Bibliófilo');
    expect(rank20.badgeIcon).toBe('⬡');
    expect(rank20.badgeSvg).toBe('/badges/badge-sigilo-prateado.svg');
    expect(rank20.badgeTier).toBe('rare');
  });
});
