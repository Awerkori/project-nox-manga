import { chromium } from '@playwright/test';
import { ownerCookies } from './owner-session.mjs';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const targetUrl = process.env.BENCHMARK_TARGET_URL || 'https://home-preview-manga.project-nox-awerkori.workers.dev';
const artifactDir = '/home/awerkori/.gemini/antigravity-cli/brain/fa6d1923-db0b-428b-bc07-4973adaffd49';

async function main() {
  console.log(`Starting visual capture on ${targetUrl}...`);
  const cookies = await ownerCookies(targetUrl);
  cookies.push({
    name: 'nox-age-status',
    value: 'ADULT',
    url: targetUrl,
    httpOnly: false,
    sameSite: 'Lax',
    secure: targetUrl.startsWith('https:')
  });

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

  try {
    // 1. DESKTOP CAPTURES (1440x900)
    console.log('Capturing Desktop 1440 viewports...');
    const deskCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await deskCtx.addCookies(cookies);
    const deskPage = await deskCtx.newPage();

    // Tradução Desktop
    console.log('Visiting Tradução desktop...');
    await deskPage.goto(`${targetUrl}/scan?tab=pipeline&stage=traducao`, { waitUntil: 'networkidle', timeout: 35000 });
    await deskPage.waitForTimeout(2000);
    await deskPage.screenshot({ path: join(artifactDir, 'preview_traducao_desktop_1440.png'), fullPage: false });

    // Clean/Redraw Desktop
    console.log('Visiting Clean/Redraw desktop...');
    await deskPage.goto(`${targetUrl}/scan?tab=pipeline&stage=clean_redraw`, { waitUntil: 'networkidle', timeout: 35000 });
    await deskPage.waitForTimeout(2000);
    await deskPage.screenshot({ path: join(artifactDir, 'preview_clean_desktop_1440.png'), fullPage: false });

    // Typeset Desktop
    console.log('Visiting Typeset desktop...');
    await deskPage.goto(`${targetUrl}/scan?tab=pipeline&stage=typeset`, { waitUntil: 'networkidle', timeout: 35000 });
    await deskPage.waitForTimeout(2000);
    await deskPage.screenshot({ path: join(artifactDir, 'preview_typeset_desktop_1440.png'), fullPage: false });

    // 2. ANDROID CAPTURES (390x844)
    console.log('Capturing Android 390 viewports...');
    const mobCtx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36'
    });
    await mobCtx.addCookies(cookies);
    const mobPage = await mobCtx.newPage();

    // Tradução Android
    console.log('Visiting Tradução Android 390...');
    await mobPage.goto(`${targetUrl}/scan?tab=pipeline&stage=traducao`, { waitUntil: 'networkidle', timeout: 35000 });
    await mobPage.waitForTimeout(2000);
    await mobPage.screenshot({ path: join(artifactDir, 'preview_traducao_android_390.png'), fullPage: false });

    // Clean/Redraw Android
    console.log('Visiting Clean/Redraw Android 390...');
    await mobPage.goto(`${targetUrl}/scan?tab=pipeline&stage=clean_redraw`, { waitUntil: 'networkidle', timeout: 35000 });
    await mobPage.waitForTimeout(2000);
    await mobPage.screenshot({ path: join(artifactDir, 'preview_clean_android_390.png'), fullPage: false });

    // Typeset Android
    console.log('Visiting Typeset Android 390...');
    await mobPage.goto(`${targetUrl}/scan?tab=pipeline&stage=typeset`, { waitUntil: 'networkidle', timeout: 35000 });
    await mobPage.waitForTimeout(2000);
    await mobPage.screenshot({ path: join(artifactDir, 'preview_typeset_android_390.png'), fullPage: false });

    // 3. RESPONSIVE MATRIX: 320, 360, 430
    for (const width of [320, 360, 430]) {
      console.log(`Capturing Android ${width}px matrix...`);
      const rCtx = await browser.newContext({
        viewport: { width, height: 800 },
        userAgent: 'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36'
      });
      await rCtx.addCookies(cookies);
      const rPage = await rCtx.newPage();
      await rPage.goto(`${targetUrl}/scan?tab=pipeline&stage=traducao`, { waitUntil: 'networkidle', timeout: 35000 });
      await rPage.waitForTimeout(1500);
      await rPage.screenshot({ path: join(artifactDir, `preview_traducao_android_${width}.png`), fullPage: false });
      await rCtx.close();
    }

    // 4. SANITY CHECKS ON PRESERVED AREAS
    console.log('Checking preserved areas (Raw Provider, Minha Fila, Início, Revisor QC)...');
    // Raw Provider
    await deskPage.goto(`${targetUrl}/scan?tab=pipeline&stage=raw`, { waitUntil: 'networkidle', timeout: 35000 });
    await deskPage.waitForTimeout(1500);
    await deskPage.screenshot({ path: join(artifactDir, 'sanity_raw_provider_desktop.png'), fullPage: false });

    // Minha Fila
    await deskPage.goto(`${targetUrl}/scan?tab=minha_fila`, { waitUntil: 'networkidle', timeout: 35000 });
    await deskPage.waitForTimeout(1500);
    await deskPage.screenshot({ path: join(artifactDir, 'sanity_minha_fila_desktop.png'), fullPage: false });

    // Início (Visão Geral V6.6)
    await deskPage.goto(`${targetUrl}/scan?tab=inicio`, { waitUntil: 'networkidle', timeout: 35000 });
    await deskPage.waitForTimeout(1500);
    await deskPage.screenshot({ path: join(artifactDir, 'sanity_inicio_v6_6_desktop.png'), fullPage: false });

    // Revisor QC
    await deskPage.goto(`${targetUrl}/scan?tab=pipeline&stage=revisor_qc`, { waitUntil: 'networkidle', timeout: 35000 });
    await deskPage.waitForTimeout(1500);
    await deskPage.screenshot({ path: join(artifactDir, 'sanity_revisor_qc_desktop.png'), fullPage: false });

    await deskCtx.close();
    await mobCtx.close();

    console.log('All screenshots captured successfully!');
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('Capture failed:', err);
  process.exit(1);
});
