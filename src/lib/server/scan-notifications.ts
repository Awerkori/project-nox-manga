import { executeYugabyteSql } from '$lib/server/yugabyte';
import { privileged } from '$lib/server/db';
import { generateEmailHtml } from '$lib/server/email-templates';
import { processPendingEmailOutbox } from '$lib/server/notifications';

export type ScanNotificationType =
  | 'MENTION'
  | 'ROLE_MENTION'
  | 'REPLY_CHAT'
  | 'REPLY_COMMENT'
  | 'TASK_ASSIGNED'
  | 'STAGE_READY'
  | 'QC_ISSUE'
  | 'APPLICATION'
  | 'APPLICATION_UPDATE'
  | 'SYSTEM';

export interface ScanNotificationParams {
  recipientUserId: string;
  actorUserId?: string | null;
  type: ScanNotificationType;
  title: string;
  body: string;
  deepLink: string;
  scanId: string;
  context?: string;
  priority?: 'URGENT' | 'NORMAL' | 'INFO';
  dedupeKey: string;
  skipEmail?: boolean;
  platform?: any;
}

type Contact = { email: string | null; name: string };
const contactCache = new Map<string, { value: Contact; expires: number }>();

async function resolveContact(userId: string, platformEnv?: any): Promise<Contact> {
  const cached = contactCache.get(userId);
  if (cached && cached.expires > Date.now()) return cached.value;
  const member = await executeYugabyteSql<{ display_name: string | null; username: string | null }>(
    'SELECT display_name, username FROM public.members WHERE id = $1 LIMIT 1',
    [userId],
    platformEnv
  );
  const name = member.rows[0]?.display_name || member.rows[0]?.username || 'Membro';
  let email: string | null;
  // Auth remains the identity provider; it is not used for Scan CRUD.
  try {
    const auth = await privileged().auth.admin.getUserById(userId);
    email = auth.data.user?.email || null;
  } catch {
    email = null;
  }
  const value = { email, name };
  contactCache.set(userId, { value, expires: Date.now() + 15 * 60_000 });
  return value;
}

/**
 * Authoritative Scan notification write.  The durable row and dedupe key are
 * committed by one YSQL function; Realtime clients only observe the result.
 */
export async function createScanNotification(params: ScanNotificationParams) {
  const platformEnv = params.platform?.env;
  const scanType = (['MENTION', 'ROLE_MENTION', 'TASK_ASSIGNED', 'STAGE_READY', 'QC_ISSUE', 'APPLICATION', 'SYSTEM'] as string[]).includes(params.type)
    ? params.type
    : 'SYSTEM';
  const result = await executeYugabyteSql<{ result: any }>(
    `SELECT public.create_scan_notification_ysql($1,$2,$3,$4,$5,$6,$7,$8) AS result`,
    [
      params.scanId,
      params.recipientUserId,
      params.actorUserId || null,
      scanType,
      params.title,
      params.body,
      params.deepLink,
      params.dedupeKey
    ],
    platformEnv
  );
  const notification = result.rows[0]?.result;
  if (!notification?.notification_id) return { notificationId: null, emailQueued: false, deduped: !!notification?.idempotent };

  let emailQueued = false;
  let outboxId: string | undefined;
  if (!params.skipEmail) {
    const recipient = await resolveContact(params.recipientUserId, platformEnv);
    if (recipient.email) {
      const actor = params.actorUserId ? await resolveContact(params.actorUserId, platformEnv) : null;
      const { subject, html } = generateEmailHtml({
        type: params.type,
        title: params.title,
        body: params.body,
        deepLink: params.deepLink,
        context: params.context || null,
        recipientName: recipient.name,
        actorName: actor?.name
      });
      const priority = ['MENTION', 'ROLE_MENTION', 'TASK_ASSIGNED', 'STAGE_READY', 'QC_ISSUE'].includes(params.type)
        ? 'HIGH'
        : params.priority || 'NORMAL';
      const queued = await executeYugabyteSql<{ id: string }>(
        `INSERT INTO public.scan_email_outbox_ysql
          (scan_id, recipient_user_id, recipient_email, subject, html_body, priority, idempotency_key)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (idempotency_key) DO NOTHING
         RETURNING id`,
        [params.scanId, params.recipientUserId, recipient.email, subject, html, priority, `email:${notification.notification_id}`],
        platformEnv
      );
      outboxId = queued.rows[0]?.id;
      emailQueued = !!outboxId;
      if (emailQueued) {
        const dispatch = processPendingEmailOutbox(10, outboxId, platformEnv).catch((error) => {
          console.error('[SCAN_OUTBOX] dispatch failed', { message: String(error?.message || error).slice(0, 200) });
        });
        if (params.platform?.context?.waitUntil) params.platform.context.waitUntil(dispatch);
        else await dispatch;
      }
    }
  }
  return { notificationId: notification.notification_id, emailQueued, outboxId };
}
