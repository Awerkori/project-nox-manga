import { error, fail } from '@sveltejs/kit';
import { NOX_TITLES } from '$lib/levels';
import { formatScanRoleTitle, formatScanBadgeText, getScanPreposition } from '$lib/scans';
import { db, schema, safeQuery, safeQuerySingle } from '$lib/server/db';
import { eq, desc, and, inArray, count, sql } from 'drizzle-orm';

export const load = async ({ locals, params }) => {
  const { data: member } = await safeQuerySingle(
    db.select()
      .from(schema.members)
      .where(eq(schema.members.username, params.username))
      .limit(1)
  );

  if (!member) {
    error(404, 'Perfil no encontrado');
  }

  const isSelf = locals.user?.id === member.id;
  const canViewAchievements = (member.privacyShowAchievements ?? true) || isSelf;
  const canViewCosmetics = (member.privacyShowCosmetics ?? true) || isSelf;
  const canViewFavorites = (member.privacyShowFavorites ?? true) || isSelf;
  const canViewReadingHistory = (member.privacyShowReadingHistory ?? true) || isSelf;

  const [
    chaptersReadRes,
    totalWorksRes,
    completedWorksRes,
    favoritesStatsRes,
    achievementsTotalRes,
    cosmeticsCountRes,
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
    safeQuerySingle(db.select({ count: count() }).from(schema.reading).innerJoin(schema.chapters, eq(schema.reading.chapterId, schema.chapters.id)).innerJoin(schema.works, eq(schema.chapters.workId, schema.works.id)).where(and(eq(schema.reading.userId, member.id), sql`${schema.reading.completedAt} IS NOT NULL`, sql`${schema.chapters.publishedAt} IS NOT NULL`, eq(schema.works.published, true)))),
    safeQuerySingle(db.select({ count: sql<number>`count(distinct ${schema.library.workId})` }).from(schema.library).innerJoin(schema.works, eq(schema.library.workId, schema.works.id)).where(and(eq(schema.library.userId, member.id), eq(schema.works.published, true)))),
    safeQuerySingle(db.select({ count: count() }).from(schema.library).innerJoin(schema.works, eq(schema.library.workId, schema.works.id)).where(and(eq(schema.library.userId, member.id), eq(schema.library.status, 'COMPLETED'), eq(schema.works.published, true)))),
    safeQuerySingle(db.select({ count: count() }).from(schema.library).innerJoin(schema.works, eq(schema.library.workId, schema.works.id)).where(and(eq(schema.library.userId, member.id), eq(schema.library.favorite, true), eq(schema.works.published, true)))),
    safeQuerySingle(db.select({ count: count() }).from(schema.achievements)),
    safeQuerySingle(db.select({ count: sql<number>`count(distinct ${schema.memberInventory.itemId})` }).from(schema.memberInventory).where(eq(schema.memberInventory.userId, member.id))),
    
    safeQuerySingle(db.select({ count: count() }).from(schema.userFollows).where(eq(schema.userFollows.followingId, member.id))),
    safeQuerySingle(db.select({ count: count() }).from(schema.userFollows).where(eq(schema.userFollows.followerId, member.id))),
    
    canViewAchievements
      ? safeQuery(
          db.select({
            unlockedAt: schema.memberAchievements.unlockedAt,
            id: schema.achievements.id,
            title: schema.achievements.title,
            description: schema.achievements.description,
            icon: schema.achievements.icon,
            badgeColor: schema.achievements.badgeColor,
            category: schema.achievements.category,
            rarity: schema.achievements.rarity,
            xpReward: schema.achievements.xpReward,
            isSecret: schema.achievements.isSecret
          })
          .from(schema.memberAchievements)
          .innerJoin(schema.achievements, eq(schema.memberAchievements.achievementId, schema.achievements.id))
          .where(eq(schema.memberAchievements.userId, member.id))
          .orderBy(desc(schema.memberAchievements.unlockedAt))
        )
      : Promise.resolve({ data: [] }),
      
    canViewCosmetics
      ? safeQuery(
          db.select({
            itemId: schema.memberInventory.itemId,
            origin: schema.memberInventory.origin,
            acquiredAt: schema.memberInventory.acquiredAt,
            shop_items_id: schema.shopItems.id,
            shop_items_name: schema.shopItems.name,
            shop_items_description: schema.shopItems.description,
            shop_items_kind: schema.shopItems.kind,
            shop_items_rarity: schema.shopItems.rarity,
            shop_items_isAnimated: schema.shopItems.isAnimated,
            shop_items_styleData: schema.shopItems.styleData
          })
          .from(schema.memberInventory)
          .leftJoin(schema.shopItems, eq(schema.memberInventory.itemId, schema.shopItems.id))
          .where(eq(schema.memberInventory.userId, member.id))
          .orderBy(desc(schema.memberInventory.acquiredAt))
        )
      : Promise.resolve({ data: [] }),
      
    locals.user && locals.user.id !== member.id
      ? safeQuerySingle(db.select({ followerId: schema.userFollows.followerId }).from(schema.userFollows).where(and(eq(schema.userFollows.followerId, locals.user.id), eq(schema.userFollows.followingId, member.id))))
      : Promise.resolve({ data: null }),
      
    member.equippedBannerId
      ? safeQuerySingle(
          db.select({ id: schema.shopItems.id, styleData: schema.shopItems.styleData })
            .from(schema.shopItems)
            .where(eq(schema.shopItems.id, member.equippedBannerId))
        )
      : Promise.resolve({ data: null }),
      
    canViewFavorites
      ? safeQuery(
          db.select({
            favorite: schema.library.favorite,
            updatedAt: schema.library.updatedAt,
            works_id: schema.works.id,
            works_slug: schema.works.slug,
            works_title: schema.works.title,
            works_coverId: schema.works.coverId,
            works_kind: schema.works.kind,
            works_status: schema.works.status,
            works_year: schema.works.year,
            works_contentRating: schema.works.contentRating,
            works_viewsTotal: schema.works.viewsTotal
          })
          .from(schema.library)
          .innerJoin(schema.works, eq(schema.library.workId, schema.works.id))
          .where(and(eq(schema.library.userId, member.id), eq(schema.library.favorite, true), eq(schema.works.published, true)))
          .orderBy(desc(schema.library.updatedAt))
          .limit(24)
        )
      : Promise.resolve({ data: [] }),
      
    canViewReadingHistory
      ? safeQuery(
          db.select({
            chapterId: schema.reading.chapterId,
            page: schema.reading.page,
            maxPage: schema.reading.maxPage,
            completedAt: schema.reading.completedAt,
            updatedAt: schema.reading.updatedAt,
            chapters_id: schema.chapters.id,
            chapters_number: schema.chapters.number,
            chapters_title: schema.chapters.title,
            chapters_workId: schema.chapters.workId,
            works_id: schema.works.id,
            works_slug: schema.works.slug,
            works_title: schema.works.title,
            works_coverId: schema.works.coverId,
            works_kind: schema.works.kind,
            works_status: schema.works.status,
            works_contentRating: schema.works.contentRating
          })
          .from(schema.reading)
          .innerJoin(schema.chapters, eq(schema.reading.chapterId, schema.chapters.id))
          .innerJoin(schema.works, eq(schema.chapters.workId, schema.works.id))
          .where(and(eq(schema.reading.userId, member.id), eq(schema.works.published, true)))
          .orderBy(desc(schema.reading.updatedAt))
          .limit(80)
        )
      : Promise.resolve({ data: [] }),
      
    safeQuery(
      db.select({
        role: schema.scanMembers.role,
        isPublic: schema.scanMembers.isPublic,
        hiddenByAdmin: schema.scanMembers.hiddenByAdmin,
        createdAt: schema.scanMembers.createdAt,
        scans_id: schema.scans.id,
        scans_name: schema.scans.name,
        scans_slug: schema.scans.slug,
        scans_logoId: schema.scans.logoId,
        scans_isOfficial: schema.scans.isOfficial,
        scans_status: schema.scans.status,
        scans_description: schema.scans.description,
        scans_displayPreposition: schema.scans.displayPreposition
      })
      .from(schema.scanMembers)
      .innerJoin(schema.scans, eq(schema.scanMembers.scanId, schema.scans.id))
      .where(and(eq(schema.scanMembers.userId, member.id), eq(schema.scans.status, 'ACTIVE')))
    ),
    
    safeQuerySingle(db.select({ role: schema.accessRoles.role }).from(schema.accessRoles).where(and(eq(schema.accessRoles.userId, member.id), eq(schema.accessRoles.suspended, false)))),
    
    safeQuery(
      db.select({
        scanId: schema.scanMemberPositions.scanId,
        isPrimary: schema.scanMemberPositions.isPrimary,
        isPublic: schema.scanMemberPositions.isPublic,
        hiddenByAdmin: schema.scanMemberPositions.hiddenByAdmin,
        createdAt: schema.scanMemberPositions.createdAt,
        scan_positions_id: schema.scanPositions.id,
        scan_positions_name: schema.scanPositions.name,
        scan_positions_icon: schema.scanPositions.icon
      })
      .from(schema.scanMemberPositions)
      .innerJoin(schema.scanPositions, eq(schema.scanMemberPositions.positionId, schema.scanPositions.id))
      .where(eq(schema.scanMemberPositions.userId, member.id))
    )
  ]);

  // Format unlocked achievements
  const achievements = (achievementsRes.data || []).map((row: any) => ({
    unlockedAt: row.unlockedAt,
    id: row.id,
    title: row.title,
    description: row.description,
    icon: row.icon,
    badgeColor: row.badgeColor,
    category: row.category,
    rarity: row.rarity,
    xpReward: row.xpReward,
    isSecret: row.isSecret
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

  // Determine Featured Achievement
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

  // Format cosmetic items and deduplicate
  const cosmeticsMap = new Map<string, any>();
  for (const row of inventoryRes.data || []) {
    const itemKey = row.itemId || row.shop_items_id;
    if (!itemKey || cosmeticsMap.has(itemKey)) continue;

    if (row.shop_items_id) {
      cosmeticsMap.set(itemKey, {
        id: row.shop_items_id,
        name: row.shop_items_name,
        description: row.shop_items_description,
        kind: row.shop_items_kind,
        rarity: row.shop_items_rarity || 'COMUM',
        isAnimated: row.shop_items_isAnimated,
        styleData: typeof row.shop_items_styleData === 'string' ? JSON.parse(row.shop_items_styleData) : row.shop_items_styleData,
        origin: row.origin || 'SHOP',
        acquiredAt: row.acquiredAt
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
          isAnimated: false,
          styleData: null,
          origin: row.origin || 'LEGACY',
          acquiredAt: row.acquiredAt
        });
      } else {
        cosmeticsMap.set(itemKey, {
          id: itemKey,
          name: itemKey,
          description: 'Item cosmtico desbloqueado',
          kind: 'COSMETIC',
          rarity: 'COMUM',
          isAnimated: false,
          styleData: null,
          origin: row.origin || 'LEGACY',
          acquiredAt: row.acquiredAt
        });
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
    const { data: legacyShopItems } = await safeQuery(
      db.select({
        id: schema.shopItems.id,
        name: schema.shopItems.name,
        description: schema.shopItems.description,
        kind: schema.shopItems.kind,
        rarity: schema.shopItems.rarity,
        isAnimated: schema.shopItems.isAnimated,
        styleData: schema.shopItems.styleData
      })
      .from(schema.shopItems)
      .where(inArray(schema.shopItems.id, equippedLegacyIds))
    );

    for (const item of legacyShopItems || []) {
      if (!cosmeticsMap.has(item.id)) {
        cosmeticsMap.set(item.id, {
          id: item.id,
          name: item.name,
          description: item.description,
          kind: item.kind,
          rarity: item.rarity || 'COMUM',
          isAnimated: item.isAnimated,
          styleData: typeof item.styleData === 'string' ? JSON.parse(item.styleData) : item.styleData,
          origin: 'LEGACY',
          acquiredAt: member.createdAt
        });
      }
    }
  }

  if (member.equippedTitleId && !cosmeticsMap.has(member.equippedTitleId)) {
    const noxTitle = NOX_TITLES.find(
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
        acquiredAt: member.createdAt
      });
    }
  }

  if (member.nameColor && !cosmeticsMap.has(member.nameColor)) {
    cosmeticsMap.set(member.nameColor, {
      id: member.nameColor,
      name: 'Cor Personalizada',
      description: 'Cor exclusiva para o nome do leitor no perfil e comentrios.',
      kind: 'NAME_COLOR',
      rarity: 'RARA',
      isAnimated: false,
      styleData: { color: member.nameColor },
      origin: 'LEGACY',
      acquired_at: member.createdAt
    });
  }

  const cosmetics = Array.from(cosmeticsMap.values());

  const profileStats = {
    chapters_read: Number(chaptersReadRes.data?.count || 0),
    total_works: Number(totalWorksRes.data?.count || 0),
    completed_works: Number(completedWorksRes.data?.count || 0),
    favorites: Number(favoritesStatsRes.data?.count || 0),
    achievements_unlocked: achievements.length,
    achievements_total: Number(achievementsTotalRes.data?.count || 0),
    cosmetics_count: Math.max(Number(cosmeticsCountRes.data?.count || 0), cosmetics.length)
  };

  const favorites = (favoritesRes.data || []).map((r: any) => ({
    id: r.works_id,
    slug: r.works_slug,
    title: r.works_title,
    coverId: r.works_coverId,
    kind: r.works_kind,
    status: r.works_status,
    year: r.works_year,
    contentRating: r.works_contentRating,
    viewsTotal: r.works_viewsTotal
  })).filter(Boolean);

  const readingMap = new Map<string, any>();
  for (const r of (readingRes.data || []) as any[]) {
    const wid = r.works_id;
    if (!readingMap.has(wid)) {
      readingMap.set(wid, {
        workId: wid,
        workTitle: r.works_title,
        workSlug: r.works_slug,
        coverId: r.works_coverId,
        contentRating: r.works_contentRating,
        kind: r.works_kind,
        chapterId: r.chapters_id,
        chapterNumber: r.chapters_number,
        chapterTitle: r.chapters_title,
        page: r.page,
        maxPage: r.maxPage,
        completedAt: r.completedAt,
        updatedAt: r.updatedAt
      });
    }
    if (readingMap.size >= 16) break;
  }
  const recentReadings = Array.from(readingMap.values());

  const scanPositions = (scanMemberPositionsRes.data || []).map((p: any) => ({
    scanId: p.scanId,
    isPrimary: p.isPrimary,
    createdAt: p.createdAt,
    id: p.scan_positions_id,
    name: p.scan_positions_name,
    icon: p.scan_positions_icon
  }));

  const isViewerGlobalAdmin = ['ADMIN', 'EDITOR'].includes(locals.role || '');
  const canViewScanBadges = (
    !member.adminHideScanBadges || isViewerGlobalAdmin
  ) && (
    (member.privacyShowScans ?? 1) || isSelf || isViewerGlobalAdmin
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

    const mapped = rawScanRoles.map((r: any) => {
      const userPositions = scanPositions.filter((p: any) => p.scanId === r.scans_id && (isViewerGlobalAdmin || (!p.hiddenByAdmin && (p.isPublic || isSelf))));
      const primaryPos = userPositions.find((p: any) => p.isPrimary) || userPositions[0] || null;
      const prep = r.scans_displayPreposition || getScanPreposition({ name: r.scans_name } as any);
      const badgeText = formatScanBadgeText(r.role, primaryPos?.name, r.scans_name);
      const fullTitle = formatScanRoleTitle(r.role, primaryPos?.name, r.scans_name, prep);

      return {
        role: r.role,
        isPublic: r.isPublic,
        hiddenByAdmin: r.hiddenByAdmin,
        createdAt: r.createdAt,
        scan: {
          id: r.scans_id,
          name: r.scans_name,
          slug: r.scans_slug,
          logoId: r.scans_logoId,
          isOfficial: r.scans_isOfficial,
          status: r.scans_status,
          description: r.scans_description,
          displayPreposition: r.scans_displayPreposition
        },
        positions: userPositions,
        primaryPosition: primaryPos,
        badgeText,
        fullTitle
      };
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
    cosmetic_banner: bannerRes.data?.styleData ? (typeof bannerRes.data.styleData === 'string' ? JSON.parse(bannerRes.data.styleData) : bannerRes.data.styleData) : null,
    stats: profileStats,
    followersCount: followersCountRes.data?.count ?? 0,
    followingCount: followingCountRes.data?.count ?? 0,
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
    if (!locals.user) return fail(401, { message: 'No autenticado' });
    const formData = await request.formData();
    const showScans = formData.get('show_scans') === 'on';
    const mode = (formData.get('mode') as string) || 'PRIMARY';
    const { error: rpcErr } = await safeQuery(
      db.execute(sql`SELECT toggle_user_scan_privacy(${showScans}, ${mode})`)
    );
    if (rpcErr) return fail(400, { message: (rpcErr as any).message });
    return { success: true, action: 'toggleScanPrivacy' };
  },

  moderateUserScans: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'No autenticado' });
    const formData = await request.formData();
    const targetUserId = (formData.get('target_user_id') as string)?.trim();
    if (!targetUserId) return fail(400, { message: 'Usurio no informado' });
    const hideBadges = formData.get('hide_badges') === 'true';
    const { error: rpcErr } = await safeQuery(
      db.execute(sql`SELECT admin_moderate_user_scans(${targetUserId}, ${hideBadges})`)
    );
    if (rpcErr) return fail(400, { message: (rpcErr as any).message });
    return { success: true, action: 'moderateUserScans' };
  }
};
