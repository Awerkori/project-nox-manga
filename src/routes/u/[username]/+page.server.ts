import { error, fail } from '@sveltejs/kit';
import { NOX_TITLES } from '$lib/levels';
import { formatScanRoleTitle, formatScanBadgeText, getScanPreposition } from '$lib/scans';

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
      privacy_show_favorites,
      privacy_show_reading_history,
      privacy_show_scans,
      privacy_scan_mode,
      admin_hide_scan_badges,
      avatar_crop,
      banner_crop,
      created_at
    `)
    .eq('username', params.username)
    .maybeSingle();

  if (!member) {
    error(404, 'Perfil não encontrado');
  }

  const isSelf = locals.user?.id === member.id;
  const canViewAchievements = (member.privacyShowAchievements ?? true) || isSelf;
  const canViewCosmetics = (member.privacyShowCosmetics ?? true) || isSelf;
  const canViewFavorites = (member.privacyShowFavorites ?? true) || isSelf;
  const canViewReadingHistory = (member.privacyShowReadingHistory ?? true) || isSelf;

  const [
    statsRes,
    followersCountRes,
    followingCountRes,
    achievementsRes,
    inventoryRes,
    isFollowingRes,
    bannerRes,
    favoritesRes,
    readingRes,
    scanRolesRes,
    staffRoleRes,
    scanMemberPositionsRes
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
            origin,
            acquired_at,
            shop_items(
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
    locals.user && locals.user!.id !== member.id
      ? locals.db
          .from('user_follows')
          .select('follower_id')
          .eq('follower_id', locals.user!.id)
          .eq('following_id', member.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    member.equippedBannerId
      ? locals.db
          .from('shop_items')
          .select('id, style_data')
          .eq('id', member.equippedBannerId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    canViewFavorites
      ? locals.db
          .from('library')
          .select(`
            favorite,
            updated_at,
            works!inner(
              id,
              slug,
              title,
              cover_id,
              kind,
              status,
              year,
              content_rating,
              views_total
            )
          `)
          .eq('user_id', member.id)
          .eq('favorite', true)
          .eq('works.published', true)
          .order('updated_at', { ascending: false })
          .limit(24)
      : Promise.resolve({ data: [] }),
    canViewReadingHistory
      ? locals.db
          .from('reading')
          .select(`
            chapter_id,
            page,
            max_page,
            completed_at,
            updated_at,
            chapters!inner(
              id,
              number,
              title,
              work_id,
              works!inner(
                id,
                slug,
                title,
                cover_id,
                kind,
                status,
                content_rating
              )
            )
          `)
          .eq('user_id', member.id)
          .eq('chapters.works.published', true)
          .order('updated_at', { ascending: false })
          .limit(80)
      : Promise.resolve({ data: [] }),
    locals.db
      .from('scan_members')
      .select(`
        role,
        is_public,
        hidden_by_admin,
        created_at,
        scans!inner(
          id,
          name,
          slug,
          logo_id,
          is_official,
          status,
          description,
          display_preposition
        )
      `)
      .eq('user_id', member.id)
      .eq('scans.status', 'ACTIVE'),
    locals.db
      .from('access_roles')
      .select('role')
      .eq('user_id', member.id)
      .eq('suspended', false)
      .maybeSingle(),
    locals.db
      .from('scan_member_positions')
      .select(`
        scan_id,
        is_primary,
        is_public,
        hidden_by_admin,
        created_at,
        scan_positions!inner(
          id,
          name,
          icon
        )
      `)
      .eq('user_id', member.id)
  ]);

  // Format unlocked achievements
  const achievements = (achievementsRes.data || []).map((row: any) => ({unlockedAt: row.unlockedAt,
    ...row.achievements}));

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
  if (member.featuredAchievementId) {
    featuredAchievement = achievements.find((a: any) => a.id === member.featuredAchievementId) || null;
  }
  if (!featuredAchievement && member.equippedBadgeId) {
    featuredAchievement = achievements.find((a: any) => a.id === member.equippedBadgeId) || null;
  }
  if (!featuredAchievement && achievements.length > 0) {
    const RARITY_WEIGHT: Record<string, number> = { MITICA: 6, LENDARIA: 5, EPICA: 4, RARA: 3, INCOMUM: 2, COMUM: 1 };
    const sorted = [...achievements].sort((a: any, b: any) => {
      const wa = RARITY_WEIGHT[a.rarity] || 1;
      const wb = RARITY_WEIGHT[b.rarity] || 1;
      if (wa !== wb) return wb - wa;
      return new Date(b.unlockedAt).getTime() - new Date(a.unlockedAt).getTime();
    });
    featuredAchievement = sorted[0] || null;
  }

  // Format cosmetic items and deduplicate (canonical inventory + legacy items)
  const cosmeticsMap = new Map<string, any>();
  for (const row of inventoryRes.data || []) {const itemKey = row.itemId || row.shop_items?.id;
    if (!itemKey || cosmeticsMap.has(itemKey)) continue;

    if (row.shop_items?.id) {
      cosmeticsMap.set(itemKey, {
        id: row.shop_items.id,
        name: row.shop_items.name,
        description: row.shop_items.description,
        kind: row.shop_items.kind,
        rarity: row.shop_items.rarity || 'COMUM',
        isAnimated: row.shop_items.isAnimated,
        styleData: row.shop_items.styleData,
        origin: row.origin || 'SHOP',
        acquiredAt: row.acquiredAt});
    } else {const noxTitle = NOX_TITLES.find(
        (t) =>
          t.id.toLowerCase() === itemKey.toLowerCase() ||
          t.name.toLowerCase() === itemKey.toLowerCase()
      );
      if (noxTitle) {
        cosmeticsMap.set(itemKey, {
          id: noxTitle.id,
          name: noxTitle.name,
          description: noxTitle.description,
          kind: 'TITLE',
          rarity: 'COMUM',
          isAnimated: false,
          styleData: null,
          origin: row.origin || 'LEGACY',
          acquiredAt: row.acquiredAt});
      } else {cosmeticsMap.set(itemKey, {
          id: itemKey,
          name: itemKey,
          description: 'Item cosmético desbloqueado',
          kind: 'COSMETIC',
          rarity: 'COMUM',
          isAnimated: false,
          styleData: null,
          origin: row.origin || 'LEGACY',
          acquiredAt: row.acquiredAt});
      }
    }
  }

  // Check equipped legacy items not yet in map
  const equippedLegacyIds = [
    member.avatarFrameId,
    member.equippedBannerId,
    member.equippedTitleId
  ].filter((id): id is string => Boolean(id && typeof id === 'string' && !cosmeticsMap.has(id)));

  if (equippedLegacyIds.length > 0) {
    const { data: legacyShopItems } = await locals.db
      .from('shop_items')
      .select('id, name, description, kind, rarity, is_animated, style_data')
      .in('id', equippedLegacyIds);

    for (const item of legacyShopItems || []) {if (!cosmeticsMap.has(item.id)) {
        cosmeticsMap.set(item.id, {
          id: item.id,
          name: item.name,
          description: item.description,
          kind: item.kind,
          rarity: item.rarity || 'COMUM',
          isAnimated: item.isAnimated,
          styleData: item.styleData,
          origin: 'LEGACY',
          acquiredAt: member.createdAt});
      }
    }
  }

  // Check if equipped_title_id was from NOX_TITLES
  if (member.equippedTitleId && !cosmeticsMap.has(member.equippedTitleId)) {const noxTitle = NOX_TITLES.find(
      (t) =>
        t.id.toLowerCase() === member.equippedTitleId?.toLowerCase() ||
        t.name.toLowerCase() === member.equippedTitleId?.toLowerCase()
    );
    if (noxTitle) {
      cosmeticsMap.set(noxTitle.id, {
        id: noxTitle.id,
        name: noxTitle.name,
        description: noxTitle.description,
        kind: 'TITLE',
        rarity: 'COMUM',
        isAnimated: false,
        styleData: null,
        origin: 'LEGACY',
        acquiredAt: member.createdAt});
    }
  }

  // Check if name_color is set
  if (member.nameColor && !cosmeticsMap.has(member.nameColor)) {cosmeticsMap.set(member.nameColor, {
      id: member.nameColor,
      name: 'Cor Personalizada',
      description: 'Cor exclusiva para o nome do leitor no perfil e comentários.',
      kind: 'NAME_COLOR',
      rarity: 'RARA',
      isAnimated: false,
      styleData: { color: member.nameColor},
      origin: 'LEGACY',
      acquired_at: member.createdAt
    });
  }

  const cosmetics = Array.from(cosmeticsMap.values());

  const rpcStats = statsRes.data?.[0];
  const profileStats = {
    chapters_read: Number(rpcStats?.chapters_read ?? 0),
    total_works: Number(rpcStats?.total_works ?? 0),
    completed_works: Number(rpcStats?.completed_works ?? 0),
    favorites: Number(rpcStats?.favorites ?? 0),
    achievements_unlocked: achievements.length,
    achievements_total: Number(rpcStats?.achievements_total ?? 0),
    cosmetics_count: Math.max(Number(rpcStats?.cosmetics_count ?? 0), cosmetics.length)
  };

  const favorites = (favoritesRes.data || []).map((r: any) => r.works).filter(Boolean);

  const readingMap = new Map<string, any>();
  for (const r of (readingRes.data || []) as any[]) {
    const ch = r.chapters;
    if (!ch || !ch.works) continue;
    const wid = ch.workId || ch.works.id;
    if (!readingMap.has(wid)) {
      readingMap.set(wid, {
        workId: wid,
        workTitle: ch.works.title,
        workSlug: ch.works.slug,
        coverId: ch.works.coverId,
        contentRating: ch.works.contentRating,
        kind: ch.works.kind,
        chapterId: ch.id,
        chapterNumber: ch.number,
        chapterTitle: ch.title,
        page: r.page,
        maxPage: r.maxPage,
        completedAt: r.completedAt,
        updatedAt: r.updatedAt
      });
    }
    if (readingMap.size >= 16) break;
  }
  const recentReadings = Array.from(readingMap.values());

  const scanPositions = (scanMemberPositionsRes.data || []).map((p: any) => ({scanId: p.scanId,
    isPrimary: p.isPrimary,
    createdAt: p.createdAt,
    id: p.scan_positions?.id,
    name: p.scan_positions?.name,
    icon: p.scan_positions?.icon}));

  const isViewerGlobalAdmin = ['ADMIN', 'EDITOR'].includes(locals.role || '');
  const canViewScanBadges = (
    !member.adminHideScanBadges || isViewerGlobalAdmin
  ) && (
    (member.privacyShowScans ?? true) || isSelf || isViewerGlobalAdmin
  ) && (
    (member.privacyScanMode ?? 'PRIMARY') !== 'NONE' || isSelf || isViewerGlobalAdmin
  );

  let scanRoles: any[] = [];

  if (canViewScanBadges) {
    const rawScanRoles = (scanRolesRes.data || []).filter((r: any) => {
      if (r.hiddenByAdmin && !isViewerGlobalAdmin) return false;
      if (!r.isPublic && !isSelf && !isViewerGlobalAdmin) return false;
      return true;
    });

    const mapped = rawScanRoles.map((r: any) => {const userPositions = scanPositions.filter((p: any) => p.scanId === r.scans.id && (isViewerGlobalAdmin || (!p.hiddenByAdmin && (p.isPublic || isSelf))));
      const primaryPos = userPositions.find((p: any) => p.isPrimary) || userPositions[0] || null;
      const prep = r.scans.displayPreposition || getScanPreposition(r.scans);
      const badgeText = formatScanBadgeText(r.role, primaryPos?.name, r.scans.name);
      const fullTitle = formatScanRoleTitle(r.role, primaryPos?.name, r.scans.name, prep);

      return {
        role: r.role,
        isPublic: r.isPublic,
        hiddenByAdmin: r.hiddenByAdmin,
        createdAt: r.createdAt,
        scan: r.scans,
        positions: userPositions,
        primaryPosition: primaryPos,
        badgeText,
        fullTitle};
    });

    if (member.privacyScanMode === 'PRIMARY' && !isSelf && !isViewerGlobalAdmin) {
      scanRoles = mapped.slice(0, 1);
    } else {
      scanRoles = mapped;
    }
  }

  const isFollowing = !!isFollowingRes.data;

  return {
    member: {
      ...member,
      frame_id: member.avatarFrameId
    },
    cosmetic_banner: (bannerRes.data?.styleData as any) || null,
    stats: profileStats,
    followersCount: followersCountRes.count ?? 0,
    followingCount: followingCountRes.count ?? 0,
    achievements,
    rarityCounts,
    featuredAchievement,
    cosmetics,
    favorites,
    recentReadings,
    scanRoles,
    isSelf,
    isViewerGlobalAdmin,
    isFollowing,
    canViewAchievements,
    canViewCosmetics,
    canViewFavorites,
    canViewReadingHistory,
    viewerAuthenticated: !!locals.user,
    staffRole: staffRoleRes.data?.role || null
  };
};

export const actions = {
  toggleScanPrivacy: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const showScans = formData.get('show_scans') === 'on';
    const mode = (formData.get('mode') as string) || 'PRIMARY';
    const { error: rpcErr } = await locals.db.rpc('toggle_user_scan_privacy', {
      p_show_scans: showScans,
      p_mode: mode
    });
    if (rpcErr) return fail(400, { message: rpcErr.message });
    return { success: true, action: 'toggleScanPrivacy' };
  },

  moderateUserScans: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const targetUserId = (formData.get('target_user_id') as string)?.trim();
    const hideBadges = formData.get('hide_badges') === 'true';
    const { error: rpcErr } = await locals.db.rpc('admin_moderate_user_scans', {
      p_target_user_id: targetUserId,
      p_hide_badges: hideBadges
    });
    if (rpcErr) return fail(400, { message: rpcErr.message });
    return { success: true, action: 'moderateUserScans' };
  }
};
