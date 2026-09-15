import { chromium } from '@playwright/test';

const BASE_URL = 'https://manga.project-nox-awerkori.workers.dev';

async function main() {
  console.log('==================================================');
  console.log('PROJECT NOX — REAL V8 JS HEAP & DOM MEMORY SOAK');
  console.log('==================================================');

  const browser = await chromium.launch({
    headless: true,
    args: ['--js-flags=--expose-gc', '--enable-precise-memory-info']
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  // Connect CDP session for real V8 metrics
  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable');

  async function getV8Metrics() {
    const res = await cdp.send('Performance.getMetrics');
    const metricMap = {};
    for (const m of res.metrics) {
      metricMap[m.name] = m.value;
    }
    return {
      jsHeapUsedMb: (metricMap['JSHeapUsedSize'] || 0) / (1024 * 1024),
      jsHeapTotalMb: (metricMap['JSHeapTotalSize'] || 0) / (1024 * 1024),
      domNodes: metricMap['Nodes'] || 0,
      documents: metricMap['Documents'] || 0,
      listeners: metricMap['JSEventListeners'] || 0
    };
  }

  // Warmup initial visit
  console.log('Initializing and taking baseline memory snapshot...');
  await page.goto(`${BASE_URL}/`, { waitUntil: 'load' });
  await cdp.send('HeapProfiler.collectGarbage');
  await page.waitForTimeout(500);

  const baseline = await getV8Metrics();
  console.log(`Baseline (Post-GC):`);
  console.log(`  JS Heap Used: ${baseline.jsHeapUsedMb.toFixed(2)} MB (Total: ${baseline.jsHeapTotalMb.toFixed(2)} MB)`);
  console.log(`  DOM Nodes: ${baseline.domNodes}, Documents: ${baseline.documents}, Listeners: ${baseline.listeners}`);

  const routes = ['/catalogo', '/loja', '/ranking', '/'];
  let peakHeapUsed = baseline.jsHeapUsedMb;
  const history = [];

  const TOTAL_CYCLES = 10;
  console.log(`\nExecuting ${TOTAL_CYCLES} continuous multi-hop navigation cycles...`);

  for (let cycle = 1; cycle <= TOTAL_CYCLES; cycle++) {
    for (const r of routes) {
      await page.goto(`${BASE_URL}${r}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(100);
    }
    const current = await getV8Metrics();
    if (current.jsHeapUsedMb > peakHeapUsed) {
      peakHeapUsed = current.jsHeapUsedMb;
    }
    history.push({ cycle, ...current });
    if (cycle % 2 === 0 || cycle === TOTAL_CYCLES) {
      console.log(`  Cycle ${cycle}/${TOTAL_CYCLES} -> JS Heap: ${current.jsHeapUsedMb.toFixed(2)} MB | DOM Nodes: ${current.domNodes} | Listeners: ${current.listeners}`);
    }
  }

  // Final GC to measure true retained memory
  console.log('\nForcing GC for true post-soak retained memory measurement...');
  await cdp.send('HeapProfiler.collectGarbage');
  await page.waitForTimeout(500);

  const finalMetrics = await getV8Metrics();
  console.log(`Final (Post-GC):`);
  console.log(`  JS Heap Used: ${finalMetrics.jsHeapUsedMb.toFixed(2)} MB (Total: ${finalMetrics.jsHeapTotalMb.toFixed(2)} MB)`);
  console.log(`  DOM Nodes: ${finalMetrics.domNodes}, Documents: ${finalMetrics.documents}, Listeners: ${finalMetrics.listeners}`);
  console.log(`  Peak JS Heap during soak: ${peakHeapUsed.toFixed(2)} MB`);

  const heapDiff = finalMetrics.jsHeapUsedMb - baseline.jsHeapUsedMb;
  const nodeDiff = finalMetrics.domNodes - baseline.domNodes;
  console.log(`\nDelta Analysis:`);
  console.log(`  Heap Delta (Final - Baseline): ${heapDiff >= 0 ? '+' : ''}${heapDiff.toFixed(2)} MB`);
  console.log(`  DOM Nodes Delta: ${nodeDiff >= 0 ? '+' : ''}${nodeDiff}`);

  const isMemoryStable = Math.abs(heapDiff) < 5.0 && Math.abs(nodeDiff) < 150;
  console.log(`  Verdict: ${isMemoryStable ? 'STABLE' : 'POSSIBLE LEAK'}`);

  await browser.close();
  console.log('==================================================');
}

main().catch(err => {
  console.error('Memory soak error:', err);
  process.exit(1);
});
