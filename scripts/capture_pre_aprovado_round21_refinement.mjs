import { chromium } from '@playwright/test';
import { ownerCookies } from './owner-session.mjs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const targetUrl = process.env.BENCHMARK_TARGET_URL || 'https://home-preview-manga.project-nox-awerkori.workers.dev';
const artifactDir = '/home/awerkori/.gemini/antigravity-cli/brain/fa6d1923-db0b-428b-bc07-4973adaffd49';

async function main() {
  console.log(`Starting Pré-Aprovado Homologation & Screenshot Capture on: ${targetUrl}`);

  // Ensure Chapter 85 is seeded as READY / AVAILABLE
  console.log('Resetting fixture to READY / AVAILABLE...');
  execSync('node scripts/test_pre_aprovado_fixture.mjs set-ready', { stdio: 'inherit' });

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
    // -------------------------------------------------------------------------
    // 1. POPULATED STATE DESKTOP (1440x900)
    // -------------------------------------------------------------------------
    console.log('\n--- 1. DESKTOP POPULATED STATE ---');
    const ctxDesktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctxDesktop.addCookies(cookies);
    const pDesktop = await ctxDesktop.newPage();
    await pDesktop.goto(`${targetUrl}/scan?tab=pipeline&stage=pre_aprovado`, { waitUntil: 'networkidle' });
    await pDesktop.waitForSelector('.pre-card', { timeout: 15000 });

    const pathPopulatedDesktop = join(artifactDir, 'pre_aprovado_populated_desktop.png');
    await pDesktop.screenshot({ path: pathPopulatedDesktop, fullPage: false });
    console.log(`✓ Saved: ${pathPopulatedDesktop}`);

    // -------------------------------------------------------------------------
    // 2. CARD EXPANDED DESKTOP
    // -------------------------------------------------------------------------
    console.log('\n--- 2. DESKTOP EXPANDED CARD ---');
    await pDesktop.locator('.btn-toggle-work').first().click();
    await pDesktop.waitForSelector('.card-expanded-content', { timeout: 5000 });
    await pDesktop.waitForTimeout(400);

    const pathExpandedDesktop = join(artifactDir, 'pre_aprovado_expanded_desktop.png');
    await pDesktop.screenshot({ path: pathExpandedDesktop, fullPage: false });
    console.log(`✓ Saved: ${pathExpandedDesktop}`);

    // -------------------------------------------------------------------------
    // 3. PUBLICATION MODAL DESKTOP (WITH SAFETY & SIMULATION TOGGLE)
    // -------------------------------------------------------------------------
    console.log('\n--- 3. DESKTOP PUBLISH MODAL ---');
    await pDesktop.locator('.btn-publish-highlight').first().click();
    await pDesktop.waitForSelector('.publish-modal-card', { timeout: 5000 });
    await pDesktop.waitForTimeout(500);

    const pathModalDesktop = join(artifactDir, 'pre_aprovado_publish_modal_desktop.png');
    await pDesktop.screenshot({ path: pathModalDesktop, fullPage: false });
    console.log(`✓ Saved: ${pathModalDesktop}`);

    // -------------------------------------------------------------------------
    // 4. DUPLICATE CONFLICT VALIDATION (CHANGING NUMBER TO 84)
    // -------------------------------------------------------------------------
    console.log('\n--- 4. DUPLICATE CATALOG CONFLICT CHECK ---');
    const chapterInput = pDesktop.locator('#publish_chapter_num');
    await chapterInput.fill('84');
    await pDesktop.waitForTimeout(300);
    // Should trigger duplicate warning
    const duplicateBox = pDesktop.locator('.security-alert-box.is-warning');
    await duplicateBox.waitFor({ timeout: 5000 });

    const pathConflict = join(artifactDir, 'pre_aprovado_conflict_duplicate_desktop.png');
    await pDesktop.screenshot({ path: pathConflict, fullPage: false });
    console.log(`✓ Saved: ${pathConflict}`);

    // Reset back to 85
    await chapterInput.fill('85');
    await pDesktop.waitForTimeout(300);

    // Chapter 85 already exists in catalog as well (number 85.00), so confirm duplicate is required
    const confirmDuplicateBox = pDesktop.locator('.confirm-checkbox');
    if (await confirmDuplicateBox.isVisible()) {
      await confirmDuplicateBox.check();
      await pDesktop.waitForTimeout(200);
      console.log('✓ Confirmed duplicate replacement for Chapter 85');
    }

    // -------------------------------------------------------------------------
    // 5. SERVER-SIDE INCOMPLETE MATERIAL BLOCKING (UNCHECK SIMULATION)
    // -------------------------------------------------------------------------
    console.log('\n--- 5. SERVER BLOCKING INCOMPLETE MATERIAL ---');
    const simulationCheckbox = pDesktop.locator('.simulation-checkbox');
    // Uncheck simulation to test real publication block on chapter 85
    await simulationCheckbox.uncheck();
    await pDesktop.waitForTimeout(200);

    // Click submit button
    const submitBtn = pDesktop.locator('.btn-modal-submit');
    await submitBtn.click();
    // Wait for server error banner inside modal
    await pDesktop.waitForSelector('.security-alert-box.server-error', { timeout: 8000 });
    await pDesktop.waitForTimeout(400);

    const pathBlocked = join(artifactDir, 'pre_aprovado_validation_blocked_desktop.png');
    await pDesktop.screenshot({ path: pathBlocked, fullPage: false });
    console.log(`✓ Saved: ${pathBlocked}`);

    // -------------------------------------------------------------------------
    // 6. SAFE SIMULATED PUBLICATION & CONFIRMATION
    // -------------------------------------------------------------------------
    console.log('\n--- 6. SAFE SIMULATED PUBLICATION EXECUTION ---');
    // Re-check simulation mode
    await simulationCheckbox.check();
    await pDesktop.waitForTimeout(200);

    // Submit safe simulation
    await submitBtn.click();
    // Modal closes and success toast appears
    await pDesktop.waitForSelector('.publish-toast-banner.is-success', { timeout: 8000 });
    await pDesktop.waitForTimeout(500);

    const pathSimulated = join(artifactDir, 'pre_aprovado_simulated_publish_desktop.png');
    await pDesktop.screenshot({ path: pathSimulated, fullPage: false });
    console.log(`✓ Saved: ${pathSimulated}`);

    // -------------------------------------------------------------------------
    // 7. POST-PUBLISH ZERO STATE (DESKTOP)
    // -------------------------------------------------------------------------
    console.log('\n--- 7. POST-PUBLISH STATE ---');
    const pathPostPublish = join(artifactDir, 'pre_aprovado_post_publish_desktop.png');
    await pDesktop.screenshot({ path: pathPostPublish, fullPage: false });
    console.log(`✓ Saved: ${pathPostPublish}`);
    await ctxDesktop.close();

    // Reset fixture back to ready for mobile captures
    execSync('node scripts/test_pre_aprovado_fixture.mjs set-ready', { stdio: 'inherit' });

    // -------------------------------------------------------------------------
    // 8. MOBILE ANDROID (390x844) - POPULATED STATE & STAGES AUTO-SCROLL
    // -------------------------------------------------------------------------
    console.log('\n--- 8. MOBILE ANDROID (390x844) POPULATED STATE ---');
    const ctxMobile = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7 Build/UQ1A.231205.015) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.144 Mobile Safari/537.36'
    });
    await ctxMobile.addCookies(cookies);
    const pMobile = await ctxMobile.newPage();
    await pMobile.goto(`${targetUrl}/scan?tab=pipeline&stage=pre_aprovado`, { waitUntil: 'networkidle' });
    await pMobile.waitForSelector('.pre-card', { timeout: 15000 });
    await pMobile.waitForTimeout(600); // Allow smooth auto-scroll on stage switcher to settle

    const pathMobilePopulated = join(artifactDir, 'pre_aprovado_populated_mobile.png');
    await pMobile.screenshot({ path: pathMobilePopulated, fullPage: false });
    console.log(`✓ Saved: ${pathMobilePopulated}`);

    // -------------------------------------------------------------------------
    // 9. MOBILE EXPANDED CARD
    // -------------------------------------------------------------------------
    console.log('\n--- 9. MOBILE EXPANDED CARD ---');
    await pMobile.locator('.btn-toggle-work').first().click();
    await pMobile.waitForSelector('.card-expanded-content', { timeout: 5000 });
    await pMobile.waitForTimeout(400);

    const pathMobileExpanded = join(artifactDir, 'pre_aprovado_expanded_mobile.png');
    await pMobile.screenshot({ path: pathMobileExpanded, fullPage: false });
    console.log(`✓ Saved: ${pathMobileExpanded}`);

    // -------------------------------------------------------------------------
    // 10. MOBILE BOTTOM SHEET DE PUBLICAÇÃO
    // -------------------------------------------------------------------------
    console.log('\n--- 10. MOBILE PUBLISH BOTTOM SHEET ---');
    await pMobile.locator('.btn-publish-highlight').first().click();
    await pMobile.waitForSelector('.publish-modal-card', { timeout: 5000 });
    await pMobile.waitForTimeout(500);

    const pathMobileSheet = join(artifactDir, 'pre_aprovado_publish_sheet_mobile.png');
    await pMobile.screenshot({ path: pathMobileSheet, fullPage: false });
    console.log(`✓ Saved: ${pathMobileSheet}`);
    await ctxMobile.close();

    // -------------------------------------------------------------------------
    // 11. MULTI-DEVICE RESPONSIVE OVERFLOW AUDIT (320, 360, 430, 1280, 1920)
    // -------------------------------------------------------------------------
    console.log('\n--- 11. RESPONSIVE OVERFLOW AUDIT ---');
    const viewports = [
      { name: '320px', width: 320, height: 640 },
      { name: '360px', width: 360, height: 740 },
      { name: '430px', width: 430, height: 932 },
      { name: '1280px', width: 1280, height: 800 },
      { name: '1920px', width: 1920, height: 1080 }
    ];

    for (const vp of viewports) {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      await ctx.addCookies(cookies);
      const p = await ctx.newPage();
      await p.goto(`${targetUrl}/scan?tab=pipeline&stage=pre_aprovado`, { waitUntil: 'networkidle' });
      await p.waitForSelector('.pre-aprovado-root', { timeout: 10000 });
      const overflow = await p.evaluate(() => {
        return document.documentElement.scrollWidth - window.innerWidth;
      });
      console.log(`✓ Viewport ${vp.name}: Horizontal overflow = ${overflow}px`);
      await ctx.close();
    }

    // Leave Chapter 85 seeded as READY / AVAILABLE on Preview for user review
    execSync('node scripts/test_pre_aprovado_fixture.mjs set-ready', { stdio: 'inherit' });
    console.log('\n=== Homologation completed successfully! Fixture remains READY for user review. ===');

  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('Homologation failed:', err);
  process.exit(1);
});
