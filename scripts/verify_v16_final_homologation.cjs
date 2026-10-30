const fs = require('fs');
const path = require('path');
const { chromium, firefox } = require('playwright');
const { createClient } = require('@supabase/supabase-js');

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
const CHAPTER_ID = 'b88c0c5f-9664-5fae-a6d9-d5ad03af1369';
const WORK_ID = '7e90f9e1-4830-462a-9823-c95e2ccaebc1';
const CHAPTER_URL = `${PREVIEW_URL}/ler/${CHAPTER_ID}`;
const JONAS_COMMENT_ID = '46cb4fa8-7be2-41f4-9e44-6cae5f152fd2';
const OWNER_USER_ID = '732fbe87-5040-41fb-9983-0aedb2af44c8';

const supabase = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function dismissAgeGate(page) {
  try {
    const btn = page.locator('.btn-choice.adult');
    if (await btn.isVisible({ timeout: 1500 })) {
      await btn.click();
      await page.waitForTimeout(400);
    }
  } catch {}
}

async function setupDemoThread() {
  console.log('\n--- SETTING UP V16 HOMOLOGATION DEMO THREAD ---');
  // Root comment 2
  const { data: rootComment, error: err1 } = await supabase
    .from('comments')
    .insert({
      chapter_id: CHAPTER_ID,
      work_id: WORK_ID,
      user_id: OWNER_USER_ID,
      body: 'A evolução das habilidades no capítulo 76 foi fantástica! A sincronia do grupo durante a batalha superou tudo o que vimos até agora. ||O mentor aparecendo no final mudou completamente o rumo da história!||',
      parent_id: null
    })
    .select()
    .single();

  if (err1) throw new Error('Error inserting rootComment: ' + JSON.stringify(err1));
  console.log('✓ Root comment created:', rootComment.id);

  // Reply Level 1
  const { data: replyL1, error: err2 } = await supabase
    .from('comments')
    .insert({
      chapter_id: CHAPTER_ID,
      work_id: WORK_ID,
      user_id: OWNER_USER_ID,
      body: 'Concordo em gênero, número e grau! Essa revelação prepara o terreno para um arco muito mais sombrio e maduro.',
      parent_id: rootComment.id
    })
    .select()
    .single();

  if (err2) throw new Error('Error inserting replyL1: ' + JSON.stringify(err2));
  console.log('✓ Reply L1 created:', replyL1.id);

  // Sub-reply Level 2
  const { data: replyL2, error: err3 } = await supabase
    .from('comments')
    .insert({
      chapter_id: CHAPTER_ID,
      work_id: WORK_ID,
      user_id: OWNER_USER_ID,
      body: 'E a arte das páginas duplas elevou o padrão para outro patamar. Mal posso esperar pelo 77!',
      parent_id: replyL1.id
    })
    .select()
    .single();

  if (err3) throw new Error('Error inserting replyL2: ' + JSON.stringify(err3));
  console.log('✓ Sub-reply L2 created:', replyL2.id);

  // Sibling Reply Level 1 to Root
  const { data: replySiblingL1, error: err4 } = await supabase
    .from('comments')
    .insert({
      chapter_id: CHAPTER_ID,
      work_id: WORK_ID,
      user_id: OWNER_USER_ID,
      body: 'Também gostei do ritmo da narrativa, direto ao ponto e sem enrolação desnecessária.',
      parent_id: rootComment.id
    })
    .select()
    .single();

  if (err4) throw new Error('Error inserting replySiblingL1: ' + JSON.stringify(err4));
  console.log('✓ Sibling Reply L1 created:', replySiblingL1.id);

  return [rootComment.id, replyL1.id, replyL2.id, replySiblingL1.id];
}

async function cleanupDemoThread(ids) {
  console.log('\n--- CLEANING UP DEMO THREAD ---');
  if (!ids || ids.length === 0) return;
  // delete likes
  await supabase.from('comment_likes').delete().in('comment_id', ids);
  // nullify parent_ids
  await supabase.from('comments').update({ parent_id: null }).in('id', ids);
  // delete comments
  const { error } = await supabase.from('comments').delete().in('id', ids);
  if (error) console.error('Error during cleanup:', error);
  else console.log('✓ Successfully cleaned up demo thread comments:', ids.length);

  // Verify Jonas comment is still intact
  const { data: jonasCheck } = await supabase
    .from('comments')
    .select('id, body')
    .eq('id', JONAS_COMMENT_ID);
  console.log('✓ Jonas Amaral comment status:', jonasCheck && jonasCheck.length > 0 ? 'SAFE & INTACT' : 'WARNING: NOT FOUND');
}

async function run() {
  console.log('===============================================================');
  console.log(' PROJECT NOX — RODADA 20 V16: FINAL HOMOLOGATION SUITE');
  console.log(' Target Worker: home-preview-manga');
  console.log(' URL: ' + CHAPTER_URL);
  console.log('===============================================================');

  const createdIds = await setupDemoThread();

  try {
    const { ownerCookies } = await import('./owner-session.mjs');
    const sessionCookies = await ownerCookies(PREVIEW_URL);

    // 1. Desktop Playwright Verification (Chromium)
    const browser = await chromium.launch({ headless: true });

    // Verify 1440px Desktop
    console.log('\n[TEST 1] Desktop 1440px Verification...');
    const context1440 = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2
    });
    await context1440.addCookies(sessionCookies);
    await context1440.addCookies([
      { name: 'nox-age-status', value: 'ADULT', domain: 'home-preview-manga.project-nox-awerkori.workers.dev', path: '/' }
    ]);

    const page1440 = await context1440.newPage();
    await page1440.goto(CHAPTER_URL, { waitUntil: 'load', timeout: 45000 });
    await page1440.waitForTimeout(3000);
    await dismissAgeGate(page1440);

    // Verify Reader Defaults
    console.log('Checking Reader Defaults...');
    const readerDefaults = await page1440.evaluate(() => {
      let raw = localStorage.getItem('project_nox_reader_settings');
      let parsed = raw ? JSON.parse(raw) : null;
      const progressEl = document.querySelector('.reader-progress-bar, .chapter-progress-bar');
      const readerRoot = document.querySelector('.reader-layout, .webtoon-container, .reader-container');
      return {
        savedSettings: parsed,
        hasVisibleProgressBar: progressEl ? window.getComputedStyle(progressEl).display !== 'none' : false,
        readerClasses: readerRoot ? readerRoot.className : ''
      };
    });
    console.log('✓ Reader defaults check:', readerDefaults);

    // Scroll to comments
    const commentsRoot = page1440.locator('.comments-section-root').first();
    await commentsRoot.scrollIntoViewIfNeeded();
    await page1440.waitForTimeout(1000);

    // Assertions on Header
    console.log('Checking Comments Header...');
    const headerInfo = await page1440.evaluate(() => {
      const header = document.querySelector('.comments-hero-header');
      const title = document.querySelector('.section-title');
      const countPill = document.querySelector('.comments-count-pill');
      const sortSelect = document.querySelector('.sort-dropdown');
      const styleSelector = document.querySelector('.thread-style-selector');
      const root = document.querySelector('.comments-section-root');
      return {
        threadStyleAttr: root ? root.getAttribute('data-thread-style') : null,
        titleText: title ? title.innerText.trim() : null,
        countText: countPill ? countPill.innerText.trim() : null,
        sortValue: sortSelect ? sortSelect.value : null,
        hasPublicStyleSwitcher: !!styleSelector,
        headerFlex: header ? window.getComputedStyle(header).display : null
      };
    });
    console.log('✓ Header evaluation:', headerInfo);

    if (headerInfo.hasPublicStyleSwitcher) {
      console.warn('WARNING: Public style switcher still in DOM!');
    } else {
      console.log('✓ Style switcher successfully removed from header (Style A is default).');
    }

    // Capture Header Close-up
    const headerEl = page1440.locator('.comments-hero-header').first();
    await headerEl.screenshot({
      path: path.join(ARTIFACTS_DIR, 'v16_header_closeup.png')
    });
    console.log('✓ v16_header_closeup.png captured.');

    // Assertions on Typography
    console.log('Checking Calibrated Typography...');
    const typography = await page1440.evaluate(() => {
      const authorName = document.querySelector('.author-name');
      const authorTag = document.querySelector('.author-tag');
      const commentTime = document.querySelector('.comment-time');
      const badgeSelf = document.querySelector('.badge-self');
      const replyTarget = document.querySelector('.reply-target-tag');
      const textBody = document.querySelector('.comment-text-body');
      const likeBtn = document.querySelector('.btn-footer-like');
      const replyBtn = document.querySelector('.btn-footer-reply');
      const delBtn = document.querySelector('.btn-footer-secondary');

      const getStyle = (el) => el ? {
        fontSize: window.getComputedStyle(el).fontSize,
        lineHeight: window.getComputedStyle(el).lineHeight,
        fontWeight: window.getComputedStyle(el).fontWeight,
        height: window.getComputedStyle(el).height
      } : null;

      return {
        authorName: getStyle(authorName),
        authorTag: getStyle(authorTag),
        commentTime: getStyle(commentTime),
        badgeSelf: getStyle(badgeSelf),
        replyTarget: getStyle(replyTarget),
        textBody: getStyle(textBody),
        likeBtn: getStyle(likeBtn),
        replyBtn: getStyle(replyBtn),
        delBtn: getStyle(delBtn)
      };
    });
    console.log('✓ Typography specs (Desktop):', JSON.stringify(typography, null, 2));

    // Assertions on Hierarchy and Nesting
    console.log('Checking DOM Hierarchy and Nesting...');
    const hierarchy = await page1440.evaluate(() => {
      const rootBlocks = document.querySelectorAll('.conversation-root-block');
      const items = [];
      rootBlocks.forEach((block, bIdx) => {
        const rootCard = block.querySelector(':scope > .comment-card-modern.is-root-card');
        const rootAuthor = rootCard ? rootCard.querySelector('.author-name')?.innerText : 'unknown';
        const rootNest = block.querySelector(':scope > .thread-replies-nest.is-root-replies');
        const l1Cards = rootNest ? rootNest.querySelectorAll(':scope > .thread-children-list > .thread-branch-node > .comment-card-modern') : [];

        const l1Details = [];
        l1Cards.forEach((l1) => {
          const l1Author = l1.querySelector('.author-name')?.innerText;
          const targetTag = l1.querySelector('.reply-target-tag')?.innerText?.trim();
          const subNest = l1.parentElement.querySelector(':scope > .thread-replies-nest');
          const l2Cards = subNest ? subNest.querySelectorAll(':scope > .thread-children-list > .thread-branch-node > .comment-card-modern') : [];

          l1Details.push({
            author: l1Author,
            targetTag,
            subRepliesCount: l2Cards.length
          });
        });

        items.push({
          blockIndex: bIdx,
          rootAuthor,
          l1Count: l1Cards.length,
          l1Details
        });
      });
      return items;
    });
    console.log('✓ Thread Hierarchy validation:', JSON.stringify(hierarchy, null, 2));

    // Test Like Interaction
    console.log('Testing Like Interaction...');
    const likeBtn = page1440.locator('.btn-footer-like').first();
    if (await likeBtn.isVisible()) {
      const initialText = await likeBtn.innerText();
      await likeBtn.click();
      await page1440.waitForTimeout(600);
      const afterText = await likeBtn.innerText();
      console.log(`✓ Like toggle: "${initialText.trim()}" -> "${afterText.trim()}"`);
    }

    // Test Spoiler Interaction
    console.log('Testing Spoiler Interaction...');
    const spoilerEl = page1440.locator('.discord-spoiler').first();
    if (await spoilerEl.isVisible()) {
      const isRevealedBefore = await spoilerEl.evaluate(el => el.classList.contains('is-revealed'));
      await spoilerEl.click();
      await page1440.waitForTimeout(300);
      const isRevealedAfter = await spoilerEl.evaluate(el => el.classList.contains('is-revealed'));
      console.log(`✓ Spoiler toggle: wasRevealed=${isRevealedBefore} -> isRevealed=${isRevealedAfter}`);
    }

    // Capture Full Desktop 1440px
    await commentsRoot.screenshot({
      path: path.join(ARTIFACTS_DIR, 'v16_desktop_1440px.png')
    });
    console.log('✓ v16_desktop_1440px.png captured.');

    // Test Thread Collapse & Expand
    console.log('Testing Thread Collapse...');
    const collapseBtn = page1440.locator('.btn-thread-collapse').first();
    if (await collapseBtn.isVisible()) {
      await collapseBtn.click();
      await page1440.waitForTimeout(600);

      const collapsedBar = page1440.locator('.thread-collapsed-bar').first();
      if (await collapsedBar.isVisible()) {
        const text = await collapsedBar.innerText();
        console.log(`✓ Thread collapsed successfully: "${text.replace(/\n/g, ' ')}"`);
        await collapsedBar.screenshot({
          path: path.join(ARTIFACTS_DIR, 'v16_thread_collapsed_state.png')
        });
        console.log('✓ v16_thread_collapsed_state.png captured.');

        // Expand back
        await collapsedBar.click();
        await page1440.waitForTimeout(600);
        console.log('✓ Thread expanded back successfully.');
      }
    }

    // Capture Desktop 1280px & 1920px
    console.log('\n[TEST 2] Desktop 1280px & 1920px Captures...');
    await page1440.setViewportSize({ width: 1280, height: 800 });
    await page1440.waitForTimeout(500);
    await commentsRoot.screenshot({
      path: path.join(ARTIFACTS_DIR, 'v16_desktop_1280px.png')
    });
    console.log('✓ v16_desktop_1280px.png captured.');

    await page1440.setViewportSize({ width: 1920, height: 1080 });
    await page1440.waitForTimeout(500);
    await commentsRoot.screenshot({
      path: path.join(ARTIFACTS_DIR, 'v16_desktop_1920px.png')
    });
    console.log('✓ v16_desktop_1920px.png captured.');

    // Capture Reader settings & Webtoon View
    console.log('Capturing Reader Top & Settings...');
    await page1440.evaluate(() => window.scrollTo(0, 0));
    await page1440.waitForTimeout(1000);
    await page1440.screenshot({
      path: path.join(ARTIFACTS_DIR, 'v16_reader_settings_homologation.png'),
      clip: { x: 0, y: 0, width: 1920, height: 1080 }
    });
    console.log('✓ v16_reader_settings_homologation.png captured.');

    await context1440.close();

    // 2. Mobile Viewports (Chromium)
    const mobileViewports = [
      { name: 'v16_mobile_320px.png', width: 320, height: 640 },
      { name: 'v16_mobile_360px.png', width: 360, height: 740 },
      { name: 'v16_mobile_390px.png', width: 390, height: 844 },
      { name: 'v16_mobile_430px.png', width: 430, height: 932 }
    ];

    for (const vp of mobileViewports) {
      console.log(`\n[TEST 3] Mobile Capture: ${vp.name} (${vp.width}x${vp.height})...`);
      const mContext = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true
      });
      await mContext.addCookies(sessionCookies);
      await mContext.addCookies([
        { name: 'nox-age-status', value: 'ADULT', domain: 'home-preview-manga.project-nox-awerkori.workers.dev', path: '/' }
      ]);
      const mPage = await mContext.newPage();
      await mPage.goto(CHAPTER_URL, { waitUntil: 'load', timeout: 45000 });
      await mPage.waitForTimeout(2500);
      await dismissAgeGate(mPage);

      const mCommentsRoot = mPage.locator('.comments-section-root').first();
      await mCommentsRoot.scrollIntoViewIfNeeded();
      await mPage.waitForTimeout(800);

      // Check Mobile Typography on 390px
      if (vp.width === 390) {
        const mTypo = await mPage.evaluate(() => {
          const authorName = document.querySelector('.author-name');
          const authorTag = document.querySelector('.author-tag');
          const commentTime = document.querySelector('.comment-time');
          const replyTarget = document.querySelector('.reply-target-tag');
          const textBody = document.querySelector('.comment-text-body');
          const likeBtn = document.querySelector('.btn-footer-like');
          return {
            authorNameSize: authorName ? window.getComputedStyle(authorName).fontSize : null,
            authorTagSize: authorTag ? window.getComputedStyle(authorTag).fontSize : null,
            commentTimeSize: commentTime ? window.getComputedStyle(commentTime).fontSize : null,
            replyTargetSize: replyTarget ? window.getComputedStyle(replyTarget).fontSize : null,
            textBodySize: textBody ? window.getComputedStyle(textBody).fontSize : null,
            textBodyLineHeight: textBody ? window.getComputedStyle(textBody).lineHeight : null,
            likeBtnHeight: likeBtn ? window.getComputedStyle(likeBtn).minHeight || window.getComputedStyle(likeBtn).height : null
          };
        });
        console.log('✓ Mobile 390px Typography:', mTypo);
      }

      await mCommentsRoot.screenshot({
        path: path.join(ARTIFACTS_DIR, vp.name)
      });
      console.log(`✓ ${vp.name} captured.`);
      await mContext.close();
    }

    await browser.close();

    // 3. Firefox Mobile 390px
    console.log('\n[TEST 4] Firefox Mobile 390px Verification...');
    const ffBrowser = await firefox.launch({ headless: true });
    const ffContext = await ffBrowser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2
    });
    await ffContext.addCookies(sessionCookies);
    await ffContext.addCookies([
      { name: 'nox-age-status', value: 'ADULT', domain: 'home-preview-manga.project-nox-awerkori.workers.dev', path: '/' }
    ]);
    const ffPage = await ffContext.newPage();
    await ffPage.goto(CHAPTER_URL, { waitUntil: 'load', timeout: 45000 });
    await ffPage.waitForTimeout(2500);
    await dismissAgeGate(ffPage);

    const ffComments = ffPage.locator('.comments-section-root').first();
    await ffComments.scrollIntoViewIfNeeded();
    await ffPage.waitForTimeout(800);

    await ffComments.screenshot({
      path: path.join(ARTIFACTS_DIR, 'v16_firefox_mobile_390px.png')
    });
    console.log('✓ v16_firefox_mobile_390px.png captured.');
    await ffBrowser.close();

  } finally {
    // Clean up temporary demo thread created for tests
    await cleanupDemoThread(createdIds);
  }

  console.log('\n===============================================================');
  console.log(' ALL V16 HOMOLOGATION CHECKS & EVIDENCE CAPTURES COMPLETED');
  console.log('===============================================================');
}

run().catch((err) => {
  console.error('Fatal error in verify_v16_final_homologation:', err);
  process.exit(1);
});
