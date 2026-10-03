import { defineConfig } from '@playwright/test';

const port = process.env.PLAYWRIGHT_PORT || '5173';
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './tests/browser',
  // Browser fixtures share one Vite development server. Parallel workers can
  // race its dependency optimizer and leave a fixture module on a transient
  // 5xx; keep this visual suite deterministic rather than skipping coverage.
  workers: 1,
  fullyParallel: false,
  use: { baseURL, headless: true },
  webServer: {
    command: `npm run dev -- --port ${port} --strictPort`,
    env: { NOX_COMPONENT_TEST: '1' },
    url: `${baseURL}/@vite/client`,
    reuseExistingServer: true
  },
  reporter: 'list'
});
