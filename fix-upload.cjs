const fs = require('fs');
let code = fs.readFileSync('src/routes/api/scan/production/upload/+server.ts', 'utf8');

code = code.replace(
  "scanId: scanId,",
  "id: crypto.randomUUID(),\n        createdAt: new Date().toISOString(),\n        inputFiles: '[]',\n        isStale: 0,\n        scanId: scanId,"
);

code = code.replace(
  "details: {\n          file_name: rawFilename,\n          version: nextVersion,\n          byte_size: file.size,\n          note: note || null\n        } as any",
  "details: JSON.stringify({\n          file_name: rawFilename,\n          version: nextVersion,\n          byte_size: file.size,\n          note: note || null\n        })"
);

fs.writeFileSync('src/routes/api/scan/production/upload/+server.ts', code);
