import { redirect, fail } from '@sveltejs/kit';
import { withTimeout } from '$lib/server/resilience';
import { invalidateUserSession } from '$lib/server/session-cache';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
  if (!locals.user) {
    throw redirect(303, `/entrar?redirect=${encodeURIComponent(url.pathname)}`);
  }

  const userId = locals.user.id;

  // Run notifications and counts in parallel with timeout resilience
  const [notifsRes, totalCountRes, unreadCountRes] = await withTimeout(
    Promise.all([
      locals.db
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(100),
      locals.db
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId),
      locals.db
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .is('read_at', null)
    ]),
    3500,
    [{ data: [] }, { count: 0 }, { count: 0 }] as any,
    'notificacoes_load'
  );

  const rawNotifications = notifsRes?.data || [];
  const totalCount = totalCountRes?.count ?? rawNotifications.length;
  const unreadCount = unreadCountRes?.count ?? rawNotifications.filter((n: any) => !n.read_at).length;
  const readCount = Math.max(0, totalCount - unreadCount);

  // Fetch actor profiles for all notifications that have actor_user_id
  const actorIds = Array.from(
    new Set(rawNotifications.map((n: any) => n.actor_user_id).filter(Boolean))
  ) as string[];

  const actorsMap = new Map<string, any>();
  if (actorIds.length > 0) {
    try {
      const { data: actors } = await locals.db
        .from('members')
        .select('id, username, display_name, avatar_id, avatar_crop, avatar_frame_id, name_color')
        .in('id', actorIds);

      if (Array.isArray(actors)) {
        for (const actor of actors) {
          actorsMap.set(actor.id, actor);
        }
      }
    } catch (err) {
      console.warn('[NOTIFICACOES] Falha ao carregar atores:', err);
    }
  }

  const notifications = rawNotifications.map((n: any) => {
    const actor = n.actor_user_id ? actorsMap.get(n.actor_user_id) || null : null;
    return {
      id: n.id,
      userId: n.user_id,
      actorUserId: n.actor_user_id,
      actor: actor
        ? {
            id: actor.id,
            username: actor.username,
            displayName: actor.display_name || actor.username,
            avatarId: actor.avatar_id,
            avatarCrop: actor.avatar_crop,
            frameId: actor.avatar_frame_id,
            nameColor: actor.name_color
          }
        : null,
      type: n.type || n.kind || 'GENERIC',
      kind: n.kind || n.type || 'generic',
      title: n.title || 'Notificação',
      body: n.body || '',
      href: n.href || '#',
      readAt: n.read_at,
      isRead: Boolean(n.read_at),
      createdAt: n.created_at,
      priority: n.priority || 'NORMAL',
      context: n.context || null,
      entityType: n.entity_type || null,
      entityId: n.entity_id || null,
      scanId: n.scan_id || null
    };
  });

  return {
    notifications,
    totalCount,
    unreadCount,
    readCount
  };
};

export const actions: Actions = {
  markRead: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const id = String(formData.get('id') || '').trim();
    if (!id) return fail(400, { message: 'ID da notificação obrigatório' });

    const { error } = await locals.db
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', locals.user.id);

    if (error) return fail(400, { message: error.message });
    invalidateUserSession(locals.user.id);
    return { success: true, markedReadId: id };
  },

  markAllRead: async ({ locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });

    const { error } = await locals.db
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', locals.user.id)
      .is('read_at', null);

    if (error) return fail(400, { message: error.message });
    invalidateUserSession(locals.user.id);
    return { success: true };
  },

  delete: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const id = String(formData.get('id') || '').trim();
    if (!id) return fail(400, { message: 'ID da notificação obrigatório' });

    const { error } = await locals.db
      .from('notifications')
      .delete()
      .eq('id', id)
      .eq('user_id', locals.user.id);

    if (error) return fail(400, { message: error.message });
    invalidateUserSession(locals.user.id);
    return { success: true, deletedId: id };
  }
};
