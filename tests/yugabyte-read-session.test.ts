import { beforeEach, describe, expect, it, vi } from 'vitest';

const clientInstances: Array<{
  connected: boolean;
  ended: boolean;
  queries: string[];
}> = [];
let activeConnected = 0;
let peakConnected = 0;

vi.mock('pg', () => {
  class MockClient {
    connected = false;
    ended = false;
    queries: string[] = [];

    constructor() {
      clientInstances.push(this);
    }

    async connect() {
      await new Promise((r) => setTimeout(r, 2));
      this.connected = true;
      activeConnected += 1;
      if (activeConnected > peakConnected) peakConnected = activeConnected;
    }

    async query(sql: string) {
      await new Promise((r) => setTimeout(r, 1));
      this.queries.push(sql);
      if (sql.includes('FAIL_SOCKET')) {
        throw new Error('socket hang up');
      }
      return { rows: [{ sql }], rowCount: 1 };
    }

    async end() {
      if (this.connected && !this.ended) {
        activeConnected -= 1;
      }
      this.ended = true;
    }
  }
  return { Client: MockClient };
});

import { executeYugabyteSql, withYugabyteReadSession } from '../src/lib/server/yugabyte';

describe('withYugabyteReadSession connection multiplexing', () => {
  beforeEach(() => {
    clientInstances.length = 0;
    activeConnected = 0;
    peakConnected = 0;
  });

  it('caps 25 concurrent executeYugabyteSql reads to at most 2 reused Hyperdrive clients and closes them on completion', async () => {
    const platformEnv = {
      HYPERDRIVE: { connectionString: 'postgres://hyperdrive.local/nox' }
    };

    const results = await withYugabyteReadSession(
      platformEnv,
      async (sessionEnv) => {
        const queries = Array.from({ length: 25 }, (_, idx) =>
          executeYugabyteSql<{ sql: string }>(`SELECT ${idx}`, [], sessionEnv)
        );
        return Promise.all(queries);
      },
      2
    );

    expect(results).toHaveLength(25);
    expect(results[0].rows[0].sql).toBe('SELECT 0');
    expect(results[24].rows[0].sql).toBe('SELECT 24');
    expect(peakConnected).toBeLessThanOrEqual(2);
    expect(clientInstances.length).toBeLessThanOrEqual(2);
    expect(activeConnected).toBe(0);
    expect(clientInstances.every((c) => c.ended)).toBe(true);
  });

  it('creates a new session when a shared platform env still points to a closed prior session', async () => {
    const baseEnv = {
      HYPERDRIVE: { connectionString: 'postgres://hyperdrive.local/nox' }
    };
    let staleSessionEnv: any;

    await withYugabyteReadSession(baseEnv, async (sessionEnv) => {
      staleSessionEnv = sessionEnv;
      await executeYugabyteSql('SELECT first_request', [], sessionEnv);
    });

    await withYugabyteReadSession(staleSessionEnv, async (sessionEnv) => {
      expect(sessionEnv).not.toBe(staleSessionEnv);
      await executeYugabyteSql('SELECT second_request', [], sessionEnv);
    });

    expect(clientInstances).toHaveLength(2);
    expect(clientInstances.map((client) => client.queries)).toEqual([
      ['SELECT first_request'],
      ['SELECT second_request']
    ]);
    expect(clientInstances.every((client) => client.ended)).toBe(true);
  });

  it('rejects late work on a closed request session without opening another connection', async () => {
    const baseEnv = {
      HYPERDRIVE: { connectionString: 'postgres://hyperdrive.local/nox' }
    };
    let closedSessionEnv: any;

    await withYugabyteReadSession(baseEnv, async (sessionEnv) => {
      closedSessionEnv = sessionEnv;
    });

    await expect(executeYugabyteSql('SELECT too_late', [], closedSessionEnv)).rejects.toThrow(
      'YUGABYTE_READ_SESSION_CLOSED'
    );
    expect(clientInstances).toHaveLength(0);
  });
});
