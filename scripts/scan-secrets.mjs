import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
if (existsSync('.env')) process.loadEnvFile('.env');
const values = Object.entries(process.env)
  .filter(([k, v]) => /SERVICE_ROLE|BOT_TOKEN|SECRET|PRIVATE_KEY/.test(k) && v?.length > 15)
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
  ...new Set([
    ...tracked,
    ...(existsSync('.svelte-kit/output/client') ? walk('.svelte-kit/output/client') : []),
    ...(existsSync('.svelte-kit/cloudflare') ? walk('.svelte-kit/cloudflare') : [])
  ])
].filter((file) => existsSync(file));
const failures = [];
function containsSecret(text) {
  const privateJwt = [...text.matchAll(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)].some(
    ([jwt]) => {
      try {
        return JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString()).role !== 'anon';
      } catch {
        return true;
      }
    }
  );
  return (
    values.some((secret) => text.includes(secret)) ||
    privateJwt ||
    /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text) ||
    /gh[pousr]_[A-Za-z0-9]{30,}/.test(text) ||
    /sb_secret_[A-Za-z0-9_-]{20,}/.test(text) ||
    /\b[0-9]{6,15}:[A-Za-z0-9_-]{35}\b/.test(text) ||
    /\b(?:xkeysib|xsmtpsib)-[A-Za-z0-9_-]{20,}/.test(text)
  );
}
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  if (containsSecret(text)) failures.push(file);
}
// Capture history only in memory; never print patches or a matched credential.
const history = spawnSync('git', ['log', '--all', '-p', '--format='], {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024
});
if (history.status !== 0) throw new Error('Cannot inspect complete Git history for secret scanning');
if (containsSecret(history.stdout)) failures.push('Git history');
if (failures.length) {
  console.error('Secret exposure in:', failures);
  process.exitCode = 1;
} else
  console.log(
    `PASS: ${files.length} source/client files and available Git history scanned; no secrets found.`
  );
