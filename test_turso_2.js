import { createClient as createLibsqlClient } from '@libsql/client';

const tursoToken = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODk1OTU0MTQsImlkIjoiMDFhMGFjMWYtMzYwMS03Y2U5LTk0YTMtMTU4YzlkZDI3ZmMzIiwia2lkIjoiN3h3VmlDdGo2aVJ3LUZDTEhQZ0RmWlR1eWZ1X2g3UGtvTUM5S2J3VmpzayIsInJpZCI6ImVjOGYyZmRlLWJiNTctNDE0My04ZjliLWNkOTgxN2FkMzI1OCJ9.Ub9FB0Jmvz7W0o9CaJxsBtNlxjFrwtFKwjvK-Mkedpj9834m9L1R82869B3Qpv-McyBSPePQbNGJI_-kpQisCA';
const tursoUrl = 'libsql://project-nox-main-awerkori.aws-us-east-1.turso.io';
const turso = createLibsqlClient({ url: tursoUrl, authToken: tursoToken });

async function run() {
    let res = await turso.execute("SELECT count(*) as c FROM works WHERE latest_chapter_published_at IS NOT NULL");
    console.log("Count with latest_chapter_published_at NOT NULL:", res.rows[0].c);

    let res2 = await turso.execute("SELECT latest_chapter_published_at FROM works WHERE published = 1 LIMIT 5");
    console.log("Samples:", res2.rows);
}
run();
