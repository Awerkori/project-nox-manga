#!/usr/bin/env node
/**
 * The authoritative Project Nox schema lives in YugabyteDB Aeon (YSQL).
 * This intentionally has no Supabase CLI or Supabase credential dependency.
 *
 * Required environment: YUGABYTE_HOST, YUGABYTE_USER, YUGABYTE_PASSWORD,
 * YUGABYTE_DATABASE and either YUGABYTE_SSL_CA or YUGABYTE_SSL_CERT.
 * Pass YUGABYTE_ENV_FILE=/secure/path/.env for an operator-only local run.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDir = path.join(root, 'yugabyte', 'migrations');
const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const statusOnly = args.has('--status');
const applyAll = args.has('--all');

function parseEnvFile(file) {
  const values = {};
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value.replace(/\\n/g, '\n');
  }
  return values;
}

const envFile = process.env.YUGABYTE_ENV_FILE;
const fileEnv = envFile ? parseEnvFile(envFile) : {};
const value = (name) => process.env[name] || fileEnv[name] || '';
const required = ['YUGABYTE_HOST', 'YUGABYTE_USER', 'YUGABYTE_PASSWORD', 'YUGABYTE_DATABASE'];
const missing = required.filter((name) => !value(name));
if (missing.length) {
  throw new Error(`Missing required Yugabyte configuration: ${missing.join(', ')}`);
}

let ca = value('YUGABYTE_SSL_CA');
if (!ca) {
  const configuredPath = value('YUGABYTE_SSL_CERT');
  if (configuredPath) {
    const base = envFile ? path.dirname(path.resolve(envFile)) : root;
    const certPath = path.isAbsolute(configuredPath) ? configuredPath : path.resolve(base, configuredPath);
    if (fs.existsSync(certPath)) ca = fs.readFileSync(certPath, 'utf8');
  }
}
if (!ca) {
  throw new Error('YUGABYTE_SSL_CA or a readable YUGABYTE_SSL_CERT is required for a verified TLS connection');
}

const client = new pg.Client({
  host: value('YUGABYTE_HOST'),
  port: Number(value('YUGABYTE_PORT') || 5433),
  user: value('YUGABYTE_USER'),
  password: value('YUGABYTE_PASSWORD'),
  database: value('YUGABYTE_DATABASE'),
  connectionTimeoutMillis: 25_000,
  ssl: { rejectUnauthorized: true, ca },
  application_name: 'project-nox-ysql-migrator'
});

function migrationFiles() {
  return fs.readdirSync(migrationsDir)
    .filter((name) => /^\d+_[a-z0-9_]+\.sql$/i.test(name))
    .sort()
    .map((name) => ({
      name,
      sql: fs.readFileSync(path.join(migrationsDir, name), 'utf8'),
      checksum: crypto.createHash('sha256').update(fs.readFileSync(path.join(migrationsDir, name))).digest('hex')
    }));
}

// YSQL's retry layer cannot safely retry a simple-protocol packet containing
// multiple SQL statements. Split only at semicolons outside quoted strings,
// comments and PL/pgSQL dollar blocks so each DDL statement gets its own
// retryable round-trip and a precise error location.
function splitSqlStatements(sql) {
  const statements = [];
  let start = 0;
  let index = 0;
  let state = 'normal';
  let dollarTag = '';
  while (index < sql.length) {
    const char = sql[index];
    const next = sql[index + 1];
    if (state === 'line-comment') {
      if (char === '\n') state = 'normal';
      index += 1;
      continue;
    }
    if (state === 'block-comment') {
      if (char === '*' && next === '/') {
        state = 'normal';
        index += 2;
      } else index += 1;
      continue;
    }
    if (state === 'single') {
      if (char === "'" && next === "'") index += 2;
      else if (char === "'") {
        state = 'normal';
        index += 1;
      } else index += 1;
      continue;
    }
    if (state === 'double') {
      if (char === '"' && next === '"') index += 2;
      else if (char === '"') {
        state = 'normal';
        index += 1;
      } else index += 1;
      continue;
    }
    if (state === 'dollar') {
      if (sql.startsWith(dollarTag, index)) {
        index += dollarTag.length;
        state = 'normal';
      } else index += 1;
      continue;
    }
    if (char === '-' && next === '-') {
      state = 'line-comment';
      index += 2;
      continue;
    }
    if (char === '/' && next === '*') {
      state = 'block-comment';
      index += 2;
      continue;
    }
    if (char === "'") {
      state = 'single';
      index += 1;
      continue;
    }
    if (char === '"') {
      state = 'double';
      index += 1;
      continue;
    }
    if (char === '$') {
      const tag = sql.slice(index).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/)?.[0];
      if (tag) {
        dollarTag = tag;
        state = 'dollar';
        index += tag.length;
        continue;
      }
    }
    if (char === ';') {
      const statement = sql.slice(start, index + 1).trim();
      if (statement) statements.push(statement);
      start = index + 1;
    }
    index += 1;
  }
  const tail = sql.slice(start).trim();
  if (tail) statements.push(tail);
  return statements;
}

async function main() {
  await client.connect();
  try {
    const migrationTableSql = `
      CREATE TABLE IF NOT EXISTS public.nox_schema_migrations (
        filename text PRIMARY KEY,
        checksum text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `;
    // Yugabyte YSQL DDL is not safely reversible by a generic SQL ROLLBACK in
    // every cluster configuration. --dry-run therefore stays read-only: it
    // verifies the exact live prerequisites but never executes migration DDL.
    const preflight = await client.query(`
      WITH required_tables(table_name) AS (
        VALUES ('scans'), ('members'), ('scan_members'), ('scan_production_files'),
               ('scan_production_chapters'), ('scan_workflow_stages'),
               ('scan_chapter_stages'), ('scan_chapter_timeline')
      )
      SELECT COALESCE(array_agg(required_tables.table_name ORDER BY required_tables.table_name)
               FILTER (WHERE info.table_name IS NULL), ARRAY[]::text[]) AS missing_tables
      FROM required_tables
      LEFT JOIN information_schema.tables info
        ON info.table_schema = 'public' AND info.table_name = required_tables.table_name
    `);
    if (preflight.rows[0].missing_tables.length) {
      throw new Error(`YSQL preflight failed; missing tables: ${preflight.rows[0].missing_tables.join(', ')}`);
    }

    const ledger = await client.query(`SELECT to_regclass('public.nox_schema_migrations') AS name`);
    const applied = ledger.rows[0].name
      ? await client.query('SELECT filename, checksum FROM public.nox_schema_migrations ORDER BY filename')
      : { rows: [] };
    const appliedByName = new Map(applied.rows.map((row) => [row.filename, row.checksum]));
    const pending = migrationFiles().filter((migration) => {
      const existing = appliedByName.get(migration.name);
      if (existing && existing !== migration.checksum) {
        throw new Error(`Checksum mismatch for already-applied migration ${migration.name}; create a new migration instead of editing history`);
      }
      return !existing;
    });

    if (statusOnly) {
      console.log(`YSQL migrations: ${applied.rows.length} applied, ${pending.length} pending`);
      for (const migration of pending) console.log(`pending ${migration.name}`);
      return;
    }
    if (dryRun) {
      console.log(`YSQL preflight passed: ${pending.length} pending migration(s); no DDL was executed`);
      for (const migration of pending) console.log(`ready ${migration.name}`);
      return;
    }
    if (!dryRun && !applyAll) {
      throw new Error('Refusing to apply migrations without --all; use --dry-run to validate first');
    }
    if (!pending.length) {
      console.log('YSQL migrations: no pending migrations');
      return;
    }

    await client.query(migrationTableSql);

    for (const migration of pending) {
      try {
        const statements = splitSqlStatements(migration.sql);
        for (const [index, statement] of statements.entries()) {
          try {
            await client.query(statement);
          } catch (error) {
            const summary = statement.replace(/\s+/g, ' ').slice(0, 120);
            throw new Error(
              `statement ${index + 1}/${statements.length} (${summary}): ${error instanceof Error ? error.message : 'unknown error'}`,
              { cause: error }
            );
          }
        }
        await client.query(
          'INSERT INTO public.nox_schema_migrations (filename, checksum) VALUES ($1, $2)',
          [migration.name, migration.checksum]
        );
        console.log(`applied ${migration.name}`);
      } catch (error) {
        throw new Error(
          `YSQL migration failed for ${migration.name}: ${error instanceof Error ? error.message : 'unknown error'}`,
          { cause: error }
        );
      }
    }
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'YSQL migration failed');
  process.exitCode = 1;
});
