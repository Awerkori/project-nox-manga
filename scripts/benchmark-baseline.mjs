import { ownerCookies } from './owner-session.mjs';

const PROD_URL = 'https://manga.project-nox-awerkori.workers.dev';

async function measureRoute(path, cookieHeader = '', samples = 5) {
  const times = [];
  let ttfbSum = 0;
  let status = 0;

  for (let i = 0; i < samples; i++) {
    const start = performance.now();
    let ttfb = 0;
    try {
      const res = await fetch(PROD_URL + path, {
        headers: cookieHeader ? { Cookie: cookieHeader } : {},
        signal: AbortSignal.timeout(15000)
      });
      status = res.status;
      // Read stream to get TTFB vs full body
      const reader = res.body?.getReader();
      if (reader) {
        await reader.read();
        ttfb = performance.now() - start;
        while (!(await reader.read()).done) {}
      }
      const total = performance.now() - start;
      times.push(total);
      ttfbSum += ttfb || total;
    } catch (err) {
      times.push(15000);
      ttfbSum += 15000;
    }
    // brief delay between samples
    await new Promise((r) => setTimeout(r, 100));
  }

  times.sort((a, b) => a - b);
  const p50 = times[Math.floor(times.length * 0.5)];
  const p95 = times[Math.floor(times.length * 0.9)];
  const avgTtfb = Math.round(ttfbSum / samples);

  return {
    path,
    status,
    avgTtfb,
    p50: Math.round(p50),
    p95: Math.round(p95)
  };
}

async function runBenchmark() {
  console.log('==============================================');
  console.log('BENCHMARK BASELINE (PROD)');
  console.log('==============================================');

  const cookies = await ownerCookies(PROD_URL);
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

  const routes = [
    '/',
    '/catalogo',
    '/ranking',
    '/scans',
    '/obra/distant-sky',
    '/ler/ch-ds-62',
    '/me',
    '/admin'
  ];

  console.log('\n--- HOME (/) BENCHMARK (10 COLD, 20 WARM) ---');
  const homeCold = await measureRoute('/', '', 10);
  console.log(`HOME (ANON 10 SAMPLES)       | Status: ${homeCold.status} | TTFB: ${homeCold.avgTtfb}ms | p50: ${homeCold.p50}ms | p95: ${homeCold.p95}ms`);
  const homeAuth = await measureRoute('/', cookieHeader, 20);
  console.log(`HOME (AUTH 20 SAMPLES)       | Status: ${homeAuth.status} | TTFB: ${homeAuth.avgTtfb}ms | p50: ${homeAuth.p50}ms | p95: ${homeAuth.p95}ms`);

  console.log('\n--- ANONYMOUS USERS ---');
  for (const r of routes.slice(0, 6)) {
    const res = await measureRoute(r, '', 3);
    console.log(`${res.path.padEnd(30)} | Status: ${res.status} | TTFB: ${res.avgTtfb}ms | p50: ${res.p50}ms | p95: ${res.p95}ms`);
  }

  console.log('\n--- AUTHENTICATED USERS ---');
  for (const r of routes) {
    const res = await measureRoute(r, cookieHeader, 3);
    console.log(`${res.path.padEnd(30)} | Status: ${res.status} | TTFB: ${res.avgTtfb}ms | p50: ${res.p50}ms | p95: ${res.p95}ms`);
  }
}

runBenchmark().catch(console.error);
