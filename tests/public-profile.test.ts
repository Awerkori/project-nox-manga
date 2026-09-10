import { describe, it, expect } from 'vitest';
import { NOX_TITLES } from '../src/lib/levels';

describe('Public Profile: Business Logic & Privacy Rules', () => {
  const RARITY_WEIGHT: Record<string, number> = {
    MITICA: 6,
    LENDARIA: 5,
    EPICA: 4,
    RARA: 3,
    INCOMUM: 2,
    COMUM: 1
  };

  function computeFeaturedAchievement(
    member: { featured_achievement_id?: string | null; equipped_badge_id?: string | null },
    achievements: any[]
  ) {
    if (member.featured_achievement_id) {
      const found = achievements.find((a) => a.id === member.featured_achievement_id);
      if (found) return found;
    }
    if (member.equipped_badge_id) {
      const found = achievements.find((a) => a.id === member.equipped_badge_id);
      if (found) return found;
    }
    if (achievements.length > 0) {
      const sorted = [...achievements].sort((a, b) => {
        const wa = RARITY_WEIGHT[a.rarity] || 1;
        const wb = RARITY_WEIGHT[b.rarity] || 1;
        if (wa !== wb) return wb - wa;
        return new Date(b.unlocked_at).getTime() - new Date(a.unlocked_at).getTime();
      });
      return sorted[0] || null;
    }
    return null;
  }

  function computeRarityBreakdown(achievements: any[]) {
    const counts: Record<string, number> = {
      MITICA: 0,
      LENDARIA: 0,
      EPICA: 0,
      RARA: 0,
      INCOMUM: 0,
      COMUM: 0
    };
    for (const ach of achievements) {
      const r = (ach.rarity || 'COMUM').toUpperCase();
      if (counts[r] !== undefined) counts[r]++;
    }
    return counts;
  }

  function deduplicateCosmetics(
    inventory: any[],
    member: {
      created_at: string;
      avatar_frame_id?: string | null;
      equipped_title_id?: string | null;
      equipped_banner_id?: string | null;
      name_color?: string | null;
    },
    legacyShopItems: any[] = []
  ) {
    const cosmeticsMap = new Map<string, any>();

    for (const row of inventory) {
      if (row.shop_items?.id && !cosmeticsMap.has(row.shop_items.id)) {
        cosmeticsMap.set(row.shop_items.id, {
          id: row.shop_items.id,
          name: row.shop_items.name,
          kind: row.shop_items.kind,
          rarity: row.shop_items.rarity || 'COMUM'
        });
      }
    }

    for (const item of legacyShopItems) {
      if (!cosmeticsMap.has(item.id)) {
        cosmeticsMap.set(item.id, {
          id: item.id,
          name: item.name,
          kind: item.kind,
          rarity: item.rarity || 'COMUM'
        });
      }
    }

    if (member.equipped_title_id && !cosmeticsMap.has(member.equipped_title_id)) {
      const noxTitle = NOX_TITLES.find(
        (t) =>
          t.id.toLowerCase() === member.equipped_title_id?.toLowerCase() ||
          t.name.toLowerCase() === member.equipped_title_id?.toLowerCase()
      );
      if (noxTitle) {
        cosmeticsMap.set(noxTitle.id, {
          id: noxTitle.id,
          name: noxTitle.name,
          kind: 'TITLE',
          rarity: 'COMUM'
        });
      }
    }

    if (member.name_color && !cosmeticsMap.has(member.name_color)) {
      cosmeticsMap.set(member.name_color, {
        id: member.name_color,
        name: 'Cor Personalizada',
        kind: 'NAME_COLOR',
        rarity: 'RARA'
      });
    }

    return Array.from(cosmeticsMap.values());
  }

  describe('Featured Achievement determination', () => {
    const achCommon = { id: 'ach-1', title: 'Primeira Leitura', rarity: 'COMUM', unlocked_at: '2026-01-01' };
    const achRare = { id: 'ach-2', title: 'Maratonista', rarity: 'RARA', unlocked_at: '2026-02-01' };
    const achLegendary = { id: 'ach-3', title: 'Lorde das Sombras', rarity: 'LENDARIA', unlocked_at: '2026-03-01' };
    const achMythic = { id: 'ach-4', title: 'Ascensão Nox', rarity: 'MITICA', unlocked_at: '2026-04-01' };

    it('prioritizes explicit user pin over highest rarity', () => {
      const featured = computeFeaturedAchievement(
        { featured_achievement_id: 'ach-2', equipped_badge_id: 'ach-3' },
        [achCommon, achRare, achLegendary, achMythic]
      );
      expect(featured.id).toBe('ach-2');
    });

    it('falls back to equipped badge when explicit pin is absent', () => {
      const featured = computeFeaturedAchievement(
        { featured_achievement_id: null, equipped_badge_id: 'ach-3' },
        [achCommon, achRare, achLegendary, achMythic]
      );
      expect(featured.id).toBe('ach-3');
    });

    it('deterministically selects highest rarity unlocked when no pin or badge exists', () => {
      const featured = computeFeaturedAchievement(
        { featured_achievement_id: null, equipped_badge_id: null },
        [achCommon, achRare, achLegendary, achMythic]
      );
      expect(featured.id).toBe('ach-4');
      expect(featured.rarity).toBe('MITICA');
    });

    it('breaks ties between equal rarities by most recent unlock date', () => {
      const legOld = { id: 'leg-old', title: 'Antiga', rarity: 'LENDARIA', unlocked_at: '2026-01-01T00:00:00Z' };
      const legNew = { id: 'leg-new', title: 'Nova', rarity: 'LENDARIA', unlocked_at: '2026-05-01T00:00:00Z' };
      const featured = computeFeaturedAchievement(
        { featured_achievement_id: null, equipped_badge_id: null },
        [legOld, legNew]
      );
      expect(featured.id).toBe('leg-new');
    });
  });

  describe('Rarity breakdown counts', () => {
    it('correctly categorizes counts by rarity tier', () => {
      const achievements = [
        { rarity: 'MITICA' },
        { rarity: 'LENDARIA' },
        { rarity: 'LENDARIA' },
        { rarity: 'EPICA' },
        { rarity: 'RARA' },
        { rarity: 'COMUM' }
      ];
      const counts = computeRarityBreakdown(achievements);
      expect(counts.MITICA).toBe(1);
      expect(counts.LENDARIA).toBe(2);
      expect(counts.EPICA).toBe(1);
      expect(counts.RARA).toBe(1);
      expect(counts.INCOMUM).toBe(0);
      expect(counts.COMUM).toBe(1);
    });
  });

  describe('Cosmetics deduplication & legacy item counting', () => {
    it('deduplicates purchased items and includes legacy level titles and name colors', () => {
      const inventory = [
        { shop_items: { id: 'frame-1', name: 'Moldura Violeta', kind: 'AVATAR_FRAME', rarity: 'COMUM' } }
      ];
      const member = {
        created_at: '2026-01-01',
        avatar_frame_id: 'frame-1', // duplicate of inventory
        equipped_title_id: 'aficionado', // from NOX_TITLES
        name_color: '#8b5cf6' // custom color
      };

      const cosmetics = deduplicateCosmetics(inventory, member);
      expect(cosmetics).toHaveLength(3); // frame-1 (once), aficionado, #8b5cf6
      expect(cosmetics.some((c) => c.id === 'frame-1')).toBe(true);
      expect(cosmetics.some((c) => c.name === 'Aficionado')).toBe(true);
      expect(cosmetics.some((c) => c.kind === 'NAME_COLOR')).toBe(true);
    });
  });

  describe('Privacy access rules', () => {
    function canView(privacyEnabled: boolean, viewerId: string | null, ownerId: string) {
      const isSelf = Boolean(viewerId && viewerId === ownerId);
      return privacyEnabled || isSelf;
    }

    it('allows public to view when privacy flag is true', () => {
      expect(canView(true, null, 'user-1')).toBe(true);
      expect(canView(true, 'user-2', 'user-1')).toBe(true);
    });

    it('blocks public visitors when privacy flag is false', () => {
      expect(canView(false, null, 'user-1')).toBe(false);
      expect(canView(false, 'user-2', 'user-1')).toBe(false);
    });

    it('allows owner to always view their own profile even when privacy is false', () => {
      expect(canView(false, 'user-1', 'user-1')).toBe(true);
    });
  });
});
