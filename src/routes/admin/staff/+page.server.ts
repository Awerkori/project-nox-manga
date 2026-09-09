import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user || !['ADMIN', 'EDITOR'].includes(locals.role || '')) {
    throw redirect(303, '/entrar?redirect=/admin/staff');
  }

  let staffList: any[] = [];

  try {
    // 1. First attempt: relational select on access_roles with members
    const { data: staffRoles, error: joinErr } = await locals.db
      .from('access_roles')
      .select(`
        user_id,
        role,
        suspended,
        members (
          id,
          username,
          display_name,
          avatar_id,
          xp,
          created_at
        )
      `)
      .in('role', ['ADMIN', 'EDITOR'])
      .order('role', { ascending: true });

    if (!joinErr && staffRoles && staffRoles.length > 0) {
      staffList = staffRoles.map((sr: any) => {
        const m = Array.isArray(sr.members) ? sr.members[0] : (sr.members || sr.member);
        return {
          userId: sr.user_id,
          role: sr.role as 'ADMIN' | 'EDITOR',
          suspended: Boolean(sr.suspended),
          updatedAt: m?.created_at || null,
          username: m?.username || 'desconhecido',
          displayName: m?.display_name || m?.username || 'Membro',
          avatarId: m?.avatar_id || null,
          xp: m?.xp || 0,
          createdAt: m?.created_at || null
        };
      });
    } else {
      // 2. Fallback attempt: query access_roles and members separately to avoid join ambiguity
      const { data: rawRoles } = await locals.db
        .from('access_roles')
        .select('user_id, role, suspended')
        .in('role', ['ADMIN', 'EDITOR']);

      if (rawRoles && rawRoles.length > 0) {
        const userIds = rawRoles.map((r: any) => r.user_id);
        const { data: memberRows } = await locals.db
          .from('members')
          .select('id, username, display_name, avatar_id, xp, created_at')
          .in('id', userIds);

        const memberMap = new Map((memberRows || []).map((m: any) => [m.id, m]));

        staffList = rawRoles.map((sr: any) => {
          const m = memberMap.get(sr.user_id);
          return {
            userId: sr.user_id,
            role: sr.role as 'ADMIN' | 'EDITOR',
            suspended: Boolean(sr.suspended),
            updatedAt: m?.created_at || null,
            username: m?.username || 'desconhecido',
            displayName: m?.display_name || m?.username || 'Membro',
            avatarId: m?.avatar_id || null,
            xp: m?.xp || 0,
            createdAt: m?.created_at || null
          };
        });
      }
    }
  } catch (err: any) {
    console.error('Falha inesperada ao carregar equipe:', err);
  }

  const counts = {
    total: staffList.length,
    admins: staffList.filter((s) => s.role === 'ADMIN').length,
    editors: staffList.filter((s) => s.role === 'EDITOR').length,
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
  updateRole: async ({ request, locals }) => {
    if (!locals.user || locals.role !== 'ADMIN') {
      return fail(403, { error: 'Apenas administradores podem gerenciar cargos da equipe.' });
    }

    const formData = await request.formData();
    const userId = (formData.get('userId') as string || '').trim();
    const role = (formData.get('role') as string || '').trim();

    if (!userId || !['ADMIN', 'EDITOR', 'USER'].includes(role)) {
      return fail(400, { error: 'Parâmetros inválidos para alteração de cargo.' });
    }

    const { error } = await locals.db.rpc('owner_action', {
      p_action: 'role',
      p_data: { id: userId, role }
    });

    if (error) {
      return fail(400, { error: error.message || 'Falha ao atualizar cargo do usuário.' });
    }

    return {
      success: true,
      action: role === 'USER' ? 'removed' : 'updated',
      userId,
      role
    };
  },

  promoteUser: async ({ request, locals }) => {
    if (!locals.user || locals.role !== 'ADMIN') {
      return fail(403, { error: 'Apenas administradores podem promover novos membros.' });
    }

    const formData = await request.formData();
    const userId = (formData.get('userId') as string || '').trim();
    const role = (formData.get('role') as string || '').trim();

    if (!userId || !['ADMIN', 'EDITOR'].includes(role)) {
      return fail(400, { error: 'Selecione um usuário e um cargo válido (Editor ou Administrador).' });
    }

    const { error } = await locals.db.rpc('owner_action', {
      p_action: 'role',
      p_data: { id: userId, role }
    });

    if (error) {
      return fail(400, { error: error.message || 'Falha ao promover usuário.' });
    }

    return { success: true, action: 'promoted', userId, role };
  }
};
