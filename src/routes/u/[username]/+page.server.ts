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
    error(404, 'Perfil não encontrado');
  }

  const isSelf = locals.user?.id === member.id;
  const canViewAchievements = (member.privacy_show_achievements ?? true) || isSelf;
  const canViewCosmetics = (member.privacy_show_cosmetics ?? true) || isSelf;
  const canViewFavorites = (member.privacy_show_favorites ?? true) || isSelf;
  const canViewReadingHistory = (member.privacy_show_reading_history ?? true) || isSelf;

  // 1. Concurrently fetch all profile data from authoritative YugabyteDB
  const [
    socialRes,
    statsRes,
    favoritesRes,
    readingRes,
    achievementsRes,
    inventoryRes,
    scansRes,
    cosmeticBannerRes
  ] = await Promise.all([
    executeYugabyteSql(
      `SELECT 
        (SELECT COUNT(*) FROM public.user_follows WHERE following_id = $1) AS followers_count,
        (SELECT COUNT(*) FROM public.user_follows WHERE follower_id = $1) AS following_count,
        (CASE WHEN $2::uuid IS NOT NULL THEN EXISTS(SELECT 1 FROM public.user_follows WHERE follower_id = $2 AND following_id = $1) ELSE false END) AS is_following;`,
      [member.id, locals.user?.id || null],
      platform?.env
    ).catch(() => ({ rows: [] })),

    executeYugabyteSql(
      `SELECT
        (SELECT COUNT(DISTINCT r.chapter_id) FROM public.reading r WHERE r.user_id = $1) AS chapters_read,
        (SELECT COUNT(DISTINCT c.work_id) FROM public.reading r JOIN public.chapters c ON c.id = r.chapter_id WHERE r.user_id = $1) AS total_works,
        (SELECT COUNT(DISTINCT c.work_id) FROM public.reading r JOIN public.chapters c ON c.id = r.chapter_id WHERE r.user_id = $1 AND r.completed_at IS NOT NULL) AS completed_works,
        (SELECT COUNT(*) FROM public.library WHERE user_id = $1 AND favorite = true) AS favorites,
        (SELECT COUNT(*) FROM public.achievements) AS achievements_total,
        (SELECT COUNT(*) FROM public.member_inventory WHERE user_id = $1) AS cosmetics_count;`,
      [member.id],
      platform?.env
    ).catch(() => ({ rows: [] })),

    canViewFavorites
      ? executeYugabyteSql(
          `SELECT to_jsonb(w.*) AS works
           FROM public.library l
           JOIN public.works w ON w.id = l.work_id
           WHERE l.user_id = $1 AND l.favorite = true AND w.published = true
           ORDER BY l.updated_at DESC
           LIMIT 24;`,
          [member.id],
          platform?.env
        ).catch(() => ({ rows: [] }))
      : Promise.resolve({ rows: [] }),

    canViewReadingHistory
      ? executeYugabyteSql(
          `SELECT r.chapter_id, c.work_id, r.page, r.max_page, r.completed_at, r.updated_at
           FROM public.reading r
           JOIN public.chapters c ON c.id = r.chapter_id
           WHERE r.user_id = $1
           ORDER BY r.updated_at DESC
           LIMIT 80;`,
          [member.id],
          platform?.env
        ).catch(() => ({ rows: [] }))
      : Promise.resolve({ rows: [] }),

    canViewAchievements
      ? executeYugabyteSql(
          `SELECT ma.unlocked_at, to_jsonb(a.*) AS achievements
           FROM public.member_achievements ma
           JOIN public.achievements a ON a.id = ma.achievement_id
           WHERE ma.user_id = $1
           ORDER BY ma.unlocked_at DESC;`,
          [member.id],
          platform?.env
        ).catch(() => ({ rows: [] }))
      : Promise.resolve({ rows: [] }),

    canViewCosmetics
      ? executeYugabyteSql(
          `SELECT mi.item_id, mi.origin, mi.acquired_at, to_jsonb(si.*) AS shop_items
           FROM public.member_inventory mi
           LEFT JOIN public.shop_items si ON si.id = mi.item_id
           WHERE mi.user_id = $1
           ORDER BY mi.acquired_at DESC;`,
          [member.id],
          platform?.env
        ).catch(() => ({ rows: [] }))
      : Promise.resolve({ rows: [] }),

    executeYugabyteSql(
      `SELECT 
        (SELECT coalesce(json_agg(json_build_object(
           'role', sm.role,
           'is_public', sm.is_public,
           'hidden_by_admin', sm.hidden_by_admin,
           'created_at', sm.created_at,
           'scans', to_jsonb(s.*)
         )), '[]'::json)
         FROM public.scan_members sm
         JOIN public.scans s ON s.id = sm.scan_id
         WHERE sm.user_id = $1 AND s.status = 'ACTIVE') AS scan_roles,
        (SELECT role FROM public.access_roles WHERE user_id = $1 AND suspended = false LIMIT 1) AS staff_role,
        (SELECT coalesce(json_agg(json_build_object(
           'scan_id', smp.scan_id,
           'is_primary', smp.is_primary,
           'is_public', smp.is_public,
           'hidden_by_admin', smp.hidden_by_admin,
           'created_at', smp.created_at,
           'id', sp.id,
           'name', sp.name,
           'icon', sp.icon
         )), '[]'::json)
         FROM public.scan_member_positions smp
         JOIN public.scan_positions sp ON sp.id = smp.position_id
         WHERE smp.user_id = $1) AS scan_positions;`,
      [member.id],
      platform?.env
    ).catch(() => ({ rows: [] })),

    member.equipped_banner_id
      ? executeYugabyteSql(
          `SELECT style_data FROM public.shop_items WHERE id = $1 LIMIT 1;`,
          [member.equipped_banner_id],
          platform?.env
        ).catch(() => ({ rows: [] }))
      : Promise.resolve({ rows: [] })
  ]);

  const socialRow = socialRes.rows[0] || {};
  const followersCount = Number(socialRow.followers_count || 0);
  const followingCount = Number(socialRow.following_count || 0);
  const isFollowing = Boolean(socialRow.is_following);

  // Format unlocked achievements
  const rawAchievements = achievementsRes.rows || [];
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
  const rawInventory = inventoryRes.rows || [];
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
    try {
      const ybLegacy = await executeYugabyteSql(
        `SELECT id, name, description, kind, rarity, is_animated, style_data
         FROM public.shop_items
         WHERE id = ANY($1::text[]);`,
        [equippedLegacyIds],
        platform?.env
      );

      for (const item of ybLegacy.rows || []) {
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
    } catch {}
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

  const rpcStats = statsRes.rows[0] || {};
  const profileStats = {
    chapters_read: Number(rpcStats.chapters_read ?? 0),
    total_works: Number(rpcStats.total_works ?? 0),
    completed_works: Number(rpcStats.completed_works ?? 0),
    favorites: Number(rpcStats.favorites ?? 0),
    achievements_unlocked: achievements.length,
    achievements_total: Number(rpcStats.achievements_total ?? 0),
    cosmetics_count: Math.max(Number(rpcStats.cosmetics_count ?? 0), cosmetics.length)
  };

  const favorites = (favoritesRes.rows || []).map((r: any) => r.works).filter(Boolean);

  const rawReading = readingRes.rows || [];
  const enrichedReadings =
    Array.isArray(rawReading) && rawReading.length > 0
      ? await enrichReadingRowsWithCatalog(rawReading, null, platform?.env)
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

  const scansRow = scansRes.rows[0] || {};
  const rawScanRoles = Array.isArray(scansRow.scan_roles) ? scansRow.scan_roles : [];
  const staffRole = scansRow.staff_role || null;
  const scanPositions = Array.isArray(scansRow.scan_positions) ? scansRow.scan_positions : [];

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
    const filtered = rawScanRoles.filter((r: any) => {
      if (r.hidden_by_admin && !isViewerGlobalAdmin) return false;
      if (!r.is_public && !isSelf && !isViewerGlobalAdmin) return false;
      return true;
    });

    const mapped = filtered.map((r: any) => {
      const userPositions = scanPositions.filter((p: any) => p.scan_id === r.scans?.id && (isViewerGlobalAdmin || (!p.hidden_by_admin && (p.is_public || isSelf))));
      const primaryPos = userPositions.find((p: any) => p.is_primary) || userPositions[0] || null;
      const prep = r.scans?.display_preposition || getScanPreposition(r.scans);
      const badgeText = formatScanBadgeText(r.role, primaryPos?.name, r.scans?.name);
      const fullTitle = formatScanRoleTitle(r.role, primaryPos?.name, r.scans?.name, prep);

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

  const cosmeticBanner = cosmeticBannerRes.rows[0]?.style_data || null;

  return {
    member: {
      ...member,
      frame_id: member.avatar_frame_id
    },
    cosmetic_banner: cosmeticBanner,
    stats: profileStats,
    followersCount,
    followingCount,
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
    staffRole
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
    } catch (err: any) {
      return fail(400, { message: err?.message || 'Falha ao atualizar privacidade da scan' });
    }
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
    } catch (err: any) {
      return fail(400, { message: err?.message || 'Falha ao moderar badges da scan' });
    }
  }
};
