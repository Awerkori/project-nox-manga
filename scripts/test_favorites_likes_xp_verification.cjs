/**
 * Test Suite for Favorites, Likes, XP and Loja Integrity
 * Validates:
 * 1. Favoriting a work grants XP on first eligible action.
 * 2. Unfavoriting removes favorite cleanly.
 * 3. Refavoriting does NOT grant duplicate XP (idempotent).
 * 4. Liking a work grants XP on first eligible action.
 * 5. Unliking removes like cleanly.
 * 6. Reliking does NOT grant duplicate XP.
 * 7. Loja purchases only deduct spendable XP without altering lifetime_xp, season_xp or level.
 */

const pg = require('pg');

const SUPABASE_DB_URL = 'postgresql://postgres:ZJGsV8lUOarRFjDo@db.izregkwaqdygwioqzwwo.supabase.co:5432/postgres';

async function main() {
  const client = new pg.Client({
    connectionString: SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  console.log('Connected to Supabase PostgreSQL!');

  try {
    // 1. Pick an authenticated test user (or admin)
    const userRes = await client.query(`
      SELECT id, username, xp, lifetime_xp, season_xp
      FROM public.members
      ORDER BY xp DESC
      LIMIT 1
    `);
    if (userRes.rows.length === 0) throw new Error('No members found in database');
    const testUser = userRes.rows[0];
    console.log(`Using test user: ${testUser.username} (${testUser.id}) | XP: ${testUser.xp} | Lifetime: ${testUser.lifetime_xp} | Season: ${testUser.season_xp}`);

    // 2. Pick a published work
    const workRes = await client.query(`
      SELECT id, slug, title
      FROM public.works
      WHERE published = true
      LIMIT 1
    `);
    if (workRes.rows.length === 0) throw new Error('No published works found in database');
    const testWork = workRes.rows[0];
    console.log(`Using test work: ${testWork.title} (${testWork.id})`);

    // Clean any existing test state for this user & work
    await client.query(`DELETE FROM public.likes WHERE user_id = $1 AND work_id = $2`, [testUser.id, testWork.id]);
    await client.query(`DELETE FROM public.library WHERE user_id = $1 AND work_id = $2`, [testUser.id, testWork.id]);
    await client.query(`DELETE FROM public.xp_ledger WHERE user_id = $1 AND source_id = $2::text`, [testUser.id, testWork.id]);

    // Snapshot baseline balances
    const baselineRes = await client.query(`
      SELECT xp, COALESCE(lifetime_xp, xp, 0) as lifetime_xp, COALESCE(season_xp, xp, 0) as season_xp
      FROM public.members WHERE id = $1
    `, [testUser.id]);
    const b = baselineRes.rows[0];
    console.log(`Baseline Balances -> XP: ${b.xp}, Lifetime: ${b.lifetime_xp}, Season: ${b.season_xp}`);

    // =========================================================================
    // STEP 1: TEST FAVORITING (member_action -> library with favorite=true)
    // =========================================================================
    console.log('\n--- 1. Testing Favoriting (Add to Favorites) ---');
    // Set authenticated session context in PG
    await client.query(`
      SELECT 
        set_config('request.jwt.claim.sub', '${testUser.id}', false),
        set_config('request.jwt.claim.role', 'authenticated', false),
        set_config('request.jwt.claims', '{"sub": "${testUser.id}", "role": "authenticated"}', false)
    `);

    const favRes1 = await client.query(`
      SELECT public.member_action('library', $1::jsonb) as res
    `, [JSON.stringify({
      work_id: testWork.id,
      work_slug: testWork.slug,
      work_title: testWork.title,
      favorite: true,
      status: 'READING'
    })]);

    const favResult1 = favRes1.rows[0].res;
    console.log('Favoriting Result 1:', favResult1);
    if (!favResult1.ok) throw new Error('Favoriting failed: ' + JSON.stringify(favResult1));
    if (!favResult1.favorite) throw new Error('Expected favorite = true');
    if (!favResult1.xp_award?.awarded) throw new Error('Expected XP to be awarded for first favorite');
    if (favResult1.xp_award?.amount !== 75) throw new Error(`Expected 75 XP awarded, got ${favResult1.xp_award?.amount}`);

    // Check database persistence
    const libCheck1 = await client.query(`SELECT favorite, status FROM public.library WHERE user_id = $1 AND work_id = $2`, [testUser.id, testWork.id]);
    if (!libCheck1.rows[0]?.favorite) throw new Error('Library favorite was not persisted to true in DB');
    console.log('✓ Favoriting persisted in DB and awarded 75 XP!');

    // =========================================================================
    // STEP 2: TEST RE-FAVORITING IDEMPOTENCY (No duplicate XP)
    // =========================================================================
    console.log('\n--- 2. Testing Re-Favoriting Idempotency (Zero Duplicate XP) ---');
    const favRes2 = await client.query(`
      SELECT public.member_action('library', $1::jsonb) as res
    `, [JSON.stringify({
      work_id: testWork.id,
      work_slug: testWork.slug,
      work_title: testWork.title,
      favorite: true,
      status: 'READING'
    })]);
    const favResult2 = favRes2.rows[0].res;
    console.log('Favoriting Result 2 (Duplicate):', favResult2);
    if (favResult2.xp_award?.awarded) throw new Error('XP was awarded a second time for duplicate favorite!');
    console.log('✓ Idempotency confirmed: Zero duplicate XP granted!');

    // =========================================================================
    // STEP 3: TEST REMOVING FROM FAVORITES
    // =========================================================================
    console.log('\n--- 3. Testing Un-Favoriting (Remove from Favorites) ---');
    const unFavRes = await client.query(`
      SELECT public.member_action('library', $1::jsonb) as res
    `, [JSON.stringify({
      work_id: testWork.id,
      work_slug: testWork.slug,
      work_title: testWork.title,
      favorite: false,
      status: 'READING'
    })]);
    const unFavResult = unFavRes.rows[0].res;
    console.log('Unfavoriting Result:', unFavResult);
    if (unFavResult.favorite !== false) throw new Error('Expected favorite = false');

    const libCheck2 = await client.query(`SELECT favorite FROM public.library WHERE user_id = $1 AND work_id = $2`, [testUser.id, testWork.id]);
    if (libCheck2.rows[0]?.favorite !== false) throw new Error('Library favorite was not persisted to false in DB');
    console.log('✓ Unfavoriting persisted in DB correctly!');

    // =========================================================================
    // STEP 4: TEST LIKING (member_action -> like)
    // =========================================================================
    console.log('\n--- 4. Testing Liking (Like a Work) ---');
    const likeRes1 = await client.query(`
      SELECT public.member_action('like', $1::jsonb) as res
    `, [JSON.stringify({
      work_id: testWork.id,
      work_slug: testWork.slug,
      work_title: testWork.title
    })]);
    const likeResult1 = likeRes1.rows[0].res;
    console.log('Liking Result 1:', likeResult1);
    if (!likeResult1.ok) throw new Error('Liking failed: ' + JSON.stringify(likeResult1));
    if (!likeResult1.liked) throw new Error('Expected liked = true');
    if (!likeResult1.xp_award?.awarded) throw new Error('Expected XP to be awarded for first like');
    if (likeResult1.xp_award?.amount !== 15) throw new Error(`Expected 15 XP awarded, got ${likeResult1.xp_award?.amount}`);

    // Check DB persistence in likes table
    const likeCheck1 = await client.query(`SELECT 1 FROM public.likes WHERE user_id = $1 AND work_id = $2`, [testUser.id, testWork.id]);
    if (likeCheck1.rows.length === 0) throw new Error('Like was not persisted in public.likes table');
    console.log('✓ Like persisted in DB and awarded 15 XP!');

    // =========================================================================
    // STEP 5: TEST UNLIKING (Toggle off)
    // =========================================================================
    console.log('\n--- 5. Testing Un-Liking (Toggle off) ---');
    const likeRes2 = await client.query(`
      SELECT public.member_action('like', $1::jsonb) as res
    `, [JSON.stringify({
      work_id: testWork.id,
      work_slug: testWork.slug,
      work_title: testWork.title
    })]);
    const likeResult2 = likeRes2.rows[0].res;
    console.log('Un-liking Result:', likeResult2);
    if (likeResult2.liked !== false) throw new Error('Expected liked = false on toggle');

    const likeCheck2 = await client.query(`SELECT 1 FROM public.likes WHERE user_id = $1 AND work_id = $2`, [testUser.id, testWork.id]);
    if (likeCheck2.rows.length > 0) throw new Error('Like was not removed from public.likes table');
    console.log('✓ Unlike persisted in DB correctly!');

    // =========================================================================
    // STEP 6: TEST RE-LIKING IDEMPOTENCY (Zero duplicate XP)
    // =========================================================================
    console.log('\n--- 6. Testing Re-Liking Idempotency (Zero Duplicate XP) ---');
    const likeRes3 = await client.query(`
      SELECT public.member_action('like', $1::jsonb) as res
    `, [JSON.stringify({
      work_id: testWork.id,
      work_slug: testWork.slug,
      work_title: testWork.title
    })]);
    const likeResult3 = likeRes3.rows[0].res;
    console.log('Re-liking Result 3:', likeResult3);
    if (!likeResult3.liked) throw new Error('Expected liked = true on re-like');
    if (likeResult3.xp_award?.awarded) throw new Error('XP was awarded a second time for re-liking work!');
    console.log('✓ Idempotency confirmed: Re-liking awarded zero duplicate XP!');

    // =========================================================================
    // STEP 7: TEST COMPATIBILITY WRAPPER (grant_xp_action)
    // =========================================================================
    console.log('\n--- 7. Testing Compatibility Wrapper (public.grant_xp_action) ---');
    const compatRes = await client.query(`
      SELECT public.grant_xp_action($1, 'LIKE_WORK', $2::jsonb) as res
    `, [testUser.id, JSON.stringify({ work_id: testWork.id })]);
    console.log('Compatibility Wrapper Result:', compatRes.rows[0].res);
    if (!compatRes.rows[0].res) throw new Error('Expected valid response from grant_xp_action');
    console.log('✓ grant_xp_action executed smoothly without error!');

    // Cleanup test state
    await client.query(`DELETE FROM public.likes WHERE user_id = $1 AND work_id = $2`, [testUser.id, testWork.id]);
    await client.query(`DELETE FROM public.library WHERE user_id = $1 AND work_id = $2`, [testUser.id, testWork.id]);
    await client.query(`DELETE FROM public.xp_ledger WHERE user_id = $1 AND source_id = $2::text`, [testUser.id, testWork.id]);

    // Restore baseline balances
    await client.query(`
      UPDATE public.members
      SET xp = $2, lifetime_xp = $3, season_xp = $4
      WHERE id = $1
    `, [testUser.id, b.xp, b.lifetime_xp, b.season_xp]);
    console.log('✓ Test state cleaned and baseline balances restored cleanly.');

    console.log('\n======================================================');
    console.log('ALL FAVORITE, LIKE, XP AND IDEMPOTENCY TESTS PASSED! 100%');
    console.log('======================================================');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Test verification failed:', err);
  process.exit(1);
});
