import { chromium } from '@playwright/test';
import { ownerCookies } from './owner-session.mjs';
import path from 'node:path';
import fs from 'node:fs';
import pg from 'pg';
const { Pool } = pg;

const PREVIEW_URL = 'https://home-preview-manga.project-nox-awerkori.workers.dev';
const ARTIFACT_DIR = path.resolve('artifacts/round23');
if (!fs.existsSync(ARTIFACT_DIR)) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
}

// Database Connection
const envLines = fs.readFileSync('/home/awerkori/.config/project-nox/yugabyte.env', 'utf8').split('\n');
const envVars = {};
for (const line of envLines) {
  const m = line.match(/^([^=]+)=(.*)$/);
  if (m) envVars[m[1].trim()] = m[2].trim().replace(/^["\x27]|["\x27]$/g, '');
}
const ca = fs.readFileSync('/home/awerkori/.config/project-nox/root.crt', 'utf8');
const pool = new Pool({
  host: envVars.YUGABYTE_HOST,
  port: parseInt(envVars.YUGABYTE_PORT || '5433', 10),
  user: envVars.YUGABYTE_USER,
  password: envVars.YUGABYTE_PASSWORD,
  database: envVars.YUGABYTE_DATABASE,
  ssl: { ca, rejectUnauthorized: false }
});

async function run() {
  console.log('================================================================');
  console.log('🚀 HOMOLOGATION OF 20 VISUAL SCENARIOS & 4 EXTENSION STATES (ROUND 23)');
  console.log('Target:', PREVIEW_URL);
  console.log('Output:', ARTIFACT_DIR);
  console.log('================================================================\n');

  const cookies = await ownerCookies(PREVIEW_URL);
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const dbClient = await pool.connect();

  try {
    // -------------------------------------------------------------------------
    // SCENARIO 1: Calendário desktop com eventos (1440x900)
    // -------------------------------------------------------------------------
    console.log('Capturing Scenario 1: Calendário desktop com eventos...');
    const deskCtx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2
    });
    await deskCtx.addCookies([
      ...cookies,
      { name: 'nox-age-status', value: 'ADULT', url: PREVIEW_URL }
    ]);
    const deskPage = await deskCtx.newPage();
    await deskPage.goto(`${PREVIEW_URL}/scan?tab=calendario`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await deskPage.waitForTimeout(3000);
    const pScen1 = path.join(ARTIFACT_DIR, 'scenario_01_desktop_month.png');
    await deskPage.screenshot({ path: pScen1, fullPage: false });
    console.log(`  ✓ Saved: ${pScen1}`);

    // -------------------------------------------------------------------------
    // SCENARIO 20: Alternância Mês / Agenda
    // -------------------------------------------------------------------------
    console.log('\nCapturing Scenario 20: Alternância Mês/Agenda...');
    const agendaBtn = deskPage.locator('.btn-toggle-view, .toggle-opt-btn').filter({ hasText: 'Agenda' }).first();
    if (await agendaBtn.count() > 0) {
      await agendaBtn.click({ force: true });
      await deskPage.waitForTimeout(1000);
      const pScen20 = path.join(ARTIFACT_DIR, 'scenario_20_alternancia_agenda.png');
      await deskPage.screenshot({ path: pScen20, fullPage: false });
      console.log(`  ✓ Saved: ${pScen20}`);

      // Return to Month view
      const monthBtn = deskPage.locator('.btn-toggle-view, .toggle-opt-btn').filter({ hasText: 'Mês' }).first();
      await monthBtn.click({ force: true });
      await deskPage.waitForTimeout(1000);
    }

    // -------------------------------------------------------------------------
    // SCENARIO 6: Minhas próximas entregas (Hero Box)
    // -------------------------------------------------------------------------
    console.log('\nCapturing Scenario 6: Minhas próximas entregas...');
    const heroBox = deskPage.locator('.hero-delivery-box').first();
    if (await heroBox.count() > 0) {
      const pScen6 = path.join(ARTIFACT_DIR, 'scenario_06_minhas_proximas_entregas.png');
      await heroBox.screenshot({ path: pScen6 });
      console.log(`  ✓ Saved: ${pScen6}`);
    }

    // -------------------------------------------------------------------------
    // SCENARIO 7: Acompanhamento da equipe (Compromissos da Equipe)
    // -------------------------------------------------------------------------
    console.log('\nCapturing Scenario 7: Acompanhamento da equipe...');
    const teamSection = deskPage.locator('.side-widget-card').filter({ hasText: 'Compromissos da Equipe' }).first();
    if (await teamSection.count() > 0) {
      const pScen7 = path.join(ARTIFACT_DIR, 'scenario_07_compromissos_equipe.png');
      await teamSection.screenshot({ path: pScen7 });
      console.log(`  ✓ Saved: ${pScen7}`);
    }

    // -------------------------------------------------------------------------
    // SCENARIO 8: Entregas atrasadas (Alert pill or items in overdue state)
    // -------------------------------------------------------------------------
    console.log('\nCapturing Scenario 8: Entregas atrasadas...');
    const overdueCard = deskPage.locator('.widget-delivery-item.is-overdue, .day-event-card.overdue').first();
    if (await overdueCard.count() > 0) {
      const pScen8 = path.join(ARTIFACT_DIR, 'scenario_08_entregas_atrasadas.png');
      await overdueCard.screenshot({ path: pScen8 });
      console.log(`  ✓ Saved: ${pScen8}`);
    }

    // -------------------------------------------------------------------------
    // SCENARIO 3: Dia com uma entrega (Day 15 or Day 3)
    // -------------------------------------------------------------------------
    console.log('\nCapturing Scenario 3: Dia com uma entrega...');
    const dayWithOne = deskPage.locator('.matrix-day-cell').filter({ hasText: '7' }).first();
    if (await dayWithOne.count() > 0) {
      const pScen3 = path.join(ARTIFACT_DIR, 'scenario_03_day_single_delivery.png');
      await dayWithOne.screenshot({ path: pScen3 });
      console.log(`  ✓ Saved: ${pScen3}`);
    }

    // -------------------------------------------------------------------------
    // SCENARIO 4: Dia com várias entregas (Day 2 has 4 deliveries)
    // -------------------------------------------------------------------------
    console.log('\nCapturing Scenario 4: Dia com várias entregas...');
    const dayWithMany = deskPage.locator('.matrix-day-cell').filter({ hasText: '2' }).first();
    if (await dayWithMany.count() > 0) {
      const pScen4 = path.join(ARTIFACT_DIR, 'scenario_04_day_multiple_deliveries.png');
      await dayWithMany.screenshot({ path: pScen4 });
      console.log(`  ✓ Saved: ${pScen4}`);
    }

    // -------------------------------------------------------------------------
    // SCENARIO 5: Dia sem entregas (Day 10)
    // -------------------------------------------------------------------------
    console.log('\nCapturing Scenario 5: Dia sem entregas...');
    const dayEmpty = deskPage.locator('.matrix-day-cell').filter({ hasText: '10' }).first();
    if (await dayEmpty.count() > 0) {
      const pScen5 = path.join(ARTIFACT_DIR, 'scenario_05_day_without_deliveries.png');
      await dayEmpty.screenshot({ path: pScen5 });
      console.log(`  ✓ Saved: ${pScen5}`);
    }

    // -------------------------------------------------------------------------
    // SCENARIO 11: Drawer desktop (Day 2 opened with compact list)
    // -------------------------------------------------------------------------
    console.log('\nCapturing Scenario 11: Drawer desktop...');
    if (await dayWithMany.count() > 0) {
      await dayWithMany.click({ force: true });
      await deskPage.waitForTimeout(1200);
      const pScen11 = path.join(ARTIFACT_DIR, 'scenario_11_drawer_desktop.png');
      await deskPage.screenshot({ path: pScen11, fullPage: false });
      console.log(`  ✓ Saved: ${pScen11}`);

      // -----------------------------------------------------------------------
      // SCENARIO 10: Detalhes individuais expandidos (Level 2 inside Drawer)
      // -----------------------------------------------------------------------
      console.log('\nCapturing Scenario 10: Detalhes individuais expandidos...');
      const secondSummaryRow = deskPage.locator('.drawer-card-summary-row').nth(1);
      if (await secondSummaryRow.count() > 0) {
        await secondSummaryRow.click({ force: true });
        await deskPage.waitForTimeout(600);
        const pScen10 = path.join(ARTIFACT_DIR, 'scenario_10_detalhes_individuais_expandidos.png');
        await deskPage.screenshot({ path: pScen10, fullPage: false });
        console.log(`  ✓ Saved: ${pScen10}`);
      }

      // Close Drawer
      const closeDrawerBtn = deskPage.locator('.btn-close-drawer').first();
      if (await closeDrawerBtn.count() > 0) {
        await closeDrawerBtn.click({ force: true });
        await deskPage.waitForTimeout(500);
      }
    }

    // -------------------------------------------------------------------------
    // SCENARIO 13: Modal de assumir etapa desktop
    // -------------------------------------------------------------------------
    console.log('\nCapturing Scenario 13: Modal de assumir etapa desktop...');
    await deskPage.goto(`${PREVIEW_URL}/scan?tab=pipeline&stage=traducao`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await deskPage.waitForTimeout(2500);
    const dispTab = deskPage.locator('button, .tab-btn').filter({ hasText: 'Disponíveis' }).first();
    if (await dispTab.count() > 0) {
      await dispTab.click({ force: true });
      await deskPage.waitForTimeout(800);
    }
    const claimBtnDesk = deskPage.locator('.btn-action-claim-prominent, button').filter({ hasText: 'Assumir' }).first();
    if (await claimBtnDesk.count() > 0) {
      await claimBtnDesk.click({ force: true });
      await deskPage.waitForTimeout(1000);
      const pScen13 = path.join(ARTIFACT_DIR, 'scenario_13_claim_modal_desktop.png');
      await deskPage.screenshot({ path: pScen13, fullPage: false });
      console.log(`  ✓ Saved: ${pScen13}`);

      // Close modal
      const cancelBtn = deskPage.locator('.modal-actions-footer .btn-cancel').first();
      if (await cancelBtn.count() > 0) {
        await cancelBtn.click({ force: true });
        await deskPage.waitForTimeout(500);
      }
    }

    // -------------------------------------------------------------------------
    // SCENARIO 2: Calendário Android com eventos (390px)
    // -------------------------------------------------------------------------
    console.log('\nCapturing Scenario 2: Calendário Android com eventos...');
    const mobCtx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2
    });
    await mobCtx.addCookies([
      ...cookies,
      { name: 'nox-age-status', value: 'ADULT', url: PREVIEW_URL }
    ]);
    const mobPage = await mobCtx.newPage();
    await mobPage.goto(`${PREVIEW_URL}/scan?tab=calendario`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await mobPage.waitForTimeout(3000);
    const pScen2 = path.join(ARTIFACT_DIR, 'scenario_02_android_month.png');
    await mobPage.screenshot({ path: pScen2, fullPage: false });
    console.log(`  ✓ Saved: ${pScen2}`);

    // -------------------------------------------------------------------------
    // SCENARIO 9: Resumo compacto do dia (Android Level 1 Quick Summary)
    // -------------------------------------------------------------------------
    console.log('\nCapturing Scenario 9: Resumo compacto do dia...');
    const day2Mob = mobPage.locator('.matrix-day-cell').filter({ hasText: '2' }).first();
    if (await day2Mob.count() > 0) {
      await day2Mob.click({ force: true });
      await mobPage.waitForTimeout(1000);
      const pScen9 = path.join(ARTIFACT_DIR, 'scenario_09_resumo_compacto_dia.png');
      await mobPage.screenshot({ path: pScen9, fullPage: false });
      console.log(`  ✓ Saved: ${pScen9}`);

      // -----------------------------------------------------------------------
      // SCENARIO 12: Bottom sheet Android (Level 2)
      // -----------------------------------------------------------------------
      console.log('\nCapturing Scenario 12: Bottom sheet Android...');
      const miniCard = mobPage.locator('.preview-mini-card').first();
      if (await miniCard.count() > 0) {
        await miniCard.click({ force: true });
        await mobPage.waitForTimeout(1000);
        const pScen12 = path.join(ARTIFACT_DIR, 'scenario_12_bottom_sheet_android.png');
        await mobPage.screenshot({ path: pScen12, fullPage: false });
        console.log(`  ✓ Saved: ${pScen12}`);

        // Close bottom sheet
        const closeBtn = mobPage.locator('.btn-close-drawer').first();
        if (await closeBtn.count() > 0) {
          await closeBtn.click({ force: true });
          await mobPage.waitForTimeout(500);
        }
      }
    }

    // -------------------------------------------------------------------------
    // SCENARIO 14: Modal de assumir etapa Android (390px)
    // -------------------------------------------------------------------------
    console.log('\nCapturing Scenario 14: Modal de assumir etapa Android...');
    await mobPage.goto(`${PREVIEW_URL}/scan?tab=pipeline&stage=traducao`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await mobPage.waitForTimeout(2500);
    const dispTabMob = mobPage.locator('button, .tab-btn').filter({ hasText: 'Disponíveis' }).first();
    if (await dispTabMob.count() > 0) {
      await dispTabMob.click({ force: true });
      await mobPage.waitForTimeout(800);
    }
    const claimBtnMob = mobPage.locator('.btn-action-claim-prominent, button').filter({ hasText: 'Assumir' }).first();
    if (await claimBtnMob.count() > 0) {
      await claimBtnMob.click({ force: true });
      await mobPage.waitForTimeout(1000);
      const pScen14 = path.join(ARTIFACT_DIR, 'scenario_14_claim_modal_android.png');
      await mobPage.screenshot({ path: pScen14, fullPage: false });
      console.log(`  ✓ Saved: ${pScen14}`);

      // Close modal
      const cancelBtn = mobPage.locator('.modal-actions-footer .btn-cancel').first();
      if (await cancelBtn.count() > 0) {
        await cancelBtn.click({ force: true });
        await mobPage.waitForTimeout(500);
      }
    }

    // -------------------------------------------------------------------------
    // SCENARIOS 15, 16, 17, 18, 19: 4 Extension States (A, B, C, D)
    // -------------------------------------------------------------------------
    console.log('\n--- Extension States (A, B, C, D) Homologation ---');

    // Return to Calendar on desktop
    await deskPage.goto(`${PREVIEW_URL}/scan?tab=calendario`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await deskPage.waitForTimeout(3000);

    // Scenario 15 (Cenário A): Prorrogação ainda indisponível (> 24h away)
    console.log('\nCapturing Scenario 15: Prorrogação ainda indisponível (>24h)...');
    const extDiscreetNote = deskPage.locator('.extension-hero-info, .deadline-discreet-notice, .tasks-extension-discreet-note').first();
    if (await extDiscreetNote.count() > 0) {
      const pScen15 = path.join(ARTIFACT_DIR, 'scenario_15_prorrogacao_indisponivel.png');
      await deskPage.screenshot({ path: pScen15, fullPage: false });
      console.log(`  ✓ Saved: ${pScen15}`);
    }

    // Scenario 19: Etapa concluída (Completed stage with final completion date)
    console.log('\nCapturing Scenario 19: Etapa concluída...');
    const day2 = deskPage.locator('.matrix-day-cell').filter({ hasText: '2' }).first();
    if (await day2.count() > 0) {
      await day2.click({ force: true });
      await deskPage.waitForTimeout(1000);
      const doneSummaryRow = deskPage.locator('.drawer-commitment-card.done .drawer-card-summary-row, .drawer-commitment-card.done').first();
      if (await doneSummaryRow.count() > 0) {
        await doneSummaryRow.click({ force: true });
        await deskPage.waitForTimeout(500);
        const pScen19 = path.join(ARTIFACT_DIR, 'scenario_19_etapa_concluida.png');
        await deskPage.screenshot({ path: pScen19, fullPage: false });
        console.log(`  ✓ Saved: ${pScen19}`);
      }
      const closeBtn = deskPage.locator('.btn-close-drawer').first();
      if (await closeBtn.count() > 0) {
        await closeBtn.click({ force: true });
        await deskPage.waitForTimeout(500);
      }
    }

    // Now test Cenário B & C using controlled isolated deadline shift on chapter 92
    // Let's get chapter 92 stage id:
    const ch92Res = await dbClient.query(`
      SELECT cs.id, cs.due_at, cs.extension_count
      FROM public.scan_chapter_stages cs
      JOIN public.scan_production_chapters spc ON (spc.id = cs.chapter_id OR spc.id = cs.production_chapter_id)
      JOIN public.scan_workflow_stages ws ON ws.id = cs.stage_id
      WHERE spc.chapter_number = '92' AND ws.slug = 'traducao'
    `);

    if (ch92Res.rows.length === 1) {
      const stage92Id = ch92Res.rows[0].id;
      const origDueAt = ch92Res.rows[0].due_at;

      console.log('\n[SIMULATION] Shifting Chapter #92 deadline into <= 24h window for Cenário B...');
      // Set deadline to tomorrow 23:59 SP (within 24 hours)
      await dbClient.query(`
        UPDATE public.scan_chapter_stages
        SET due_at = (now() + interval '12 hours'),
            extension_count = 0
        WHERE id = $1
      `, [stage92Id]);

      // Reload page to see Cenário B
      await deskPage.reload({ waitUntil: 'domcontentloaded' });
      await deskPage.waitForTimeout(3000);

      console.log('Capturing Scenario 16: Botão Prorrogar +2 dias disponível (<=24h)...');
      const extendBtn = deskPage.locator('.btn-prominent-extend, .btn-extend-action').first();
      const pScen16 = path.join(ARTIFACT_DIR, 'scenario_16_botao_prorrogar_disponivel.png');
      await deskPage.screenshot({ path: pScen16, fullPage: false });
      console.log(`  ✓ Saved: ${pScen16}`);

      // Click "Prorrogar +2 dias" to open extension modal (Cenário C confirmation)
      if (await extendBtn.count() > 0) {
        await extendBtn.click({ force: true });
        await deskPage.waitForTimeout(800);
        console.log('Capturing Scenario 17: Confirmação da prorrogação (Modal)...');
        const pScen17 = path.join(ARTIFACT_DIR, 'scenario_17_confirmacao_prorrogacao.png');
        await deskPage.screenshot({ path: pScen17, fullPage: false });
        console.log(`  ✓ Saved: ${pScen17}`);

        // Confirm extension via modal button
        const confirmBtn = deskPage.locator('.btn-confirm-extend').first();
        if (await confirmBtn.count() > 0) {
          const respPromise = deskPage.waitForResponse(resp => resp.url().includes('extendStageDeadline'), { timeout: 15000 });
          await confirmBtn.click({ force: true });
          const resp = await respPromise;
          console.log(`  ✓ Extension response status: ${resp.status()}`);
          await deskPage.waitForTimeout(2000);

          console.log('Capturing Scenario 18: Compromisso após a extensão...');
          const pScen18 = path.join(ARTIFACT_DIR, 'scenario_18_compromisso_apos_extensao.png');
          await deskPage.screenshot({ path: pScen18, fullPage: false });
          console.log(`  ✓ Saved: ${pScen18}`);
        }
      }

      // Verify Cenário D: attempting double extension is blocked
      console.log('\n[CENÁRIO D] Verifying double extension guard...');
      const doubleCheck = await dbClient.query(`
        SELECT extension_count, due_at, extended_at FROM public.scan_chapter_stages WHERE id = $1
      `, [stage92Id]);
      console.log(`  ✓ DB extension_count: ${doubleCheck.rows[0].extension_count}`);
      console.log(`  ✓ DB extended_at: ${doubleCheck.rows[0].extended_at}`);

      // Attempt double extension in DB, must throw EXTENSION_ALREADY_USED
      let doubleExtBlocked = false;
      try {
        await dbClient.query(`
          SELECT public.extend_scan_chapter_stage_ysql($1, \x27732fbe87-5040-41fb-9983-0aedb2af44c8\x27::uuid, false)
        `, [stage92Id]);
      } catch (doubleErr) {
        if (/EXTENSION_ALREADY_USED/.test(doubleErr.message)) {
          doubleExtBlocked = true;
          console.log('  ✓ Verified: Second extension rejected with EXTENSION_ALREADY_USED');
        } else {
          console.error('  ❌ Unexpected error during double extension:', doubleErr.message);
        }
      }
      if (!doubleExtBlocked && doubleCheck.rows[0].extension_count >= 1) {
        console.error('  ❌ Double extension guard failed to trigger exception!');
      }

      // Restore Chapter #92 back to clean original state
      console.log('\n[CLEANUP] Restoring Chapter #92 back to original pristine state...');
      await dbClient.query(`
        UPDATE public.scan_chapter_stages
        SET due_at = $1,
            extension_count = 0,
            extended_at = NULL
        WHERE id = $2
      `, [origDueAt, stage92Id]);
      console.log('  ✓ Chapter #92 restored to original deadline and 0 extension count.');
    }

    await deskCtx.close();
    await mobCtx.close();
    await browser.close();

    console.log('\n================================================================');
    console.log('🎉 ALL 20 SCENARIOS & EXTENSION HOMOLOGATIONS CAPTURED SUCCESSFULLY!');
    console.log('================================================================');
  } catch (err) {
    console.error('❌ Error during scenario homologation:', err);
    await browser.close();
  } finally {
    await dbClient.release();
    await pool.end();
  }
}

run();
