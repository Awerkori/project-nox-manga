import { createClient } from '@supabase/supabase-js';
import { createClient as createLibsqlClient } from '@libsql/client';

const tursoToken = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODk1OTU0MTQsImlkIjoiMDFhMGFjMWYtMzYwMS03Y2U5LTk0YTMtMTU4YzlkZDI3ZmMzIiwia2lkIjoiN3h3VmlDdGo2aVJ3LUZDTEhQZ0RmWlR1eWZ1X2g3UGtvTUM5S2J3VmpzayIsInJpZCI6ImVjOGYyZmRlLWJiNTctNDE0My04ZjliLWNkOTgxN2FkMzI1OCJ9.Ub9FB0Jmvz7W0o9CaJxsBtNlxjFrwtFKwjvK-Mkedpj9834m9L1R82869B3Qpv-McyBSPePQbNGJI_-kpQisCA';
const tursoUrl = 'libsql://project-nox-main-awerkori.aws-us-east-1.turso.io';
const turso = createLibsqlClient({ url: tursoUrl, authToken: tursoToken });

const supabaseUrl = 'https://izregkwaqdygwioqzwwo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6cmVna3dhcWR5Z3dpb3F6d3dvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODU2NTQ5NCwiZXhwIjoyMTA0MTQxNDk0fQ.ChnMmsSg_w4goxLFbDxEUnxOaBDAAMNG4KoO4RlqQHk';
const supabase = createClient(supabaseUrl, supabaseKey);

const tables = [
  'members', 'access_roles', 'scan_members', 'library', 'reading',
  'comments', 'scan_messages', 'notifications', 'achievements', 'member_achievements',
  'scan_recruitment_openings', 'scan_workflow_stages', 'scan_tasks', 'importer_queue',
  'importer_chapter_mappings', 'media', 'settings'
];

async function run() {
  console.log("TABLE | SUPABASE | TURSO | DIFF");
  for (const table of tables) {
    const { count: supCount, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    if (error) {
       console.log(`${table} | ERROR | ERROR | -`);
       continue;
    }
    const rs = await turso.execute(`SELECT count(*) as c FROM ${table}`);
    const turCount = rs.rows[0].c;
    const diff = supCount - turCount;
    console.log(`${table} | ${supCount} | ${turCount} | ${diff}`);
    
    // Auto-sync if diff > 0
    if (diff > 0) {
      console.log(`Syncing missing data for ${table}...`);
      let allRows = [];
      let page = 0;
      while(true) {
        const { data } = await supabase.from(table).select('*').range(page*1000, (page+1)*1000 - 1);
        if (!data || data.length === 0) break;
        allRows.push(...data);
        page++;
      }
      
      const batchSize = 100;
      for (let i = 0; i < allRows.length; i += batchSize) {
        const batch = allRows.slice(i, i + batchSize);
        if (batch.length === 0) break;
        const cols = Object.keys(batch[0]);
        const normalizedBatch = batch.map(row => {
          const newRow = {...row};
          for (const k of cols) {
            if (typeof newRow[k] === 'boolean') newRow[k] = newRow[k] ? 1 : 0;
            if (newRow[k] && typeof newRow[k] === 'object') newRow[k] = JSON.stringify(newRow[k]);
          }
          return newRow;
        });
        const placeholders = normalizedBatch.map(() => `(${cols.map(() => '?').join(',')})`).join(',');
        const values = normalizedBatch.flatMap(row => cols.map(c => row[c]));
        const query = `INSERT INTO ${table} (${cols.join(',')}) VALUES ${placeholders} ON CONFLICT DO NOTHING;`;
        try {
          await turso.execute({ sql: query, args: values });
        } catch (e) {
          // ignore individual errors like foreign key constraints for now
        }
      }
    }
  }
}
run();
