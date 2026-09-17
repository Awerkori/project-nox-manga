import { createClient as createLibsqlClient } from '@libsql/client';
import pkg from 'pg';
const { Client } = pkg;
import { env } from 'process';
import fs from 'fs';

const tursoEnv = fs.readFileSync(`${env.HOME}/.config/project-nox/turso.env`, 'utf8');
const tursoToken = tursoEnv.match(/TURSO_API_TOKEN=(.*)/)?.[1];
const tursoUrl = 'libsql://project-nox-awerkori.turso.io';
const turso = createLibsqlClient({ url: tursoUrl, authToken: tursoToken });

const pgClient = new Client({
  connectionString: 'postgresql://postgres:ZJGsV8lUOarRFjDo@db.izregkwaqdygwioqzwwo.supabase.co:5432/postgres'
});

const tables = ['members', 'works', 'chapters', 'pages', 'scan_members', 'scans'];

async function check() {
  await pgClient.connect();
  console.log('Comparing Row Counts...');
  let failed = false;
  for (const table of tables) {
    const pgRes = await pgClient.query(`SELECT count(*) as c FROM ${table}`);
    const sbCount = parseInt(pgRes.rows[0].c, 10);
    
    const rs = await turso.execute(`SELECT count(*) as c FROM ${table}`);
    const tursoCount = parseInt(rs.rows[0].c, 10);

    const diff = sbCount - tursoCount;
    const symbol = diff === 0 ? '✅' : '❌';
    console.log(`${symbol} ${table.padEnd(20)} | Supabase: ${sbCount} | Turso: ${tursoCount} | Diff: ${diff}`);
    if (diff !== 0) failed = true;
  }
  await pgClient.end();
  if (failed) process.exit(1);
}

check().catch(e => {
  console.error(e.message);
  process.exit(1);
});
