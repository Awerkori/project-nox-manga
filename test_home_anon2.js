import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://izregkwaqdygwioqzwwo.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6cmVna3dhcWR5Z3dpb3F6d3dvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1NjU0OTQsImV4cCI6MjEwNDE0MTQ5NH0.11p3Vh_dd0ynrH1qyZVKDNr9x7AFfoHVQW96MDPgNrQ');
async function run() {
    let res = await supabase.rpc('get_recent_releases', { p_limit: 15 });
    console.log("Supabase ANON get_recent_releases count:", res.data ? res.data.length : 0);
    if (res.error) console.error(res.error);
}
run();
