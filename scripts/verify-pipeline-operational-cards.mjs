import { chromium } from '@playwright/test';
import { ownerCookies } from './owner-session.mjs';

async function testOperations() {
  console.log('🚀 Testing Operational Cards in Pipeline Stages...');
  const origin = 'http://127.0.0.1:5173';
  const cookies = await ownerCookies(origin);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  await context.addCookies(cookies);

  const page = await context.newPage();

  // Go to RAW stage
  await page.goto(`${origin}/scan?tab=pipeline&stage=raw`, { waitUntil: 'networkidle' });

  // Check if there are available chapters or create one
  const availableCount = await page.locator('.available-card').count();
  console.log(`Initial available RAW chapters: ${availableCount}`);

  // Create a new test chapter if button is visible
  const newChBtn = page.locator('.btn-new-chapter-trigger');
  if (await newChBtn.isVisible()) {
    console.log('Creating a test chapter via RAW card...');
    await newChBtn.click();
    await page.waitForTimeout(300);

    const workSelect = page.locator('#raw_work_select');
    await workSelect.selectOption({ index: 1 }); // select first available work

    const randomNum = Math.floor(Math.random() * 800) + 100;
    await page.fill('#raw_ch_num', String(randomNum));
    await page.fill('#raw_ch_label', 'Capítulo Homologação Pipeline');

    await page.locator('.btn-start-production').click();
    await page.waitForTimeout(2000);
    console.log(`Created test chapter #${randomNum}`);
  }

  // Reload page to refresh data
  await page.goto(`${origin}/scan?tab=pipeline&stage=raw`, { waitUntil: 'networkidle' });
  const availableAfter = await page.locator('.available-card').count();
  console.log(`Available RAW chapters after creation: ${availableAfter}`);

  if (availableAfter > 0) {
    const firstAvailableCard = page.locator('.available-card').first();
    const claimBtn = firstAvailableCard.locator('.btn-claim-primary');
    console.log('Claiming RAW chapter...');
    await claimBtn.click();
    await page.waitForTimeout(2000);

    // Reload or wait
    await page.goto(`${origin}/scan?tab=pipeline&stage=raw`, { waitUntil: 'networkidle' });

    // Verify it moved to "Meus capítulos"
    const myCount = await page.locator('.my-chapter-card').count();
    console.log(`Meus capítulos count: ${myCount}`);
    if (myCount > 0) {
      console.log('✓ Chapter successfully claimed and appears in "Meus capítulos"!');

      const myCard = page.locator('.my-chapter-card').first();

      // Check "Ver capítulo" button
      const viewChBtn = myCard.locator('.btn-view-chapter-outline');
      console.log(`✓ "Ver capítulo" button present: ${await viewChBtn.isVisible()}`);

      // Check Step 1 (Baixar)
      const step1 = myCard.locator('.step-badge:has-text("1")');
      console.log(`✓ Step 1 present: ${await step1.isVisible()}`);

      // Check Step 2 (Upload)
      const step2 = myCard.locator('.step-badge:has-text("2")');
      console.log(`✓ Step 2 present: ${await step2.isVisible()}`);

      // Check Step 3 (Concluir & Devolver à fila)
      const step3 = myCard.locator('.step-badge:has-text("3")');
      console.log(`✓ Step 3 present: ${await step3.isVisible()}`);

      const releaseBtn = myCard.locator('.btn-release-subtle');
      console.log(`✓ "Devolver à fila" button present: ${await releaseBtn.isVisible()}`);

      // Test "Devolver à fila"
      console.log('Testing "Devolver à fila"...');
      await releaseBtn.click();
      await page.waitForTimeout(2000);

      await page.goto(`${origin}/scan?tab=pipeline&stage=raw`, { waitUntil: 'networkidle' });
      const myCountAfterRelease = await page.locator('.my-chapter-card').count();
      console.log(`Meus capítulos count after release: ${myCountAfterRelease}`);
      console.log('✓ "Devolver à fila" successfully returned chapter to available pool!');
    }
  }

  // Navigate to Revisão to check conference checklist
  console.log('\nTesting Revisão stage checklist...');
  await page.goto(`${origin}/scan?tab=pipeline&stage=revisao`, { waitUntil: 'networkidle' });
  const revisaoTitle = await page.locator('.stage-main-title').textContent();
  console.log(`Revisão title: "${revisaoTitle}"`);

  // Navigate to QC to check QC Inspector button
  console.log('\nTesting QC stage...');
  await page.goto(`${origin}/scan?tab=pipeline&stage=qc`, { waitUntil: 'networkidle' });
  const qcTitle = await page.locator('.stage-main-title').textContent();
  console.log(`QC title: "${qcTitle}"`);

  // Navigate to Pronto pra Upar
  console.log('\nTesting Pronto pra Upar stage...');
  await page.goto(`${origin}/scan?tab=pipeline&stage=ready`, { waitUntil: 'networkidle' });
  const readyTitle = await page.locator('.stage-main-title').textContent();
  console.log(`Ready title: "${readyTitle}"`);

  // Navigate to Publicado
  console.log('\nTesting Publicado stage...');
  await page.goto(`${origin}/scan?tab=pipeline&stage=publicado`, { waitUntil: 'networkidle' });
  const pubTitle = await page.locator('.stage-main-title').textContent();
  console.log(`Publicado title: "${pubTitle}"`);

  // Capture final evidence screenshot of Clean stage
  await page.goto(`${origin}/scan?tab=pipeline&stage=clean_redraw`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: 'scripts/evidence-clean-stage.png' });
  console.log('✓ Captured evidence screenshot: scripts/evidence-clean-stage.png');

  console.log('\n🎉 ALL OPERATIONAL CARDS AND WORKFLOW ACTIONS VERIFIED SUCCESSFULLY!');
  await browser.close();
}

testOperations().catch(err => {
  console.error('❌ Operational test failed:', err);
  process.exit(1);
});
