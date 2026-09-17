import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { eq, and, isNotNull, desc } from 'drizzle-orm';
import * as schema from './schema.ts';

const client = createClient({
    url: 'libsql://project-nox-main-awerkori.aws-us-east-1.turso.io',
    authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODk1OTU0MTQsImlkIjoiMDFhMGFjMWYtMzYwMS03Y2U5LTk0YTMtMTU4YzlkZDI3ZmMzIiwia2lkIjoiN3h3VmlDdGo2aVJ3LUZDTEhQZ0RmWlR1eWZ1X2g3UGtvTUM5S2J3VmpzayIsInJpZCI6ImVjOGYyZmRlLWJiNTctNDE0My04ZjliLWNkOTgxN2FkMzI1OCJ9.Ub9FB0Jmvz7W0o9CaJxsBtNlxjFrwtFKwjvK-Mkedpj9834m9L1R82869B3Qpv-McyBSPePQbNGJI_-kpQisCA'
});
const db = drizzle(client, { schema });

async function run() {
    try {
        let res = await db.select({
            id: schema.works.id,
            slug: schema.works.slug,
            title: schema.works.title,
            coverId: schema.works.coverId,
            kind: schema.works.kind,
            contentRating: schema.works.contentRating,
            latestChapterPublishedAt: schema.works.latestChapterPublishedAt
        })
        .from(schema.works)
        .where(
            and(
                eq(schema.works.published, true),
                isNotNull(schema.works.latestChapterPublishedAt)
            )
        )
        .orderBy(desc(schema.works.latestChapterPublishedAt))
        .limit(16);
        console.log("Found fallback works:", res.length);
        if (res.length > 0) {
            console.log("Sample:", res[0]);
        }
    } catch(e) {
        console.error("Error:", e);
    }
}
run();
