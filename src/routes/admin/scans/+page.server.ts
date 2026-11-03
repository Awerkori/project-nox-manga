import { error, fail } from '@sveltejs/kit';
import { executeYugabyteSql, withYugabyteTransaction } from '$lib/server/yugabyte';
import { parsePartnerRequestMeta } from '$lib/scans';
import { createNotification } from '$lib/server/notifications';
import { invalidateScansDirectoryCache } from '$lib/server/scans-directory-cache';
import {
  adminScansCache,
  adminScansFlights,
  invalidateAdminScansCache,
  invalidateAdminTicketsCache,
  withSingleFlightCache
} from '$lib/server/admin-cache';
import { invalidateUserSession } from '$lib/server/session-cache';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals, platform }) => {
  // STRICT ACCESS: Only global ADMIN can access Global Scan Management
  if (locals.role !== 'ADMIN') {
    throw error(403, 'Acesso restrito exclusivamente a Administradores Globais do Project Nox.');
  }

  return withSingleFlightCache(
    adminScansCache,
    adminScansFlights,
    'admin:scans:all',
    20_000,
    async () => {
      const [
        scansYsql,
        partnerReqsRes,
        projectReqsRes,
        auditLogsRes,
        usersRes
      ] = await Promise.all([
        executeYugabyteSql<any>(
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
        ).catch(() => ({ rows: [] })),

        executeYugabyteSql(
          `SELECT spr.*, to_jsonb(m.*) AS members
           FROM public.scan_partner_requests spr
           LEFT JOIN public.members m ON m.id = spr.user_id
           ORDER BY spr.created_at DESC
           LIMIT 100;`,
          [],
          platform?.env
        ).catch(() => ({ rows: [] })),

        executeYugabyteSql(
          `SELECT spj.*,
                  to_jsonb(s.*) AS scans,
                  to_jsonb(w.*) AS works,
                  to_jsonb(m.*) AS members
           FROM public.scan_project_requests spj
           LEFT JOIN public.scans s ON s.id = spj.scan_id
           LEFT JOIN public.works w ON w.id = spj.work_id
           LEFT JOIN public.members m ON m.id = spj.user_id
           ORDER BY spj.created_at DESC
           LIMIT 100;`,
          [],
          platform?.env
        ).catch(() => ({ rows: [] })),

        executeYugabyteSql(
          `SELECT sga.*, to_jsonb(m.*) AS admin
           FROM public.scan_global_audit_log sga
           LEFT JOIN public.members m ON m.id = sga.admin_id
           ORDER BY sga.created_at DESC
           LIMIT 50;`,
          [],
          platform?.env
        ).catch(() => ({ rows: [] })),

        executeYugabyteSql(
          `SELECT id, username, display_name, avatar_id, avatar_crop
           FROM public.members
           ORDER BY username ASC
           LIMIT 100;`,
          [],
          platform?.env
        ).catch(() => ({ rows: [] }))
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
        partnerRequests: (partnerReqsRes.rows || []).map((r: any) => ({
          ...r,
          meta: parsePartnerRequestMeta(r.sample_links)
        })),
        projectRequests: projectReqsRes.rows || [],
        auditLogs: auditLogsRes.rows || [],
        users: usersRes.rows || []
      };
    }
  );
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
      invalidateAdminScansCache();
      invalidateScansDirectoryCache();
      invalidateAdminScansCache();
      invalidateAdminTicketsCache();
      if (partnerReq.user_id) {
        invalidateUserSession(partnerReq.user_id);
      }
      invalidateUserSession(locals.user.id);
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

  setStatus: async ({ request, locals, platform }: any) => {
    if (locals.role !== 'ADMIN') return fail(403, { message: 'Acesso negado. Apenas ADMIN global.' });

    const formData = await request.formData();
    const scanId = formData.get('scan_id') as string;
    const status = formData.get('status') as string;
    const reason = (formData.get('reason') as string)?.trim() || 'Alteração pelo painel administrativo';

    if (!scanId || !['ACTIVE', 'SUSPENDED', 'ARCHIVED', 'CLOSED'].includes(status)) {
      return fail(400, { message: 'Status ou scan inválidos.' });
    }

    try {
      await executeYugabyteSql(
        `UPDATE public.scans SET status = $1 WHERE id = $2;`,
        [status, scanId],
        platform?.env
      );
      await executeYugabyteSql(
        `INSERT INTO public.scan_global_audit_log (admin_id, action, scan_id, target_scan_id, details)
         VALUES ($1, $2, $3, $3, $4::jsonb);`,
        [locals.user.id, 'SET_SCAN_STATUS', scanId, JSON.stringify({ status, reason })],
        platform?.env
      ).catch(() => {});
    } catch (err: any) {
      return fail(400, { message: err?.message || 'Falha ao atualizar status da scan.' });
    }

    invalidateAdminScansCache();
    invalidateScansDirectoryCache();
    return { success: true, statusChanged: status };
  },

  recoverOwner: async ({ request, locals, platform }: any) => {
    if (locals.role !== 'ADMIN') return fail(403, { message: 'Acesso negado. Apenas ADMIN global.' });

    const formData = await request.formData();
    const scanId = formData.get('scan_id') as string;
    const newOwnerId = formData.get('new_owner_id') as string;
    const reason = (formData.get('reason') as string)?.trim() || 'Recuperação administrativa de ownership';

    if (!scanId || !newOwnerId) {
      return fail(400, { message: 'Scan e novo dono são obrigatórios.' });
    }

    try {
      await executeYugabyteSql(
        `UPDATE public.scan_members SET role = 'MEMBER' WHERE scan_id = $1 AND role = 'OWNER';`,
        [scanId],
        platform?.env
      );
      await executeYugabyteSql(
        `INSERT INTO public.scan_members (scan_id, user_id, role)
         VALUES ($1, $2, 'OWNER')
         ON CONFLICT (scan_id, user_id) DO UPDATE SET role = 'OWNER';`,
        [scanId, newOwnerId],
        platform?.env
      );
      await executeYugabyteSql(
        `INSERT INTO public.scan_global_audit_log (admin_id, action, scan_id, target_scan_id, details)
         VALUES ($1, $2, $3, $3, $4::jsonb);`,
        [locals.user.id, 'RECOVER_OWNERSHIP', scanId, JSON.stringify({ new_owner_id: newOwnerId, reason })],
        platform?.env
      ).catch(() => {});
    } catch (err: any) {
      return fail(400, { message: err?.message || 'Falha ao recuperar ownership da scan.' });
    }

    invalidateAdminScansCache();
    invalidateUserSession(newOwnerId);
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
      invalidateAdminScansCache();
      invalidateScansDirectoryCache();
      invalidateAdminScansCache();
      invalidateAdminTicketsCache();
      if (partnerReq.user_id) {
        invalidateUserSession(partnerReq.user_id);
      }
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

  reviewPartner: async ({ request, locals, platform }: any) => {
    if (locals.role !== 'ADMIN') return fail(403, { message: 'Acesso negado. Apenas ADMIN global.' });

    const formData = await request.formData();
    const requestId = formData.get('request_id') as string;
    const actionType = formData.get('action') as string;
    const reason = (formData.get('reason') as string)?.trim() || null;

    if (!requestId || !['APPROVE', 'REJECT'].includes(actionType)) {
      return fail(400, { message: 'Dados de avaliação inválidos.' });
    }

    // 1. Fetch current request to know candidate details & meta
    const reqRes = await executeYugabyteSql(
      `SELECT * FROM public.scan_partner_requests WHERE id = $1 LIMIT 1;`,
      [requestId],
      platform?.env
    ).catch(() => ({ rows: [] }));

    const partnerReq = reqRes.rows[0];
    if (!partnerReq) {
      return fail(404, { message: 'Solicitação de parceria não encontrada.' });
    }

    const meta = parsePartnerRequestMeta(partnerReq.sample_links);
    let createdScanId: string | null = null;

    try {
      if (actionType === 'APPROVE') {
        const slug = partnerReq.scan_name
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)+/g, '') || `scan-${Date.now().toString(36)}`;

        const scanInsert = await executeYugabyteSql(
          `INSERT INTO public.scans (name, slug, description, website, discord, status, logo_id, banner_id)
           VALUES ($1, $2, $3, $4, $5, 'ACTIVE', $6, $7)
           ON CONFLICT (slug) DO UPDATE SET status = 'ACTIVE'
           RETURNING id;`,
          [
            partnerReq.scan_name,
            slug,
            partnerReq.description || '',
            partnerReq.website || null,
            partnerReq.discord || null,
            meta.logo_id || null,
            meta.banner_id || null
          ],
          platform?.env
        );

        createdScanId = scanInsert.rows[0]?.id;

        if (createdScanId && partnerReq.user_id) {
          await executeYugabyteSql(
            `INSERT INTO public.scan_members (scan_id, user_id, role)
             VALUES ($1, $2, 'OWNER')
             ON CONFLICT (scan_id, user_id) DO UPDATE SET role = 'OWNER';`,
            [createdScanId, partnerReq.user_id],
            platform?.env
          );
        }

        await executeYugabyteSql(
          `UPDATE public.scan_partner_requests
           SET status = 'APPROVED', reviewed_by = $2, reviewed_at = now()
           WHERE id = $1;`,
          [requestId, locals.user!.id],
          platform?.env
        );
      } else {
        await executeYugabyteSql(
          `UPDATE public.scan_partner_requests
           SET status = 'REJECTED', reviewed_by = $2, reviewed_at = now(), rejection_reason = $3
           WHERE id = $1;`,
          [requestId, locals.user!.id, reason],
          platform?.env
        );
      }
    } catch (e: any) {
      return fail(400, { message: e?.message || 'Falha ao processar solicitação de parceria' });
    }

    if (actionType === 'APPROVE') {
      invalidateScansDirectoryCache();
      invalidateAdminScansCache();
      invalidateAdminTicketsCache();
      if (partnerReq.user_id) {
        invalidateUserSession(partnerReq.user_id);
      }

      // 4. Dispatch congratulatory in-app notification
      try {
        await createNotification({
          recipientUserId: partnerReq.user_id,
          type: 'SYSTEM_ANNOUNCEMENT',
          title: 'Parceria de Scan Aprovada! 🎉',
          body: `Parabéns! Sua solicitação para a scan "${partnerReq.scan_name}" foi aprovada pela administração do Project Nox. Seu painel de gestão (/scan) já está liberado!`,
          deepLink: '/scan',
          scanId: createdScanId || undefined
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

    invalidateAdminScansCache();
    invalidateAdminTicketsCache();
    return { success: true, reviewedPartner: { scan_id: createdScanId } };
  },

  reviewProject: async ({ request, locals, platform }: any) => {
    if (locals.role !== 'ADMIN') return fail(403, { message: 'Acesso negado. Apenas ADMIN global.' });

    const formData = await request.formData();
    const requestId = formData.get('request_id') as string;
    const actionType = formData.get('action') as string;
    const reason = (formData.get('reason') as string)?.trim() || null;

    if (!requestId || !['APPROVE', 'REJECT'].includes(actionType)) {
      return fail(400, { message: 'Dados de avaliação inválidos.' });
    }

    try {
      if (actionType === 'APPROVE') {
        const updateRes = await executeYugabyteSql(
          `UPDATE public.scan_project_requests
           SET status = 'APPROVED', reviewed_by = $2, reviewed_at = now()
           WHERE id = $1
           RETURNING scan_id, work_id;`,
          [requestId, locals.user!.id],
          platform?.env
        );

        const row = updateRes.rows[0];
        if (row?.work_id && row?.scan_id) {
          await executeYugabyteSql(
            `INSERT INTO public.work_scans (work_id, scan_id, is_primary)
             VALUES ($1, $2, false)
             ON CONFLICT (work_id, scan_id) DO NOTHING;`,
            [row.work_id, row.scan_id],
            platform?.env
          );
        }
      } else {
        await executeYugabyteSql(
          `UPDATE public.scan_project_requests
           SET status = 'REJECTED', reviewed_by = $2, reviewed_at = now(), rejection_reason = $3
           WHERE id = $1;`,
          [requestId, locals.user!.id, reason],
          platform?.env
        );
      }
    } catch (err: any) {
      return fail(400, { message: err?.message || 'Falha ao revisar pedido de projeto' });
    }

    invalidateAdminScansCache();
    return { success: true, reviewedProject: { id: requestId, action: actionType } };
  }
};
