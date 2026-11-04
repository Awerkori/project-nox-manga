import { redirect, fail } from '@sveltejs/kit';
import { normalizeAvatarCrop } from '$lib/avatar';
import { storeImage, RateLimitError } from '$lib/server/media';
import { invalidateUserSession } from '$lib/server/session-cache';
import { executeYugabyteSql } from '$lib/server/yugabyte';
import { enrichReadingRowsWithCatalog } from '$lib/server/reading-history';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals, platform }) => {
  if (!locals.user) {
    redirect(303, '/entrar');
  }

  let memberData: any = null;
  let libraryData: any[] = [];
  let historyData: any[] = [];
  let notificationsData: any[] = [];
  let allAchievementsData: any[] = [];
  let memberAchievementsData: any[] = [];
  let inventoryData: any[] = [];

  try {
    const [
      mRes,
      libRes,
      readRes,
      notifRes,
      achRes,
      mAchRes,
      invRes
    ] = await Promise.all([
      executeYugabyteSql(`SELECT * FROM public.members WHERE id = $1 LIMIT 1;`, [locals.user.id], platform?.env),
      executeYugabyteSql(
        `SELECT l.*, row_to_json(w.*) AS works
         FROM public.library l
         JOIN public.works w ON w.id = l.work_id
         WHERE l.user_id = $1 AND w.published = true
         ORDER BY l.updated_at DESC;`,
        [locals.user.id],
        platform?.env
      ),
      executeYugabyteSql(
        `SELECT r.chapter_id, c.work_id, r.page, r.max_page, r.completed_at, r.updated_at,
                c.id AS chapter_catalog_id, c.number AS chapter_number, c.display_number AS chapter_display_number,
                c.canonical_chapter_key, c.chapter_order_key, c.title AS chapter_title,
                c.work_id AS chapter_work_id, c.published_at AS chapter_published_at,
                w.id AS work_catalog_id, w.slug AS work_slug, w.title AS work_title, w.cover_id AS work_cover_id,
                w.kind AS work_kind, w.status AS work_status, w.published AS work_published,
                w.content_rating AS work_content_rating
         FROM public.reading r
         JOIN public.chapters c ON c.id = r.chapter_id
         JOIN public.works w ON w.id = c.work_id AND (w.published = true OR w.published IS NULL)
         WHERE r.user_id = $1
         ORDER BY r.updated_at DESC
         LIMIT 60;`,
        [locals.user.id],
        platform?.env
      ),
      executeYugabyteSql(
        `SELECT * FROM public.notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50;`,
        [locals.user.id],
        platform?.env
      ),
      executeYugabyteSql(`SELECT * FROM public.achievements ORDER BY order_index ASC;`, [], platform?.env),
      executeYugabyteSql(`SELECT achievement_id, unlocked_at FROM public.member_achievements WHERE user_id = $1;`, [locals.user.id], platform?.env),
      executeYugabyteSql(
        `SELECT mi.item_id, mi.acquired_at, row_to_json(si.*) AS shop_items
         FROM public.member_inventory mi
         JOIN public.shop_items si ON si.id = mi.item_id
         WHERE mi.user_id = $1
         ORDER BY mi.acquired_at DESC;`,
        [locals.user.id],
        platform?.env
      )
    ]);

    if (mRes.rows && mRes.rows[0]) {
      memberData = mRes.rows[0];
      libraryData = libRes.rows || [];
      historyData = readRes.rows || [];
      notificationsData = notifRes.rows || [];
      allAchievementsData = achRes.rows || [];
      memberAchievementsData = mAchRes.rows || [];
      inventoryData = invRes.rows || [];
    }
  } catch (ybErr) {
    console.warn('ME_LOAD_YUGABYTE_ERROR', ybErr);
  }

  const rawMember =
    memberData ||
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
    (memberAchievementsData || []).map((ma: any) => [ma.achievement_id, ma.unlocked_at])
  );

  const achievements = (allAchievementsData || []).map((ach: any) => ({
    ...ach,
    unlocked: unlockedMap.has(ach.id),
    unlocked_at: unlockedMap.get(ach.id) || null
  }));

  const inventory = (inventoryData || []).map((inv: any) => ({
    acquired_at: inv.acquired_at,
    ...inv.shop_items
  }));

  const enrichedHistory =
    Array.isArray(historyData) && historyData.length > 0
      ? await enrichReadingRowsWithCatalog(historyData, null, platform?.env)
      : [];

  return {
    member,
    library: libraryData,
    history: enrichedHistory,
    notifications: notificationsData,
    achievements,
    inventory
  };
};

export const actions: Actions = {
  updateProfile: async ({ request, locals, platform }: { request: Request; locals: App.Locals; platform?: any }) => {
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

    // Media selected in the editor is intentionally not activated by the crop
    // modal. Store every pending asset first, then commit the complete profile
    // in one member update. A failed second upload therefore leaves the
    // canonical avatar/banner and profile fields untouched.
    const avatarFile = formData.get('avatar_file');
    const bannerFile = formData.get('banner_file');
    const isPendingImage = (value: FormDataEntryValue | null): value is Blob =>
      value instanceof Blob && value.size > 0;
    const avatarCropRaw = formData.get('avatar_crop');
    const bannerCropRaw = formData.get('banner_crop');
    const avatarCrop = avatarCropRaw ? normalizeAvatarCrop(avatarCropRaw) : null;
    const bannerCrop = bannerCropRaw ? normalizeAvatarCrop(bannerCropRaw) : null;

    let avatarImage: { id: string } | null = null;
    let bannerImage: { id: string } | null = null;
    try {
      if (isPendingImage(avatarFile)) {
        const upload = new FormData();
        upload.append('file', avatarFile, (avatarFile as File).name || 'avatar');
        avatarImage = await storeImage(upload, locals.user.id, 'avatar');
      }
      if (isPendingImage(bannerFile)) {
        const upload = new FormData();
        upload.append('file', bannerFile, (bannerFile as File).name || 'banner');
        bannerImage = await storeImage(upload, locals.user.id, 'banner');
      }
    } catch (cause) {
      if (cause instanceof RateLimitError) {
        return fail(429, {
          message: `Canal em espera. Tente novamente em ${cause.retryAfter}s.`,
          retryAfter: cause.retryAfter
        });
      }
      console.error('ME_PROFILE_MEDIA_STAGE_ERROR:', cause);
      return fail(502, { message: 'Não foi possível preparar a mídia. Nenhuma alteração foi aplicada.' });
    }

    const update: Record<string, unknown> = {
      display_name: displayName,
      bio
    };
    if (avatarImage) update.avatar_id = avatarImage.id;
    if (bannerImage) update.banner_id = bannerImage.id;
    if (avatarCrop) update.avatar_crop = avatarCrop;
    if (bannerCrop) update.banner_crop = bannerCrop;

    let updatedMember: any = null;
    try {
      const ybRes = await executeYugabyteSql(
        `UPDATE public.members
         SET display_name = COALESCE($1, display_name),
             bio = COALESCE($2, bio),
             avatar_id = COALESCE($3, avatar_id),
             banner_id = COALESCE($4, banner_id),
             avatar_crop = COALESCE($5, avatar_crop),
             banner_crop = COALESCE($6, banner_crop)
         WHERE id = $7
         RETURNING id, username, display_name, bio, avatar_id, banner_id, avatar_frame_id, avatar_crop, banner_crop, name_color;`,
        [
          displayName || null,
          bio !== undefined ? bio : null,
          avatarImage?.id || null,
          bannerImage?.id || null,
          avatarCrop ? JSON.stringify(avatarCrop) : null,
          bannerCrop ? JSON.stringify(bannerCrop) : null,
          locals.user.id
        ],
        platform?.env
      );
      if (ybRes && ybRes.rows && ybRes.rows[0]) {
        updatedMember = ybRes.rows[0];
      }
    } catch (ybProblem) {
      console.warn('me_profile_yugabyte_update_warning', ybProblem);
    }

    if (!updatedMember) {
      return fail(500, { message: 'Não foi possível salvar seu perfil. Nenhuma mídia nova foi ativada.' });
    }

    // The root layout uses this cache for the header avatar. Evict it before
    // SvelteKit invalidates the page so every mounted layout receives the
    // canonical media id immediately, without polling or a page reload.
    invalidateUserSession(locals.user.id);
    return { success: true, action: 'profile', member: updatedMember };
  },

  updateSettings: async ({ request, locals, platform }: any) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const blurNsfw = formData.get('blur_nsfw') === 'on';
    const privacyShowAchievements = formData.get('privacy_show_achievements') === 'on';
    const privacyShowCosmetics = formData.get('privacy_show_cosmetics') === 'on';
    const privacyShowFavorites = formData.get('privacy_show_favorites') === 'on';
    const privacyShowReadingHistory = formData.get('privacy_show_reading_history') === 'on';
    const privacyShowScans = formData.get('privacy_show_scans') === 'on';
    const privacyScanMode = (formData.get('privacy_scan_mode') as string) || 'PRIMARY';

    try {
      await executeYugabyteSql(
        `UPDATE public.members
         SET blur_nsfw = $1,
             privacy_show_achievements = $2,
             privacy_show_cosmetics = $3,
             privacy_show_favorites = $4,
             privacy_show_reading_history = $5,
             privacy_show_scans = $6,
             privacy_scan_mode = $7
         WHERE id = $8;`,
        [blurNsfw, privacyShowAchievements, privacyShowCosmetics, privacyShowFavorites, privacyShowReadingHistory, privacyShowScans, privacyScanMode, locals.user.id],
        platform?.env
      );
    } catch (ybErr) {
      console.warn('ME_SETTINGS_YUGABYTE_UPDATE_ERROR:', ybErr);
    }

    invalidateUserSession(locals.user.id);
    return { success: true, action: 'settings' };
  },

  setFeaturedAchievement: async ({ request, locals, platform }: any) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const achievementId = (formData.get('achievement_id') as string)?.trim() || null;

    try {
      await executeYugabyteSql(
        `UPDATE public.members SET featured_achievement_id = $1 WHERE id = $2;`,
        [achievementId, locals.user.id],
        platform?.env
      );
      invalidateUserSession(locals.user.id);
    } catch (err: any) {
      return fail(400, { message: err?.message || 'Falha ao atualizar conquista em destaque' });
    }
    return { success: true, action: 'featured_achievement' };
  },

  markAllNotificationsRead: async ({ locals, platform }: any) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    try {
      await executeYugabyteSql(
        `UPDATE public.notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL;`,
        [locals.user.id],
        platform?.env
      );
    } catch (err: any) {
      return fail(400, { message: err?.message || 'Falha ao marcar notificações como lidas' });
    }
    return { success: true, action: 'notifications' };
  },

  markNotificationRead: async ({ request, locals, platform }: any) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const id = String(formData.get('id') || '');
    if (!id) return fail(400, { message: 'ID ausente' });
    try {
      await executeYugabyteSql(
        `UPDATE public.notifications SET read_at = now() WHERE id = $1 AND user_id = $2;`,
        [id, locals.user.id],
        platform?.env
      );
    } catch (err: any) {
      return fail(400, { message: err?.message || 'Falha ao marcar notificação' });
    }
    return { success: true, markedReadId: id };
  },

  updateAvatarCrop: async ({ request, locals, platform }: any) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const crop = normalizeAvatarCrop({ x: formData.get('x'), y: formData.get('y'), zoom: formData.get('zoom') });

    try {
      await executeYugabyteSql(
        `UPDATE public.members SET avatar_crop = $1 WHERE id = $2;`,
        [JSON.stringify(crop), locals.user.id],
        platform?.env
      );
    } catch (err: any) {
      return fail(400, { message: err?.message || 'Falha ao atualizar enquadramento do avatar' });
    }
    invalidateUserSession(locals.user.id);
    return { success: true, action: 'avatar_crop', crop };
  },

  updateBannerCrop: async ({ request, locals, platform }: any) => {
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

    try {
      await executeYugabyteSql(
        `UPDATE public.members SET banner_crop = $1 WHERE id = $2;`,
        [JSON.stringify(crop), locals.user.id],
        platform?.env
      );
    } catch (err: any) {
      return fail(400, { message: err?.message || 'Falha ao atualizar enquadramento do banner' });
    }
    invalidateUserSession(locals.user.id);
    return { success: true, action: 'banner_crop', crop };
  }
};
