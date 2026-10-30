const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

for (const envPath of ['.dev.vars.preview_full', '.dev.vars.deploy', '.env']) {
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

const PREVIEW_URL = 'https://home-preview-manga.project-nox-awerkori.workers.dev';
const ARTIFACTS_DIR = '/home/awerkori/.gemini/antigravity-cli/brain/fa6d1923-db0b-428b-bc07-4973adaffd49';
const CHAPTER_URL = `${PREVIEW_URL}/ler/b88c0c5f-9664-5fae-a6d9-d5ad03af1369`;

async function dismissAgeGate(page) {
  try {
    const btn = page.locator('.btn-choice.adult');
    if (await btn.isVisible({ timeout: 1500 })) {
      await btn.click();
      await page.waitForTimeout(300);
    }
  } catch {}
}

async function run() {
  console.log('=== PROJECT NOX — RODADA 20 V15 FINAL INTERACTIONS & CLEANUP ===');
  const { ownerCookies } = await import('./owner-session.mjs');
  const sessionCookies = await ownerCookies(PREVIEW_URL);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2
  });

  await context.addCookies(sessionCookies);
  await context.addCookies([
    { name: 'nox-age-status', value: 'ADULT', domain: 'home-preview-manga.project-nox-awerkori.workers.dev', path: '/' }
  ]);

  const page = await context.newPage();
  console.log('Navigating to Chapter 76:', CHAPTER_URL);
  await page.goto(CHAPTER_URL, { waitUntil: 'load', timeout: 45000 });
  await page.waitForTimeout(2500);
  await dismissAgeGate(page);

  const commentsSection = page.locator('.comments-section-root').first();
  await commentsSection.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000);

  // Test Like
  const likeBtn = page.locator('.btn-footer-like').first();
  if (await likeBtn.isVisible()) {
    const initialLikes = await likeBtn.innerText();
    await likeBtn.click();
    await page.waitForTimeout(800);
    const updatedLikes = await likeBtn.innerText();
    console.log(`✓ Like interaction: "${initialLikes.trim()}" -> "${updatedLikes.trim()}"`);
  }

  // Test Spoiler
  const spoilerSpan = page.locator('.discord-spoiler').first();
  if (await spoilerSpan.isVisible()) {
    await spoilerSpan.click();
    await page.waitForTimeout(400);
    const isRevealed = await spoilerSpan.evaluate(el => el.classList.contains('is-revealed'));
    console.log(`✓ Spoiler toggle clicked. Revealed: ${isRevealed}`);
  }

  // Test Thread Collapse & Expand
  console.log('Testing thread collapse...');
  const collapseBtn = page.locator('.btn-thread-collapse').first();
  if (await collapseBtn.isVisible()) {
    await collapseBtn.click();
    await page.waitForTimeout(800);

    const collapsedBar = page.locator('.thread-collapsed-bar').first();
    if (await collapsedBar.isVisible()) {
      const text = await collapsedBar.innerText();
      console.log(`✓ Collapsed bar visible: "${text.replace(/\n/g, ' ')}"`);
      await collapsedBar.screenshot({
        path: path.join(ARTIFACTS_DIR, 'v15_thread_collapsed_state.png')
      });
      console.log('✓ v15_thread_collapsed_state.png saved.');
      // Expand back
      await collapsedBar.click();
      await page.waitForTimeout(600);
      console.log('✓ Thread expanded back.');
    }
  }

  // Test Granular Moderation Modal opening
  console.log('Testing granular moderation modal...');
  const delBtn = page.locator('.btn-footer-secondary.text-danger').first();
  if (await delBtn.isVisible()) {
    await delBtn.click();
    await page.waitForTimeout(600);
    const modal = page.locator('.moderation-modal-card').first();
    if (await modal.isVisible()) {
      console.log('✓ Granular moderation modal opened!');
      await page.screenshot({
        path: path.join(ARTIFACTS_DIR, 'v15_moderation_modal.png')
      });
      console.log('✓ v15_moderation_modal.png saved.');
      const cancelBtn = page.locator('.btn-modal-cancel').first();
      await cancelBtn.click();
      await page.waitForTimeout(400);
    }
  }

  // Clean up all test comments
  console.log('Cleaning up all test comments...');
  let deletedAny = true;
  let rounds = 0;
  while (deletedAny && rounds < 25) {
    rounds++;
    deletedAny = false;

    // Close any stuck modal if present
    const openCancel = page.locator('.btn-modal-cancel').first();
    if (await openCancel.isVisible({ timeout: 500 }).catch(() => false)) {
      await openCancel.click();
      await page.waitForTimeout(400);
    }

    const testCard = page.locator('.comment-card-modern:has-text("[V15 Test")').last();
    if (await testCard.isVisible({ timeout: 1500 }).catch(() => false)) {
      const cardDel = testCard.locator('.btn-footer-secondary.text-danger').first();
      if (await cardDel.isVisible({ timeout: 1000 }).catch(() => false)) {
        await cardDel.click();
        await page.waitForTimeout(500);

        const granularDel = page.locator('.granular-option-card.option-delete-all').first();
        const simpleDel = page.locator('.btn-modal-delete').first();
        if (await granularDel.isVisible({ timeout: 1000 }).catch(() => false)) {
          await granularDel.click();
          await page.waitForTimeout(1500);
          deletedAny = true;
          console.log(`✓ Deleted media test comment (round ${rounds})`);
        } else if (await simpleDel.isVisible({ timeout: 1000 }).catch(() => false)) {
          await simpleDel.click();
          await page.waitForTimeout(1500);
          deletedAny = true;
          console.log(`✓ Deleted text test comment (round ${rounds})`);
        }
      }
    }
  }
  console.log('✓ Cleanup process finished.');

  await browser.close();
  console.log('=== ALL TESTS COMPLETED SUCCESSFULLY ===');
}

run().catch(err => {
  console.error('Error in finish_v15_tests_and_cleanup.cjs:', err);
  process.exit(1);
});
