import { db, schema, safeQuery } from '$lib/server/db';
import { desc } from 'drizzle-orm';

export const load = async () => {
  const works = await safeQuery(
    db.select().from(schema.works).orderBy(desc(schema.works.updatedAt)).limit(200)
  );
  return { works: works || [] };
};
