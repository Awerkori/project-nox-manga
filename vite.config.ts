import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
export default defineConfig({
  plugins: [sveltekit()],
  test: { include: ['tests/**/*.test.ts'] },
  // Permit only isolated component fixtures, and only in the dedicated local test server.
  ...(process.env.NOX_COMPONENT_TEST === '1' ? { server: { fs: { allow: ['tests/fixtures'] } } } : {})
});
