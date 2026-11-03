import { error, fail } from '@sveltejs/kit';
import { NOX_TITLES } from '$lib/levels';
import { formatScanRoleTitle, formatScanBadgeText, getScanPreposition } from '$lib/scans';
import { enrichReadingRowsWithCatalog } from '$lib/server/reading-history';
import { executeYugabyteSql } from '$lib/server/yugabyte';

export const load = async ({ locals, params, platform }: any) => {
  let member: any = null;
  try {
    const mRes = await executeYugabyteSql(
      `SELECT id, username, display_name, bio, xp, avatar_id, banner_id,
              equipped_banner_id, avatar_frame_id, name_color,
              equipped_title_id, equipped_badge_id, featured_achievement_id,
              privacy_show_achievements, privacy_show_cosmetics,
              privacy_show_favorites, privacy_show_reading_history,
              privacy_show_scans, privacy_scan_mode, admin_hide_scan_badges,
              avatar_crop, banner_crop, created_at
       FROM public.members
       WHERE LOWER(username) = LOWER($1)
       LIMIT 1;`,
      [params.username],
      platform?.env
    );
    if (mRes.rows && mRes.rows[0]) {
      member = mRes.rows[0];
    }
  } catch (err) {
    console.warn('u_member_yugabyte_warning', err);
  }

  if (!member) {
    const { data: supaMember } = await locals.db
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
    member = supaMember;
  }

  if (!member) {
    error(404, 'Perfil não encontrado');
  }

  const isSelf = locals.user?.id === member.id;
  const canViewAchievements = (member.privacy_show_achievements ?? true) || isSelf;
  const canViewCosmetics = (member.privacy_show_cosmetics ?? true) || isSelf;
  const canViewFavorites = (member.privacy_show_favorites ?? true) || isSelf;
  const canViewReadingHistory = (member.privacy_show_reading_history ?? true) || isSelf;

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
          .select('chapter_id, work_id, page, max_page, completed_at, updated_at')
          .eq('user_id', member.id)
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
  let rawAchievements = achievementsRes.data || [];
  if (rawAchievements.length === 0 && canViewAchievements) {
    try {
      const ybAch = await executeYugabyteSql(
        `SELECT ma.unlocked_at, row_to_json(a.*) AS achievements
         FROM public.member_achievements ma
         JOIN public.achievements a ON a.id = ma.achievement_id
         WHERE ma.user_id = $1
         ORDER BY ma.unlocked_at DESC;`,
        [member.id],
        platform?.env
      );
      if (ybAch.rows && ybAch.rows.length > 0) {
        rawAchievements = ybAch.rows;
      }
    } catch {}
  }

  const achievements = rawAchievements.map((row: any) => ({
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

  // Format cosmetic items and deduplicate (canonical inventory + legacy items)
  let rawInventory = inventoryRes.data || [];
  if (rawInventory.length === 0 && canViewCosmetics) {
    try {
      const ybInv = await executeYugabyteSql(
        `SELECT mi.item_id, mi.origin, mi.acquired_at, row_to_json(si.*) AS shop_items
         FROM public.member_inventory mi
         JOIN public.shop_items si ON si.id = mi.item_id
         WHERE mi.user_id = $1
         ORDER BY mi.acquired_at DESC;`,
        [member.id],
        platform?.env
      );
      if (ybInv.rows && ybInv.rows.length > 0) {
        rawInventory = ybInv.rows;
      }
    } catch {}
  }

  const cosmeticsMap = new Map<string, any>();
  for (const row of rawInventory) {
    const itemKey = row.item_id || row.shop_items?.id;
    if (!itemKey || cosmeticsMap.has(itemKey)) continue;

    if (row.shop_items?.id) {
      cosmeticsMap.set(itemKey, {
        id: row.shop_items.id,
        name: row.shop_items.name,
        description: row.shop_items.description,
        kind: row.shop_items.kind,
        rarity: row.shop_items.rarity || 'COMUM',
        is_animated: row.shop_items.is_animated,
        style_data: row.shop_items.style_data,
        origin: row.origin || 'SHOP',
        acquired_at: row.acquired_at
      });
    } else {
      const noxTitle = NOX_TITLES.find(
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
          is_animated: false,
          style_data: null,
          origin: row.origin || 'LEGACY',
          acquired_at: row.acquired_at
        });
      } else {
        cosmeticsMap.set(itemKey, {
          id: itemKey,
          name: itemKey,
          description: 'Item cosmético desbloqueado',
          kind: 'COSMETIC',
          rarity: 'COMUM',
          is_animated: false,
          style_data: null,
          origin: row.origin || 'LEGACY',
          acquired_at: row.acquired_at
        });
      }
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
          origin: 'LEGACY',
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
        origin: 'LEGACY',
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
      origin: 'LEGACY',
      acquired_at: member.created_at
    });
  }

  const cosmetics = Array.from(cosmeticsMap.values());

  let rpcStats = statsRes.data?.[0];
  if (!rpcStats) {
    try {
      const statsYb = await executeYugabyteSql(
        `SELECT
          (SELECT COUNT(DISTINCT chapter_id) FROM public.reading WHERE user_id = $1) AS chapters_read,
          (SELECT COUNT(DISTINCT work_id) FROM public.reading WHERE user_id = $1) AS total_works,
          (SELECT COUNT(DISTINCT work_id) FROM public.reading WHERE user_id = $1 AND completed_at IS NOT NULL) AS completed_works,
          (SELECT COUNT(*) FROM public.library WHERE user_id = $1 AND favorite = true) AS favorites,
          (SELECT COUNT(*) FROM public.achievements) AS achievements_total,
          (SELECT COUNT(*) FROM public.member_inventory WHERE user_id = $1) AS cosmetics_count;`,
        [member.id],
        platform?.env
      );
      if (statsYb.rows && statsYb.rows[0]) {
        rpcStats = statsYb.rows[0];
      }
    } catch {}
  }

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

  let rawReading = readingRes.data || [];
  if (rawReading.length === 0 && canViewReadingHistory) {
    try {
      const ybRead = await executeYugabyteSql(
        `SELECT chapter_id, work_id, page, max_page, completed_at, updated_at
         FROM public.reading
         WHERE user_id = $1
         ORDER BY updated_at DESC
         LIMIT 80;`,
        [member.id],
        platform?.env
      );
      if (ybRead.rows && ybRead.rows.length > 0) {
        rawReading = ybRead.rows;
      }
    } catch {}
  }

  const enrichedReadings =
    Array.isArray(rawReading) && rawReading.length > 0
      ? await enrichReadingRowsWithCatalog(rawReading, locals.db, platform?.env)
      : [];

  const readingMap = new Map<string, any>();
  for (const r of enrichedReadings as any[]) {
    const ch = r.chapters;
    if (!ch || !ch.works) continue;
    const wid = ch.work_id || ch.works.id;
    if (!readingMap.has(wid)) {
      readingMap.set(wid, {
        workId: wid,
        workTitle: ch.works.title,
        workSlug: ch.works.slug,
        coverId: ch.works.cover_id,
        contentRating: ch.works.content_rating,
        kind: ch.works.kind,
        chapterId: ch.id,
        chapterNumber: ch.number,
        chapterTitle: ch.title,
        page: r.page,
        maxPage: r.max_page,
        completedAt: r.completed_at,
        updatedAt: r.updated_at
      });
    }
    if (readingMap.size >= 16) break;
  }
  const recentReadings = Array.from(readingMap.values());

  const scanPositions = (scanMemberPositionsRes.data || []).map((p: any) => ({
    scan_id: p.scan_id,
    is_primary: p.is_primary,
    created_at: p.created_at,
    id: p.scan_positions?.id,
    name: p.scan_positions?.name,
    icon: p.scan_positions?.icon
  }));

  const isViewerGlobalAdmin = ['ADMIN', 'EDITOR'].includes(locals.role || '');
  const canViewScanBadges = (
    !member.admin_hide_scan_badges || isViewerGlobalAdmin
  ) && (
    (member.privacy_show_scans ?? true) || isSelf || isViewerGlobalAdmin
  ) && (
    (member.privacy_scan_mode ?? 'PRIMARY') !== 'NONE' || isSelf || isViewerGlobalAdmin
  );

  let scanRoles: any[] = [];

  if (canViewScanBadges) {
    const rawScanRoles = (scanRolesRes.data || []).filter((r: any) => {
      if (r.hidden_by_admin && !isViewerGlobalAdmin) return false;
      if (!r.is_public && !isSelf && !isViewerGlobalAdmin) return false;
      return true;
    });

    const mapped = rawScanRoles.map((r: any) => {
      const userPositions = scanPositions.filter((p: any) => p.scan_id === r.scans.id && (isViewerGlobalAdmin || (!p.hidden_by_admin && (p.is_public || isSelf))));
      const primaryPos = userPositions.find((p: any) => p.is_primary) || userPositions[0] || null;
      const prep = r.scans.display_preposition || getScanPreposition(r.scans);
      const badgeText = formatScanBadgeText(r.role, primaryPos?.name, r.scans.name);
      const fullTitle = formatScanRoleTitle(r.role, primaryPos?.name, r.scans.name, prep);

      return {
        role: r.role,
        is_public: r.is_public,
        hidden_by_admin: r.hidden_by_admin,
        created_at: r.created_at,
        scan: r.scans,
        positions: userPositions,
        primaryPosition: primaryPos,
        badgeText,
        fullTitle
      };
    });

    if (member.privacy_scan_mode === 'PRIMARY' && !isSelf && !isViewerGlobalAdmin) {
      scanRoles = mapped.slice(0, 1);
    } else {
      scanRoles = mapped;
    }
  }

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
  toggleScanPrivacy: async ({ request, locals, platform }: any) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const showScans = formData.get('show_scans') === 'on';
    const mode = (formData.get('mode') as string) || 'PRIMARY';

    try {
      await executeYugabyteSql(
        `UPDATE public.members SET privacy_show_scans = $1, privacy_scan_mode = $2 WHERE id = $3;`,
        [showScans, mode, locals.user.id],
        platform?.env
      );
      return { success: true, action: 'toggleScanPrivacy' };
    } catch {}

    const { error: rpcErr } = await locals.db.rpc('toggle_user_scan_privacy', {
      p_show_scans: showScans,
      p_mode: mode
    });
    if (rpcErr) return fail(400, { message: rpcErr.message });
    return { success: true, action: 'toggleScanPrivacy' };
  },

  moderateUserScans: async ({ request, locals, platform }: any) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const targetUserId = (formData.get('target_user_id') as string)?.trim();
    const hideBadges = formData.get('hide_badges') === 'true';

    try {
      await executeYugabyteSql(
        `UPDATE public.members SET admin_hide_scan_badges = $1 WHERE id = $2;`,
        [hideBadges, targetUserId],
        platform?.env
      );
      return { success: true, action: 'moderateUserScans' };
    } catch {}

    const { error: rpcErr } = await locals.db.rpc('admin_moderate_user_scans', {
      p_target_user_id: targetUserId,
      p_hide_badges: hideBadges
    });
    if (rpcErr) return fail(400, { message: rpcErr.message });
    return { success: true, action: 'moderateUserScans' };
  }
};
