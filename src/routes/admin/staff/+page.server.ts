import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { db, schema, safeQuery, safeQuerySingle } from '$lib/server/db';
import { inArray, eq } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user || !['ADMIN', 'STAFF_SITE', 'EDITOR'].includes(locals.role || '')) {
    throw redirect(303, '/entrar?redirect=/admin/staff');
  }

  let staffList: any[] = [];

  try {
    const rawRoles = await safeQuery(db.select().from(schema.accessRoles).where(inArray(schema.accessRoles.role, ['ADMIN', 'STAFF_SITE', 'EDITOR'])));

    if (!rawRoles.error && (rawRoles.data || []).length > 0) {
      const userIds = (rawRoles.data || []).map(r => r.userId);
      const memberRows = await safeQuery(db.select({
          id: schema.members.id,
          username: schema.members.username,
          displayName: schema.members.displayName,
          avatarId: schema.members.avatarId,
          xp: schema.members.xp,
          createdAt: schema.members.createdAt
        }).from(schema.members).where(inArray(schema.members.id, userIds)));

      const memberMap = new Map((memberRows.data || []).map((m: any) => [m.id, m]));

      staffList = (rawRoles.data || []).map((sr: any) => {
        const m = memberMap.get(sr.userId);
        return {
          userId: sr.userId,
          role: sr.role as 'ADMIN' | 'STAFF_SITE' | 'EDITOR',
          suspended: Boolean(sr.suspended),
          updatedAt: m?.createdAt || null,
          username: m?.username || 'desconhecido',
          displayName: m?.displayName || m?.username || 'Membro',
          avatarId: m?.avatarId || null,
          xp: m?.xp || 0,
          createdAt: m?.createdAt || null
        };
      });
    }
  } catch (err: any) {
    console.error('Falha inesperada ao carregar equipe:', err);
  }

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
    currentUserId: locals.user!.id
  };
};

export const actions: Actions = {
  updateRole: async ({ request, locals }) => {
    if (!locals.user || locals.role !== 'ADMIN') {
      return fail(403, { error: 'Apenas administradores podem gerenciar cargos da equipe.' });
    }

    const formData = await request.formData();
    const userId = (formData.get('userId') as string || '').trim();
    const role = (formData.get('role') as string || '').trim();

    if (!userId || !['ADMIN', 'STAFF_SITE', 'EDITOR', 'USER'].includes(role)) {
      return fail(400, { error: 'Parmetros invlidos para alterao de cargo.' });
    }

    return fail(400, { error: 'Not implemented in Drizzle yet.' });
  },

  promoteUser: async ({ request, locals }) => {
    if (!locals.user || locals.role !== 'ADMIN') {
      return fail(403, { error: 'Apenas administradores podem promover novos membros.' });
    }

    const formData = await request.formData();
    const userId = (formData.get('userId') as string || '').trim();
    const role = (formData.get('role') as string || '').trim();

    if (!userId || !['ADMIN', 'STAFF_SITE', 'EDITOR'].includes(role)) {
      return fail(400, { error: 'Selecione um usurio e um cargo vlido (Staff ou Administrador).' });
    }

    return fail(400, { error: 'Not implemented in Drizzle yet.' });
  }
};
