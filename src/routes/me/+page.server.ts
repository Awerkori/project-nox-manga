import { redirect, fail, error } from '@sveltejs/kit';
import { db, schema, safeQuery, safeQuerySingle } from '$lib/server/db';
import { eq, and, desc, asc, isNull } from 'drizzle-orm';
import { withTimeout } from '$lib/server/resilience';
import { invalidateUserSession } from '$lib/server/session-cache';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) {
    if (locals.authTimeout) {
      throw error(503, 'Instabilidade temporária na autenticação. Por favor, recarregue a página em instantes.');
    }
    redirect(303, '/entrar');
  }

  const [
    memberRes,
    libraryRes,
    historyRes,
    notificationsRes,
    allAchievementsRes,
    memberAchievementsRes,
    inventoryRes
  ] = await withTimeout(
    Promise.all([
      safeQuerySingle(
        db.select().from(schema.members).where(eq(schema.members.id, locals.user!.id))
      ),
      safeQuery(
        db.select({
          library: schema.library,
          works: {
             id: schema.works.id,
             slug: schema.works.slug,
             title: schema.works.title,
             aliases: schema.works.aliases,
             synopsis: schema.works.synopsis,
             description: schema.works.description,
             author: schema.works.author,
             artist: schema.works.artist,
             kind: schema.works.kind,
             status: schema.works.status,
             year: schema.works.year,
             ageRating: schema.works.ageRating,
             published: schema.works.published,
             featured: schema.works.featured,
             coverId: schema.works.coverId,
             updatedAt: schema.works.updatedAt,
             createdAt: schema.works.createdAt,
             contentRating: schema.works.contentRating,
             viewsTotal: schema.works.viewsTotal
          }
        })
        .from(schema.library)
        .innerJoin(schema.works, eq(schema.library.workId, schema.works.id))
        .where(and(eq(schema.library.userId, locals.user!.id), eq(schema.works.published, true)))
        .orderBy(desc(schema.library.updatedAt))
      ),
      safeQuery(
         db.select({
            reading: schema.reading,
            chapters: schema.chapters,
            works: {
               id: schema.works.id,
               title: schema.works.title,
               slug: schema.works.slug,
               coverId: schema.works.coverId,
               contentRating: schema.works.contentRating,
            }
         })
         .from(schema.reading)
         .innerJoin(schema.chapters, eq(schema.reading.chapterId, schema.chapters.id))
         .innerJoin(schema.works, eq(schema.chapters.workId, schema.works.id))
         .where(eq(schema.reading.userId, locals.user!.id))
         .orderBy(desc(schema.reading.updatedAt))
         .limit(60)
      ),
      safeQuery(
        db.select().from(schema.notifications).where(eq(schema.notifications.userId, locals.user!.id)).orderBy(desc(schema.notifications.createdAt)).limit(50)
      ),
      safeQuery(
        db.select().from(schema.achievements).orderBy(asc(schema.achievements.orderIndex))
      ),
      safeQuery(
        db.select({
          achievementId: schema.memberAchievements.achievementId,
          unlockedAt: schema.memberAchievements.unlockedAt
        }).from(schema.memberAchievements).where(eq(schema.memberAchievements.userId, locals.user!.id))
      ),
      safeQuery(
        db.select({
           inventory: schema.memberInventory,
           shopItems: schema.shopItems
        })
        .from(schema.memberInventory)
        .innerJoin(schema.shopItems, eq(schema.memberInventory.itemId, schema.shopItems.id))
        .where(eq(schema.memberInventory.userId, locals.user!.id))
        .orderBy(desc(schema.memberInventory.acquiredAt))
      )
    ]),
    4000,
    [{ data: locals.profile || locals.sessionCache?.profile || null }, { data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }] as any,
    'me_load_batch'
  );

  const m = memberRes?.data || locals.profile || locals.sessionCache?.profile;
  const rawMember =
    (m ? {id: m.id,
      username: m.username,
      displayName: m.displayName,
      bio: m.bio,
      avatarId: m.avatarId,
      bannerId: m.bannerId,
      avatarFrameId: m.avatarFrameId,
      nameColor: m.nameColor,
      equippedTitleId: m.equippedTitleId,
      equippedBadgeId: m.equippedBadgeId,
      equippedBannerId: m.equippedBannerId,
      equippedCommentBannerId: m.equippedCommentBannerId,
      xp: m.xp,
      ageStatus: m.ageStatus,
      blurNsfw: m.blurNsfw,
      featuredAchievementId: m.featuredAchievementId,
      privacyShowAchievements: m.privacyShowAchievements,
      privacyShowCosmetics: m.privacyShowCosmetics,
      privacyShowFavorites: m.privacyShowFavorites,
      privacyShowReadingHistory: m.privacyShowReadingHistory,
      privacyShowScans: m.privacyShowScans,
      privacyScanMode: m.privacyScanMode,
      avatarCrop: m.avatarCrop,
      bannerCrop: m.bannerCrop,
      createdAt: m.createdAt} : null) ||
    locals.profile ||
    locals.sessionCache?.profile ||
    ({id: locals.user!.id,
      username: locals.user.email ? locals.user.email.split('@')[0] : 'leitor',
      displayName: locals.user.email ? locals.user.email.split('@')[0] : 'Leitor',
      bio: '',
      avatarId: null,
      bannerId: null,
      avatarFrameId: null,
      nameColor: null,
      equippedTitleId: null,
      equippedBadgeId: null,
      equippedBannerId: null,
      equippedCommentBannerId: null,
      xp: 0,
      ageStatus: 'UNKNOWN',
      blurNsfw: true,
      featuredAchievementId: null,
      privacyShowAchievements: true,
      privacyShowCosmetics: true,
      privacyShowFavorites: true,
      privacyShowReadingHistory: true,
      privacyShowScans: true,
      privacyScanMode: 'ALL',
      avatarCrop: null,
      bannerCrop: null,
      createdAt: new Date().toISOString()} as any);

  const member = {
    ...rawMember,
    frame_id: rawMember.avatarFrameId
  };

  const unlockedMap = new Map(
    (memberAchievementsRes.data || []).map((ma: any) => [ma.achievementId, ma.unlockedAt])
  );

  const achievements = (allAchievementsRes.data || []).map((ach: any) => ({...ach,
    orderIndex: ach.orderIndex,
    image_url: ach.imageUrl,
    xpReward: ach.xpReward,
    createdAt: ach.createdAt,
    unlocked: unlockedMap.has(ach.id),
    unlockedAt: unlockedMap.get(ach.id) || null}));

  const inventory = (inventoryRes?.data || []).map((inv: any) => ({acquiredAt: inv.inventory.acquiredAt,
    ...inv.shopItems,
    price_coins: inv.shopItems.priceCoins,
    content_id: inv.shopItems.contentId,
    createdAt: inv.shopItems.createdAt}));

  const mappedLibrary = (libraryRes.data || []).map((row: any) => ({...row.library,
     userId: row.library.userId,
     workId: row.library.workId,
     chapterId: row.library.chapterId,
     createdAt: row.library.createdAt,
     updatedAt: row.library.updatedAt,
     works: {
        ...row.works,
        ageRating: row.works.ageRating,
        coverId: row.works.coverId,
        updatedAt: row.works.updatedAt,
        createdAt: row.works.createdAt,
        contentRating: row.works.contentRating,
        viewsTotal: row.works.viewsTotal}
  }));

  const mappedHistory = (historyRes.data || []).map((row: any) => ({chapterId: row.reading.chapterId,
     page: row.reading.page,
     maxPage: row.reading.maxPage,
     completedAt: row.reading.completedAt,
     updatedAt: row.reading.updatedAt,
     chapters: {
        id: row.chapters.id,
        number: row.chapters.number,
        title: row.chapters.title,
        works: {
           id: row.works.id,
           title: row.works.title,
           slug: row.works.slug,
           coverId: row.works.coverId,
           contentRating: row.works.contentRating}
     }
  }));

  const mappedNotifications = (notificationsRes.data || []).map((n: any) => ({...n,
     userId: n.userId,
     actorId: n.actorId,
     workId: n.workId,
     chapterId: n.chapterId,
     commentId: n.commentId,
     scanId: n.scanId,
     createdAt: n.createdAt,
     readAt: n.readAt}));

  return {
    member,
    library: mappedLibrary,
    history: mappedHistory,
    notifications: mappedNotifications,
    achievements,
    inventory
  };
};

export const actions: Actions = {
  updateProfile: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const displayName = (formData.get('display_name') as string)?.trim();
    const bio = (formData.get('bio') as string)?.trim() ?? '';

    if (!displayName || displayName.length < 2 || displayName.length > 50) {
      return fail(400, { message: 'O nome de exibição deve ter entre 2 e 50 caracteres.' });
    }

    if (bio.length > 500) {
      return fail(400, { message: 'A biografia não pode exceder 500 caracteres.' });
    }

    const { error } = await safeQuerySingle(
      db.update(schema.members)
        .set({
          displayName: displayName,
          bio: bio
        })
        .where(eq(schema.members.id, locals.user!.id))
        .returning()
    );

    if (error) return fail(400, { message: (error as any).message });
    invalidateUserSession(locals.user!.id);
    return { success: true, action: 'profile' };
  },

  updateSettings: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'No autenticado' });
    const formData = await request.formData();
    const blurNsfw = formData.get('blur_nsfw') === 'on';
    const privacyShowAchievements = formData.get('privacy_show_achievements') === 'on';
    const privacyShowCosmetics = formData.get('privacy_show_cosmetics') === 'on';
    const privacyShowFavorites = formData.get('privacy_show_favorites') === 'on';
    const privacyShowReadingHistory = formData.get('privacy_show_reading_history') === 'on';
    const privacyShowScans = formData.get('privacy_show_scans') === 'on';
    const privacyScanMode = (formData.get('privacy_scan_mode') as string) || 'PRIMARY';

    const { error } = await safeQuerySingle(
      db.update(schema.members)
        .set({
          blurNsfw: blurNsfw,
          privacyShowAchievements: privacyShowAchievements,
          privacyShowCosmetics: privacyShowCosmetics,
          privacyShowFavorites: privacyShowFavorites,
          privacyShowReadingHistory: privacyShowReadingHistory,
          privacyShowScans: privacyShowScans,
          privacyScanMode: privacyScanMode as any
        })
        .where(eq(schema.members.id, locals.user!.id))
        .returning()
    );

    if (error) return fail(400, { message: (error as any).message });
    return { success: true, action: 'settings' };
  },

  setFeaturedAchievement: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'No autenticado' });
    const formData = await request.formData();
    const achievementId = (formData.get('achievement_id') as string)?.trim() || null;

    if (achievementId) {
       const { data: hasAchiev } = await safeQuerySingle(db.select().from(schema.memberAchievements).where(and(eq(schema.memberAchievements.userId, locals.user!.id), eq(schema.memberAchievements.achievementId, achievementId))));
       if (!hasAchiev) return fail(400, { message: 'Você não possui esta conquista.' });
    }

    const { error } = await safeQuerySingle(
      db.update(schema.members)
        .set({ featuredAchievementId: achievementId })
        .where(eq(schema.members.id, locals.user!.id))
        .returning()
    );

    if (error) return fail(400, { message: (error as any).message });
    return { success: true, action: 'featured_achievement' };
  },

  markAllNotificationsRead: async ({ locals }) => {
    if (!locals.user) return fail(401, { message: 'No autenticado' });
    const { error } = await safeQuery(
      db.update(schema.notifications)
        .set({ readAt: new Date().toISOString() })
        .where(and(
          eq(schema.notifications.userId, locals.user!.id),
          isNull(schema.notifications.readAt)
        ))
        .returning()
    );

    if (error) return fail(400, { message: (error as any).message });
    return { success: true, action: 'notifications' };
  },

  markNotificationRead: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'No autenticado' });
    const formData = await request.formData();
    const id = String(formData.get('id') || '');
    if (!id) return fail(400, { message: 'ID ausente' });

    // ENFORCING RLS logic here by checking locals.user!.id
    const { error } = await safeQuerySingle(
      db.update(schema.notifications)
        .set({ readAt: new Date().toISOString() })
        .where(and(
          eq(schema.notifications.id, id),
          eq(schema.notifications.userId, locals.user!.id)
        ))
        .returning()
    );

    if (error) return fail(400, { message: (error as any).message });
    return { success: true, markedReadId: id };
  },

  updateAvatarCrop: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'No autenticado' });
    const formData = await request.formData();
    const x = parseFloat(formData.get('x') as string) || 50;
    const y = parseFloat(formData.get('y') as string) || 50;
    const zoom = parseFloat(formData.get('zoom') as string) || 1;
    const crop = {
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
      zoom: Math.max(1, Math.min(3, zoom))
    };

    const { error } = await safeQuerySingle(
      db.update(schema.members)
        .set({ avatarCrop: JSON.stringify(crop) })
        .where(eq(schema.members.id, locals.user!.id))
        .returning()
    );

    if (error) return fail(400, { message: (error as any).message });
    invalidateUserSession(locals.user!.id);
    return {success: true, action: 'avatarCrop', crop};
  },

  updateBannerCrop: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'No autenticado' });
    const formData = await request.formData();
    const x = parseFloat(formData.get('x') as string) || 50;
    const y = parseFloat(formData.get('y') as string) || 50;
    const zoom = parseFloat(formData.get('zoom') as string) || 1;
    const crop = {
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
      zoom: Math.max(1, Math.min(3, zoom))
    };

    const { error } = await safeQuerySingle(
      db.update(schema.members)
        .set({ bannerCrop: JSON.stringify(crop) })
        .where(eq(schema.members.id, locals.user!.id))
        .returning()
    );

    if (error) return fail(400, { message: (error as any).message });
    invalidateUserSession(locals.user!.id);
    return {success: true, action: 'bannerCrop', crop};
  }
};
