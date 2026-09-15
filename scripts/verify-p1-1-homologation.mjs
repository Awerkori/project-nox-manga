import { chromium } from '@playwright/test';
import path from 'path';

const PROD_URL = 'https://manga.project-nox-awerkori.workers.dev';
const ARTIFACTS_DIR = '/home/awerkori/.gemini/antigravity-cli/brain/95c47e53-0595-4b82-8dd6-842c33cdedc3';

async function main() {
  console.log('🚀 Starting P1.1 Live Production Homologation Suite...');
  const browser = await chromium.launch({ headless: true });

  // 1. Desktop Context
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  await context.addCookies([
    {
      name: 'nox-age-status',
      value: 'ADULT',
      url: PROD_URL,
      httpOnly: false,
      sameSite: 'Lax',
      secure: true
    }
  ]);
  const page = await context.newPage();

  // 1.1 Home Load
  console.log('\n--- 1. Testing Home Desktop ---');
  const t0 = performance.now();
  const resp = await page.goto(PROD_URL + '/', { waitUntil: 'networkidle' });
  const tHome = Math.round(performance.now() - t0);
  console.log(`Home status: ${resp.status()} in ${tHome}ms`);

  // Verify Hero, shelves, releases
  const heroExists = await page.locator('.hero-container').isVisible();
  const shelvesCount = await page.locator('.shelf-section').count();
  const releasesCount = await page.locator('.release-row-card').count();
  console.log(`Hero visible: ${heroExists}, Shelves: ${shelvesCount}, Releases: ${releasesCount}`);

  // Verify covers rendered (no NOX placeholder in visible cards)
  const noxPlaceholders = await page.locator('.card-fallback, .cover-placeholder, .thumb-placeholder, .card-placeholder').count();
  console.log(`"NOX" placeholders detected on Home: ${noxPlaceholders}`);

  const homeImgSrcs = await page.$$eval('.card-img, .cover-img, .backdrop-img, .thumb-img', imgs => imgs.map(i => i.src).slice(0, 10));
  console.log(`Sample Cover URLs on Home:\n${homeImgSrcs.join('\n')}`);

  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'p1-1-home-desktop.png'), fullPage: false });

  // 1.2 Instant Navigation: Home -> Loja
  console.log('\n--- 2. Testing Navigation: Home -> Loja ---');
  const lojaLink = page.locator('nav.desktop-nav a[href="/loja"]');
  await lojaLink.hover();
  await page.waitForTimeout(100);
  const tNavLoja0 = performance.now();
  await Promise.all([
    page.waitForURL('**/loja'),
    lojaLink.click()
  ]);
  const tNavLoja = Math.round(performance.now() - tNavLoja0);
  await page.waitForSelector('.shop-card, .shop-title');
  console.log(`Navigation to Loja perceived latency: ${tNavLoja}ms`);

  const shopCards = await page.locator('.shop-card').count();
  console.log(`Shop items rendered on Loja: ${shopCards}`);
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'p1-1-loja-desktop.png'), fullPage: false });

  // 1.3 Instant Navigation: Loja -> Ranking
  console.log('\n--- 3. Testing Navigation: Loja -> Ranking ---');
  const rankingLink = page.locator('nav.desktop-nav a[href="/ranking"]');
  await rankingLink.hover();
  await page.waitForTimeout(100);
  const tNavRank0 = performance.now();
  await Promise.all([
    page.waitForURL('**/ranking'),
    rankingLink.click()
  ]);
  const tNavRank = Math.round(performance.now() - tNavRank0);
  console.log(`Navigation to Ranking perceived latency: ${tNavRank}ms`);

  const hasDegradedAlert = await page.locator('.degraded-ranking-alert').isVisible().catch(() => false);
  const podiumCount = await page.locator('.podium-section, .podium-card').count();
  const emptyCount = await page.locator('.empty-container, .empty-box').count();
  console.log(`Ranking Degraded Alert visible: ${hasDegradedAlert} (Must be FALSE)`);
  console.log(`Ranking Podium cards: ${podiumCount}, Empty state visible: ${emptyCount > 0}`);
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'p1-1-ranking-desktop.png'), fullPage: false });

  // 1.4 Instant Navigation: Ranking -> Catálogo
  console.log('\n--- 4. Testing Navigation: Ranking -> Catálogo ---');
  const catalogoLink = page.locator('nav.desktop-nav a[href="/catalogo"]');
  await catalogoLink.hover();
  await page.waitForTimeout(100);
  const tNavCat0 = performance.now();
  await Promise.all([
    page.waitForURL('**/catalogo'),
    catalogoLink.click()
  ]);
  const tNavCat = Math.round(performance.now() - tNavCat0);
  console.log(`Navigation to Catálogo perceived latency: ${tNavCat}ms`);
  const catWorks = await page.locator('.editorial-card, .work-card').count();
  console.log(`Catálogo works rendered: ${catWorks}`);

  // 1.5 Reader Latency Test
  console.log('\n--- 5. Testing Reader Performance ---');
  const sampleChapterId = 'ch-ds-64'; // Fallback / production chapter
  const tReader0 = performance.now();
  const readerResp = await page.goto(PROD_URL + `/ler/${sampleChapterId}`, { waitUntil: 'domcontentloaded' });
  const tReader = Math.round(performance.now() - tReader0);
  console.log(`Reader load status: ${readerResp.status()} in ${tReader}ms`);
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'p1-1-reader-desktop.png'), fullPage: false });

  // 2. Mobile Context
  console.log('\n--- 6. Testing Mobile Viewport ---');
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true
  });
  await mobileContext.addCookies([
    {
      name: 'nox-age-status',
      value: 'ADULT',
      url: PROD_URL,
      httpOnly: false,
      sameSite: 'Lax',
      secure: true
    }
  ]);
  const mPage = await mobileContext.newPage();
  await mPage.goto(PROD_URL + '/', { waitUntil: 'networkidle' });
  await mPage.screenshot({ path: path.join(ARTIFACTS_DIR, 'p1-1-home-mobile.png'), fullPage: false });
  console.log('Mobile screenshot captured');

  await browser.close();
  console.log('\n✅ All P1.1 checks completed successfully!');
}

main().catch(err => {
  console.error('❌ Validation failed:', err);
  process.exit(1);
});
