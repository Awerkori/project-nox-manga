import { error, fail } from '@sveltejs/kit';
import { privileged } from '$lib/server/db';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  // STRICT ACCESS: Only global ADMIN can access Global Scan Management
  if (locals.role !== 'ADMIN') {
    throw error(403, 'Acesso restrito exclusivamente a Administradores Globais do Project Nox.');
  }

  const db = locals.db || privileged();

  const [
    scansRes,
    workCountsRes,
    chapterCountsRes,
    memberCountsRes,
    openingsCountsRes,
    ownersRes,
    partnerReqsRes,
    projectReqsRes,
    auditLogsRes,
    usersRes
  ] = await Promise.all([
    db
      .from('scans')
      .select('*')
      .order('is_official', { ascending: false })
      .order('name', { ascending: true }),
    db.from('work_scans').select('scan_id'),
    db.from('chapter_scans').select('scan_id'),
    db.from('scan_members').select('scan_id'),
    db.from('scan_recruitment_openings').select('scan_id').eq('status', 'OPEN'),
    db
      .from('scan_members')
      .select('scan_id, role, members!inner(id, username, display_name, avatar_id)')
      .eq('role', 'OWNER'),
    db
      .from('scan_partner_requests')
      .select(`
        *,
        members!user_id(id, username, display_name, avatar_id)
      `)
      .order('created_at', { ascending: false }),
    db
      .from('scan_project_requests')
      .select(`
        *,
        scans!inner(id, name, slug, logo_id),
        works!inner(id, title, slug, cover_id),
        members!user_id(id, username, display_name)
      `)
      .order('created_at', { ascending: false }),
    db
      .from('scan_global_audit_log')
      .select(`
        *,
        admin:members!admin_id(id, username, display_name, avatar_id)
      `)
      .order('created_at', { ascending: false })
      .limit(50),
    db
      .from('members')
      .select('id, username, display_name, avatar_id')
      .order('username')
      .limit(100)
  ]);

  if (scansRes.error) throw error(500, scansRes.error.message);

  const workCountMap: Record<string, number> = {};
  for (const row of (workCountsRes.data || []) as any[]) {
    workCountMap[row.scan_id] = (workCountMap[row.scan_id] || 0) + 1;
  }

  const chapterCountMap: Record<string, number> = {};
  for (const row of (chapterCountsRes.data || []) as any[]) {
    chapterCountMap[row.scan_id] = (chapterCountMap[row.scan_id] || 0) + 1;
  }

  const memberCountMap: Record<string, number> = {};
  for (const row of (memberCountsRes.data || []) as any[]) {
    memberCountMap[row.scan_id] = (memberCountMap[row.scan_id] || 0) + 1;
  }

  const openingsCountMap: Record<string, number> = {};
  for (const row of (openingsCountsRes.data || []) as any[]) {
    openingsCountMap[row.scan_id] = (openingsCountMap[row.scan_id] || 0) + 1;
  }

  const ownerMap: Record<string, any> = {};
  for (const row of (ownersRes.data || []) as any[]) {
    if (!ownerMap[row.scan_id]) {
      ownerMap[row.scan_id] = row.members;
    }
  }

  const scans = (scansRes.data || []).map((s: any) => ({
    ...s,
    works_count: workCountMap[s.id] || 0,
    chapters_count: chapterCountMap[s.id] || 0,
    members_count: memberCountMap[s.id] || 0,
    openings_count: openingsCountMap[s.id] || 0,
    owner: ownerMap[s.id] || null
  }));

  return {
    scans,
    partnerRequests: partnerReqsRes.data || [],
    projectRequests: projectReqsRes.data || [],
    auditLogs: auditLogsRes.data || [],
    users: usersRes.data || []
  };
};

export const actions: Actions = {
  setStatus: async ({ request, locals }) => {
    if (locals.role !== 'ADMIN') return fail(403, { message: 'Acesso negado. Apenas ADMIN global.' });

    const formData = await request.formData();
    const scanId = formData.get('scan_id') as string;
    const status = formData.get('status') as string;
    const reason = (formData.get('reason') as string)?.trim() || 'Alteração pelo painel administrativo';

    if (!scanId || !['ACTIVE', 'SUSPENDED', 'ARCHIVED', 'CLOSED'].includes(status)) {
      return fail(400, { message: 'Status ou scan inválidos.' });
    }

    const { error: rpcErr } = await locals.db.rpc('global_admin_set_scan_status', {
      p_scan_id: scanId,
      p_status: status,
      p_reason: reason
    });

    if (rpcErr) return fail(400, { message: rpcErr.message });
    return { success: true, statusChanged: status };
  },

  recoverOwner: async ({ request, locals }) => {
    if (locals.role !== 'ADMIN') return fail(403, { message: 'Acesso negado. Apenas ADMIN global.' });

    const formData = await request.formData();
    const scanId = formData.get('scan_id') as string;
    const newOwnerId = formData.get('new_owner_id') as string;
    const reason = (formData.get('reason') as string)?.trim() || 'Recuperação administrativa de ownership';

    if (!scanId || !newOwnerId) {
      return fail(400, { message: 'Scan e novo dono são obrigatórios.' });
    }

    const { error: rpcErr } = await locals.db.rpc('global_admin_recover_scan_ownership', {
      p_scan_id: scanId,
      p_new_owner_id: newOwnerId,
      p_reason: reason
    });

    if (rpcErr) return fail(400, { message: rpcErr.message });
    return { success: true, ownerRecovered: true };
  },

  hardDelete: async ({ request, locals }) => {
    if (locals.role !== 'ADMIN') return fail(403, { message: 'Acesso negado. Apenas ADMIN global.' });

    const formData = await request.formData();
    const scanId = formData.get('scan_id') as string;
    const reason = (formData.get('reason') as string)?.trim() || 'Exclusão definitiva autorizada por Admin Global';
    const confirmation = (formData.get('confirmation') as string)?.trim() || '';

    if (!scanId) {
      return fail(400, { message: 'Scan é obrigatória.' });
    }

    const { error: rpcErr } = await locals.db.rpc('global_admin_hard_delete_scan', {
      p_scan_id: scanId,
      p_reason: reason,
      p_confirmation: confirmation
    });

    if (rpcErr) return fail(400, { message: rpcErr.message });
    return { success: true, hardDeleted: true };
  },

  reviewPartner: async ({ request, locals }) => {
    if (locals.role !== 'ADMIN') return fail(403, { message: 'Acesso negado. Apenas ADMIN global.' });

    const formData = await request.formData();
    const requestId = formData.get('request_id') as string;
    const actionType = formData.get('action') as string;
    const reason = (formData.get('reason') as string)?.trim() || null;

    if (!requestId || !['APPROVE', 'REJECT'].includes(actionType)) {
      return fail(400, { message: 'Dados de avaliação inválidos.' });
    }

    const { data, error: rpcErr } = await locals.db.rpc('review_scan_partner_request', {
      p_request_id: requestId,
      p_action: actionType,
      p_reason: reason || undefined
    });

    if (rpcErr) return fail(400, { message: rpcErr.message });
    return { success: true, reviewedPartner: data };
  },

  reviewProject: async ({ request, locals }) => {
    if (locals.role !== 'ADMIN') return fail(403, { message: 'Acesso negado. Apenas ADMIN global.' });

    const formData = await request.formData();
    const requestId = formData.get('request_id') as string;
    const actionType = formData.get('action') as string;
    const reason = (formData.get('reason') as string)?.trim() || null;

    if (!requestId || !['APPROVE', 'REJECT'].includes(actionType)) {
      return fail(400, { message: 'Dados de avaliação inválidos.' });
    }

    const { data, error: rpcErr } = await locals.db.rpc('review_scan_project_request', {
      p_request_id: requestId,
      p_action: actionType,
      p_reason: reason || undefined
    });

    if (rpcErr) return fail(400, { message: rpcErr.message });
    return { success: true, reviewedProject: data };
  }
};
