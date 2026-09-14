import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Keep two previous bundles so an open tab can finish navigating after deployment.
// Only immutable public assets are retained; never HTML, server code or user data.
export function retainClientAssets(mode, root = process.cwd()) {
  const history = path.join(root, 'artifacts/client-asset-history');
  const current = path.join(root, '.svelte-kit/output/client/_app');
  if (mode === 'save') {
    if (!fs.existsSync(path.join(current, 'version.json'))) return;
    const { version } = JSON.parse(fs.readFileSync(path.join(current, 'version.json'), 'utf8'));
    if (!/^[a-zA-Z0-9_-]+$/.test(version)) throw new Error('Invalid client version');
    fs.mkdirSync(history, { recursive: true });
    const target = path.join(history, version);
    if (!fs.existsSync(target)) fs.cpSync(path.join(current, 'immutable'), target, { recursive: true });
    const versions = fs.readdirSync(history).sort((a, b) => fs.statSync(path.join(history, b)).mtimeMs - fs.statSync(path.join(history, a)).mtimeMs);
    for (const old of versions.slice(2)) fs.rmSync(path.join(history, old), { recursive: true });
  } else if (mode === 'restore') {
    if (!fs.existsSync(history)) return;
    const target = path.join(root, '.svelte-kit/cloudflare/_app/immutable');
    for (const version of fs.readdirSync(history)) {
      fs.cpSync(path.join(history, version), target, { recursive: true, force: false, errorOnExist: false });
    }
  } else throw new Error('Expected save or restore');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  retainClientAssets(process.argv[2]);
}
