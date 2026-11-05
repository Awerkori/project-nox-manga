import { describe, it, expect, vi } from 'vitest';
import { actions } from '../src/routes/scan/+page.server';

vi.mock('$lib/server/yugabyte', () => ({
  executeYugabyteSql: vi.fn(),
  fetchRecentReleaseTimelineFromYugabyte: vi.fn().mockResolvedValue([])
}));

import { executeYugabyteSql } from '$lib/server/yugabyte';

describe('Strict Stage Extension Permissions Suite (Defense-in-Depth)', () => {
  const stageId = 'd0000000-0000-4000-8000-000000000001';
  const thiagoId = 'e0000000-0000-4000-8000-000000000001';
  const awerkoriId = 'e0000000-0000-4000-8000-000000000002';
  const globalAdminId = 'e0000000-0000-4000-8000-000000000003';

  it('rejects unauthenticated requests with 401', async () => {
    const formData = new FormData();
    formData.set('chapter_stage_id', stageId);
    const req = new Request('https://projectnox.org/scan?/extendStageDeadline', {
      method: 'POST',
      body: formData
    });

    const res: any = await actions.extendStageDeadline({
      request: req,
      locals: {} as any,
      platform: {} as any,
      params: {} as any,
      url: new URL(req.url),
      route: { id: '/scan' },
      cookies: {} as any,
      fetch: vi.fn(),
      setHeaders: vi.fn(),
      getClientAddress: () => '127.0.0.1',
      isDataRequest: false
    });

    expect(res.status).toBe(401);
    expect(res.data.message).toBe('Não autenticado');
  });

  it('rejects Scan OWNER/ADMIN (Awerkori) when Thiago is assignee with HTTP 403', async () => {
    // Mock stage query returning Thiago as assignee
    vi.mocked(executeYugabyteSql).mockResolvedValueOnce({
      rows: [{ assigned_to: thiagoId, status: 'IN_PROGRESS', due_at: new Date(Date.now() + 3600000).toISOString() }]
    } as any);

    const formData = new FormData();
    formData.set('chapter_stage_id', stageId);
    const req = new Request('https://projectnox.org/scan?/extendStageDeadline', {
      method: 'POST',
      body: formData
    });

    const res: any = await actions.extendStageDeadline({
      request: req,
      locals: {
        user: { id: awerkoriId },
        role: 'ADMIN' // Global / Scan Admin
      } as any,
      platform: {} as any,
      params: {} as any,
      url: new URL(req.url),
      route: { id: '/scan' },
      cookies: {} as any,
      fetch: vi.fn(),
      setHeaders: vi.fn(),
      getClientAddress: () => '127.0.0.1',
      isDataRequest: false
    });

    expect(res.status).toBe(403);
    expect(res.data.message).toBe('Apenas o responsável atual pode prorrogar o prazo desta etapa.');
  });

  it('rejects Global Admin when Thiago is assignee with HTTP 403', async () => {
    vi.mocked(executeYugabyteSql).mockResolvedValueOnce({
      rows: [{ assigned_to: thiagoId, status: 'IN_PROGRESS', due_at: new Date(Date.now() + 3600000).toISOString() }]
    } as any);

    const formData = new FormData();
    formData.set('chapter_stage_id', stageId);
    const req = new Request('https://projectnox.org/scan?/extendStageDeadline', {
      method: 'POST',
      body: formData
    });

    const res: any = await actions.extendStageDeadline({
      request: req,
      locals: {
        user: { id: globalAdminId },
        role: 'ADMIN'
      } as any,
      platform: {} as any,
      params: {} as any,
      url: new URL(req.url),
      route: { id: '/scan' },
      cookies: {} as any,
      fetch: vi.fn(),
      setHeaders: vi.fn(),
      getClientAddress: () => '127.0.0.1',
      isDataRequest: false
    });

    expect(res.status).toBe(403);
    expect(res.data.message).toBe('Apenas o responsável atual pode prorrogar o prazo desta etapa.');
  });

  it('allows legitimate assignee (Thiago) to extend own stage', async () => {
    vi.mocked(executeYugabyteSql)
      // 1. Stage pre-flight query
      .mockResolvedValueOnce({
        rows: [{ assigned_to: thiagoId, status: 'IN_PROGRESS', due_at: new Date(Date.now() + 3600000).toISOString() }]
      } as any)
      // 2. Procedure call
      .mockResolvedValueOnce({
        rows: [{ result: { success: true, extension_count: 1, new_due_at: '2026-11-07T23:59:59-03:00' } }]
      } as any);

    const formData = new FormData();
    formData.set('chapter_stage_id', stageId);
    const req = new Request('https://projectnox.org/scan?/extendStageDeadline', {
      method: 'POST',
      body: formData
    });

    const res: any = await actions.extendStageDeadline({
      request: req,
      locals: {
        user: { id: thiagoId },
        role: 'MEMBER'
      } as any,
      platform: {} as any,
      params: {} as any,
      url: new URL(req.url),
      route: { id: '/scan' },
      cookies: {} as any,
      fetch: vi.fn(),
      setHeaders: vi.fn(),
      getClientAddress: () => '127.0.0.1',
      isDataRequest: false
    });

    expect(res.success).toBe(true);
    expect(res.extended.extension_count).toBe(1);
  });

  it('rejects third-party member (non-assignee, non-admin) with HTTP 403 (Case D)', async () => {
    vi.mocked(executeYugabyteSql).mockResolvedValueOnce({
      rows: [{ assigned_to: thiagoId, status: 'IN_PROGRESS', due_at: new Date(Date.now() + 3600000).toISOString() }]
    } as any);

    const thirdPartyId = 'e0000000-0000-4000-8000-000000000099';
    const formData = new FormData();
    formData.set('chapter_stage_id', stageId);
    const req = new Request('https://projectnox.org/scan?/extendStageDeadline', {
      method: 'POST',
      body: formData
    });

    const res: any = await actions.extendStageDeadline({
      request: req,
      locals: {
        user: { id: thirdPartyId },
        role: 'MEMBER'
      } as any,
      platform: {} as any,
      params: {} as any,
      url: new URL(req.url),
      route: { id: '/scan' },
      cookies: {} as any,
      fetch: vi.fn(),
      setHeaders: vi.fn(),
      getClientAddress: () => '127.0.0.1',
      isDataRequest: false
    });

    expect(res.status).toBe(403);
    expect(res.data.message).toBe('Apenas o responsável atual pode prorrogar o prazo desta etapa.');
  });

  it('allows Awerkori (admin) to extend their own assigned stage (Case E)', async () => {
    vi.mocked(executeYugabyteSql)
      .mockResolvedValueOnce({
        rows: [{ assigned_to: awerkoriId, status: 'IN_PROGRESS', due_at: new Date(Date.now() + 3600000).toISOString() }]
      } as any)
      .mockResolvedValueOnce({
        rows: [{ result: { success: true, extension_count: 1, new_due_at: '2026-11-09T23:59:59-03:00' } }]
      } as any);

    const formData = new FormData();
    formData.set('chapter_stage_id', stageId);
    const req = new Request('https://projectnox.org/scan?/extendStageDeadline', {
      method: 'POST',
      body: formData
    });

    const res: any = await actions.extendStageDeadline({
      request: req,
      locals: {
        user: { id: awerkoriId },
        role: 'ADMIN'
      } as any,
      platform: {} as any,
      params: {} as any,
      url: new URL(req.url),
      route: { id: '/scan' },
      cookies: {} as any,
      fetch: vi.fn(),
      setHeaders: vi.fn(),
      getClientAddress: () => '127.0.0.1',
      isDataRequest: false
    });

    expect(res.success).toBe(true);
    expect(res.extended.extension_count).toBe(1);
  });

  it('rejects second extension attempt with HTTP 400 (Case G)', async () => {
    vi.mocked(executeYugabyteSql)
      .mockResolvedValueOnce({
        rows: [{ assigned_to: thiagoId, status: 'IN_PROGRESS', due_at: new Date(Date.now() + 3600000).toISOString() }]
      } as any)
      .mockRejectedValueOnce(new Error('EXTENSION_ALREADY_USED'));

    const formData = new FormData();
    formData.set('chapter_stage_id', stageId);
    const req = new Request('https://projectnox.org/scan?/extendStageDeadline', {
      method: 'POST',
      body: formData
    });

    const res: any = await actions.extendStageDeadline({
      request: req,
      locals: {
        user: { id: thiagoId },
        role: 'MEMBER'
      } as any,
      platform: {} as any,
      params: {} as any,
      url: new URL(req.url),
      route: { id: '/scan' },
      cookies: {} as any,
      fetch: vi.fn(),
      setHeaders: vi.fn(),
      getClientAddress: () => '127.0.0.1',
      isDataRequest: false
    });

    expect(res.status).toBe(400);
    expect(res.data.message).toBe('A prorrogação automática de 2 dias já foi utilizada nesta atribuição.');
  });

  it('returns HTTP 400 when deadline has already expired', async () => {
    vi.mocked(executeYugabyteSql)
      .mockResolvedValueOnce({
        rows: [{ assigned_to: thiagoId, status: 'IN_PROGRESS', due_at: new Date(Date.now() - 3600000).toISOString() }]
      } as any)
      .mockRejectedValueOnce(new Error('DEADLINE_ALREADY_EXPIRED'));

    const formData = new FormData();
    formData.set('chapter_stage_id', stageId);
    const req = new Request('https://projectnox.org/scan?/extendStageDeadline', {
      method: 'POST',
      body: formData
    });

    const res: any = await actions.extendStageDeadline({
      request: req,
      locals: {
        user: { id: thiagoId },
        role: 'MEMBER'
      } as any,
      platform: {} as any,
      params: {} as any,
      url: new URL(req.url),
      route: { id: '/scan' },
      cookies: {} as any,
      fetch: vi.fn(),
      setHeaders: vi.fn(),
      getClientAddress: () => '127.0.0.1',
      isDataRequest: false
    });

    expect(res.status).toBe(400);
    expect(res.data.message).toBe('O prazo desta etapa já expirou e não pode mais ser prorrogado.');
  });
});
