import { createClient } from '@supabase/supabase-js';
import { createClient as createLibsqlClient } from '@libsql/client';
import { env } from 'process';
import fs from 'fs';

const supabaseEnv = fs.readFileSync('.env', 'utf8');
const supabaseUrl = supabaseEnv.match(/PUBLIC_SUPABASE_URL=(.*)/)?.[1].trim();
let supabaseKey = supabaseEnv.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)?.[1].trim();
if (!supabaseKey) {
  supabaseKey = supabaseEnv.match(/PUBLIC_SUPABASE_ANON_KEY=(.*)/)?.[1].trim();
}

const tursoEnv = fs.readFileSync(`${env.HOME}/.config/project-nox/turso.env`, 'utf8');
const tursoToken = tursoEnv.match(/TURSO_API_TOKEN=(.*)/)?.[1].trim();
const tursoUrl = 'libsql://project-nox-awerkori.turso.io';

const supabase = createClient(supabaseUrl, supabaseKey);
const turso = createLibsqlClient({ url: tursoUrl, authToken: tursoToken });

const tables = ['members', 'works', 'chapters', 'pages', 'scan_members', 'scans'];

async function check() {
  console.log('Comparing Row Counts...');
  for (const table of tables) {
    const { count: sbCount, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    if (error) {
      console.error(`Supabase Error on ${table}:`, error.message);
      continue;
    }
    
    const rs = await turso.execute(`SELECT count(*) as c FROM ${table}`);
    const tursoCount = rs.rows[0].c;

    const diff = sbCount - tursoCount;
    const symbol = diff === 0 ? '✅' : '❌';
    console.log(`${symbol} ${table.padEnd(20)} | Supabase: ${sbCount} | Turso: ${tursoCount} | Diff: ${diff}`);
  }
}

check().catch(console.error);
