const fs = require('fs');
let code = fs.readFileSync('src/routes/api/scan/production/upload/+server.ts', 'utf8');

code = code.replace(
  /export const POST = async \({ locals, request }: import\(".\/\$types"\).RequestHandler\) => {/g,
  "export const POST = async ({ locals, request }: any) => {"
);

code = code.replace(
  /insertErr.message/g,
  "(insertErr as any).message"
);

code = code.replace(
  "scanId: scanId,\n        productionChapterId: productionChapterId,",
  "id: crypto.randomUUID(),\n        createdAt: new Date().toISOString(),\n        scanId: scanId,\n        productionChapterId: productionChapterId,"
);

fs.writeFileSync('src/routes/api/scan/production/upload/+server.ts', code);
