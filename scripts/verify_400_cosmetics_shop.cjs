const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const previewUrl = 'https://home-preview-manga.project-nox-awerkori.workers.dev/loja';
const artDir = '/home/awerkori/.gemini/antigravity-cli/brain/fa6d1923-db0b-428b-bc07-4973adaffd49/loja_100_per_cat';
fs.mkdirSync(artDir, { recursive: true });

async function verify() {
  console.log('--- STARTING 400 COSMETICS CATALOG FULL VERIFICATION ---');
  const browser = await chromium.launch({ headless: true });

  const context = await browser.newContext({
    viewport: { width: 1366, height: 900 }
  });

  await context.addCookies([
    { name: 'nox-age-status', value: 'ADULT', domain: 'home-preview-manga.project-nox-awerkori.workers.dev', path: '/' },
    { name: 'nox-blur-nsfw', value: 'false', domain: 'home-preview-manga.project-nox-awerkori.workers.dev', path: '/' }
  ]);

  const page = await context.newPage();
  console.log(`Navigating to ${previewUrl}...`);
  await page.goto(previewUrl, { waitUntil: 'networkidle', timeout: 45000 });

  // 1. Check Total items in "Todos" tab
  const totalCards = await page.$$('.shop-card');
  console.log(`[TODOS TAB] Found ${totalCards.length} cosmetic cards.`);

  const results = {
    totalCards: totalCards.length,
    tabs: {}
  };

  // 2. Click category buttons (.cat-btn) and count cards in each
  const catButtons = await page.$$('.cat-btn');
  console.log(`Found ${catButtons.length} category buttons.`);

  // catButtons[0] = Todos
  // catButtons[1] = Molduras
  // catButtons[2] = Cores de Nome
  // catButtons[3] = Títulos
  // catButtons[4] = Banners de Comentário

  const categories = [
    { index: 1, name: 'Molduras de Avatar' },
    { index: 2, name: 'Cores de Nome' },
    { index: 3, name: 'Títulos' },
    { index: 4, name: 'Banners de Comentário' }
  ];

  for (const cat of categories) {
    console.log(`Clicking category [${cat.index}]: ${cat.name}...`);
    await catButtons[cat.index].click();
    await page.waitForTimeout(600);

    const count = (await page.$$('.shop-card')).length;
    console.log(`-> Tab "${cat.name}" has ${count} cosmetic cards.`);
    results.tabs[cat.name] = count;
  }

  // 3. Test "Visualizar" Modals on each category
  console.log('Testing "Visualizar" modals on filtered categories...');

  // A. Avatar Frame Modal (item 51: Bushido Katana)
  await catButtons[1].click();
  await page.waitForTimeout(500);
  let frameCards = await page.$$('.shop-card');
  if (frameCards.length >= 51) {
    const viewBtn = await frameCards[50].$('.btn-action-view');
    await viewBtn.scrollIntoViewIfNeeded();
    await viewBtn.click();
    await page.waitForSelector('.modal-card', { state: 'visible', timeout: 5000 });
    const modalTitle = await page.locator('#modal-item-title').innerText();
    console.log(`Opened Frame Modal for item 51: "${modalTitle}"`);
    await page.screenshot({ path: path.join(artDir, 'modal_frame_51_katana.png') });
    await page.click('.btn-modal-close');
    await page.waitForSelector('.modal-card', { state: 'hidden', timeout: 5000 });
  }

  // B. Name Color Modal (item 51: Obsidiana Abissal)
  await catButtons[2].click();
  await page.waitForTimeout(500);
  let colorCards = await page.$$('.shop-card');
  if (colorCards.length >= 51) {
    const viewBtn = await colorCards[50].$('.btn-action-view');
    await viewBtn.scrollIntoViewIfNeeded();
    await viewBtn.click();
    await page.waitForSelector('.modal-card', { state: 'visible', timeout: 5000 });
    const modalTitle = await page.locator('#modal-item-title').innerText();
    console.log(`Opened Name Color Modal for item 51: "${modalTitle}"`);
    await page.screenshot({ path: path.join(artDir, 'modal_color_51_obsidian.png') });
    await page.click('.btn-modal-close');
    await page.waitForSelector('.modal-card', { state: 'hidden', timeout: 5000 });
  }

  // C. Title Modal (item 51: Sombra do Éon)
  await catButtons[3].click();
  await page.waitForTimeout(500);
  let titleCards = await page.$$('.shop-card');
  if (titleCards.length >= 51) {
    const viewBtn = await titleCards[50].$('.btn-action-view');
    await viewBtn.scrollIntoViewIfNeeded();
    await viewBtn.click();
    await page.waitForSelector('.modal-card', { state: 'visible', timeout: 5000 });
    const modalTitle = await page.locator('#modal-item-title').innerText();
    console.log(`Opened Title Modal for item 51: "${modalTitle}"`);
    await page.screenshot({ path: path.join(artDir, 'modal_title_51_sombra.png') });
    await page.click('.btn-modal-close');
    await page.waitForSelector('.modal-card', { state: 'hidden', timeout: 5000 });
  }

  // D. Banner Modal (item 51: Cidade Flutuante Celestial)
  await catButtons[4].click();
  await page.waitForTimeout(500);
  let bannerCards = await page.$$('.shop-card');
  if (bannerCards.length >= 51) {
    const viewBtn = await bannerCards[50].$('.btn-action-view');
    await viewBtn.scrollIntoViewIfNeeded();
    await viewBtn.click();
    await page.waitForSelector('.modal-card', { state: 'visible', timeout: 5000 });
    const modalTitle = await page.locator('#modal-item-title').innerText();
    console.log(`Opened Banner Modal for item 51: "${modalTitle}"`);
    await page.screenshot({ path: path.join(artDir, 'modal_banner_51_cidade.png') });
    await page.click('.btn-modal-close');
    await page.waitForSelector('.modal-card', { state: 'hidden', timeout: 5000 });
  }

  // 4. Mobile Viewport (390 x 844)
  console.log('Testing Mobile Viewport (390 x 844)...');
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 }
  });
  await mobileContext.addCookies([
    { name: 'nox-age-status', value: 'ADULT', domain: 'home-preview-manga.project-nox-awerkori.workers.dev', path: '/' },
    { name: 'nox-blur-nsfw', value: 'false', domain: 'home-preview-manga.project-nox-awerkori.workers.dev', path: '/' }
  ]);
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto(previewUrl, { waitUntil: 'networkidle', timeout: 35000 });

  await mobilePage.screenshot({ path: path.join(artDir, 'mobile_loja_100_overview.png') });

  const mobileCatButtons = await mobilePage.$$('.cat-btn');
  // Click on Banners on mobile
  if (mobileCatButtons.length >= 5) {
    await mobileCatButtons[4].click();
    await mobilePage.waitForTimeout(500);
    const mobCards = await mobilePage.$$('.shop-card');
    console.log(`Mobile banner cards count: ${mobCards.length}`);
    if (mobCards.length > 0) {
      const mobViewBtn = await mobCards[0].$('.btn-action-view');
      await mobViewBtn.click();
      await mobilePage.waitForSelector('.modal-card', { state: 'visible' });
      await mobilePage.screenshot({ path: path.join(artDir, 'mobile_modal_banner_responsive.png') });
    }
  }

  await browser.close();

  fs.writeFileSync(path.join(artDir, 'results.json'), JSON.stringify(results, null, 2));
  console.log('--- VERIFICATION COMPLETE! ---');
  console.log(JSON.stringify(results, null, 2));
}

verify().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
