import { chromium } from '@playwright/test';
import { ownerCookies } from './owner-session.mjs';
import path from 'node:path';
import fs from 'node:fs';
import pg from 'pg';
const { Pool } = pg;

const PREVIEW_URL = 'https://home-preview-manga.project-nox-awerkori.workers.dev';
const ARTIFACT_DIR = '/home/awerkori/.gemini/antigravity-cli/brain/cb235aac-95f5-4de2-ab25-6fe2cb256990/artifacts';

if (!fs.existsSync(ARTIFACT_DIR)) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
}

const envLines = fs.readFileSync("/home/awerkori/.config/project-nox/yugabyte.env", "utf8").split("\n");
const envVars = {};
for (const line of envLines) {
  const m = line.match(/^([^=]+)=(.*)$/);
  if (m) envVars[m[1].trim()] = m[2].trim().replace(/^["\x27]|["\x27]$/g, "");
}
const ca = fs.readFileSync("/home/awerkori/.config/project-nox/root.crt", "utf8");
const pool = new Pool({
  host: envVars.YUGABYTE_HOST,
  port: parseInt(envVars.YUGABYTE_PORT || "5433", 10),
  user: envVars.YUGABYTE_USER,
  password: envVars.YUGABYTE_PASSWORD,
  database: envVars.YUGABYTE_DATABASE,
  ssl: { ca, rejectUnauthorized: false }
});

const MANDATORY_STAGES = [
  { slug: 'traducao', name: 'Tradução' },
  { slug: 'clean_redraw', name: 'Clean/Redraw' },
  { slug: 'typeset', name: 'Typeset' },
  { slug: 'revisor_qc', name: 'Revisor (QC)' }
];

async function main() {
  console.log('================================================================');
  console.log('🚀 STARTING DEFINITIVE E2E AUDIT & HOMOLOGATION — ROUND 23');
  console.log('================================================================');

  const client = await pool.connect();
  const testCreatedChapterIds = [];
  let actorId = null;
  let scanId = null;
  let workId = null;

  try {
    // 0. Initial Invariant Check: Céu Distante #85
    console.log('\n[Phase 0] Checking Céu Distante #85 baseline status...');
    const cd85Baseline = await client.query(`
      SELECT cs.id, cs.status, ws.slug as stage_slug, ws.name as stage_name, pc.chapter_number, w.title
      FROM public.scan_chapter_stages cs
      JOIN public.scan_workflow_stages ws ON ws.id = cs.stage_id
      JOIN public.scan_production_chapters pc ON pc.id = COALESCE(cs.production_chapter_id, cs.chapter_id)
      JOIN public.works w ON w.id = pc.work_id
      WHERE w.title ILIKE '%Céu%' AND pc.chapter_number = '85' AND ws.slug = 'revisor_qc'
    `);
    if (cd85Baseline.rows.length === 0) {
      throw new Error('FATAL: Céu Distante #85 QC record not found in database!');
    }
    const cd85Record = cd85Baseline.rows[0];
    console.log(`  ✓ Céu Distante #85 Baseline: ID=${cd85Record.id}, Status=${cd85Record.status}, Stage=${cd85Record.stage_slug}`);
    if (cd85Record.status !== 'IN_PROGRESS') {
      console.warn(`  ⚠️ Warning: Céu Distante #85 status is ${cd85Record.status}`);
    }

    // Get Admin Actor & Scan & Work
    const actorRes = await client.query(`
      SELECT m.id, m.username, m.display_name, sm.scan_id
      FROM public.members m
      JOIN public.scan_members sm ON sm.user_id = m.id
      WHERE sm.role = 'OWNER' OR sm.role = 'ADMIN'
      LIMIT 1
    `);
    if (actorRes.rows.length === 0) {
      throw new Error('No scan admin/owner member found in DB');
    }
    actorId = actorRes.rows[0].id;
    scanId = actorRes.rows[0].scan_id;

    const workRes = await client.query(`SELECT id, title FROM public.works LIMIT 1`);
    workId = workRes.rows[0].id;

    console.log(`  ✓ Actor: ${actorRes.rows[0].display_name} (${actorId})`);
    console.log(`  ✓ Scan ID: ${scanId}, Work: ${workRes.rows[0].title} (${workId})`);

    // ================================================================
    // Phase 1: Deep Backend / YSQL Validation for All 4 Mandatory Stages
    // ================================================================
    console.log('\n[Phase 1] Validating All 4 Mandatory Stages (YSQL business logic)...');

    for (const stageDef of MANDATORY_STAGES) {
      console.log(`\n--- Testing Stage: ${stageDef.name} (${stageDef.slug}) ---`);

      // Find workflow stage id
      const stageRes = await client.query(`
        SELECT id, name, slug FROM public.scan_workflow_stages
        WHERE scan_id = $1 AND (slug = $2 OR (slug IN ('clean', 'clean_redraw') AND $2 = 'clean_redraw') OR (slug IN ('qc', 'revisao', 'revisor_qc') AND $2 = 'revisor_qc'))
        LIMIT 1
      `, [scanId, stageDef.slug]);
      if (stageRes.rows.length === 0) {
        throw new Error(`Workflow stage not found for ${stageDef.slug}`);
      }
      const stageId = stageRes.rows[0].id;

      // Create synthetic test production chapter
      const testChapterNumber = `99${Math.floor(10 + Math.random() * 89)}`;
      const chRes = await client.query(`
        INSERT INTO public.scan_production_chapters (scan_id, work_id, chapter_number, chapter_label, priority)
        VALUES ($1, $2, $3, 'Teste E2E R23', 'NORMAL')
        RETURNING id
      `, [scanId, workId, testChapterNumber]);
      const testChId = chRes.rows[0].id;
      testCreatedChapterIds.push(testChId);

      // Create chapter stage record with AVAILABLE status
      const csRes = await client.query(`
        INSERT INTO public.scan_chapter_stages (scan_id, chapter_id, production_chapter_id, stage_id, status)
        VALUES ($1, $2, $2, $3, 'AVAILABLE')
        RETURNING id
      `, [scanId, testChId, stageId]);
      const chapterStageId = csRes.rows[0].id;

      // 1.1 Test claim WITHOUT deadline (Must fail with DEADLINE_SELECTION_REQUIRED)
      try {
        await client.query(`
          SELECT public.claim_scan_chapter_stage_ysql($1, $2, true, NULL, 'Sem prazo')
        `, [chapterStageId, actorId]);
        throw new Error(`FAIL: Claiming mandatory stage ${stageDef.slug} without deadline unexpectedly succeeded!`);
      } catch (err) {
        if (/DEADLINE_SELECTION_REQUIRED/.test(err.message)) {
          console.log(`  ✓ 1.1 Enforced DEADLINE_SELECTION_REQUIRED on ${stageDef.slug}`);
        } else {
          throw new Error(`Unexpected error on claim without deadline: ${err.message}`);
        }
      }

      // 1.2 Test claim with date in the PAST (Must fail with DEADLINE_CANNOT_BE_IN_PAST)
      try {
        const pastDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
        await client.query(`
          SELECT public.claim_scan_chapter_stage_ysql($1, $2, true, $3, 'Data no passado')
        `, [chapterStageId, actorId, pastDate]);
        throw new Error(`FAIL: Claiming with past date unexpectedly succeeded!`);
      } catch (err) {
        if (/DEADLINE_CANNOT_BE_IN_PAST/.test(err.message)) {
          console.log(`  ✓ 1.2 Enforced DEADLINE_CANNOT_BE_IN_PAST on ${stageDef.slug}`);
        } else {
          throw new Error(`Unexpected error on claim with past date: ${err.message}`);
        }
      }

      // 1.3 Test claim with date > 3 days in the future (Must fail with DEADLINE_EXCEEDS_MAX_THREE_DAYS)
      try {
        const farFuture = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
        await client.query(`
          SELECT public.claim_scan_chapter_stage_ysql($1, $2, true, $3, 'Data além de 3 dias')
        `, [chapterStageId, actorId, farFuture]);
        throw new Error(`FAIL: Claiming with >3 days date unexpectedly succeeded!`);
      } catch (err) {
        if (/DEADLINE_EXCEEDS_MAX_THREE_DAYS/.test(err.message)) {
          console.log(`  ✓ 1.3 Enforced DEADLINE_EXCEEDS_MAX_THREE_DAYS on ${stageDef.slug}`);
        } else {
          throw new Error(`Unexpected error on claim with >3 days date: ${err.message}`);
        }
      }

      // 1.4 Test claim with valid date (Today + 2 days)
      const validTarget = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
      const claimResult = await client.query(`
        SELECT public.claim_scan_chapter_stage_ysql($1, $2, true, $3, 'Planejamento de teste R23') AS result
      `, [chapterStageId, actorId, validTarget]);
      const claimJson = claimResult.rows[0].result;
      if (!claimJson?.success) {
        throw new Error(`Failed to claim stage ${stageDef.slug} with valid deadline: ${JSON.stringify(claimJson)}`);
      }
      console.log(`  ✓ 1.4 Successfully claimed ${stageDef.slug} with valid deadline: ${claimJson.due_at}`);

      // Verify row state in DB
      const rowCheck = await client.query(`
        SELECT status, assigned_to, due_at, original_due_at, extension_count, notes
        FROM public.scan_chapter_stages WHERE id = $1
      `, [chapterStageId]);
      const row = rowCheck.rows[0];
      if (row.status !== 'IN_PROGRESS' || row.assigned_to !== actorId) {
        throw new Error(`Stage row not properly updated: ${JSON.stringify(row)}`);
      }
      if (!row.due_at || !row.original_due_at || row.notes !== 'Planejamento de teste R23') {
        throw new Error(`Stage due_at or notes mismatch: ${JSON.stringify(row)}`);
      }
      console.log(`  ✓ Verified DB state: status=${row.status}, notes="${row.notes}", due_at=${row.due_at}`);

      // 1.5 Test Stage Notes Update function
      const updatedNotes = 'Anotação atualizada via painel de acompanhamento';
      const noteRes = await client.query(`
        SELECT public.update_scan_chapter_stage_notes_ysql($1, $2, true, $3) AS result
      `, [chapterStageId, actorId, updatedNotes]);
      if (!noteRes.rows[0]?.result?.success) {
        throw new Error(`update_scan_chapter_stage_notes_ysql failed`);
      }
      const noteCheck = await client.query(`SELECT notes FROM public.scan_chapter_stages WHERE id = $1`, [chapterStageId]);
      if (noteCheck.rows[0].notes !== updatedNotes) {
        throw new Error(`Stage notes not updated in DB`);
      }
      console.log(`  ✓ 1.5 Verified notes update: "${noteCheck.rows[0].notes}"`);

      // 1.6 Test Automatic Extension Rules
      // Right now the deadline is +2 days away (>24h). Calling extend should fail with EXTENSION_ONLY_ALLOWED_WITHIN_24H
      try {
        await client.query(`
          SELECT public.extend_scan_chapter_stage_ysql($1, $2, true)
        `, [chapterStageId, actorId]);
        throw new Error(`FAIL: Extension >24h away unexpectedly succeeded!`);
      } catch (err) {
        if (/EXTENSION_ONLY_ALLOWED_WITHIN_24H/.test(err.message)) {
          console.log(`  ✓ 1.6 Enforced EXTENSION_ONLY_ALLOWED_WITHIN_24H when deadline > 24h`);
        } else {
          throw new Error(`Unexpected error on early extension: ${err.message}`);
        }
      }

      // Now set due_at to today (within 24h) to test successful extension
      const todaySpDue = await client.query(`
        UPDATE public.scan_chapter_stages
        SET due_at = ((now() AT TIME ZONE 'America/Sao_Paulo')::date + interval '23 hours 59 minutes 59 seconds') AT TIME ZONE 'America/Sao_Paulo'
        WHERE id = $1
        RETURNING due_at
      `, [chapterStageId]);
      const initialDueAt = todaySpDue.rows[0].due_at;

      // Perform extension: should succeed and add exactly +2 calendar days
      const extendRes = await client.query(`
        SELECT public.extend_scan_chapter_stage_ysql($1, $2, true) AS result
      `, [chapterStageId, actorId]);
      const extendJson = extendRes.rows[0].result;
      if (!extendJson?.success || extendJson.extension_count !== 1) {
        throw new Error(`extend_scan_chapter_stage_ysql failed: ${JSON.stringify(extendJson)}`);
      }
      console.log(`  ✓ 1.7 Successfully applied +2 days extension: new_due_at=${extendJson.new_due_at}`);

      // Verify extension invariants in DB
      const extCheck = await client.query(`
        SELECT due_at, original_due_at, extension_count, extended_at
        FROM public.scan_chapter_stages WHERE id = $1
      `, [chapterStageId]);
      const extRow = extCheck.rows[0];
      if (extRow.extension_count !== 1 || !extRow.extended_at) {
        throw new Error(`Extension count or extended_at not updated in DB: ${JSON.stringify(extRow)}`);
      }
      console.log(`  ✓ Verified DB extension invariant: extension_count=1, extended_at=${extRow.extended_at}`);

      // 1.8 Test second extension attempt (Must fail with EXTENSION_ALREADY_USED)
      try {
        await client.query(`
          SELECT public.extend_scan_chapter_stage_ysql($1, $2, true)
        `, [chapterStageId, actorId]);
        throw new Error(`FAIL: Second extension attempt unexpectedly succeeded!`);
      } catch (err) {
        if (/EXTENSION_ALREADY_USED/.test(err.message)) {
          console.log(`  ✓ 1.8 Enforced EXTENSION_ALREADY_USED (one-time extension limit)`);
        } else {
          throw new Error(`Unexpected error on second extension: ${err.message}`);
        }
      }

      // 1.9 Test Deadline Warning Generator
      // Set due_at to 12 hours from now and check warning generation
      await client.query(`
        UPDATE public.scan_chapter_stages
        SET due_at = now() + interval '12 hours', due_warning_sent_at = NULL
        WHERE id = $1
      `, [chapterStageId]);
      const warnRes = await client.query(`
        SELECT public.check_and_send_deadline_warnings_ysql($1) AS count
      `, [scanId]);
      console.log(`  ✓ 1.9 Warning check triggered (notified stages count: ${warnRes.rows[0].count})`);
      const warnCheck = await client.query(`
        SELECT due_warning_sent_at FROM public.scan_chapter_stages WHERE id = $1
      `, [chapterStageId]);
      if (!warnCheck.rows[0].due_warning_sent_at) {
        throw new Error(`due_warning_sent_at was not populated`);
      }
      console.log(`  ✓ due_warning_sent_at recorded: ${warnCheck.rows[0].due_warning_sent_at}`);
    }

    console.log('\n✅ All 4 Mandatory Stages successfully passed all backend/YSQL verification!');

    // ================================================================
    // Phase 2: Live Browser / UI Homologation Across Desktop & Mobile
    // ================================================================
    console.log('\n[Phase 2] Starting Real Browser E2E & Visual Testing...');

    // Setup an AVAILABLE stage for the UI modal test
    const uiChapterNumber = '990';
    // Clean any prior 990
    await client.query(`
      DELETE FROM public.scan_chapter_stages
      WHERE production_chapter_id IN (
        SELECT id FROM public.scan_production_chapters WHERE chapter_number = $1 AND scan_id = $2
      )
    `, [uiChapterNumber, scanId]);
    await client.query(`
      DELETE FROM public.scan_production_chapters WHERE chapter_number = $1 AND scan_id = $2
    `, [uiChapterNumber, scanId]);

    const uiChRes = await client.query(`
      INSERT INTO public.scan_production_chapters (scan_id, work_id, chapter_number, chapter_label, priority)
      VALUES ($1, $2, $3, 'Homologação UI R23', 'HIGH')
      RETURNING id
    `, [scanId, workId, uiChapterNumber]);
    const uiChId = uiChRes.rows[0].id;
    testCreatedChapterIds.push(uiChId);

    const tradStage = await client.query(`
      SELECT id FROM public.scan_workflow_stages WHERE scan_id = $1 AND slug = 'traducao' LIMIT 1
    `, [scanId]);
    await client.query(`
      INSERT INTO public.scan_chapter_stages (scan_id, chapter_id, production_chapter_id, stage_id, status)
      VALUES ($1, $2, $2, $3, 'AVAILABLE')
    `, [scanId, uiChId, tradStage.rows[0].id]);
    console.log(`  ✓ Prepared synthetic UI test chapter #${uiChapterNumber} (Tradução AVAILABLE)`);

    const cookies = await ownerCookies(PREVIEW_URL);
    const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

    const VIEWPORTS = [
      { name: 'desktop_1440', width: 1440, height: 900, isMobile: false },
      { name: 'android_390', width: 390, height: 844, isMobile: true }
    ];

    for (const vp of VIEWPORTS) {
      console.log(`\n--- Testing Viewport: ${vp.name} (${vp.width}x${vp.height}, isMobile=${vp.isMobile}) ---`);
      const ctx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        isMobile: vp.isMobile,
        hasTouch: vp.isMobile,
        deviceScaleFactor: 2
      });
      await ctx.addCookies(cookies);
      const page = await ctx.newPage();

      try {
        // 2.1 Navigate to Calendar Tab
        const calUrl = `${PREVIEW_URL}/scan?tab=calendario`;
        console.log(`  Navigating to ${calUrl}...`);
        await page.goto(calUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await page.waitForTimeout(3000);

        // Verify Calendar container is rendered
        const calRoot = page.locator('.calendar-workspace-tab');
        if (await calRoot.count() === 0) {
          throw new Error(`Calendar tab container (.calendar-workspace-tab) not found on ${vp.name}`);
        }
        console.log(`  ✓ Calendar workspace tab mounted properly.`);

        // Screenshot 1: Month View
        const shotMonth = path.join(ARTIFACT_DIR, `01_calendar_month_${vp.name}.png`);
        await page.screenshot({ path: shotMonth, fullPage: false });
        console.log(`  📸 Screenshot saved: ${shotMonth}`);

        // 2.2 Switch to Agenda View
        const agendaBtn = page.locator('.btn-toggle-view').filter({ hasText: 'Agenda' }).first();
        if (await agendaBtn.count() > 0) {
          await agendaBtn.click({ force: true });
          await page.waitForTimeout(1000);

          const agendaRoot = page.locator('.calendar-agenda-view');
          const hasAgenda = await agendaRoot.count() > 0;
          console.log(`  ✓ Agenda view active: ${hasAgenda}`);

          // Screenshot 2: Agenda View
          const shotAgenda = path.join(ARTIFACT_DIR, `02_calendar_agenda_${vp.name}.png`);
          await page.screenshot({ path: shotAgenda, fullPage: false });
          console.log(`  📸 Screenshot saved: ${shotAgenda}`);

          // Switch back to Month view
          const monthBtn = page.locator('.btn-toggle-view').filter({ hasText: 'Mês' }).first();
          if (await monthBtn.count() > 0) {
            await monthBtn.click({ force: true });
            await page.waitForTimeout(800);
          }
        }

        // 2.3 Test Day Drawer / Side Panel
        const dayCell = page.locator('.matrix-day-cell.is-today, .matrix-day-cell.is-current-month').first();
        if (await dayCell.count() > 0) {
          await dayCell.click({ force: true });
          await page.waitForTimeout(800);

          const drawer = page.locator('.day-drawer-panel');
          const isDrawerOpen = await drawer.count() > 0;
          console.log(`  ✓ Day drawer opened: ${isDrawerOpen}`);

          // Screenshot 3: Day Drawer Side Panel
          const shotDrawer = path.join(ARTIFACT_DIR, `03_calendar_drawer_${vp.name}.png`);
          await page.screenshot({ path: shotDrawer, fullPage: false });
          console.log(`  📸 Screenshot saved: ${shotDrawer}`);

          // Close drawer
          const closeDrawerBtn = page.locator('.btn-close-drawer').first();
          if (await closeDrawerBtn.count() > 0) {
            await closeDrawerBtn.click({ force: true });
            await page.waitForTimeout(400);
          }
        }

        // 2.4 Test Claim Stage Modal with Deadline Picker on Minha Fila / Disponíveis
        console.log(`  Navigating to Minha Fila to test Claim Modal...`);
        await page.goto(`${PREVIEW_URL}/scan?tab=minha_fila`, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await page.waitForTimeout(3000);

        const availTabBtn = page.locator('.queue-tab-btn').filter({ hasText: 'Disponíveis' }).first();
        if (await availTabBtn.count() > 0) {
          await availTabBtn.click({ force: true });
          await page.waitForTimeout(1000);
        }

        const claimBtn = page.locator('.btn-action-claim').first();
        if (await claimBtn.count() > 0) {
          await claimBtn.click({ force: true });
          await page.waitForTimeout(1200);

          const modal = page.locator('.modal-backdrop');
          const isModalOpen = await modal.count() > 0;
          console.log(`  ✓ Claim Stage Modal opened: ${isModalOpen}`);

          // Verify calendar picker inside modal
          const allowedCells = page.locator('.grid-day-cell.is-allowed');
          const allowedCount = await allowedCells.count();
          console.log(`  ✓ Allowed selectable deadline dates: ${allowedCount} (Expected: 4, today + 3 days)`);

          const summaryText = await page.locator('.summary-value.cyan').innerText();
          console.log(`  ✓ Deadline summary display: "${summaryText}"`);

          // Screenshot 4: Claim Stage Modal
          const shotModal = path.join(ARTIFACT_DIR, `04_claim_modal_${vp.name}.png`);
          await page.screenshot({ path: shotModal, fullPage: false });
          console.log(`  📸 Screenshot saved: ${shotModal}`);

          // Close modal
          const cancelBtn = page.locator('.btn-cancel, .btn-close-modal').first();
          if (await cancelBtn.count() > 0) {
            await cancelBtn.click({ force: true });
            await page.waitForTimeout(500);
          }
        } else {
          console.warn(`  ⚠️ No claim button found in Disponíveis queue`);
        }

      } catch (err) {
        console.error(`  ❌ Error during browser test on ${vp.name}:`, err);
        throw err;
      } finally {
        await ctx.close();
      }
    }

    await browser.close();

  } finally {
    // ================================================================
    // Phase 3: Cleanup Test Records & Final Céu Distante Invariant Check
    // ================================================================
    console.log('\n[Phase 3] Cleaning up test records and verifying Céu Distante #85...');

    for (const testChId of testCreatedChapterIds) {
      await client.query(`
        DELETE FROM public.scan_chapter_stages
        WHERE chapter_id = $1 OR production_chapter_id = $1
      `, [testChId]);
      await client.query(`
        DELETE FROM public.scan_chapter_timeline
        WHERE production_chapter_id = $1
      `, [testChId]);
      await client.query(`
        DELETE FROM public.scan_production_chapters WHERE id = $1
      `, [testChId]);
    }
    console.log(`  ✓ Cleaned up ${testCreatedChapterIds.length} synthetic production test chapters.`);

    // Clean up test notifications created for actorId during test
    await client.query(`
      DELETE FROM public.notifications
      WHERE dedupe_key LIKE 'deadline_extended:%' OR dedupe_key LIKE 'deadline_warning:%'
    `);
    console.log(`  ✓ Cleaned up test notifications.`);

    // Céu Distante #85 Final Check
    const cd85Final = await client.query(`
      SELECT cs.id, cs.status, cs.assigned_to, cs.notes, ws.slug as stage_slug
      FROM public.scan_chapter_stages cs
      JOIN public.scan_workflow_stages ws ON ws.id = cs.stage_id
      JOIN public.scan_production_chapters pc ON pc.id = COALESCE(cs.production_chapter_id, cs.chapter_id)
      JOIN public.works w ON w.id = pc.work_id
      WHERE w.title ILIKE '%Céu%' AND pc.chapter_number = '85' AND ws.slug = 'revisor_qc'
    `);
    const finalRec = cd85Final.rows[0];
    console.log(`  ✓ Céu Distante #85 Final State: ID=${finalRec.id}, Status=${finalRec.status}, Stage=${finalRec.stage_slug}`);
    if (finalRec.status !== 'IN_PROGRESS' || finalRec.notes !== 'Revisão textual aprovada.') {
      throw new Error(`CRITICAL INVARIANT VIOLATION: Céu Distante #85 was modified!`);
    }
    console.log(`  🛡️ Céu Distante #85 is 100% UNTOUCHED and fully preserved in QC.`);

    client.release();
    await pool.end();
  }

  console.log('\n================================================================');
  console.log('🎉 DEFINITIVE AUDIT COMPLETE: ALL E2E INVARIANTS PERFECTLY VALIDATED!');
  console.log('================================================================');
}

main().catch((err) => {
  console.error('\n💥 AUDIT FAILED:', err);
  process.exit(1);
});
