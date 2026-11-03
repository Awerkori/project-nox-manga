import { fail, redirect } from '@sveltejs/kit';
import { invalidateUserSession } from '$lib/server/session-cache';
import { adminStaffCache, adminStaffFlights, invalidateAdminStaffCache, withSingleFlightCache } from '$lib/server/admin-cache';
import { executeYugabyteSql } from '$lib/server/yugabyte';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals, platform }: any) => {
  if (!locals.user || !['ADMIN', 'STAFF_SITE', 'EDITOR'].includes(locals.role || '')) {
    throw redirect(303, '/entrar?redirect=/admin/staff');
  }

  const staffList = await withSingleFlightCache(adminStaffCache, adminStaffFlights, 'staff_list', 30_000, async () => {
    try {
      const res = await executeYugabyteSql(
        `SELECT ar.user_id, ar.role, ar.suspended,
                m.username, m.display_name, m.avatar_id, m.xp, m.created_at
         FROM public.access_roles ar
         LEFT JOIN public.members m ON m.id = ar.user_id
         WHERE ar.role IN ('ADMIN', 'STAFF_SITE', 'EDITOR')
         ORDER BY ar.role ASC;`,
        [],
        platform?.env
      );

      return (res.rows || []).map((sr: any) => ({
        userId: sr.user_id,
        role: sr.role as 'ADMIN' | 'STAFF_SITE' | 'EDITOR',
        suspended: Boolean(sr.suspended),
        updatedAt: sr.created_at || null,
        username: sr.username || 'desconhecido',
        displayName: sr.display_name || sr.username || 'Membro',
        avatarId: sr.avatar_id || null,
        xp: sr.xp || 0,
        createdAt: sr.created_at || null
      }));
    } catch (err: any) {
      console.error('Falha inesperada ao carregar equipe:', err);
      return [];
    }
  });

  const counts = {
    total: staffList.length,
    admins: staffList.filter((s) => s.role === 'ADMIN').length,
    editors: staffList.filter((s) => s.role === 'STAFF_SITE' || s.role === 'EDITOR').length,
    suspended: staffList.filter((s) => s.suspended).length
  };

  return {
    staff: staffList,
    counts,
    isAdmin: locals.role === 'ADMIN',
    currentUserId: locals.user.id
  };
};

export const actions: Actions = {
  updateRole: async ({ request, locals, platform }: any) => {
    if (!locals.user || locals.role !== 'ADMIN') {
      return fail(403, { error: 'Apenas administradores podem gerenciar cargos da equipe.' });
    }

    const formData = await request.formData();
    const userId = (formData.get('userId') as string || '').trim();
    const role = (formData.get('role') as string || '').trim();

    if (!userId || !['ADMIN', 'STAFF_SITE', 'EDITOR', 'USER'].includes(role)) {
      return fail(400, { error: 'Parâmetros inválidos para alteração de cargo.' });
    }

    try {
      if (role === 'USER') {
        await executeYugabyteSql(
          `DELETE FROM public.access_roles WHERE user_id = $1;`,
          [userId],
          platform?.env
        );
      } else {
        await executeYugabyteSql(
          `INSERT INTO public.access_roles (user_id, role, suspended)
           VALUES ($1, $2, false)
           ON CONFLICT (user_id, role) DO UPDATE SET suspended = false;`,
          [userId, role],
          platform?.env
        );
      }
    } catch (err: any) {
      return fail(400, { error: err?.message || 'Falha ao atualizar cargo do usuário.' });
    }

    invalidateUserSession(userId);
    invalidateAdminStaffCache();

    return {
      success: true,
      action: role === 'USER' ? 'removed' : 'updated',
      userId,
      role
    };
  },

  promoteUser: async ({ request, locals, platform }: any) => {
    if (!locals.user || locals.role !== 'ADMIN') {
      return fail(403, { error: 'Apenas administradores podem promover novos membros.' });
    }

    const formData = await request.formData();
    const userId = (formData.get('userId') as string || '').trim();
    const role = (formData.get('role') as string || '').trim();

    if (!userId || !['ADMIN', 'STAFF_SITE', 'EDITOR'].includes(role)) {
      return fail(400, { error: 'Selecione um usuário e um cargo válido (Staff ou Administrador).' });
    }

    try {
      await executeYugabyteSql(
        `INSERT INTO public.access_roles (user_id, role, suspended)
         VALUES ($1, $2, false)
         ON CONFLICT (user_id, role) DO UPDATE SET suspended = false;`,
        [userId, role],
        platform?.env
      );
    } catch (err: any) {
      return fail(400, { error: err?.message || 'Falha ao promover usuário.' });
    }

    invalidateUserSession(userId);
    invalidateAdminStaffCache();

    return { success: true, action: 'promoted', userId, role };
  }
};
