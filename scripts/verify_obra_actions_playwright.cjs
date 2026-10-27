const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = '/home/awerkori/.gemini/antigravity-cli/brain/fa6d1923-db0b-428b-bc07-4973adaffd49';
const PREVIEW_URL = 'https://home-preview-manga.project-nox-awerkori.workers.dev';

async function run() {
  console.log('=== STARTING PLAYWRIGHT VERIFICATION FOR FAVORITES & LIKES ===');

  for (const envPath of ['.dev.vars.deploy', '.dev.vars.preview_full', '.env']) {
    if (fs.existsSync(envPath)) {
      const lines = fs.readFileSync(envPath, 'utf8').split('\n');
      for (const l of lines) {
        const idx = l.indexOf('=');
        if (idx !== -1) {
          const k = l.slice(0, idx).trim();
          const v = l.slice(idx + 1).trim();
          if (!process.env[k] && v) process.env[k] = v;
        }
      }
    }
  }

  const { ownerCookies } = await import('./owner-session.mjs');
  let sessionCookies = [];
  try {
    sessionCookies = await ownerCookies(PREVIEW_URL);
    console.log('Successfully acquired authenticated session cookies.');
  } catch (err) {
    console.warn('Could not acquire session cookies:', err.message);
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const results = {
    timestamp: new Date().toISOString(),
    tests: []
  };

  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 }
    });

    await context.addCookies([
      { name: 'nox-age-status', value: 'ADULT', url: PREVIEW_URL },
      ...sessionCookies
    ]);

    const page = await context.newPage();

    // Listen for console errors & dialogs
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    console.log('\n--- 1. Visiting Work Page: /obra/aparencias ---');
    await page.goto(`${PREVIEW_URL}/obra/aparencias`, { waitUntil: 'networkidle', timeout: 30000 });

    // Verify Title
    const title = await page.title();
    console.log('Page Title:', title);

    const favBtn = page.locator('button.btn-action-control:has-text("Favorit")');
    await favBtn.waitFor({ state: 'visible', timeout: 10000 });
    let favText = (await favBtn.innerText()).trim();
    console.log('Initial Favorite Text:', favText);

    // If already favorited, reset to unfavorited first so we have clean test
    if (favText.includes('Favoritado')) {
      console.log('Resetting favorite to clean state...');
      await favBtn.click();
      await page.waitForTimeout(1500);
      favText = (await favBtn.innerText()).trim();
      console.log('After reset Favorite Text:', favText);
    }

    const likeBtn = page.locator('button.btn-like');
    await likeBtn.waitFor({ state: 'visible', timeout: 10000 });
    let isLiked = await likeBtn.evaluate(el => el.classList.contains('is-active'));
    let likeCount = parseInt((await likeBtn.innerText()).replace(/[^0-9]/g, '') || '0', 10);
    console.log(`Initial Like State: is-active=${isLiked}, count=${likeCount}`);

    // If already liked, reset to unliked
    if (isLiked) {
      console.log('Resetting like to clean state...');
      await likeBtn.click();
      await page.waitForTimeout(1500);
      isLiked = await likeBtn.evaluate(el => el.classList.contains('is-active'));
      likeCount = parseInt((await likeBtn.innerText()).replace(/[^0-9]/g, '') || '0', 10);
      console.log(`After reset Like State: is-active=${isLiked}, count=${likeCount}`);
    }

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'round12_fix_obra_baseline.png') });
    console.log('Saved screenshot: round12_fix_obra_baseline.png');

    // =========================================================================
    // STEP 2: CLICK FAVORITE
    // =========================================================================
    console.log('\n--- 2. Clicking Favorite ---');
    await favBtn.click();
    await page.waitForTimeout(2000);

    const afterFavText = (await favBtn.innerText()).trim();
    console.log('After Favorite Text:', afterFavText);
    if (!afterFavText.includes('Favoritado')) throw new Error('Expected button text to contain "Favoritado"');

    // Check that NO error banner/notice with grant_xp_action appeared
    const noticeText = await page.locator('.notice, .toast, .alert').allInnerTexts().catch(() => []);
    console.log('Active notices on screen:', noticeText);
    for (const t of noticeText) {
      if (t.includes('grant_xp_action') || t.includes('does not exist')) {
        throw new Error('SQL error detected in toast: ' + t);
      }
    }

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'round12_fix_obra_favorited.png') });
    console.log('Saved screenshot: round12_fix_obra_favorited.png');

    // =========================================================================
    // STEP 3: RELOAD PAGE TO CONFIRM PERSISTENCE
    // =========================================================================
    console.log('\n--- 3. Reloading Page to Confirm Favorite Persistence ---');
    await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
    const favBtnReloaded = page.locator('button.btn-action-control:has-text("Favorit")');
    await favBtnReloaded.waitFor({ state: 'visible' });
    const reloadedFavText = (await favBtnReloaded.innerText()).trim();
    console.log('Reloaded Favorite Text:', reloadedFavText);
    if (!reloadedFavText.includes('Favoritado')) throw new Error('Favorite did not persist after page reload!');
    console.log('✓ Favorite successfully persisted!');

    // =========================================================================
    // STEP 4: CLICK UN-FAVORITE
    // =========================================================================
    console.log('\n--- 4. Clicking Un-Favorite ---');
    await favBtnReloaded.click();
    await page.waitForTimeout(2000);
    const unFavText = (await favBtnReloaded.innerText()).trim();
    console.log('After Un-Favorite Text:', unFavText);
    if (unFavText.includes('Favoritado')) throw new Error('Expected button text to revert to "Favoritar"');

    await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
    const unFavReloaded = (await page.locator('button.btn-action-control:has-text("Favorit")').innerText()).trim();
    if (unFavReloaded.includes('Favoritado')) throw new Error('Unfavorite did not persist after reload');
    console.log('✓ Un-favorite successfully persisted!');

    // =========================================================================
    // STEP 5: CLICK LIKE
    // =========================================================================
    console.log('\n--- 5. Clicking Like ---');
    const likeBtnAction = page.locator('button.btn-like');
    const prevCount = parseInt((await likeBtnAction.innerText()).replace(/[^0-9]/g, '') || '0', 10);
    await likeBtnAction.click();
    await page.waitForTimeout(2000);

    const nowLiked = await likeBtnAction.evaluate(el => el.classList.contains('is-active'));
    const newCount = parseInt((await likeBtnAction.innerText()).replace(/[^0-9]/g, '') || '0', 10);
    console.log(`After Like Click: is-active=${nowLiked}, count=${newCount} (prev=${prevCount})`);
    if (!nowLiked) throw new Error('Expected like button to have class "is-active"');
    if (newCount !== prevCount + 1) throw new Error(`Expected count to increment from ${prevCount} to ${prevCount + 1}, got ${newCount}`);

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'round12_fix_obra_liked.png') });
    console.log('Saved screenshot: round12_fix_obra_liked.png');

    // =========================================================================
    // STEP 6: RELOAD PAGE TO CONFIRM LIKE PERSISTENCE
    // =========================================================================
    console.log('\n--- 6. Reloading Page to Confirm Like Persistence ---');
    await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
    const likeBtnReloaded = page.locator('button.btn-like');
    await likeBtnReloaded.waitFor({ state: 'visible' });
    const reloadedIsLiked = await likeBtnReloaded.evaluate(el => el.classList.contains('is-active'));
    const reloadedCount = parseInt((await likeBtnReloaded.innerText()).replace(/[^0-9]/g, '') || '0', 10);
    console.log(`Reloaded Like State: is-active=${reloadedIsLiked}, count=${reloadedCount}`);
    if (!reloadedIsLiked) throw new Error('Like state did not persist after reload!');
    if (reloadedCount !== newCount) throw new Error('Like count changed after reload!');
    console.log('✓ Like successfully persisted!');

    // =========================================================================
    // STEP 7: CLICK UN-LIKE
    // =========================================================================
    console.log('\n--- 7. Clicking Un-Like ---');
    await likeBtnReloaded.click();
    await page.waitForTimeout(2000);
    const unlikedState = await likeBtnReloaded.evaluate(el => el.classList.contains('is-active'));
    const unlikedCount = parseInt((await likeBtnReloaded.innerText()).replace(/[^0-9]/g, '') || '0', 10);
    console.log(`After Un-Like Click: is-active=${unlikedState}, count=${unlikedCount}`);
    if (unlikedState) throw new Error('Expected like button to NOT have class "is-active" after unlike');
    if (unlikedCount !== prevCount) throw new Error(`Expected count to decrement back to ${prevCount}, got ${unlikedCount}`);

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'round12_fix_obra_unliked.png') });
    console.log('Saved screenshot: round12_fix_obra_unliked.png');

    console.log('\n======================================================');
    console.log('ALL PLAYWRIGHT TESTS PASSED! ZERO REGRESSIONS!');
    console.log('======================================================');
  } finally {
    await browser.close();
  }
}

run().catch(err => {
  console.error('Playwright verification failed:', err);
  process.exit(1);
});
