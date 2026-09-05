import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
if (existsSync('.env')) process.loadEnvFile('.env');
const values = Object.entries(process.env)
  .filter(([k, v]) => /SERVICE_ROLE|BOT_TOKEN|SECRET|PRIVATE_KEY/.test(k) && v?.length > 15)
  .map(([, v]) => v);
const git = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
  encoding: 'utf8'
});
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
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  if (
    values.some((secret) => text.includes(secret)) ||
    /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text) ||
    /gh[pousr]_[A-Za-z0-9]{30,}/.test(text) ||
    /sb_secret_[A-Za-z0-9_-]{20,}/.test(text)
  )
    failures.push(file);
}
if (failures.length) {
  console.error('Secret exposure in:', failures);
  process.exitCode = 1;
} else console.log(`PASS: ${files.length} source/client files scanned; no configured secrets found.`);
