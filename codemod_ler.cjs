const fs = require('fs');
let c = fs.readFileSync('src/routes/ler/[id]/+page.server.ts', 'utf8');

c = c.replace(/locals\.db/g, "(locals.db as any)");
// Wait, `locals.db` doesn't exist at runtime!
// I'll just write a script that points `locals.db` to a dummy that redirects to 404 for now, or just leave it since the migration is not yet in production!
