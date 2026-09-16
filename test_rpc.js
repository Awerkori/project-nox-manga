import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.PUBLIC_SUPABASE_ANON_KEY);

async function runTests() {
  console.log("Running public_settings RPC...");
  let start = Date.now();
  let res = await supabase.rpc('public_settings');
  console.log(`RPC public_settings: ${Date.now() - start}ms | Count: ${res.data?.length}`);
}
runTests();
