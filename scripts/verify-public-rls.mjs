import { createClient } from '@supabase/supabase-js';
import assert from 'node:assert/strict';

// Read-only against Manga, using only its public anonymous key. No fixture writes, sessions or staff calls.
process.loadEnvFile('.env');
const origin = process.env.PUBLIC_SUPABASE_URL;
assert.equal(origin, 'https://izregkwaqdygwioqzwwo.supabase.co', 'Wrong database project');
const db = createClient(origin, process.env.PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});
for (const table of ['works', 'chapters']) {
  const result = await db.from(table).select('source_id').limit(1);
  assert.equal(result.error?.code, '42501', `Internal source column exposed: ${table}`);
  console.log(`PASS: anonymous source_id denied on ${table}`);
}
for (const table of [
  'media',
  'access_roles',
  'library',
  'reading',
  'reading_sessions',
  'notifications',
  'editor_invites',
  'audit_log',
  'settings'
]) {
  const result = await db.from(table).select('*').limit(1);
  assert.equal(result.error?.code, '42501', `Private table readable: ${table}`);
  console.log(`PASS: anonymous SELECT denied on ${table}`);
}
const works = await db.from('works').select('id,title,published').eq('published', false).limit(1);
assert.equal(works.error, null);
assert.equal(works.data.length, 0, 'Anonymous caller can read a draft work');
const chapters = await db.from('chapters').select('id,published_at').is('published_at', null).limit(1);
assert.equal(chapters.error, null);
assert.equal(chapters.data.length, 0, 'Anonymous caller can read an unpublished chapter');
const comments = await db.from('comments').select('id').eq('removed', true).limit(1);
assert.equal(comments.error, null);
assert.equal(comments.data.length, 0, 'Anonymous caller can read removed comments');
const publicWorks = await db.from('works').select('id,title').eq('published', true).limit(1);
assert.equal(publicWorks.error, null);
assert.ok(publicWorks.data.length > 0, 'Expected real published content to remain readable');
console.log('PASS: draft/unpublished/removed content hidden; published catalog readable');
