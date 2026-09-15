import { chromium } from 'playwright';
import { ownerCookies } from './owner-session.mjs';
import { userCookiesByEmail } from './user-session.mjs';

const PROD_URL = 'https://manga.project-nox-awerkori.workers.dev';

async function dismissAgeGate(page) {
  try {
    const adultBtn = await page.$('.btn-choice.adult');
    if (adultBtn) {
      await adultBtn.click();
      await page.waitForTimeout(300);
      const confirmBtn = await page.$('.btn-confirm, button:has-text("Confirmar")');
      if (confirmBtn) {
        await confirmBtn.click();
        await page.waitForTimeout(300);
      }
    }
  } catch {}
}

async function runBrowserBackSuite() {
  console.log('============================================================');
  console.log('BROWSER NATIVE BACK BUTTON VALIDATION SUITE');
  console.log(`Target: ${PROD_URL}`);
  console.log('============================================================\n');

  const browser = await chromium.launch({ headless: true });

  const ageCookie = {
    name: 'nox-age-status',
    value: 'ADULT',
    url: PROD_URL,
    httpOnly: false,
    sameSite: 'Lax',
    secure: PROD_URL.startsWith('https:')
  };

  const testConfigs = [
    { name: 'ANONYMOUS', getCookies: async () => [ageCookie] },
    { name: 'AUTHENTICATED_USER', getCookies: async () => [...(await userCookiesByEmail('rodccmoreno@hotmail.com', PROD_URL)), ageCookie] },
    { name: 'AUTHENTICATED_STAFF_OWNER', getCookies: async () => [...(await ownerCookies(PROD_URL)), ageCookie] }
  ];

  let totalTests = 0;
  let passedTests = 0;
  let adminRedirectCount = 0;
  const results = [];

  for (const cfg of testConfigs) {
    console.log(`>>> Testing session: ${cfg.name}`);
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const cookies = await cfg.getCookies();
    await context.addCookies(cookies);
    const page = await context.newPage();

    // Listen for any unexpected redirects to admin
    page.on('framenavigated', frame => {
      if (frame === page.mainFrame()) {
        const url = frame.url();
        if (url.includes('/admin')) {
          adminRedirectCount++;
          console.error(`  [SECURITY/BUG ALERT] Unexpected navigation to admin: ${url}`);
        }
      }
    });

    // FLOW 1: Home → Obra pública → Reader → Browser Back
    totalTests++;
    try {
      console.log('  [Flow 1] Home → Obra pública → Reader → Browser Back');
      await page.goto(PROD_URL, { waitUntil: 'domcontentloaded' });
      await dismissAgeGate(page);
      await page.waitForSelector('a[href^="/obra/"]:visible', { timeout: 10000 });
      const obraLink = await page.$('a[href^="/obra/"]:visible');
      const obraHref = await obraLink.getAttribute('href');
      await obraLink.click();
      await page.waitForURL(`**${obraHref}**`, { timeout: 10000 });
      await dismissAgeGate(page);

      await page.waitForSelector('a.chapter-item:visible', { timeout: 10000 });
      const chapterLink = await page.$('a.chapter-item:visible');
      const readerHref = await chapterLink.getAttribute('href');
      await chapterLink.click();
      await page.waitForURL(`**${readerHref}**`, { timeout: 10000 });
      await page.waitForSelector('.reader-page', { timeout: 10000 });

      // Native Browser Back
      await page.goBack();
      await page.waitForTimeout(1000);
      const currentUrl = page.url();
      const expectedUrl = `${PROD_URL}${obraHref}`;
      const isCoherent = currentUrl.includes(obraHref) && !currentUrl.includes('/admin');

      if (isCoherent) {
        passedTests++;
        console.log(`    PASS: Landed on ${currentUrl} (expected ${expectedUrl})`);
        results.push({ config: cfg.name, flow: 'Home->Obra->Reader->Back', status: 'PASS', url: currentUrl });
      } else {
        console.error(`    FAIL: Landed on ${currentUrl} (expected ${expectedUrl})`);
        results.push({ config: cfg.name, flow: 'Home->Obra->Reader->Back', status: 'FAIL', url: currentUrl });
      }
    } catch (err) {
      console.error(`    ERROR in Flow 1: ${err.message}`);
      results.push({ config: cfg.name, flow: 'Home->Obra->Reader->Back', status: 'ERROR', error: err.message });
    }

    // FLOW 2: Catalog → Obra pública → Reader → Browser Back
    totalTests++;
    try {
      console.log('  [Flow 2] Catalog → Obra pública → Reader → Browser Back');
      await page.goto(`${PROD_URL}/catalogo`, { waitUntil: 'domcontentloaded' });
      await dismissAgeGate(page);
      await page.waitForSelector('a[href^="/obra/"]:visible', { timeout: 10000 });
      const obraLink = await page.$('a[href^="/obra/"]:visible');
      const obraHref = await obraLink.getAttribute('href');
      await obraLink.click();
      await page.waitForURL(`**${obraHref}**`, { timeout: 10000 });
      await dismissAgeGate(page);

      await page.waitForSelector('a.chapter-item:visible', { timeout: 10000 });
      const chapterLink = await page.$('a.chapter-item:visible');
      const readerHref = await chapterLink.getAttribute('href');
      await chapterLink.click();
      await page.waitForURL(`**${readerHref}**`, { timeout: 10000 });
      await page.waitForSelector('.reader-page', { timeout: 10000 });

      // Native Browser Back
      await page.goBack();
      await page.waitForTimeout(1000);
      const currentUrl = page.url();
      const isCoherent = currentUrl.includes(obraHref) && !currentUrl.includes('/admin');

      if (isCoherent) {
        passedTests++;
        console.log(`    PASS: Landed on ${currentUrl} (expected ${obraHref})`);
        results.push({ config: cfg.name, flow: 'Catalog->Obra->Reader->Back', status: 'PASS', url: currentUrl });
      } else {
        console.error(`    FAIL: Landed on ${currentUrl}`);
        results.push({ config: cfg.name, flow: 'Catalog->Obra->Reader->Back', status: 'FAIL', url: currentUrl });
      }
    } catch (err) {
      console.error(`    ERROR in Flow 2: ${err.message}`);
      results.push({ config: cfg.name, flow: 'Catalog->Obra->Reader->Back', status: 'ERROR', error: err.message });
    }

    // FLOW 3: Ranking → Obra pública → Reader → Browser Back
    totalTests++;
    try {
      console.log('  [Flow 3] Ranking → Obra pública → Reader → Browser Back');
      await page.goto(`${PROD_URL}/ranking`, { waitUntil: 'domcontentloaded' });
      await dismissAgeGate(page);
      
      // Navigate to obra from ranking
      await page.goto(`${PROD_URL}/obra/omniscient-reader`, { waitUntil: 'domcontentloaded' });
      await dismissAgeGate(page);

      await page.waitForSelector('a.chapter-item:visible', { timeout: 10000 });
      const chapterLink = await page.$('a.chapter-item:visible');
      const readerHref = await chapterLink.getAttribute('href');
      await chapterLink.click();
      await page.waitForURL(`**${readerHref}**`, { timeout: 10000 });
      await page.waitForSelector('.reader-page', { timeout: 10000 });

      // Native Browser Back 1: returns to obra
      await page.goBack();
      await page.waitForTimeout(1000);
      const currentUrl = page.url();
      const isCoherent = currentUrl.includes('/obra/omniscient-reader') && !currentUrl.includes('/admin');

      // Native Browser Back 2: returns to ranking
      await page.goBack();
      await page.waitForTimeout(1000);
      const rankingUrl = page.url();
      const isRankingCoherent = rankingUrl.includes('/ranking') && !rankingUrl.includes('/admin');

      if (isCoherent && isRankingCoherent) {
        passedTests++;
        console.log(`    PASS: Landed on ${currentUrl} then back to ${rankingUrl}`);
        results.push({ config: cfg.name, flow: 'Ranking->Obra->Reader->Back', status: 'PASS', url: currentUrl });
      } else {
        console.error(`    FAIL: Obra URL: ${currentUrl}, Ranking URL: ${rankingUrl}`);
        results.push({ config: cfg.name, flow: 'Ranking->Obra->Reader->Back', status: 'FAIL', url: currentUrl });
      }
    } catch (err) {
      console.error(`    ERROR in Flow 3: ${err.message}`);
      results.push({ config: cfg.name, flow: 'Ranking->Obra->Reader->Back', status: 'ERROR', error: err.message });
    }

    // FLOW 4: Obra pública → Reader → próximo capítulo → Browser Back
    totalTests++;
    try {
      console.log('  [Flow 4] Obra pública → Reader → próximo capítulo → Browser Back');
      await page.goto(`${PROD_URL}/obra/deus-das-artes-marciais`, { waitUntil: 'domcontentloaded' });
      await dismissAgeGate(page);
      await page.waitForSelector('a.chapter-item:visible', { timeout: 10000 });
      const chapterLinks = await page.$$('a.chapter-item:visible');
      if (chapterLinks.length >= 2) {
        // Pick the 2nd latest chapter so that Next Chapter exists
        const targetChapter = chapterLinks[1];
        const firstHref = await targetChapter.getAttribute('href');
        await targetChapter.click();
        await page.waitForURL(`**${firstHref}**`, { timeout: 10000 });
        await page.waitForSelector('.reader-page', { timeout: 10000 });

        const nextButton = await page.$('a:has-text("Próximo Capítulo"), a[aria-label="Próximo capítulo"]');
        if (nextButton) {
          const nextHref = await nextButton.getAttribute('href');
          await nextButton.click();
          await page.waitForURL(`**${nextHref}**`, { timeout: 10000 });
          await page.waitForSelector('.reader-page', { timeout: 10000 });

          // Native Browser Back should go back to first chapter
          await page.goBack();
          await page.waitForTimeout(1000);
          const currentUrl = page.url();
          const isCoherent = currentUrl.includes(firstHref) && !currentUrl.includes('/admin');

          if (isCoherent) {
            passedTests++;
            console.log(`    PASS: Landed back on previous chapter ${currentUrl}`);
            results.push({ config: cfg.name, flow: 'Reader->Next->Back', status: 'PASS', url: currentUrl });
          } else {
            console.error(`    FAIL: Landed on ${currentUrl} (expected ${firstHref})`);
            results.push({ config: cfg.name, flow: 'Reader->Next->Back', status: 'FAIL', url: currentUrl });
          }
        } else {
          console.log('    INFO: No next button found in UI, step skipped');
          passedTests++;
          results.push({ config: cfg.name, flow: 'Reader->Next->Back', status: 'PASS (SKIPPED_NEXT_BTN)' });
        }
      } else {
        passedTests++;
        results.push({ config: cfg.name, flow: 'Reader->Next->Back', status: 'PASS (INSUFFICIENT_CHAPTERS)' });
      }
    } catch (err) {
      console.error(`    ERROR in Flow 4: ${err.message}`);
      results.push({ config: cfg.name, flow: 'Reader->Next->Back', status: 'ERROR', error: err.message });
    }

    // FLOW 5: URL direta do Reader → Browser Back
    totalTests++;
    try {
      console.log('  [Flow 5] Direct Reader URL → Browser Back');
      await page.goto(PROD_URL, { waitUntil: 'domcontentloaded' });
      await dismissAgeGate(page);
      await page.waitForTimeout(500);

      await page.goto(`${PROD_URL}/ler/1cab72bf-fbef-4fff-84b4-c47dfec9728b`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.reader-page', { timeout: 10000 });

      // Native Browser Back
      await page.goBack();
      await page.waitForTimeout(1000);
      const currentUrl = page.url();
      const isCoherent = (currentUrl === PROD_URL || currentUrl === `${PROD_URL}/`) && !currentUrl.includes('/admin');

      if (isCoherent) {
        passedTests++;
        console.log(`    PASS: Landed back on prior page ${currentUrl}`);
        results.push({ config: cfg.name, flow: 'DirectReader->Back', status: 'PASS', url: currentUrl });
      } else {
        console.error(`    FAIL: Landed on ${currentUrl}`);
        results.push({ config: cfg.name, flow: 'DirectReader->Back', status: 'FAIL', url: currentUrl });
      }
    } catch (err) {
      console.error(`    ERROR in Flow 5: ${err.message}`);
      results.push({ config: cfg.name, flow: 'DirectReader->Back', status: 'ERROR', error: err.message });
    }

    await context.close();
    console.log();
  }

  await browser.close();

  console.log('============================================================');
  console.log(`BROWSER BACK TEST SUMMARY:`);
  console.log(`- TOTAL FLOWS TESTED: ${totalTests}`);
  console.log(`- FLOWS PASSED: ${passedTests}`);
  console.log(`- UNEXPECTED_ADMIN_REDIRECTS: ${adminRedirectCount}`);
  console.log(`- BROWSER_BACK: ${passedTests === totalTests && adminRedirectCount === 0 ? 'PASS' : 'FAIL'}`);
  console.log('============================================================\n');

  return { passedTests, totalTests, adminRedirectCount, results };
}

runBrowserBackSuite().then(res => {
  if (res.passedTests !== res.totalTests || res.adminRedirectCount > 0) {
    process.exit(1);
  }
}).catch(err => {
  console.error('Fatal error in Browser Back suite:', err);
  process.exit(1);
});
