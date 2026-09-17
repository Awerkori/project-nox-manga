import { createClient as createSupaClient } from '@supabase/supabase-js';
import { createClient as createTursoClient } from '@libsql/client';
import fs from 'fs';

const supaUrl = process.env.PUBLIC_SUPABASE_URL || 'https://izregkwaqdygwioqzwwo.supabase.co';
const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6cmVna3dhcWR5Z3dpb3F6d3dvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODU2NTQ5NCwiZXhwIjoyMTA0MTQxNDk0fQ.ChnMmsSg_w4goxLFbDxEUnxOaBDAAMNG4KoO4RlqQHk';
const supabase = createSupaClient(supaUrl, supaKey);

const tursoToken = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODk1OTU0MTQsImlkIjoiMDFhMGFjMWYtMzYwMS03Y2U5LTk0YTMtMTU4YzlkZDI3ZmMzIiwia2lkIjoiN3h3VmlDdGo2aVJ3LUZDTEhQZ0RmWlR1eWZ1X2g3UGtvTUM5S2J3VmpzayIsInJpZCI6ImVjOGYyZmRlLWJiNTctNDE0My04ZjliLWNkOTgxN2FkMzI1OCJ9.Ub9FB0Jmvz7W0o9CaJxsBtNlxjFrwtFKwjvK-Mkedpj9834m9L1R82869B3Qpv-McyBSPePQbNGJI_-kpQisCA';
const tursoUrl = 'libsql://project-nox-main-awerkori.aws-us-east-1.turso.io';
const turso = createTursoClient({ url: tursoUrl, authToken: tursoToken });

const STATE_FILE = 'sync_state.json';

async function getSyncState() {
    if (fs.existsSync(STATE_FILE)) {
        return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    }
    return {};
}

async function saveSyncState(state) {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// Sync function using cursor-based pagination
async function syncTable(tableName, orderByColumn = 'id', batchSize = 1000) {
    console.log(`Starting keyset sync for ${tableName}...`);
    const state = await getSyncState();
    let lastValue = state[tableName]?.[orderByColumn] || null;
    
    let totalSynced = 0;
    while (true) {
        let query = supabase.from(tableName).select('*').order(orderByColumn, { ascending: true }).limit(batchSize);
        if (lastValue) {
            query = query.gt(orderByColumn, lastValue);
        }

        const { data, error } = await query;
        if (error) {
            console.error(`Error fetching ${tableName} from Supabase:`, error);
            break;
        }

        if (!data || data.length === 0) {
            console.log(`Finished syncing ${tableName}. Total synced: ${totalSynced}`);
            break;
        }

        // Insert into Turso using batched transaction
        try {
            const statements = data.map(row => {
                const columns = Object.keys(row);
                const values = Object.values(row);
                
                const placeholders = columns.map(() => '?').join(', ');
                const cols = columns.map(c => `"${c}"`).join(', ');
                
                return {
                    sql: `INSERT OR REPLACE INTO "${tableName}" (${cols}) VALUES (${placeholders})`,
                    args: values.map(v => {
                        if (v === null) return null;
                        if (typeof v === 'boolean') return v ? 1 : 0;
                        if (typeof v === 'object') return JSON.stringify(v);
                        return v;
                    })
                };
            });

            await turso.batch(statements, "write");
            
            totalSynced += data.length;
            lastValue = data[data.length - 1][orderByColumn];
            
            state[tableName] = state[tableName] || {};
            state[tableName][orderByColumn] = lastValue;
            await saveSyncState(state);
            
            console.log(`Synced ${data.length} rows for ${tableName}. Last ${orderByColumn}: ${lastValue}`);
        } catch (e) {
            console.error(`Error inserting into Turso for ${tableName}:`, e.message);
            break;
        }
    }
}

async function run() {
    await syncTable('works');
    await syncTable('chapters');
    await syncTable('pages');
    // Using created_at for media because it might be heavy on IDs or not sequential? ID is fine.
    await syncTable('media');
    console.log("All done!");
}

// Uncomment to run
run();
