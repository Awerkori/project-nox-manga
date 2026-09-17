import { createClient } from '@supabase/supabase-js';
import { createClient as createLibsqlClient } from '@libsql/client';

const tursoToken = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODk1OTU0MTQsImlkIjoiMDFhMGFjMWYtMzYwMS03Y2U5LTk0YTMtMTU4YzlkZDI3ZmMzIiwia2lkIjoiN3h3VmlDdGo2aVJ3LUZDTEhQZ0RmWlR1eWZ1X2g3UGtvTUM5S2J3VmpzayIsInJpZCI6ImVjOGYyZmRlLWJiNTctNDE0My04ZjliLWNkOTgxN2FkMzI1OCJ9.Ub9FB0Jmvz7W0o9CaJxsBtNlxjFrwtFKwjvK-Mkedpj9834m9L1R82869B3Qpv-McyBSPePQbNGJI_-kpQisCA';
const tursoUrl = 'libsql://project-nox-main-awerkori.aws-us-east-1.turso.io';
const turso = createLibsqlClient({ url: tursoUrl, authToken: tursoToken });

const supabaseUrl = 'https://izregkwaqdygwioqzwwo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6cmVna3dhcWR5Z3dpb3F6d3dvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODU2NTQ5NCwiZXhwIjoyMTA0MTQxNDk0fQ.ChnMmsSg_w4goxLFbDxEUnxOaBDAAMNG4KoO4RlqQHk';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Checking Supabase...");
  // Group by status is not supported directly in supabase-js select, we have to call RPC or pull everything
  // Let's use REST API manually or just group via RPC if one exists.
  // Actually, we can fetch count for each status.
  const statuses = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'];
  let sbCounts = {};
  for(let s of statuses) {
    const { count } = await supabase.from('importer_queue').select('*', { count: 'exact', head: true }).eq('status', s);
    sbCounts[s] = count || 0;
  }
  
  console.log("Checking Turso...");
  const rs = await turso.execute(`SELECT status, count(*) as c FROM importer_queue GROUP BY status`);
  let trCounts = {};
  for(let row of rs.rows) trCounts[row.status] = row.c;
  
  console.log("--- IMPORTER QUEUE STATUS PARITY ---");
  console.log("STATUS | SUPABASE | TURSO | DIFF");
  for(let s of statuses) {
    let sb = sbCounts[s] || 0;
    let tr = trCounts[s] || 0;
    console.log(`${s} | ${sb} | ${tr} | ${sb - tr}`);
  }
}
run();
