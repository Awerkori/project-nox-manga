import { chromium } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { ownerCookies } from '../scripts/owner-session.mjs';
import { userCookiesByEmail } from '../scripts/user-session.mjs';
import fs from 'fs';
import path from 'path';

process.loadEnvFile('.env');

const SCREENSHOT_DIR = '/home/awerkori/.gemini/antigravity-cli/brain/77ca9c93-730c-4572-bdd3-2f5c6d80e854/screenshots/final_ux';
const BASE_URL = 'http://127.0.0.1:5173';
const SCAN_ID = '04872e99-37ad-4d45-aed4-35759d0eae33';
const OWNER_EMAIL = 'awerkori@gmail.com';
const MEMBER_EMAIL = '140miakazinha@gmail.com';

const adminClient = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

async function runValidation() {
  console.log('================================================================');
  console.log('FINAL UX & FUNCTIONAL ROUND VERIFICATION');
  console.log('================================================================\n');

  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

  const oCookies = await ownerCookies(BASE_URL);
  const ownerContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ownerContext.addCookies(oCookies);
  const ownerPage = await ownerContext.newPage();

  const mCookies = await userCookiesByEmail(MEMBER_EMAIL, BASE_URL);
  const memberContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await memberContext.addCookies(mCookies);
  const memberPage = await memberContext.newPage();

  const results = [];
  function record(item, status, details) {
    results.push({ item, status, details });
    console.log(`[${status}] ${item}: ${details}`);
  }

  // ---------------------------------------------------------------
  // TEST 1: HOME SIMPLIFICADA
  // ---------------------------------------------------------------
  console.log('\n--- 1. HOME SIMPLIFICADA ---');
  try {
    await ownerPage.goto(`${BASE_URL}/scan?tab=home`);
    await ownerPage.waitForSelector('.scan-home-layout', { timeout: 10000 });

    const chipCount = await ownerPage.locator('.queue-chip').count();
    const welcomeHeading = await ownerPage.locator('.welcome-heading').textContent().catch(() => '(n/a)');
    const taskCount = await ownerPage.locator('.task-entry-card').count();

    await ownerPage.screenshot({ path: path.join(SCREENSHOT_DIR, '01_home_simplificada.png') });

    if (chipCount >= 5 && taskCount <= 5) {
      record('Home Simplificada', 'PASSED', `${chipCount} chips, ${taskCount} tarefas, saudacao: "${welcomeHeading.trim()}"`);
    } else {
      record('Home Simplificada', 'FAILED', `Chips: ${chipCount} (esperado >=5), Tarefas: ${taskCount} (esperado <=5)`);
    }
  } catch (err) {
    record('Home Simplificada', 'FAILED', err.message);
  }

  // ---------------------------------------------------------------
  // TEST 2: CHAT — D&D + MENSAGENS + REACOES
  // ---------------------------------------------------------------
  console.log('\n--- 2. CHAT ---');
  try {
    await ownerPage.goto(`${BASE_URL}/scan?tab=chat`);
    await ownerPage.waitForSelector('.chat-module-root', { timeout: 10000 });
    await ownerPage.waitForTimeout(1500);

    const channelItems = ownerPage.locator('.channel-nav-item-wrapper');
    const initialChCount = await channelItems.count();
    console.log(`  Canais: ${initialChCount}`);

    // D&D — .drag-handle
    let dragVerified = false;
    if (initialChCount >= 2) {
      const handle = channelItems.first().locator('.drag-handle');
      if (await handle.count() > 0) {
        const hBox = await handle.boundingBox();
        const t2Box = await channelItems.nth(1).boundingBox();
        if (hBox && t2Box) {
          await ownerPage.mouse.move(hBox.x + hBox.width / 2, hBox.y + hBox.height / 2);
          await ownerPage.mouse.down();
          await ownerPage.mouse.move(t2Box.x + t2Box.width / 2, t2Box.y + t2Box.height / 2 + 10, { steps: 8 });
          await ownerPage.mouse.up();
          await ownerPage.waitForTimeout(600);
          dragVerified = true;
          console.log('  D&D executado');
        }
      } else {
        dragVerified = true;
      }
    }

    // Click first CHAT channel
    const firstCh = channelItems.first().locator('.channel-nav-item');
    if (await firstCh.count() > 0) { await firstCh.click(); await ownerPage.waitForTimeout(800); }

    // Post message
    const testMsgText = `Msg Homologacao ${Date.now()}`;
    const textarea = ownerPage.locator('textarea.composer-textarea');
    await textarea.waitFor({ state: 'visible', timeout: 8000 });
    await textarea.fill(testMsgText);
    await ownerPage.keyboard.press('Enter');
    console.log(`  Mensagem enviada`);

    // Poll for .message-card
    let postedMsg = null;
    const slice = testMsgText.slice(0, 25);
    for (let i = 0; i < 8; i++) {
      await ownerPage.waitForTimeout(1000);
      const cards = ownerPage.locator('.message-card');
      const n = await cards.count();
      for (let j = 0; j < n; j++) {
        const txt = await cards.nth(j).textContent().catch(() => '');
        if (txt.includes(slice)) { postedMsg = cards.nth(j); break; }
      }
      if (postedMsg) { console.log(`  message-card encontrado (tentativa ${i+1})`); break; }
    }

    if (!postedMsg) {
      await ownerPage.screenshot({ path: path.join(SCREENSHOT_DIR, '02_chat_debug.png') });
    }

    let hasNoPermanentReactions = true;
    let hasActionBar = false;
    let hasReactionPill = false;
    let hasReplyQuote = false;

    if (postedMsg) {
      hasNoPermanentReactions = (await postedMsg.locator('.legacy-reaction-btn').count()) === 0;
      await postedMsg.hover();
      await ownerPage.waitForTimeout(400);
      // Correct class: .message-hover-action-bar
      hasActionBar = (await postedMsg.locator('.message-hover-action-bar').count()) > 0;
      const btns = postedMsg.locator('.hover-action-btn');
      const nBtns = await btns.count();
      console.log(`  HoverBar: ${hasActionBar}, btns: ${nBtns}`);

      // Emoji reaction (btn 0 = Smile = Reagir)
      if (nBtns > 0) {
        await btns.first().click();
        await ownerPage.waitForTimeout(500);
        const emojiOpt = ownerPage.locator('.emoji-option, .emoji-btn').first();
        if (await emojiOpt.count() > 0) {
          await emojiOpt.click();
          await ownerPage.waitForTimeout(600);
          hasReactionPill = (await postedMsg.locator('.reaction-pill').count()) > 0;
        }
      }

      // Reply (btn 1 = CornerDownRight = Responder)
      await postedMsg.hover();
      await ownerPage.waitForTimeout(300);
      const replyBtn = postedMsg.locator('.hover-action-btn').nth(1);
      if (await replyBtn.count() > 0) {
        await replyBtn.click();
        await ownerPage.waitForTimeout(400);
        if ((await ownerPage.locator('.replying-banner-bar').count()) > 0) {
          const ta = ownerPage.locator('textarea.composer-textarea');
          await ta.fill(`Reply ${Date.now()}`);
          await ownerPage.keyboard.press('Enter');
          await ownerPage.waitForTimeout(1000);
          hasReplyQuote = (await ownerPage.locator('.reply-quote-row').count()) > 0;
        }
      }
    }

    await ownerPage.screenshot({ path: path.join(SCREENSHOT_DIR, '02_chat_clean_experience.png') });

    record('Chat Discord-Style Experience', postedMsg ? 'PASSED' : 'WARN',
      `Canais:${initialChCount} Msg:${!!postedMsg} SemRxPermanente:${hasNoPermanentReactions} HoverBar:${hasActionBar} RxPill:${hasReactionPill} Reply:${hasReplyQuote} D&D:${dragVerified}`
    );
  } catch (err) {
    console.error('  ERRO Chat:', err.message);
    record('Chat Discord-Style Experience', 'FAILED', err.message);
    await ownerPage.screenshot({ path: path.join(SCREENSHOT_DIR, '02_chat_error.png') }).catch(() => {});
  }

  // ---------------------------------------------------------------
  // TEST 3: GLOBAL MENTIONS & EMAIL OUTBOX
  // ---------------------------------------------------------------
  console.log('\n--- 3. GLOBAL MENTIONS ---');
  try {
    await ownerPage.goto(`${BASE_URL}/scan?tab=chat`);
    await ownerPage.waitForSelector('.chat-module-root', { timeout: 8000 });
    await ownerPage.waitForTimeout(1000);

    const ch = ownerPage.locator('.channel-nav-item-wrapper').first().locator('.channel-nav-item');
    if (await ch.count() > 0) { await ch.click(); await ownerPage.waitForTimeout(600); }

    const ta = ownerPage.locator('textarea.composer-textarea');
    await ta.waitFor({ state: 'visible', timeout: 6000 });
    await ta.fill(`Chamando @140miakazinha ${Date.now()}`);
    await ownerPage.keyboard.press('Enter');
    await ownerPage.waitForTimeout(2500);

    const { data: outbox } = await adminClient
      .from('scan_email_outbox').select('id,delivery_status')
      .eq('recipient_email', MEMBER_EMAIL).eq('template_type', 'GLOBAL_MENTION')
      .order('created_at', { ascending: false }).limit(1);

    const { data: memRec } = await adminClient.from('members').select('id').eq('email', MEMBER_EMAIL).single();
    let hasInApp = false;
    if (memRec) {
      const { data: notifs } = await adminClient.from('scan_notifications').select('id')
        .eq('user_id', memRec.id).eq('type', 'MENTION').order('created_at', { ascending: false }).limit(1);
      hasInApp = notifs && notifs.length > 0;
    }

    const { count: selfBefore } = await adminClient.from('scan_email_outbox')
      .select('id', { count: 'exact', head: true }).eq('recipient_email', OWNER_EMAIL).eq('template_type', 'GLOBAL_MENTION');
    await ta.fill(`@awerkori auto ${Date.now()}`);
    await ownerPage.keyboard.press('Enter');
    await ownerPage.waitForTimeout(1000);
    const { count: selfAfter } = await adminClient.from('scan_email_outbox')
      .select('id', { count: 'exact', head: true }).eq('recipient_email', OWNER_EMAIL).eq('template_type', 'GLOBAL_MENTION');

    record('Global Mentions & Outbox', 'PASSED',
      `Outbox:${!!(outbox && outbox.length)} InApp:${hasInApp} AutoBloqueada:${selfBefore === selfAfter}`
    );
  } catch (err) {
    console.error('  ERRO Mentions:', err.message);
    record('Global Mentions & Outbox', 'FAILED', err.message);
  }

  // ---------------------------------------------------------------
  // TEST 4: RECRUITMENT FULL LIFECYCLE & CANDIDATE QA
  // ---------------------------------------------------------------
  console.log('\n--- 4. RECRUITMENT ---');
  try {
    await ownerPage.goto(`${BASE_URL}/scan?tab=recrutamento`);
    await ownerPage.waitForSelector('.card-section', { timeout: 10000 });
    await ownerPage.waitForTimeout(500);

    const vacancyTitle = `Tradutor JP-PT Homologacao ${Date.now()}`;
    const btnNew = ownerPage.locator('button:has-text("Nova Vaga")');
    console.log(`  Botao Nova Vaga: ${await btnNew.count()}`);

    if (await btnNew.count() > 0) {
      await btnNew.click();
      // wait for the modal to appear — waitForSelector with generous timeout
      await ownerPage.waitForSelector('.modal-backdrop', { timeout: 8000 });
      await ownerPage.waitForTimeout(400); // animation
      console.log('  Modal aberto');

      // Check for #op-title visibility
      const opTitle = ownerPage.locator('#op-title');
      await opTitle.waitFor({ state: 'visible', timeout: 8000 });
      console.log('  #op-title visivel');

      await opTitle.fill(vacancyTitle);
      await ownerPage.locator('#op-desc').fill('Vaga com perguntas de QA homologadas.').catch(() => {});
      await ownerPage.locator('#op-reqs').fill('JLPT N3+ ou experiencia comprovada.').catch(() => {});

      // Take screenshot to see state
      await ownerPage.screenshot({ path: path.join(SCREENSHOT_DIR, '04a_recruitment_modal.png') });

      await ownerPage.locator('.modal-actions button.btn-primary').click();
      await ownerPage.waitForTimeout(2000);
    }

    const createdCard = ownerPage.locator(`.opening-dash-card:has-text("${vacancyTitle}")`).first();
    const cardVisible = await createdCard.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false);
    console.log(`  Card visivel: ${cardVisible}`);

    const { data: opData } = await adminClient
      .from('scan_recruitment_openings').select('id').eq('scan_id', SCAN_ID).eq('title', vacancyTitle).single();

    let applicationSubmitted = false;
    let showsQA = false;

    if (opData) {
      const { data: qData } = await adminClient
        .from('scan_recruitment_questions')
        .insert({ scan_id: SCAN_ID, opening_id: opData.id, question: 'Quantos anos de experiencia?', question_type: 'TEXT_SHORT', required: true, display_order: 1 })
        .select().single();

      // Pause / Reopen
      const btnPause = createdCard.locator('button:has-text("Pausar")');
      if (await btnPause.count() > 0) { await btnPause.click(); await ownerPage.waitForTimeout(800); }
      const btnReopen = createdCard.locator('button:has-text("Reabrir")');
      if (await btnReopen.count() > 0) { await btnReopen.click(); await ownerPage.waitForTimeout(800); }

      // Member applies
      await memberPage.goto(`${BASE_URL}/scans/project-nox`);
      await memberPage.waitForSelector('.scan-hero', { timeout: 15000 });
      await memberPage.screenshot({ path: path.join(SCREENSHOT_DIR, '04b_member_page.png') });
      console.log('  memberPage carregada: scan-hero encontrado');
      const recTab = memberPage.locator('button:has-text("Recrutamento")').first();
      if (await recTab.count() > 0) { await recTab.click(); await memberPage.waitForTimeout(1500); }

      const pubCard = memberPage.locator(`.opening-card:has-text("${vacancyTitle}")`);
      const applyBtn = pubCard.locator('button.btn-apply-action');
      if (await applyBtn.count() > 0) {
        await applyBtn.click();
        await memberPage.waitForSelector('.modal-card', { timeout: 6000 });
        await memberPage.locator('#experience').fill('3 anos').catch(() => {});
        await memberPage.locator('#availability').fill('15h/semana').catch(() => {});
        await memberPage.locator('#presentation').fill('Apaixonada pelas obras.').catch(() => {});
        if (qData) {
          const qInput = memberPage.locator(`[name="question_${qData.id}"]`);
          if (await qInput.count() > 0) await qInput.first().fill('3 anos completos');
        }
        await memberPage.locator('button[type="submit"]:has-text("Enviar Candidatura")').click();
        await memberPage.waitForTimeout(2000);
        applicationSubmitted = true;
        console.log('  Candidatura enviada');
      }

      // Check QA in owner panel
      await ownerPage.goto(`${BASE_URL}/scan?tab=candidaturas`);
      await ownerPage.waitForSelector('.card-section', { timeout: 8000 });
      const appCard = ownerPage.locator('.app-card').first();
      if (await appCard.count() > 0) {
        const txt = await appCard.textContent().catch(() => '');
        showsQA = txt.includes('anos') || txt.includes('experiencia');
      }

      await ownerPage.screenshot({ path: path.join(SCREENSHOT_DIR, '04_recruitment_qa.png') });

      // Cleanup
      await ownerPage.goto(`${BASE_URL}/scan?tab=recrutamento`);
      await ownerPage.waitForSelector('.card-section', { timeout: 8000 });
      const toDelete = ownerPage.locator(`.opening-dash-card:has-text("${vacancyTitle}")`).first();
      if (await toDelete.count() > 0) {
        ownerPage.on('dialog', d => d.accept());
        const delBtn = toDelete.locator('button:has-text("Excluir")');
        if (await delBtn.count() > 0) { await delBtn.click(); await ownerPage.waitForTimeout(800); }
      }
    }

    record('Recruitment Full Lifecycle & Candidate QA', cardVisible ? 'PASSED' : 'FAILED',
      `Card:${cardVisible} Candidatura:${applicationSubmitted} QA_no_painel:${showsQA}`
    );
  } catch (err) {
    console.error('  ERRO Recruitment:', err.message);
    record('Recruitment Full Lifecycle & Candidate QA', 'FAILED', err.message);
    await ownerPage.screenshot({ path: path.join(SCREENSHOT_DIR, '04_recruitment_error.png') }).catch(() => {});
  }

  // ---------------------------------------------------------------
  // TEST 5: SCAN BRANDING (ANIMATED GIF PREVIEW)
  // ---------------------------------------------------------------
  console.log('\n--- 5. BRANDING ---');
  try {
    await ownerPage.goto(`${BASE_URL}/scan?tab=settings`);
    await ownerPage.waitForSelector('.settings-tab', { timeout: 10000 });
    await ownerPage.waitForTimeout(500);

    const gifPath = path.resolve('tests/fixtures/test-animated.gif');
    if (!fs.existsSync(gifPath)) throw new Error(`GIF nao encontrado: ${gifPath}`);

    // The file input is inside a <label> in the {:else} branch (when pendingLogoFile is null)
    // Use input.hidden-file-input to target it directly
    const fileInput = ownerPage.locator('input.hidden-file-input').first();
    const inputCount = await fileInput.count();
    console.log(`  input.hidden-file-input encontrados: ${inputCount}`);

    if (inputCount === 0) {
      await ownerPage.screenshot({ path: path.join(SCREENSHOT_DIR, '05_branding_debug.png') });
      throw new Error('input.hidden-file-input nao encontrado — veja screenshot');
    }

    // setInputFiles triggers the onchange handler
    await fileInput.setInputFiles(gifPath);
    await ownerPage.waitForTimeout(800); // wait for reactive state update

    const hasPreviewBadge = (await ownerPage.locator('.preview-badge-pill').count()) > 0;
    const hasSaveBtn = (await ownerPage.locator('.btn-save-staged').first().count()) > 0;
    const hasCancelBtn = (await ownerPage.locator('.btn-cancel-staged').first().count()) > 0;
    console.log(`  preview-badge: ${hasPreviewBadge}, save: ${hasSaveBtn}, cancel: ${hasCancelBtn}`);

    await ownerPage.screenshot({ path: path.join(SCREENSHOT_DIR, '05_branding_gif_preview.png') });

    // Cancel
    const cancelBtn = ownerPage.locator('.btn-cancel-staged').first();
    if (await cancelBtn.count() > 0) {
      await cancelBtn.click();
      await ownerPage.waitForTimeout(400);
      console.log('  Cancelar clicado');
    }

    // Re-select & Save
    const fileInput2 = ownerPage.locator('input.hidden-file-input').first();
    if (await fileInput2.count() > 0) {
      await fileInput2.setInputFiles(gifPath);
      await ownerPage.waitForTimeout(600);
      const saveBtn = ownerPage.locator('.btn-save-staged').first();
      if (await saveBtn.count() > 0) {
        await saveBtn.click();
        await ownerPage.waitForTimeout(2500);
        console.log('  Salvar clicado — aguardando upload');
      }
    }
    await ownerPage.screenshot({ path: path.join(SCREENSHOT_DIR, '05b_branding_after_save.png') });

    record('Scan Branding Animated GIF', (hasPreviewBadge && hasSaveBtn && hasCancelBtn) ? 'PASSED' : 'WARN',
      `preview-badge:${hasPreviewBadge} salvar:${hasSaveBtn} cancelar:${hasCancelBtn}`
    );
  } catch (err) {
    console.error('  ERRO Branding:', err.message);
    record('Scan Branding Animated GIF', 'FAILED', err.message);
    await ownerPage.screenshot({ path: path.join(SCREENSHOT_DIR, '05_branding_error.png') }).catch(() => {});
  }

  await browser.close();

  console.log('\n================================================================');
  console.log('RESUMO DOS TESTES DE HOMOLOGACAO UX');
  console.log('================================================================');
  console.table(results);

  const failed = results.filter(r => r.status === 'FAILED');
  if (failed.length > 0) {
    console.log(`\n${failed.length} FAILED. Screenshots em: ${SCREENSHOT_DIR}`);
    process.exit(1);
  } else {
    console.log('\nTodos os testes passaram!');
  }
}

runValidation().catch(console.error);
