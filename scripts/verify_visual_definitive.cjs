const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const PREVIEW_URL = 'https://home-preview-manga.project-nox-awerkori.workers.dev';
const ARTIFACT_DIR = '/home/awerkori/.gemini/antigravity-cli/brain/fa6d1923-db0b-428b-bc07-4973adaffd49';

async function bypassAgeGate(ctx) {
  await ctx.addCookies([
    {
      name: 'age_confirmed',
      value: 'true',
      domain: 'home-preview-manga.project-nox-awerkori.workers.dev',
      path: '/'
    },
    {
      name: 'nox-age-status',
      value: 'ADULT',
      domain: 'home-preview-manga.project-nox-awerkori.workers.dev',
      path: '/'
    }
  ]);
}

async function dismissModals(page) {
  try {
    const ageBtn = page.locator('button:has-text("Sim, tenho 18 anos ou mais"), button:has-text("Tenho mais de 18 anos"), button:has-text("Confirmar Maioridade"), button:has-text("Sim, sou maior"), .btn-choice.adult');
    if (await ageBtn.count() > 0 && await ageBtn.first().isVisible()) {
      await ageBtn.first().click({ force: true });
      await page.waitForTimeout(300);
    }
  } catch {}
}

async function run() {
  console.log('=== PROJECT NOX: DEFINITIVE VISUAL & FUNCTIONAL VERIFICATION ===');
  const browser = await chromium.launch({ headless: true });
  const results = {
    timestamp: new Date().toISOString(),
    checks: [],
    screenshots: []
  };

  function logCheck(name, pass, detail = '') {
    console.log(`[${pass ? 'PASS' : 'FAIL'}] ${name}${detail ? ` - ${detail}` : ''}`);
    results.checks.push({ name, pass, detail });
    if (!pass) throw new Error(`Assertion failed: ${name} (${detail})`);
  }

  try {
    // -----------------------------------------------------------------
    // 1. DESKTOP VIEWPORT (1440x900)
    // -----------------------------------------------------------------
    const ctxDesktop = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2
    });
    await bypassAgeGate(ctxDesktop);
    const page = await ctxDesktop.newPage();

    console.log('\n--- 1. Testing Home Releases Section ---');
    await page.goto(PREVIEW_URL, { waitUntil: 'networkidle' });
    await dismissModals(page);

    // Scroll to releases section
    const releasesSection = page.locator('#lancamentos');
    await releasesSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    // Assert: Top header link "Ver todos os lançamentos" exists
    const topLink = page.locator('#lancamentos .view-all-link');
    logCheck('Top "Ver todos os lançamentos" link in header exists', await topLink.count() === 1, await topLink.first().getAttribute('href'));

    // Assert: BOTTOM BUTTON MUST BE COMPLETELY GONE
    const bottomButtons = page.locator('#lancamentos .releases-footer-tools, #lancamentos .btn-view-all-releases, #lancamentos .btn-load-releases');
    const bottomCount = await bottomButtons.count();
    logCheck('Bottom "Ver todos os lançamentos" button completely eliminated', bottomCount === 0, `Count: ${bottomCount}`);

    // Capture screenshot of Home releases section showing only one button
    const shotHomeReleases = path.join(ARTIFACT_DIR, 'preview_home_single_button.png');
    await releasesSection.screenshot({ path: shotHomeReleases });
    results.screenshots.push({ name: 'preview_home_single_button', path: shotHomeReleases });
    logCheck('Captured preview_home_single_button.png', true);

    // -----------------------------------------------------------------
    // 2. NAVIGATE TO /lancamentos VIA TOP LINK
    // -----------------------------------------------------------------
    console.log('\n--- 2. Navigating to /lancamentos ---');
    await topLink.first().click();
    await page.waitForURL('**/lancamentos*', { waitUntil: 'commit' });
    await page.waitForSelector('.releases-grid', { timeout: 10000 });
    await page.waitForTimeout(600);

    // Assert: Page header elements are visible
    const pageTitle = page.locator('.page-title');
    logCheck('Page title "LANÇAMENTOS" visible', await pageTitle.isVisible(), await pageTitle.innerText());

    const filterBar = page.locator('.filter-bar');
    logCheck('Category filter bar visible', await filterBar.isVisible());

    // Assert: Cards on Page 1 are fully rendered with title, kind, timestamp, and chapter pills
    const cards = page.locator('.release-row-card');
    const cardCount = await cards.count();
    logCheck('Cards rendered on Page 1', cardCount === 24, `Found: ${cardCount}`);

    // Check first 3 cards in detail
    for (let i = 0; i < 3; i++) {
      const c = cards.nth(i);
      const title = await c.locator('.work-link').innerText();
      const kind = await c.locator('.kind-tag').innerText();
      const time = await c.locator('.timestamp-box time').innerText();
      const pills = await c.locator('.chapter-pill').count();
      const thumb = await c.locator('.thumb-img').isVisible();
      logCheck(`Card ${i + 1} (${title}) fully populated`, title.length > 0 && kind.length > 0 && pills > 0 && thumb, `Kind: ${kind}, Time: ${time}, Chapters: ${pills}`);
    }

    // Capture Page 1 Viewport Screenshot (Cards + Header fully visible!)
    const shotPage1Top = path.join(ARTIFACT_DIR, 'preview_lancamentos_page1_top.png');
    await page.screenshot({ path: shotPage1Top, fullPage: false });
    results.screenshots.push({ name: 'preview_lancamentos_page1_top', path: shotPage1Top });
    logCheck('Captured preview_lancamentos_page1_top.png', true);

    // Scroll down to Pagination controls on Page 1
    const pagination = page.locator('.pagination-section');
    await pagination.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    const shotPage1Pagination = path.join(ARTIFACT_DIR, 'preview_lancamentos_page1_pagination.png');
    await page.screenshot({ path: shotPage1Pagination, fullPage: false });
    results.screenshots.push({ name: 'preview_lancamentos_page1_pagination', path: shotPage1Pagination });
    logCheck('Captured preview_lancamentos_page1_pagination.png', true);

    // -----------------------------------------------------------------
    // 3. PAGE 2 PAGINATION
    // -----------------------------------------------------------------
    console.log('\n--- 3. Navigating to Page 2 ---');
    const btnPage2 = page.locator('.page-numbers-cluster a.btn-page-num:has-text("2")');
    await btnPage2.click();
    await page.waitForURL('**/lancamentos?page=2*', { waitUntil: 'commit' });
    await page.waitForSelector('.releases-grid', { timeout: 10000 });
    await page.waitForTimeout(500);

    const activeP2 = await page.locator('.btn-page-num.active').innerText();
    logCheck('Page 2 button highlighted active', activeP2.trim() === '2');

    // Check first card on Page 2
    const p2FirstTitle = await page.locator('.release-row-card .work-link').first().innerText();
    logCheck('Page 2 renders new works', p2FirstTitle.length > 0, `First: "${p2FirstTitle}"`);

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    const shotPage2 = path.join(ARTIFACT_DIR, 'preview_lancamentos_page2.png');
    await page.screenshot({ path: shotPage2, fullPage: false });
    results.screenshots.push({ name: 'preview_lancamentos_page2', path: shotPage2 });
    logCheck('Captured preview_lancamentos_page2.png', true);

    // -----------------------------------------------------------------
    // 4. PAGE 3 PAGINATION
    // -----------------------------------------------------------------
    console.log('\n--- 4. Navigating to Page 3 ---');
    await pagination.scrollIntoViewIfNeeded();
    const btnPage3 = page.getByRole('link', { name: '3', exact: true });
    await btnPage3.click();
    await page.waitForURL('**/lancamentos?page=3*', { waitUntil: 'commit' });
    await page.waitForSelector('.releases-grid', { timeout: 10000 });
    await page.waitForTimeout(500);

    const activeP3 = await page.locator('.btn-page-num.active').innerText();
    logCheck('Page 3 button highlighted active', activeP3.trim() === '3');

    const p3FirstTitle = await page.locator('.release-row-card .work-link').first().innerText();
    logCheck('Page 3 renders distinct works', p3FirstTitle.length > 0 && p3FirstTitle !== p2FirstTitle, `First: "${p3FirstTitle}"`);

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    const shotPage3 = path.join(ARTIFACT_DIR, 'preview_lancamentos_page3.png');
    await page.screenshot({ path: shotPage3, fullPage: false });
    results.screenshots.push({ name: 'preview_lancamentos_page3', path: shotPage3 });
    logCheck('Captured preview_lancamentos_page3.png', true);

    await ctxDesktop.close();

    // -----------------------------------------------------------------
    // 5. MOBILE VIEWPORT (iPhone 390x844)
    // -----------------------------------------------------------------
    console.log('\n--- 5. Testing Mobile iPhone (390x844) ---');
    const ctxMobile = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true
    });
    await bypassAgeGate(ctxMobile);
    const pageMob = await ctxMobile.newPage();

    // Home mobile check
    await pageMob.goto(PREVIEW_URL, { waitUntil: 'networkidle' });
    await dismissModals(pageMob);
    const mobReleases = pageMob.locator('#lancamentos');
    await mobReleases.scrollIntoViewIfNeeded();
    const mobBottomBtn = pageMob.locator('#lancamentos .releases-footer-tools, #lancamentos .btn-view-all-releases');
    logCheck('Mobile Home bottom button is eliminated', await mobBottomBtn.count() === 0);

    const shotMobileHome = path.join(ARTIFACT_DIR, 'preview_mobile_home_releases.png');
    await mobReleases.screenshot({ path: shotMobileHome });
    results.screenshots.push({ name: 'preview_mobile_home_releases', path: shotMobileHome });
    logCheck('Captured preview_mobile_home_releases.png', true);

    // /lancamentos mobile check
    await pageMob.goto(`${PREVIEW_URL}/lancamentos`, { waitUntil: 'networkidle' });
    await dismissModals(pageMob);
    await pageMob.waitForSelector('.releases-grid', { timeout: 10000 });
    await pageMob.waitForTimeout(500);

    const shotMobileLancamentos = path.join(ARTIFACT_DIR, 'preview_mobile_lancamentos_top.png');
    await pageMob.screenshot({ path: shotMobileLancamentos, fullPage: false });
    results.screenshots.push({ name: 'preview_mobile_lancamentos_top', path: shotMobileLancamentos });
    logCheck('Captured preview_mobile_lancamentos_top.png', true);

    // Mobile pagination
    const mobPagination = pageMob.locator('.pagination-section');
    await mobPagination.scrollIntoViewIfNeeded();
    await pageMob.waitForTimeout(300);

    const shotMobilePagination = path.join(ARTIFACT_DIR, 'preview_mobile_lancamentos_pagination.png');
    await pageMob.screenshot({ path: shotMobilePagination, fullPage: false });
    results.screenshots.push({ name: 'preview_mobile_lancamentos_pagination', path: shotMobilePagination });
    logCheck('Captured preview_mobile_lancamentos_pagination.png', true);

    await ctxMobile.close();

    // -----------------------------------------------------------------
    // 6. ANDROID COMPACT (360x800)
    // -----------------------------------------------------------------
    console.log('\n--- 6. Testing Android Compact (360x800) ---');
    const ctxAndroid = await browser.newContext({
      viewport: { width: 360, height: 800 },
      deviceScaleFactor: 2,
      isMobile: true
    });
    await bypassAgeGate(ctxAndroid);
    const pageAndroid = await ctxAndroid.newPage();
    await pageAndroid.goto(`${PREVIEW_URL}/lancamentos`, { waitUntil: 'networkidle' });
    await dismissModals(pageAndroid);
    await pageAndroid.waitForSelector('.releases-grid', { timeout: 10000 });
    await pageAndroid.waitForTimeout(400);

    const shotAndroid = path.join(ARTIFACT_DIR, 'preview_android_lancamentos.png');
    await pageAndroid.screenshot({ path: shotAndroid, fullPage: false });
    results.screenshots.push({ name: 'preview_android_lancamentos', path: shotAndroid });
    logCheck('Captured preview_android_lancamentos.png', true);

    await ctxAndroid.close();

    console.log('\n=== ALL DEFINITIVE VERIFICATIONS PASSED 100% ===');
  } catch (err) {
    console.error('VERIFICATION FAILED:', err);
    results.error = String(err);
  } finally {
    await browser.close();
    fs.writeFileSync(
      path.join(ARTIFACT_DIR, 'definitive_verification_report.json'),
      JSON.stringify(results, null, 2),
      'utf-8'
    );
  }
}

run();
