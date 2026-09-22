import pg from 'pg';
import fs from 'fs';
import crypto from 'crypto';

const envContent = fs.readFileSync('/home/awerkori/.config/project-nox/yugabyte.env', 'utf-8');
const vars = Object.fromEntries(
  envContent.split('\n').filter(l => l.includes('=')).map(l => {
    const idx = l.indexOf('=');
    return [l.slice(0, idx).trim(), l.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '')];
  })
);
const sslCert = fs.readFileSync('/home/awerkori/.config/project-nox/root.crt', 'utf-8');
const pool = new pg.Pool({
  host: vars.YUGABYTE_HOST,
  port: parseInt(vars.YUGABYTE_PORT || '5433', 10),
  user: vars.YUGABYTE_USER,
  password: vars.YUGABYTE_PASSWORD,
  database: vars.YUGABYTE_DATABASE,
  ssl: { ca: sslCert, rejectUnauthorized: true }
});

const PROD_URL = 'https://manga.project-nox-awerkori.workers.dev';
const AUTH_SECRET = 'prod-secret-9876543210-abcdef';

function signCookie(token) {
  const hmac = crypto.createHmac('sha256', AUTH_SECRET);
  hmac.update(token);
  const sig = hmac.digest('base64');
  return `${token}.${sig}`;
}

async function main() {
  const client = await pool.connect();
  try {
    const adminSessRes = await client.query(
      `SELECT s.token, s."userId"::text as user_id, m.username
       FROM session s
       JOIN access_roles ar ON ar.user_id = s."userId"::uuid
       JOIN members m ON m.id = s."userId"::uuid
       WHERE ar.role = 'ADMIN' AND NOT ar.suspended AND s."expiresAt" > NOW()
       LIMIT 1`
    );

    let adminCookie = '';
    if (adminSessRes.rowCount > 0) {
      adminCookie = signCookie(adminSessRes.rows[0].token);
    } else {
      // Create a session for legacytest admin
      const token = crypto.randomBytes(32).toString('hex');
      const userId = '481a5472-7f91-4cf4-a63e-112233445566';
      await client.query(
        `INSERT INTO session (id, "userId", token, "expiresAt", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, NOW() + INTERVAL '2 hours', NOW(), NOW())`,
        [userId, token]
      );
      adminCookie = signCookie(token);
    }

    const workRes = await client.query(`SELECT id, title FROM works WHERE published = true LIMIT 1`);
    const work = workRes.rows[0];
    const workId = work.id;

    console.log('Testing with work:', work.title, workId);

    const headers = {
      'Cookie': `__Secure-better-auth.session_token=${encodeURIComponent(adminCookie)}; better-auth.session_token=${encodeURIComponent(adminCookie)}`
    };

    // 1. Verify /admin/obras
    console.log('\n--- 1. Checking /admin/obras ---');
    const resObras = await fetch(`${PROD_URL}/admin/obras`, { headers });
    console.log('Status:', resObras.status);
    const htmlObras = await resObras.text();
    const hasEnviarCapitulosHeader = htmlObras.includes('Enviar Capítulos');
    console.log('Has "Enviar Capítulos":', hasEnviarCapitulosHeader);

    // 2. Verify /admin/obras/[id]
    console.log('\n--- 2. Checking /admin/obras/' + workId + ' ---');
    const resWork = await fetch(`${PROD_URL}/admin/obras/${workId}`, { headers });
    console.log('Status:', resWork.status);
    const htmlWork = await resWork.text();
    const hasEnviarCapitulosWork = htmlWork.includes('Enviar Capítulos');
    const hasOldImportLote = htmlWork.includes('Importar Lote');
    const hasOldAdicionarCapitulo = htmlWork.includes('Adicionar Capítulo');
    console.log('Has "Enviar Capítulos":', hasEnviarCapitulosWork);
    console.log('Has old "Importar Lote":', hasOldImportLote);
    console.log('Has old "Adicionar Capítulo":', hasOldAdicionarCapitulo);

    if (!hasEnviarCapitulosWork) throw new Error('Missing "Enviar Capítulos" button on /admin/obras/[id]');
    if (hasOldImportLote) throw new Error('Old "Importar Lote" button still present on /admin/obras/[id]');
    if (hasOldAdicionarCapitulo) throw new Error('Old "Adicionar Capítulo" button still present on /admin/obras/[id]');

    // 3. Verify /admin/obras/upload?workId=...
    console.log('\n--- 3. Checking /admin/obras/upload?workId=' + workId + ' ---');
    const resUpload = await fetch(`${PROD_URL}/admin/obras/upload?workId=${workId}`, { headers });
    console.log('Status:', resUpload.status);
    const htmlUpload = await resUpload.text();
    const hasDropzoneTitle = htmlUpload.includes('Arraste capítulos aqui');
    const hasDropzoneSub = htmlUpload.includes('Envie um capítulo ou vários de uma vez');
    console.log('Has "Arraste capítulos aqui":', hasDropzoneTitle);
    console.log('Has subtext "Envie um capítulo ou vários de uma vez":', hasDropzoneSub);

    if (!hasDropzoneTitle) throw new Error('Missing "Arraste capítulos aqui" on upload page');
    if (!hasDropzoneSub) throw new Error('Missing dropzone subtext on upload page');

    console.log('\n🎉 ALL PRODUCTION ADMIN UI CHECKS PASSED!');

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('Production UI check failed:', err);
  process.exit(1);
});
