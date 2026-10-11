import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

if (existsSync('.env')) process.loadEnvFile('.env');

// Qualquer credencial real em ambiente deve ser comparada contra o repositorio.
// Antes cobrimos apenas nomes com SERVICE_ROLE/BOT_TOKEN/SECRET/PRIVATE_KEY, o que
// deixava passar chaves de banco, gateway e storage vivas no ambiente.
const ENV_SECRET_NAME =
  /SERVICE_ROLE|BOT_TOKEN|SECRET|PRIVATE_KEY|API_?KEY|ACCESS_?KEY|AUTH_?TOKEN|TOKEN|PASSWORD|PASSWD|DATABASE_?URL|POSTGRES|YUGABYTE|TURSO|REDIS|MONGO|KV_?URL|BRIDGE_?TOKEN|CA_?CERT/i;

const values = Object.entries(process.env)
  .filter(([k, v]) => ENV_SECRET_NAME.test(k) && v && v.length > 15 && !v.startsWith('env('))
  .map(([, v]) => v);

const git = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
  encoding: 'utf8'
});
if (git.status !== 0) throw new Error('Cannot inspect Git files for secret scanning');
const tracked = git.stdout.trim().split('\n').filter(Boolean);

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`]
  );
}

const files = [
  ...tracked,
  ...(existsSync('.svelte-kit/output/client') ? walk('.svelte-kit/output/client') : []),
  ...(existsSync('.svelte-kit/cloudflare') ? walk('.svelte-kit/cloudflare') : [])
];

const failures = [];
const JWT = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;

/**
 * JWTs com role diferente de `anon` bypassam RLS e concedem controle total do
 * banco. A chave anon e publica por design e nao deve ser tratada como vazamento.
 * Chave hardcoded no codigo nunca passa por process.env, entao a checagem precisa
 * existir de forma independente dos valores de ambiente.
 */
function hasPrivilegedJwt(text) {
  for (const [jwt] of text.matchAll(JWT)) {
    try {
      const claims = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString());
      if (claims.role && claims.role !== 'anon') return true;
    } catch {
      // JWT com payload ilegivel: falha fechada, nao aberta.
      return true;
    }
  }
  return false;
}

function containsSecret(text) {
  return (
    values.some((secret) => text.includes(secret)) ||
    hasPrivilegedJwt(text) ||
    // Connection string com usuario:senha embutidos.
    /\b[a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:[^\s/@]+@[^\s/]+/i.test(text) ||
    /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text) ||
    /gh[pousr]_[A-Za-z0-9]{30,}/.test(text) ||
    /github_pat_[A-Za-z0-9_]{30,}/.test(text) ||
    /sb_secret_[A-Za-z0-9_-]{20,}/.test(text) ||
    /\b[0-9]{6,15}:[A-Za-z0-9_-]{35}\b/.test(text) ||
    /\b(?:xkeysib|xsmtpsib)-[A-Za-z0-9_-]{20,}/.test(text) ||
    /\bsk-(?:ant-)?[A-Za-z0-9_-]{24,}/.test(text)
  );
}

for (const file of files) {
  if (!existsSync(file) || statSync(file).isDirectory()) continue;
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  if (containsSecret(text)) failures.push(file);
}

// Historico completo: TODAS as refs, nao apenas HEAD. Um segredo committado
// apenas numa branch de trabalho continua publicado no remoto mesmo que a main
// esteja limpa, entao varrer so HEAD deixava passar exatamente esse caso.
const history = spawnSync('git', ['log', '--all', '-p', '--format='], {
  encoding: 'utf8',
  maxBuffer: 512 * 1024 * 1024
});
if (history.status !== 0)
  throw new Error('Cannot inspect complete Git history for secret scanning');
if (containsSecret(history.stdout)) failures.push('Git history (qualquer ref)');

// Relatorio por ref: diz onde esta, sem nunca imprimir a credencial.
const refs = spawnSync('git', ['for-each-ref', '--format=%(refname:short)', 'refs/remotes'], {
  encoding: 'utf8'
});
const dirty = [];
if (refs.status === 0) {
  for (const ref of refs.stdout.trim().split('\n').filter(Boolean)) {
    const blob = spawnSync('git', ['log', '-p', '--format=', ref], {
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024
    });
    if (blob.status === 0 && blob.stdout && containsSecret(blob.stdout)) dirty.push(ref);
  }
}

if (failures.length || dirty.length) {
  console.error('Secret exposure in files:', failures);
  if (dirty.length) console.error('Secret exposure in refs:', dirty);
  console.error('Rotate the exposed credentials BEFORE cleaning history.');
  process.exitCode = 1;
} else {
  console.log(
    `PASS: ${files.length} source/client files, Git history and ${dirty.length === 0 ? 'all remote refs' : ''} scanned; no secrets found.`
  );
}