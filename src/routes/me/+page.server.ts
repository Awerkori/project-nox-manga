import { redirect, fail } from '@sveltejs/kit';
import { db, schema, safeQuery, safeQuerySingle } from '$lib/server/db';
import { eq, and, desc, asc, isNull } from 'drizzle-orm';
import { withTimeout } from '$lib/server/resilience';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) {
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
        db.select().from(schema.members).where(eq(schema.members.id, locals.user.id))
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
        .where(and(eq(schema.library.userId, locals.user.id), eq(schema.works.published, true)))
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
         .where(eq(schema.reading.userId, locals.user.id))
         .orderBy(desc(schema.reading.updatedAt))
         .limit(60)
      ),
      safeQuery(
        db.select().from(schema.notifications).where(eq(schema.notifications.userId, locals.user.id)).orderBy(desc(schema.notifications.createdAt)).limit(50)
      ),
      safeQuery(
        db.select().from(schema.achievements).orderBy(asc(schema.achievements.orderIndex))
      ),
      safeQuery(
        db.select({
          achievementId: schema.memberAchievements.achievementId,
          unlockedAt: schema.memberAchievements.unlockedAt
        }).from(schema.memberAchievements).where(eq(schema.memberAchievements.userId, locals.user.id))
      ),
      safeQuery(
        db.select({
           inventory: schema.memberInventory,
           shopItems: schema.shopItems
        })
        .from(schema.memberInventory)
        .innerJoin(schema.shopItems, eq(schema.memberInventory.itemId, schema.shopItems.id))
        .where(eq(schema.memberInventory.userId, locals.user.id))
        .orderBy(desc(schema.memberInventory.acquiredAt))
      )
    ]),
    4000,
    [{ data: locals.sessionCache?.profile || null }, { data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }] as any,
    'me_load_batch'
  );

  const m = memberRes?.data;
  const rawMember =
    (m ? {
      id: m.id,
      username: m.username,
      display_name: m.displayName,
      bio: m.bio,
      avatar_id: m.avatarId,
      banner_id: m.bannerId,
      avatar_frame_id: m.avatarFrameId,
      name_color: m.nameColor,
      equipped_title_id: m.equippedTitleId,
      equipped_badge_id: m.equippedBadgeId,
      equipped_banner_id: m.equippedBannerId,
      equipped_comment_banner_id: m.equippedCommentBannerId,
      xp: m.xp,
      age_status: m.ageStatus,
      blur_nsfw: m.blurNsfw,
      featured_achievement_id: m.featuredAchievementId,
      privacy_show_achievements: m.privacyShowAchievements,
      privacy_show_cosmetics: m.privacyShowCosmetics,
      privacy_show_favorites: m.privacyShowFavorites,
      privacy_show_reading_history: m.privacyShowReadingHistory,
      privacy_show_scans: m.privacyShowScans,
      privacy_scan_mode: m.privacyScanMode,
      avatar_crop: m.avatarCrop,
      banner_crop: m.bannerCrop,
      created_at: m.createdAt
    } : null) ||
    locals.sessionCache?.profile ||
    ({
      id: locals.user.id,
      username: locals.user.email ? locals.user.email.split('@')[0] : 'leitor',
      display_name: locals.user.email ? locals.user.email.split('@')[0] : 'Leitor',
      bio: '',
      avatar_id: null,
      banner_id: null,
      avatar_frame_id: null,
      name_color: null,
      equipped_title_id: null,
      equipped_badge_id: null,
      equipped_banner_id: null,
      equipped_comment_banner_id: null,
      xp: 0,
      age_status: 'UNKNOWN',
      blur_nsfw: true,
      featured_achievement_id: null,
      privacy_show_achievements: true,
      privacy_show_cosmetics: true,
      privacy_show_favorites: true,
      privacy_show_reading_history: true,
      privacy_show_scans: true,
      privacy_scan_mode: 'ALL',
      avatar_crop: null,
      banner_crop: null,
      created_at: new Date().toISOString()
    } as any);

  const member = {
    ...rawMember,
    frame_id: rawMember.avatar_frame_id
  };

  const unlockedMap = new Map(
    (memberAchievementsRes.data || []).map((ma: any) => [ma.achievementId, ma.unlockedAt])
  );

  const achievements = (allAchievementsRes.data || []).map((ach: any) => ({
    ...ach,
    order_index: ach.orderIndex,
    image_url: ach.imageUrl,
    xp_reward: ach.xpReward,
    created_at: ach.createdAt,
    unlocked: unlockedMap.has(ach.id),
    unlocked_at: unlockedMap.get(ach.id) || null
  }));

  const inventory = (inventoryRes.data || []).map((inv: any) => ({
    acquired_at: inv.inventory.acquiredAt,
    ...inv.shopItems,
    price_coins: inv.shopItems.priceCoins,
    content_id: inv.shopItems.contentId,
    created_at: inv.shopItems.createdAt
  }));

  const mappedLibrary = (libraryRes.data || []).map(row => ({
     ...row.library,
     user_id: row.library.userId,
     work_id: row.library.workId,
     chapter_id: row.library.chapterId,
     created_at: row.library.createdAt,
     updated_at: row.library.updatedAt,
     works: {
        ...row.works,
        age_rating: row.works.ageRating,
        cover_id: row.works.coverId,
        updated_at: row.works.updatedAt,
        created_at: row.works.createdAt,
        content_rating: row.works.contentRating,
        views_total: row.works.viewsTotal
     }
  }));

  const mappedHistory = (historyRes.data || []).map(row => ({
     chapter_id: row.reading.chapterId,
     page: row.reading.page,
     max_page: row.reading.maxPage,
     completed_at: row.reading.completedAt,
     updated_at: row.reading.updatedAt,
     chapters: {
        id: row.chapters.id,
        number: row.chapters.number,
        title: row.chapters.title,
        works: {
           id: row.works.id,
           title: row.works.title,
           slug: row.works.slug,
           cover_id: row.works.coverId,
           content_rating: row.works.contentRating
        }
     }
  }));

  const mappedNotifications = (notificationsRes.data || []).map(n => ({
     ...n,
     user_id: n.userId,
     actor_id: n.actorId,
     work_id: n.workId,
     chapter_id: n.chapterId,
     comment_id: n.commentId,
     scan_id: n.scanId,
     created_at: n.createdAt,
     read_at: n.readAt
  }));

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
        .where(eq(schema.members.id, locals.user.id))
        .returning()
    );

    if (error) return fail(400, { message: error.message });
    return { success: true, action: 'profile' };
  },

  updateSettings: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
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
        .where(eq(schema.members.id, locals.user.id))
        .returning()
    );

    if (error) return fail(400, { message: error.message });
    return { success: true, action: 'settings' };
  },

  setFeaturedAchievement: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const achievementId = (formData.get('achievement_id') as string)?.trim() || null;

    if (achievementId) {
       const hasAchiev = await safeQuerySingle(db.select().from(schema.memberAchievements).where(and(eq(schema.memberAchievements.userId, locals.user.id), eq(schema.memberAchievements.achievementId, achievementId))));
       if (hasAchiev.error || !hasAchiev.data) return fail(400, { message: 'Você não possui esta conquista.' });
    }

    const { error } = await safeQuerySingle(
      db.update(schema.members)
        .set({ featuredAchievementId: achievementId })
        .where(eq(schema.members.id, locals.user.id))
        .returning()
    );

    if (error) return fail(400, { message: error.message });
    return { success: true, action: 'featured_achievement' };
  },

  markAllNotificationsRead: async ({ locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const { error } = await safeQuery(
      db.update(schema.notifications)
        .set({ readAt: new Date().toISOString() })
        .where(and(
          eq(schema.notifications.userId, locals.user.id),
          isNull(schema.notifications.readAt)
        ))
        .returning()
    );

    if (error) return fail(400, { message: error.message });
    return { success: true, action: 'notifications' };
  },

  markNotificationRead: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const id = String(formData.get('id') || '');
    if (!id) return fail(400, { message: 'ID ausente' });

    // ENFORCING RLS logic here by checking locals.user.id
    const { error } = await safeQuerySingle(
      db.update(schema.notifications)
        .set({ readAt: new Date().toISOString() })
        .where(and(
          eq(schema.notifications.id, id),
          eq(schema.notifications.userId, locals.user.id)
        ))
        .returning()
    );

    if (error) return fail(400, { message: error.message });
    return { success: true, markedReadId: id };
  },

  updateAvatarCrop: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
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
        .set({ avatarCrop: crop })
        .where(eq(schema.members.id, locals.user.id))
        .returning()
    );

    if (error) return fail(400, { message: error.message });
    return { success: true, action: 'avatar_crop', crop };
  },

  updateBannerCrop: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
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
        .set({ bannerCrop: crop })
        .where(eq(schema.members.id, locals.user.id))
        .returning()
    );

    if (error) return fail(400, { message: error.message });
    return { success: true, action: 'banner_crop', crop };
  }
};
