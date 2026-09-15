import { chromium } from '@playwright/test';
import { ownerCookies } from './owner-session.mjs';

const PROD_URL = 'https://manga.project-nox-awerkori.workers.dev';

async function crawl() {
  const cookies = await ownerCookies(PROD_URL);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.addCookies(cookies);
  const page = await context.newPage();

  const visited = new Set();
  const queue = [
    '/',
    '/catalogo',
    '/ranking',
    '/scans',
    '/loja',
    '/me',
    '/admin'
  ];

  const results = {
    ok: [],
    unexpected404: [],
    error5xx: [],
    redirects: []
  };

  // First collect links from Home and Catálogo
  for (const startPath of ['/', '/catalogo', '/ranking', '/scans']) {
    try {
      console.log(`Scanning links on ${startPath}...`);
      await page.goto(PROD_URL + startPath, { waitUntil: 'domcontentloaded' });
      const hrefs = await page.$$eval('a[href]', (as) => as.map((a) => a.getAttribute('href')));
      for (const h of hrefs) {
        if (!h) continue;
        if (h.startsWith('/') && !h.startsWith('//')) {
          const clean = h.split('#')[0].split('?')[0];
          if (!queue.includes(clean) && !visited.has(clean)) {
            // Include obra, ler, scan, u, etc.
            if (
              clean.startsWith('/obra/') ||
              clean.startsWith('/ler/') ||
              clean.startsWith('/scans/') ||
              clean.startsWith('/scan') ||
              clean.startsWith('/u/') ||
              clean.startsWith('/me')
            ) {
              queue.push(clean);
            }
          }
        }
      }
    } catch (err) {
      console.error(`Error scanning ${startPath}:`, err.message);
    }
  }

  console.log(`Total URLs to check in sample: ${queue.length}`);

  for (const path of queue) {
    if (visited.has(path)) continue;
    visited.add(path);

    try {
      const targetUrl = PROD_URL + path;
      const res = await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      const status = res?.status() || 0;
      const bodyText = await page.innerText('body').catch(() => '');

      const isSemantic404 =
        status === 404 ||
        bodyText.includes('Obra não encontrada') ||
        bodyText.includes('Essa página se perdeu na noite') ||
        bodyText.includes('Capítulo indisponível');

      if (isSemantic404) {
        console.warn(`[UNEXPECTED 404] ${path} (status: ${status})`);
        results.unexpected404.push({ path, status, text: bodyText.slice(0, 100) });
      } else if (status >= 500) {
        console.error(`[5XX ERROR] ${path} (status: ${status})`);
        results.error5xx.push({ path, status });
      } else {
        results.ok.push({ path, status });
      }
    } catch (err) {
      console.error(`[FETCH FAIL] ${path}:`, err.message);
      results.error5xx.push({ path, error: err.message });
    }
  }

  console.log('\n==============================================');
  console.log(`CRAWLER SUMMARY:`);
  console.log(`OK: ${results.ok.length}`);
  console.log(`Unexpected 404: ${results.unexpected404.length}`);
  console.log(`5xx Errors: ${results.error5xx.length}`);
  if (results.unexpected404.length > 0) {
    console.log(`404 Details:`, JSON.stringify(results.unexpected404, null, 2));
  }
  console.log('==============================================\n');

  await browser.close();
}

crawl().catch(console.error);
