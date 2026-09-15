import { chromium, firefox } from '@playwright/test';
import { ownerCookies } from './owner-session.mjs';

const PROD_URL = 'https://manga.project-nox-awerkori.workers.dev';

async function runTest(browserType, browserName) {
  console.log(`\n==============================================`);
  console.log(`TESTING REPRODUCTION ON ${browserName} (PROD: ${PROD_URL})`);
  console.log(`==============================================`);

  const cookies = await ownerCookies(PROD_URL);
  console.log(`Generated ${cookies.length} auth cookies for Owner.`);

  const browser = await browserType.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  await context.addCookies(cookies);

  const page = await context.newPage();

  const startTime = Date.now();
  const timeline = [];

  const record = (msg) => {
    const elapsed = Date.now() - startTime;
    timeline.push(`${elapsed}ms: ${msg}`);
    console.log(`[+${elapsed}ms] ${msg}`);
  };

  record('Starting direct navigation to Home (already authenticated)');
  
  let firstHtmlText = '';
  page.on('response', async (res) => {
    if (res.url() === PROD_URL + '/' && res.request().resourceType() === 'document') {
      try {
        firstHtmlText = await res.text();
      } catch {}
    }
  });

  await page.goto(PROD_URL + '/', { waitUntil: 'commit' });
  record('HTML navigation committed');

  const checkGuest = async () => {
    const hasEntrar = await page.locator('text="Entrar"').first().isVisible().catch(() => false);
    const hasAvatar = await page.locator('.avatar-btn, .user-avatar-skeleton').first().isVisible().catch(() => false);
    const hasUserDropdown = await page.locator('.user-menu-container').isVisible().catch(() => false);
    return { hasEntrar, hasAvatar, hasUserDropdown };
  };

  const initialStatus = await checkGuest();
  record(`First frame UI state: hasEntrar=${initialStatus.hasEntrar}, hasAvatar=${initialStatus.hasAvatar}, hasUserDropdown=${initialStatus.hasUserDropdown}`);

  await page.waitForTimeout(500);
  const at500 = await checkGuest();
  record(`500ms UI state: hasEntrar=${at500.hasEntrar}, hasAvatar=${at500.hasAvatar}`);

  await page.waitForTimeout(500);
  const at1000 = await checkGuest();
  record(`1000ms UI state: hasEntrar=${at1000.hasEntrar}, hasAvatar=${at1000.hasAvatar}`);

  await page.waitForTimeout(1000);
  const at2000 = await checkGuest();
  record(`2000ms UI state: hasEntrar=${at2000.hasEntrar}, hasAvatar=${at2000.hasAvatar}`);

  await page.waitForTimeout(1000);
  const at3000 = await checkGuest();
  record(`3000ms UI state: hasEntrar=${at3000.hasEntrar}, hasAvatar=${at3000.hasAvatar}`);

  console.log('\nSSR HTML check:');
  const ssrHasEntrar = firstHtmlText.includes('class="btn-login-nav"') || firstHtmlText.includes('>Entrar<');
  const ssrHasAvatar = firstHtmlText.includes('class="avatar-btn"') || firstHtmlText.includes('class="user-avatar-skeleton"');
  console.log(`SSR HTML directly from server: ssrHasEntrar=${ssrHasEntrar}, ssrHasAvatar=${ssrHasAvatar}`);

  // Test dropdown menu
  record('Testing Account Menu');
  const avatarBtn = page.locator('.avatar-btn');
  if (await avatarBtn.isVisible()) {
    await avatarBtn.click();
    record('Clicked avatar button');
    await page.waitForTimeout(300);
    const menuItems = await page.locator('.dropdown-links a').allInnerTexts();
    console.log('Account Dropdown items found:', menuItems);
  } else {
    console.log('Avatar button not visible!');
  }

  // Test navigation to Catálogo
  record('Testing navigation to /catalogo');
  const catStart = Date.now();
  await page.goto(PROD_URL + '/catalogo', { waitUntil: 'domcontentloaded' });
  record(`/catalogo loaded in ${Date.now() - catStart}ms`);

  // Test navigation to first work card
  const firstWork = page.locator('a[href^="/obra/"]').first();
  const workHref = await firstWork.getAttribute('href');
  console.log(`First work href: ${workHref}`);
  if (workHref) {
    record(`Navigating to work: ${workHref}`);
    const workStart = Date.now();
    const workRes = await page.goto(PROD_URL + workHref, { waitUntil: 'domcontentloaded' });
    const workStatus = workRes?.status();
    const workText = await page.innerText('body');
    const is404 = workText.includes('Obra não encontrada') || workText.includes('se perdeu na noite') || workStatus === 404;
    record(`Work ${workHref} loaded in ${Date.now() - workStart}ms (status: ${workStatus}, is404: ${is404})`);

    const firstChapter = page.locator('a[href^="/ler/"]').first();
    const chapterHref = await firstChapter.getAttribute('href');
    console.log(`First chapter href: ${chapterHref}`);
    if (chapterHref) {
      record(`Navigating to reader: ${chapterHref}`);
      const readerStart = Date.now();
      const readerRes = await page.goto(PROD_URL + chapterHref, { waitUntil: 'domcontentloaded' });
      const readerStatus = readerRes?.status();
      const readerText = await page.innerText('body');
      const isReader404 = readerText.includes('Capítulo indisponível') || readerStatus === 404;
      record(`Reader ${chapterHref} loaded in ${Date.now() - readerStart}ms (status: ${readerStatus}, is404: ${isReader404})`);
    }
  }

  await browser.close();
}

async function main() {
  await runTest(firefox, 'Firefox (Linux)');
  await runTest(chromium, 'Chromium');
}

main().catch(console.error);
