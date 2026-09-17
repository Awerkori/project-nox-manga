import { sqliteTable } from 'drizzle-orm/sqlite-core';
import * as schema from './src/lib/server/db/schema';
import fs from 'fs';

const tursoSchema = JSON.parse(fs.readFileSync('turso_schema.json', 'utf-8'));

let mismatches = 0;

for (const [varName, tableObj] of Object.entries(schema)) {
    // Only check actual tables
    if (!tableObj || typeof tableObj !== 'object' || !tableObj[Symbol.for('drizzle:Name')]) continue;
    
    const dbTableName = tableObj[Symbol.for('drizzle:Name')];
    if (!tursoSchema[dbTableName]) {
        console.log(`WARNING: Table ${dbTableName} not found in Turso.`);
        continue;
    }
    
    const tursoCols = tursoSchema[dbTableName].map((c: any) => c.name);
    
    // tableObj has columns or we can get them
    const cols = tableObj[Symbol.for('drizzle:Columns')] || {};
    for (const [propName, colObj] of Object.entries(cols)) {
        const drizzlePhysicalName = colObj.name;
        
        if (!tursoCols.includes(drizzlePhysicalName)) {
            console.error(`MISMATCH: Table ${dbTableName} -> Property ${propName} expects column '${drizzlePhysicalName}', but it doesn't exist in Turso.`);
            mismatches++;
        }
    }
}

console.log(`\nSCHEMA MISMATCHES: ${mismatches}`);
