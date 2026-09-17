import { db, schema, safeQuery, safeQuerySingle } from '$lib/server/db';
import { eq, sql, and } from 'drizzle-orm';

import { sendBrevoEmail, queryBrevoEvents } from './brevo';
import { generateEmailHtml } from './email-templates';

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
  | 'QC_ISSUE'
  | 'REWORK'
  | 'APPLICATION'
  | 'APPLICATION_UPDATE'
  | 'MURAL_POST'
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

async function resolveUserContact(userId: string): Promise<{ email: string | null; name: string }> {
  const cached = emailCache.get(userId);
  if (cached && cached.expires > Date.now()) {
    return { email: cached.email, name: cached.name };
  }

  
  // 1. Get display name from public.members
  let name = 'Membro';
  try {
    const { data: m } = await safeQuerySingle(db.select({ username: schema.members.username, displayName: schema.members.displayName }).from(schema.members).where(eq(schema.members.id, userId)));
    if (m) {
      name = m.displayName || m.username || 'Membro';
    }
  } catch (err) {
    console.warn('[NOTIF] Erro ao buscar dados do membro:', err);
  }

  // 2. Get email from auth.users via admin client
  let email: string | null = null;
  try {
    const [authUser] = await db.select({ email: schema.user.email }).from(schema.user).where(eq(schema.user.id, userId));
    if (authUser?.email) {
      email = authUser.email;
      emailCache.set(userId, { email, name, expires: Date.now() + 1000 * 60 * 15 }); // 15 mins cache
    }
  } catch (err) {
    console.warn('[NOTIF] Erro ao buscar e-mail no auth admin:', err);
  }

  return { email, name };
}

/**
 * Cria uma notificao no sistema global.
 * 
 * Regras:
 * 1. No notifica auto-aes (ex: A menciona A, A responde A).
 * 2. Eventos de sistema (LEVEL_UP, ACHIEVEMENT) notificam o prprio usurio.
 * 3. Persiste em public.notifications como fonte de verdade.
 * 4. Se scanId presente, sincroniza com scan_notifications.
 * 5. Deriva automaticamente o registro em scan_email_outbox com idempotncia.
 * 6. Dispara o processamento assncrono do e-mail.
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

  // 1. Auto-notificao permitida para menes (@usurio e @cargo), alm de eventos de sistema
  const isSelfAllowed = type === 'MENTION' || type === 'ROLE_MENTION' || type === 'LEVEL_UP' || type === 'ACHIEVEMENT';
  if (!isSelfAllowed && actorUserId && actorUserId === recipientUserId) {
    return { notificationId: null, emailQueued: false, skippedSelf: true };
  }

  
  // 2. Chave determinstica de deduplicao
  const cleanDedupeKey = dedupeKey || `${type}:${recipientUserId}:${entityId || deepLink || Date.now()}`;

  // 3. Persistir em public.notifications
  const notifInsertPayload = {userId: recipientUserId,
    actorUserId: actorUserId,
    kind: type.toLowerCase(),
    type: type,
    title: title,
    body: body, isRead: false,
    href: deepLink,
    dedupeKey: cleanDedupeKey,
    priority: priority,
    scanId: scanId,
    context: context,
    entityType: entityType,
    entityId: entityId};

  let notificationId: string | null = null;
  const { data: insertedNotif, error: notifErr } = await safeQuerySingle(
    db.insert(schema.notifications).values(notifInsertPayload).returning({ id: schema.notifications.id })
  );

  if (notifErr) {if (notifErr.code === '23505') {
      // Violao de unique(userId, dedupeKey) - j foi notificado!
      return { notificationId: null, emailQueued: false, deduped: true};
    }
    console.error('[NOTIF] Erro ao inserir public.notifications:', notifErr);
  } else if (insertedNotif) {
    notificationId = insertedNotif.id;
  }

  // Se no inseriu nem obteve ID, tentar recuperar ID existente pelo dedupeKey
  if (!notificationId) {
    const { data: existing } = await safeQuerySingle(
      db.select({ id: schema.notifications.id })
        .from(schema.notifications)
        .where(and(eq(schema.notifications.userId, recipientUserId), eq(schema.notifications.dedupeKey, cleanDedupeKey)))
    );
    if (existing) {
      notificationId = existing.id;
    }
  }

  // 4. Sincronizar com scan_notifications se houver scanId
  if (scanId && notificationId) {const scanType = ['MENTION', 'ROLE_MENTION', 'TASK_ASSIGNED', 'STAGE_READY', 'QC_ISSUE', 'APPLICATION', 'SYSTEM'].includes(type)
      ? type
      : 'SYSTEM';

    try {
      await db.insert(schema.scanNotifications).values({
        scanId: scanId,
        userId: recipientUserId,
        type: scanType,
        title: title,
        body: body, isRead: false,
        deepLink: deepLink});
    } catch (e: any) {
      console.warn('[NOTIF] Aviso ao sincronizar scan_notifications:', e?.message);
    }
  }

  // 5. Derivar e-mail outbox
  let emailQueued = false;
  let outboxId: string | undefined = undefined;

  if (!skipEmail && notificationId) {
    const { email: recipientEmail, name: recipientName } = await resolveUserContact(recipientUserId);

    if (recipientEmail) {
      // Obter nome do actor para personalizao
      let actorName: string | undefined = undefined;
      if (actorUserId) {
        const contact = await resolveUserContact(actorUserId);
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

      const outboxPriority = (type === 'STAGE_READY' || type === 'TASK_ASSIGNED' || type === 'QC_ISSUE' || type === 'REWORK' || type === 'MENTION' || type === 'ROLE_MENTION')
        ? 'HIGH'
        : 'NORMAL';

      const emailIdempotencyKey = `email:${notificationId}`;

      const { data: outboxItem, error: outboxErr } = await safeQuerySingle(
        db.insert(schema.scanEmailOutbox).values({
          scanId: scanId,
          recipientUserId: recipientUserId,
          recipientEmail: recipientEmail,
          subject,
          htmlBody: html,
          status: 'PENDING',
          deliveryStatus: 'QUEUED',
          priority: outboxPriority,
          idempotencyKey: emailIdempotencyKey,
          scheduledAt: new Date().toISOString(),
          notificationId: notificationId,
          attempts: 0
        }).returning({ id: schema.scanEmailOutbox.id })
      );

      if (!outboxErr && outboxItem) {
        emailQueued = true;
        outboxId = outboxItem.id;
      } else if (outboxErr?.code === '23505') {
        // J existe outbox para esta notificao (derivada pelo trigger ou insero prvia)
        emailQueued = true;
      } else if (outboxErr) {
        console.error('[NOTIF] Erro ao inserir scan_email_outbox:', outboxErr);
      }

      // 6. Disparo imediato para o Brevo garantindo envio em tempo real
      if (emailQueued) {
        const dispatchPromise = processPendingEmailOutbox(10, outboxId).catch(err => {
          console.error('[NOTIF] Erro no processamento imediato da outbox:', err);
        });

        if ((platform as any)?.context?.waitUntil) {
          (platform as any).context.waitUntil(dispatchPromise);
        } else {
          await dispatchPromise;
        }
      }
    }
  }

  return { notificationId, emailQueued, outboxId };
}

let isDispatching = false;
let hasQueuedRun = false;

/**
 * Processa itens pendentes da outbox de e-mail enviando para o Brevo.
 * Garante concorrncia atmica no banco (SKIP LOCKED + Lease),
 * prioridade justa sem starvation e envio instantneo para specificId.
 */
export async function processPendingEmailOutbox(
  limit: number = 20,
  specificId?: string
): Promise<{
  processed: number;
  sent: number;
  failed: number;
  details: any[];
}> {
  if (isDispatching) {
    hasQueuedRun = true;
    return { processed: 0, sent: 0, failed: 0, details: [] };
  }

  isDispatching = true;
    const details: any[] = [];
  let sent = 0;
  let failed = 0;
  const workerId = `worker_${Math.random().toString(36).substring(2, 8)}_${Date.now()}`;

  try {
    // 1. Claim atmico persistente via RPC com FOR UPDATE SKIP LOCKED
    // Automaticamente recupera crashes/leases expirados, protege contra duplo envio entre workers
    // e aplica prioridade (HIGH > NORMAL > LOW) com FIFO estrito por prioridade (sem starvation).
    const { data: items, error: claimErr } = await (db as any).execute('claim_scan_email_outbox_batch', {
      p_limit: limit,
      p_specific_id: specificId || null,
      p_lease_seconds: 300,
      p_worker_id: workerId
    });

    if (claimErr) {
      console.error('[OUTBOX] Erro ao reivindicar lote de e-mails atmico:', claimErr);
      return { processed: 0, sent: 0, failed: 0, details: [] };
    }

    if (!items || items.length === 0) {
      return { processed: 0, sent: 0, failed: 0, details: [] };
    }

    // 2. Processar cada e-mail via Brevo REST API com pre-flight durvel
    for (const item of items) {
      const sendStartedAt = new Date().toISOString();
      const providerRequestKey = `${item.id}:${item.attempts || 1}`;

      // 2.1. PRE-FLIGHT DURVEL:
      // Persiste no banco que a requisio externa est iniciando.
      // Caso ocorra crash durante ou aps o POST da Brevo, o lease recovery detecta
      // send_started_at != null e move o item para DELIVERY_UNCERTAIN (bloqueando reenvio cego).
      await safeQuery(db.update(schema.scanEmailOutbox).set({sendStartedAt: sendStartedAt,
          providerRequestKey: providerRequestKey,
          deliveryStatus: 'SENDING'})
        .where(eq(schema.scanEmailOutbox.id, item.id)));

      const result = await sendBrevoEmail({
        toEmail: item.recipientEmail,
        subject: item.subject,
        htmlContent: item.htmlBody,
        customHeaders: {
          'X-Nox-Outbox-Id': item.id,
          'X-Nox-Request-Key': providerRequestKey
        },
        tags: ['nox', item.priority ? item.priority.toLowerCase() : 'normal']
      });

      if (result.success && (result as any).messageId) {// SUCESSO: accepted pelo Brevo
        await safeQuery(db.update(schema.scanEmailOutbox).set({
            status: 'SENT',
            deliveryStatus: 'ACCEPTED',
            providerMessageId: (result as any).messageId,
            sentAt: new Date().toISOString(),
            lastError: null,
            leaseExpiresAt: null}).where(eq(schema.scanEmailOutbox.id, item.id)));

        sent++;
        details.push({
          id: item.id,
          recipient: item.recipientEmail,
          status: 'SENT',
          providerMessageId: (result as any).messageId
        });
      } else if (result.isRateLimit) {// TRATAMENTO BREVO 429: Respeitar Retry-After sem descartar o e-mail
        const retryAfterSec = result.retryAfterSeconds || 60;
        const nextSchedule = new Date(Date.now() + retryAfterSec * 1000).toISOString();

        await safeQuery(db.update(schema.scanEmailOutbox).set({
            status: 'PENDING',
            deliveryStatus: 'RATE_LIMITED',
            lastError: `Brevo Rate Limit 429 - retrying after ${retryAfterSec}s: ${result.error}`,
            scheduledAt: nextSchedule,
            sendStartedAt: null,
            leaseExpiresAt: null
          }).where(eq(schema.scanEmailOutbox.id, item.id)));

        failed++;
        details.push({
          id: item.id,
          recipient: item.recipientEmail,
          status: 'RATE_LIMITED',
          error: result.error,
          retryAfterSeconds: retryAfterSec
        });
      } else if (result.isPermanentFailure) {// ERRO PERMANENTE: (ex: email invlido, unverified domain) -> no fazer retry infinito
        await safeQuery(db.update(schema.scanEmailOutbox).set({
            status: 'FAILED',
            deliveryStatus: 'FAILED',
            lastError: `Permanent error from Brevo: ${result.error}`,
            sendStartedAt: null,
            leaseExpiresAt: null
          }).where(eq(schema.scanEmailOutbox.id, item.id)));

        failed++;
        details.push({
          id: item.id,
          recipient: item.recipientEmail,
          status: 'FAILED',
          error: result.error,
          permanent: true
        });
      } else {// FALHA TEMPORRIA: backoff exponencial controlado (2min, 4min, 8min, 16min)
        const nextAttempts = item.attempts || 1;
        const isPermanentFail = nextAttempts >= 5;
        const backoffMinutes = Math.min(30, Math.pow(2, Math.min(nextAttempts, 4)));
        const nextSchedule = new Date(Date.now() + backoffMinutes * 60 * 1000).toISOString();

        await safeQuery(db.update(schema.scanEmailOutbox).set({
            status: isPermanentFail ? 'FAILED' : 'PENDING',
            deliveryStatus: isPermanentFail ? 'FAILED' : 'RETRYING',
            lastError: result.error || 'Erro desconhecido ao chamar Brevo',
            scheduledAt: nextSchedule,
            sendStartedAt: null,
            leaseExpiresAt: null}).where(eq(schema.scanEmailOutbox.id, item.id)));

        failed++;
        details.push({
          id: item.id,
          recipient: item.recipientEmail,
          status: isPermanentFail ? 'FAILED' : 'RETRYING',
          error: result.error
        });
      }
    }

    // 3. Monitoramento e alerta de fila travada
    let metrics: any = null;
    try {
      const res = await ((db as any).execute('get_scan_email_outbox_metrics') as any);
      metrics = res?.data;
    } catch {}
    if (metrics?.queue_stalled) {
      console.warn(
        `[OUTBOX_STALLED_ALERT] Fila de e-mails com atraso superior a 10 minutos! Mais antigo aguardando h ${metrics.oldest_pending_age_seconds}s (${metrics.pending_count} pendentes).`
      );
    }
  } catch (err: any) {
    console.error('[OUTBOX] Erro no processador de e-mails:', err);
  } finally {
    isDispatching = false;
    if (hasQueuedRun) {
      hasQueuedRun = false;
      setTimeout(() => {
        processPendingEmailOutbox(limit).catch(err => {
          console.error('[OUTBOX] Erro no re-disparo agendado:', err);
        });
      }, 50);
    }
  }

  return { processed: sent + failed, sent, failed, details };
}

/**
 * Reconcilia registros em DELIVERY_UNCERTAIN aps crash ou perda de conexo.
 * Consulta a API de eventos do Brevo para verificar se o e-mail foi aceito/entregue
 * antes de decidir entre marcar RECONCILED_SENT ou liberar para novo envio seguro.
 */
export async function reconcileUncertainEmailOutbox(limit = 10) {
    const workerId = `reconciler_${Math.random().toString(36).substring(2, 8)}_${Date.now()}`;

  const { data: items, error: claimErr } = await (db as any).execute('claim_uncertain_email_outbox_batch', {
    p_limit: limit,
    p_worker_id: workerId,
    p_lease_seconds: 300
  });

  if (claimErr || !items || items.length === 0) {
    return { reconciled: 0, retried: 0, waiting: 0 };
  }

  let reconciled = 0;
  let retried = 0;
  let waiting = 0;

  for (const item of items) {const sendStartedTime = item.sendStartedAt ? new Date(item.sendStartedAt).getTime() : 0;
    const ageSeconds = sendStartedTime ? (Date.now() - sendStartedTime) / 1000 : 9999;

    // Janela de busca: 10 minutos antes at 15 minutos depois do sendStartedAt
    const startDate = sendStartedTime 
      ? new Date(Math.max(0, sendStartedTime - 10 * 60 * 1000)).toISOString()
      : undefined;
    const endDate = sendStartedTime 
      ? new Date(sendStartedTime + 15 * 60 * 1000).toISOString()
      : undefined;

    const events = await queryBrevoEvents({
      email: item.recipientEmail,
      startDate,
      endDate,
      limit: 50});

    // Procura por evento correspondente ao mesmo destinatrio e assunto
    const matchingEvent = events.find(e => {
      if (e.email.toLowerCase() !== item.recipientEmail.toLowerCase()) return false;
      const subjA = (e.subject || '').trim().toLowerCase();
      const subjB = (item.subject || '').trim().toLowerCase();
      return subjA === subjB || subjA.includes(subjB) || subjB.includes(subjA);
    });

    if (matchingEvent && (matchingEvent as any).messageId) {// PROVADO: Brevo recebeu e aceitou o e-mail!
      // NO reenviar. Marcar como SENT com deliveryStatus = 'RECONCILED_SENT'
      await safeQuery(db.update(schema.scanEmailOutbox).set({
          status: 'SENT',
          deliveryStatus: 'RECONCILED_SENT',
          providerMessageId: (matchingEvent as any).messageId,
          sentAt: matchingEvent.date || new Date().toISOString(),
          reconciledAt: new Date().toISOString(),
          reconciliationNotes: `Reconciliado via evento Brevo "${matchingEvent.event}" em ${matchingEvent.date}`,
          leaseExpiresAt: null
        })
        .where(eq(schema.scanEmailOutbox.id, item.id)));
      reconciled++;
    } else if (ageSeconds < 300) {
      // Menos de 5 minutos desde o envio: o evento Brevo pode ainda estar sendo propagado
      // Manter em reconciliao aguardando prximo ciclo (limpando lease para novo ciclo)
      const evSample = events.slice(0, 3).map(e => `[${e.subject}]`).join(', ');
      await safeQuery(db.update(schema.scanEmailOutbox).set({deliveryStatus: 'RECONCILIATION_WAITING',
          reconciliationNotes: `Aguardando Brevo (idade: ${Math.round(ageSeconds)}s, evs=${events.length}): ${evSample || 'nenhum'} vs buscado: [${item.subject}]`,
          leaseExpiresAt: null
        })
        .where(eq(schema.scanEmailOutbox.id, item.id)));
      waiting++;
    } else {// Passaram mais de 5 minutos e nenhum evento foi registrado no Brevo:
      // Comprovado que o Brevo NO recebeu a mensagem (falha na conexo antes de chegar ao Brevo)
      // Liberado para retry seguro!
      await safeQuery(db.update(schema.scanEmailOutbox).set({
          status: 'PENDING',
          deliveryStatus: 'RECONCILED_RETRY',
          sendStartedAt: null,
          lastError: `Reconciliao confirmou ausncia de recebimento no Brevo aps ${Math.round(ageSeconds)}s. Liberado para re-tentativa segura.`,
          reconciledAt: new Date().toISOString(),
          scheduledAt: new Date().toISOString(),
          leaseExpiresAt: null
        })
        .where(eq(schema.scanEmailOutbox.id, item.id)));
      retried++;
    }
  }

  return { reconciled, retried, waiting };
}

/**
 * Consulta mtricas e status de sade da outbox.
 */
export async function getOutboxMetrics() {
    const { data, error } = await (db as any).execute('get_scan_email_outbox_metrics');
  if (error) throw error;
  return data;
}

/**
 * Aciona o envio assncrono em segundo plano sem bloquear a resposta do servidor.
 */
export function triggerImmediateOutboxDispatch() {
  setTimeout(() => {
    processPendingEmailOutbox(20).catch(err => {
      console.error('[OUTBOX] Erro no disparo imediato:', err);
    });
  }, 100);
}
