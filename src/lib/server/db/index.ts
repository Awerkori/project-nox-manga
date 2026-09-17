import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';
import * as relations from './relations';
import { env } from '$env/dynamic/private';

const client = createClient({
  url: env.TURSO_DB_URL || 'libsql://dummy.turso.io',
  authToken: env.TURSO_DB_TOKEN || '',
});

const drizzleDb = drizzle(client, { schema: { ...schema, ...relations } });
export const db = Object.assign(drizzleDb, {
  execute: async <T = any>(query: any): Promise<T> => {
    const rows: any = await (drizzleDb as any).all(query);
    if (rows && rows[0]) {
      Object.assign(rows, rows[0]);
    }
    return rows;
  }
});
export { safeQuery, safeQuerySingle } from './safe';
export * as schema from './schema';
