const fs = require('fs');

let code = fs.readFileSync('src/routes/scans/[slug]/+page.server.ts', 'utf8');

code = code.replace(/const scan = await safeQuerySingle\(/g, "const { data: scan } = await safeQuerySingle(");
code = code.replace(/const hist = await safeQuerySingle\(/g, "const { data: hist } = await safeQuerySingle(");
code = code.replace(/const opRes = await safeQuery\(/g, "const { data: opRes } = await safeQuery(");
code = code.replace(/const leads = await safeQuery\(/g, "const { data: leads } = await safeQuery(");
code = code.replace(/const parent = await safeQuerySingle\(/g, "const { data: parent } = await safeQuerySingle(");

fs.writeFileSync('src/routes/scans/[slug]/+page.server.ts', code);
