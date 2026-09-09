import { createClient } from '@supabase/supabase-js';

try {
  process.loadEnvFile('.env');
} catch {
  // Ignore if .env is not present; process.env might already be set.
}

const isApply = process.argv.includes('--apply');
const isDryRun = !isApply || process.argv.includes('--dry-run');

console.log(`[XP Reconcile] Mode: ${isApply ? 'APPLY (Making Changes)' : 'DRY-RUN (Audit Only)'}`);

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function main() {
  // 1. Fetch completed reading entries
  console.log('[XP Reconcile] Fetching completed reading entries from public.reading...');
  const { data: readings, error: readErr } = await supabase
    .from('reading')
    .select('user_id, chapter_id, completed_at, updated_at')
    .not('completed_at', 'is', null);

  if (readErr) {
    console.error('Failed to fetch reading table:', readErr);
    process.exit(1);
  }

  console.log(`[XP Reconcile] Found ${readings?.length ?? 0} completed reading entries.`);

  // 2. Fetch existing xp_awards
  console.log('[XP Reconcile] Fetching existing xp_awards...');
  const { data: existingAwards, error: awardErr } = await supabase
    .from('xp_awards')
    .select('id, user_id, chapter_id, amount');

  if (awardErr) {
    console.error('Failed to fetch xp_awards:', awardErr);
    process.exit(1);
  }

  const existingAwardKeys = new Set(
    (existingAwards ?? []).map((a) => `${a.user_id}:${a.chapter_id}`)
  );

  console.log(`[XP Reconcile] Found ${existingAwards?.length ?? 0} existing awards.`);

  // 3. Identify missing awards
  const missingAwards = [];
  for (const r of readings ?? []) {
    const key = `${r.user_id}:${r.chapter_id}`;
    if (!existingAwardKeys.has(key)) {
      missingAwards.push({
        user_id: r.user_id,
        chapter_id: r.chapter_id,
        amount: 25,
        reason: 'chapter_completion',
        created_at: r.completed_at || r.updated_at || new Date().toISOString()
      });
      existingAwardKeys.add(key); // Prevent duplicate entries within same batch
    }
  }

  console.log(`[XP Reconcile] Missing awards to insert: ${missingAwards.length}`);

  if (isApply && missingAwards.length > 0) {
    console.log('[XP Reconcile] Inserting missing awards in batches of 100...');
    for (let i = 0; i < missingAwards.length; i += 100) {
      const batch = missingAwards.slice(i, i + 100);
      const { error: insertErr } = await supabase.from('xp_awards').insert(batch);
      if (insertErr) {
        console.error(`Failed to insert batch ${i}..${i + batch.length}:`, insertErr);
        process.exit(1);
      }
    }
    console.log('[XP Reconcile] All missing awards inserted successfully.');
  }

  // 4. Recalculate members.xp
  console.log('[XP Reconcile] Calculating ledger totals per member...');
  let allAwards = [...(existingAwards ?? [])];
  if (!isApply) {
    allAwards = [...allAwards, ...missingAwards];
  } else {
    const { data: refreshedAwards } = await supabase.from('xp_awards').select('user_id, amount');
    allAwards = refreshedAwards ?? allAwards;
  }

  const totalsByUser = new Map();
  for (const award of allAwards) {
    const current = totalsByUser.get(award.user_id) || 0;
    totalsByUser.set(award.user_id, current + award.amount);
  }

  const { data: members, error: memErr } = await supabase
    .from('members')
    .select('id, username, xp, is_test');

  if (memErr) {
    console.error('Failed to fetch members:', memErr);
    process.exit(1);
  }

  console.log(`\n========================================`);
  console.log(`XP RECONCILIATION AUDIT`);
  console.log(`========================================`);
  let discrepancies = 0;

  for (const member of members ?? []) {
    const ledgerTotal = totalsByUser.get(member.id) || 0;
    const currentXp = member.xp || 0;
    if (ledgerTotal !== currentXp) {
      discrepancies++;
      console.log(
        `User ${member.username || member.id} (Test: ${member.is_test}): Current XP = ${currentXp} -> Ledger Total = ${ledgerTotal} (Diff: ${ledgerTotal - currentXp > 0 ? '+' : ''}${ledgerTotal - currentXp})`
      );

      if (isApply) {
        const { error: updateErr } = await supabase
          .from('members')
          .update({ xp: ledgerTotal })
          .eq('id', member.id);
        if (updateErr) {
          console.error(`Failed to update member ${member.id}:`, updateErr);
        } else {
          console.log(`  ✓ Updated ${member.username || member.id} to ${ledgerTotal} XP.`);
        }
      }
    }
  }

  console.log(`========================================`);
  console.log(`Summary:`);
  console.log(`- Missing awards found: ${missingAwards.length}`);
  console.log(`- Members with discrepancies: ${discrepancies}`);
  console.log(`- Mode: ${isApply ? 'APPLIED' : 'DRY-RUN (Run with --apply to commit)'}`);
  console.log(`========================================\n`);
}

main().catch((err) => {
  console.error('Fatal error in reconcile-xp:', err);
  process.exit(1);
});
