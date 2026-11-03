import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  sendBrevoEmail: vi.fn(),
  queryBrevoEvents: vi.fn(),
  executeYugabyteSql: vi.fn()
}));

vi.mock('$lib/server/brevo', () => ({
  sendBrevoEmail: mocks.sendBrevoEmail,
  queryBrevoEvents: mocks.queryBrevoEvents
}));

vi.mock('$lib/server/yugabyte', () => ({
  executeYugabyteSql: mocks.executeYugabyteSql
}));

import {
  runScheduledEmailOutboxProcessing,
  scheduleEmailOutboxProcessing
} from '$lib/server/email-outbox-cron';

describe('scheduled email outbox with a controlled local store', () => {
  beforeEach(() => {
    mocks.sendBrevoEmail.mockReset();
    mocks.queryBrevoEvents.mockReset();
    mocks.executeYugabyteSql.mockReset();
  });

  it('moves a controlled PENDING item to SENT and reconciles an uncertain item in one bounded cron round', async () => {
    const records: Record<string, Record<string, unknown>> = {
      pending: {
        id: 'pending',
        recipient_email: 'member@example.test',
        subject: 'Controlled pending message',
        html_body: '<p>body</p>',
        priority: 'NORMAL',
        attempts: 0,
        status: 'PENDING',
        delivery_status: 'QUEUED'
      },
      uncertain: {
        id: 'uncertain',
        recipient_email: 'member@example.test',
        subject: 'Uncertain message',
        send_started_at: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
        status: 'PENDING',
        delivery_status: 'DELIVERY_UNCERTAIN'
      }
    };

    mocks.executeYugabyteSql.mockImplementation(async (sql: string, params: any[]) => {
      if (sql.includes('claim_scan_email_outbox_ysql')) {
        return { rows: [records.pending] };
      }
      if (sql.includes('claim_uncertain_scan_email_outbox_ysql')) {
        return { rows: [records.uncertain] };
      }
      if (sql.includes('UPDATE public.scan_email_outbox_ysql')) {
        if (sql.includes("status='SENT'")) {
          records.pending.status = 'SENT';
          records.pending.delivery_status = 'ACCEPTED';
          records.pending.provider_message_id = params[1];
        } else if (sql.includes("delivery_status='RECONCILED_RETRY'")) {
          records.uncertain.status = 'PENDING';
          records.uncertain.delivery_status = 'RECONCILED_RETRY';
        }
        return { rows: [] };
      }
      return { rows: [] };
    });

    mocks.sendBrevoEmail.mockResolvedValue({ success: true, status: 201, messageId: 'brevo-controlled-id' });
    mocks.queryBrevoEvents.mockResolvedValue([]);

    const waitUntil: Promise<unknown>[] = [];
    let result: Awaited<ReturnType<typeof runScheduledEmailOutboxProcessing>> | undefined;
    scheduleEmailOutboxProcessing(
      { waitUntil: (promise) => waitUntil.push(promise) },
      async () => {
        result = await runScheduledEmailOutboxProcessing();
        return result;
      }
    );
    await expect(waitUntil[0]).resolves.toBeUndefined();

    expect(result).toMatchObject({
      processed: 1,
      sent: 1,
      failed: 0,
      reconciliation: { reconciled: 0, retried: 1, waiting: 0 }
    });
    expect(records.pending).toMatchObject({
      status: 'SENT',
      delivery_status: 'ACCEPTED',
      provider_message_id: 'brevo-controlled-id'
    });
    expect(records.uncertain).toMatchObject({
      status: 'PENDING',
      delivery_status: 'RECONCILED_RETRY'
    });
    expect(mocks.sendBrevoEmail).toHaveBeenCalledOnce();
  });
});
