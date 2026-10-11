import { describe, expect, it } from 'vitest';
import { calculatePublicationRateTelemetry } from '../src/lib/server/importer-snapshot';

describe('canonical importer publication telemetry', () => {
  const now = Date.parse('2026-10-05T02:00:00.000Z');

  it('uses visible_published for every canonical window, not fresh_visible', () => {
    const rates = calculatePublicationRateTelemetry([
      {
        bucket_minute: '2026-10-05T01:59:00.000Z',
        latest_published_at: '2026-10-05T01:59:48.000Z',
        visible_published: 2,
        fresh_visible: 0,
        completed_jobs: 4,
      },
      {
        bucket_minute: '2026-10-05T01:56:00.000Z',
        latest_published_at: '2026-10-05T01:56:12.000Z',
        visible_published: 3,
        fresh_visible: 1,
        completed_jobs: 5,
      },
    ], now);

    expect(rates.rate1m).toBe(2);
    expect(rates.rate5m).toBe(1);
    expect(rates.rate10m).toBe(0.5);
    expect(rates.visible5m).toBe(5);
    expect(rates.fresh5m).toBe(1);
    expect(rates.completed5m).toBe(9);
    expect(rates.latestPublishedAt).toBe('2026-10-05T01:59:48.000Z');
  });

  it('does not count heartbeat/lease/pipeline-only rows as publication', () => {
    const rates = calculatePublicationRateTelemetry([
      {
        bucket_minute: '2026-10-05T01:59:00.000Z',
        visible_published: 0,
        fresh_visible: 0,
        completed_jobs: 8,
      },
    ], now);

    expect(rates.rate1m).toBe(0);
    expect(rates.rate5m).toBe(0);
    expect(rates.completed5m).toBe(8);
    expect(rates.latestPublishedAt).toBeNull();
  });

  it('keeps minute buckets independent across the 60-minute chart window', () => {
    const rates = calculatePublicationRateTelemetry([
      {
        bucket_minute: '2026-10-05T01:30:00.000Z',
        latest_published_at: '2026-10-05T01:30:59.000Z',
        visible_published: 4,
        fresh_visible: 4,
        completed_jobs: 4,
      },
      {
        bucket_minute: '2026-10-05T00:59:00.000Z',
        latest_published_at: '2026-10-05T00:59:59.000Z',
        visible_published: 99,
        fresh_visible: 99,
        completed_jobs: 99,
      },
    ], now);

    expect(rates.rate30m).toBe(0.1);
    expect(rates.rate5m).toBe(0);
    expect(rates.latestPublishedAt).toBe('2026-10-05T01:30:59.000Z');
  });
});
