import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './src/lib/server/db/schema';
const sqlite = new Database(':memory:');
const memDb = drizzle(sqlite, { schema });
console.log(Object.keys(schema).join(', '));
