import { createClient } from '@libsql/client';
import fs from 'fs';

const tursoToken = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODk1OTU0MTQsImlkIjoiMDFhMGFjMWYtMzYwMS03Y2U5LTk0YTMtMTU4YzlkZDI3ZmMzIiwia2lkIjoiN3h3VmlDdGo2aVJ3LUZDTEhQZ0RmWlR1eWZ1X2g3UGtvTUM5S2J3VmpzayIsInJpZCI6ImVjOGYyZmRlLWJiNTctNDE0My04ZjliLWNkOTgxN2FkMzI1OCJ9.Ub9FB0Jmvz7W0o9CaJxsBtNlxjFrwtFKwjvK-Mkedpj9834m9L1R82869B3Qpv-McyBSPePQbNGJI_-kpQisCA';
const tursoUrl = 'libsql://project-nox-main-awerkori.aws-us-east-1.turso.io';
const turso = createClient({ url: tursoUrl, authToken: tursoToken });

async function run() {
    const res = await turso.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
    const tables = res.rows.map(r => r.name);
    
    let schemaMap = {};
    for (const table of tables) {
        const info = await turso.execute(`PRAGMA table_info(${table})`);
        schemaMap[table] = info.rows.map(r => ({ name: r.name, type: r.type, pk: r.pk, notnull: r.notnull, dflt_value: r.dflt_value }));
    }
    
    fs.writeFileSync('turso_schema.json', JSON.stringify(schemaMap, null, 2));
    console.log("Dumped turso_schema.json");
}
run();
