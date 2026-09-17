
import { db, schema, safeQuery } from '$lib/server/db';
import { desc } from 'drizzle-orm';
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async () => {
  const { data: works } = await safeQuery(
    db.select().from(schema.works).orderBy(desc(schema.works.updatedAt)).limit(200)
  );
  return { works: works || [] };
};
