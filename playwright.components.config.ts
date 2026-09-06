import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  use: { baseURL: 'http://127.0.0.1:5173', headless: true },
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    env: { NOX_COMPONENT_TEST: '1' },
    url: 'http://127.0.0.1:5173/@vite/client',
    reuseExistingServer: false
  },
  reporter: 'list'
});
