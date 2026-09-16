import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client/web';
import * as schema from './schema';
import * as relations from './relations';
import { env } from '$env/dynamic/private';

const client = createClient({
  url: env.TURSO_DB_URL,
  authToken: env.TURSO_DB_TOKEN,
});

export const db = drizzle(client, { schema: { ...schema, ...relations } });
export { safeQuery, safeQuerySingle } from './safe';
export * as schema from './schema';
