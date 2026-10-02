import { defineConfig } from '@playwright/test';

const port = process.env.PLAYWRIGHT_PORT || '5173';
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './tests/browser',
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
