import { createNotification } from './notifications';
import { executeYugabyteSql } from './yugabyte';

export interface StaleStageInfo {
  id: string;
  scan_id: string;
  scan_name: string;
  production_chapter_id: string;
  chapter_number: number;
  work_id: string;
  work_title: string;
  stage_id: string;
  stage_name: string;
  stage_slug: string;
  assigned_to: string;
  claimed_at: string;
  last_activity_at: string;
  days_inactive: number;
}

export interface StaleRemindersResult {
  scanned: number;
  reminded: number;
  unassignedDueToRemoval: number;
  dedupedOrSkipped: number;
  details: Array<{
    stageId: string;
    userId: string;
    workTitle: string;
    chapterNumber: number;
    action: 'REMINDED' | 'UNASSIGNED' | 'DEDUPED' | 'SKIPPED';
  }>;
}

/**
 * Formats ISO timestamp to human-friendly Brazilian format.
 */
function formatBrazilianDate(isoString: string | null | undefined): string {
  if (!isoString) return 'Não registrada';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo'
    });
  } catch {
    return String(isoString);
  }
}

/**
 * Dispatches friendly stale reminders to assignees whose claimed stages
 * have remained without progress or activity for thresholdDays (default 3 days).
 */
export async function dispatchStaleTaskReminders(options: {
  thresholdDays?: number;
  platform?: any;
  nowMs?: number;
} = {}): Promise<StaleRemindersResult> {
  const thresholdDays = options.thresholdDays ?? 3;
  const nowMs = options.nowMs ?? Date.now();
  const thresholdDate = new Date(nowMs - thresholdDays * 86_400_000).toISOString();
  const platformEnv = options.platform?.env;

  const result: StaleRemindersResult = {
    scanned: 0,
    reminded: 0,
    unassignedDueToRemoval: 0,
    dedupedOrSkipped: 0,
    details: []
  };

  // 1. Fetch claimed in-progress stages older than threshold
  let stagesData: any[] = [];
  try {
    const res = await executeYugabyteSql(
      `SELECT 
        scs.id, scs.scan_id, scs.production_chapter_id, scs.stage_id, scs.status,
        scs.assigned_to, scs.claimed_at, scs.last_activity_at,
        s.name AS scan_name, s.status AS scan_status,
        spc.chapter_number, spc.status AS chapter_status,
        w.id AS work_id, w.title AS work_title,
        sws.name AS stage_name, sws.slug AS stage_slug
      FROM public.scan_chapter_stages scs
      JOIN public.scans s ON s.id = scs.scan_id
      JOIN public.scan_production_chapters spc ON spc.id = scs.production_chapter_id
      JOIN public.works w ON w.id = spc.work_id
      JOIN public.scan_workflow_stages sws ON sws.id = scs.stage_id
      WHERE scs.status = 'IN_PROGRESS'
        AND scs.assigned_to IS NOT NULL
        AND scs.last_activity_at <= $1::timestamptz;`,
      [thresholdDate],
      platformEnv
    );
    stagesData = res.rows || [];
  } catch (err) {
    console.error('[STALE_REMINDER] Exceção ao consultar etapas:', err);
    return result;
  }

  result.scanned = stagesData.length;
  if (stagesData.length === 0) return result;

  for (const row of stagesData) {
    const stageId = row.id;
    const scanId = row.scan_id;
    const userId = row.assigned_to;
    const workTitle = row.work_title || 'Obra';
    const chapterNumber = row.chapter_number || 1;
    const scanName = row.scan_name || 'Scan';
    const stageName = row.stage_name || 'Etapa';

    // Safety checks: production chapter must be in active progress
    if (!row.chapter_status || ['PAUSED', 'CANCELLED', 'PUBLISHED'].includes(row.chapter_status)) {
      result.dedupedOrSkipped++;
      result.details.push({ stageId, userId, workTitle, chapterNumber, action: 'SKIPPED' });
      continue;
    }

    // 2. Verify assignee is still an active, non-hidden member of this scan
    const memberRes = await executeYugabyteSql(
      `SELECT user_id, hidden_by_admin FROM public.scan_members WHERE scan_id = $1 AND user_id = $2 LIMIT 1;`,
      [scanId, userId],
      platformEnv
    ).catch(() => ({ rows: [] }));
    const memberRecord = memberRes.rows[0];

    if (!memberRecord || memberRecord.hidden_by_admin) {
      console.warn(`[STALE_REMINDER] Membro ${userId} não pertence mais à scan ${scanId}. Liberando etapa ${stageId}.`);
      await executeYugabyteSql(
        `UPDATE public.scan_chapter_stages
         SET assigned_to = NULL,
             status = 'AVAILABLE',
             availability_reason = 'returned_to_queue',
             updated_at = now()
         WHERE id = $1;`,
        [stageId],
        platformEnv
      ).catch(() => {});

      result.unassignedDueToRemoval++;
      result.details.push({ stageId, userId, workTitle, chapterNumber, action: 'UNASSIGNED' });
      continue;
    }

    // 3. Compute 3-day cooldown bucket for deduplication
    const cooldownBucket = Math.floor(nowMs / (3 * 86_400_000));
    const dedupeKey = `stale_reminder:${stageId}:${userId}:${cooldownBucket}`;

    const diffMs = nowMs - new Date(row.last_activity_at || row.claimed_at).getTime();
    const daysInactive = Math.max(3, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

    const deepLink = `/scan?id=${scanId}&tab=tasks&stageId=${stageId}`;
    const title = `Lembrete: Tarefa em Andamento — ${workTitle} Cap. ${chapterNumber}`;
    const body = `Olá! Você possui a etapa ${stageName} em andamento na ${scanName} há mais de ${daysInactive} dias sem nova atividade registrada.\n\nCaso já tenha concluído ou precise de ajuda, acesse o painel para atualizar a tarefa.`;

    const notifRes = await createNotification(
      {
        recipientUserId: userId,
        actorUserId: null, // System event
        type: 'TASK_REMINDER_STALE',
        title,
        body,
        deepLink,
        context: `${workTitle} — Cap. ${chapterNumber}`,
        scanId,
        priority: 'NORMAL',
        dedupeKey,
        platform: options.platform
      },
      options.platform
    );

    if (notifRes.notificationId && notifRes.emailQueued) {
      result.reminded++;
      result.details.push({ stageId, userId, workTitle, chapterNumber, action: 'REMINDED' });
    } else if (notifRes.deduped) {
      result.dedupedOrSkipped++;
      result.details.push({ stageId, userId, workTitle, chapterNumber, action: 'DEDUPED' });
    } else {
      result.dedupedOrSkipped++;
      result.details.push({ stageId, userId, workTitle, chapterNumber, action: 'SKIPPED' });
    }
  }

  return result;
}

/**
 * Dispatches notification for editorial stages that have been in 'AVAILABLE'
 * status for thresholdDays without any team member claiming them.
 */
export async function dispatchUnclaimedStageReminders(options: {
  thresholdDays?: number;
  platform?: any;
  nowMs?: number;
} = {}): Promise<{ scanned: number; reminded: number }> {
  const thresholdDays = options.thresholdDays ?? 3;
  const nowMs = options.nowMs ?? Date.now();
  const thresholdDate = new Date(nowMs - thresholdDays * 86_400_000).toISOString();
  const platformEnv = options.platform?.env;

  let stages: any[] = [];
  try {
    const res = await executeYugabyteSql(
      `SELECT 
        scs.id, scs.scan_id, scs.production_chapter_id, scs.stage_id, scs.status,
        scs.created_at, scs.updated_at,
        s.name AS scan_name,
        spc.chapter_number, spc.status AS chapter_status,
        w.title AS work_title,
        sws.name AS stage_name
      FROM public.scan_chapter_stages scs
      JOIN public.scans s ON s.id = scs.scan_id
      JOIN public.scan_production_chapters spc ON spc.id = scs.production_chapter_id
      JOIN public.works w ON w.id = spc.work_id
      JOIN public.scan_workflow_stages sws ON sws.id = scs.stage_id
      WHERE scs.status = 'AVAILABLE'
        AND scs.assigned_to IS NULL
        AND scs.updated_at <= $1::timestamptz;`,
      [thresholdDate],
      platformEnv
    );
    stages = res.rows || [];
  } catch (e) {
    console.error('[UNCLAIMED_REMINDER] Error fetching stages:', e);
    return { scanned: 0, reminded: 0 };
  }

  let reminded = 0;
  for (const s of stages) {
    if (s.chapter_status !== 'IN_PROGRESS') continue;

    const cooldownBucket = Math.floor(nowMs / (3 * 86_400_000));
    const workTitle = s.work_title || 'Obra';
    const chapterNum = s.chapter_number || 1;
    const stageName = s.stage_name || 'Etapa';

    // Find scan leadership (OWNER and ADMIN) to alert about stale unclaimed stage
    const leadersRes = await executeYugabyteSql(
      `SELECT user_id FROM public.scan_members WHERE scan_id = $1 AND role IN ('OWNER', 'ADMIN') AND hidden_by_admin = false;`,
      [s.scan_id],
      platformEnv
    ).catch(() => ({ rows: [] }));
    const leaders = leadersRes.rows || [];

    for (const leader of leaders) {
      const dedupeKey = `unclaimed_stage:${s.id}:${leader.user_id}:${cooldownBucket}`;
      const res = await createNotification({
        recipientUserId: leader.user_id,
        type: 'STAGE_UNCLAIMED_REMINDER',
        title: `Etapa Disponível sem Responsável: ${workTitle} Cap. ${chapterNum}`,
        body: `A etapa ${stageName} está disponível há mais de ${thresholdDays} dias sem responsável na equipe.`,
        deepLink: `/scan?id=${s.scan_id}&tab=pipeline`,
        context: `${workTitle} — Cap. ${chapterNum}`,
        scanId: s.scan_id,
        priority: 'NORMAL',
        dedupeKey,
        platform: options.platform
      });
      if (res.notificationId) reminded++;
    }
  }

  return { scanned: stages.length, reminded };
}
