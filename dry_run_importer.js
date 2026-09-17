import { createClient as createLibsqlClient } from '@libsql/client';
const tursoToken = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODk1OTU0MTQsImlkIjoiMDFhMGFjMWYtMzYwMS03Y2U5LTk0YTMtMTU4YzlkZDI3ZmMzIiwia2lkIjoiN3h3VmlDdGo2aVJ3LUZDTEhQZ0RmWlR1eWZ1X2g3UGtvTUM5S2J3VmpzayIsInJpZCI6ImVjOGYyZmRlLWJiNTctNDE0My04ZjliLWNkOTgxN2FkMzI1OCJ9.Ub9FB0Jmvz7W0o9CaJxsBtNlxjFrwtFKwjvK-Mkedpj9834m9L1R82869B3Qpv-McyBSPePQbNGJI_-kpQisCA';
const tursoUrl = 'libsql://project-nox-main-awerkori.aws-us-east-1.turso.io';
const turso = createLibsqlClient({ url: tursoUrl, authToken: tursoToken });

async function run() {
  console.log("Checking Importer DB states...");
  // 1. Check mapping table
  const maps = await turso.execute('SELECT COUNT(*) as c FROM mappings');
  console.log('Mappings:', maps.rows[0].c);

  // 2. Check leases (active jobs)
  const leases = await turso.execute('SELECT COUNT(*) as c FROM importer_queue WHERE status = ?', ['PROCESSING']);
  console.log('Active processing (should be 0 for dry-run):', leases.rows[0].c);

  // 3. Queue history
  const history = await turso.execute('SELECT status, COUNT(*) as c FROM importer_queue GROUP BY status');
  for (let r of history.rows) {
    console.log(`Queue ${r.status}: ${r.c}`);
  }
}
run();
