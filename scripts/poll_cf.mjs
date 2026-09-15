async function run() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch('https://manga.project-nox-awerkori.workers.dev', {
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
      });
      const html = await res.text();
      const hasApiReleases = html.includes('/api/releases');
      const hasSpin = html.includes('spin 1s linear infinite');
      
      console.log(`[${new Date().toISOString()}] Try ${i+1}: /api/releases=${hasApiReleases}, .spin=${hasSpin}`);
      
      if (hasApiReleases && hasSpin) {
        console.log("DEPLOYMENT COMPLETED AND ACTIVE IN PRODUCTION!");
        return;
      }
    } catch (e) {
      console.error(e.message);
    }
    await new Promise(r => setTimeout(r, 10000));
  }
  console.log("Timeout waiting for deployment.");
}
run();
