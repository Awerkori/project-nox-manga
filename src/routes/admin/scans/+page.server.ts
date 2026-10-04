import { error, fail } from '@sveltejs/kit';
import { privileged } from '$lib/server/db';
import { withYugabyteTransaction } from '$lib/server/yugabyte';
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
    pipelineCountsRes,
    applicationCountsRes,
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
    db.from('scan_production_chapters').select('scan_id'),
    db.from('scan_applications').select('scan_id'),
    db
      .from('scan_members')
      .select('scan_id, role, members!inner(id, username, display_name, avatar_id, avatar_crop)')
      .eq('role', 'OWNER'),
    db
      .from('scan_partner_requests')
      .select(`
        *,
        members!user_id(id, username, display_name, avatar_id, avatar_crop)
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
        admin:members!admin_id(id, username, display_name, avatar_id, avatar_crop)
      `)
      .order('created_at', { ascending: false })
      .limit(50),
    db
      .from('members')
      .select('id, username, display_name, avatar_id, avatar_crop')
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

  const pipelineCountMap: Record<string, number> = {};
  for (const row of (pipelineCountsRes.data || []) as any[]) {
    pipelineCountMap[row.scan_id] = (pipelineCountMap[row.scan_id] || 0) + 1;
  }

  const applicationCountMap: Record<string, number> = {};
  for (const row of (applicationCountsRes.data || []) as any[]) {
    applicationCountMap[row.scan_id] = (applicationCountMap[row.scan_id] || 0) + 1;
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
    pipeline_count: pipelineCountMap[s.id] || 0,
    applications_count: applicationCountMap[s.id] || 0,
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

  hardDelete: async ({ request, locals, platform }) => {
    if (locals.role !== 'ADMIN') return fail(403, { message: 'Acesso negado. Apenas ADMIN global.' });

    const formData = await request.formData();
    const scanId = formData.get('scan_id') as string;
    const reason = (formData.get('reason') as string)?.trim() || 'Exclusão definitiva autorizada por Admin Global';
    const confirmation = (formData.get('confirmation') as string)?.trim() || '';

    if (!scanId) {
      return fail(400, { message: 'Scan é obrigatória.' });
    }

    if (!locals.user?.id) return fail(401, { message: 'Sessão administrativa inválida.' });

    try {
      const result = await withYugabyteTransaction(platform?.env, async (client) => {
        const scanResult = await client.query<{ name: string }>(
          'SELECT name FROM public.scans WHERE id = $1 FOR UPDATE',
          [scanId]
        );
        const scanName = scanResult.rows[0]?.name;
        if (!scanName) throw new Error('SCAN_NOT_FOUND');
        if (!confirmation || confirmation.trim() !== scanName.trim()) {
          throw new Error('SCAN_CONFIRMATION_INVALID');
        }

        // Remove only Scan attribution; public works and chapters remain.
        const attributionTables = await client.query<{ table_name: string }>(`
          SELECT table_name
          FROM (VALUES ('chapter_scans'), ('work_scans')) AS tables(table_name)
          WHERE to_regclass('public.' || table_name) IS NOT NULL
        `);
        for (const row of attributionTables.rows) {
          await client.query(`DELETE FROM public."${row.table_name}" WHERE scan_id = $1`, [scanId]);
        }

        const tableResult = await client.query<{ table_name: string }>(`
          SELECT columns.table_name
          FROM information_schema.columns columns
          JOIN information_schema.tables catalog_tables
            ON catalog_tables.table_schema = columns.table_schema
           AND catalog_tables.table_name = columns.table_name
          WHERE columns.table_schema = 'public'
            AND columns.column_name = 'scan_id'
            AND catalog_tables.table_type = 'BASE TABLE'
            AND columns.table_name NOT IN ('scans', 'work_scans', 'chapter_scans', 'scan_global_audit_log')
          ORDER BY CASE columns.table_name
            WHEN 'scan_message_reactions' THEN 1
            WHEN 'scan_message_mentions_ysql' THEN 2
            WHEN 'scan_pipeline_stage_seen' THEN 3
            WHEN 'scan_chapter_note_events' THEN 4
            WHEN 'scan_chapter_notes' THEN 5
            WHEN 'scan_pipeline_upload_attempts' THEN 6
            WHEN 'scan_production_files' THEN 7
            WHEN 'scan_chapter_stages' THEN 8
            WHEN 'scan_production_chapters' THEN 9
            WHEN 'scan_workflow_stages' THEN 10
            ELSE 50
          END, columns.table_name
        `);

        for (const row of tableResult.rows) {
          if (!/^[a-z0-9_]+$/i.test(row.table_name)) continue;
          await client.query(`DELETE FROM public."${row.table_name}" WHERE scan_id = $1`, [scanId]);
        }

        const auditTable = await client.query<{ present: boolean }>(
          `SELECT to_regclass('public.scan_global_audit_log') IS NOT NULL AS present`
        );
        if (auditTable.rows[0]?.present) {
          await client.query(
            `INSERT INTO public.scan_global_audit_log
              (scan_id, scan_name, admin_id, action, reason)
             VALUES ($1, $2, $3, 'SCAN_HARD_DELETED', $4)`,
            [scanId, scanName, locals.user!.id, reason]
          );
        }

        await client.query('DELETE FROM public.scans WHERE id = $1', [scanId]);
        return { deleted_scan_name: scanName, public_content_preserved: true };
      });
      return { success: true, hardDeleted: true, result };
    } catch (err: any) {
      const message = String(err?.message || 'Falha ao excluir a Scan.').slice(0, 240);
      const safeMessage =
        message.includes('GLOBAL_ADMIN_REQUIRED')
          ? 'Apenas ADMIN global pode excluir uma Scan.'
          : message.includes('SCAN_CONFIRMATION_INVALID')
            ? 'A confirmação não corresponde ao nome da Scan.'
            : message.includes('SCAN_NOT_FOUND')
              ? 'Scan não encontrada.'
              : 'Não foi possível concluir a exclusão da Scan. Nenhuma alteração foi aplicada.';
      return fail(400, { message: safeMessage });
    }
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
