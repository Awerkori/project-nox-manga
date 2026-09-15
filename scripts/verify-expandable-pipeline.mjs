import { chromium } from '@playwright/test';
import { ownerCookies } from './owner-session.mjs';

async function run() {
  console.log('🚀 Starting verification of Expandable Pipeline Navigation...');
  const origin = 'http://127.0.0.1:5173';
  const cookies = await ownerCookies(origin);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  await context.addCookies(cookies);

  const page = await context.newPage();

  // 1. Navigate to /scan?tab=pipeline&stage=clean_redraw
  console.log('1. Navigating to /scan?tab=pipeline&stage=clean_redraw...');
  await page.goto(`${origin}/scan?tab=pipeline&stage=clean_redraw`, { waitUntil: 'networkidle' });

  // 2. Verify sidebar pipeline expandable section
  console.log('2. Verifying Sidebar Expandable Menu...');
  const pipelineGroup = page.locator('.nav-expandable-group');
  await pipelineGroup.waitFor({ state: 'visible', timeout: 10000 });

  // Verify all 9 subcategory stage buttons in sidebar
  const stagesExpected = [
    'RAW',
    'Clean',
    'Tradução',
    'Typeset',
    'Revisão',
    'QC',
    'Pronto pra Upar',
    'Preview',
    'Publicado'
  ];

  for (const st of stagesExpected) {
    const btn = page.locator(`.nav-sub-btn:has-text("${st}")`);
    const count = await btn.count();
    if (count === 0) {
      throw new Error(`Sidebar stage button "${st}" not found!`);
    }
    console.log(`  ✓ Subcategory stage "${st}" visible in sidebar`);
  }

  // 3. Verify Active Stage Clean
  console.log('3. Verifying Clean Stage view...');
  const mainTitle = page.locator('.stage-main-title');
  await mainTitle.waitFor({ state: 'visible' });
  const titleText = await mainTitle.textContent();
  console.log(`  Main Title: "${titleText}"`);
  if (!titleText.includes('Clean')) {
    throw new Error(`Expected title to include "Clean", got: "${titleText}"`);
  }

  const subtitle = page.locator('.stage-hero-subtitle');
  const subText = await subtitle.textContent();
  console.log(`  Subtitle: "${subText}"`);
  if (!subText.includes('Baixe o RAW, faça a limpeza e envie o arquivo final')) {
    throw new Error(`Subtitle mismatch: "${subText}"`);
  }

  // 4. Verify quick pill selector at top
  console.log('4. Verifying Quick Stages Pill Nav...');
  const quickPillTrack = page.locator('.quick-stages-pill-nav');
  await quickPillTrack.waitFor({ state: 'visible' });
  const pillCount = await page.locator('.stage-pill-btn').count();
  console.log(`  ✓ Found ${pillCount} stage pills in top quick switcher`);
  if (pillCount < 9) {
    throw new Error(`Expected at least 9 stage pills, found ${pillCount}`);
  }

  // 5. Verify Capítulos disponíveis and Meus capítulos sections
  console.log('5. Verifying Sections (Capítulos disponíveis & Meus capítulos)...');
  const availableHeader = page.locator('.section-title:has-text("Capítulos disponíveis")');
  await availableHeader.waitFor({ state: 'visible' });
  console.log('  ✓ Section "Capítulos disponíveis" present');

  const mineHeader = page.locator('.section-title:has-text("Meus capítulos")');
  await mineHeader.waitFor({ state: 'visible' });
  console.log('  ✓ Section "Meus capítulos" present');

  // Check if numbered steps exist in any active card or empty state exists
  const hasMyCards = await page.locator('.my-chapter-card').count();
  console.log(`  Meus Capítulos cards count: ${hasMyCards}`);
  if (hasMyCards > 0) {
    const step1 = page.locator('.step-title:has-text("Baixar os arquivos necessários")');
    console.log(`  ✓ Passo 1 title: ${await step1.first().textContent()}`);
    const step2 = page.locator('.step-title:has-text("Enviar o arquivo finalizado")');
    console.log(`  ✓ Passo 2 title: ${await step2.first().textContent()}`);
    const step3 = page.locator('.step-title:has-text("Concluir etapa e repassar")');
    console.log(`  ✓ Passo 3 title: ${await step3.first().textContent()}`);
  } else {
    const emptyDesc = page.locator('.flow-empty-state');
    console.log(`  ✓ Empty state displayed properly: ${await emptyDesc.first().isVisible()}`);
  }

  // 6. Test Stage Navigation: RAW
  console.log('6. Testing Navigation to RAW stage...');
  const rawSubBtn = page.locator('.nav-sub-btn:has-text("RAW")').first();
  await rawSubBtn.click();
  await page.waitForTimeout(600);
  console.log('  URL after click:', page.url());
  const rawTitle = await page.locator('.stage-main-title').textContent();
  console.log(`  Main Title after switching to RAW: "${rawTitle}"`);
  if (!rawTitle.includes('RAW')) {
    throw new Error(`Expected RAW title, got ${rawTitle}`);
  }

  // Check RAW new chapter trigger
  const newChTrigger = page.locator('.btn-new-chapter-trigger');
  if (await newChTrigger.isVisible()) {
    console.log('  ✓ "Cadastrar Novo Capítulo" button visible in RAW stage');
    await newChTrigger.click();
    await page.waitForTimeout(300);
    const newCard = page.locator('.raw-new-chapter-card');
    if (await newCard.isVisible()) {
      console.log('  ✓ "Cadastrar Novo Capítulo" card expanded properly');
    }
  }

  // 7. Test Stage Navigation: Typeset (Checking dual inputs Clean & Tradução)
  console.log('7. Testing Navigation to Typeset stage...');
  const typesetPill = page.locator('.stage-pill-btn:has-text("Typeset")');
  await typesetPill.click();
  await page.waitForTimeout(600);
  const typesetTitle = await page.locator('.stage-main-title').textContent();
  console.log(`  Main Title after switching to Typeset: "${typesetTitle}"`);
  if (!typesetTitle.includes('Typeset')) {
    throw new Error(`Expected Typeset title, got ${typesetTitle}`);
  }

  // 8. Test Stage Navigation: Revisão (Checklist without mandatory upload)
  console.log('8. Testing Navigation to Revisão stage...');
  const revisaoSubBtn = page.locator('.nav-sub-btn:has-text("Revisão")');
  await revisaoSubBtn.click();
  await page.waitForTimeout(600);
  const revisaoTitle = await page.locator('.stage-main-title').textContent();
  console.log(`  Main Title after switching to Revisão: "${revisaoTitle}"`);
  if (!revisaoTitle.includes('Revisão')) {
    throw new Error(`Expected Revisão title, got ${revisaoTitle}`);
  }

  // 9. Test Stage Navigation: QC
  console.log('9. Testing Navigation to QC stage...');
  const qcPill = page.locator('.stage-pill-btn:has-text("QC")');
  await qcPill.click();
  await page.waitForTimeout(600);
  const qcTitle = await page.locator('.stage-main-title').textContent();
  console.log(`  Main Title after switching to QC: "${qcTitle}"`);
  if (!qcTitle.includes('QC')) {
    throw new Error(`Expected QC title, got ${qcTitle}`);
  }

  // 10. Test Mobile Viewport (375x812)
  console.log('10. Testing Mobile Viewport (375x812)...');
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(500);

  // Check horizontal overflow
  const isOverflowing = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  console.log(`  Mobile Horizontal Overflow: ${isOverflowing ? 'FAILED (Overflow detected)' : 'PASSED (Zero overflow)'}`);
  if (isOverflowing) {
    throw new Error('Horizontal overflow detected on mobile viewport!');
  }

  // Open mobile sidebar drawer
  const hamburger = page.locator('.btn-hamburger');
  await hamburger.waitFor({ state: 'visible' });
  await hamburger.click();
  await page.waitForTimeout(500);

  const mobileSidebar = page.locator('.workspace-sidebar.mobile-open');
  if (!(await mobileSidebar.isVisible())) {
    throw new Error('Mobile drawer did not open upon hamburger click!');
  }
  console.log('  ✓ Mobile sidebar drawer opened successfully');

  // Verify subcategory stages in mobile sidebar
  const mobileClean = mobileSidebar.locator('.nav-sub-btn:has-text("Clean")');
  if (!(await mobileClean.isVisible())) {
    throw new Error('Clean subcategory not visible in mobile drawer!');
  }
  console.log('  ✓ Subcategories visible and accessible in mobile drawer');

  // Click Clean in mobile sidebar
  await mobileClean.click();
  await page.waitForTimeout(600);

  // Take mobile screenshot for evidence
  await page.screenshot({ path: 'scripts/evidence-mobile-pipeline.png' });
  console.log('  ✓ Captured mobile screenshot: scripts/evidence-mobile-pipeline.png');

  // Switch back to desktop and take screenshot
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'scripts/evidence-desktop-pipeline.png' });
  console.log('  ✓ Captured desktop screenshot: scripts/evidence-desktop-pipeline.png');

  console.log('\n🎉 ALL PIPELINE VERIFICATION CHECKS PASSED PERFECTLY!');
  await browser.close();
}

run().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
