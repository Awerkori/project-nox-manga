import { error, fail } from '@sveltejs/kit';
import { db, schema, safeQuery, safeQuerySingle } from '$lib/server/db';
import { eq, sql } from 'drizzle-orm';
import { hasCapability, normalizeRole } from '$lib/rbac';
import type { PageServerLoad, Actions } from './$types';

let cachedResult: { at: number; data: any } | null = null;
let activeFlight: Promise<any> | null = null;
const CACHE_TTL_MS = 60 * 1000; // 60s cache to avoid repetitive 10s table scans

export const load: PageServerLoad = async ({ locals }) => {
  const role = normalizeRole(locals.role);
  if (!hasCapability(role, 'CAN_VIEW_IMPORTER')) {
    throw error(403, 'Acesso restrito');
  }

  const now = Date.now();
  if (cachedResult && now - cachedResult.at < CACHE_TTL_MS) {
    return { ...cachedResult.data, role };
  }

  if (activeFlight) {
    const data = await activeFlight;
    return { ...data, role };
  }

  activeFlight = (async () => {
    // 1. Run gap detection query across works with published chapters
    const gapsRes = await safeQuery(
      db.execute(sql`
        WITH work_chaps AS (
          SELECT
            w.id as work_id,
            w.title,
            w.slug,
            w.cover_id,
            array_agg(c.number ORDER BY c.number) as ch_nums,
            COALESCE(max(m.source), 'vegitoons') as primary_source
          FROM works w
          JOIN chapters c ON c.work_id = w.id
          LEFT JOIN importer_work_mappings m ON m.work_id = w.id
          WHERE c.published_at IS NOT NULL
          GROUP BY w.id, w.title, w.slug, w.cover_id
        )
        SELECT work_id, title, slug, cover_id, ch_nums, primary_source
        FROM work_chaps
        LIMIT 120
      `)
    );

    const rawRows = (gapsRes.data as any) || [];

  const worksWithGaps: any[] = [];
  for (const r of rawRows) {
    let rawNums: number[] = [];
    if (Array.isArray(r.ch_nums)) {
      rawNums = r.ch_nums
        .map((n: any) => parseFloat(n))
        .filter((n: any) => !isNaN(n) && Number.isInteger(n) && n > 0);
    } else if (typeof r.ch_nums === 'string') {
      const cleaned = r.ch_nums.replace(/[\{\}]/g, '');
      if (cleaned.length > 0) {
        rawNums = cleaned
          .split(',')
          .map((n: string) => parseFloat(n.trim()))
          .filter((n: number) => !isNaN(n) && Number.isInteger(n) && n > 0);
      }
    }

    const unique = Array.from(new Set(rawNums)).sort((a: any, b: any) => a - b);
    if (unique.length === 0) continue;

    const min = unique[0];
    const max = unique[unique.length - 1];
    if (max <= 1 && min <= 1) continue;

    const missing: number[] = [];
    const numSet = new Set(unique);

    // Check full canonical expected integer range: 1 -> max
    for (let i = 1; i <= max; i++) {
      if (!numSet.has(i)) {
        missing.push(i);
      }
    }

    if (missing.length > 0) {
      worksWithGaps.push({
        workId: r.work_id,
        title: r.title,
        slug: r.slug,
        coverId: r.cover_id,
        source: r.primary_source || 'vegitoons',
        totalPublished: unique.length,
        minChapter: min,
        maxChapter: max,
        missingChapters: missing,
        totalMissing: missing.length,
        isPrioritized: false
      });
    }
  }

  // Check which works already have active staff requests
  const activeRequestsRes = await safeQuery(
    db.select({ workId: schema.importerStaffRequests.workId })
      .from(schema.importerStaffRequests)
      .where(eq(schema.importerStaffRequests.status, 'ACTIVE'))
  );

  const activeWorkIds = new Set((activeRequestsRes.data || []).map((r: any) => r.workId));
  for (const w of worksWithGaps) {
    if (activeWorkIds.has(w.workId)) {
      w.isPrioritized = true;
    }
  }

  // Sort by total missing descending
  worksWithGaps.sort((a, b) => b.totalMissing - a.totalMissing);

    const resultData = {
      worksWithGaps,
      totalGapsCount: worksWithGaps.reduce((acc, w) => acc + w.totalMissing, 0),
      worksCount: worksWithGaps.length
    };
    cachedResult = { at: Date.now(), data: resultData };
    return resultData;
  })().finally(() => {
    activeFlight = null;
  });

  const data = await activeFlight;
  return {
    ...data,
    role
  };
};

export const actions: Actions = {
  prioritizeGap: async ({ request, locals }) => {
    cachedResult = null;
    const role = normalizeRole(locals.role);
    if (!hasCapability(role, 'CAN_MANAGE_IMPORTER_PRIORITIES')) {
      return fail(403, { error: 'Sem permissão.' });
    }

    const form = await request.formData();
    const workId = form.get('workId')?.toString();
    const missingChaptersRaw = form.get('missingChapters')?.toString();
    const totalMissing = form.get('totalMissing')?.toString() || '0';
    if (!workId) return fail(400, { error: 'ID da obra ausente.' });

    const boost = 1000; // STAFF_FORCED lane
    const now = new Date().toISOString();
    const reqId = crypto.randomUUID();

    // Check if there is already an active request
    const existing = await safeQuerySingle(
      db.select({ id: schema.importerStaffRequests.id })
        .from(schema.importerStaffRequests)
        .where(sql`work_id = ${workId} AND status = 'ACTIVE'`)
    );

    if (existing.data) {
      await safeQuery(
        db.update(schema.importerStaffRequests)
          .set({
            priorityBoost: boost,
            reason: `Correção de lacunas no catálogo (${totalMissing} capítulos faltantes) - STAFF_FORCED`,
            status: 'ACTIVE',
            updatedAt: now
          })
          .where(eq(schema.importerStaffRequests.id, existing.data.id))
      );
    } else {
      await safeQuery(
        db.insert(schema.importerStaffRequests).values({
          id: reqId,
          workId,
          requestedBy: locals.user?.id || 'staff',
          priorityBoost: boost,
          reason: `Correção de lacunas no catálogo (${totalMissing} capítulos faltantes) - STAFF_FORCED`,
          status: 'ACTIVE',
          attemptCount: 0,
          createdAt: now,
          updatedAt: now
        })
      );
    }

    // Immediately elevate all queued/retry/paused jobs in importer_queue for workId to priority 1000 (STAFF_FORCED)
    await safeQuery(
      db.execute(sql`
        UPDATE importer_queue
        SET priority = 1000,
            status = CASE WHEN status IN ('PAUSED_BY_STAFF', 'PAUSED') THEN 'QUEUED' ELSE status END,
            payload = jsonb_set(
              jsonb_set(
                COALESCE(payload::jsonb, '{}'::jsonb),
                '{originalPriority}',
                CASE 
                  WHEN (payload::jsonb->>'originalPriority') IS NOT NULL AND (payload::jsonb->>'originalPriority')::int < 1000
                    THEN (payload::jsonb->'originalPriority')
                  ELSE to_jsonb(priority)
                END
              ),
              '{staffForced}',
              'true'::jsonb
            ),
            next_run_at = LEAST(next_run_at, NOW())
        WHERE (
          CASE 
            WHEN payload::text LIKE '%"workId":%' THEN (payload->>'workId') = ${workId}
            ELSE false
          END
        )
        AND status IN ('QUEUED', 'RETRY', 'PAUSED_BY_STAFF', 'PAUSED')
      `)
    );

    // If no runnable chapter jobs exist in queue, enqueue SYNC_WORK to discover chapters immediately
    const queueCheck = await safeQuery(
      db.execute(sql`
        SELECT count(*) as cnt
        FROM importer_queue
        WHERE (payload->>'workId') = ${workId}
          AND status IN ('QUEUED', 'RETRY', 'IMPORTING')
      `)
    );
    const existingRunnableCount = Number((queueCheck.data as any)?.[0]?.cnt || 0);

    if (existingRunnableCount === 0) {
      const wmRes = await safeQuery(
        db.execute(sql`
          SELECT source, source_work_id
          FROM importer_work_mappings
          WHERE work_id = ${workId}::uuid
          ORDER BY confidence_score DESC, updated_at DESC
          LIMIT 1
        `)
      );
      const wm = (wmRes.data as any)?.[0];
      if (wm?.source && wm?.source_work_id) {
        await safeQuery(
          db.execute(sql`
            INSERT INTO importer_queue (
              id, task_type, source, dedupe_key, priority, status, payload, next_run_at, created_at, updated_at
            ) VALUES (
              gen_random_uuid(),
              'SYNC_WORK',
              ${wm.source},
              ${wm.source} || ':sync:' || ${wm.source_work_id},
              1000,
              'QUEUED',
              jsonb_build_object(
                'workId', ${workId},
                'sourceWorkId', ${wm.source_work_id},
                'staffRequested', true,
                'staffForced', true
              ),
              NOW(),
              NOW(),
              NOW()
            ) ON CONFLICT (dedupe_key) DO UPDATE
            SET status = 'QUEUED',
                priority = 1000,
                next_run_at = NOW(),
                updated_at = NOW()
          `)
        );
      }
    }

    // Audit log
    await safeQuery(
      db.insert(schema.importerStaffAudit).values({
        id: crypto.randomUUID(),
        actorId: locals.user?.id || null,
        action: 'PRIORITIZE_GAP_CORRECTION',
        targetType: 'WORK',
        targetId: workId,
        oldState: 'HAS_GAPS',
        newState: 'STAFF_FORCED',
        reason: `Solicitação de reparo prioritário de lacunas (${totalMissing} ausentes)`,
        metadata: JSON.stringify({ totalMissing, sampleMissing: missingChaptersRaw?.slice(0, 100) })
      })
    );

    return { success: true, message: '🔥 Correção prioritária (STAFF_FORCED) ativada com sucesso!' };
  }
};
