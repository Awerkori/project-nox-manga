import { db, safeQuery, schema } from "./src/lib/server/db/index.js";
import { eq, and, sql } from "drizzle-orm";
async function run() {
    const res = await safeQuery(
      db.select({
        id: schema.chapters.id,
        number: schema.chapters.number,
        title: schema.chapters.title,
        publishedAt: schema.chapters.publishedAt,
        viewsTotal: schema.chapters.viewsTotal,
        chapter_scans: sql`(SELECT json_group_array(json_object('scans', json_object('id', s.id, 'name', s.name, 'slug', s.slug, 'is_official', s.is_official))) FROM chapter_scans cs JOIN scans s ON cs.scan_id = s.id WHERE cs.chapter_id = chapters.id)`
      })
      .from(schema.chapters)
      .where(and(eq(schema.chapters.workId, "c1fc9233-040f-488f-a9db-953e5e1e79df"), eq(schema.chapters.published, true)))
      .orderBy(schema.chapters.number) // ascending wait, no descending wait desc(schema.chapters.number)
    );
    console.log(res);
}
run();
