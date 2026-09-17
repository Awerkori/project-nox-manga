const fs = require('fs');
let code = fs.readFileSync('src/routes/scan/+page.server.ts', 'utf8');

// 1. Remove all imports
const lines = code.split('\n');
const imports = [];
const body = [];
for (const line of lines) {
  if (line.trim().startsWith('import ') && line.includes('from')) {
    imports.push(line);
  } else {
    body.push(line);
  }
}

// deduplicate named imports
const importMap = {};
for (const imp of imports) {
  const match = imp.match(/import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/);
  if (match) {
    const pkg = match[2];
    const items = match[1].split(',').map(s => s.trim()).filter(Boolean);
    if (!importMap[pkg]) importMap[pkg] = new Set();
    items.forEach(i => importMap[pkg].add(i));
  } else {
    // default imports just keep
    if (!importMap['default']) importMap['default'] = new Set();
    importMap['default'].add(imp);
  }
}

let newImports = '';
for (const pkg in importMap) {
  if (pkg === 'default') {
    newImports += Array.from(importMap[pkg]).join('\n') + '\n';
  } else {
    newImports += `import { ${Array.from(importMap[pkg]).join(', ')} } from '${pkg}';\n`;
  }
}

code = newImports + '\n' + body.join('\n');

// Fix `db.$client.execute` returning a string? Wait, it's `db.get(sql\`...\`)`
// Let's also fix TS2769 and TS18047
code = code.replace(/locals\.db/g, "db"); 
fs.writeFileSync('src/routes/scan/+page.server.ts', code);
