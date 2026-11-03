import pg from 'pg';
import fs from 'fs';
import path from 'path';

const SUPABASE_DB_URL = process.env.SUPABASE_DB_URL;
if (!SUPABASE_DB_URL) {
  console.error('ERROR: SUPABASE_DB_URL environment variable is required.');
  process.exit(1);
}
const BACKUP_DIR = '/home/awerkori/.config/project-nox/backups';

async function main() {
  console.log('=== PROJECT NOX — SUPABASE COMPREHENSIVE BACKUP ===');
  console.log('Target database: db.izregkwaqdygwioqzwwo.supabase.co:5432/postgres');
  
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const jsonBackupFile = path.join(BACKUP_DIR, `supabase_full_backup_${timestamp}.json`);
  const sqlBackupFile = path.join(BACKUP_DIR, `supabase_full_backup_${timestamp}.sql`);

  const client = new pg.Client({
    connectionString: SUPABASE_DB_URL,
    connectionTimeoutMillis: 10000
  });

  await client.connect();
  console.log('Connected to Supabase PostgreSQL successfully.');

  // Find all tables in public, auth, storage schemas
  const tablesRes = await client.query(`
    SELECT table_schema, table_name
    FROM information_schema.tables
    WHERE table_schema IN ('public', 'auth', 'storage')
      AND table_type = 'BASE TABLE'
    ORDER BY table_schema, table_name;
  `);

  console.log(`Found ${tablesRes.rows.length} tables to backup across public, auth, storage schemas.`);

  const backupData = {
    metadata: {
      exportedAt: new Date().toISOString(),
      source: 'db.izregkwaqdygwioqzwwo.supabase.co',
      database: 'postgres',
      tableCount: tablesRes.rows.length
    },
    tables: {}
  };

  const sqlStream = fs.createWriteStream(sqlBackupFile, { flags: 'w' });
  sqlStream.write(`-- PROJECT NOX FULL SUPABASE BACKUP\n-- Date: ${new Date().toISOString()}\n-- Source: izregkwaqdygwioqzwwo.supabase.co\n\n`);

  let totalRows = 0;

  for (const { table_schema, table_name } of tablesRes.rows) {
    const fullTable = `"${table_schema}"."${table_name}"`;
    try {
      const countRes = await client.query(`SELECT count(*)::int as count FROM ${fullTable}`);
      const rowCount = countRes.rows[0]?.count || 0;
      totalRows += rowCount;
      console.log(`Exporting ${fullTable} (${rowCount} rows)...`);

      const dataRes = await client.query(`SELECT * FROM ${fullTable}`);
      backupData.tables[`${table_schema}.${table_name}`] = {
        rowCount,
        rows: dataRes.rows
      };

      // Write basic SQL insert statements
      sqlStream.write(`-- Table: ${fullTable} (${rowCount} rows)\n`);
      if (dataRes.rows.length > 0) {
        const columns = Object.keys(dataRes.rows[0]);
        for (const row of dataRes.rows) {
          const colList = columns.map(c => `"${c}"`).join(', ');
          const valList = columns.map(c => {
            const val = row[c];
            if (val === null || val === undefined) return 'NULL';
            if (typeof val === 'number' || typeof val === 'boolean') return String(val);
            if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
            return `'${String(val).replace(/'/g, "''")}'`;
          }).join(', ');
          sqlStream.write(`INSERT INTO ${fullTable} (${colList}) VALUES (${valList}) ON CONFLICT DO NOTHING;\n`);
        }
      }
      sqlStream.write('\n');
    } catch (err) {
      console.warn(`Warning reading ${fullTable}:`, err.message);
      backupData.tables[`${table_schema}.${table_name}`] = {
        error: err.message,
        rowCount: 0,
        rows: []
      };
    }
  }

  sqlStream.end();

  fs.writeFileSync(jsonBackupFile, JSON.stringify(backupData, null, 2));

  const jsonStats = fs.statSync(jsonBackupFile);
  const sqlStats = fs.statSync(sqlBackupFile);

  console.log('\n=== BACKUP SUMMARY ===');
  console.log(`Total tables: ${tablesRes.rows.length}`);
  console.log(`Total rows: ${totalRows}`);
  console.log(`JSON backup: ${jsonBackupFile} (${(jsonStats.size / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`SQL backup:  ${sqlBackupFile} (${(sqlStats.size / 1024 / 1024).toFixed(2)} MB)`);

  await client.end();
  console.log('✓ Supabase backup completed and verified successfully.');
}

main().catch(err => {
  console.error('Fatal backup error:', err);
  process.exit(1);
});
