import { chromium } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'https://manga.project-nox-awerkori.workers.dev';

/**
 * High-precision step measurement that strictly distinguishes between
 * Full Document Navigations (SSR) and Client-Side Router Transitions (SPA).
 */
async function measureStep(page, { name, type, actionFn, verifyFn }) {
  const requests = [];
  let totalBytes = 0;
  let dataRequestDuration = null;

  const onRequest = (_req) => {};
  const onResponse = async (res) => {
    try {
      const headers = res.headers();
      const length = parseInt(headers['content-length'] || '0', 10);
      totalBytes += length;
      const url = res.url();
      const timing = res.request().timing();
      const dur = timing?.responseEnd > 0 && timing?.requestStart > 0
        ? Math.round(timing.responseEnd - timing.requestStart)
        : null;

      if (url.includes('__data.json')) {
        dataRequestDuration = dur;
      }

      requests.push({
        url,
        status: res.status(),
        size: length,
        duration: dur,
        serverTiming: headers['server-timing'] || null,
        cacheControl: headers['cache-control'] || null
      });
    } catch {
      /* ignore */
    }
  };

  page.on('request', onRequest);
  page.on('response', onResponse);

  let ttfb = null;
  let fcp = null;
  let lcp = null;

  // Real Click-to-Render timing: timer starts exactly at action invocation
  const startTime = Date.now();
  await actionFn();
  if (verifyFn) {
    await verifyFn();
  }
  const endTime = Date.now();
  const clickToRenderMs = endTime - startTime;

  if (type === 'FULL_NAV') {
    // Document navigation metrics apply only to true document loads
    const perfData = await page.evaluate(() => {
      const navEntries = performance.getEntriesByType('navigation');
      const nav = navEntries.length > 0 ? navEntries[navEntries.length - 1] : null;
      const paintEntries = performance.getEntriesByType('paint');
      const fcpEntry = paintEntries.find((p) => p.name === 'first-contentful-paint');
      const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
      const lcpEntry = lcpEntries.length > 0 ? lcpEntries[lcpEntries.length - 1] : null;

      return {
        ttfb: nav && nav.responseStart > 0 && nav.requestStart > 0 ? Math.round(nav.responseStart - nav.requestStart) : null,
        fcp: fcpEntry ? Math.round(fcpEntry.startTime) : null,
        lcp: lcpEntry ? Math.round(lcpEntry.startTime) : null
      };
    });
    ttfb = perfData.ttfb;
    fcp = perfData.fcp;
    lcp = perfData.lcp;
  }

  page.off('request', onRequest);
  page.off('response', onResponse);

  const docReq = requests.find((r) => r.url.startsWith(BASE_URL) && !r.url.includes('/_app/') && !r.url.includes('/api/'));

  return {
    name,
    type,
    clickToRenderMs,
    ttfb: type === 'FULL_NAV' ? ttfb : 'N/A (SPA)',
    fcp: type === 'FULL_NAV' ? fcp : 'N/A (SPA)',
    lcp: type === 'FULL_NAV' ? lcp : 'N/A (SPA)',
    dataLatencyMs: dataRequestDuration !== null ? `${dataRequestDuration}ms` : '—',
    requestsCount: requests.length,
    transferKb: Math.round(totalBytes / 1024),
    serverTiming: docReq?.serverTiming || 'none',
    cacheControl: docReq?.cacheControl || 'none'
  };
}

/**
 * Execute a single end-to-end journey across all 9 steps
 */
async function executeJourney(page, _modeLabel) {
  const steps = [];

  // 1. Abrir Home (/)
  const step1 = await measureStep(page, {
    name: '1. Abrir Home (/)',
    type: 'FULL_NAV',
    actionFn: async () => {
      await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    },
    verifyFn: async () => {
      await page.waitForSelector('main', { timeout: 15000 });
    }
  });
  steps.push(step1);

  // 2. Entrar no Catálogo (/catalogo)
  const step2 = await measureStep(page, {
    name: '2. Entrar no Catálogo (/catalogo)',
    type: 'SPA_NAV',
    actionFn: async () => {
      const link = page.locator('a[href="/catalogo"]').first();
      if (await link.isVisible()) {
        await link.click();
      } else {
        await page.goto(`${BASE_URL}/catalogo`, { waitUntil: 'domcontentloaded' });
      }
    },
    verifyFn: async () => {
      await page.waitForURL('**/catalogo**', { timeout: 15000 });
      await page.waitForSelector('a[href^="/obra/"]', { timeout: 15000 });
    }
  });
  steps.push(step2);

  // Selecionar obras
  const obraLinks = await page.locator('a[href^="/obra/"]').evaluateAll((els) =>
    els.map((e) => e.getAttribute('href')).filter((h, i, arr) => arr.indexOf(h) === i)
  );
  const firstObra = obraLinks[0] || '/obra/estou-procurando-o-meu-pai';
  const secondObra = obraLinks[1] || obraLinks[0];

  // 3. Clicar em Obra
  const step3 = await measureStep(page, {
    name: `3. Clicar em Obra (${firstObra})`,
    type: 'SPA_NAV',
    actionFn: async () => {
      const link = page.locator(`a[href="${firstObra}"]`).first();
      await link.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
      await link.click();
    },
    verifyFn: async () => {
      await page.waitForURL(`**${firstObra}**`, { timeout: 15000 });
      await page.waitForSelector('h1', { timeout: 15000 });
    }
  });
  steps.push(step3);

  // 4. Voltar ao Catálogo
  const step4 = await measureStep(page, {
    name: '4. Voltar ao Catálogo',
    type: 'SPA_NAV',
    actionFn: async () => {
      const link = page.locator('a[href="/catalogo"]').first();
      if (await link.isVisible()) {
        await link.click();
      } else {
        await page.goBack();
      }
    },
    verifyFn: async () => {
      await page.waitForURL('**/catalogo**', { timeout: 15000 });
      await page.waitForSelector('a[href^="/obra/"]', { timeout: 15000 });
    }
  });
  steps.push(step4);

  // 5. Abrir 2ª Obra
  const step5 = await measureStep(page, {
    name: `5. Abrir 2ª Obra (${secondObra})`,
    type: 'SPA_NAV',
    actionFn: async () => {
      const link = page.locator(`a[href="${secondObra}"]`).first();
      await link.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
      await link.click();
    },
    verifyFn: async () => {
      await page.waitForURL(`**${secondObra}**`, { timeout: 15000 });
      await page.waitForSelector('h1', { timeout: 15000 });
    }
  });
  steps.push(step5);

  // Identificar capítulos para leitura
  let chapterLinks = await page.locator('a[href^="/ler/"]').evaluateAll((els) =>
    els.map((e) => e.getAttribute('href')).filter((h, i, arr) => arr.indexOf(h) === i)
  );

  if (chapterLinks.length < 2) {
    await page.goto(`${BASE_URL}${firstObra}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('a[href^="/ler/"]', { timeout: 15000 });
    chapterLinks = await page.locator('a[href^="/ler/"]').evaluateAll((els) =>
      els.map((e) => e.getAttribute('href')).filter((h, i, arr) => arr.indexOf(h) === i)
    );
  }

  const firstChapter = chapterLinks.length >= 2 ? chapterLinks[chapterLinks.length - 1] : chapterLinks[0];
  const expectedNextChapter = chapterLinks.length >= 2 ? chapterLinks[chapterLinks.length - 2] : null;

  // 6. Entrar em Capítulo
  if (firstChapter) {
    const chapLink = page.locator(`a[href="${firstChapter}"]`).first();
    await chapLink.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});

    const step6 = await measureStep(page, {
      name: `6. Entrar em Capítulo (${firstChapter})`,
      type: 'SPA_NAV',
      actionFn: async () => {
        await chapLink.click();
      },
      verifyFn: async () => {
        await page.waitForURL(`**${firstChapter}**`, { timeout: 20000 });
        await page.waitForSelector('img, .reader-container, .page-image, [data-reader]', { timeout: 20000 });
      }
    });
    steps.push(step6);

    // 7. Avançar Próximo Capítulo
    const nextBtnSelector = expectedNextChapter ? `a[href="${expectedNextChapter}"]` : 'a.btn-nav-next, a.hero-next';
    const nextBtn = page.locator(nextBtnSelector).first();
    const hasNextBtn = (await nextBtn.count()) > 0;
    if (hasNextBtn) {
      await nextBtn.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
    }

    const step7 = await measureStep(page, {
      name: `7. Próximo Capítulo (${expectedNextChapter || 'next'})`,
      type: 'SPA_NAV',
      actionFn: async () => {
        if (hasNextBtn) {
          await nextBtn.click({ force: true });
        } else {
          await page.keyboard.press('ArrowRight');
        }
      },
      verifyFn: async () => {
        if (expectedNextChapter) {
          await page.waitForURL(`**${expectedNextChapter}**`, { timeout: 20000 });
        }
        await page.waitForSelector('img, .reader-container, .page-image, [data-reader]', { timeout: 20000 });
      }
    });
    steps.push(step7);
  }

  // 8. Pesquisar no Catálogo (?q=Solo)
  const step8 = await measureStep(page, {
    name: '8. Pesquisa Catálogo (?q=Solo)',
    type: 'FULL_NAV',
    actionFn: async () => {
      await page.goto(`${BASE_URL}/catalogo?q=Solo`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    },
    verifyFn: async () => {
      await page.waitForSelector('main', { timeout: 15000 });
    }
  });
  steps.push(step8);

  // 9. Navegar por Lançamentos (/lancamentos)
  const step9 = await measureStep(page, {
    name: '9. Lançamentos (/lancamentos)',
    type: 'SPA_NAV',
    actionFn: async () => {
      const link = page.locator('a[href="/lancamentos"]').first();
      if (await link.isVisible()) {
        await link.click();
      } else {
        await page.goto(`${BASE_URL}/lancamentos`, { waitUntil: 'domcontentloaded' });
      }
    },
    verifyFn: async () => {
      await page.waitForURL('**/lancamentos**', { timeout: 15000 });
      await page.waitForSelector('main', { timeout: 15000 });
    }
  });
  steps.push(step9);

  return steps;
}

/**
 * Calculate statistical percentiles p50 and p95 from array of numbers
 */
function calculatePercentiles(numbers) {
  if (!numbers || numbers.length === 0) return { p50: 0, p95: 0, min: 0, max: 0, avg: 0 };
  const sorted = [...numbers].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const avg = Math.round(sorted.reduce((sum, n) => sum + n, 0) / sorted.length);

  const p50Idx = Math.floor(sorted.length * 0.5);
  const p50 = sorted[p50Idx];

  const p95Idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
  const p95 = sorted[p95Idx];

  return { p50, p95, min, max, avg };
}

async function main() {
  console.log('========================================================================');
  console.log('PROJECT NOX — BENCHMARK DE PERFORMANCE REAL (JORNADA DO USUÁRIO)');
  console.log(`Ambiente Testado: ${BASE_URL}`);
  console.log('========================================================================\n');

  const browser = await chromium.launch({ headless: true });

  // ----------------------------------------------------
  // ROUND 1: CACHE FRIO (Novo contexto isolado sem cache)
  // ----------------------------------------------------
  console.log('>>> EXECUTANDO RODADA 1: CACHE FRIO (Contexto Limpo)...');
  const coldContext = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  await coldContext.addCookies([
    { name: 'nox-age-status', value: 'ADULT', domain: new URL(BASE_URL).hostname, path: '/' }
  ]);
  const coldPage = await coldContext.newPage();
  const coldSteps = await executeJourney(coldPage, 'CACHE_FRIO');
  await coldContext.close();

  // ----------------------------------------------------
  // ROUNDS 2, 3, 4, 5: CACHE QUENTE (Mesmo contexto com cache HTTP ativo)
  // ----------------------------------------------------
  console.log('\n>>> EXECUTANDO RODADAS 2 a 5: CACHE QUENTE (4 Amostras de Navegação)...');
  const warmContext = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  await warmContext.addCookies([
    { name: 'nox-age-status', value: 'ADULT', domain: new URL(BASE_URL).hostname, path: '/' }
  ]);
  const warmPage = await warmContext.newPage();

  // Primeira passada para aquecer cache do contexto
  await executeJourney(warmPage, 'WARM_PRIMING');

  const warmSamples = [];
  const WARM_ITERATIONS = 4;
  for (let i = 1; i <= WARM_ITERATIONS; i++) {
    process.stdout.write(`   Rodada quente ${i}/${WARM_ITERATIONS}... `);
    const steps = await executeJourney(warmPage, `WARM_RUN_${i}`);
    warmSamples.push(steps);
    console.log('OK');
  }
  await warmContext.close();
  await browser.close();

  // ----------------------------------------------------
  // CONSOLIDAR RESULTADOS E PERCENTIS
  // ----------------------------------------------------
  console.log('\n========================================================================');
  console.log('TABELA 1: CARREGAMENTO FRIO (PRIMEIRO ACESSO REAL)');
  console.log('========================================================================');
  console.table(
    coldSteps.map((s) => ({
      Passo: s.name,
      Tipo: s.type,
      'Tempo de Espera (ms)': s.clickToRenderMs,
      'TTFB (ms)': s.ttfb,
      'FCP (ms)': s.fcp,
      'Data Latency': s.dataLatencyMs,
      Requests: s.requestsCount,
      'Transfer (KB)': s.transferKb
    }))
  );

  console.log('\n========================================================================');
  console.log('TABELA 2: CACHE QUENTE — ESTATÍSTICAS REAIS (p50 / p95 / Média)');
  console.log(`(Calculado a partir de ${WARM_ITERATIONS} amostras completas)`);
  console.log('========================================================================');

  const statsTable = coldSteps.map((baseStep, idx) => {
    const times = warmSamples.map((run) => run[idx]?.clickToRenderMs).filter((t) => typeof t === 'number');
    const stats = calculatePercentiles(times);
    return {
      Passo: baseStep.name,
      Tipo: baseStep.type,
      'p50 (Mediana)': `${stats.p50} ms`,
      p95: `${stats.p95} ms`,
      Média: `${stats.avg} ms`,
      'Min / Max': `${stats.min} / ${stats.max} ms`,
      Amostras: times.length
    };
  });
  console.table(statsTable);

  return { coldSteps, statsTable };
}

main().catch(console.error);
