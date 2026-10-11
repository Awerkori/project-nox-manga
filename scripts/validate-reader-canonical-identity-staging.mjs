/**
 * Reader canonical identity staging/disposable verifier.
 *
 * Default mode is read-only. Applying phase 1 requires two explicit variables
 * and phase 2 is intentionally never automated by this script: phase 2 drops
 * the legacy numeric constraint and belongs to an approved cutover window.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const prefix = 'READER_IDENTITY_VALIDATION_';
const required = ['TARGET', 'YSQL_HOST', 'YSQL_USER', 'YSQL_PASSWORD', 'DATABASE'].map((name) => `${prefix}${name}`);
const missing = required.filter((name) => !process.env[name]);
if (missing.length) throw new Error(`Missing isolated-validation environment: ${missing.join(', ')}`);

const target = String(process.env[`${prefix}TARGET`]).toLowerCase();
const database = String(process.env[`${prefix}DATABASE`]);
if (!['staging', 'disposable'].includes(target)) throw new Error(`${prefix}TARGET must be exactly staging or disposable`);
if (/(^|[_-])(prod|production)([_-]|$)/i.test(database)) throw new Error('Refusing a production-looking database name');

const applyPhaseOne = process.env[`${prefix}APPLY_PHASE_ONE`] === '1';
if (applyPhaseOne && process.env[`${prefix}CONFIRM`] !== 'APPLY_READER_IDENTITY_PHASE_ONE_TO_NON_PRODUCTION') {
  throw new Error(`Applying phase 1 requires ${prefix}CONFIRM=APPLY_READER_IDENTITY_PHASE_ONE_TO_NON_PRODUCTION`);
}

const caPath = process.env[`${prefix}YSQL_CA`] || path.resolve('certs/yugabyte-root.crt');
if (!fs.existsSync(caPath)) throw new Error(`YSQL CA certificate not found: ${caPath}`);
const phaseOnePath = path.resolve('supabase/migrations/20261011090000_add_reader_canonical_chapter_identity.sql');
const phaseOne = fs.readFileSync(phaseOnePath, 'utf8');
const phaseOneSha256 = crypto.createHash('sha256').update(phaseOne).digest('hex');
const pool = new pg.Pool({
  host: process.env[`${prefix}YSQL_HOST`],
  port: Number(process.env[`${prefix}YSQL_PORT`] || 5433),
  user: process.env[`${prefix}YSQL_USER`],
  password: process.env[`${prefix}YSQL_PASSWORD`],
  database,
  max: 1,
  connectionTimeoutMillis: 10_000,
  query_timeout: 15_000,
  ssl: { rejectUnauthorized: true, ca: fs.readFileSync(caPath, 'utf8') },
  options: applyPhaseOne
    ? '-c statement_timeout=15000 -c idle_in_transaction_session_timeout=15000'
    : '-c default_transaction_read_only=on -c statement_timeout=10000',
  application_name: 'project-nox-reader-identity-validation',
});

const requiredColumns = ['canonical_chapter_key', 'display_number', 'chapter_order_key', 'chapter_kind', 'edition', 'language'];
async function rows(sql, values = []) { return (await pool.query(sql, values)).rows; }

try {
  const server = (await rows("SELECT current_database() AS database,current_user AS role,current_setting('transaction_read_only') AS read_only,version() AS version"))[0];
  if (server.database !== database) throw new Error('Connected database does not match configured isolated target');
  if (applyPhaseOne) await pool.query(phaseOne);

  const columns = await rows(`SELECT column_name,is_nullable FROM information_schema.columns
    WHERE table_schema='public' AND table_name='chapters'
      AND column_name IN ('canonical_chapter_key','display_number','chapter_order_key','chapter_kind','edition','language','number')
    ORDER BY column_name`);
  const present = new Map(columns.map((row) => [row.column_name, row.is_nullable]));
  const missingColumns = requiredColumns.filter((column) => !present.has(column));
  const indexes = await rows(`SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename='chapters'
    AND indexname IN ('chapters_work_canonical_chapter_key_uq','chapters_work_id_number_key') ORDER BY indexname`);
  const incomplete = missingColumns.length ? null : Number((await rows(`SELECT count(*)::int AS count FROM public.chapters
    WHERE canonical_chapter_key IS NULL OR display_number IS NULL OR chapter_order_key IS NULL
       OR chapter_kind IS NULL OR edition IS NULL OR language IS NULL`))[0].count);
  const duplicateKeys = missingColumns.length ? null : Number((await rows(`SELECT count(*)::int AS count FROM (
    SELECT work_id,canonical_chapter_key FROM public.chapters
    GROUP BY work_id,canonical_chapter_key HAVING count(*) > 1
  ) AS duplicates`))[0].count);

  console.log(JSON.stringify({
    target, appliedPhaseOne: applyPhaseOne, database: server.database, role: server.role,
    readOnlySession: server.read_only, version: String(server.version).split(' ').slice(0, 2).join(' '),
    phaseOneSha256, columns, missingColumns, numericColumnNullable: present.get('number') === 'YES',
    indexes: indexes.map((row) => row.indexname), incompleteRows: incomplete, duplicateCanonicalKeys: duplicateKeys,
    phaseTwoReady: incomplete === 0 && duplicateKeys === 0 && present.get('number') === 'YES'
      && indexes.some((row) => row.indexname === 'chapters_work_canonical_chapter_key_uq')
      && !indexes.some((row) => row.indexname === 'chapters_work_id_number_key'),
    phaseTwoNote: 'Phase 2 is deliberately not applied by this tool; it requires approved cutover, verified backup and exclusive publisher fencing.'
  }, null, 2));
} finally {
  await pool.end();
}
