import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://izregkwaqdygwioqzwwo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6cmVna3dhcWR5Z3dpb3F6d3dvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1NjU0OTQsImV4cCI6MjEwNDE0MTQ5NH0.f6wO3hJ1i-29s9E27i1tV3N303oJ0C-dM2r-Uv8O7Q8';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    let res = await supabase.rpc('get_recent_releases', { p_limit: 15 });
    console.log("Supabase ANON get_recent_releases count:", res.data ? res.data.length : 0);
    if (res.error) console.error(res.error);
}
run();
