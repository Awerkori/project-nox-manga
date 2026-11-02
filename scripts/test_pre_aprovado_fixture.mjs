import { ownerCookies } from './owner-session.mjs';
import { createClient } from '@supabase/supabase-js';

const CHAPTER_85_ID = 'b5a9fbf0-206d-475a-8e05-70aaa672f71e';
const RAW_STAGE_ID = 'b824be67-ef62-4d87-b76f-ba7cea285edc';
const TRAD_STAGE_ID = '01691c51-5d33-4e84-8dd6-d3c1c409ad74';
const CLEAN_STAGE_ID = 'c0a8f087-abe3-4e15-b4ed-1ac84422f80e';
const TYPESET_STAGE_ID = '29eaccb5-a75b-4462-a4ad-eec88b4c5ee3';
const QC_STAGE_ID = '8e75a036-32f9-4864-bb61-8316b581384d';
const PRE_APROVADO_STAGE_ID = '24668cc6-7fba-40af-a3ed-5e66ca90d2a8';
const PUBLICADO_STAGE_ID = '92b620b2-2171-4292-b993-7e903e69c2cf';

const PREVIOUS_STAGE_IDS = [
  RAW_STAGE_ID,
  TRAD_STAGE_ID,
  CLEAN_STAGE_ID,
  TYPESET_STAGE_ID,
  QC_STAGE_ID
];

const targetUrl = process.env.BENCHMARK_TARGET_URL || 'https://home-preview-manga.project-nox-awerkori.workers.dev';

async function main() {
  const mode = process.argv[2] || 'status';
  const client = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (mode === 'set-ready') {
    console.log('Seeding Chapter 85 as READY / AVAILABLE in Pré-aprovado...');
    await client.from('scan_production_chapters').update({
      status: 'IN_PRODUCTION',
      current_stage_slug: 'pre_aprovado',
      target_chapter_id: null,
      updated_at: new Date().toISOString()
    }).eq('id', CHAPTER_85_ID);

    // Set all previous editorial stages to DONE so the history is 100% coherent
    for (const stId of PREVIOUS_STAGE_IDS) {
      await client.from('scan_chapter_stages').update({
        status: 'DONE',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }).eq('production_chapter_id', CHAPTER_85_ID).eq('stage_id', stId);
    }

    await client.from('scan_chapter_stages').update({
      status: 'AVAILABLE',
      assigned_to: null,
      claimed_at: null,
      availability_version: 1,
      availability_reason: 'qc_completed',
      updated_at: new Date().toISOString()
    }).eq('production_chapter_id', CHAPTER_85_ID).eq('stage_id', PRE_APROVADO_STAGE_ID);

    await client.from('scan_chapter_stages').update({
      status: 'BLOCKED',
      updated_at: new Date().toISOString()
    }).eq('production_chapter_id', CHAPTER_85_ID).eq('stage_id', PUBLICADO_STAGE_ID);

    console.log('✓ Supabase: Chapter 85 is now AVAILABLE in Pré-aprovado with previous stages DONE.');
  } else if (mode === 'set-empty') {
    console.log('Resetting Chapter 85 to PUBLISHED (Empty Pré-aprovado queue)...');
    await client.from('scan_production_chapters').update({
      status: 'PUBLISHED',
      updated_at: new Date().toISOString()
    }).eq('id', CHAPTER_85_ID);

    await client.from('scan_chapter_stages').update({
      status: 'BLOCKED',
      assigned_to: null,
      updated_at: new Date().toISOString()
    }).eq('production_chapter_id', CHAPTER_85_ID).eq('stage_id', PRE_APROVADO_STAGE_ID);

    console.log('✓ Supabase: Chapter 85 is now PUBLISHED. Pré-aprovado queue is empty.');
  }

  // Also invoke preview worker to update Yugabyte via Hyperdrive
  try {
    const cookies = await ownerCookies(targetUrl);
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    const formData = new FormData();
    formData.append('mode', mode);

    const res = await fetch(`${targetUrl}/scan?/setPreAprovadoFixture`, {
      method: 'POST',
      headers: {
        cookie: cookieHeader,
        'x-sveltekit-action': 'true',
        origin: targetUrl,
        referer: `${targetUrl}/scan`
      },
      body: formData
    });

    if (res.ok) {
      console.log(`✓ Preview Worker (Yugabyte): executed setPreAprovadoFixture (${mode})`);
    } else {
      console.warn(`Preview worker returned status ${res.status}`);
    }
  } catch (err) {
    console.warn('Could not call preview worker setPreAprovadoFixture:', err.message);
  }

  // Check current status in Supabase
  const { data: ch } = await client.from('scan_production_chapters').select('id, chapter_number, status, current_stage_slug').eq('id', CHAPTER_85_ID).single();
  const { data: stages } = await client.from('scan_chapter_stages').select('stage_id, status, assigned_to').eq('production_chapter_id', CHAPTER_85_ID);
  const qc = stages?.find(s => s.stage_id === QC_STAGE_ID);
  const pre = stages?.find(s => s.stage_id === PRE_APROVADO_STAGE_ID);
  const pub = stages?.find(s => s.stage_id === PUBLICADO_STAGE_ID);

  console.log(`Current Supabase State: Chapter ${ch?.chapter_number} status=${ch?.status}, QC=${qc?.status}, PreAprovado=${pre?.status} (assigned_to=${pre?.assigned_to}), Publicado=${pub?.status}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
