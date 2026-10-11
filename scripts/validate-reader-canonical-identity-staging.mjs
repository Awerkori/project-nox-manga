/**
 * Reader canonical identity staging/disposable verifier.
 *
 * Default mode is read-only. Both migrations are available only for a named
 * non-production target and each needs its own explicit confirmation. Phase 2
 * never runs until phase-one backfill/uniqueness preconditions are observed.
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
const applyPhaseTwo = process.env[`${prefix}APPLY_PHASE_TWO`] === '1';
const phaseOneConfirmed = process.env[`${prefix}CONFIRM_PHASE_ONE`] === 'APPLY_READER_IDENTITY_PHASE_ONE_TO_NON_PRODUCTION'
  || process.env[`${prefix}CONFIRM`] === 'APPLY_READER_IDENTITY_PHASE_ONE_TO_NON_PRODUCTION';
if (applyPhaseOne && !phaseOneConfirmed) {
  throw new Error(`Applying phase 1 requires ${prefix}CONFIRM_PHASE_ONE=APPLY_READER_IDENTITY_PHASE_ONE_TO_NON_PRODUCTION`);
}
if (applyPhaseTwo && process.env[`${prefix}CONFIRM_PHASE_TWO`] !== 'APPLY_READER_IDENTITY_PHASE_TWO_TO_NON_PRODUCTION') {
  throw new Error(`Applying phase 2 requires ${prefix}CONFIRM_PHASE_TWO=APPLY_READER_IDENTITY_PHASE_TWO_TO_NON_PRODUCTION`);
}

const caPath = process.env[`${prefix}YSQL_CA`] || path.resolve('certs/yugabyte-root.crt');
if (!fs.existsSync(caPath)) throw new Error(`YSQL CA certificate not found: ${caPath}`);
const phaseOnePath = path.resolve('supabase/migrations/20261011090000_add_reader_canonical_chapter_identity.sql');
const phaseOne = fs.readFileSync(phaseOnePath, 'utf8');
const phaseOneSha256 = crypto.createHash('sha256').update(phaseOne).digest('hex');
const phaseTwoPath = path.resolve('supabase/migrations/20261011091000_enable_reader_canonical_chapter_identity.sql');
const phaseTwo = fs.readFileSync(phaseTwoPath, 'utf8');
const phaseTwoSha256 = crypto.createHash('sha256').update(phaseTwo).digest('hex');
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
  options: applyPhaseOne || applyPhaseTwo
    ? '-c statement_timeout=15000 -c idle_in_transaction_session_timeout=15000'
    : '-c default_transaction_read_only=on -c statement_timeout=10000',
  application_name: 'project-nox-reader-identity-validation',
});

const requiredColumns = ['canonical_chapter_key', 'display_number', 'chapter_order_key', 'chapter_kind', 'edition', 'language'];
async function rows(sql, values = []) { return (await pool.query(sql, values)).rows; }

async function inspectIdentityState() {
  const columns = await rows(`SELECT column_name,is_nullable FROM information_schema.columns
    WHERE table_schema='public' AND table_name='chapters'
      AND column_name IN ('canonical_chapter_key','display_number','chapter_order_key','chapter_kind','edition','language','number')
    ORDER BY column_name`);
  const present = new Map(columns.map((row) => [row.column_name, row.is_nullable]));
  const missingColumns = requiredColumns.filter((column) => !present.has(column));
  const indexes = await rows(`SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename='chapters'
    AND indexname IN ('chapters_work_canonical_chapter_key_uq','chapters_work_id_number_key') ORDER BY indexname`);
  const constraints = await rows(`SELECT conname FROM pg_constraint
    WHERE conrelid='public.chapters'::regclass AND conname='chapters_work_id_number_key'`);
  const incomplete = missingColumns.length ? null : Number((await rows(`SELECT count(*)::int AS count FROM public.chapters
    WHERE canonical_chapter_key IS NULL OR display_number IS NULL OR chapter_order_key IS NULL
       OR chapter_kind IS NULL OR edition IS NULL OR language IS NULL`))[0].count);
  const duplicateKeys = missingColumns.length ? null : Number((await rows(`SELECT count(*)::int AS count FROM (
    SELECT work_id,canonical_chapter_key FROM public.chapters
    GROUP BY work_id,canonical_chapter_key HAVING count(*) > 1
  ) AS duplicates`))[0].count);
  const canonicalIndex = indexes.some((row) => row.indexname === 'chapters_work_canonical_chapter_key_uq');
  const legacyNumericConstraint = constraints.some((row) => row.conname === 'chapters_work_id_number_key');
  return {
    columns, present, missingColumns, indexes, incomplete, duplicateKeys,
    canonicalIndex, legacyNumericConstraint,
    readyForPhaseTwo: missingColumns.length === 0 && incomplete === 0 && duplicateKeys === 0
      && canonicalIndex && legacyNumericConstraint,
  };
}

try {
  const server = (await rows("SELECT current_database() AS database,current_user AS role,current_setting('transaction_read_only') AS read_only,version() AS version"))[0];
  if (server.database !== database) throw new Error('Connected database does not match configured isolated target');
  if (applyPhaseOne) await pool.query(phaseOne);
  const beforePhaseTwo = await inspectIdentityState();
  if (applyPhaseTwo) {
    if (!beforePhaseTwo.readyForPhaseTwo) {
      throw new Error('Reader phase 2 preconditions are not satisfied; complete backfill and resolve canonical duplicates first');
    }
    await pool.query(phaseTwo);
  }
  const state = applyPhaseTwo ? await inspectIdentityState() : beforePhaseTwo;

  console.log(JSON.stringify({
    target, appliedPhaseOne: applyPhaseOne, appliedPhaseTwo: applyPhaseTwo, database: server.database, role: server.role,
    readOnlySession: server.read_only, version: String(server.version).split(' ').slice(0, 2).join(' '),
    phaseOneSha256, phaseTwoSha256, columns: state.columns, missingColumns: state.missingColumns,
    numericColumnNullable: state.present.get('number') === 'YES',
    indexes: state.indexes.map((row) => row.indexname), incompleteRows: state.incomplete,
    duplicateCanonicalKeys: state.duplicateKeys, readyForPhaseTwo: beforePhaseTwo.readyForPhaseTwo,
    phaseTwoReady: state.missingColumns.length === 0 && state.incomplete === 0 && state.duplicateKeys === 0
      && state.present.get('number') === 'YES' && state.canonicalIndex && !state.legacyNumericConstraint,
    phaseTwoNote: applyPhaseTwo
      ? 'Phase 2 was applied only to the explicit non-production validation target.'
      : 'Phase 2 remains unapplied; use its separate explicit confirmation only after backfill, backup and publisher fencing.'
  }, null, 2));
} finally {
  await pool.end();
}
