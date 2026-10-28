const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { Client } = require('pg');

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

async function main() {
  const { ownerCookies } = await import('./owner-session.mjs');
  const sessionCookies = await ownerCookies(PREVIEW_URL);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2
  });
  await ctx.addCookies(sessionCookies);
  await ctx.addCookies([
    { name: 'nox-age-status', value: 'ADULT', domain: 'home-preview-manga.project-nox-awerkori.workers.dev', path: '/' }
  ]);

  const page = await ctx.newPage();
  await page.goto(CHAPTER_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // 1. User comment 0fb3ec03 with square image & single char || L ||
  const userComment = page.locator('#comment-0fb3ec03-0ccb-457d-8bb2-79eb95de726f');
  await userComment.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);

  // Capture square image
  await userComment.screenshot({
    path: path.join(ARTIFACTS_DIR, 'v6_comment_square_image.png')
  });
  console.log('✓ Captured: v6_comment_square_image.png');

  // Capture single char spoiler || L || before reveal
  await userComment.screenshot({
    path: path.join(ARTIFACTS_DIR, 'v6_spoiler_single_char_L.png')
  });
  console.log('✓ Captured: v6_spoiler_single_char_L.png');

  // Click the spoiler button to reveal it
  const spoilerBtn = userComment.locator('.discord-spoiler').first();
  await spoilerBtn.click();
  await page.waitForTimeout(400);

  // Capture revealed spoiler
  await userComment.screenshot({
    path: path.join(ARTIFACTS_DIR, 'v6_spoiler_revealed.png')
  });
  console.log('✓ Captured: v6_spoiler_revealed.png');

  // 2. Comment 552e00e0 with sentence spoiler
  const sentComment = page.locator('#comment-552e00e0-8198-4ff4-800b-ef1d77522787');
  await sentComment.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await sentComment.screenshot({
    path: path.join(ARTIFACTS_DIR, 'v6_spoiler_sentence.png')
  });
  console.log('✓ Captured: v6_spoiler_sentence.png');

  // 3. Comment a66a4e6f with animated GIF
  const gifComment = page.locator('#comment-a66a4e6f-30d0-427a-ab26-aa6f2a464368');
  await gifComment.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await gifComment.screenshot({
    path: path.join(ARTIFACTS_DIR, 'v6_comment_animated_gif.png')
  });
  console.log('✓ Captured: v6_comment_animated_gif.png');

  // 4. Comment cacc1eb7 with vertical + horizontal + text + spoiler
  const propComment = page.locator('#comment-cacc1eb7-a710-4ca0-8cd0-94a59c67f79f');
  await propComment.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await propComment.screenshot({
    path: path.join(ARTIFACTS_DIR, 'v6_comment_vertical_image.png')
  });
  await propComment.screenshot({
    path: path.join(ARTIFACTS_DIR, 'v6_comment_horizontal_image.png')
  });
  await propComment.screenshot({
    path: path.join(ARTIFACTS_DIR, 'v6_comment_text_spoiler_image.png')
  });
  console.log('✓ Captured: vertical, horizontal and text+spoiler+image screenshots.');

  // 5. Test comment deletion on 30182e95
  const delComment = page.locator('#comment-30182e95-7616-4a58-b16b-0b02c2f6ad01');
  await delComment.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);

  const delBtn = delComment.locator('.btn-footer-action.text-danger').first();
  await delBtn.click();
  await page.waitForTimeout(500);

  // Capture modal
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'v6_delete_confirmation_modal.png')
  });
  console.log('✓ Captured: v6_delete_confirmation_modal.png');

  // Confirm delete
  await page.click('.btn-modal-delete');
  await page.waitForTimeout(2000);

  // Capture comments section after deletion
  await page.locator('.comments-section-root').scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'v6_comment_deleted_success.png')
  });
  console.log('✓ Captured: v6_comment_deleted_success.png');

  await browser.close();

  // Verify deletion in database
  const client = new Client({
    connectionString: 'postgresql://postgres:ZJGsV8lUOarRFjDo@db.izregkwaqdygwioqzwwo.supabase.co:5432/postgres',
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  const { rows } = await client.query('SELECT id, removed, deleted, deleted_at FROM public.comments WHERE id = $1', ['30182e95-7616-4a58-b16b-0b02c2f6ad01']);
  console.log('Database verification after deletion:', rows[0]);
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
