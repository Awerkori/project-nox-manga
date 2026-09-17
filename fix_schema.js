import fs from 'fs';

const tursoSchema = JSON.parse(fs.readFileSync('turso_schema.json', 'utf-8'));
let schemaContent = fs.readFileSync('src/lib/server/db/schema.ts', 'utf-8');

// Function to convert camelCase to snake_case
function toSnakeCase(str) {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

// We will split the file by lines.
// If a line looks like `\tpropertyName: type(`, we will inject the snake case name.
const lines = schemaContent.split('\n');
const fixedLines = [];

// Keep track of current table being defined
let currentTable = null;

for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Detect table definition: export const tableName = sqliteTable('table_name', {
    const tableMatch = line.match(/export const (\w+) = sqliteTable\('([^']+)',/);
    if (tableMatch) {
        currentTable = tableMatch[2];
    } else if (line.includes(' = sqliteTable(')) {
        // Fallback for multiline
        const tableMatch2 = line.match(/export const (\w+) = sqliteTable\(/);
        if (tableMatch2) {
            // next line should have the table name
            const nextLineMatch = lines[i+1]?.match(/'([^']+)'/);
            if (nextLineMatch) {
                currentTable = nextLineMatch[1];
            }
        }
    }

    if (currentTable && tursoSchema[currentTable]) {
        // Detect column definition: `propName: type(`
        // Matches things like `coverId: text("coverId"),`
        // or `updatedAt: text(),`
        const colMatch = line.match(/^(\s*)([a-zA-Z0-9_]+)\s*:\s*(text|integer|real|blob|numeric)\(([^)]*)\)(.*)$/);
        if (colMatch) {
            const [_, space, propName, type, args, rest] = colMatch;
            
            // Check if this property maps to a valid column in Turso
            let snakeProp = toSnakeCase(propName);
            let targetCol = null;

            // Find matching column in Turso
            const tableCols = tursoSchema[currentTable];
            if (tableCols.find(c => c.name === propName)) {
                targetCol = propName;
            } else if (tableCols.find(c => c.name === snakeProp)) {
                targetCol = snakeProp;
            }

            if (targetCol) {
                // We need to rewrite args.
                // If args already starts with a string like `"propName"`, replace it.
                // Otherwise, insert it.
                let newArgs = args;
                if (args.trim() === '') {
                    newArgs = `'${targetCol}'`;
                } else if (args.match(/^['"][^'"]+['"](.*)$/)) {
                    newArgs = args.replace(/^['"][^'"]+['"]/, `'${targetCol}'`);
                } else if (args.trim().startsWith('{')) {
                    // e.g. integer({ mode: 'boolean' })
                    newArgs = `'${targetCol}', ` + args.trim();
                }

                line = `${space}${propName}: ${type}(${newArgs})${rest}`;
            }
        } else {
            // Try to match multiline definitions like:
            // updatedAt: text("updatedAt")
            //   .notNull()
            const colMatchMultiline = line.match(/^(\s*)([a-zA-Z0-9_]+)\s*:\s*(text|integer|real|blob|numeric)\(([^)]*)\)(.*)$/);
            if (colMatchMultiline) {
                // It is handled by the first regex anyway since it's the same.
            }
        }
    }

    fixedLines.push(line);
}

fs.writeFileSync('src/lib/server/db/schema.ts', fixedLines.join('\n'));
console.log("Schema rewritten!");
