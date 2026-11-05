import pg from 'pg';
import fs from 'node:fs';

const envLines = fs.readFileSync('/home/awerkori/.config/project-nox/yugabyte.env', 'utf8').split('\n');
const envVars = {};
for (const l of envLines) {
  const m = l.match(/^([^=]+)=(.*)$/);
  if (m) envVars[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
}
const ca = fs.readFileSync('/home/awerkori/.config/project-nox/root.crt', 'utf8');
const pool = new pg.Pool({
  host: envVars.YUGABYTE_HOST,
  port: parseInt(envVars.YUGABYTE_PORT || '5433', 10),
  user: envVars.YUGABYTE_USER,
  password: envVars.YUGABYTE_PASSWORD,
  database: envVars.YUGABYTE_DATABASE,
  ssl: { ca, rejectUnauthorized: false }
});

const migrationSql = fs.readFileSync(
  new URL('../supabase/migrations/20261104220000_process_expired_scan_stages_ysql.sql', import.meta.url),
  'utf8'
);

async function main() {
  const client = await pool.connect();
  try {
    console.log('Applying migration 20261104220000_process_expired_scan_stages_ysql to YugabyteDB...');
    await client.query(migrationSql);
    console.log('Successfully upgraded process_expired_scan_stages_ysql and check_and_send_deadline_warnings_ysql with strict isolation in YugabyteDB!');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
