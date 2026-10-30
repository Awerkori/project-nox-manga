import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const envLines = fs.readFileSync('.dev.vars.preview_full', 'utf8').split('\n');
const envVars = {};
for (const line of envLines) {
  const idx = line.indexOf('=');
  if (idx !== -1) {
    envVars[line.slice(0, idx).trim()] = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
  }
}

const supabase = createClient(envVars.PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);
const { data, error } = await supabase
  .from('chapters')
  .select('id, number, title, work_id, works(id, title, slug)')
  .not('published_at', 'is', null)
  .order('published_at', { ascending: false })
  .limit(5);

if (error) console.error(error);
else console.log(JSON.stringify(data, null, 2));
