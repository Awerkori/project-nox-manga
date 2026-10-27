const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = '/home/awerkori/.gemini/antigravity-cli/brain/fa6d1923-db0b-428b-bc07-4973adaffd49';
const PREVIEW_URL = 'https://home-preview-manga.project-nox-awerkori.workers.dev';

async function run() {
  console.log('=== STARTING SCAN ADMISSIONS & REGISTRATION PLAYWRIGHT VERIFICATION ===');

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
    console.log('Successfully acquired legitimate authenticated session cookies.');
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
    // =========================================================================
    // 1. UNAUTHENTICATED VISITOR FLOW ON /scans
    // =========================================================================
    console.log('\n--- 1. Testing Unauthenticated Visitor on /scans ---');
    const anonContext = await browser.newContext({
      viewport: { width: 1440, height: 900 }
    });
    await anonContext.addCookies([
      { name: 'nox-age-status', value: 'ADULT', url: PREVIEW_URL }
    ]);
    const anonPage = await anonContext.newPage();
    await anonPage.goto(`${PREVIEW_URL}/scans`, { waitUntil: 'networkidle' });

    // Verify affiliate card text & CTA
    const affiliateTitle = await anonPage.locator('.affiliate-title').textContent();
    const affiliateBtnText = await anonPage.locator('.affiliate-action').textContent();
    const affiliateBtnHref = await anonPage.locator('.affiliate-action').getAttribute('href');

    console.log('Affiliate Card Title:', affiliateTitle?.trim());
    console.log('Affiliate Button Text:', affiliateBtnText?.trim());
    console.log('Affiliate Button Href:', affiliateBtnHref);

    const ctaMatches = affiliateBtnText && affiliateBtnText.includes('Cadastrar Minha Scan');
    const hrefMatches = affiliateBtnHref === '/scans/cadastrar';

    results.tests.push({
      test: 'Affiliate CTA Button Update',
      passed: Boolean(ctaMatches && hrefMatches),
      details: { title: affiliateTitle?.trim(), button: affiliateBtnText?.trim(), href: affiliateBtnHref }
    });

    const ctaShotDesktop = path.join(ARTIFACT_DIR, 'round12_scans_hub_cta_desktop.png');
    await anonPage.screenshot({ path: ctaShotDesktop, fullPage: false });

    // Mobile check of CTA on /scans
    await anonPage.setViewportSize({ width: 390, height: 844 });
    await anonPage.waitForTimeout(300);
    const ctaShotMobile = path.join(ARTIFACT_DIR, 'round12_scans_hub_cta_mobile.png');
    await anonPage.screenshot({ path: ctaShotMobile, fullPage: false });

    // Click CTA to navigate to /scans/cadastrar
    console.log('\n--- 2. Testing Unauthenticated Gate on /scans/cadastrar ---');
    await anonPage.click('.affiliate-action');
    await anonPage.waitForURL('**/scans/cadastrar');
    await anonPage.waitForTimeout(600);

    const gateTitle = await anonPage.locator('.gate-title').textContent();
    const gateBtn = await anonPage.locator('.btn-gate-login').textContent();
    console.log('Auth Gate Title:', gateTitle?.trim());
    console.log('Auth Gate Login Button:', gateBtn?.trim());

    results.tests.push({
      test: 'Unauthenticated Gate on /scans/cadastrar',
      passed: Boolean(gateTitle && gateTitle.includes('Conecte-se para Cadastrar sua Scan')),
      details: { title: gateTitle?.trim(), button: gateBtn?.trim() }
    });

    await anonPage.setViewportSize({ width: 1440, height: 900 });
    const gateShotDesktop = path.join(ARTIFACT_DIR, 'round12_cadastrar_auth_gate_desktop.png');
    await anonPage.screenshot({ path: gateShotDesktop, fullPage: true });

    await anonPage.setViewportSize({ width: 390, height: 844 });
    const gateShotMobile = path.join(ARTIFACT_DIR, 'round12_cadastrar_auth_gate_mobile.png');
    await anonPage.screenshot({ path: gateShotMobile, fullPage: true });

    await anonContext.close();

    // =========================================================================
    // 2. AUTHENTICATED CANDIDATE APPLICATION FORM & FRAMING TOOLS
    // =========================================================================
    console.log('\n--- 3. Testing Authenticated Form on /scans/cadastrar ---');
    const authContext = await browser.newContext({
      viewport: { width: 1440, height: 900 }
    });
    if (sessionCookies.length > 0) {
      await authContext.addCookies([
        ...sessionCookies,
        { name: 'nox-age-status', value: 'ADULT', url: PREVIEW_URL }
      ]);
    }
    const authPage = await authContext.newPage();
    await authPage.goto(`${PREVIEW_URL}/scans/cadastrar`, { waitUntil: 'networkidle' });

    // Check if user has pending request or is on form
    const hasPending = await authPage.locator('.status-tracking-card').count() > 0;
    console.log('Has active pending request on load:', hasPending);

    // If there is an existing pending request from previous runs, we can inspect it or cancel it to test the form
    if (hasPending) {
      const pendingScanName = await authPage.locator('.status-scan-name').textContent();
      console.log('Active pending scan:', pendingScanName?.trim());

      const trackingShot = path.join(ARTIFACT_DIR, 'round12_candidate_pending_tracking_card.png');
      await authPage.screenshot({ path: trackingShot, fullPage: true });

      results.tests.push({
        test: 'Candidate Active Pending Tracking Card',
        passed: true,
        details: { scanName: pendingScanName?.trim() }
      });

      // Cancel it to access clean form for visual verification
      console.log('Cancelling existing test pending request to verify clean application form...');
      authPage.on('dialog', async (dialog) => {
        await dialog.accept();
      });
      await authPage.click('.btn-cancel-request');
      await authPage.waitForTimeout(1000);
      await authPage.goto(`${PREVIEW_URL}/scans/cadastrar`, { waitUntil: 'networkidle' });
    }

    // Now test the application form fields
    const formVisible = await authPage.locator('.admission-form').count() > 0;
    console.log('Application Form Visible:', formVisible);

    results.tests.push({
      test: 'Candidate Application Form Rendered',
      passed: formVisible
    });

    if (formVisible) {
      // 1. Fill Name and observe auto-slug
      await authPage.fill('#scan-name', 'Imperador Scans');
      await authPage.waitForTimeout(300);
      const generatedSlug = await authPage.inputValue('#scan-slug');
      console.log('Auto-generated Slug:', generatedSlug);

      results.tests.push({
        test: 'Auto-derived Slug Generation',
        passed: generatedSlug === 'imperador-scans',
        details: { generatedSlug }
      });

      // 2. Fill Description and Social Links
      await authPage.fill('#scan-description', 'Scan de traduções de alta fidelidade focada em manhuas de cultivação, artes marciais e fantasia oriental. Equipe dedicada à localização de qualidade.');
      await authPage.fill('#scan-discord', 'https://discord.gg/imperadorscans');
      await authPage.fill('#scan-fluxer', '@imperadorscans');
      await authPage.fill('#scan-website', 'https://imperadorscans.com');
      await authPage.fill('#sample-links', 'https://leitor.imperadorscans.com/capitulo-1\nhttps://leitor.imperadorscans.com/capitulo-2');
      await authPage.fill('#extra-info', '6 membros ativos (2 tradutores, 2 redrawers/typesetters, 2 revisores). 3 capítulos por semana.');
      await authPage.fill('#admin-message', 'Olá moderação do Project Nox! Gostaríamos de publicar nossos projetos no site para alcançar mais leitores.');

      // 3. Test Banner Framing Controls Toggle
      await authPage.click('.view-pill:has-text("Ver Arte Completa")');
      await authPage.waitForTimeout(200);
      await authPage.click('.view-pill:has-text("Enquadramento Widescreen")');
      await authPage.waitForTimeout(200);

      // Screenshot filled form on Desktop
      const formShotDesktop = path.join(ARTIFACT_DIR, 'round12_form_filled_desktop.png');
      await authPage.screenshot({ path: formShotDesktop, fullPage: true });

      // Screenshot filled form on Mobile
      await authPage.setViewportSize({ width: 390, height: 844 });
      await authPage.waitForTimeout(300);
      const formShotMobile = path.join(ARTIFACT_DIR, 'round12_form_filled_mobile.png');
      await authPage.screenshot({ path: formShotMobile, fullPage: true });

      // Restore desktop viewport
      await authPage.setViewportSize({ width: 1440, height: 900 });

      // =======================================================================
      // 3. "VISUALIZAR MINHA SCAN" LIVE REALISTIC PREVIEW
      // =======================================================================
      console.log('\n--- 4. Testing "Visualizar Minha Scan" Live Realistic Preview ---');
      await authPage.click('.preview-tab-btn');
      await authPage.waitForTimeout(500);

      // Verify preview components
      const previewBannerVisible = await authPage.locator('.preview-mode-banner').isVisible();
      const mockScanTitle = await authPage.locator('.mock-title').textContent();
      const mockSealText = await authPage.locator('.mock-seal-partner').textContent();
      const mockTabsCount = await authPage.locator('.mock-nav-btn').count();

      console.log('Preview Banner Visible:', previewBannerVisible);
      console.log('Mock Scan Title:', mockScanTitle?.trim());
      console.log('Mock Seal Text:', mockSealText?.trim());
      console.log('Mock Tabs Count (Must be 4):', mockTabsCount);

      results.tests.push({
        test: 'Visualizar Minha Scan Realistic Preview Architecture',
        passed: Boolean(previewBannerVisible && mockScanTitle?.includes('Imperador Scans') && mockTabsCount === 4),
        details: { title: mockScanTitle?.trim(), tabsCount: mockTabsCount }
      });

      // Verify Tab Switching in Preview
      await authPage.click('.mock-nav-btn:has-text("Equipe")');
      await authPage.waitForTimeout(300);
      const equipeCardVisible = await authPage.locator('.mock-member-card').isVisible();

      await authPage.click('.mock-nav-btn:has-text("Recrutamento")');
      await authPage.waitForTimeout(300);

      await authPage.click('.mock-nav-btn:has-text("Obras")');
      await authPage.waitForTimeout(300);

      // Multi-viewport screenshots of the realistic preview
      const viewports = [
        { name: 'desktop_1920', width: 1920, height: 1080 },
        { name: 'desktop_1440', width: 1440, height: 900 },
        { name: 'mobile_430', width: 430, height: 932 },
        { name: 'mobile_390', width: 390, height: 844 },
        { name: 'mobile_360', width: 360, height: 780 }
      ];

      for (const vp of viewports) {
        await authPage.setViewportSize({ width: vp.width, height: vp.height });
        await authPage.waitForTimeout(300);
        const shotPath = path.join(ARTIFACT_DIR, `round12_preview_realistic_${vp.name}.png`);
        await authPage.screenshot({ path: shotPath, fullPage: true });
        console.log(`Saved screenshot: round12_preview_realistic_${vp.name}.png`);
      }

      // Return to editing mode
      await authPage.setViewportSize({ width: 1440, height: 900 });
      await authPage.click('.btn-return-edit');
      await authPage.waitForTimeout(400);

      // Submit application to test PENDING state and admin review!
      console.log('\n--- 5. Submitting Application to test PENDING State & Admin Flow ---');
      await authPage.click('.btn-footer-submit');
      await authPage.waitForTimeout(2500);

      // Verify that after submission, user sees status tracking card
      const nowPending = await authPage.locator('.status-tracking-card').isVisible();
      console.log('Status Tracking Card visible after submit:', nowPending);

      results.tests.push({
        test: 'Application Submission to PENDING status',
        passed: nowPending
      });

      if (nowPending) {
        const shotPending = path.join(ARTIFACT_DIR, 'round12_application_submitted_pending.png');
        await authPage.screenshot({ path: shotPending, fullPage: true });
      }
    }

    // =========================================================================
    // 4. ADMIN SECTION (/admin/scans) REVIEW & "VISUALIZAR PRÉVIA" MODAL
    // =========================================================================
    console.log('\n--- 6. Testing Admin Panel (/admin/scans) & Preview Modal ---');
    await authPage.goto(`${PREVIEW_URL}/admin/scans`, { waitUntil: 'networkidle' });

    // Switch to Partner Requests section
    const partnerTabBtn = authPage.locator('.admin-tab-btn:has-text("Pedidos de Parceria")');
    if (await partnerTabBtn.isVisible()) {
      await partnerTabBtn.click();
      await authPage.waitForTimeout(500);

      const requestCardsCount = await authPage.locator('.request-card').count();
      console.log('Partner Request Cards count:', requestCardsCount);

      const shotAdminList = path.join(ARTIFACT_DIR, 'round12_admin_partner_requests_list.png');
      await authPage.screenshot({ path: shotAdminList, fullPage: false });

      // Look for the "Visualizar Prévia" button
      const previewBtn = authPage.locator('.btn-action-preview').first();
      const hasPreviewBtn = await previewBtn.isVisible();
      console.log('Admin "Visualizar Prévia" button visible:', hasPreviewBtn);

      results.tests.push({
        test: 'Admin "Visualizar Prévia" Button Visible',
        passed: hasPreviewBtn
      });

      if (hasPreviewBtn) {
        await previewBtn.click();
        await authPage.waitForTimeout(500);

        const modalVisible = await authPage.locator('.scan-preview-modal-card').isVisible();
        const modalTitle = await authPage.locator('#preview-modal-title').textContent();
        console.log('Preview Modal Visible:', modalVisible);
        console.log('Preview Modal Title:', modalTitle?.trim());

        const shotAdminModal = path.join(ARTIFACT_DIR, 'round12_admin_preview_modal.png');
        await authPage.screenshot({ path: shotAdminModal, fullPage: false });

        results.tests.push({
          test: 'Admin Preview Modal Realistic Render',
          passed: Boolean(modalVisible && modalTitle),
          details: { title: modalTitle?.trim() }
        });

        // Close modal
        await authPage.click('.btn-close-modal');
        await authPage.waitForTimeout(300);
      }
    } else {
      console.warn('Could not find "Pedidos de Parceria" tab button in /admin/scans');
    }

    await authContext.close();

  } catch (err) {
    console.error('Playwright verification error:', err);
    results.tests.push({
      test: 'Playwright Verification Suite Execution',
      passed: false,
      error: err.message
    });
  } finally {
    await browser.close();
  }

  // Save JSON report
  const reportPath = path.join(ARTIFACT_DIR, 'round12_verification_results.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\nVerification finished. Results saved to: ${reportPath}`);
}

run().catch((err) => {
  console.error('Fatal runner error:', err);
  process.exit(1);
});
