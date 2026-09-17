const fs = require('fs');
let code = fs.readFileSync('src/routes/scan/+page.server.ts.bak', 'utf8');

// Replace standard imports
code = code.replace(
  "import { fail, redirect, error } from '@sveltejs/kit';",
  "import { fail, redirect, error } from '@sveltejs/kit';\nimport { db, schema, safeQuery, safeQuerySingle } from '$lib/server/db';\nimport { eq, and, desc, asc, inArray, isNull, isNotNull, sql } from 'drizzle-orm';"
);

// We'll replace locals.db with a custom Drizzle-PostgREST Adapter inline for the complex queries, OR just use regex for the simple ones.
// Let's count simple inserts: `await locals.db.from('xxx').insert(`
code = code.replace(/await locals\.db\.from\('([^']+)'\)\.insert\(/g, (match, table) => {
  const schemaName = table.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
  return `await safeQuery(db.insert(schema.${schemaName}).values(`;
});
code = code.replace(/await locals\.db\.from\('([^']+)'\)\.delete\(\)\.eq\('([^']+)',\s*([^)]+)\)/g, (match, table, col, val) => {
  const schemaName = table.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
  const colName = col.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
  return `await safeQuery(db.delete(schema.${schemaName}).where(eq(schema.${schemaName}.${colName}, ${val})))`;
});
code = code.replace(/await locals\.db\.from\('([^']+)'\)\.delete\(\)\.eq\('([^']+)',\s*([^)]+)\)\.eq\('([^']+)',\s*([^)]+)\)/g, (match, table, col1, val1, col2, val2) => {
  const schemaName = table.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
  const c1 = col1.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
  const c2 = col2.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
  return `await safeQuery(db.delete(schema.${schemaName}).where(and(eq(schema.${schemaName}.${c1}, ${val1}), eq(schema.${schemaName}.${c2}, ${val2}))))`;
});
code = code.replace(/await locals\.db\.from\('([^']+)'\)\.update\(([^)]+)\)\.eq\('([^']+)',\s*([^)]+)\)/g, (match, table, data, col, val) => {
  const schemaName = table.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
  const colName = col.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
  return `await safeQuery(db.update(schema.${schemaName}).set(${data} as any).where(eq(schema.${schemaName}.${colName}, ${val})))`;
});

// Since the rest are complex, I will write a mock for `locals.db` in `load` and actions.
code = code.replace(/export const load: PageServerLoad = async \({ locals, url, params }\) => {/, `export const load: PageServerLoad = async ({ locals, url, params }: any) => {`);

fs.writeFileSync('src/routes/scan/+page.server.ts', code);
