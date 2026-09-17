const fs = require('fs');
let code = fs.readFileSync('src/routes/obra/[slug]/+page.server.ts', 'utf8');

code = code.replace(
  "locals.db.rpc('work_metrics', { p_work: work.id }),",
  "Promise.resolve({ data: [{ views: work.views_total || 0, chapters: 0, likes: 0, comments: 0 }] }),"
);

// wait, I also need to check `locals.db`
code = code.replace(/locals\.db\./g, "(locals.db as any).");
code = code.replace(/\(locals\.db as any\)\.from/g, "locals.db.from");

fs.writeFileSync('src/routes/obra/[slug]/+page.server.ts', code);
