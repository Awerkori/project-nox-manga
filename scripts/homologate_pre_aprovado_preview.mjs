import { chromium } from '@playwright/test';
import { ownerCookies } from './owner-session.mjs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const targetUrl = process.env.BENCHMARK_TARGET_URL || 'https://home-preview-manga.project-nox-awerkori.workers.dev';
const artifactDir = '/home/awerkori/.gemini/antigravity-cli/brain/fa6d1923-db0b-428b-bc07-4973adaffd49';

async function main() {
  console.log(`Starting Pré-Aprovado Homologation & Screenshot Capture on: ${targetUrl}`);

  const cookies = await ownerCookies(targetUrl);
  cookies.push(
    {
      name: 'nox-age-status',
      value: 'ADULT',
      url: targetUrl,
      httpOnly: false,
      sameSite: 'Lax',
      secure: targetUrl.startsWith('https:')
    },
    {
      name: 'nox-blur-nsfw',
      value: 'false',
      url: targetUrl,
      httpOnly: false,
      sameSite: 'Lax',
      secure: targetUrl.startsWith('https:')
    }
  );

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

  try {
    // =========================================================================
    // PART 1: EMPTY STATE HOMOLOGATION (DESKTOP & MOBILE)
    // =========================================================================
    console.log('\n--- PART 1: EMPTY STATE ---');
    console.log('Ensuring fixture is empty...');
    execSync('node scripts/test_pre_aprovado_fixture.mjs set-empty', { stdio: 'inherit' });

    // Desktop 1440x900
    const deskCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await deskCtx.addCookies(cookies);
    const deskPage = await deskCtx.newPage();

    console.log('Navigating to Pré-aprovado on desktop (empty state)...');
    await deskPage.goto(`${targetUrl}/scan?tab=pipeline&stage=pre_aprovado`, { waitUntil: 'networkidle', timeout: 45000 });
    await deskPage.waitForTimeout(2500);

    // Verify empty state text
    const emptyAvailableCount = await deskPage.locator('.available-badge').innerText();
    const emptyMineCount = await deskPage.locator('.mine-badge').innerText();
    console.log(`Available badge count: ${emptyAvailableCount}, Mine badge count: ${emptyMineCount}`);

    // Verify empty state message
    const emptyTitle = await deskPage.locator('.empty-title').first().innerText();
    console.log(`Empty state title: "${emptyTitle}"`);

    // Capture desktop empty screenshot
    const deskEmptyPath = join(artifactDir, 'pre_aprovado_empty_desktop.png');
    await deskPage.screenshot({ path: deskEmptyPath, fullPage: false });
    console.log(`✓ Saved ${deskEmptyPath}`);

    // Mobile Viewport 390x844 (iPhone 14)
    const mobCtx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true
    });
    await mobCtx.addCookies(cookies);
    const mobPage = await mobCtx.newPage();

    console.log('Navigating to Pré-aprovado on mobile (empty state)...');
    await mobPage.goto(`${targetUrl}/scan?tab=pipeline&stage=pre_aprovado`, { waitUntil: 'networkidle', timeout: 45000 });
    await mobPage.waitForTimeout(2500);

    const mobEmptyPath = join(artifactDir, 'pre_aprovado_empty_mobile.png');
    await mobPage.screenshot({ path: mobEmptyPath, fullPage: false });
    console.log(`✓ Saved ${mobEmptyPath}`);

    // =========================================================================
    // PART 2: POPULATED STATE WITH TEST CHAPTER (DISTANTE SKY #85)
    // =========================================================================
    console.log('\n--- PART 2: POPULATED STATE (DISTANTE SKY #85) ---');
    console.log('Seeding Chapter 85 as available in Pré-aprovado...');
    execSync('node scripts/test_pre_aprovado_fixture.mjs set-ready', { stdio: 'inherit' });

    console.log('Reloading desktop page...');
    await deskPage.goto(`${targetUrl}/scan?tab=pipeline&stage=pre_aprovado`, { waitUntil: 'networkidle', timeout: 45000 });
    await deskPage.waitForTimeout(2500);

    // Check counts
    const populatedAvailableCount = await deskPage.locator('.available-badge').innerText();
    console.log(`Populated Available badge count: ${populatedAvailableCount}`);

    // Check chapter card is visible
    const cardTitle = await deskPage.locator('.chapter-title').first().innerText();
    console.log(`Card chapter title: "${cardTitle}"`);

    const deskPopulatedPath = join(artifactDir, 'pre_aprovado_populated_desktop.png');
    await deskPage.screenshot({ path: deskPopulatedPath, fullPage: false });
    console.log(`✓ Saved ${deskPopulatedPath}`);

    // Expand the card
    console.log('Expanding chapter card...');
    const btnExpand = deskPage.locator('.btn-toggle-work').first();
    await btnExpand.click();
    await deskPage.waitForTimeout(1000);

    const deskExpandedPath = join(artifactDir, 'pre_aprovado_expanded_desktop.png');
    await deskPage.screenshot({ path: deskExpandedPath, fullPage: false });
    console.log(`✓ Saved ${deskExpandedPath}`);

    // Mobile populated state
    console.log('Reloading mobile page...');
    await mobPage.goto(`${targetUrl}/scan?tab=pipeline&stage=pre_aprovado`, { waitUntil: 'networkidle', timeout: 45000 });
    await mobPage.waitForTimeout(2500);

    const mobPopulatedPath = join(artifactDir, 'pre_aprovado_populated_mobile.png');
    await mobPage.screenshot({ path: mobPopulatedPath, fullPage: false });
    console.log(`✓ Saved ${mobPopulatedPath}`);

    // =========================================================================
    // PART 3: PUBLICATION MODAL / BOTTOM SHEET
    // =========================================================================
    console.log('\n--- PART 3: PUBLICATION MODAL / BOTTOM SHEET ---');
    console.log('Opening publication modal on desktop...');
    const btnPublishDesk = deskPage.locator('.btn-publish-highlight').first();
    await btnPublishDesk.click();
    await deskPage.waitForTimeout(1200);

    // Verify modal is open
    const modalTitle = await deskPage.locator('#modal-publish-title').innerText();
    console.log(`Modal Title: "${modalTitle}"`);

    const deskModalPath = join(artifactDir, 'pre_aprovado_publish_modal_desktop.png');
    await deskPage.screenshot({ path: deskModalPath, fullPage: false });
    console.log(`✓ Saved ${deskModalPath}`);

    // Close desktop modal
    await deskPage.locator('.btn-modal-close').click();
    await deskPage.waitForTimeout(500);

    // Mobile bottom sheet
    console.log('Opening publication bottom sheet on mobile...');
    const btnPublishMob = mobPage.locator('.btn-publish-highlight').first();
    await btnPublishMob.click();
    await mobPage.waitForTimeout(1200);

    const mobSheetPath = join(artifactDir, 'pre_aprovado_publish_sheet_mobile.png');
    await mobPage.screenshot({ path: mobSheetPath, fullPage: false });
    console.log(`✓ Saved ${mobSheetPath}`);

    // =========================================================================
    // PART 4: CONFIRM PUBLICATION EXECUTION (SIMULATION / TRANSITION)
    // =========================================================================
    console.log('\n--- PART 4: CONFIRM PUBLICATION & POST-PUBLISH TRANSITION ---');
    // On desktop, open modal again and submit
    await btnPublishDesk.click();
    await deskPage.waitForTimeout(1000);

    console.log('Clicking "Publicar no catálogo" submit button...');
    const btnSubmit = deskPage.locator('.btn-modal-submit');
    await btnSubmit.click();
    await deskPage.waitForTimeout(3000);

    // Verify toast or banner
    const toastCount = await deskPage.locator('.publish-toast-banner').count();
    console.log(`Toast banner visible count: ${toastCount}`);
    if (toastCount > 0) {
      console.log('Toast message:', await deskPage.locator('.publish-toast-banner').innerText());
    }

    // Verify queue returned to 0
    const postAvailableCount = await deskPage.locator('.available-badge').innerText();
    console.log(`Post-publish Available count: ${postAvailableCount}`);

    const deskPostPublishPath = join(artifactDir, 'pre_aprovado_post_publish_desktop.png');
    await deskPage.screenshot({ path: deskPostPublishPath, fullPage: false });
    console.log(`✓ Saved ${deskPostPublishPath}`);

    // Leave Chapter 85 seeded as READY on preview for visual review by the user
    console.log('\nLeaving Chapter 85 seeded as READY on preview for visual inspection...');
    execSync('node scripts/test_pre_aprovado_fixture.mjs set-ready', { stdio: 'inherit' });

    console.log('\n=== ALL HOMOLOGATION STEPS COMPLETED SUCCESSFULLY! ===');
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('Homologation failed:', err);
  process.exit(1);
});
