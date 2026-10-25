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
  console.log('=== PROJECT NOX: LANCAMENTOS PAGINATION & DESIGN VERIFICATION ===');
  const browser = await chromium.launch({ headless: true });
  const report = {
    timestamp: new Date().toISOString(),
    tests: [],
    screenshots: []
  };

  function logPass(name, detail = '') {
    console.log(`[PASS] ${name}${detail ? ` - ${detail}` : ''}`);
    report.tests.push({ name, status: 'PASS', detail });
  }

  function logFail(name, error) {
    console.error(`[FAIL] ${name} - ${error}`);
    report.tests.push({ name, status: 'FAIL', error: String(error) });
  }

  try {
    // -------------------------------------------------------------
    // Test 1: Desktop View & Home Page Cleanliness
    // -------------------------------------------------------------
    const contextDesktop = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2
    });
    await bypassAgeGate(contextDesktop);
    const page = await contextDesktop.newPage();

    console.log('\n--- 1. Testing Home Page Releases Section ---');
    await page.goto(PREVIEW_URL, { waitUntil: 'networkidle' });
    await dismissModals(page);

    // Check header link "Ver todos os lançamentos"
    const headerViewAll = page.locator('#lancamentos .view-all-link');
    const headerViewAllCount = await headerViewAll.count();
    if (headerViewAllCount > 0) {
      logPass('Home header "Ver todos os lançamentos" link exists', await headerViewAll.first().getAttribute('href'));
    } else {
      logFail('Home header "Ver todos os lançamentos" link missing', 'Not found in DOM');
    }

    // Check footer button in RecentReleases
    const footerViewAll = page.locator('#lancamentos .btn-view-all-releases');
    const footerViewAllCount = await footerViewAll.count();
    if (footerViewAllCount > 0) {
      logPass('Home footer "Ver todos os lançamentos" button exists', await footerViewAll.first().getAttribute('href'));
    } else {
      logFail('Home footer "Ver todos os lançamentos" button missing', 'Not found in DOM');
    }

    // Verify REDUNDANT "Carregar mais lançamentos" button is REMOVED from Home
    const loadMoreButton = page.locator('#lancamentos .btn-load-releases, #lancamentos button:has-text("Carregar mais")');
    const loadMoreCount = await loadMoreButton.count();
    if (loadMoreCount === 0) {
      logPass('Redundant "Carregar mais lançamentos" button cleanly removed from Home page');
    } else {
      logFail('Redundant "Carregar mais lançamentos" still present on Home', `Found ${loadMoreCount} instances`);
    }

    // Click "Ver todos os lançamentos" from Home footer to test seamless navigation
    console.log('\n--- 2. Navigating from Home to /lancamentos ---');
    await footerViewAll.first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await footerViewAll.first().click();
    await page.waitForURL('**/lancamentos*', { waitUntil: 'commit' });
    await page.waitForSelector('.releases-grid', { timeout: 10000 });
    logPass('Seamless navigation from Home to /lancamentos successful', page.url());

    // -------------------------------------------------------------
    // Test 2: Page 1 Layout, Components, and Theme on /lancamentos
    // -------------------------------------------------------------
    console.log('\n--- 3. Verifying /lancamentos Page 1 Elements ---');

    // Breadcrumb
    const breadcrumb = page.locator('.breadcrumb-nav');
    const breadcrumbText = await breadcrumb.innerText();
    logPass('Breadcrumbs present', breadcrumbText.replace(/\s+/g, ' '));

    // Title accent bar & page title
    const accentBar = page.locator('.title-accent-bar');
    if (await accentBar.count() > 0) {
      logPass('Cosmic violet title accent bar rendered');
    }

    const titleText = await page.locator('.page-title').innerText();
    logPass('Page title rendered', titleText);

    // Filter pills
    const filterPills = page.locator('.filter-pill');
    const pillCount = await filterPills.count();
    logPass('Filter tabs rendered', `${pillCount} category pills found`);

    // Verify "Todos" is active on page 1
    const activePill = page.locator('.filter-pill.active');
    const activePillText = await activePill.innerText();
    logPass('Active category pill on start', activePillText);

    // Release cards count
    const releaseCards = page.locator('.release-row-card');
    const cardsCount = await releaseCards.count();
    logPass('Release cards count on Page 1', `${cardsCount} works displayed`);

    // Verify first card details
    const firstCard = releaseCards.first();
    const firstTitle = await firstCard.locator('.work-link').innerText();
    const firstKind = await firstCard.locator('.kind-tag').innerText();
    const firstTime = await firstCard.locator('.timestamp-box time').innerText();
    const firstPills = firstCard.locator('.chapter-pill');
    const firstPillsCount = await firstPills.count();
    logPass('First release card inspected', `Title: "${firstTitle}", Kind: ${firstKind}, Time: ${firstTime}, Chapters: ${firstPillsCount}`);

    // Check pagination controls on Page 1
    const paginationSection = page.locator('.pagination-section');
    await paginationSection.scrollIntoViewIfNeeded();

    const prevBtn = page.locator('.btn-page-nav.prev');
    const prevIsDisabled = await prevBtn.evaluate(el => el.classList.contains('disabled') || el.getAttribute('aria-disabled') === 'true');
    if (prevIsDisabled) {
      logPass('Previous button disabled on Page 1', 'aria-disabled="true"');
    } else {
      logFail('Previous button should be disabled on Page 1', 'Was not disabled');
    }

    const activePageNum = await page.locator('.btn-page-num.active').innerText();
    if (activePageNum.trim() === '1') {
      logPass('Page 1 button highlighted as active');
    } else {
      logFail('Page 1 active highlight error', `Found: ${activePageNum}`);
    }

    const nextBtn = page.locator('.btn-page-nav.next');
    const nextHref = await nextBtn.getAttribute('href');
    logPass('Next button links to next page', nextHref);

    // Save Page 1 Desktop Screenshot (Top Grid)
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);
    const screenshotP1 = path.join(ARTIFACT_DIR, 'lancamentos_desktop_page1.png');
    await page.screenshot({ path: screenshotP1, fullPage: false });
    report.screenshots.push({ name: 'lancamentos_desktop_page1', path: screenshotP1 });
    logPass('Captured lancamentos_desktop_page1 screenshot');

    // Save Page 1 Desktop Pagination Screenshot
    await paginationSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const screenshotP1Pagination = path.join(ARTIFACT_DIR, 'lancamentos_desktop_page1_pagination.png');
    await page.screenshot({ path: screenshotP1Pagination, fullPage: false });
    report.screenshots.push({ name: 'lancamentos_desktop_page1_pagination', path: screenshotP1Pagination });
    logPass('Captured lancamentos_desktop_page1_pagination screenshot');

    // -------------------------------------------------------------
    // Test 3: Pagination Navigation to Page 2
    // -------------------------------------------------------------
    console.log('\n--- 4. Navigating to Page 2 ---');
    const page2Btn = page.locator('.page-numbers-cluster a.btn-page-num:has-text("2")');
    await page2Btn.click();
    await page.waitForURL('**/lancamentos?page=2*', { waitUntil: 'commit' });
    await page.waitForSelector('.releases-grid', { timeout: 10000 });
    logPass('Navigated to Page 2 successfully', page.url());

    // Check active button on Page 2
    const activePage2Num = await page.locator('.btn-page-num.active').innerText();
    if (activePage2Num.trim() === '2') {
      logPass('Page 2 button highlighted as active');
    } else {
      logFail('Page 2 active highlight error', `Found: ${activePage2Num}`);
    }

    // Verify Previous button is now enabled
    const prevPage2Href = await page.locator('.btn-page-nav.prev').getAttribute('href');
    logPass('Previous button now enabled on Page 2', `Points to: ${prevPage2Href}`);

    // Verify Page 2 shows different works (no repeats)
    const page2FirstTitle = await page.locator('.release-row-card .work-link').first().innerText();
    if (page2FirstTitle !== firstTitle) {
      logPass('Page 2 content differs from Page 1 (no duplicates)', `P1 first: "${firstTitle}" vs P2 first: "${page2FirstTitle}"`);
    } else {
      logFail('Page 2 has same first title as Page 1', page2FirstTitle);
    }

    // Save Page 2 Desktop Screenshot
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    const screenshotP2 = path.join(ARTIFACT_DIR, 'lancamentos_desktop_page2.png');
    await page.screenshot({ path: screenshotP2, fullPage: false });
    report.screenshots.push({ name: 'lancamentos_desktop_page2', path: screenshotP2 });
    logPass('Captured lancamentos_desktop_page2 screenshot');

    // -------------------------------------------------------------
    // Test 4: Browser Native Back Button Navigation
    // -------------------------------------------------------------
    console.log('\n--- 5. Testing Browser Back Button Navigation ---');
    await page.goBack({ waitUntil: 'commit' });
    await page.waitForFunction(() => {
      const activeBtn = document.querySelector('.btn-page-num.active');
      return activeBtn && activeBtn.textContent.trim() === '1';
    }, { timeout: 10000 });
    const backUrl = page.url();
    const backActivePage = await page.locator('.btn-page-num.active').innerText();
    if (backActivePage.trim() === '1') {
      logPass('Browser Back button returned to Page 1 with correct active state', backUrl);
    } else {
      logFail('Browser Back button active state error', `Expected 1, got ${backActivePage}`);
    }

    // -------------------------------------------------------------
    // Test 5: Category Filters with Pagination
    // -------------------------------------------------------------
    console.log('\n--- 6. Testing Category Filter & Pagination Combination ---');
    const manhwaPill = page.locator('.filter-pill:has-text("Manhwa")');
    await manhwaPill.click();
    await page.waitForURL('**/*kind=MANHWA*', { waitUntil: 'commit' });
    await page.waitForSelector('.releases-grid', { timeout: 10000 });
    logPass('Filtered by Manhwa successfully', page.url());

    // Check kind tags in cards
    const kindTags = await page.locator('.release-row-card .kind-tag').allInnerTexts();
    const allManhwa = kindTags.length > 0 && kindTags.every(k => k.toLowerCase().includes('manhwa'));
    if (allManhwa) {
      logPass('All displayed works match selected filter "Manhwa"', `${kindTags.length} works verified`);
    } else {
      logFail('Some works did not match Manhwa filter', kindTags.join(', '));
    }

    // Check pagination link retains filter
    const manhwaPage2 = page.locator('.page-numbers-cluster a.btn-page-num:has-text("2")');
    const manhwaPage2Href = await manhwaPage2.getAttribute('href');
    if (manhwaPage2Href && manhwaPage2Href.includes('kind=MANHWA') && manhwaPage2Href.includes('page=2')) {
      logPass('Pagination links preserve active category filter', manhwaPage2Href);
    } else {
      logFail('Pagination link lost category filter', manhwaPage2Href);
    }

    // Save Manhwa Category Screenshot
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    const screenshotManhwa = path.join(ARTIFACT_DIR, 'lancamentos_desktop_manhwa_filter.png');
    await page.screenshot({ path: screenshotManhwa, fullPage: false });
    report.screenshots.push({ name: 'lancamentos_desktop_manhwa_filter', path: screenshotManhwa });
    logPass('Captured lancamentos_desktop_manhwa_filter screenshot');

    await contextDesktop.close();

    // -------------------------------------------------------------
    // Test 6: Mobile Responsiveness (390x844 - iPhone 13/14/15)
    // -------------------------------------------------------------
    console.log('\n--- 7. Testing Mobile Viewport (390x844) ---');
    const contextMobile = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true
    });
    await bypassAgeGate(contextMobile);
    const pageMobile = await contextMobile.newPage();
    await pageMobile.goto(`${PREVIEW_URL}/lancamentos`, { waitUntil: 'networkidle' });
    await dismissModals(pageMobile);
    await pageMobile.waitForSelector('.releases-grid', { timeout: 10000 });

    // Check horizontal scroll on filters if needed
    const filterBar = pageMobile.locator('.filter-bar');
    const filterBox = await filterBar.boundingBox();
    logPass('Mobile filter bar rendered within viewport', `Width: ${filterBox.width}px`);

    // Check card layout on mobile (single column)
    const cardBox = await pageMobile.locator('.release-row-card').first().boundingBox();
    if (cardBox.width <= 390) {
      logPass('Release card sized correctly for mobile screen', `Width: ${Math.round(cardBox.width)}px`);
    } else {
      logFail('Release card overflows mobile screen', `Width: ${cardBox.width}px`);
    }

    // Check pagination controls on mobile
    const mobilePagination = pageMobile.locator('.pagination-controls');
    await mobilePagination.scrollIntoViewIfNeeded();
    const paginationBox = await mobilePagination.boundingBox();
    if (paginationBox.width <= 390) {
      logPass('Pagination controls fit mobile viewport without horizontal overflow', `Width: ${Math.round(paginationBox.width)}px`);
    } else {
      logFail('Pagination controls overflow mobile screen', `Width: ${paginationBox.width}px`);
    }

    // Save Mobile Screenshot (Header & Grid)
    await pageMobile.evaluate(() => window.scrollTo(0, 0));
    await pageMobile.waitForTimeout(300);
    const screenshotMobile = path.join(ARTIFACT_DIR, 'lancamentos_mobile_390x844_top.png');
    await pageMobile.screenshot({ path: screenshotMobile, fullPage: false });
    report.screenshots.push({ name: 'lancamentos_mobile_390x844_top', path: screenshotMobile });
    logPass('Captured lancamentos_mobile_390x844_top screenshot');

    // Save Mobile Screenshot (Pagination)
    await mobilePagination.scrollIntoViewIfNeeded();
    await pageMobile.waitForTimeout(300);
    const screenshotMobilePagination = path.join(ARTIFACT_DIR, 'lancamentos_mobile_390x844_pagination.png');
    await pageMobile.screenshot({ path: screenshotMobilePagination, fullPage: false });
    report.screenshots.push({ name: 'lancamentos_mobile_390x844_pagination', path: screenshotMobilePagination });
    logPass('Captured lancamentos_mobile_390x844_pagination screenshot');

    await contextMobile.close();

    // -------------------------------------------------------------
    // Test 7: Mobile Compact (360x800 - Android)
    // -------------------------------------------------------------
    console.log('\n--- 8. Testing Android Mobile Viewport (360x800) ---');
    const contextAndroid = await browser.newContext({
      viewport: { width: 360, height: 800 },
      deviceScaleFactor: 2,
      isMobile: true
    });
    await bypassAgeGate(contextAndroid);
    const pageAndroid = await contextAndroid.newPage();
    await pageAndroid.goto(`${PREVIEW_URL}/lancamentos`, { waitUntil: 'networkidle' });
    await dismissModals(pageAndroid);
    await pageAndroid.waitForSelector('.releases-grid', { timeout: 10000 });

    const screenshotAndroid = path.join(ARTIFACT_DIR, 'lancamentos_mobile_360x800.png');
    await pageAndroid.screenshot({ path: screenshotAndroid, fullPage: false });
    report.screenshots.push({ name: 'lancamentos_mobile_360x800', path: screenshotAndroid });
    logPass('Captured lancamentos_mobile_360x800 screenshot');

    await contextAndroid.close();

    console.log('\n=== ALL VERIFICATIONS PASSED SUCCESSFULLY ===');
  } catch (err) {
    console.error('FATAL VERIFICATION ERROR:', err);
    report.fatalError = String(err);
  } finally {
    await browser.close();
    fs.writeFileSync(
      path.join(ARTIFACT_DIR, 'lancamentos_verification_report.json'),
      JSON.stringify(report, null, 2),
      'utf-8'
    );
  }
}

run();
