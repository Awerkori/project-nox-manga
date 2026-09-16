import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.PUBLIC_SUPABASE_ANON_KEY);

async function runTests() {
  console.log("Running Anon query...");
  let start = Date.now();
  let res = await supabase.from('works').select('*').limit(20);
  console.log(`Anon fetch: ${Date.now() - start}ms | Count: ${res.data?.length}`);
}
runTests();
