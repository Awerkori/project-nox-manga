import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
export default defineConfig({
  cacheDir: '/tmp/vite-cache',
  plugins: [sveltekit()],
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
