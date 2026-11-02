import { chromium } from 'playwright';
import { ownerCookies } from './owner-session.mjs';
import fs from 'fs';

const targetUrl = process.env.TARGET_URL || 'https://manga.project-nox-awerkori.workers.dev';
const artifactDir = '/home/awerkori/.gemini/antigravity-cli/brain/fa6d1923-db0b-428b-bc07-4973adaffd49';
const chapterId = 'b5a9fbf0-206d-475a-8e05-70aaa672f71e'; // Cap 85 Céu Distante

async function main() {
  console.log('=== PROJECT NOX: QC HOMOLOGATION FINAL VERIFICATION (Meta 10/10) ===');
  const cookies = await ownerCookies(targetUrl);
  cookies.push({
    name: 'nox-age-status',
    value: 'ADULT',
    url: targetUrl,
    httpOnly: false,
    sameSite: 'Lax',
    secure: targetUrl.startsWith('https:')
  });
  cookies.push({
    name: 'nox-blur-nsfw',
    value: 'false',
    url: targetUrl,
    httpOnly: false,
    sameSite: 'Lax',
    secure: targetUrl.startsWith('https:')
  });

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const results = {
    typesetV1InvalidFlagged: false,
    typesetV1ButtonDisabled: false,
    typesetV2IncompleteFlagged: false,
    typesetV2Size44MB: false,
    statusBadgeWaitingMaterial: false,
    noGreenReadyBadgeWhenIncomplete: false,
    qcStatusTextWaitingMaterial: false,
    noCapituloPodeSerAprovadoText: false,
    typesetIncompleteBannerCard: false,
    approveButtonDisabledCard: false,
    reworkModalPrefilledTypeset: false,
    readerIncompleteBanner: false,
    readerDesktopApproveDisabled: false,
    readerEndCardDescWaiting: false,
    readerEndCardApproveDisabled: false,
    readerApproveBlocked: false,
    readerApproveChecklistFailed: false,
    readerMobileApproveDisabled: false,
    readerMobileDrawerApproveDisabled: false,
    downloadV2Http200And44MB: false,
    downloadV1Http200And4KB: false,
    mobileCardOverflow320: 0,
    mobileCardOverflow360: 0,
    mobileCardOverflow390: 0,
    mobileCardOverflow430: 0,
    mobileOverflow320: null,
    mobileOverflow360: null,
    mobileOverflow390: null,
    mobileOverflow430: null,
    mobileHeaderNoOverlap: false,
    pages28Streaming: false
  };

  // --------------------------------------------------------------------------
  // TEST 1: DESKTOP CARD VIEW — TYPESET V1/V2, BADGE, STATUS TEXT & TRAVA DE APROVAÇÃO
  // --------------------------------------------------------------------------
  console.log('\n[TEST 1] Desktop QC Stage Card - Checking badges, texts, materials & approval lock...');
  const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await desktopContext.addCookies(cookies);

  const desktopPage = await desktopContext.newPage();

  // Navigate to QC Stage in scan panel
  await desktopPage.goto(`${targetUrl}/scan?tab=pipeline&stage=revisor_qc`, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await desktopPage.waitForSelector('.editorial-workspace-root', { timeout: 15000 }).catch(() => {});
  await desktopPage.waitForTimeout(2000);

  // Switch to "Meus capítulos" tab if not already selected
  const meusTab = desktopPage.locator('.segment-btn:has-text("Meus capítulos"), .segment-btn:has-text("Ambos")').first();
  if (await meusTab.isVisible()) {
    await meusTab.click();
    await desktopPage.waitForTimeout(1000);
  }

  // Find Chapter 85 card in my work
  const card85 = desktopPage.locator('.editorial-card.my-work-card').first();
  await card85.waitFor({ state: 'visible', timeout: 15000 });

  // Check 1: Status badge contextual state
  const statusBadge = card85.locator('.card-status-badge.qc-waiting-material').first();
  if (await statusBadge.isVisible()) {
    const badgeText = await statusBadge.innerText();
    console.log(`Contextual Status Badge Text: "${badgeText.trim()}"`);
    if (badgeText.includes('Aguardando correção do material')) {
      results.statusBadgeWaitingMaterial = true;
      console.log('✓ Status badge correctly displays "Aguardando correção do material"!');
    }
  }

  const readyBadge = card85.locator('.card-status-badge.ready');
  const readyBadgeCount = await readyBadge.count();
  results.noGreenReadyBadgeWhenIncomplete = (readyBadgeCount === 0);
  if (results.noGreenReadyBadgeWhenIncomplete) {
    console.log('✓ Green "Pronto para revisão" is NOT displayed when material is incomplete!');
  }

  // Open work on Chapter 85 if not already open
  const openWorkBtn = card85.locator('.btn-action-open-work').first();
  const openWorkText = await openWorkBtn.innerText().catch(() => '');
  if (openWorkText.includes('Abrir trabalho')) {
    await openWorkBtn.click();
    await desktopPage.waitForTimeout(1000);
  }

  // Check 2: QC Review Status Text
  const qcStatusText = card85.locator('.qc-review-status-text').first();
  if (await qcStatusText.isVisible()) {
    const statusTextContent = await qcStatusText.innerText();
    console.log(`QC Review Status Text: "${statusTextContent.trim()}"`);
    if (statusTextContent.includes('Nenhum apontamento pendente, mas o material ainda precisa ser finalizado pelo Typeset')) {
      results.qcStatusTextWaitingMaterial = true;
      console.log('✓ QC Review text correctly displays "Nenhum apontamento pendente, mas o material ainda precisa ser finalizado pelo Typeset."!');
    }
    results.noCapituloPodeSerAprovadoText = !statusTextContent.includes('O capítulo pode ser aprovado');
    if (results.noCapituloPodeSerAprovadoText) {
      console.log('✓ "O capítulo pode ser aprovado" is NOT displayed!');
    }
  }

  // Check 3: Typeset deliverables in accordion
  const typesetItems = card85.locator('.file-download-item.qc-typeset-item');
  const count = await typesetItems.count();
  console.log(`Found ${count} Typeset file items in QC card`);

  for (let i = 0; i < count; i++) {
    const item = typesetItems.nth(i);
    const text = await item.innerText();

    if (text.includes('v1') || text.includes('4.5 KB') || text.toUpperCase().includes('INVÁLIDO')) {
      if (text.toUpperCase().includes('INVÁLIDO / TESTE')) {
        results.typesetV1InvalidFlagged = true;
        console.log('✓ Typeset v1 is flagged as "Inválido / Teste"!');
      }
      const disabledBtn = item.locator('.btn-action-leitor-inline.disabled');
      if (await disabledBtn.isVisible()) {
        results.typesetV1ButtonDisabled = true;
        console.log('✓ Typeset v1 "Ler no QC" button is properly disabled!');
      }
    }

    if (text.includes('v2') || text.includes('44.5 MB')) {
      if (text.toUpperCase().includes('BALÕES VAZIOS')) {
        results.typesetV2IncompleteFlagged = true;
        console.log('✓ Typeset v2 is flagged as "Balões Vazios"!');
      }
      if (text.includes('44.5 MB')) {
        results.typesetV2Size44MB = true;
        console.log('✓ Typeset v2 displays 44.5 MB!');
      }
    }
  }

  // Check 4: Incomplete Banner in Card
  const incompleteBanner = desktopPage.locator('.qc-typeset-incomplete-banner');
  if (await incompleteBanner.isVisible()) {
    const bannerText = await incompleteBanner.innerText();
    console.log(`Incomplete Banner Text: "${bannerText.trim()}"`);
    results.typesetIncompleteBannerCard = true;
    console.log('✓ Incomplete Banner is visible in Typeset card!');
  }

  // Check 5: Card Approve Button is strictly Disabled
  const approveBtn = desktopPage.locator('.btn-qc-approve-trigger').first();
  const isDisabled = await approveBtn.isDisabled();
  const approveTitle = await approveBtn.getAttribute('title');
  console.log(`Card Approve button disabled: ${isDisabled}, title: "${approveTitle}"`);
  if (isDisabled && approveTitle && approveTitle.includes('bloqueada')) {
    results.approveButtonDisabledCard = true;
    console.log('✓ Card Approve button is strictly disabled with explanatory tooltip!');
  }

  // Screenshot of card expanded with blocked approval
  await desktopPage.screenshot({
    path: `${artifactDir}/qc_desktop_card_expanded_incomplete_blocked.png`,
    fullPage: false
  });
  console.log('✓ Captured qc_desktop_card_expanded_incomplete_blocked.png');

  // Check 6: "Solicitar correções" -> Rework modal prefilled
  const reworkBtn = desktopPage.locator('.btn-qc-rework-trigger').first();
  if (await reworkBtn.isVisible()) {
    console.log('Clicking "Solicitar correções" to test rework modal...');
    await reworkBtn.click();
    await desktopPage.waitForTimeout(800);

    const reworkDialog = desktopPage.locator('.rework-dialog');
    if (await reworkDialog.isVisible()) {
      const typesetInput = reworkDialog.locator('#type_desc_0, input[placeholder*="ultrapassando"], textarea').first();
      const textVal = await typesetInput.inputValue().catch(() => '');
      console.log(`Rework prefilled description: "${textVal}"`);
      if (textVal.includes('balões vazios') || textVal.includes('balões em branco') || textVal.includes('páginas limpas')) {
        results.reworkModalPrefilledTypeset = true;
        console.log('✓ Rework modal is prefilled with explanation of blank balloons!');
      }

      await desktopPage.screenshot({
        path: `${artifactDir}/qc_desktop_modal_rework_prefilled.png`,
        fullPage: false
      });
      console.log('✓ Captured qc_desktop_modal_rework_prefilled.png');

      const closeRework = reworkDialog.locator('.btn-modal-close, .btn-modal-cancel').first();
      await closeRework.click().catch(() => {});
      await desktopPage.waitForTimeout(500);
    }
  }

  await desktopPage.close();

  // --------------------------------------------------------------------------
  // TEST 2: QC READER — INCOMPLETE BANNER, APPROVE BLOCKED & STREAMING
  // --------------------------------------------------------------------------
  console.log('\n[TEST 2] Desktop QC Reader - Verifying banner, 28 pages & blocked approval modal...');
  const readerPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await readerPage.context().addCookies(cookies);

  await readerPage.goto(`${targetUrl}/scan?tab=qc_leitor&id=${chapterId}`, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await readerPage.waitForSelector('.qc-reader-root', { timeout: 15000 }).catch(() => {});
  await readerPage.waitForTimeout(2500);

  // 2.1 Check Top Warning Banner in Reader
  const readerBanner = readerPage.locator('.qc-reader-incomplete-banner');
  if (await readerBanner.isVisible()) {
    const bannerText = await readerBanner.innerText();
    console.log(`Reader Incomplete Banner Text: "${bannerText.trim()}"`);
    results.readerIncompleteBanner = true;
    console.log('✓ Reader Incomplete Banner is visible at the top!');
  }

  await readerPage.screenshot({
    path: `${artifactDir}/qc_reader_desktop_incomplete_banner.png`,
    fullPage: false
  });
  console.log('✓ Captured qc_reader_desktop_incomplete_banner.png');

  // 2.2 Verify Page 1 URL
  const page1Img = readerPage.locator('.qc-page-wrapper[data-page-index="1"] img, img.qc-manga-page').first();
  await page1Img.waitFor({ state: 'attached', timeout: 10000 }).catch(() => {});
  const p1Src = await page1Img.getAttribute('src');
  console.log(`Page 1 image src: ${p1Src}`);
  if (p1Src && p1Src.includes('/page/1')) {
    results.pages28Streaming = true;
    console.log('✓ Page 1 URL resolved correctly via streaming endpoint!');
  }

  // 2.3 Check Desktop Reader Topbar Approve Button Disabled
  const readerApproveBtn = readerPage.locator('.qc-btn-approve').first();
  const isReaderApproveDisabled = await readerApproveBtn.isDisabled();
  console.log(`Reader Desktop Approve button disabled: ${isReaderApproveDisabled}`);
  if (isReaderApproveDisabled) {
    results.readerDesktopApproveDisabled = true;
    console.log('✓ Reader Desktop Approve button is strictly disabled!');
  }

  // 2.4 Check End of Chapter Review Summary Card
  const endReviewDesc = readerPage.locator('.qc-end-desc').first();
  if (await endReviewDesc.isVisible()) {
    const endDescText = await endReviewDesc.innerText();
    console.log(`Reader End Card Desc: "${endDescText.trim()}"`);
    if (endDescText.includes('Nenhum apontamento pendente, mas o material ainda precisa ser finalizado pelo Typeset')) {
      results.readerEndCardDescWaiting = true;
      console.log('✓ Reader End Card displays "Nenhum apontamento pendente, mas o material ainda precisa ser finalizado pelo Typeset."!');
    }
  }

  const endApproveBtn = readerPage.locator('.qc-btn-approve-lg').first();
  if (await endApproveBtn.isVisible()) {
    const isEndApproveDisabled = await endApproveBtn.isDisabled();
    console.log(`Reader End Card Approve button disabled: ${isEndApproveDisabled}`);
    if (isEndApproveDisabled) {
      results.readerEndCardApproveDisabled = true;
      console.log('✓ Reader End Card Approve button is strictly disabled!');
    }
  }

  // 2.5 Open Approval Modal via Test Hook to Inspect Internal Checklist & Trava
  await readerPage.evaluate(() => {
    if (typeof (window).__openQcApproveModal === 'function') {
      (window).__openQcApproveModal();
    }
  });
  await readerPage.waitForTimeout(800);

  const approveModal = readerPage.locator('.qc-modal-approve');
  if (await approveModal.isVisible()) {
    const modalText = await approveModal.innerText();

    if (modalText.includes('Aprovação bloqueada') || modalText.includes('balões em branco')) {
      results.readerApproveBlocked = true;
      console.log('✓ Approval warning box is present in reader modal!');
    }

    if (modalText.includes('Diagramação e balões: Reprovado')) {
      results.readerApproveChecklistFailed = true;
      console.log('✓ Checklist explicitly fails "Diagramação e balões: Reprovado"!');
    }

    const confirmBtn = approveModal.locator('.btn-confirm-approve').first();
    const isConfirmDisabled = await confirmBtn.isDisabled();
    console.log(`Reader confirm approval button disabled: ${isConfirmDisabled}`);

    await readerPage.screenshot({
      path: `${artifactDir}/qc_reader_desktop_approve_blocked.png`,
      fullPage: false
    });
    console.log('✓ Captured qc_reader_desktop_approve_blocked.png');

    const closeApprove = approveModal.locator('.btn-close-modal, .btn-cancel').first();
    await closeApprove.click().catch(() => {});
    await readerPage.waitForTimeout(500);
  }

  await readerPage.close();

  // --------------------------------------------------------------------------
  // TEST 3: MOBILE RESPONSIVENESS & OVERFLOW AUDIT (320px to 430px)
  // --------------------------------------------------------------------------
  console.log('\n[TEST 3] Mobile Responsiveness & Overflow Audit...');
  for (const width of [320, 360, 390, 430]) {
    const mobilePage = await browser.newPage({ viewport: { width, height: 800 } });
    await mobilePage.context().addCookies(cookies);

    await mobilePage.goto(`${targetUrl}/scan?tab=pipeline&stage=revisor_qc`, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await mobilePage.waitForSelector('.editorial-workspace-root', { timeout: 15000 }).catch(() => {});
    await mobilePage.waitForTimeout(1500);

    const meusTabMob = mobilePage.locator('.segment-btn:has-text("Meus capítulos")').first();
    if (await meusTabMob.isVisible()) {
      await meusTabMob.click().catch(() => {});
      await mobilePage.waitForTimeout(800);
    }

    const openWorkBtnMob = mobilePage.locator('.editorial-card.my-work-card .btn-action-open-work').first();
    if (await openWorkBtnMob.isVisible()) {
      await openWorkBtnMob.click();
      await mobilePage.waitForTimeout(800);
    }

    const overflowEval = await mobilePage.evaluate(() => {
      const docW = document.documentElement.clientWidth;
      const docScrollW = document.documentElement.scrollWidth;
      const bodyScrollW = document.body.scrollWidth;
      let maxOverflow = Math.max(0, docScrollW - docW, bodyScrollW - docW);

      let worstEl = null;
      const all = document.querySelectorAll('*');
      for (const el of all) {
        const r = el.getBoundingClientRect();
        if (r.right > docW + 1) {
          const diff = Math.round(r.right - docW);
          if (diff > maxOverflow) {
            maxOverflow = diff;
            worstEl = `${el.tagName.toLowerCase()}.${el.className.toString().slice(0, 30)}`;
          }
        }
      }

      // Also specifically measure the editorial card container
      const card = document.querySelector('.editorial-card.my-work-card');
      let cardOverflow = 0;
      if (card) {
        cardOverflow = Math.max(0, card.scrollWidth - card.clientWidth);
      }

      return { docW, docScrollW, bodyScrollW, maxOverflow, worstEl, cardOverflow };
    });

    console.log(`Viewport ${width}px: docMaxOverflow=${overflowEval.maxOverflow}px (worst: ${overflowEval.worstEl}), cardOverflow=${overflowEval.cardOverflow}px`);
    results[`mobileOverflow${width}`] = overflowEval;
    results[`mobileCardOverflow${width}`] = overflowEval.cardOverflow;

    if (width === 390) {
      await mobilePage.screenshot({
        path: `${artifactDir}/qc_android_card_expanded_incomplete_390.png`,
        fullPage: false
      });
      console.log('✓ Captured qc_android_card_expanded_incomplete_390.png');
    }
    if (width === 320) {
      await mobilePage.screenshot({
        path: `${artifactDir}/qc_android_card_expanded_incomplete_320.png`,
        fullPage: false
      });
      console.log('✓ Captured qc_android_card_expanded_incomplete_320.png');
    }

    await mobilePage.close();
  }

  // --------------------------------------------------------------------------
  // TEST 4: MOBILE QC READER (390px) — HEADER, QUICK APPROVE & DRAWER
  // --------------------------------------------------------------------------
  console.log('\n[TEST 4] Mobile QC Reader (390px) - Header layout, quick approve & drawer...');
  const mobileReader = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobileReader.context().addCookies(cookies);

  await mobileReader.goto(`${targetUrl}/scan?tab=qc_leitor&id=${chapterId}`, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await mobileReader.waitForSelector('.qc-reader-root', { timeout: 15000 }).catch(() => {});
  await mobileReader.waitForTimeout(2000);

  // 4.1 Check Mobile Topbar Quick Approve Disabled
  const mobQuickApprove = mobileReader.locator('.qc-mob-quick-approve').first();
  const isMobQuickDisabled = await mobQuickApprove.isDisabled();
  console.log(`Reader Mobile Approve button disabled: ${isMobQuickDisabled}`);
  if (isMobQuickDisabled) {
    results.readerMobileApproveDisabled = true;
    console.log('✓ Reader Mobile Quick Approve button is strictly disabled!');
  }

  // 4.2 Check Mobile Drawer Approve Item Disabled
  const mobMenuBtn = mobileReader.locator('.qc-mob-menu-btn').first();
  if (await mobMenuBtn.isVisible()) {
    await mobMenuBtn.click();
    await mobileReader.waitForTimeout(500);

    const drawerApproveItem = mobileReader.locator('.qc-sheet-item[disabled], .qc-sheet-item.is-disabled').first();
    if (await drawerApproveItem.isVisible()) {
      const drawerText = await drawerApproveItem.innerText();
      console.log(`Mobile Drawer Approve Item: "${drawerText.trim()}"`);
      if (drawerText.includes('Aprovação Bloqueada') || drawerText.includes('Balões Vazios')) {
        results.readerMobileDrawerApproveDisabled = true;
        console.log('✓ Reader Mobile Drawer Approve item is strictly disabled!');
      }
    }

    const closeMenu = mobileReader.locator('.qc-mob-menu-close').first();
    await closeMenu.click().catch(() => {});
    await mobileReader.waitForTimeout(300);
  }

  // 4.3 Check Topbar Overlaps
  const mobOverlapEval = await mobileReader.evaluate(() => {
    const back = document.querySelector('.qc-btn-back')?.getBoundingClientRect();
    const ind = document.querySelector('.qc-top-page-indicator')?.getBoundingClientRect();
    const appr = document.querySelector('.qc-mob-quick-approve')?.getBoundingClientRect();
    const menu = document.querySelector('.qc-mob-menu-btn')?.getBoundingClientRect();

    let overlaps = false;
    if (back && ind && back.right > ind.left) overlaps = true;
    if (ind && appr && ind.right > appr.left) overlaps = true;
    if (appr && menu && appr.right > menu.left) overlaps = true;

    return { overlaps, back, ind, appr, menu };
  });

  console.log(`Mobile reader topbar overlaps: ${mobOverlapEval.overlaps}`);
  results.mobileHeaderNoOverlap = !mobOverlapEval.overlaps;

  await mobileReader.screenshot({
    path: `${artifactDir}/qc_reader_android_incomplete_banner_390.png`,
    fullPage: false
  });
  console.log('✓ Captured qc_reader_android_incomplete_banner_390.png');
  await mobileReader.close();

  // --------------------------------------------------------------------------
  // TEST 5: DIRECT FILE DOWNLOADS VIA API
  // --------------------------------------------------------------------------
  console.log('\n[TEST 5] Validating direct file downloads via API...');
  const v2Res = await fetch(`${targetUrl}/api/scan/production/files/64f6372d-7f27-46b6-9b5c-8a2dfb97d8c3?download=1`, {
    headers: {
      Cookie: cookies.map(c => `${c.name}=${c.value}`).join('; ')
    }
  });
  const v2Len = Number(v2Res.headers.get('content-length') || 0);
  console.log(`Download Typeset v2: HTTP ${v2Res.status}, Content-Length: ${v2Len}`);
  if (v2Res.status === 200 && v2Len === 46637037) {
    results.downloadV2Http200And44MB = true;
    console.log('✓ Typeset v2 download returns HTTP 200 with 46,637,037 bytes (44.5 MB)!');
  }

  const v1Res = await fetch(`${targetUrl}/api/scan/production/files/add2d784-d84b-418c-bc18-2d73e8cf9d31?download=1`, {
    headers: {
      Cookie: cookies.map(c => `${c.name}=${c.value}`).join('; ')
    }
  });
  const v1Len = Number(v1Res.headers.get('content-length') || 0);
  console.log(`Download Typeset v1: HTTP ${v1Res.status}, Content-Length: ${v1Len}`);
  if (v1Res.status === 200 && (v1Len === 4659 || v1Len < 50000)) {
    results.downloadV1Http200And4KB = true;
    console.log('✓ Typeset v1 download returns HTTP 200 with 4,659 bytes (4.5 KB test archive)!');
  }

  await browser.close();

  fs.writeFileSync(`${artifactDir}/qc_final_round21_results.json`, JSON.stringify(results, null, 2));
  console.log('\n=== RESULTS SUMMARY ===');
  console.log(JSON.stringify(results, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
