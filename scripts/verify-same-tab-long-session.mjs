import { chromium } from 'playwright';
import { userCookiesByEmail } from './user-session.mjs';

const PROD_URL = 'https://manga.project-nox-awerkori.workers.dev';
const NUM_CYCLES = 20;

async function getMetrics(cdp, page) {
  const { metrics } = await cdp.send('Performance.getMetrics');
  const getVal = name => metrics.find(m => m.name === name)?.value || 0;

  const inPage = await page.evaluate(() => {
    return {
      domNodes: document.querySelectorAll('*').length,
      heapUsedMb: window.performance?.memory?.usedJSHeapSize ? Math.round(window.performance.memory.usedJSHeapSize / 1024 / 1024 * 100) / 100 : null
    };
  }).catch(() => ({ domNodes: 0, heapUsedMb: null }));

  return {
    jsHeapUsedMb: Math.round(getVal('JSHeapUsedSize') / 1024 / 1024 * 100) / 100,
    jsHeapTotalMb: Math.round(getVal('JSHeapTotalSize') / 1024 / 1024 * 100) / 100,
    nodes: inPage.domNodes,
    listeners: getVal('JSEventListeners') || getVal('Listeners'),
    domNodesInPage: inPage.domNodes
  };
}

async function runSameTabLongSession() {
  console.log('============================================================');
  console.log(`SAME-TAB LONG SESSION SOAK SUITE (${NUM_CYCLES} full client-side cycles)`);
  console.log(`Target: ${PROD_URL}`);
  console.log('============================================================\n');

  const browser = await chromium.launch({
    headless: true,
    args: ['--js-flags=--expose-gc']
  });

  const ageCookie = {
    name: 'nox-age-status',
    value: 'ADULT',
    url: PROD_URL,
    httpOnly: false,
    sameSite: 'Lax',
    secure: PROD_URL.startsWith('https:')
  };
  const authCookies = await userCookiesByEmail('rodccmoreno@hotmail.com', PROD_URL);
  const allCookies = [...authCookies, ageCookie];

  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.addCookies(allCookies);

  // Open ONE single tab
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable');

  let openWebSockets = 0;
  let totalWebSocketsCreated = 0;
  const channelSubMap = new Map();
  let duplicateChannels = 0;

  page.on('websocket', ws => {
    totalWebSocketsCreated++;
    openWebSockets++;
    ws.on('framesent', frame => {
      if (frame.payload && frame.payload.includes('phx_join')) {
        try {
          const parsed = JSON.parse(frame.payload);
          const topic = parsed[3];
          const count = (channelSubMap.get(topic) || 0) + 1;
          channelSubMap.set(topic, count);
          if (count > 1) {
            duplicateChannels++;
            console.error(`  [REALTIME_ALERT] Duplicate subscription to topic: ${topic} (count: ${count})`);
          }
        } catch {}
      }
    });
    ws.on('close', () => {
      openWebSockets--;
    });
  });

  let requestsInFlight = 0;
  page.on('request', () => requestsInFlight++);
  page.on('response', () => requestsInFlight = Math.max(0, requestsInFlight - 1));
  page.on('requestfailed', () => requestsInFlight = Math.max(0, requestsInFlight - 1));

  console.log('Warming up initial session on Home...');
  await page.goto(PROD_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const initialMetrics = await getMetrics(cdp, page);
  console.log(`\n--- INITIAL CHECKPOINT (Cycle 0 Baseline) ---`);
  console.log(`- JS Heap Used: ${initialMetrics.jsHeapUsedMb} MB (Total: ${initialMetrics.jsHeapTotalMb} MB)`);
  console.log(`- DOM Nodes: ${initialMetrics.nodes}`);
  console.log(`- Listeners: ${initialMetrics.listeners}`);
  console.log(`- Open WebSockets: ${openWebSockets} | Duplicates: ${duplicateChannels}`);
  console.log(`- Requests Inflight: ${requestsInFlight}\n`);

  const cycleLatencies = [];
  let midMetrics = null;

  for (let c = 1; c <= NUM_CYCLES; c++) {
    const tCycleStart = Date.now();

    // 1. Home → Catalog (Client-Side Link Click)
    const t0 = Date.now();
    await page.click('a[href="/catalogo"]:visible');
    await page.waitForURL('**/catalogo**', { timeout: 10000 });
    await page.waitForSelector('a[href^="/obra/"]:visible', { timeout: 10000 });
    const latCatalog = Date.now() - t0;

    // 2. Catalog → Work (Client-Side Link Click)
    const t1 = Date.now();
    await page.click('a[href^="/obra/"]:visible');
    await page.waitForURL('**/obra/**', { timeout: 10000 });
    await page.waitForSelector('a.chapter-item:visible', { timeout: 10000 });
    const latWork = Date.now() - t1;

    // 3. Work → Reader (Client-Side Link Click)
    const t2 = Date.now();
    const chapterLink = await page.$('a.chapter-item:visible');
    await chapterLink.click();
    await page.waitForURL('**/ler/**', { timeout: 10000 });
    await page.waitForSelector('.reader-page', { timeout: 10000 });
    const latReader = Date.now() - t2;

    // 4. Reader → Back to Work (Native Browser Back)
    const t3 = Date.now();
    await page.goBack();
    await page.waitForSelector('a.chapter-item:visible', { timeout: 10000 });
    const latBack = Date.now() - t3;

    // 5. Work → Ranking (Client-Side Link Click)
    const t4 = Date.now();
    await page.click('a[href="/ranking"]:visible');
    await page.waitForURL('**/ranking**', { timeout: 10000 });
    await page.waitForSelector('.ranking-title', { timeout: 10000 });
    const latRanking = Date.now() - t4;

    // 6. Ranking → Home (Client-Side Link Click)
    const t5 = Date.now();
    await page.click('a.logo, a[href="/"]:visible');
    await page.waitForURL(PROD_URL + '/', { timeout: 10000 });
    await page.waitForSelector('a[href^="/obra/"]:visible', { timeout: 10000 });
    const latHome = Date.now() - t5;

    const totalCycleMs = Date.now() - tCycleStart;
    cycleLatencies.push({
      cycle: c,
      latCatalog,
      latWork,
      latReader,
      latBack,
      latRanking,
      latHome,
      totalCycleMs
    });

    if (c % 5 === 0 || c === 1 || c === NUM_CYCLES) {
      const curMetrics = await getMetrics(cdp, page);
      console.log(`[Cycle ${c}/${NUM_CYCLES}] Total: ${totalCycleMs}ms | Heap: ${curMetrics.jsHeapUsedMb} MB | Nodes: ${curMetrics.nodes} | Listeners: ${curMetrics.listeners} | Sockets: ${openWebSockets} | Dups: ${duplicateChannels}`);
      if (c === Math.floor(NUM_CYCLES / 2)) {
        midMetrics = curMetrics;
      }
    }
    await page.waitForTimeout(100);
  }

  // Force garbage collection in CDP to measure retained heap
  try {
    await cdp.send('HeapProfiler.collectGarbage');
  } catch {}
  await page.waitForTimeout(500);

  const finalMetrics = await getMetrics(cdp, page);
  console.log(`\n--- FINAL CHECKPOINT (Cycle ${NUM_CYCLES} Same-Tab) ---`);
  console.log(`- JS Heap Used: ${finalMetrics.jsHeapUsedMb} MB (Total: ${finalMetrics.jsHeapTotalMb} MB)`);
  console.log(`- DOM Nodes: ${finalMetrics.nodes}`);
  console.log(`- Listeners: ${finalMetrics.listeners}`);
  console.log(`- Open WebSockets: ${openWebSockets} | Duplicates: ${duplicateChannels}`);
  console.log(`- Requests Inflight: ${requestsInFlight}`);

  // Test Fresh New Tab comparison
  console.log(`\n--- FRESH CLEAN TAB COMPARISON ---`);
  const freshPage = await context.newPage();
  const freshCdp = await context.newCDPSession(freshPage);
  await freshCdp.send('Performance.enable');
  await freshPage.goto(PROD_URL, { waitUntil: 'domcontentloaded' });
  await freshPage.waitForSelector('a[href^="/obra/"]:visible', { timeout: 10000 });
  const freshMetrics = await getMetrics(freshCdp, freshPage);
  console.log(`- Fresh Tab JS Heap Used: ${freshMetrics.jsHeapUsedMb} MB`);
  console.log(`- Fresh Tab DOM Nodes: ${freshMetrics.nodes}`);
  console.log(`- Fresh Tab Listeners: ${freshMetrics.listeners}`);
  await freshPage.close();

  await browser.close();

  // Latency analysis: early (1-5) vs late (16-20)
  const earlyCycles = cycleLatencies.slice(0, 5);
  const lateCycles = cycleLatencies.slice(-5);
  const earlyAvg = Math.round(earlyCycles.reduce((s, c) => s + c.totalCycleMs, 0) / earlyCycles.length);
  const lateAvg = Math.round(lateCycles.reduce((s, c) => s + c.totalCycleMs, 0) / lateCycles.length);
  const slowdownPercent = Math.round(((lateAvg - earlyAvg) / earlyAvg) * 100);

  // Sorting latencies for p50 and p95
  const allLatencies = cycleLatencies.map(c => c.totalCycleMs).sort((a, b) => a - b);
  const p50 = allLatencies[Math.floor(allLatencies.length * 0.50)];
  const p95 = allLatencies[Math.floor(allLatencies.length * 0.95)];

  const isSlowdown = slowdownPercent > 60;
  const isMemoryLeak = finalMetrics.jsHeapUsedMb > 50; // generous threshold for retained SPA heap
  const isListenerLeak = finalMetrics.listeners > (initialMetrics.listeners * 2.5);

  console.log('\n============================================================');
  console.log('SAME-TAB LONG SESSION RESULTS:');
  console.log(`LONG_SESSION: ${!isMemoryLeak && duplicateChannels === 0 && !isSlowdown ? 'PASS' : 'FAIL'}`);
  console.log(`MEMORY_LEAK: ${isMemoryLeak ? 'FOUND' : 'NONE'}`);
  console.log(`REALTIME_DUPLICATION: ${duplicateChannels}`);
  console.log(`LISTENER_LEAK: ${isListenerLeak ? 'FOUND' : '0'}`);
  console.log(`PROGRESSIVE_SLOWDOWN: ${isSlowdown ? 'YES' : 'NO'} (${slowdownPercent > 0 ? '+' : ''}${slowdownPercent}%: early ${earlyAvg}ms -> late ${lateAvg}ms)`);
  console.log(`LATENCY_P50: ${p50}ms | LATENCY_P95: ${p95}ms`);
  console.log('============================================================\n');

  return {
    initialMetrics,
    midMetrics,
    finalMetrics,
    freshMetrics,
    earlyAvg,
    lateAvg,
    p50,
    p95,
    slowdownPercent,
    duplicateChannels,
    isMemoryLeak,
    isSlowdown,
    isListenerLeak
  };
}

runSameTabLongSession().then(res => {
  if (res.isMemoryLeak || res.duplicateChannels > 0 || res.isSlowdown) {
    process.exit(1);
  }
}).catch(err => {
  console.error('Fatal error in Long Session suite:', err);
  process.exit(1);
});
