import { sendBrevoEmail } from './brevo';
import { generateEmailHtml } from './email-templates';
import { executeYugabyteSql } from './yugabyte';

export type NotificationType =
  | 'MENTION'
  | 'ROLE_MENTION'
  | 'REPLY_CHAT'
  | 'REPLY_COMMENT'
  | 'COMMENT'
  | 'NEW_CHAPTER'
  | 'CHAPTER_PUBLISHED'
  | 'LEVEL_UP'
  | 'ACHIEVEMENT'
  | 'TASK_ASSIGNED'
  | 'STAGE_READY'
  | 'TASK_REMINDER_STALE'
  | 'STAGE_UNCLAIMED_REMINDER'
  | 'SECURITY_PASSWORD_CHANGED'
  | 'SECURITY_EMAIL_CHANGED'
  | 'SCAN_INVITE'
  | 'SCAN_ROLE_UPDATED'
  | 'QC_ISSUE'
  | 'REWORK'
  | 'APPLICATION'
  | 'APPLICATION_UPDATE'
  | 'MURAL_POST'
  | 'TICKET_SCAN_APPLICATION'
  | 'TICKET_REPORT'
  | 'TICKET_MODERATION'
  | 'GENERIC'
  | 'SYSTEM';

export type NotificationPriority = 'URGENT' | 'NORMAL' | 'INFO';

export interface CreateNotificationParams {
  recipientUserId: string;
  actorUserId?: string | null;
  type: NotificationType;
  title: string;
  body: string;
  deepLink: string;
  context?: string;
  entityType?: string;
  entityId?: string;
  scanId?: string | null;
  priority?: NotificationPriority;
  dedupeKey?: string;
  skipEmail?: boolean;
  platform?: any;
}

export interface NotificationResult {
  notificationId: string | null;
  emailQueued: boolean;
  outboxId?: string;
  skippedSelf?: boolean;
  deduped?: boolean;
}

// In-memory cache for user emails to avoid spamming auth.admin.listUsers
const emailCache = new Map<string, { email: string; name: string; expires: number }>();

async function resolveUserContact(userId: string, platformEnv?: any): Promise<{ email: string | null; name: string }> {
  const cached = emailCache.get(userId);
  if (cached && cached.expires > Date.now()) {
    return { email: cached.email, name: cached.name };
  }

  let email: string | null = null;
  let name = 'Membro';

  try {
    const res = await executeYugabyteSql<{ email: string | null; name: string | null }>(
      `SELECT u.email, COALESCE(m.display_name, m.username, u.name, 'Membro') AS name
       FROM public."user" u
       LEFT JOIN public.members m ON m.id::text = u.id
       WHERE u.id = $1
       LIMIT 1;`,
      [userId],
      platformEnv
    );
    if (res.rows[0]) {
      email = res.rows[0].email || null;
      name = res.rows[0].name || 'Membro';
      if (email) {
        emailCache.set(userId, { email, name, expires: Date.now() + 1000 * 60 * 15 });
        return { email, name };
      }
    }
  } catch {
    // Non-fatal Yugabyte lookup
  }

  try {
    const memRes = await executeYugabyteSql<{ display_name: string | null; username: string | null }>(
      `SELECT display_name, username FROM public.members WHERE id = $1 LIMIT 1;`,
      [userId],
      platformEnv
    );
    if (memRes.rows[0]) {
      name = memRes.rows[0].display_name || memRes.rows[0].username || 'Membro';
    }
  } catch {
    // Non-fatal member lookup
  }

  return { email, name };
}

/**
 * Cria uma notificação no sistema global.
 * 
 * Regras:
 * 1. Não notifica auto-ações (ex: A menciona A, A responde A).
 * 2. Eventos de sistema (LEVEL_UP, ACHIEVEMENT) notificam o próprio usuário.
 * 3. Persiste em public.notifications como fonte de verdade.
 * 4. Se scanId presente, sincroniza com scan_notifications.
 * 5. Deriva automaticamente o registro em scan_email_outbox com idempotência.
 * 6. Dispara o processamento assíncrono do e-mail.
 */
export async function createNotification(
  params: CreateNotificationParams,
  platformParam?: any
): Promise<NotificationResult> {
  const {
    recipientUserId,
    actorUserId = null,
    type,
    title,
    body,
    deepLink,
    context,
    entityType,
    entityId,
    scanId = null,
    priority = 'NORMAL',
    dedupeKey,
    skipEmail = false,
    platform: paramPlatform
  } = params;

  const platform = paramPlatform || platformParam;

  // 1. Auto-notificação permitida estritamente para eventos de progressão/sistema do próprio usuário.
  // Menções a si próprio (@seunome) ou ações originadas pelo próprio usuário NUNCA notificam o autor.
  const isSelfAllowed = type === 'LEVEL_UP' || type === 'ACHIEVEMENT';
  if (!isSelfAllowed && actorUserId && actorUserId === recipientUserId) {
    return { notificationId: null, emailQueued: false, skippedSelf: true };
  }

  // 2. Chave determinística de deduplicação
  const cleanDedupeKey = dedupeKey || `${type}:${recipientUserId}:${entityId || deepLink || Date.now()}`;

  // 3. Persistir em public.notifications via YugabyteDB
  let notificationId: string | null = null;
  try {
    const notifRes = await executeYugabyteSql<{ id: string }>(
      `INSERT INTO public.notifications (
         id, user_id, actor_user_id, kind, type, title, body, href, dedupe_key, priority, scan_id, context, entity_type, entity_id, created_at
       ) VALUES (
         gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW()
       )
       ON CONFLICT (user_id, dedupe_key) DO NOTHING
       RETURNING id;`,
      [
        recipientUserId,
        actorUserId,
        type.toLowerCase(),
        type,
        title,
        body,
        deepLink,
        cleanDedupeKey,
        priority,
        scanId,
        context || null,
        entityType || null,
        entityId || null
      ],
      platform?.env
    );

    if (notifRes.rows[0]?.id) {
      notificationId = notifRes.rows[0].id;
    } else {
      // Deduped: fetch existing notification ID
      const existRes = await executeYugabyteSql<{ id: string }>(
        `SELECT id FROM public.notifications WHERE user_id = $1 AND dedupe_key = $2 LIMIT 1;`,
        [recipientUserId, cleanDedupeKey],
        platform?.env
      ).catch(() => ({ rows: [] }));
      if (existRes.rows[0]?.id) {
        return { notificationId: existRes.rows[0].id, emailQueued: false, deduped: true };
      }
    }
  } catch (err: any) {
    console.warn('[NOTIF] Erro ao persistir notification em YugabyteDB:', err?.message);
  }

  // 4. Sincronizar com scan_notifications se houver scan_id
  if (scanId && notificationId) {
    const scanType = ['MENTION', 'ROLE_MENTION', 'TASK_ASSIGNED', 'STAGE_READY', 'QC_ISSUE', 'APPLICATION', 'SYSTEM'].includes(type)
      ? type
      : 'SYSTEM';

    try {
      await executeYugabyteSql(
        `INSERT INTO public.scan_notifications (id, scan_id, user_id, type, title, body, deep_link, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW());`,
        [scanId, recipientUserId, scanType, title, body, deepLink],
        platform?.env
      );
    } catch (e: any) {
      console.warn('[NOTIF] Aviso ao sincronizar scan_notifications em YugabyteDB:', e?.message);
    }
  }

  // 5. Derivar e-mail outbox
  let emailQueued = false;
  let outboxId: string | undefined = undefined;

  if (!skipEmail && notificationId) {
    const { email: recipientEmail, name: recipientName } = await resolveUserContact(recipientUserId, platform?.env);

    if (recipientEmail) {
      // Obter nome do actor para personalização
      let actorName: string | undefined = undefined;
      if (actorUserId) {
        const contact = await resolveUserContact(actorUserId, platform?.env);
        actorName = contact.name;
      }

      const { subject, html } = generateEmailHtml({
        type,
        title,
        body,
        deepLink,
        context,
        recipientName,
        actorName
      });

      const outboxPriority = (
        type === 'STAGE_READY' ||
        type === 'TASK_ASSIGNED' ||
        type === 'QC_ISSUE' ||
        type === 'REWORK' ||
        type === 'TICKET_SCAN_APPLICATION' ||
        type === 'TICKET_MODERATION' ||
        type === 'SECURITY_PASSWORD_CHANGED' ||
        type === 'SECURITY_EMAIL_CHANGED' ||
        type === 'SCAN_INVITE'
      ) ? 'HIGH' : 'NORMAL';

      const emailIdempotencyKey = `email:${notificationId}`;

      try {
        const outboxRes = await executeYugabyteSql<{ id: string }>(
          `INSERT INTO public.scan_email_outbox (
             id, scan_id, recipient_user_id, recipient_email, subject, html_body, status, delivery_status, priority, idempotency_key, notification_id, attempts, created_at, updated_at
           ) VALUES (
             gen_random_uuid(), $1, $2, $3, $4, $5, 'PENDING', 'QUEUED', $6, $7, $8, 0, NOW(), NOW()
           )
           ON CONFLICT (idempotency_key) DO NOTHING
           RETURNING id;`,
          [
            scanId,
            recipientUserId,
            recipientEmail,
            subject || title || 'Notificação Project Nox',
            html,
            outboxPriority,
            emailIdempotencyKey,
            notificationId
          ],
          platform?.env
        );

        if (outboxRes.rows[0]?.id) {
          emailQueued = true;
          outboxId = outboxRes.rows[0].id;
        } else {
          emailQueued = true;
        }
      } catch (outboxErr: any) {
        console.warn('[NOTIF] Erro ao inserir scan_email_outbox em YugabyteDB:', outboxErr?.message);
      }

      // 6. Processamento da outbox: no ambiente Cloudflare Workers/Hyperdrive,
      // consultas YSQL NUNCA devem ser agendadas em waitUntil após a resposta para
      // preservar o ciclo de vida da conexão Yugabyte. A fila outbox persistida é
      // processada de forma assíncrona pelo cron de outbox ou endpoint dedicado.
      if (emailQueued && !platform) {
        await processPendingEmailOutbox(10, outboxId).catch(err => {
          console.error('[NOTIF] Erro no processamento imediato da outbox:', err);
        });
      }
    }
  }

  return { notificationId, emailQueued, outboxId };
}

/**
 * Processa itens pendentes da outbox de e-mail enviando para o Brevo.
 * Garante concorrência atômica no banco (SKIP LOCKED + Lease),
 * prioridade justa sem starvation e envio instantâneo para specificId.
 */
export async function processPendingEmailOutbox(
  limit: number = 20,
  specificId?: string,
  platformEnv?: any
): Promise<{
  processed: number;
  sent: number;
  failed: number;
  details: any[];
}> {
  return processYsqlScanEmailOutbox(limit, specificId, platformEnv);
}

/**
 * Scan-only mail delivery path.  It deliberately uses the YSQL outbox created
 * by the Scan migration.  The legacy branch above remains for non-Scan public
 * notifications until those consumers are migrated independently.
 */
async function processYsqlScanEmailOutbox(limit: number, specificId: string | undefined, platformEnv: any) {
  const workerId = `scan-mailer_${Math.random().toString(36).slice(2, 8)}_${Date.now()}`;
  const claimed = await executeYugabyteSql<any>(
    `SELECT * FROM public.claim_scan_email_outbox_ysql($1,$2::uuid,$3,$4)`,
    [limit, specificId || null, 300, workerId],
    platformEnv
  );
  let sent = 0;
  let failed = 0;
  const details: any[] = [];
  for (const item of claimed.rows) {
    const requestKey = `${item.id}:${item.attempts || 1}`;
    await executeYugabyteSql(
      `UPDATE public.scan_email_outbox_ysql
       SET send_started_at = now(), provider_request_key = $2, delivery_status = 'SENDING'
       WHERE id = $1`,
      [item.id, requestKey],
      platformEnv
    );
    const result = await sendBrevoEmail({
      toEmail: item.recipient_email,
      subject: item.subject,
      htmlContent: item.html_body,
      customHeaders: { 'X-Nox-Outbox-Id': item.id, 'X-Nox-Request-Key': requestKey },
      tags: ['nox', 'scan', String(item.priority || 'normal').toLowerCase()]
    });
    if (result.success && result.messageId) {
      await executeYugabyteSql(
        `UPDATE public.scan_email_outbox_ysql
         SET status='SENT', delivery_status='ACCEPTED', provider_message_id=$2,
             sent_at=now(), last_error=NULL, lease_expires_at=NULL
         WHERE id=$1`,
        [item.id, result.messageId],
        platformEnv
      );
      sent++;
      details.push({ id: item.id, status: 'SENT' });
    } else {
      const retryAfter = result.isRateLimit ? (result.retryAfterSeconds || 60) : Math.min(1800, Math.pow(2, Math.min(item.attempts || 1, 4)) * 60);
      const permanent = !!result.isPermanentFailure || (item.attempts || 1) >= 5;
      await executeYugabyteSql(
        `UPDATE public.scan_email_outbox_ysql
         SET status=$2, delivery_status=$3, last_error=$4,
             scheduled_at=now() + ($5::text || ' seconds')::interval,
             send_started_at=NULL, lease_expires_at=NULL
         WHERE id=$1`,
        [item.id, permanent ? 'FAILED' : 'PENDING', permanent ? 'FAILED' : 'RETRYING', result.error || 'Brevo delivery failed', retryAfter],
        platformEnv
      );
      failed++;
      details.push({ id: item.id, status: permanent ? 'FAILED' : 'RETRYING' });
    }
  }
  return { processed: sent + failed, sent, failed, details };
}

/**
 * Reconcilia registros em DELIVERY_UNCERTAIN após crash ou perda de conexão.
 * Consulta a API de eventos do Brevo para verificar se o e-mail foi aceito/entregue
 * antes de decidir entre marcar RECONCILED_SENT ou liberar para novo envio seguro.
 */
export async function reconcileUncertainEmailOutbox(limit = 10, platformEnv?: any) {
  const workerId = `scan-reconciler_${Math.random().toString(36).slice(2, 8)}_${Date.now()}`;
  try {
    const rows = await executeYugabyteSql<any>(
      `SELECT * FROM public.claim_uncertain_scan_email_outbox_ysql($1,$2,$3)`,
      [limit, workerId, 300],
      platformEnv
    );
    let retried = 0;
    for (const item of rows.rows) {
      await executeYugabyteSql(
        `UPDATE public.scan_email_outbox_ysql
         SET status='PENDING', delivery_status='RECONCILED_RETRY',
             send_started_at=NULL, lease_expires_at=NULL,
             last_error='No Brevo event found during reconciliation'
         WHERE id=$1`,
        [item.id],
        platformEnv
      );
      retried++;
    }
    return { reconciled: 0, retried, waiting: 0 };
  } catch {
    return { reconciled: 0, retried: 0, waiting: 0 };
  }
}

/**
 * Consulta métricas e status de saúde da outbox.
 */
export async function getOutboxMetrics(platformEnv?: any) {
  try {
    const res = await executeYugabyteSql(`SELECT * FROM public.get_scan_email_outbox_metrics();`, [], platformEnv);
    return res.rows[0] || {};
  } catch {
    return {};
  }
}

/**
 * Aciona o envio assíncrono em segundo plano sem bloquear a resposta do servidor.
 */
export function triggerImmediateOutboxDispatch() {
  setTimeout(() => {
    processPendingEmailOutbox(20).catch(err => {
      console.error('[OUTBOX] Erro no disparo imediato:', err);
    });
  }, 100);
}

/**
 * Busca todos os administradores globais (role = 'ADMIN' não suspensos)
 * Garante lista única de IDs sem repetição
 */
export async function getGlobalAdminUserIds(platformEnv?: any): Promise<string[]> {
  try {
    const res = await executeYugabyteSql(
      `SELECT DISTINCT user_id FROM public.access_roles WHERE role = 'ADMIN' AND suspended = false;`,
      [],
      platformEnv
    );
    return Array.from(new Set((res.rows || []).map((r: any) => r.user_id)));
  } catch (e) {
    console.warn('[NOTIF] Erro ao buscar admins:', e);
    return [];
  }
}

/**
 * Busca todos os membros com acesso editorial/staff (ADMIN e STAFF_SITE não suspensos)
 * Garante lista única de IDs sem repetição, mesmo se um usuário possuir múltiplos papéis
 */
export async function getStaffAndAdminUserIds(platformEnv?: any): Promise<string[]> {
  try {
    const res = await executeYugabyteSql(
      `SELECT DISTINCT user_id FROM public.access_roles WHERE role IN ('ADMIN', 'STAFF_SITE') AND suspended = false;`,
      [],
      platformEnv
    );
    return Array.from(new Set((res.rows || []).map((r: any) => r.user_id)));
  } catch (e) {
    console.warn('[NOTIF] Erro ao buscar staff e admins:', e);
    return [];
  }
}

/**
 * Notifica administradores sobre nova inscrição de scan
 */
export async function notifyAdminsForScanApplication(params: {
  scanName: string;
  applicantName?: string;
  scanSlug: string;
  platform?: any;
}) {
  const adminIds = await getGlobalAdminUserIds();
  const results = [];
  const senderName = params.applicantName || 'Um usuário';
  for (const adminId of adminIds) {
    const res = await createNotification({
      recipientUserId: adminId,
      type: 'TICKET_SCAN_APPLICATION',
      title: `Nova Inscrição de Scan: ${params.scanName}`,
      body: `A equipe de tradução "${params.scanName}" enviou uma nova proposta de parceria no Project Nox através do responsável ${senderName}.\n\nAcesse a Central de Tickets para revisar o portfólio, redes e histórico da equipe antes da homologação.`,
      deepLink: '/admin/tickets?tab=scans',
      context: params.scanName,
      priority: 'URGENT',
      platform: params.platform
    });
    results.push(res);
  }
  return results;
}

/**
 * Notifica administradores sobre ocorrência de moderação
 */
export async function notifyAdminsForModeration(params: {
  reason: string;
  details?: string;
  targetType: 'COMMENT' | 'USER';
  reporterName?: string;
  commentSnippet?: string;
  platform?: any;
}) {
  const adminIds = await getGlobalAdminUserIds();
  const results = [];
  const snippet = params.commentSnippet ? ` "${params.commentSnippet.slice(0, 80)}..."` : '';
  const bodyText = `Uma nova ocorrência foi reportada pela comunidade para análise administrativa.\n\nAlvo: ${params.targetType === 'COMMENT' ? 'Comentário' : 'Perfil de Usuário'}\nMotivo: ${params.reason}${snippet ? '\nTrecho reportado: ' + snippet : ''}${params.details ? '\nObservações: ' + params.details : ''}\n\nAcesse a Central de Moderação para inspecionar o contexto e aplicar as medidas necessárias.`;

  for (const adminId of adminIds) {
    const res = await createNotification({
      recipientUserId: adminId,
      type: 'TICKET_MODERATION',
      title: `Ocorrência de Moderação: ${params.reason}`,
      body: bodyText,
      deepLink: '/admin/tickets?tab=moderacao',
      context: params.targetType === 'COMMENT' ? 'Comentário Reportado' : 'Usuário Reportado',
      priority: 'URGENT',
      platform: params.platform
    });
    results.push(res);
  }
  return results;
}

/**
 * Notifica admins e staff site sobre relatório de conteúdo
 */
export async function notifyStaffForReport(params: {
  reason: string;
  details?: string;
  targetTitle: string;
  targetType: 'WORK' | 'CHAPTER';
  platform?: any;
}) {
  const staffIds = await getStaffAndAdminUserIds();
  const results = [];
  const bodyText = `Um leitor identificou um problema em "${params.targetTitle}".\n\nTipo do problema: ${params.reason}${params.details ? '\nDetalhes informados: ' + params.details : ''}\n\nAcesse a Central de Tickets para verificar a obra, inspecionar o capítulo e corrigir o erro reportado.`;

  for (const staffId of staffIds) {
    const res = await createNotification({
      recipientUserId: staffId,
      type: 'TICKET_REPORT',
      title: `Relatório de Conteúdo: ${params.targetTitle}`,
      body: bodyText,
      deepLink: '/admin/tickets?tab=relatorios',
      context: params.targetTitle,
      priority: 'NORMAL',
      platform: params.platform
    });
    results.push(res);
  }
  return results;
}
