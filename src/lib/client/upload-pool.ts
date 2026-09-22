import type { UnpackedPage } from './chapter-unpack';

export interface UploadPoolOptions {
  sessionId: string;
  concurrency?: number;
  onPageStatusChange: (page: UnpackedPage) => void;
  onOverallProgress: (stats: {
    total: number;
    completed: number;
    failed: number;
    percentage: number;
    speedMBs: number;
    etaSeconds: number;
  }) => void;
}

export class UploadPool {
  private sessionId: string;
  private concurrency: number;
  private pages: UnpackedPage[];
  private onPageStatusChange: (page: UnpackedPage) => void;
  private onOverallProgress: (stats: any) => void;
  private aborted = false;
  private running = false;
  private activeCount = 0;
  private queue: UnpackedPage[] = [];

  // Speed and ETA calculation
  private uploadedBytes = 0;
  private totalBytes = 0;
  private startTime = 0;
  private speedWindow: { time: number; bytes: number }[] = [];

  constructor(pages: UnpackedPage[], options: UploadPoolOptions) {
    this.pages = pages;
    this.sessionId = options.sessionId;
    this.concurrency = Math.min(10, Math.max(2, options.concurrency || 6));
    this.onPageStatusChange = options.onPageStatusChange;
    this.onOverallProgress = options.onOverallProgress;
    this.totalBytes = pages.reduce((acc, p) => acc + p.size, 0);
  }

  public async start(): Promise<boolean> {
    this.aborted = false;
    this.running = true;
    this.startTime = Date.now();
    this.uploadedBytes = this.pages
      .filter((p) => p.status === 'STORED')
      .reduce((acc, p) => acc + p.size, 0);

    // Filter pages that need uploading
    this.queue = this.pages.filter((p) => p.status !== 'STORED');

    if (this.queue.length === 0) {
      this.notifyProgress();
      return true;
    }

    return new Promise((resolve) => {
      const checkDone = () => {
        if (this.aborted) {
          this.running = false;
          resolve(false);
          return;
        }

        if (this.queue.length === 0 && this.activeCount === 0) {
          this.running = false;
          const allStored = this.pages.every((p) => p.status === 'STORED');
          resolve(allStored);
          return;
        }

        while (this.activeCount < this.concurrency && this.queue.length > 0 && !this.aborted) {
          const next = this.queue.shift();
          if (!next) break;
          this.activeCount++;
          this.uploadSinglePage(next).finally(() => {
            this.activeCount--;
            checkDone();
          });
        }
      };

      checkDone();
    });
  }

  public abort() {
    this.aborted = true;
    this.running = false;
    this.queue = [];
  }

  public retryFailed(): Promise<boolean> {
    // Reset failed pages back to IDLE
    for (const p of this.pages) {
      if (p.status === 'FAILED') {
        p.status = 'IDLE';
        p.error = undefined;
        p.progress = 0;
        this.onPageStatusChange(p);
      }
    }
    return this.start();
  }

  private async uploadSinglePage(page: UnpackedPage): Promise<void> {
    page.status = 'UPLOADING';
    page.progress = 10;
    this.onPageStatusChange(page);

    const t0 = performance.now();

    try {
      // Build form data
      const fd = new FormData();
      fd.append('pageIndex', String(page.index));
      const blob = new Blob([page.bytes as unknown as BlobPart], { type: page.mimeType });
      fd.append('file', blob, page.filename);

      const res = await fetch(`/api/staff/uploads/${this.sessionId}/pages`, {
        method: 'POST',
        body: fd
      });

      if (!res.ok) {
        if (res.status === 429) {
          const retryHeader = res.headers.get('Retry-After');
          const waitSec = retryHeader ? parseInt(retryHeader, 10) : 5;
          await new Promise((r) => setTimeout(r, waitSec * 1000));
          // Re-queue
          this.queue.unshift(page);
          page.status = 'IDLE';
          this.onPageStatusChange(page);
          return;
        }
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || errJson.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      const stored = data.stored?.[0];

      page.status = 'STORED';
      page.progress = 100;
      page.mediaId = stored?.mediaId;
      page.telegramFileId = stored?.telegramFileId;
      page.error = undefined;

      const t1 = performance.now();
      const durationSec = Math.max(0.01, (t1 - t0) / 1000);
      page.speedMBs = page.size / (1024 * 1024) / durationSec;

      this.uploadedBytes += page.size;
      this.recordSpeedSample(page.size);
      this.onPageStatusChange(page);
      this.notifyProgress();
    } catch (err: any) {
      page.status = 'FAILED';
      page.error = err.message || 'Erro ao enviar página';
      this.onPageStatusChange(page);
      this.notifyProgress();
    }
  }

  private recordSpeedSample(bytes: number) {
    const now = Date.now();
    this.speedWindow.push({ time: now, bytes });
    // Keep last 5 seconds of samples
    this.speedWindow = this.speedWindow.filter((s) => now - s.time < 5000);
  }

  private calculateSpeedMBs(): number {
    const now = Date.now();
    const recent = this.speedWindow.filter((s) => now - s.time < 5000);
    if (recent.length === 0) return 0;
    const totalRecentBytes = recent.reduce((acc, s) => acc + s.bytes, 0);
    const timeSpan = Math.max(0.5, (now - recent[0].time) / 1000);
    return totalRecentBytes / (1024 * 1024) / timeSpan;
  }

  private notifyProgress() {
    const total = this.pages.length;
    const completed = this.pages.filter((p) => p.status === 'STORED').length;
    const failed = this.pages.filter((p) => p.status === 'FAILED').length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    const speedMBs = this.calculateSpeedMBs();

    const remainingBytes = Math.max(0, this.totalBytes - this.uploadedBytes);
    let etaSeconds = 0;
    if (speedMBs > 0 && remainingBytes > 0) {
      etaSeconds = Math.round(remainingBytes / (speedMBs * 1024 * 1024));
    }

    this.onOverallProgress({
      total,
      completed,
      failed,
      percentage,
      speedMBs: parseFloat(speedMBs.toFixed(2)),
      etaSeconds
    });
  }
}
