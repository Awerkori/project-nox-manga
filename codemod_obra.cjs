const fs = require('fs');
let code = fs.readFileSync('src/routes/obra/[slug]/+page.server.ts', 'utf8');

code = code.replace(
  "locals.db.from('works').select(WORK_FIELDS).ilike('slug', params.slug).eq('published', true).maybeSingle()",
  "safeQuerySingle(db.select().from(schema.works).where(and(eq(schema.works.published, 1), eq(schema.works.slug, params.slug))))"
);
code = code.replace(
  "await locals.db.from('members').select('age_status').eq('id', locals.user.id).maybeSingle()",
  "await safeQuerySingle(db.select({ age_status: schema.members.ageStatus }).from(schema.members).where(eq(schema.members.id, locals.user.id)))"
);
code = code.replace(
  "locals.db.from('work_tags').select('tags(id,name,slug,kind)').eq('work_id', work.id)",
  "safeQuery(db.select({ tags: { id: schema.tags.id, name: schema.tags.name, slug: schema.tags.slug, kind: schema.tags.kind } }).from(schema.workTags).leftJoin(schema.tags, eq(schema.tags.id, schema.workTags.tagId)).where(eq(schema.workTags.workId, work.id)))"
);
code = code.replace(
  "locals.db.from('likes').select('user_id').eq('work_id', work.id)",
  "safeQuery(db.select({ user_id: schema.likes.userId }).from(schema.likes).where(eq(schema.likes.workId, work.id)))"
);

// We need to add the imports!
code = code.replace(
  "import { WORK_FIELDS } from '$lib/server/db';",
  "import { WORK_FIELDS, db, schema, safeQuery, safeQuerySingle } from '$lib/server/db';\nimport { eq, and } from 'drizzle-orm';"
);

fs.writeFileSync('src/routes/obra/[slug]/+page.server.ts', code);
