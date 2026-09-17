import { sql } from 'drizzle-orm';
const q = sql.raw('SELECT 1');
console.log(q.queryChunks[0].value[0]);
