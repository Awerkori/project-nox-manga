import { error } from '@sveltejs/kit';
import { NOX_TITLES } from '$lib/levels';

export const load = async ({ locals, params }) => {
  const { data: member } = await locals.db
    .from('members')
    .select(`
      id,
      username,
      display_name,
      bio,
      xp,
      avatar_id,
      banner_id,
      equipped_banner_id,
      avatar_frame_id,
      name_color,
      equipped_title_id,
      equipped_badge_id,
      featured_achievement_id,
      privacy_show_achievements,
      privacy_show_cosmetics,
      created_at
    `)
    .eq('username', params.username)
    .maybeSingle();

  if (!member) {
    error(404, 'Perfil não encontrado');
  }

  const isSelf = locals.user?.id === member.id;
  const canViewAchievements = member.privacy_show_achievements || isSelf;
  const canViewCosmetics = member.privacy_show_cosmetics || isSelf;

  const [
    statsRes,
    followersCountRes,
    followingCountRes,
    achievementsRes,
    inventoryRes,
    isFollowingRes,
    bannerRes
  ] = await Promise.all([
    locals.db.rpc('member_public_profile_stats', { p_user: member.id }),
    locals.db.from('user_follows').select('follower_id', { count: 'exact', head: true }).eq('following_id', member.id),
    locals.db.from('user_follows').select('following_id', { count: 'exact', head: true }).eq('follower_id', member.id),
    canViewAchievements
      ? locals.db
          .from('member_achievements')
          .select(`
            unlocked_at,
            achievements!inner(
              id,
              title,
              description,
              icon,
              badge_color,
              category,
              rarity,
              xp_reward,
              is_secret
            )
          `)
          .eq('user_id', member.id)
          .order('unlocked_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    canViewCosmetics
      ? locals.db
          .from('member_inventory')
          .select(`
            item_id,
            acquired_at,
            shop_items!inner(
              id,
              name,
              description,
              kind,
              rarity,
              is_animated,
              style_data
            )
          `)
          .eq('user_id', member.id)
          .order('acquired_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    locals.user && locals.user.id !== member.id
      ? locals.db
          .from('user_follows')
          .select('follower_id')
          .eq('follower_id', locals.user.id)
          .eq('following_id', member.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    member.equipped_banner_id
      ? locals.db
          .from('shop_items')
          .select('id, style_data')
          .eq('id', member.equipped_banner_id)
          .maybeSingle()
      : Promise.resolve({ data: null })
  ]);

  // Format unlocked achievements
  const achievements = (achievementsRes.data || []).map((row: any) => ({
    unlocked_at: row.unlocked_at,
    ...row.achievements
  }));

  // Rarity Breakdown
  const rarityCounts: Record<string, number> = {
    MITICA: 0,
    LENDARIA: 0,
    EPICA: 0,
    RARA: 0,
    INCOMUM: 0,
    COMUM: 0
  };
  for (const ach of achievements) {
    const r = (ach.rarity || 'COMUM').toUpperCase();
    if (rarityCounts[r] !== undefined) rarityCounts[r]++;
  }

  // Determine Featured Achievement (Deterministic: user choice -> equipped badge -> rarest unlocked)
  let featuredAchievement: any = null;
  if (member.featured_achievement_id) {
    featuredAchievement = achievements.find((a: any) => a.id === member.featured_achievement_id) || null;
  }
  if (!featuredAchievement && member.equipped_badge_id) {
    featuredAchievement = achievements.find((a: any) => a.id === member.equipped_badge_id) || null;
  }
  if (!featuredAchievement && achievements.length > 0) {
    const RARITY_WEIGHT: Record<string, number> = { MITICA: 6, LENDARIA: 5, EPICA: 4, RARA: 3, INCOMUM: 2, COMUM: 1 };
    const sorted = [...achievements].sort((a: any, b: any) => {
      const wa = RARITY_WEIGHT[a.rarity] || 1;
      const wb = RARITY_WEIGHT[b.rarity] || 1;
      if (wa !== wb) return wb - wa;
      return new Date(b.unlocked_at).getTime() - new Date(a.unlocked_at).getTime();
    });
    featuredAchievement = sorted[0] || null;
  }

  // Format cosmetic items and deduplicate (inventory + legacy equipped)
  const cosmeticsMap = new Map<string, any>();
  for (const row of inventoryRes.data || []) {
    if (row.shop_items?.id && !cosmeticsMap.has(row.shop_items.id)) {
      cosmeticsMap.set(row.shop_items.id, {
        id: row.shop_items.id,
        name: row.shop_items.name,
        description: row.shop_items.description,
        kind: row.shop_items.kind,
        rarity: row.shop_items.rarity || 'COMUM',
        is_animated: row.shop_items.is_animated,
        style_data: row.shop_items.style_data,
        acquired_at: row.acquired_at
      });
    }
  }

  // Check equipped legacy items not yet in map
  const equippedLegacyIds = [
    member.avatar_frame_id,
    member.equipped_banner_id,
    member.equipped_title_id
  ].filter((id): id is string => Boolean(id && typeof id === 'string' && !cosmeticsMap.has(id)));

  if (equippedLegacyIds.length > 0) {
    const { data: legacyShopItems } = await locals.db
      .from('shop_items')
      .select('id, name, description, kind, rarity, is_animated, style_data')
      .in('id', equippedLegacyIds);

    for (const item of legacyShopItems || []) {
      if (!cosmeticsMap.has(item.id)) {
        cosmeticsMap.set(item.id, {
          id: item.id,
          name: item.name,
          description: item.description,
          kind: item.kind,
          rarity: item.rarity || 'COMUM',
          is_animated: item.is_animated,
          style_data: item.style_data,
          acquired_at: member.created_at
        });
      }
    }
  }

  // Check if equipped_title_id was from NOX_TITLES
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
        description: noxTitle.description,
        kind: 'TITLE',
        rarity: 'COMUM',
        is_animated: false,
        style_data: null,
        acquired_at: member.created_at
      });
    }
  }

  // Check if name_color is set
  if (member.name_color && !cosmeticsMap.has(member.name_color)) {
    cosmeticsMap.set(member.name_color, {
      id: member.name_color,
      name: 'Cor Personalizada',
      description: 'Cor exclusiva para o nome do leitor no perfil e comentários.',
      kind: 'NAME_COLOR',
      rarity: 'RARA',
      is_animated: false,
      style_data: { color: member.name_color },
      acquired_at: member.created_at
    });
  }

  const cosmetics = Array.from(cosmeticsMap.values());

  const profileStats = statsRes.data?.[0] || {
    chapters_read: 0,
    total_works: 0,
    completed_works: 0,
    favorites: 0,
    achievements_unlocked: achievements.length,
    achievements_total: 0,
    cosmetics_count: cosmetics.length
  };

  const isFollowing = !!isFollowingRes.data;

  return {
    member: {
      ...member,
      frame_id: member.avatar_frame_id
    },
    cosmetic_banner: (bannerRes.data?.style_data as any) || null,
    stats: profileStats,
    followersCount: followersCountRes.count ?? 0,
    followingCount: followingCountRes.count ?? 0,
    achievements,
    rarityCounts,
    featuredAchievement,
    cosmetics,
    isSelf,
    isFollowing,
    canViewAchievements,
    canViewCosmetics,
    viewerAuthenticated: !!locals.user
  };
};
