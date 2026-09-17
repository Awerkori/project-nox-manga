import { db } from './src/lib/server/db/index';
import { sql } from 'drizzle-orm';
db.run(sql`SELECT 1`);
db.get(sql`SELECT 1`);
db.all(sql`SELECT 1`);
db.execute(sql`SELECT 1`);
