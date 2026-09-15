import { loadSnapshot } from "$lib/server/importer-snapshot";
import { fail, error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';


const snapshots = new Map<string, { at: number; data: any }>();
const snapshotFlights = new Map<string, Promise<any>>();
export const load: PageServerLoad = async (event) => {
  const key = event.locals.user?.id;
  if (!key || !['ADMIN','STAFF_SITE','EDITOR'].includes(event.locals.role || '')) error(403);
  const cached = snapshots.get(key);
  if (cached && Date.now() - cached.at < 4000) return cached.data;
  const existing = snapshotFlights.get(key);
  if (existing) return existing;
  const flight = loadSnapshot(event).then(data => {
    if (snapshots.size >= 50) snapshots.delete(snapshots.keys().next().value!);
    snapshots.set(key, { at: Date.now(), data });
    return data;
  }).finally(() => snapshotFlights.delete(key));
  snapshotFlights.set(key, flight);
  return flight;
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
  prioritize: async ({ request, locals }) => {
    const form = await request.formData();
    let workId = form.get('work_id')?.toString() || null;
    const candidateTitle = form.get('candidate_title')?.toString()?.trim() || null;
    const source = form.get('source')?.toString() || 'nexus';
    const sourceWorkId = form.get('source_work_id')?.toString() || null;
    const sourceUrl = form.get('source_url')?.toString() || null;
    const reason = form.get('reason')?.toString() || null;
    const forceReplace = form.get('force_replace')?.toString() === 'true';

    if (source === 'toonlivre' || source === 'nexus_toons') {
      return fail(400, { error: 'Esta fonte está permanentemente excluída por diretriz do projeto.' });
    }

    // If workId is not provided but candidate details were passed, resolve or create
    if (!workId && candidateTitle && sourceWorkId) {
      const slug = slugify(candidateTitle);

      const { data: existingWork } = await locals.db
        .from('works')
        .select('id, title, slug')
        .eq('slug', slug)
        .maybeSingle();

      if (existingWork?.id) {
        workId = existingWork.id;
      } else {
        const { data: newWork, error: newWorkErr } = await locals.db
          .from('works')
          .insert({
            title: candidateTitle,
            slug,
            kind: 'MANHWA',
            published: true,
            description: 'Obra descoberta e sincronizada via Prioridade Absoluta'
          })
          .select('id')
          .single();

        if (newWorkErr) {
          return fail(400, { error: 'Falha ao registrar nova obra: ' + newWorkErr.message });
        }
        workId = newWork.id;
      }

      await locals.db
        .from('importer_work_mappings')
        .upsert({
          work_id: workId,
          source,
          source_work_id: sourceWorkId,
          source_slug: slug,
          source_title: candidateTitle,
          metadata: sourceUrl ? { sourceUrl } : {},
          sync_status: 'PENDING'
        }, { onConflict: 'source,source_work_id' });
    }

    if (!workId) {
      return fail(400, { error: 'Selecione uma obra para priorizar.' });
    }

    const { data, error } = await locals.db.rpc('importer_prioritize_work', {
      p_work_id: workId,
      p_reason: reason || undefined,
      p_force_replace: forceReplace
    });

    if (error) {
      return fail(400, { error: error.message });
    }

    const res = data as any;
    if (res?.conflict) {
      return {
        conflict: true,
        workId,
        activeWorkId: res.active_work_id,
        activeWorkTitle: res.active_work_title,
        message: res.message
      };
    }

    return { success: true, message: res?.message || 'Obra colocada em Prioridade Absoluta com sucesso!' };
  },

  cancel: async ({ request, locals }) => {
    const form = await request.formData();
    const requestId = form.get('request_id')?.toString();

    if (!requestId) {
      return fail(400, { error: 'ID de solicitação inválido.' });
    }

    const { data, error } = await locals.db.rpc('importer_cancel_staff_request', {
      p_request_id: requestId
    });

    if (error) {
      return fail(400, { error: error.message });
    }

    const res = data as any;
    if (!res?.success) {
      return fail(400, { error: res?.message || 'Não foi possível cancelar a prioridade.' });
    }

    return { success: true, message: res?.message || 'Prioridade cancelada com sucesso.' };
  },

  retryBlocked: async ({ request, locals }) => {
    const form = await request.formData();
    const requestId = form.get('request_id')?.toString();
    const workId = form.get('work_id')?.toString();

    if (!requestId || !workId) {
      return fail(400, { error: 'Parâmetros inválidos para reativação.' });
    }

    const { data: failedJobs } = await locals.db
      .from('importer_queue')
      .select('id, payload')
      .eq('status', 'FAILED');

    const matchingIds = (failedJobs || [])
      .filter((j: any) => (j.payload as any)?.workId === workId)
      .map((j: any) => j.id);

    if (matchingIds.length > 0) {
      await locals.db
        .from('importer_queue')
        .update({
          status: 'QUEUED',
          attempts: 0,
          next_run_at: new Date().toISOString(),
          priority: 100,
          updated_at: new Date().toISOString()
        })
        .in('id', matchingIds);
    }

    await locals.db
      .from('importer_staff_requests')
      .update({ status: 'QUEUED', updated_at: new Date().toISOString() })
      .eq('id', requestId);

    return { success: true, message: 'Prioridade reativada! Capítulos reenfileirados com prioridade 100.' };
  },

  reconcile: async ({ request, locals }) => {
    const form = await request.formData();
    const workId = form.get('work_id')?.toString();

    if (!workId) {
      return fail(400, { error: 'ID de obra inválido.' });
    }

    const { data, error } = await locals.db.rpc('importer_request_reconciliation', {
      p_work_id: workId
    });

    if (error) {
      return fail(400, { error: error.message });
    }

    return { success: true, message: 'Reconciliação multi-fonte iniciada com sucesso!' };
  },

  retryJob: async ({ request, locals }) => {
    const form = await request.formData();
    const jobId = form.get('job_id')?.toString();
    if (!jobId) {
      return fail(400, { error: 'ID de job ausente.' });
    }

    const { error } = await locals.db
      .from('importer_queue')
      .update({
        status: 'QUEUED',
        next_run_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId);

    if (error) {
      return fail(400, { error: error.message });
    }

    return { success: true, message: 'Job reenfileirado para execução imediata!' };
  },

  retryAll: async ({ request, locals }) => {
    const form = await request.formData();
    const source = form.get('source')?.toString();
    const pattern = form.get('pattern')?.toString();

    let query = locals.db
      .from('importer_queue')
      .update({
        status: 'QUEUED',
        next_run_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('status', 'RETRY');

    if (source && source !== 'ALL') {
      query = query.eq('source', source);
    }
    if (pattern && pattern.trim()) {
      query = query.ilike('last_error', `%${pattern.trim()}%`);
    }

    const { error } = await query;
    if (error) {
      return fail(400, { error: error.message });
    }

    return { success: true, message: 'Todos os jobs do grupo reenfileirados para retry!' };
  },

  pauseJob: async ({ request, locals }) => {
    const form = await request.formData();
    const jobId = form.get('job_id')?.toString();
    const reason = form.get('reason')?.toString() || 'Pausado via painel da Staff';
    if (!jobId) {
      return fail(400, { error: 'ID de job ausente.' });
    }

    const { error } = await (locals.db.rpc as any)('importer_staff_pause_job', {
      p_job_id: jobId,
      p_actor_id: locals.user?.id || null,
      p_reason: reason
    });

    if (error) {
      return fail(400, { error: error.message });
    }

    return { success: true, message: 'Job pausado pela Staff.' };
  },

  resumeJob: async ({ request, locals }) => {
    const form = await request.formData();
    const jobId = form.get('job_id')?.toString();
    if (!jobId) {
      return fail(400, { error: 'ID de job ausente.' });
    }

    const { error } = await (locals.db.rpc as any)('importer_staff_resume_job', {
      p_job_id: jobId,
      p_actor_id: locals.user?.id || null
    });

    if (error) {
      return fail(400, { error: error.message });
    }

    return { success: true, message: 'Job retomado e reenfileirado para execução!' };
  },

  postponeJob: async ({ request, locals }) => {
    const form = await request.formData();
    const jobId = form.get('job_id')?.toString();
    const hours = parseInt(form.get('hours')?.toString() || '24', 10);
    if (!jobId) {
      return fail(400, { error: 'ID de job ausente.' });
    }

    const { error } = await (locals.db.rpc as any)('importer_staff_postpone_job', {
      p_job_id: jobId,
      p_delay: `${hours} hours`,
      p_actor_id: locals.user?.id || null
    });

    if (error) {
      return fail(400, { error: error.message });
    }

    return { success: true, message: `Job adiado por ${hours} horas.` };
  },

  cancelJob: async ({ request, locals }) => {
    const form = await request.formData();
    const jobId = form.get('job_id')?.toString();
    const reason = form.get('reason')?.toString() || 'Cancelado via painel da Staff';
    if (!jobId) {
      return fail(400, { error: 'ID de job ausente.' });
    }

    const { data, error } = await (locals.db.rpc as any)('importer_staff_cancel_job', {
      p_job_id: jobId,
      p_actor_id: locals.user?.id || null,
      p_reason: reason
    });

    if (error) {
      return fail(400, { error: error.message });
    }

    const res = data as any;
    return { success: true, message: res?.message || 'Job cancelado pela Staff.' };
  },

  freezeWork: async ({ request, locals }) => {
    const form = await request.formData();
    const workId = form.get('work_id')?.toString();
    const reason = form.get('reason')?.toString() || 'Congelado via painel da Staff';
    if (!workId) {
      return fail(400, { error: 'ID de obra ausente.' });
    }

    const { data, error } = await (locals.db.rpc as any)('importer_staff_freeze_work', {
      p_work_id: workId,
      p_actor_id: locals.user?.id || null,
      p_reason: reason
    });

    if (error) {
      return fail(400, { error: error.message });
    }

    const res = data as any;
    return { success: true, message: res?.message || 'Obra congelada com sucesso pela Staff.' };
  },

  unfreezeWork: async ({ request, locals }) => {
    const form = await request.formData();
    const workId = form.get('work_id')?.toString();
    if (!workId) {
      return fail(400, { error: 'ID de obra ausente.' });
    }

    const { data, error } = await (locals.db.rpc as any)('importer_staff_unfreeze_work', {
      p_work_id: workId,
      p_actor_id: locals.user?.id || null
    });

    if (error) {
      return fail(400, { error: error.message });
    }

    const res = data as any;
    return { success: true, message: res?.message || 'Obra descongelada com sucesso. Reconciliação reativada.' };
  }
};
