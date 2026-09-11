import { error, fail } from '@sveltejs/kit';
import { privileged } from '$lib/server/db';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  const isEditor = ['ADMIN', 'STAFF_SITE', 'EDITOR'].includes(locals.role || '');
  if (!isEditor) error(403, 'Acesso restrito à equipe editorial');

  const db = locals.db || privileged();

  const [scansRes, workCountsRes, chapterCountsRes, memberCountsRes, partnerReqsRes, projectReqsRes] =
    await Promise.all([
      db
        .from('scans')
        .select('*')
        .order('is_official', { ascending: false })
        .order('name', { ascending: true }),
      db.from('work_scans').select('scan_id'),
      db.from('chapter_scans').select('scan_id'),
      db.from('scan_members').select('scan_id'),
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
        .order('created_at', { ascending: false })
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

  const scans = (scansRes.data || []).map((s: any) => ({
    ...s,
    works_count: workCountMap[s.id] || 0,
    chapters_count: chapterCountMap[s.id] || 0,
    members_count: memberCountMap[s.id] || 0
  }));

  const partnerRequests = partnerReqsRes.data || [];
  const projectRequests = projectReqsRes.data || [];

  return {
    scans,
    partnerRequests,
    projectRequests
  };
};

export const actions: Actions = {
  reviewPartner: async ({ request, locals }) => {
    const isEditor = ['ADMIN', 'STAFF_SITE', 'EDITOR'].includes(locals.role || '');
    if (!isEditor) return fail(403, { message: 'Acesso negado' });

    const formData = await request.formData();
    const requestId = formData.get('request_id') as string;
    const actionType = formData.get('action') as string; // 'APPROVE' | 'REJECT'
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
    const isEditor = ['ADMIN', 'STAFF_SITE', 'EDITOR'].includes(locals.role || '');
    if (!isEditor) return fail(403, { message: 'Acesso negado' });

    const formData = await request.formData();
    const requestId = formData.get('request_id') as string;
    const actionType = formData.get('action') as string; // 'APPROVE' | 'REJECT'
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
