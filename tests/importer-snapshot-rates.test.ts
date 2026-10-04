import { describe, expect, it } from 'vitest';
import { calculatePublicationRateTelemetry } from '../src/lib/server/importer-snapshot';

describe('importer snapshot publication rates', () => {
  const now = Date.parse('2026-10-04T12:00:00.000Z');

  it('counts only publication buckets in cap/min windows', () => {
    const rates = calculatePublicationRateTelemetry([
      {
        bucket_minute: '2026-10-04T11:59:30.000Z',
        visible_published: 2,
        fresh_visible: 2,
        completed_jobs: 3,
      },
      {
        bucket_minute: '2026-10-04T11:56:00.000Z',
        visible_published: 3,
        fresh_visible: 3,
        completed_jobs: 4,
      },
      {
        bucket_minute: '2026-10-04T11:20:00.000Z',
        visible_published: 99,
        fresh_visible: 99,
        completed_jobs: 99,
      },
    ], now);

    expect(rates.rate1m).toBe(2);
    expect(rates.rate5m).toBe(1);
    expect(rates.rate10m).toBe(0.5);
    expect(rates.rate30m).toBe(0.2);
    expect(rates.completed5m).toBe(7);
    expect(rates.completed30m).toBe(7);
  });

  it('stays at zero during a heartbeat-only stall', () => {
    const rates = calculatePublicationRateTelemetry([], now);
    expect(rates.rate1m).toBe(0);
    expect(rates.rate5m).toBe(0);
    expect(rates.rate30m).toBe(0);
    expect(rates.completed5m).toBe(0);
  });
});
