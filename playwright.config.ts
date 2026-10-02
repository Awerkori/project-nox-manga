import { defineConfig } from '@playwright/test';

const port = process.env.PLAYWRIGHT_PORT || '5173';
const localBaseURL = `http://127.0.0.1:${port}`;
const baseURL = process.env.TEST_BASE_URL || localBaseURL;
const webServer = process.env.TEST_BASE_URL
  ? undefined
  : {
      command: `npm run dev -- --port ${port} --strictPort`,
      url: localBaseURL,
      reuseExistingServer: true
    };

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  use: {
    baseURL,
    headless: true,
    trace: 'retain-on-failure'
  },
  webServer,
  reporter: 'list'
});
