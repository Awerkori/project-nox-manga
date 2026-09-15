async function run() {
  try {
    const res = await fetch('https://manga.project-nox-awerkori.workers.dev', {
      headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
    });
    const html = await res.text();
    const hasApiReleases = html.includes('/api/releases');
    const hasSpin = html.includes('spin 1s linear infinite');
    
    console.log(`[${new Date().toISOString()}] /api/releases=${hasApiReleases}, .spin=${hasSpin}`);
    
    if (hasApiReleases && hasSpin) {
      console.log("DEPLOYMENT COMPLETED AND ACTIVE IN PRODUCTION!");
      
      const t0 = performance.now();
      const apiRes = await fetch('https://manga.project-nox-awerkori.workers.dev/api/releases?limit=16');
      const apiData = await apiRes.json();
      const t1 = performance.now();
      
      console.log(`API response time: ${(t1 - t0).toFixed(2)}ms`);
      console.log(`API returned ${apiData.releases ? apiData.releases.length : 0} works.`);
      if (apiData.releases && apiData.releases.length > 0) {
        console.log(`First work: ${apiData.releases[0].workTitle}`);
        console.log(`First chapter count: ${apiData.releases[0].chapters.length}`);
      }
    }
  } catch (e) {
    console.error(e.message);
  }
}
run();
