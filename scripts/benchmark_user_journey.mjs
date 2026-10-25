import { chromium } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'https://manga.project-nox-awerkori.workers.dev';

async function measureNavigation(page, actionName, actionFn, verifyFn) {
  const requests = [];
  let totalBytes = 0;

  const onRequest = (req) => {
    // track requests during this step
  };
  const onResponse = async (res) => {
    try {
      const headers = res.headers();
      const length = parseInt(headers['content-length'] || '0', 10);
      totalBytes += length;
      requests.push({
        url: res.url(),
        status: res.status(),
        size: length,
        serverTiming: headers['server-timing'] || null,
        cacheControl: headers['cache-control'] || null
      });
    } catch {}
  };

  page.on('request', onRequest);
  page.on('response', onResponse);

  const startTime = Date.now();
  await actionFn();
  if (verifyFn) {
    await verifyFn();
  }
  const endTime = Date.now();
  const clickToRenderMs = endTime - startTime;

  // Extract performance metrics from the browser
  const perfData = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const paint = performance.getEntriesByType('paint');
    const fcp = paint.find((p) => p.name === 'first-contentful-paint')?.startTime || null;

    let lcp = null;
    const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
    if (lcpEntries.length > 0) {
      lcp = lcpEntries[lcpEntries.length - 1].startTime;
    }

    return {
      ttfb: nav ? Math.round(nav.responseStart - nav.requestStart) : null,
      domInteractive: nav ? Math.round(nav.domInteractive) : null,
      domComplete: nav ? Math.round(nav.domComplete) : null,
      loadEventEnd: nav ? Math.round(nav.loadEventEnd) : null,
      fcp: fcp ? Math.round(fcp) : null,
      lcp: lcp ? Math.round(lcp) : null
    };
  });

  page.off('request', onRequest);
  page.off('response', onResponse);

  const docReq = requests.find((r) => r.url.startsWith(BASE_URL) && !r.url.includes('/_app/') && !r.url.includes('/api/'));

  return {
    action: actionName,
    clickToRenderMs,
    ttfb: perfData.ttfb,
    fcp: perfData.fcp,
    lcp: perfData.lcp,
    requestsCount: requests.length,
    transferKb: Math.round(totalBytes / 1024),
    serverTiming: docReq?.serverTiming || 'none',
    cacheControl: docReq?.cacheControl || 'none'
  };
}

async function runBenchmark(label = 'Run') {
  console.log(`\n======================================================`);
  console.log(`INICIANDO BENCHMARK DE EXPERIÊNCIA DO USUÁRIO: ${label}`);
  console.log(`Ambiente: ${BASE_URL}`);
  console.log(`======================================================\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Benchmark/1.0'
  });

  // Pre-set adult preference cookie so age gate modal doesn't block navigation, exactly like a returning user
  await context.addCookies([
    {
      name: 'nox-age-status',
      value: 'ADULT',
      domain: new URL(BASE_URL).hostname,
      path: '/'
    },
    {
      name: 'nox-blur-nsfw',
      value: 'false',
      domain: new URL(BASE_URL).hostname,
      path: '/'
    }
  ]);

  const page = await context.newPage();

  const results = [];

  try {
    // 1. Abrir a página inicial
    console.log('1. Navegando para Home (/) [Cache Frio]...');
    const step1 = await measureNavigation(
      page,
      '1. Abrir Home (/)',
      async () => {
        await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
      },
      async () => {
        await page.waitForSelector('main', { timeout: 15000 });
      }
    );
    results.push(step1);
    console.log(`   -> Click-to-Render: ${step1.clickToRenderMs}ms | TTFB: ${step1.ttfb}ms | FCP: ${step1.fcp}ms | LCP: ${step1.lcp}ms`);

    // 2. Entrar no catálogo
    console.log('2. Entrar no Catálogo (/catalogo)...');
    const step2 = await measureNavigation(
      page,
      '2. Entrar no Catálogo (/catalogo)',
      async () => {
        const catalogoLink = page.locator('a[href="/catalogo"]').first();
        if (await catalogoLink.isVisible()) {
          await catalogoLink.click();
        } else {
          await page.goto(`${BASE_URL}/catalogo`, { waitUntil: 'domcontentloaded' });
        }
      },
      async () => {
        await page.waitForURL('**/catalogo**', { timeout: 15000 });
        await page.waitForSelector('a[href^="/obra/"]', { timeout: 20000 });
      }
    );
    results.push(step2);
    console.log(`   -> Click-to-Render: ${step2.clickToRenderMs}ms | TTFB: ${step2.ttfb}ms | FCP: ${step2.fcp}ms`);

    // Obter links de obras do catálogo
    const obraLinks = await page.locator('a[href^="/obra/"]').evaluateAll((els) =>
      els.map((e) => e.getAttribute('href')).filter((h, i, arr) => arr.indexOf(h) === i)
    );
    const firstObra = obraLinks[0] || '/obra/solo-leveling';
    const secondObra = obraLinks[1] || obraLinks[0];
    console.log(`   (Obras selecionadas: 1ª = ${firstObra}, 2ª = ${secondObra})`);

    // 3. Clicar numa obra
    console.log(`3. Clicar na 1ª obra (${firstObra})...`);
    const step3 = await measureNavigation(
      page,
      `3. Clicar em Obra (${firstObra})`,
      async () => {
        const obraLink = page.locator(`a[href="${firstObra}"]`).first();
        if (await obraLink.isVisible()) {
          await obraLink.click();
        } else {
          await page.goto(`${BASE_URL}${firstObra}`, { waitUntil: 'domcontentloaded' });
        }
      },
      async () => {
        await page.waitForURL(`**${firstObra}**`, { timeout: 20000 });
        await page.waitForSelector('h1', { timeout: 20000 });
      }
    );
    results.push(step3);
    console.log(`   -> Click-to-Render: ${step3.clickToRenderMs}ms | TTFB: ${step3.ttfb}ms | FCP: ${step3.fcp}ms`);

    // 4. Voltar ao catálogo
    console.log('4. Voltar ao Catálogo (/catalogo)...');
    const step4 = await measureNavigation(
      page,
      '4. Voltar ao Catálogo',
      async () => {
        const backOrCatalogo = page.locator('a[href="/catalogo"]').first();
        if (await backOrCatalogo.isVisible()) {
          await backOrCatalogo.click();
        } else {
          await page.goBack();
        }
      },
      async () => {
        await page.waitForURL('**/catalogo**', { timeout: 15000 });
        await page.waitForSelector('a[href^="/obra/"]', { timeout: 20000 });
      }
    );
    results.push(step4);
    console.log(`   -> Click-to-Render: ${step4.clickToRenderMs}ms | TTFB: ${step4.ttfb}ms`);

    // 5. Abrir outra obra
    console.log(`5. Abrir 2ª obra (${secondObra})...`);
    const step5 = await measureNavigation(
      page,
      `5. Abrir 2ª Obra (${secondObra})`,
      async () => {
        const obraLink2 = page.locator(`a[href="${secondObra}"]`).first();
        if (await obraLink2.isVisible()) {
          await obraLink2.click();
        } else {
          await page.goto(`${BASE_URL}${secondObra}`, { waitUntil: 'domcontentloaded' });
        }
      },
      async () => {
        await page.waitForURL(`**${secondObra}**`, { timeout: 20000 });
        await page.waitForSelector('h1', { timeout: 20000 });
      }
    );
    results.push(step5);
    console.log(`   -> Click-to-Render: ${step5.clickToRenderMs}ms | TTFB: ${step5.ttfb}ms`);

    // Descobrir obra com múltiplos capítulos para os passos 6 e 7
    let chapterLinks = await page.locator('a[href^="/ler/"]').evaluateAll((els) =>
      els.map((e) => e.getAttribute('href')).filter((h, i, arr) => arr.indexOf(h) === i)
    );

    if (chapterLinks.length < 2) {
      console.log(`   (Obra atual possui ${chapterLinks.length} capítulos; alternando para ${firstObra} para testar navegação entre capítulos)`);
      await page.goto(`${BASE_URL}${firstObra}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('a[href^="/ler/"]', { timeout: 15000 });
      chapterLinks = await page.locator('a[href^="/ler/"]').evaluateAll((els) =>
        els.map((e) => e.getAttribute('href')).filter((h, i, arr) => arr.indexOf(h) === i)
      );
    }

    // Capítulos são listados em ordem DESC na obra. O último do array é o capítulo inicial para poder avançar
    const firstChapter = chapterLinks.length >= 2 ? chapterLinks[chapterLinks.length - 1] : chapterLinks[0];
    const expectedNextChapter = chapterLinks.length >= 2 ? chapterLinks[chapterLinks.length - 2] : null;
    console.log(`   (Capítulos encontrados: ${chapterLinks.length}. Capítulo de teste = ${firstChapter}, Próximo = ${expectedNextChapter})`);

    // 6. Entrar em um capítulo
    if (firstChapter) {
      console.log(`6. Entrar em um capítulo (${firstChapter})...`);
      const step6 = await measureNavigation(
        page,
        `6. Entrar em Capítulo (${firstChapter})`,
        async () => {
          const chapLink = page.locator(`a[href="${firstChapter}"]`).first();
          if (await chapLink.isVisible()) {
            await chapLink.click();
          } else {
            await page.goto(`${BASE_URL}${firstChapter}`, { waitUntil: 'domcontentloaded' });
          }
        },
        async () => {
          await page.waitForURL(`**${firstChapter}**`, { timeout: 25000 });
          await page.waitForSelector('img, .reader-container, .page-image, [data-reader]', { timeout: 25000 });
        }
      );
      results.push(step6);
      console.log(`   -> Click-to-Render: ${step6.clickToRenderMs}ms | TTFB: ${step6.ttfb}ms`);

      // 7. Navegar entre capítulos
      console.log('7. Navegar entre capítulos...');
      const nextBtnSelector = expectedNextChapter ? `a[href="${expectedNextChapter}"]` : 'a.btn-nav-next, a.hero-next';
      const step7 = await measureNavigation(
        page,
        `7. Próximo Capítulo (${expectedNextChapter || 'next'})`,
        async () => {
          const nextBtn = page.locator(nextBtnSelector).first();
          const count = await nextBtn.count();
          if (count > 0) {
            await nextBtn.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
            await nextBtn.click({ force: true });
          } else if (expectedNextChapter) {
            await page.keyboard.press('ArrowRight');
          }
        },
        async () => {
          if (expectedNextChapter) {
            await page.waitForURL(`**${expectedNextChapter}**`, { timeout: 25000 });
          }
          await page.waitForSelector('img, .reader-container, .page-image, [data-reader]', { timeout: 25000 });
        }
      );
      results.push(step7);
      console.log(`   -> Click-to-Render: ${step7.clickToRenderMs}ms | TTFB: ${step7.ttfb}ms`);
    } else {
      console.log('   (Nenhum capítulo disponível para teste)');
      results.push({
        action: '6. Entrar em Capítulo',
        clickToRenderMs: 'N/A',
        ttfb: 'N/A',
        fcp: 'N/A',
        lcp: 'N/A',
        requestsCount: 0,
        transferKb: 0
      });
      results.push({
        action: '7. Próximo Capítulo',
        clickToRenderMs: 'N/A',
        ttfb: 'N/A',
        fcp: 'N/A',
        lcp: 'N/A',
        requestsCount: 0,
        transferKb: 0
      });
    }

    // 8. Realizar pesquisas
    console.log('8. Realizar Pesquisas (/catalogo?q=Solo)...');
    const step8 = await measureNavigation(
      page,
      '8. Pesquisa Catálogo (?q=Solo)',
      async () => {
        await page.goto(`${BASE_URL}/catalogo?q=Solo`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      },
      async () => {
        await page.waitForSelector('main', { timeout: 15000 });
      }
    );
    results.push(step8);
    console.log(`   -> Click-to-Render: ${step8.clickToRenderMs}ms | TTFB: ${step8.ttfb}ms`);

    // 9. Navegar por Lançamentos
    console.log('9. Navegar por Lançamentos (/lancamentos)...');
    const step9 = await measureNavigation(
      page,
      '9. Lançamentos (/lancamentos)',
      async () => {
        const lancLink = page.locator('a[href="/lancamentos"]').first();
        if (await lancLink.isVisible()) {
          await lancLink.click();
        } else {
          await page.goto(`${BASE_URL}/lancamentos`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        }
      },
      async () => {
        await page.waitForURL('**/lancamentos**', { timeout: 20000 });
        await page.waitForSelector('main', { timeout: 15000 });
      }
    );
    results.push(step9);
    console.log(`   -> Click-to-Render: ${step9.clickToRenderMs}ms | TTFB: ${step9.ttfb}ms`);
  } catch (err) {
    console.error('Erro durante a jornada:', err);
  } finally {
    await browser.close();
  }

  console.log('\n======================================================');
  console.log(`TABELA DE RESULTADOS: ${label}`);
  console.log('======================================================');
  console.table(
    results.map((r) => ({
      Passo: r.action,
      'Tempo de Espera (ms)': r.clickToRenderMs,
      'TTFB (ms)': r.ttfb,
      'FCP (ms)': r.fcp,
      'LCP (ms)': r.lcp,
      Requests: r.requestsCount,
      'Transfer (KB)': r.transferKb
    }))
  );

  return results;
}

runBenchmark('BASELINE (ANTES)').catch(console.error);
