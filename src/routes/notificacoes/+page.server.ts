import { redirect, fail } from '@sveltejs/kit';
import { withTimeout } from '$lib/server/resilience';
import { invalidateUserSession } from '$lib/server/session-cache';
import { executeYugabyteSql } from '$lib/server/yugabyte';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals, url, platform }: any) => {
  if (!locals.user) {
    throw redirect(303, `/entrar?redirect=${encodeURIComponent(url.pathname)}`);
  }

  const userId = locals.user.id;
  let rawNotifications: any[] = [];
  let totalCount = 0;
  let unreadCount = 0;

  try {
    const [notifsSql, countsSql] = await Promise.all([
      executeYugabyteSql(
        `SELECT n.*, 
                m.id AS actor_id,
                m.username AS actor_username, 
                m.display_name AS actor_display_name, 
                m.avatar_id AS actor_avatar_id, 
                m.avatar_crop AS actor_avatar_crop, 
                m.avatar_frame_id AS actor_frame_id, 
                m.name_color AS actor_name_color
         FROM notifications n
         LEFT JOIN members m ON m.id = n.actor_user_id
         WHERE n.user_id = $1
         ORDER BY n.created_at DESC
         LIMIT 100;`,
        [userId],
        platform?.env
      ),
      executeYugabyteSql(
        `SELECT count(*)::int AS total, count(*) FILTER (WHERE read_at IS NULL)::int AS unread
         FROM notifications
         WHERE user_id = $1;`,
        [userId],
        platform?.env
      )
    ]);

    rawNotifications = notifsSql.rows || [];
    totalCount = Number(countsSql.rows[0]?.total) || rawNotifications.length;
    unreadCount = Number(countsSql.rows[0]?.unread) || 0;
  } catch (ybErr) {
    console.warn('[NOTIFICACOES_SQL_ERROR]', ybErr);
    rawNotifications = [];
    totalCount = 0;
    unreadCount = 0;
  }

  const readCount = Math.max(0, totalCount - unreadCount);

  const notifications = rawNotifications.map((n: any) => {
    const actor = n.actor_username
      ? {
          id: n.actor_user_id || n.actor_id,
          username: n.actor_username,
          displayName: n.actor_display_name || n.actor_username,
          avatarId: n.actor_avatar_id,
          avatarCrop: n.actor_avatar_crop,
          frameId: n.actor_frame_id,
          nameColor: n.actor_name_color
        }
      : null;
    const resolvedTitle = n.title?.trim() || (n.body ? (n.body.length > 80 ? n.body.slice(0, 77) + '…' : n.body) : 'Notificação');
    const resolvedBody = n.body?.trim() || '';

    return {
      id: n.id,
      userId: n.user_id,
      actorUserId: n.actor_user_id,
      actor,
      type: n.type || n.kind || 'GENERIC',
      kind: n.kind || n.type || 'generic',
      title: resolvedTitle,
      body: resolvedBody,
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
  markRead: async ({ request, locals, platform }: any) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const id = String(formData.get('id') || '').trim();
    if (!id) return fail(400, { message: 'ID da notificação obrigatório' });

    let updatedCount = 0;
    try {
      const res = await executeYugabyteSql(
        `UPDATE notifications SET read_at = now() WHERE id = $1 AND user_id = $2;`,
        [id, locals.user.id],
        platform?.env
      );
      updatedCount = res.rowCount;
    } catch (err: any) {
      return fail(500, { message: err?.message || 'Falha ao marcar notificação como lida' });
    }

    if (updatedCount === 0) {
      return fail(404, { message: 'Notificação não encontrada' });
    }

    invalidateUserSession(locals.user.id);
    return { success: true, markedReadId: id };
  },

  markAllRead: async ({ locals, platform }: any) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });

    try {
      await executeYugabyteSql(
        `UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL;`,
        [locals.user.id],
        platform?.env
      );
    } catch (err: any) {
      return fail(500, { message: err?.message || 'Falha ao marcar todas as notificações' });
    }

    invalidateUserSession(locals.user.id);
    return { success: true };
  },

  delete: async ({ request, locals, platform }: any) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const id = String(formData.get('id') || '').trim();
    if (!id) return fail(400, { message: 'ID da notificação obrigatório' });

    let deletedCount = 0;
    try {
      const res = await executeYugabyteSql(
        `DELETE FROM notifications WHERE id = $1 AND user_id = $2;`,
        [id, locals.user.id],
        platform?.env
      );
      deletedCount = res.rowCount;
    } catch (err: any) {
      return fail(500, { message: err?.message || 'Falha ao excluir notificação' });
    }

    if (deletedCount === 0) {
      return fail(404, { message: 'Notificação não encontrada' });
    }

    invalidateUserSession(locals.user.id);
    return { success: true, deletedId: id };
  }
};
