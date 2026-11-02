import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  privileged: vi.fn(),
  sendBrevoEmail: vi.fn(),
  queryBrevoEvents: vi.fn()
}));

vi.mock('$lib/server/db', () => ({ privileged: mocks.privileged }));
vi.mock('$lib/server/brevo', () => ({
  sendBrevoEmail: mocks.sendBrevoEmail,
  queryBrevoEvents: mocks.queryBrevoEvents
}));

import {
  runScheduledEmailOutboxProcessing,
  scheduleEmailOutboxProcessing
} from '$lib/server/email-outbox-cron';

describe('scheduled email outbox with a controlled local store', () => {
  beforeEach(() => {
    mocks.privileged.mockReset();
    mocks.sendBrevoEmail.mockReset();
    mocks.queryBrevoEvents.mockReset();
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

    const db = {
      rpc: vi.fn(async (name: string) => {
        if (name === 'claim_scan_email_outbox_batch') return { data: [records.pending], error: null };
        if (name === 'claim_uncertain_email_outbox_batch') return { data: [records.uncertain], error: null };
        if (name === 'get_scan_email_outbox_metrics') return { data: { queue_stalled: false }, error: null };
        throw new Error('Unexpected RPC ' + name);
      }),
      from: vi.fn(() => ({
        update: (patch: Record<string, unknown>) => ({
          eq: (_column: string, id: string) => {
            Object.assign(records[id], patch);
            return Promise.resolve({ data: null, error: null });
          }
        })
      }))
    };

    mocks.privileged.mockReturnValue(db);
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
    expect(mocks.queryBrevoEvents).toHaveBeenCalledOnce();
    expect(db.rpc).toHaveBeenCalledWith(
      'claim_scan_email_outbox_batch',
      expect.objectContaining({ p_limit: 25 })
    );
  });
});
