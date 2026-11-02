import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('24/7 External Importer Watchdog Specification & Logic', () => {
  const DEAD_THRESHOLD_SECONDS = 180; // 3 minutes

  function evaluateWatchdogState(params: {
    now: number;
    heartbeatTimestamp: string | null;
    lastRestartTimestamp: string | null;
    isPost: boolean;
    authorized: boolean;
  }) {
    if (params.isPost && !params.authorized) {
      return { status: 401, error: 'Unauthorized' };
    }

    const hbTime = params.heartbeatTimestamp ? Date.parse(params.heartbeatTimestamp) : 0;
    const ageSeconds = hbTime > 0 ? Math.max(0, Math.floor((params.now - hbTime) / 1000)) : 999999;

    const rtTime = params.lastRestartTimestamp ? Date.parse(params.lastRestartTimestamp) : 0;
    const secondsSinceLastRestart = rtTime > 0 ? Math.max(0, Math.floor((params.now - rtTime) / 1000)) : 999999;

    const isDead = ageSeconds > DEAD_THRESHOLD_SECONDS;
    const isCooldown = secondsSinceLastRestart < DEAD_THRESHOLD_SECONDS;

    if (!isDead) {
      return {
        status: 200,
        watchdogStatus: 'HEALTHY',
        actionTaken: 'NONE_HEALTHY',
        ageSeconds,
        secondsSinceLastRestart
      };
    }

    if (isCooldown) {
      return {
        status: 200,
        watchdogStatus: 'COOLDOWN',
        actionTaken: 'NONE_COOLDOWN',
        ageSeconds,
        secondsSinceLastRestart
      };
    }

    if (!params.isPost) {
      return {
        status: 200,
        watchdogStatus: 'DEAD',
        actionTaken: 'NONE_READONLY',
        ageSeconds,
        secondsSinceLastRestart
      };
    }

    return {
      status: 200,
      watchdogStatus: 'RESTARTED',
      actionTaken: 'RESTARTED',
      ageSeconds,
      secondsSinceLastRestart
    };
  }

  const now = 1727118000000;

  it('Case 1: Fresh heartbeat within 30s is HEALTHY and takes no action', () => {
    const res = evaluateWatchdogState({
      now,
      heartbeatTimestamp: new Date(now - 30 * 1000).toISOString(),
      lastRestartTimestamp: null,
      isPost: true,
      authorized: true
    });

    expect(res.status).toBe(200);
    expect(res.watchdogStatus).toBe('HEALTHY');
    expect(res.actionTaken).toBe('NONE_HEALTHY');
    expect(res.ageSeconds).toBe(30);
  });

  it('Case 2: Heartbeat at 179s is still HEALTHY', () => {
    const res = evaluateWatchdogState({
      now,
      heartbeatTimestamp: new Date(now - 179 * 1000).toISOString(),
      lastRestartTimestamp: null,
      isPost: true,
      authorized: true
    });

    expect(res.status).toBe(200);
    expect(res.watchdogStatus).toBe('HEALTHY');
    expect(res.actionTaken).toBe('NONE_HEALTHY');
  });

  it('Case 3: Heartbeat at 181s is DEAD and triggers RESTARTED action via POST', () => {
    const res = evaluateWatchdogState({
      now,
      heartbeatTimestamp: new Date(now - 181 * 1000).toISOString(),
      lastRestartTimestamp: null,
      isPost: true,
      authorized: true
    });

    expect(res.status).toBe(200);
    expect(res.watchdogStatus).toBe('RESTARTED');
    expect(res.actionTaken).toBe('RESTARTED');
    expect(res.ageSeconds).toBe(181);
  });

  it('Case 4: Stale heartbeat but container was restarted 60s ago enters COOLDOWN', () => {
    const res = evaluateWatchdogState({
      now,
      heartbeatTimestamp: new Date(now - 300 * 1000).toISOString(),
      lastRestartTimestamp: new Date(now - 60 * 1000).toISOString(),
      isPost: true,
      authorized: true
    });

    expect(res.status).toBe(200);
    expect(res.watchdogStatus).toBe('COOLDOWN');
    expect(res.actionTaken).toBe('NONE_COOLDOWN');
    expect(res.secondsSinceLastRestart).toBe(60);
  });

  it('Case 5: Stale heartbeat with GET request is diagnostic DEAD without restarting', () => {
    const res = evaluateWatchdogState({
      now,
      heartbeatTimestamp: new Date(now - 300 * 1000).toISOString(),
      lastRestartTimestamp: null,
      isPost: false,
      authorized: false
    });

    expect(res.status).toBe(200);
    expect(res.watchdogStatus).toBe('DEAD');
    expect(res.actionTaken).toBe('NONE_READONLY');
  });

  it('Case 6: Unauthorized POST is rejected with 401', () => {
    const res = evaluateWatchdogState({
      now,
      heartbeatTimestamp: new Date(now - 300 * 1000).toISOString(),
      lastRestartTimestamp: null,
      isPost: true,
      authorized: false
    });

    expect(res.status).toBe(401);
    expect(res.error).toBe('Unauthorized');
  });
});
