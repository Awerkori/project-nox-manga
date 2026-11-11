import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import fs from 'node:fs';
import path from 'node:path';

function isFsWritable(): boolean {
  try {
    fs.accessSync(process.cwd(), fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

const writable = isFsWritable();

export default defineConfig({
  ...(writable ? { cacheDir: '/tmp/vite-cache' } : {}),
  plugins: writable ? [sveltekit()] : [],
  resolve: {
    alias: {
      $lib: path.resolve('./src/lib'),
      '$app/environment': path.resolve('./tests/mocks/app-environment.ts'),
      '$env/dynamic/private': path.resolve('./tests/mocks/env.ts'),
      '$env/dynamic/public': path.resolve('./tests/mocks/env.ts'),
      '$env/static/private': path.resolve('./tests/mocks/env.ts'),
      '$env/static/public': path.resolve('./tests/mocks/env.ts')
    }
  },
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 25000,
    env: {
      AUTH_SECRET: 'test-secret-test-secret-test-secret-32b',
      JWT_SECRET: 'test-secret-test-secret-test-secret-32b',
      BETTER_AUTH_SECRET: 'test-secret-test-secret-test-secret-32b'
    }
  },
  server: { fs: { allow: ['tests/fixtures'] } }
});
