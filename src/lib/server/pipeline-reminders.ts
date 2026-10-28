import { privileged } from './db';
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
 *
 * Rules:
 * 1. Targeted strictly to the assigned user (assignee).
 * 2. Deduplicated with 3-day cooldown buckets (stale_reminder:{stageId}:{userId}:{bucket}).
 * 3. Cancelled/Skipped if stage is completed, cancelled, or paused.
 * 4. If assigned member was removed from scan, stage is automatically released and returned to queue.
 */
export async function dispatchStaleTaskReminders(options: {
  thresholdDays?: number;
  platform?: any;
  nowMs?: number;
} = {}): Promise<StaleRemindersResult> {
  const thresholdDays = options.thresholdDays ?? 3;
  const nowMs = options.nowMs ?? Date.now();
  const thresholdDate = new Date(nowMs - thresholdDays * 86_400_000).toISOString();

  const db = privileged();
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
    const { data, error } = await db
      .from('scan_chapter_stages')
      .select(`
        id,
        scan_id,
        production_chapter_id,
        stage_id,
        status,
        assigned_to,
        claimed_at,
        last_activity_at,
        scans:scan_id ( id, name, slug, is_active ),
        scan_production_chapters:production_chapter_id ( id, chapter_number, status, work_id, works:work_id ( id, title, slug ) ),
        scan_workflow_stages:stage_id ( id, name, slug )
      `)
      .eq('status', 'IN_PROGRESS')
      .not('assigned_to', 'is', null)
      .lte('last_activity_at', thresholdDate);

    if (error) {
      console.error('[STALE_REMINDER] Erro ao consultar scan_chapter_stages:', error);
      return result;
    }
    stagesData = data || [];
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
    const prodChapter = row.scan_production_chapters;
    const work = prodChapter?.works;
    const scan = row.scans;
    const wfStage = row.scan_workflow_stages;

    // Safety checks: production chapter must be in active progress
    if (!prodChapter || prodChapter.status === 'PAUSED' || prodChapter.status === 'CANCELLED' || prodChapter.status === 'PUBLISHED') {
      result.dedupedOrSkipped++;
      result.details.push({ stageId, userId, workTitle: work?.title || 'Obra', chapterNumber: prodChapter?.chapter_number || 0, action: 'SKIPPED' });
      continue;
    }

    const workTitle = work?.title || 'Obra';
    const chapterNumber = prodChapter?.chapter_number || 1;
    const scanName = scan?.name || 'Scan';
    const stageName = wfStage?.name || 'Etapa';

    // 2. Verify assignee is still an active, non-hidden member of this scan
    const { data: memberRecord } = await db
      .from('scan_members')
      .select('user_id, hidden_by_admin')
      .eq('scan_id', scanId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!memberRecord || memberRecord.hidden_by_admin) {
      // Member lost access or was removed from scan! Unassign stage safely.
      console.warn(`[STALE_REMINDER] Membro ${userId} não pertence mais à scan ${scanId}. Liberando etapa ${stageId}.`);
      await db
        .from('scan_chapter_stages')
        .update({
          assigned_to: null,
          status: 'AVAILABLE',
          availability_reason: 'returned_to_queue',
          updated_at: new Date().toISOString()
        })
        .eq('id', stageId);

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

    const meta: Record<string, string> = {
      'Obra': workTitle,
      'Capítulo': String(chapterNumber),
      'Etapa': stageName,
      'Scan': scanName,
      'Atribuído em': formatBrazilianDate(row.claimed_at),
      'Última Atividade': formatBrazilianDate(row.last_activity_at)
    };

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
  const db = privileged();

  const { data: stages } = await db
    .from('scan_chapter_stages')
    .select(`
      id,
      scan_id,
      production_chapter_id,
      stage_id,
      status,
      created_at,
      updated_at,
      scans:scan_id ( id, name ),
      scan_production_chapters:production_chapter_id ( id, chapter_number, status, works:work_id ( id, title ) ),
      scan_workflow_stages:stage_id ( id, name, slug, allowed_position_ids )
    `)
    .eq('status', 'AVAILABLE')
    .is('assigned_to', null)
    .lte('updated_at', thresholdDate);

  let reminded = 0;
  for (const s of stages || []) {
    const prod = s.scan_production_chapters;
    if (!prod || prod.status !== 'IN_PROGRESS') continue;

    const cooldownBucket = Math.floor(nowMs / (3 * 86_400_000));
    const workTitle = prod?.works?.title || 'Obra';
    const chapterNum = prod?.chapter_number || 1;
    const stageName = s.scan_workflow_stages?.name || 'Etapa';

    // Find scan leadership (OWNER and ADMIN) to alert about stale unclaimed stage
    const { data: leaders } = await db
      .from('scan_members')
      .select('user_id')
      .eq('scan_id', s.scan_id)
      .in('role', ['OWNER', 'ADMIN'])
      .eq('hidden_by_admin', false);

    for (const leader of leaders || []) {
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

  return { scanned: (stages || []).length, reminded };
}
