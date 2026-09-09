import { describe, it, expect, vi } from 'vitest';
import { flushUploads } from '../src/lib/upload-queue';

describe('Staff Upload Pipeline Benchmark', () => {
  const SIZES = [1, 5, 10, 12, 25, 30];
  const PAGE_SIZE_BYTES = 600 * 1024; // 600 KB realistic average WebP page
  const NETWORK_LATENCY_MS = 120; // 120ms network RTT

  async function runBatchBenchmark(pageCount: number, concurrency: number) {
    const files = Array.from({ length: pageCount }, (_, i) =>
      new File([new Uint8Array(PAGE_SIZE_BYTES)], `page_${i + 1}.webp`, { type: 'image/webp' })
    );

    const pending = [...files];
    const accepted = vi.fn();
    let totalRetries = 0;
    let rateLimitCount = 0;

    const send = async (file: File) => {
      // Simulate realistic upload time (latency + stream)
      await new Promise((r) => setTimeout(r, NETWORK_LATENCY_MS));
      return `media_${file.name}`;
    };

    const startTime = Date.now();
    await flushUploads(pending, send, accepted, () => false, {
      concurrency,
      basePaceMs: 20
    });
    const totalMs = Math.max(1, Date.now() - startTime);

    const totalMB = (pageCount * PAGE_SIZE_BYTES) / (1024 * 1024);
    const pagesPerMin = Math.round((pageCount / (totalMs / 1000)) * 60);
    const mbPerMin = Number(((totalMB / (totalMs / 1000)) * 60).toFixed(2));
    const avgSecPerPage = Number((totalMs / 1000 / pageCount).toFixed(3));

    return {
      pages: pageCount,
      concurrency,
      totalMs,
      pagesPerMin,
      mbPerMin,
      avgSecPerPage,
      retries: totalRetries,
      rateLimits: rateLimitCount
    };
  }

  for (const size of SIZES) {
    it(`benchmarks ${size} page(s) comparing legacy concurrency 1 vs modern concurrency 2`, async () => {
      const serial = await runBatchBenchmark(size, 1);
      const concurrent = await runBatchBenchmark(size, 2);

      if (size > 1) {
        expect(concurrent.totalMs).toBeLessThan(serial.totalMs);
        expect(concurrent.pagesPerMin).toBeGreaterThan(serial.pagesPerMin);
      }
    }, 15000);
  }

    it('benchmarks a full 30-page ZIP equivalent batch', async () => {
    const zipResult = await runBatchBenchmark(30, 2);
    console.log('[BENCHMARK RESULT 30P ZIP]:', JSON.stringify(zipResult));
    expect(zipResult.pages).toBe(30);
    expect(zipResult.pagesPerMin).toBeGreaterThan(150);
  }, 15000);
});
