import { fail } from '@sveltejs/kit';
import { readRequestFormData } from '$lib/server/request-body';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  const [
    telemetryRes,
    stagedCountRes,
    activeJobsRes,
    staffRequestsRes,
    nextQueuedRes,
    stagedRes,
    sourcesRes,
    worksListRes
  ] = await Promise.all([
    // 1. Latest telemetry heartbeat
    locals.db
      .from('importer_telemetry')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // 2. STAGED count in chapter mappings
    locals.db
      .from('importer_chapter_mappings')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'STAGED'),

    // 3. Currently active importing or retry jobs
    locals.db
      .from('importer_queue')
      .select('*')
      .in('status', ['IMPORTING', 'RETRY'])
      .order('updated_at', { ascending: false })
      .limit(8),

    // 4. Staff priority requests
    locals.db
      .from('importer_staff_requests')
      .select('*, works(id, title, slug, cover_id), members(id, username, display_name)')
      .order('created_at', { ascending: false })
      .limit(12),

    // 5. Top queued jobs
    locals.db
      .from('importer_queue')
      .select('*')
      .eq('status', 'QUEUED')
      .order('priority', { ascending: false })
      .order('chapter_sort_key', { ascending: true, nullsFirst: false })
      .order('next_run_at', { ascending: true })
      .limit(8),

    // 6. Chapters staged behind canonical barrier
    locals.db
      .from('importer_chapter_mappings')
      .select('*, works(id, title, cover_id)')
      .eq('status', 'STAGED')
      .order('chapter_sort_key', { ascending: true })
      .limit(8),

    // 7. Sources status & health
    locals.db
      .from('importer_sources')
      .select('*')
      .order('name', { ascending: true }),

    // 8. Works catalog for manual priority selection
    locals.db
      .from('works')
      .select('id, title, slug, cover_id')
      .order('title', { ascending: true })
      .limit(80)
  ]);

  const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();
  const twentyFourHoursAgo = new Date(Date.now() - 86400_000).toISOString();

  // Query status counts from importer_queue
  const [queuedCount, importingCount, retryCount, completedCount, failedCount, failed1hRes, failed24hRes, recentFailuresRes] =
    await Promise.all([
      locals.db.from('importer_queue').select('id', { count: 'exact', head: true }).eq('status', 'QUEUED'),
      locals.db.from('importer_queue').select('id', { count: 'exact', head: true }).eq('status', 'IMPORTING'),
      locals.db.from('importer_queue').select('id', { count: 'exact', head: true }).eq('status', 'RETRY'),
      locals.db.from('importer_queue').select('id', { count: 'exact', head: true }).eq('status', 'COMPLETED'),
      locals.db.from('importer_queue').select('id', { count: 'exact', head: true }).eq('status', 'FAILED'),
      locals.db.from('importer_queue').select('id', { count: 'exact', head: true }).eq('status', 'FAILED').gte('updated_at', oneHourAgo),
      locals.db.from('importer_queue').select('id', { count: 'exact', head: true }).eq('status', 'FAILED').gte('updated_at', twentyFourHoursAgo),
      locals.db.from('importer_queue').select('id, source, chapter_sort_key, last_error, updated_at, payload').eq('status', 'FAILED').order('updated_at', { ascending: false }).limit(6)
    ]);

  // Enrich active jobs with work titles
  const activeJobs = activeJobsRes.data || [];
  const activeWorkIds = Array.from(
    new Set(activeJobs.map((j) => (j.payload as any)?.workId).filter(Boolean))
  );
  let activeWorksMap: Record<string, any> = {};
  if (activeWorkIds.length > 0) {
    const { data: worksFound } = await locals.db
      .from('works')
      .select('id, title, cover_id')
      .in('id', activeWorkIds);
    if (worksFound) {
      activeWorksMap = Object.fromEntries(worksFound.map((w) => [w.id, w]));
    }
  }

  // Enrich queued jobs with work titles
  const queuedJobs = nextQueuedRes.data || [];
  const queuedWorkIds = Array.from(
    new Set(queuedJobs.map((j) => (j.payload as any)?.workId).filter(Boolean))
  );
  let queuedWorksMap: Record<string, any> = {};
  if (queuedWorkIds.length > 0) {
    const { data: qWorksFound } = await locals.db
      .from('works')
      .select('id, title, cover_id')
      .in('id', queuedWorkIds);
    if (qWorksFound) {
      queuedWorksMap = Object.fromEntries(qWorksFound.map((w) => [w.id, w]));
    }
  }

  return {
    telemetry: telemetryRes.data || null,
    counts: {
      queued: queuedCount.count || 0,
      importing: importingCount.count || 0,
      retry: retryCount.count || 0,
      staged: stagedCountRes.count || 0,
      completed: completedCount.count || 0,
      failed: failedCount.count || 0,
      failed1h: failed1hRes.count || 0,
      failed24h: failed24hRes.count || 0
    },
    recentFailures: recentFailuresRes.data || [],
    activeJobs: activeJobs.map((j) => ({
      ...j,
      work: (j.payload as any)?.workId ? activeWorksMap[(j.payload as any).workId] : null
    })),
    staffRequests: staffRequestsRes.data || [],
    queuedJobs: queuedJobs.map((j) => ({
      ...j,
      work: (j.payload as any)?.workId ? queuedWorksMap[(j.payload as any).workId] : null
    })),
    stagedChapters: stagedRes.data || [],
    sources: sourcesRes.data || [],
    catalogWorks: worksListRes.data || []
  };
};

export const actions: Actions = {
  prioritize: async ({ request, locals }) => {
    const form = await readRequestFormData(request);
    const workId = form.get('work_id')?.toString();
    const reason = form.get('reason')?.toString() || null;

    if (!workId) {
      return fail(400, { error: 'Selecione uma obra para priorizar.' });
    }

    const { data, error } = await locals.db.rpc('importer_prioritize_work', {
      p_work_id: workId,
      p_reason: reason || undefined
    });

    if (error) {
      return fail(400, { error: error.message });
    }

    return { success: true, message: (data as any)?.message || 'Obra priorizada com sucesso!' };
  },

  cancel: async ({ request, locals }) => {
    const form = await readRequestFormData(request);
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

    return { success: true, message: (data as any)?.message || 'Solicitação cancelada com sucesso.' };
  }
};
