import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { eq, and, isNotNull, desc } from 'drizzle-orm';
import * as schema from './src/lib/server/db/schema.ts';

const client = createClient({
    url: 'libsql://project-nox-main-awerkori.aws-us-east-1.turso.io',
    authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODk1OTU0MTQsImlkIjoiMDFhMGFjMWYtMzYwMS03Y2U5LTk0YTMtMTU4YzlkZDI3ZmMzIiwia2lkIjoiN3h3VmlDdGo2aVJ3LUZDTEhQZ0RmWlR1eWZ1X2g3UGtvTUM5S2J3VmpzayIsInJpZCI6ImVjOGYyZmRlLWJiNTctNDE0My04ZjliLWNkOTgxN2FkMzI1OCJ9.Ub9FB0Jmvz7W0o9CaJxsBtNlxjFrwtFKwjvK-Mkedpj9834m9L1R82869B3Qpv-McyBSPePQbNGJI_-kpQisCA'
});
const db = drizzle(client, { schema });

async function run() {
    console.log("Testing works.published == true");
    let res = await db.select().from(schema.works).where(eq(schema.works.published, true)).limit(5);
    console.log("Count true:", res.length);
    
    let res1 = await db.select().from(schema.works).where(eq(schema.works.published, 1 as any)).limit(5);
    console.log("Count 1:", res1.length);
}
run();
