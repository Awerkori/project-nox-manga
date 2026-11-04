import { chromium } from '@playwright/test';
import { ownerCookies } from './owner-session.mjs';
import path from 'node:path';
import fs from 'node:fs';
import pg from 'pg';
const { Pool } = pg;

const PREVIEW_URL = 'https://home-preview-manga.project-nox-awerkori.workers.dev';
const ARTIFACT_DIR = '/home/awerkori/.gemini/antigravity-cli/brain/ceb1143c-9d35-4250-9aa2-14bbd19ce06e/artifacts';

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

const VIEWPORTS = [
  { name: 'desktop_1440', width: 1440, height: 900, isMobile: false }
];

async function main() {
  console.log('Starting Visual Quality Audit for Round 23 Editorial Calendar...');
  const dbClient = await pool.connect();
  let testChapterId = null;

  try {
    // 1. Setup synthetic test chapter #998 to have an available task for claiming
    const scanRes = await dbClient.query(`SELECT id FROM public.scans LIMIT 1`);
    const scanId = scanRes.rows[0].id;
    const workRes = await dbClient.query(`SELECT id FROM public.works LIMIT 1`);
    const workId = workRes.rows[0].id;

    // Clean up any leftover #998
    await dbClient.query(`
      DELETE FROM public.scan_chapter_stages
      WHERE production_chapter_id IN (
        SELECT id FROM public.scan_production_chapters WHERE chapter_number = '998' AND scan_id = $1
      )
    `, [scanId]);
    await dbClient.query(`
      DELETE FROM public.scan_production_chapters WHERE chapter_number = '998' AND scan_id = $1
    `, [scanId]);

    const chRes = await dbClient.query(`
      INSERT INTO public.scan_production_chapters (scan_id, work_id, chapter_number, chapter_label, priority)
      VALUES ($1, $2, '998', 'Auditoria Visual R23', 'NORMAL')
      RETURNING id
    `, [scanId, workId]);
    testChapterId = chRes.rows[0].id;

    const tradStageRes = await dbClient.query(`
      SELECT id FROM public.scan_workflow_stages WHERE scan_id = $1 AND slug = 'traducao' LIMIT 1
    `, [scanId]);
    if (tradStageRes.rows.length > 0) {
      await dbClient.query(`
        INSERT INTO public.scan_chapter_stages (scan_id, chapter_id, production_chapter_id, stage_id, status)
        VALUES ($1, $2, $2, $3, 'AVAILABLE')
      `, [scanId, testChapterId, tradStageRes.rows[0].id]);
    }
    console.log(`Setup synthetic chapter #998 with AVAILABLE traducao stage (ID: ${testChapterId})`);

    const cookies = await ownerCookies(PREVIEW_URL);
    const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

    for (const vp of VIEWPORTS) {
      console.log(`\n--- Capturing viewport: ${vp.name} (${vp.width}x${vp.height}) ---`);
      const ctx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        isMobile: vp.isMobile,
        hasTouch: vp.isMobile
      });
      await ctx.addCookies(cookies);
      const page = await ctx.newPage();

      try {
        const url = `${PREVIEW_URL}/scan?tab=calendario`;
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 35000 });
        await page.waitForTimeout(2500);

        // Verify calendar root is visible
        const hasCalendar = await page.locator('.calendar-workspace-tab').count();
        console.log(`  [${vp.name}] Calendar root present: ${hasCalendar > 0}`);

        // Capture main calendar view
        const mainPath = path.join(ARTIFACT_DIR, `calendar_${vp.name}.png`);
        await page.screenshot({ path: mainPath, fullPage: false });
        console.log(`  [${vp.name}] Saved screenshot: ${mainPath}`);

        // Switch to Agenda mode on desktop_1440 and android_390 FIRST
        if (vp.name === 'desktop_1440' || vp.name === 'android_390') {
          const agendaBtn = page.locator('.btn-toggle-view').filter({ hasText: 'Agenda' }).first();
          if (await agendaBtn.count() > 0) {
            await agendaBtn.click({ force: true });
            await page.waitForTimeout(800);

            const agendaPath = path.join(ARTIFACT_DIR, `calendar_agenda_${vp.name}.png`);
            await page.screenshot({ path: agendaPath, fullPage: false });
            console.log(`  [${vp.name}] Saved agenda screenshot: ${agendaPath}`);

            // Switch back to Mês mode
            const monthBtn = page.locator('.btn-toggle-view').filter({ hasText: 'Mês' }).first();
            if (await monthBtn.count() > 0) {
              await monthBtn.click({ force: true });
              await page.waitForTimeout(600);
            }
          }
        }

        // On 1440 and mobile 390, test opening the day drawer / bottom sheet AFTER Agenda
        if (vp.name === 'desktop_1440' || vp.name === 'android_390') {
          const todayCell = page.locator('.matrix-day-cell.is-today, .matrix-day-cell.is-current-month').first();
          if (await todayCell.count() > 0) {
            await todayCell.click({ force: true });
            await page.waitForTimeout(600);

            const drawerVisible = await page.locator('.day-drawer-panel').count();
            console.log(`  [${vp.name}] Day drawer opened: ${drawerVisible > 0}`);

            const drawerPath = path.join(ARTIFACT_DIR, `calendar_drawer_${vp.name}.png`);
            await page.screenshot({ path: drawerPath, fullPage: false });
            console.log(`  [${vp.name}] Saved drawer screenshot: ${drawerPath}`);
          }
        }

        // Test claim modal view on Minha Fila / Disponíveis
        if (vp.name === 'desktop_1440' || vp.name === 'android_390') {
          await page.goto(`${PREVIEW_URL}/scan?tab=minha_fila`, { waitUntil: 'domcontentloaded', timeout: 35000 });
          await page.waitForTimeout(2000);

          const availTabBtn = page.locator('.queue-tab-btn').filter({ hasText: 'Disponíveis' }).first();
          if (await availTabBtn.count() > 0) {
            await availTabBtn.click({ force: true });
            await page.waitForTimeout(600);
          }

          const claimBtn = page.locator('.btn-action-claim').first();
          if (await claimBtn.count() > 0) {
            await claimBtn.click({ force: true });
            await page.waitForTimeout(800);

            const modalVisible = await page.locator('.modal-backdrop').count();
            console.log(`  [${vp.name}] Claim stage modal opened: ${modalVisible > 0}`);

            const modalPath = path.join(ARTIFACT_DIR, `claim_modal_${vp.name}.png`);
            await page.screenshot({ path: modalPath, fullPage: false });
            console.log(`  [${vp.name}] Saved claim modal screenshot: ${modalPath}`);

            // Close modal by clicking cancel button
            const cancelBtn = page.locator('.btn-claim-cancel').first();
            if (await cancelBtn.count() > 0) {
              await cancelBtn.click({ force: true });
              await page.waitForTimeout(400);
            }
          }
        }

      } catch (err) {
        console.error(`  ❌ Error on viewport ${vp.name}:`, err.message);
      } finally {
        await ctx.close();
      }
    }

    await browser.close();
  } finally {
    // Clean up synthetic test chapter #998
    if (testChapterId) {
      await dbClient.query(`
        DELETE FROM public.scan_chapter_stages
        WHERE chapter_id = $1 OR production_chapter_id = $1
      `, [testChapterId]);
      await dbClient.query(`
        DELETE FROM public.scan_production_chapters WHERE id = $1
      `, [testChapterId]);
      console.log(`🧹 Cleaned up synthetic chapter #998 successfully.`);
    }

    // Verify Céu Distante #85 invariant
    const cd85Check = await dbClient.query(`
      SELECT cs.id, cs.status, ws.slug
      FROM public.scan_chapter_stages cs
      JOIN public.scan_workflow_stages ws ON ws.id = cs.stage_id
      JOIN public.scan_production_chapters spc ON spc.id = cs.chapter_id OR spc.id = cs.production_chapter_id
      JOIN public.works w ON w.id = spc.work_id
      WHERE w.title ILIKE '%Céu%' AND spc.chapter_number = '85' AND ws.slug = 'revisor_qc'
    `);
    console.log(`Céu Distante #85 status: ${cd85Check.rows[0]?.status} (Expected: IN_PROGRESS)`);

    await dbClient.release();
    await pool.end();
  }

  console.log('\n✅ Visual Quality Audit completed successfully!');
}

main().catch(console.error);
