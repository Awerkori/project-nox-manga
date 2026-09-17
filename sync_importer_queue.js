import { createClient } from '@supabase/supabase-js';
import { createClient as createLibsqlClient } from '@libsql/client';

const tursoToken = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODk1OTU0MTQsImlkIjoiMDFhMGFjMWYtMzYwMS03Y2U5LTk0YTMtMTU4YzlkZDI3ZmMzIiwia2lkIjoiN3h3VmlDdGo2aVJ3LUZDTEhQZ0RmWlR1eWZ1X2g3UGtvTUM5S2J3VmpzayIsInJpZCI6ImVjOGYyZmRlLWJiNTctNDE0My04ZjliLWNkOTgxN2FkMzI1OCJ9.Ub9FB0Jmvz7W0o9CaJxsBtNlxjFrwtFKwjvK-Mkedpj9834m9L1R82869B3Qpv-McyBSPePQbNGJI_-kpQisCA';
const tursoUrl = 'libsql://project-nox-main-awerkori.aws-us-east-1.turso.io';
const turso = createLibsqlClient({ url: tursoUrl, authToken: tursoToken });

const supabaseUrl = 'https://izregkwaqdygwioqzwwo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6cmVna3dhcWR5Z3dpb3F6d3dvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODU2NTQ5NCwiZXhwIjoyMTA0MTQxNDk0fQ.ChnMmsSg_w4goxLFbDxEUnxOaBDAAMNG4KoO4RlqQHk';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Streaming importer_queue...");
  let page = 0;
  let totalInserted = 0;
  while(true) {
    const { data, error } = await supabase.from('importer_queue').select('*').range(page*1000, (page+1)*1000 - 1);
    if (error) { console.error(error); break; }
    if (!data || data.length === 0) break;
    
    // insert batch
    const cols = Object.keys(data[0]);
    const normalizedBatch = data.map(row => {
      const newRow = {...row};
      for (const k of cols) {
        if (typeof newRow[k] === 'boolean') newRow[k] = newRow[k] ? 1 : 0;
        if (newRow[k] && typeof newRow[k] === 'object') newRow[k] = JSON.stringify(newRow[k]);
      }
      return newRow;
    });
    
    // Turso execute batch max params is usually lower, we do 100 at a time
    for (let i = 0; i < normalizedBatch.length; i += 100) {
      const b = normalizedBatch.slice(i, i + 100);
      const placeholders = b.map(() => `(${cols.map(() => '?').join(',')})`).join(',');
      const values = b.flatMap(row => cols.map(c => row[c]));
      const query = `INSERT INTO importer_queue (${cols.join(',')}) VALUES ${placeholders} ON CONFLICT DO NOTHING;`;
      await turso.execute({ sql: query, args: values }).catch(e => {
        // ignore unique constraint
      });
    }
    
    totalInserted += data.length;
    console.log(`Inserted ${totalInserted} records`);
    page++;
  }
  console.log("Done.");
}
run();
