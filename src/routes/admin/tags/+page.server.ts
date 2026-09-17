import { db, schema, safeQuery } from '$lib/server/db';
import { asc } from 'drizzle-orm';

export const load = async () => ({
  tags: (await safeQuery(
    db.select().from(schema.tags).orderBy(asc(schema.tags.kind), asc(schema.tags.name))
  )).data || []
});
