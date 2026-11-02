import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const envContent = fs.readFileSync('.dev.vars.preview_full', 'utf8');
const env = {};
for (const l of envContent.split('\n')) {
  const match = l.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
}

const supabase = createClient(env.PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function inspect() {
  const { data: buckets } = await supabase.storage.listBuckets();
  console.log('Buckets:', buckets?.map(b => b.name));

  const { data: files } = await supabase.storage.from('scan-artifacts').list('', { limit: 100 });
  console.log('scan-artifacts root items count:', files?.length);
  for (const f of files || []) {
    console.log(` - ${f.name} (${f.metadata?.size || 'unknown'} bytes)`);
  }

  const { data: pages } = await supabase.storage.from('scan-artifacts').list('pages/prod_type_85_v2_1789173310574', { limit: 100 });
  console.log('pages/prod_type_85_v2 items count:', pages?.length);
  if (pages && pages.length > 0) {
    console.log('First 3 pages:', pages.slice(0, 3));
  }

  const { data: prodFiles } = await supabase
    .from('scan_production_files')
    .select('id, file_key, file_name, file_type, byte_size, version, created_at, storage_path')
    .order('created_at', { ascending: false })
    .limit(30);
  console.log('Latest scan_production_files:');
  console.table(prodFiles?.map(f => ({
    id: f.id.slice(0, 8),
    key: f.file_key,
    name: f.file_name,
    type: f.file_type,
    bytes: f.byte_size,
    ver: f.version,
    path: f.storage_path
  })));
}

inspect().catch(console.error);
