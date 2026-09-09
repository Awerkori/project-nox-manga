import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  const [
    telemetryRes,
    stagedCountRes,
    importingJobsRes,
    retryJobsRes,
    staffRequestsRes,
    nextQueuedRes,
    stagedRes,
    sourcesRes,
    worksListRes,
    workHealthRes,
    recentManifestRes
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

    // 3. Currently active importing jobs (ONLY IMPORTING)
    locals.db
      .from('importer_queue')
      .select('*')
      .eq('status', 'IMPORTING')
      .order('updated_at', { ascending: false })
      .limit(16),

    // 3b. Jobs awaiting retry (DEDICATED RETRIES AREA)
    locals.db
      .from('importer_queue')
      .select('*')
      .eq('status', 'RETRY')
      .order('next_run_at', { ascending: true })
      .limit(24),

    // 4. Staff priority requests
    locals.db
      .from('importer_staff_requests')
      .select('*, works(id, title, slug, cover_id), requester:members!importer_staff_requests_requested_by_fkey(id, username, display_name), canceller:members!importer_staff_requests_cancelled_by_fkey(id, username, display_name)')
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
      .limit(80),

    // 9. Catalog Work Health & Cross-Provider Reconciliations
    locals.db
      .from('importer_work_health')
      .select('*, works(id, title, slug, cover_id)')
      .order('last_reconciled_at', { ascending: false, nullsFirst: false })
      .limit(60),

    // 10. Chapter manifest entries
    locals.db
      .from('importer_chapter_manifest')
      .select('id, work_id, chapter_number, chapter_sort_key, status, selected_source, available_sources, page_count, last_checked_at')
      .order('chapter_sort_key', { ascending: true })
      .limit(100)
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

  const importingJobs = importingJobsRes.data || [];
  const retryJobs = retryJobsRes.data || [];
  const queuedJobs = nextQueuedRes.data || [];

  // Enrich jobs with work titles & covers
  const neededWorkIds = Array.from(
    new Set(
      [...importingJobs, ...retryJobs, ...queuedJobs]
        .map((j) => (j.payload as any)?.workId)
        .filter(Boolean)
    )
  );

  let worksMap: Record<string, any> = {};
  if (neededWorkIds.length > 0) {
    const { data: worksFound } = await locals.db
      .from('works')
      .select('id, title, cover_id, slug')
      .in('id', neededWorkIds);
    if (worksFound) {
      worksMap = Object.fromEntries(worksFound.map((w) => [w.id, w]));
    }
  }

  // Active Focus Request (Prioridade Absoluta)
  const staffRequests = staffRequestsRes.data || [];
  const activeFocus = staffRequests.find(
    (r) => r.status === 'QUEUED' || r.status === 'IMPORTING' || r.status === 'RETRYING' || r.status === 'BLOCKED'
  ) || null;

  let activeFocusStats: {
    totalDiscovered: number;
    completed: number;
    staged: number;
    pending: number;
    published: number;
    percent: number;
    currentChapter: string | number | null;
  } | null = null;

  let activeFocusFailure: {
    lastError: string | null;
    source: string | null;
    chapterNumber: string | number | null;
    updatedAt: string | null;
    attempts: number;
  } | null = null;

  if (activeFocus) {
    const focusWorkId = activeFocus.work_id;
    const [mappingsRes, publishedCountRes, currentJobRes, failedJobRes] = await Promise.all([
      locals.db
        .from('importer_chapter_mappings')
        .select('id, status, chapter_number, chapter_sort_key')
        .eq('work_id', focusWorkId),
      locals.db
        .from('chapters')
        .select('id', { count: 'exact', head: true })
        .eq('work_id', focusWorkId)
        .not('published_at', 'is', null),
      locals.db
        .from('importer_queue')
        .select('task_type, status, chapter_sort_key, payload')
        .eq('status', 'IMPORTING')
        .limit(1)
        .maybeSingle(),
      locals.db
        .from('importer_queue')
        .select('source, last_error, updated_at, attempts, payload, chapter_sort_key')
        .eq('status', 'FAILED')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    ]);

    const mappings = mappingsRes.data || [];
    const totalDiscovered = mappings.length;
    const completed = mappings.filter((m) => m.status === 'COMPLETED').length;
    const staged = mappings.filter((m) => m.status === 'STAGED').length;
    const pending = mappings.filter((m) => m.status === 'PENDING' || m.status === 'DOWNLOADING').length;
    const published = publishedCountRes.count || 0;
    const percent = totalDiscovered > 0 ? Math.round((completed / totalDiscovered) * 100) : 0;
    const currentChapter = currentJobRes.data
      ? ((currentJobRes.data.payload as any)?.chapterNumber ?? currentJobRes.data.chapter_sort_key)
      : null;

    activeFocusStats = {
      totalDiscovered,
      completed,
      staged,
      pending,
      published,
      percent,
      currentChapter
    };

    if (failedJobRes.data && (failedJobRes.data.payload as any)?.workId === focusWorkId) {
      activeFocusFailure = {
        lastError: failedJobRes.data.last_error,
        source: failedJobRes.data.source,
        chapterNumber: (failedJobRes.data.payload as any)?.chapterNumber ?? failedJobRes.data.chapter_sort_key,
        updatedAt: failedJobRes.data.updated_at,
        attempts: failedJobRes.data.attempts
      };
    }
  }

  return {
    telemetry: telemetryRes.data || null,
    activeFocus: activeFocus ? { ...activeFocus, stats: activeFocusStats, failure: activeFocusFailure } : null,
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
    importingJobs: importingJobs.map((j) => ({
      ...j,
      work: (j.payload as any)?.workId ? worksMap[(j.payload as any).workId] : null
    })),
    retryJobs: retryJobs.map((j) => ({
      ...j,
      work: (j.payload as any)?.workId ? worksMap[(j.payload as any).workId] : null
    })),
    activeJobs: [...importingJobs, ...retryJobs].map((j) => ({
      ...j,
      work: (j.payload as any)?.workId ? worksMap[(j.payload as any).workId] : null
    })),
    staffRequests,
    queuedJobs: queuedJobs.map((j) => ({
      ...j,
      work: (j.payload as any)?.workId ? worksMap[(j.payload as any).workId] : null
    })),
    stagedChapters: stagedRes.data || [],
    sources: sourcesRes.data || [],
    catalogWorks: worksListRes.data || [],
    workHealth: (workHealthRes.data || []).map((h: any) => ({
      ...h,
      work: h.works
    })),
    chapterManifest: recentManifestRes.data || [],
    healthMetrics: {
      healthyCount: (workHealthRes.data || []).filter((h: any) => h.health_status === 'HEALTHY').length,
      incompleteCount: (workHealthRes.data || []).filter((h: any) => h.health_status === 'INCOMPLETE').length,
      reconcilingCount: (workHealthRes.data || []).filter((h: any) => h.health_status === 'RECONCILING').length,
      unverifiedCount: (workHealthRes.data || []).filter((h: any) => h.health_status === 'UNVERIFIED').length,
      totalGaps: (workHealthRes.data || []).reduce((acc: number, h: any) => acc + (Array.isArray(h.gaps) ? h.gaps.length : 0), 0),
      totalUnresolvedGaps: (workHealthRes.data || []).reduce((acc: number, h: any) => acc + (Array.isArray(h.unresolved_gaps) ? h.unresolved_gaps.length : 0), 0),
      totalKnownChapters: (workHealthRes.data || []).reduce((acc: number, h: any) => acc + (h.total_known_chapters || 0), 0),
      totalImportedChapters: (workHealthRes.data || []).reduce((acc: number, h: any) => acc + (h.total_imported_chapters || 0), 0),
    }
  };
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
    if (!jobId) {
      return fail(400, { error: 'ID de job ausente.' });
    }

    // Postpone next_run_at by 24h
    const { error } = await locals.db
      .from('importer_queue')
      .update({
        status: 'RETRY',
        next_run_at: new Date(Date.now() + 24 * 3600_000).toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId);

    if (error) {
      return fail(400, { error: error.message });
    }

    return { success: true, message: 'Job pausado por 24 horas.' };
  },

  cancelJob: async ({ request, locals }) => {
    const form = await request.formData();
    const jobId = form.get('job_id')?.toString();
    if (!jobId) {
      return fail(400, { error: 'ID de job ausente.' });
    }

    const { error } = await locals.db
      .from('importer_queue')
      .update({
        status: 'FAILED',
        last_error: 'Cancelado manualmente via painel administrativo',
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId);

    if (error) {
      return fail(400, { error: error.message });
    }

    return { success: true, message: 'Job cancelado com sucesso.' };
  },

  freezeWork: async ({ request, locals }) => {
    const form = await request.formData();
    const workId = form.get('work_id')?.toString();
    if (!workId) {
      return fail(400, { error: 'ID de obra ausente.' });
    }

    // Mark mappings as IGNORED
    await locals.db
      .from('importer_work_mappings')
      .update({ sync_status: 'IGNORED', updated_at: new Date().toISOString() })
      .eq('work_id', workId);

    // Cancel queued / retry jobs for this work
    await locals.db
      .from('importer_queue')
      .update({
        status: 'FAILED',
        last_error: 'Obra congelada manualmente pelo administrador',
        updated_at: new Date().toISOString()
      })
      .in('status', ['QUEUED', 'RETRY'])
      .filter('payload->>workId', 'eq', workId);

    return { success: true, message: 'Obra congelada! Importações suspensas e jobs pendentes cancelados.' };
  }
};
