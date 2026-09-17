const fs = require('fs');

const schema = fs.readFileSync('src/lib/server/db/schema.ts', 'utf8');
const camelCaseKeys = new Set();

// Extract all keys from the schema object definitions
// e.g. `createdAt: text("created_at")`
const regex = /\s+([a-zA-Z0-9]+):\s*(text|integer|real|blob)/g;
let match;
while ((match = regex.exec(schema)) !== null) {
  const key = match[1];
  if (key !== key.toLowerCase()) { // it's camelCase
    camelCaseKeys.add(key);
  }
}

// Map them to snake_case
function toSnakeCase(str) {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

const snakeToCamel = {};
for (const camel of camelCaseKeys) {
  const snake = toSnakeCase(camel);
  if (snake !== camel) {
    snakeToCamel[snake] = camel;
  }
}

console.log(JSON.stringify(snakeToCamel, null, 2));
fs.writeFileSync('snake-map.json', JSON.stringify(snakeToCamel, null, 2));
