import { createClient as createLibsqlClient } from '@libsql/client';

const tursoToken = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODk1OTU0MTQsImlkIjoiMDFhMGFjMWYtMzYwMS03Y2U5LTk0YTMtMTU4YzlkZDI3ZmMzIiwia2lkIjoiN3h3VmlDdGo2aVJ3LUZDTEhQZ0RmWlR1eWZ1X2g3UGtvTUM5S2J3VmpzayIsInJpZCI6ImVjOGYyZmRlLWJiNTctNDE0My04ZjliLWNkOTgxN2FkMzI1OCJ9.Ub9FB0Jmvz7W0o9CaJxsBtNlxjFrwtFKwjvK-Mkedpj9834m9L1R82869B3Qpv-McyBSPePQbNGJI_-kpQisCA';
const tursoUrl = 'libsql://project-nox-main-awerkori.aws-us-east-1.turso.io';
const turso = createLibsqlClient({ url: tursoUrl, authToken: tursoToken });

async function run() {
    let res = await turso.execute("PRAGMA table_info(works)");
    console.log(res.rows.map(r => r.name).join(", "));
}
run();
