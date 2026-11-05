import { describe, it, expect, vi } from 'vitest';
import * as processExpiredStages from '../src/routes/api/internal/cron/process-expired-stages/+server';
import * as sendDeadlineWarnings from '../src/routes/api/internal/cron/send-deadline-warnings/+server';

describe('Cron Autonomous Invocation & Security Suite', () => {
  it('rejects unauthenticated requests with 401', async () => {
    const unauthReq = new Request('https://projectnox.org/api/internal/cron/process-expired-stages', {
      method: 'GET'
    });

    try {
      await processExpiredStages.GET({
        request: unauthReq,
        locals: {} as any,
        platform: {} as any,
        params: {} as any,
        url: new URL(unauthReq.url),
        route: { id: '/api/internal/cron/process-expired-stages' },
        cookies: {} as any,
        fetch: vi.fn(),
        setHeaders: vi.fn(),
        getClientAddress: () => '127.0.0.1',
        isDataRequest: false
      });
      expect.fail('Should have thrown 401');
    } catch (err: any) {
      expect(err?.status).toBe(401);
    }
  });

  it('rejects spoofed x-internal-cron header without scheduledInvocation or token', async () => {
    const spoofReq = new Request('https://projectnox.org/api/internal/cron/process-expired-stages', {
      method: 'POST',
      headers: { 'x-internal-cron': 'true' }
    });

    try {
      await processExpiredStages.POST({
        request: spoofReq,
        locals: {} as any,
        platform: { env: { NOX_STORAGE_BRIDGE_TOKEN: 'secret_bridge_token' } } as any,
        params: {} as any,
        url: new URL(spoofReq.url),
        route: { id: '/api/internal/cron/process-expired-stages' },
        cookies: {} as any,
        fetch: vi.fn(),
        setHeaders: vi.fn(),
        getClientAddress: () => '127.0.0.1',
        isDataRequest: false
      });
      expect.fail('Should have thrown 401');
    } catch (err: any) {
      expect(err?.status).toBe(401);
    }
  });

  it('rejects non-admin staff roles (least privilege enforcement)', async () => {
    const staffReq = new Request('https://projectnox.org/api/internal/cron/process-expired-stages', {
      method: 'POST'
    });

    try {
      await processExpiredStages.POST({
        request: staffReq,
        locals: { user: { id: 'some-user-uuid' }, role: 'EDITOR' } as any,
        platform: {} as any,
        params: {} as any,
        url: new URL(staffReq.url),
        route: { id: '/api/internal/cron/process-expired-stages' },
        cookies: {} as any,
        fetch: vi.fn(),
        setHeaders: vi.fn(),
        getClientAddress: () => '127.0.0.1',
        isDataRequest: false
      });
      expect.fail('Should have thrown 401');
    } catch (err: any) {
      expect(err?.status).toBe(401);
    }
  });

  it('allows native scheduled invocation with platform.scheduledInvocation = true', async () => {
    const scheduledReq = new Request('https://home-preview-manga.project-nox-awerkori.workers.dev/api/internal/cron/process-expired-stages', {
      method: 'GET'
    });

    const res = await processExpiredStages.GET({
      request: scheduledReq,
      locals: {} as any,
      platform: {
        scheduledInvocation: true,
        env: { NOX_ENVIRONMENT: 'preview', PREVIEW_ISOLATED: 'true' }
      } as any,
      params: {} as any,
      url: new URL(scheduledReq.url),
      route: { id: '/api/internal/cron/process-expired-stages' },
      cookies: {} as any,
      fetch: vi.fn(),
      setHeaders: vi.fn(),
      getClientAddress: () => '127.0.0.1',
      isDataRequest: false
    });

    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.environment).toBe('preview_isolated');
    expect(json.onlyTestChapters).toBe(true);
    expect(json.readOnly).toBe(true);
  });

  it('send-deadline-warnings rejects unauthenticated requests with 401', async () => {
    const unauthReq = new Request('https://projectnox.org/api/internal/cron/send-deadline-warnings', {
      method: 'GET'
    });

    try {
      await sendDeadlineWarnings.GET({
        request: unauthReq,
        locals: {} as any,
        platform: {} as any,
        params: {} as any,
        url: new URL(unauthReq.url),
        route: { id: '/api/internal/cron/send-deadline-warnings' },
        cookies: {} as any,
        fetch: vi.fn(),
        setHeaders: vi.fn(),
        getClientAddress: () => '127.0.0.1',
        isDataRequest: false
      });
      expect.fail('Should have thrown 401');
    } catch (err: any) {
      expect(err?.status).toBe(401);
    }
  });

  it('send-deadline-warnings allows native scheduled invocation and enforces preview isolation', async () => {
    const scheduledReq = new Request('https://home-preview-manga.project-nox-awerkori.workers.dev/api/internal/cron/send-deadline-warnings', {
      method: 'GET'
    });

    const res = await sendDeadlineWarnings.GET({
      request: scheduledReq,
      locals: {} as any,
      platform: {
        scheduledInvocation: true,
        env: { NOX_ENVIRONMENT: 'preview', PREVIEW_ISOLATED: 'true' }
      } as any,
      params: {} as any,
      url: new URL(scheduledReq.url),
      route: { id: '/api/internal/cron/send-deadline-warnings' },
      cookies: {} as any,
      fetch: vi.fn(),
      setHeaders: vi.fn(),
      getClientAddress: () => '127.0.0.1',
      isDataRequest: false
    });

    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.environment).toBe('preview_isolated');
    expect(json.onlyTestChapters).toBe(true);
  });
});
