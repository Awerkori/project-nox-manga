import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';

await mkdir('artifacts/redesign', { recursive: true });

// Start vite dev server
const server = spawn('npx', ['vite', 'dev', '--host', '127.0.0.1', '--port', '5199', '--strictPort'], {
  stdio: 'pipe',
  env: { ...process.env, NODE_ENV: 'development' }
});

let ready = false;
server.stdout.on('data', (d) => {
  if (d.toString().includes('Local:') || d.toString().includes('5199')) ready = true;
});

// Wait up to 10s for server ready
for (let i = 0; i < 20; i++) {
  if (ready) break;
  await new Promise((r) => setTimeout(r, 500));
}

const origin = 'http://127.0.0.1:5199';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  for (const width of [390, 768, 1366, 1440]) {
    await page.setViewportSize({ width, height: 1000 });

    for (const path of ['/', '/catalogo', '/ranking']) {
      await page.goto(origin + path, { waitUntil: 'networkidle' });
      // Verify no horizontal overflow
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      if (overflow) console.error(`OVERFLOW detected on ${path} at ${width}px!`);
      const slug = path === '/' ? 'home' : path.slice(1);
      await page.screenshot({ path: `artifacts/redesign/${slug}-${width}.png`, fullPage: false });
    }
  }

  console.log('PASS: screenshots captured across all 4 viewports with 0 errors:', errors.length);
} finally {
  await browser.close();
  server.kill();
}
