import { invalidateImporterSnapshotCache, loadSnapshot } from "$lib/server/importer-snapshot";
import { fail, error } from '@sveltejs/kit';
import { executeYugabyteSql } from '$lib/server/yugabyte';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
  const key = event.locals.user?.id;
  if (!key || !['ADMIN','STAFF_SITE','EDITOR'].includes(event.locals.role || '')) error(403);
  return loadSnapshot(event);
};

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const actions: Actions = {
  prioritize: async ({ request, locals, platform }: any) => {
    const form = await request.formData();
    let workId = form.get('work_id')?.toString() || null;
    const candidateTitle = form.get('candidate_title')?.toString()?.trim() || null;
    const source = form.get('source')?.toString() || 'nexus';
    const sourceWorkId = form.get('source_work_id')?.toString() || null;
    const sourceUrl = form.get('source_url')?.toString() || null;
    const reason = form.get('reason')?.toString() || null;
    const forceReplace = form.get('force_replace')?.toString() === 'true';
    const platformEnv = platform?.env;

    if (source === 'toonlivre' || source === 'nexus_toons') {
      return fail(400, { error: 'Esta fonte está permanentemente excluída por diretriz do projeto.' });
    }

    // If workId is not provided but candidate details were passed, resolve or create
    if (!workId && candidateTitle && sourceWorkId) {
      const slug = slugify(candidateTitle);

      const existingRes = await executeYugabyteSql(
        `SELECT id, title, slug FROM public.works WHERE slug = $1 LIMIT 1;`,
        [slug],
        platformEnv
      );
      const existingWork = existingRes.rows[0];

      if (existingWork?.id) {
        workId = existingWork.id;
      } else {
        const newWorkRes = await executeYugabyteSql(
          `INSERT INTO public.works (id, title, slug, kind, published, description)
           VALUES (gen_random_uuid(), $1, $2, 'MANHWA', true, 'Obra descoberta e sincronizada via Prioridade Absoluta')
           RETURNING id;`,
          [candidateTitle, slug],
          platformEnv
        );
        workId = newWorkRes.rows[0]?.id;
      }

      await executeYugabyteSql(
        `INSERT INTO public.importer_work_mappings (work_id, source, source_work_id, source_slug, source_title, metadata, sync_status)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, 'PENDING')
         ON CONFLICT (source, source_work_id) DO UPDATE SET sync_status = 'PENDING', updated_at = now();`,
        [workId, source, sourceWorkId, slug, candidateTitle, JSON.stringify(sourceUrl ? { sourceUrl } : {})],
        platformEnv
      );
    }

    if (!workId) {
      return fail(400, { error: 'Selecione uma obra para priorizar.' });
    }

    // Check for active conflict
    const activeReqRes = await executeYugabyteSql(
      `SELECT r.id, r.work_id, w.title
       FROM public.importer_staff_requests r
       LEFT JOIN public.works w ON w.id = r.work_id
       WHERE r.status IN ('QUEUED', 'IMPORTING')
       LIMIT 1;`,
      [],
      platformEnv
    );
    const activeReq = activeReqRes.rows[0];

    if (activeReq && activeReq.work_id !== workId && !forceReplace) {
      return {
        conflict: true,
        workId,
        activeWorkId: activeReq.work_id,
        activeWorkTitle: activeReq.title || 'Outra obra ativa',
        message: `Já existe uma obra em Prioridade Absoluta (${activeReq.title || 'ativa'}). Deseja substituir?`
      };
    }

    if (activeReq && activeReq.work_id !== workId && forceReplace) {
      await executeYugabyteSql(
        `UPDATE public.importer_staff_requests
         SET status = 'CANCELLED', cancelled_by = $1, cancelled_at = now(), cancel_reason = 'Substituída por outra obra prioritária'
         WHERE id = $2;`,
        [locals.user?.id || null, activeReq.id],
        platformEnv
      );
    }

    await executeYugabyteSql(
      `INSERT INTO public.importer_staff_requests (id, work_id, requested_by, reason, status, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, 'QUEUED', now(), now());`,
      [workId, locals.user?.id || null, reason],
      platformEnv
    );

    await executeYugabyteSql(
      `UPDATE public.importer_queue
       SET priority = 100, updated_at = now()
       WHERE (payload->>'workId')::text = $1 AND status IN ('QUEUED', 'RETRY');`,
      [workId],
      platformEnv
    ).catch(() => {});

    invalidateImporterSnapshotCache();
    return { success: true, message: 'Obra colocada em Prioridade Absoluta com sucesso!' };
  },

  cancel: async ({ request, locals, platform }: any) => {
    const form = await request.formData();
    const requestId = form.get('request_id')?.toString();

    if (!requestId) {
      return fail(400, { error: 'ID de solicitação inválido.' });
    }

    await executeYugabyteSql(
      `UPDATE public.importer_staff_requests
       SET status = 'CANCELLED', cancelled_by = $1, cancelled_at = now(), cancel_reason = 'Cancelada pela Staff'
       WHERE id = $2;`,
      [locals.user?.id || null, requestId],
      platform?.env
    );

    invalidateImporterSnapshotCache();
    return { success: true, message: 'Prioridade cancelada com sucesso.' };
  },

  retryBlocked: async ({ request, locals, platform }: any) => {
    const form = await request.formData();
    const requestId = form.get('request_id')?.toString();
    const workId = form.get('work_id')?.toString();
    const platformEnv = platform?.env;

    if (!requestId || !workId) {
      return fail(400, { error: 'Parâmetros inválidos para reativação.' });
    }

    await executeYugabyteSql(
      `UPDATE public.importer_queue
       SET status = 'QUEUED', attempts = 0, next_run_at = now(), priority = 100, updated_at = now()
       WHERE (payload->>'workId')::text = $1 AND status = 'FAILED';`,
      [workId],
      platformEnv
    );

    await executeYugabyteSql(
      `UPDATE public.importer_staff_requests SET status = 'QUEUED', updated_at = now() WHERE id = $1;`,
      [requestId],
      platformEnv
    );

    invalidateImporterSnapshotCache();
    return { success: true, message: 'Prioridade reativada! Capítulos reenfileirados com prioridade 100.' };
  },

  reconcile: async ({ request, platform }: any) => {
    const form = await request.formData();
    const workId = form.get('work_id')?.toString();

    if (!workId) {
      return fail(400, { error: 'ID de obra inválido.' });
    }

    await executeYugabyteSql(
      `UPDATE public.importer_work_mappings SET sync_status = 'PENDING', updated_at = now() WHERE work_id = $1;`,
      [workId],
      platform?.env
    );

    invalidateImporterSnapshotCache();
    return { success: true, message: 'Reconciliação multi-fonte iniciada com sucesso!' };
  },

  retryJob: async ({ request, platform }: any) => {
    const form = await request.formData();
    const jobId = form.get('job_id')?.toString();
    if (!jobId) {
      return fail(400, { error: 'ID de job ausente.' });
    }

    await executeYugabyteSql(
      `UPDATE public.importer_queue SET status = 'QUEUED', next_run_at = now(), updated_at = now() WHERE id = $1;`,
      [jobId],
      platform?.env
    );

    invalidateImporterSnapshotCache();
    return { success: true, message: 'Job reenfileirado para execução imediata!' };
  },

  retryAll: async ({ request, platform }: any) => {
    const form = await request.formData();
    const source = form.get('source')?.toString();
    const pattern = form.get('pattern')?.toString();
    const platformEnv = platform?.env;

    if (source && source !== 'ALL') {
      await executeYugabyteSql(
        `UPDATE public.importer_queue SET status = 'QUEUED', next_run_at = now(), updated_at = now() WHERE status = 'RETRY' AND source = $1;`,
        [source],
        platformEnv
      );
    } else {
      await executeYugabyteSql(
        `UPDATE public.importer_queue SET status = 'QUEUED', next_run_at = now(), updated_at = now() WHERE status = 'RETRY';`,
        [],
        platformEnv
      );
    }

    invalidateImporterSnapshotCache();
    return { success: true, message: 'Todos os jobs do grupo reenfileirados para retry!' };
  },

  pauseJob: async ({ request, locals, platform }: any) => {
    const form = await request.formData();
    const jobId = form.get('job_id')?.toString();
    const reason = form.get('reason')?.toString() || 'Pausado via painel da Staff';
    if (!jobId) {
      return fail(400, { error: 'ID de job ausente.' });
    }

    await executeYugabyteSql(
      `UPDATE public.importer_queue SET status = 'PAUSED', last_error = $1, updated_at = now() WHERE id = $2;`,
      [reason, jobId],
      platform?.env
    );

    invalidateImporterSnapshotCache();
    return { success: true, message: 'Job pausado pela Staff.' };
  },

  resumeJob: async ({ request, platform }: any) => {
    const form = await request.formData();
    const jobId = form.get('job_id')?.toString();
    if (!jobId) {
      return fail(400, { error: 'ID de job ausente.' });
    }

    await executeYugabyteSql(
      `UPDATE public.importer_queue SET status = 'QUEUED', next_run_at = now(), updated_at = now() WHERE id = $1;`,
      [jobId],
      platform?.env
    );

    invalidateImporterSnapshotCache();
    return { success: true, message: 'Job retomado e reenfileirado para execução!' };
  },

  postponeJob: async ({ request, platform }: any) => {
    const form = await request.formData();
    const jobId = form.get('job_id')?.toString();
    const hours = parseInt(form.get('hours')?.toString() || '24', 10);
    if (!jobId) {
      return fail(400, { error: 'ID de job ausente.' });
    }

    await executeYugabyteSql(
      `UPDATE public.importer_queue SET next_run_at = now() + ($1 || ' hours')::interval, updated_at = now() WHERE id = $2;`,
      [String(hours), jobId],
      platform?.env
    );

    invalidateImporterSnapshotCache();
    return { success: true, message: `Job adiado por ${hours} horas.` };
  },

  cancelJob: async ({ request, platform }: any) => {
    const form = await request.formData();
    const jobId = form.get('job_id')?.toString();
    const reason = form.get('reason')?.toString() || 'Cancelado via painel da Staff';
    if (!jobId) {
      return fail(400, { error: 'ID de job ausente.' });
    }

    await executeYugabyteSql(
      `UPDATE public.importer_queue SET status = 'CANCELLED', last_error = $1, updated_at = now() WHERE id = $2;`,
      [reason, jobId],
      platform?.env
    );

    invalidateImporterSnapshotCache();
    return { success: true, message: 'Job cancelado pela Staff.' };
  },

  freezeWork: async ({ request, platform }: any) => {
    const form = await request.formData();
    const workId = form.get('work_id')?.toString();
    if (!workId) {
      return fail(400, { error: 'ID de obra ausente.' });
    }

    await executeYugabyteSql(
      `UPDATE public.importer_work_health SET status = 'FROZEN', updated_at = now() WHERE work_id = $1;`,
      [workId],
      platform?.env
    );

    invalidateImporterSnapshotCache();
    return { success: true, message: 'Obra congelada com sucesso pela Staff.' };
  },

  unfreezeWork: async ({ request, platform }: any) => {
    const form = await request.formData();
    const workId = form.get('work_id')?.toString();
    if (!workId) {
      return fail(400, { error: 'ID de obra ausente.' });
    }

    await executeYugabyteSql(
      `UPDATE public.importer_work_health SET status = 'HEALTHY', updated_at = now() WHERE work_id = $1;`,
      [workId],
      platform?.env
    );

    invalidateImporterSnapshotCache();
    return { success: true, message: 'Obra descongelada com sucesso. Reconciliação reativada.' };
  }
};
