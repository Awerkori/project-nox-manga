const { drizzle } = require('drizzle-orm/better-sqlite3');
const Database = require('better-sqlite3');
const sqlite = new Database(':memory:');
const schema = require('./src/lib/server/db/schema');
const memDb = drizzle(sqlite, { schema });
console.log(Object.keys(schema));
