import { chromium } from '@playwright/test';
import { resolve } from 'node:path';

const artifactDir = '/home/awerkori/.gemini/antigravity-cli/brain/77ca9c93-730c-4572-bdd3-2f5c6d80e854';
const prodUrl = 'https://manga.project-nox-awerkori.workers.dev';

const routes = [
  { name: 'home', path: '/' },
  { name: 'obra', path: '/obra/distant-sky' },
  { name: 'ranking', path: '/ranking' },
  { name: 'reader', path: '/ler/c7c41e9f-40e8-459b-9a59-6511ec927714' },
  { name: 'catalogo', path: '/catalogo' }
];

const viewports = [
  { label: 'desktop', width: 1440, height: 900 },
  { label: 'mobile', width: 390, height: 844 }
];

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();

const results = [];

for (const vp of viewports) {
  await page.setViewportSize({ width: vp.width, height: vp.height });

  for (const r of routes) {
    const targetUrl = `${prodUrl}${r.path}`;
    console.log(`Navigating to ${targetUrl} [${vp.label}: ${vp.width}x${vp.height}]...`);
    try {
      await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 25000 });
      await page.waitForTimeout(1000); // Allow fonts and animations to settle

      // Check overflow
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      if (overflow) {
        console.warn(`[OVERFLOW DETECTED] on ${r.name} at ${vp.width}px!`);
      }

      const outPath = resolve(artifactDir, `prod-top-tier-${r.name}-${vp.label}.png`);
      await page.screenshot({ path: outPath, fullPage: false });
      console.log(`Saved screenshot: ${outPath}`);
      results.push({ route: r.name, vp: vp.label, overflow, path: outPath });
    } catch (err) {
      console.error(`Error on ${r.name} (${vp.label}):`, err.message);
    }
  }
}

await browser.close();
console.log('Capture finished with', results.length, 'screenshots.');
