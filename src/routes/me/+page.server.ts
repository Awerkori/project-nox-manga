import { redirect, fail } from '@sveltejs/kit';
import { WORK_FIELDS } from '$lib/server/db';
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
      locals.db
        .from('members')
        .select(`
          id,
          username,
          display_name,
          bio,
          avatar_id,
          banner_id,
          avatar_frame_id,
          name_color,
          equipped_title_id,
          equipped_badge_id,
          equipped_banner_id,
          equipped_comment_banner_id,
          xp,
          age_status,
          blur_nsfw,
          featured_achievement_id,
          privacy_show_achievements,
          privacy_show_cosmetics,
          privacy_show_favorites,
          privacy_show_reading_history,
          privacy_show_scans,
          privacy_scan_mode,
          avatar_crop,
          banner_crop,
          created_at
        `)
        .eq('id', locals.user.id)
        .maybeSingle(),
      locals.db
        .from('library')
        .select(`*, works!inner(${WORK_FIELDS})`)
        .eq('user_id', locals.user.id)
        .eq('works.published', true)
        .order('updated_at', { ascending: false }),
      locals.db
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
            works!inner(id, title, slug, cover_id, content_rating)
          )
        `)
        .eq('user_id', locals.user.id)
        .order('updated_at', { ascending: false })
        .limit(60),
      locals.db
        .from('notifications')
        .select('*')
        .eq('user_id', locals.user.id)
        .order('created_at', { ascending: false })
        .limit(50),
      locals.db
        .from('achievements')
        .select('*')
        .order('order_index', { ascending: true }),
      locals.db
        .from('member_achievements')
        .select('achievement_id, unlocked_at')
        .eq('user_id', locals.user.id),
      locals.db
        .from('member_inventory')
        .select(`
          item_id,
          acquired_at,
          shop_items!inner(*)
        `)
        .eq('user_id', locals.user.id)
        .order('acquired_at', { ascending: false })
    ]),
    4000,
    [{ data: locals.sessionCache?.profile || null }, { data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }] as any,
    'me_load_batch'
  );

  const rawMember =
    memberRes?.data ||
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
    (memberAchievementsRes.data || []).map((ma: any) => [ma.achievement_id, ma.unlocked_at])
  );

  const achievements = (allAchievementsRes.data || []).map((ach: any) => ({
    ...ach,
    unlocked: unlockedMap.has(ach.id),
    unlocked_at: unlockedMap.get(ach.id) || null
  }));

  const inventory = (inventoryRes.data || []).map((inv: any) => ({
    acquired_at: inv.acquired_at,
    ...inv.shop_items
  }));

  return {
    member,
    library: libraryRes.data || [],
    history: historyRes.data || [],
    notifications: notificationsRes.data || [],
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

    const { error } = await locals.db
      .from('members')
      .update({
        display_name: displayName,
        bio: bio
      })
      .eq('id', locals.user.id);

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

    const { error } = await locals.db
      .from('members')
      .update({
        blur_nsfw: blurNsfw,
        privacy_show_achievements: privacyShowAchievements,
        privacy_show_cosmetics: privacyShowCosmetics,
        privacy_show_favorites: privacyShowFavorites,
        privacy_show_reading_history: privacyShowReadingHistory,
        privacy_show_scans: privacyShowScans,
        privacy_scan_mode: privacyScanMode
      })
      .eq('id', locals.user.id);

    if (error) return fail(400, { message: error.message });
    return { success: true, action: 'settings' };
  },

  setFeaturedAchievement: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const achievementId = (formData.get('achievement_id') as string)?.trim() || null;

    const { error } = await locals.db.rpc('set_featured_achievement', {
      p_achievement_id: achievementId || ''
    });

    if (error) return fail(400, { message: error.message });
    return { success: true, action: 'featured_achievement' };
  },

  markAllNotificationsRead: async ({ locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const { error } = await locals.db
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', locals.user.id)
      .is('read_at', null);

    if (error) return fail(400, { message: error.message });
    return { success: true, action: 'notifications' };
  },

  markNotificationRead: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const id = String(formData.get('id') || '');
    if (!id) return fail(400, { message: 'ID ausente' });

    const { error } = await locals.db
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', locals.user.id);

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

    const { error } = await locals.db
      .from('members')
      .update({ avatar_crop: crop })
      .eq('id', locals.user.id);

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

    const { error } = await locals.db
      .from('members')
      .update({ banner_crop: crop })
      .eq('id', locals.user.id);

    if (error) return fail(400, { message: error.message });
    return { success: true, action: 'banner_crop', crop };
  }
};
