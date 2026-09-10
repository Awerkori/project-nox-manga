import { redirect, fail } from '@sveltejs/kit';
import { WORK_FIELDS } from '$lib/server/db';
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
  ] = await Promise.all([
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
        created_at
      `)
      .eq('id', locals.user.id)
      .single(),
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
  ]);

  if (!memberRes.data) {
    redirect(303, '/entrar');
  }

  const member = {
    ...memberRes.data,
    frame_id: memberRes.data.avatar_frame_id
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

    const { error } = await locals.db
      .from('members')
      .update({ blur_nsfw: blurNsfw })
      .eq('id', locals.user.id);

    if (error) return fail(400, { message: error.message });
    return { success: true, action: 'settings' };
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
  }
};
