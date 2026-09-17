import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://izregkwaqdygwioqzwwo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6cmVna3dhcWR5Z3dpb3F6d3dvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODU2NTQ5NCwiZXhwIjoyMTA0MTQxNDk0fQ.ChnMmsSg_w4goxLFbDxEUnxOaBDAAMNG4KoO4RlqQHk';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    let res = await supabase.rpc('get_recent_releases', { p_limit: 15 });
    console.log("Supabase get_recent_releases count:", res.data ? res.data.length : 0);

    let works = await supabase.from('works').select('*').eq('published', true).order('latest_chapter_published_at', { ascending: false }).limit(16);
    console.log("Supabase fallback works count:", works.data ? works.data.length : 0);
}
run();
