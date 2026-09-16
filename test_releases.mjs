async function run() {
  const start = Date.now();
  console.log("Fetching Home...");
  try {
    const resHome = await fetch('https://manga.project-nox-awerkori.workers.dev/', { signal: AbortSignal.timeout(10000) });
    const textHome = await resHome.text();
    console.log(`HOME: ${resHome.status} | Time: ${Date.now() - start}ms`);
    if (textHome.includes('Não foi possível carregar os lançamentos agora')) {
      console.log('HOME ERROR MSG DETECTED: "Não foi possível carregar os lançamentos agora"');
    }
  } catch(e) {
    console.log(`HOME: Fetch failed: ${e.message}`);
  }

  const startApi = Date.now();
  console.log("\nFetching /api/releases...");
  try {
    const resApi = await fetch('https://manga.project-nox-awerkori.workers.dev/api/releases', { signal: AbortSignal.timeout(10000) });
    const bodyApi = await resApi.text();
    console.log(`API RELEASES: ${resApi.status} | Time: ${Date.now() - startApi}ms`);
    if (resApi.status !== 200) console.log(`API RELEASES BODY: ${bodyApi.substring(0, 100)}`);
  } catch(e) {
    console.log(`API RELEASES: Fetch failed: ${e.message}`);
  }
}
run();
