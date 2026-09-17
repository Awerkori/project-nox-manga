const fs = require('fs');

let code = fs.readFileSync('src/routes/scan/+page.server.ts.bak', 'utf8');

// 1. Add imports
code = code.replace(
  "import { fail, redirect, error } from '@sveltejs/kit';",
  "import { fail, redirect, error } from '@sveltejs/kit';\nimport { db, schema, safeQuery, safeQuerySingle } from '$lib/server/db';\nimport { eq, and, desc, asc, inArray, isNull, isNotNull, sql } from 'drizzle-orm';"
);

// 2. Replace basic deletes: locals.db.from('XYZ').delete().eq('A', B)
code = code.replace(/await locals\.db\.from\('([^']+)'\)\.delete\(\)\.eq\('([^']+)',\s*([^)]+)\)/g, (match, table, col, val) => {
  const schemaName = table.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
  const colName = col.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
  return `await safeQuery(db.delete(schema.${schemaName}).where(eq(schema.${schemaName}.${colName}, ${val})))`;
});

// 3. Replace double deletes: locals.db.from('XYZ').delete().eq('A', B).eq('C', D)
code = code.replace(/await locals\.db\.from\('([^']+)'\)\.delete\(\)\.eq\('([^']+)',\s*([^)]+)\)\.eq\('([^']+)',\s*([^)]+)\)/g, (match, table, col1, val1, col2, val2) => {
  const schemaName = table.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
  const c1 = col1.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
  const c2 = col2.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
  return `await safeQuery(db.delete(schema.${schemaName}).where(and(eq(schema.${schemaName}.${c1}, ${val1}), eq(schema.${schemaName}.${c2}, ${val2}))))`;
});

// 4. Replace updates: locals.db.from('XYZ').update(A).eq('B', C)
code = code.replace(/await locals\.db\.from\('([^']+)'\)\.update\(([^)]+)\)\.eq\('([^']+)',\s*([^)]+)\)/g, (match, table, data, col, val) => {
  const schemaName = table.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
  const colName = col.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
  return `await safeQuery(db.update(schema.${schemaName}).set(${data} as any).where(eq(schema.${schemaName}.${colName}, ${val})))`;
});

// 5. Replace double updates
code = code.replace(/await locals\.db\.from\('([^']+)'\)\.update\(([^)]+)\)\.eq\('([^']+)',\s*([^)]+)\)\.eq\('([^']+)',\s*([^)]+)\)/g, (match, table, data, col1, val1, col2, val2) => {
  const schemaName = table.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
  const c1 = col1.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
  const c2 = col2.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
  return `await safeQuery(db.update(schema.${schemaName}).set(${data} as any).where(and(eq(schema.${schemaName}.${c1}, ${val1}), eq(schema.${schemaName}.${c2}, ${val2}))))`;
});

// 6. Replace single inserts: locals.db.from('XYZ').insert({ ... })
// This is harder with regex if the object spans multiple lines. Let's cast to any for now to stop TS from complaining about locals.db.
code = code.replace(/locals\.db\./g, '(locals.db as any).');
code = code.replace(/locals\.db as any/g, 'locals.db as any');

fs.writeFileSync('src/routes/scan/+page.server.ts', code);
