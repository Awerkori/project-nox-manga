import { expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { retainClientAssets } from '../scripts/retain-client-assets.mjs';

it('keeps previous hashed assets across builds without restoring old HTML or overwriting current assets', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nox-assets-'));
  try {
    const source = path.join(root, '.svelte-kit/output/client/_app');
    const target = path.join(root, '.svelte-kit/cloudflare/_app');
    fs.mkdirSync(path.join(source, 'immutable'), { recursive: true });
    fs.writeFileSync(path.join(source, 'version.json'), '{"version":"v1"}');
    fs.writeFileSync(path.join(source, 'immutable/old.js'), 'old bundle');
    fs.writeFileSync(path.join(source, 'index.html'), 'old html');
    retainClientAssets('save', root);
    fs.mkdirSync(path.join(target, 'immutable'), { recursive: true });
    fs.writeFileSync(path.join(target, 'immutable/current.js'), 'current bundle');
    fs.writeFileSync(path.join(target, 'version.json'), '{"version":"v2"}');
    retainClientAssets('restore', root);
    expect(fs.readFileSync(path.join(target, 'immutable/old.js'), 'utf8')).toBe('old bundle');
    expect(fs.readFileSync(path.join(target, 'immutable/current.js'), 'utf8')).toBe('current bundle');
    expect(fs.readFileSync(path.join(target, 'version.json'), 'utf8')).toBe('{"version":"v2"}');
    expect(fs.existsSync(path.join(target, 'index.html'))).toBe(false);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
