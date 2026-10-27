import { error, fail } from '@sveltejs/kit';
import { privileged } from '$lib/server/db';
import { executeYugabyteSql, withYugabyteTransaction } from '$lib/server/yugabyte';
import { parsePartnerRequestMeta } from '$lib/scans';
import { createNotification } from '$lib/server/notifications';
import { invalidateScansDirectoryCache } from '$lib/server/scans-directory-cache';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals, platform }) => {
  // STRICT ACCESS: Only global ADMIN can access Global Scan Management
  if (locals.role !== 'ADMIN') {
    throw error(403, 'Acesso restrito exclusivamente a Administradores Globais do Project Nox.');
  }

  const db = locals.db || privileged();

  // The Scan entity and its operational impact counts must come from the
  // same authoritative YSQL plane used by hardDelete.  Keeping creation on
  // the old RPC while deletion reads YSQL creates a false "not found" state.
  const scansYsql = await executeYugabyteSql<any>(
    `SELECT scan.*,
       (SELECT count(*)::int FROM public.work_scans ws WHERE ws.scan_id = scan.id) AS works_count,
       (SELECT count(*)::int FROM public.chapter_scans cs WHERE cs.scan_id = scan.id) AS chapters_count,
       (SELECT count(*)::int FROM public.scan_members sm WHERE sm.scan_id = scan.id) AS members_count,
       (SELECT count(*)::int FROM public.scan_recruitment_openings so WHERE so.scan_id = scan.id AND so.status = 'OPEN') AS openings_count,
       (SELECT count(*)::int FROM public.scan_production_chapters spc WHERE spc.scan_id = scan.id) AS pipeline_count,
       (SELECT count(*)::int FROM public.scan_applications sa WHERE sa.scan_id = scan.id) AS applications_count,
       (SELECT jsonb_build_object('id', member.id, 'username', member.username,
                                  'display_name', member.display_name, 'avatar_id', member.avatar_id,
                                  'avatar_crop', member.avatar_crop)
          FROM public.scan_members owner_members
          JOIN public.members member ON member.id = owner_members.user_id
         WHERE owner_members.scan_id = scan.id AND owner_members.role = 'OWNER'
         ORDER BY owner_members.created_at ASC LIMIT 1) AS owner
      FROM public.scans scan
      ORDER BY scan.is_official DESC, scan.name ASC`,
    [],
    platform?.env
  );

  const [
    partnerReqsRes,
    projectReqsRes,
    auditLogsRes,
    usersRes
  ] = await Promise.all([
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

  const scans = (scansYsql.rows || []).map((s: any) => ({
    ...s,
    works_count: Number(s.works_count || 0),
    chapters_count: Number(s.chapters_count || 0),
    members_count: Number(s.members_count || 0),
    openings_count: Number(s.openings_count || 0),
    pipeline_count: Number(s.pipeline_count || 0),
    applications_count: Number(s.applications_count || 0),
    owner: s.owner || null
  }));

  return {
    scans,
    partnerRequests: (partnerReqsRes.data || []).map((r: any) => ({
      ...r,
      meta: parsePartnerRequestMeta(r.sample_links)
    })),
    projectRequests: projectReqsRes.data || [],
    auditLogs: auditLogsRes.data || [],
    users: usersRes.data || []
  };
};

export const actions: Actions = {
  createScan: async ({ request, locals, platform }) => {
    if (locals.role !== 'ADMIN') return fail(403, { message: 'Acesso negado. Apenas ADMIN global.' });
    if (!locals.user?.id) return fail(401, { message: 'Sessão administrativa inválida.' });

    const formData = await request.formData();
    const name = (formData.get('name') as string)?.trim() || '';
    const slug = (formData.get('slug') as string)?.trim().toLowerCase() || '';
    const description = (formData.get('description') as string)?.trim() || '';
    const website = (formData.get('website') as string)?.trim() || '';
    const discord = (formData.get('discord') as string)?.trim() || '';

    if (name.length < 2 || name.length > 100) {
      return fail(400, { message: 'O nome da Scan deve ter entre 2 e 100 caracteres.' });
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return fail(400, { message: 'Slug inválido. Use apenas letras minúsculas, números e hífens.' });
    }
    if (description.length > 2000 || website.length > 255 || discord.length > 255) {
      return fail(400, { message: 'Um dos campos excede o limite permitido.' });
    }

    const scanId = crypto.randomUUID();
    try {
      const created = await withYugabyteTransaction(platform?.env, async (client) => {
        const duplicate = await client.query<{ id: string }>(
          'SELECT id FROM public.scans WHERE slug = $1 FOR KEY SHARE',
          [slug]
        );
        if (duplicate.rows[0]) throw new Error('SCAN_SLUG_EXISTS');

        const scan = await client.query(
          `INSERT INTO public.scans
             (id, name, slug, description, website, discord, status, is_official)
           VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE', false)
           RETURNING id, name, slug`,
          [scanId, name, slug, description, website, discord]
        );

        await client.query(
          `INSERT INTO public.scan_members (scan_id, user_id, role)
           VALUES ($1, $2, 'OWNER')`,
          [scanId, locals.user.id]
        );

        const auditTable = await client.query<{ present: boolean }>(
          `SELECT to_regclass('public.scan_global_audit_log') IS NOT NULL AS present`
        );
        if (auditTable.rows[0]?.present) {
          await client.query(
            `INSERT INTO public.scan_global_audit_log
              (scan_id, scan_name, admin_id, action, reason)
             VALUES ($1, $2, $3, 'SCAN_CREATED', 'Criação administrativa')`,
            [scanId, name, locals.user.id]
          );
        }

        return scan.rows[0];
      });
      return { success: true, scanCreated: created };
    } catch (err: any) {
      const message = String(err?.message || 'Falha ao criar a Scan.');
      if (message.includes('SCAN_SLUG_EXISTS') || message.includes('duplicate key')) {
        return fail(409, { message: 'Esse slug já está em uso.' });
      }
      console.error('admin_scan_create_ysql_failed', { actorId: locals.user.id, message: message.slice(0, 240) });
      return fail(503, { message: 'Não foi possível criar a Scan com segurança agora.' });
    }
  },

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

  reviewPartner: async ({ request, locals, platform }) => {
    if (locals.role !== 'ADMIN') return fail(403, { message: 'Acesso negado. Apenas ADMIN global.' });

    const formData = await request.formData();
    const requestId = formData.get('request_id') as string;
    const actionType = formData.get('action') as string;
    const reason = (formData.get('reason') as string)?.trim() || null;

    if (!requestId || !['APPROVE', 'REJECT'].includes(actionType)) {
      return fail(400, { message: 'Dados de avaliação inválidos.' });
    }

    const db = locals.db || privileged();

    // 1. Fetch current request to know candidate details & meta
    const { data: partnerReq, error: reqErr } = await db
      .from('scan_partner_requests')
      .select('*')
      .eq('id', requestId)
      .maybeSingle();

    if (reqErr || !partnerReq) {
      return fail(404, { message: 'Solicitação de parceria não encontrada.' });
    }

    // 2. Call RPC to approve or reject
    const { data, error: rpcErr } = await locals.db.rpc('review_scan_partner_request', {
      p_request_id: requestId,
      p_action: actionType,
      p_reason: reason || undefined
    });

    if (rpcErr) return fail(400, { message: rpcErr.message });

    const meta = parsePartnerRequestMeta(partnerReq.sample_links);

    // Keep YSQL partner requests table in sync
    try {
      if (actionType === 'APPROVE') {
        await executeYugabyteSql(
          `UPDATE public.scan_partner_requests
           SET status = 'APPROVED', reviewed_by = $2, reviewed_at = now()
           WHERE id = $1`,
          [requestId, locals.user!.id],
          platform?.env
        );
      } else {
        await executeYugabyteSql(
          `UPDATE public.scan_partner_requests
           SET status = 'REJECTED', reviewed_by = $2, reviewed_at = now(), rejection_reason = $3
           WHERE id = $1`,
          [requestId, locals.user!.id, reason],
          platform?.env
        );
      }
    } catch (e: any) {
      console.warn('YSQL partner request sync error (non-fatal):', e?.message);
    }

    if (actionType === 'APPROVE') {
      const createdScanId = data?.scan_id;

      // 3. Attach candidate Logo & Banner if provided
      if (createdScanId && (meta.logo_id || meta.banner_id)) {
        try {
          await db
            .from('scans')
            .update({
              logo_id: meta.logo_id || null,
              banner_id: meta.banner_id || null
            })
            .eq('id', createdScanId);

          await executeYugabyteSql(
            `UPDATE public.scans
             SET logo_id = COALESCE($2::uuid, logo_id),
                 banner_id = COALESCE($3::uuid, banner_id),
                 updated_at = now()
             WHERE id = $1`,
            [createdScanId, meta.logo_id || null, meta.banner_id || null],
            platform?.env
          );
        } catch (e: any) {
          console.warn('Failed to attach candidate media to approved scan:', e?.message);
        }
      }

      invalidateScansDirectoryCache();

      // 4. Dispatch congratulatory in-app notification
      try {
        await createNotification({
          recipientUserId: partnerReq.user_id,
          type: 'SYSTEM_ANNOUNCEMENT',
          title: 'Parceria de Scan Aprovada! 🎉',
          body: `Parabéns! Sua solicitação para a scan "${partnerReq.scan_name}" foi aprovada pela administração do Project Nox. Seu painel de gestão (/scan) já está liberado!`,
          deepLink: '/scan',
          scanId: createdScanId
        }, platform);
      } catch (e: any) {
        console.warn('Failed to send approval notification:', e?.message);
      }
    } else {
      // Dispatch rejection notification with reason
      try {
        await createNotification({
          recipientUserId: partnerReq.user_id,
          type: 'SYSTEM_ANNOUNCEMENT',
          title: 'Solicitação de Parceria de Scan',
          body: `Sua solicitação para a scan "${partnerReq.scan_name}" foi recusada pela administração.${reason ? ` Motivo: ${reason}` : ''}`,
          deepLink: '/scans/cadastrar'
        }, platform);
      } catch (e: any) {
        console.warn('Failed to send rejection notification:', e?.message);
      }
    }

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
