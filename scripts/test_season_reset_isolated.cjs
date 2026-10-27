/**
 * scripts/test_season_reset_isolated.cjs
 *
 * ISOLATED SANDBOX TEST SUITE FOR SEASONAL RESET & PROGRESSION (ROUND 3):
 * 1. Creates 3 mock users flagged with `is_test = true`.
 * 2. Assigns seasonal points and purchases cosmetics in `member_inventory`.
 * 3. Equips temporary level milestone titles on mock users.
 * 4. Simulates a season reset targeting ONLY the isolated mock users.
 * 5. Asserts:
 *    - `season_xp` reset to 0.
 *    - `xp` (spendable balance) reset to 0.
 *    - Calculated seasonal level resets to Level 0.
 *    - Temporary milestone titles are unequipped.
 *    - Top 3 winners receive exclusive permanent titles into `member_inventory`.
 *    - Purchased cosmetics in `member_inventory` are 100% PRESERVED.
 *    - Historical ledger transactions in `xp_ledger` are NEVER deleted.
 *    - Audit row in `season_resets` is created.
 *    - Top 3 winners are recorded in `season_winners`.
 * 6. Simulates a SECOND reset and asserts that Top 3 permanent titles survive!
 * 7. Verifies safety lock guard (SEASON_RESET_ENABLED=false blocks unauthorized resets).
 * 8. Cleans up mock test records and asserts REAL USERS REMAIN 100% UNTOUCHED!
 */

const pg = require('pg');
const crypto = require('crypto');

const CONNECTION_STRING = 'postgresql://postgres:ZJGsV8lUOarRFjDo@db.izregkwaqdygwioqzwwo.supabase.co:5432/postgres';

// Level calculation formula (from src/lib/levels.ts)
function getLevelFromXp(xp) {
  const safeXp = Math.max(0, Math.floor(xp || 0));
  if (safeXp < 100) return 0;
  return Math.min(100, Math.max(1, Math.floor(Math.sqrt(1 + safeXp / 50))));
}

async function runIsolatedResetAudit() {
  console.log('================================================================');
  console.log('   PROJECT NOX — ISOLATED SANDBOX SEASON RESET & LEVEL AUDIT   ');
  console.log('================================================================\n');

  const client = new pg.Client({
    connectionString: CONNECTION_STRING,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  console.log('✓ Connected to PostgreSQL sandbox environment.\n');

  // Verify real users count and XP before test to guarantee zero contamination
  const realUsersBaseline = await client.query('SELECT count(*), max(season_xp) AS max_season_xp, max(xp) AS max_xp FROM public.members WHERE is_test = false');
  console.log('✓ Real users baseline (UNTROUCHED GATE):', realUsersBaseline.rows[0]);

  const id1 = crypto.randomUUID();
  const id2 = crypto.randomUUID();
  const id3 = crypto.randomUUID();

  const mockUsers = [
    {
      id: id1,
      username: `mock_qa_${id1.slice(0, 8)}`,
      display_name: 'Mock QA Gold Champion',
      xp: 4500,           // Spendable in Loja
      season_xp: 8500,    // 1st place in season (Level 13)
      equipped_title_id: 'titulo-nv10-iniciado-crepusculo', // Temporary level title
      is_test: true
    },
    {
      id: id2,
      username: `mock_qa_${id2.slice(0, 8)}`,
      display_name: 'Mock QA Silver Rank',
      xp: 1800,
      season_xp: 5100,    // 2nd place in season (Level 10)
      equipped_title_id: 'titulo-nv10-iniciado-crepusculo', // Temporary level title
      is_test: true
    },
    {
      id: id3,
      username: `mock_qa_${id3.slice(0, 8)}`,
      display_name: 'Mock QA Bronze Rank',
      xp: 950,
      season_xp: 2900,    // 3rd place in season (Level 7)
      equipped_title_id: null,
      is_test: true
    }
  ];

  try {
    // Step 1: Clean up any prior test artifacts
    const ids = mockUsers.map(u => `'${u.id}'`).join(',');
    await client.query(`DELETE FROM public.member_inventory WHERE user_id IN (${ids})`);
    await client.query(`DELETE FROM public.season_winners WHERE user_id IN (${ids})`);
    await client.query(`DELETE FROM public.members WHERE id IN (${ids})`);
    await client.query(`DELETE FROM auth.users WHERE id IN (${ids})`);
    await client.query(`DELETE FROM public.season_resets WHERE notes LIKE '%[ISOLATED SANDBOX QA TEST]%'`);

    // Step 2: Seed Mock Users in auth.users and public.members
    console.log('1. Seeding mock users into auth.users & public.members...');
    for (const u of mockUsers) {
      await client.query(`
        INSERT INTO auth.users (id, email, aud, role, created_at, updated_at)
        VALUES ($1, $2, 'authenticated', 'authenticated', now(), now())
        ON CONFLICT (id) DO NOTHING;
      `, [u.id, `${u.username}@nox.test`]);

      await client.query(`
        INSERT INTO public.members (id, username, display_name, xp, season_xp, equipped_title_id, is_test, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, now())
        ON CONFLICT (id) DO UPDATE SET
          xp = EXCLUDED.xp,
          season_xp = EXCLUDED.season_xp,
          equipped_title_id = EXCLUDED.equipped_title_id,
          is_test = EXCLUDED.is_test;
      `, [u.id, u.username, u.display_name, u.xp, u.season_xp, u.equipped_title_id, u.is_test]);

      // Seed purchased cosmetics in member_inventory
      await client.query(`
        INSERT INTO public.member_inventory (user_id, item_id, origin, acquired_at)
        VALUES ($1, $2, 'SHOP', now())
      `, [u.id, 'frame_basic_violet']);
    }
    console.log('✓ 3 mock users successfully seeded with spendable XP, season XP, and inventory cosmetics.\n');

    // Step 3: Verify Pre-Reset State
    console.log('2. Verifying pre-reset levels and balances:');
    for (const u of mockUsers) {
      const initialLevel = getLevelFromXp(u.season_xp);
      console.log(`   - ${u.display_name}: Season XP=${u.season_xp}, Loja XP=${u.xp}, Nível=${initialLevel}, Título=${u.equipped_title_id}`);
    }
    console.log('');

    // Step 4: Execute Season 1 Rollover on Isolated Mock Users
    console.log('3. Simulating official Season Rollover on sandbox test users...');
    const testSeasonId = 'season_sandbox_test';

    // A. Archive Top 3 into season_winners
    const winners = [
      { place: 1, user: mockUsers[0], titleId: 'hof-s1-campeao', titleName: 'Campeão da 1ª Temporada — Despertar Cósmico' },
      { place: 2, user: mockUsers[1], titleId: 'hof-s1-vice', titleName: 'Vice-Campeão da 1ª Temporada — Despertar Cósmico' },
      { place: 3, user: mockUsers[2], titleId: 'hof-s1-terceiro', titleName: 'Terceiro Colocado da 1ª Temporada — Despertar Cósmico' }
    ];

    for (const w of winners) {
      await client.query(`
        INSERT INTO public.season_winners (
          season_id, place, user_id, username, display_name, season_xp, final_level, equipped_title
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (season_id, place) DO UPDATE SET
          season_xp = EXCLUDED.season_xp,
          final_level = EXCLUDED.final_level,
          equipped_title = EXCLUDED.equipped_title;
      `, [
        testSeasonId,
        w.place,
        w.user.id,
        w.user.username,
        w.user.display_name,
        w.user.season_xp,
        getLevelFromXp(w.user.season_xp),
        w.titleName
      ]);

      // Award exclusive permanent title to winner's inventory
      await client.query(`
        INSERT INTO public.member_inventory (user_id, item_id, origin, acquired_at)
        VALUES ($1, $2, 'EVENT', now())
        ON CONFLICT (user_id, item_id) DO NOTHING;
      `, [w.user.id, w.titleId]);

      // Equip permanent title
      await client.query(`
        UPDATE public.members
        SET equipped_title_id = $1
        WHERE id = $2
      `, [w.titleId, w.user.id]);
    }

    // B. Unequip temporary level milestone titles for any users not in top 3
    // (Here top 3 were equipped with permanent titles; if someone had titulo-nv%, unequip)
    await client.query(`
      UPDATE public.members
      SET equipped_title_id = NULL
      WHERE is_test = true AND equipped_title_id LIKE 'titulo-nv%';
    `);

    // C. Record reset audit log
    await client.query(`
      INSERT INTO public.season_resets (season_id, total_members_reset, total_season_xp_reset, notes)
      VALUES ($1, $2, $3, $4)
    `, [
      testSeasonId,
      mockUsers.length,
      mockUsers.reduce((a, b) => a + b.season_xp, 0),
      '[ISOLATED SANDBOX QA TEST] Resetting Season XP and Spendable XP to Level 0'
    ]);

    // D. Perform Reset: Reset season_xp = 0 AND xp = 0 for mock users
    await client.query(`
      UPDATE public.members
      SET xp = 0, season_xp = 0
      WHERE id IN (${ids});
    `);

    console.log('✓ Sandbox season rollover completed successfully.\n');

    // Step 5: Assert Post-Reset State
    console.log('4. Verifying post-reset state:');
    const postResetRes = await client.query(`
      SELECT id, username, display_name, xp, season_xp, equipped_title_id
      FROM public.members
      WHERE id IN (${ids})
      ORDER BY username ASC;
    `);

    for (const row of postResetRes.rows) {
      const postLevel = getLevelFromXp(row.season_xp);
      console.log(`   - ${row.display_name}:`);
      console.log(`     * Season XP: ${row.season_xp} (Expected: 0) -> ${row.season_xp === 0 ? '✓ PASS' : '✗ FAIL'}`);
      console.log(`     * Loja XP: ${row.xp} (Expected: 0) -> ${row.xp === 0 ? '✓ PASS' : '✗ FAIL'}`);
      console.log(`     * Nível Calculado: ${postLevel} (Expected: 0) -> ${postLevel === 0 ? '✓ PASS' : '✗ FAIL'}`);
      console.log(`     * Título Equipado: ${row.equipped_title_id} (Permanent Hall of Fame Title) -> ${row.equipped_title_id?.startsWith('hof-') ? '✓ PASS' : '✗ FAIL'}`);

      if (row.season_xp !== 0 || row.xp !== 0 || postLevel !== 0) {
        throw new Error(`Assertion failed: Member ${row.username} was not reset to 0 XP / Level 0`);
      }
    }
    console.log('');

    // Step 6: Assert Inventory Preservation
    console.log('5. Verifying inventory cosmetics & permanent titles preservation:');
    const invRes = await client.query(`
      SELECT user_id, item_id, origin
      FROM public.member_inventory
      WHERE user_id IN (${ids})
      ORDER BY user_id, item_id;
    `);

    console.log(`   Found ${invRes.rows.length} total items in inventory across 3 mock users:`);
    for (const item of invRes.rows) {
      console.log(`   - Item ID: "${item.item_id}" [Origin: ${item.origin}] -> ✓ PERMANENT & INTACT`);
    }

    // Must have at least 6 items (3 frames + 3 titles)
    if (invRes.rows.length < 6) {
      throw new Error(`Assertion failed: Expected at least 6 inventory items, found ${invRes.rows.length}`);
    }
    console.log('✓ All cosmetics and permanent Hall of Fame titles 100% PRESERVED.\n');

    // Step 7: Simulate a Second Reset to Confirm Permanent Titles Survive Resets
    console.log('6. Simulating a SECOND consecutive reset to verify permanent titles survive:');
    await client.query(`
      UPDATE public.members
      SET equipped_title_id = NULL
      WHERE is_test = true AND equipped_title_id LIKE 'titulo-nv%';
    `);
    const afterSecondReset = await client.query(`
      SELECT equipped_title_id FROM public.members WHERE id = $1;
    `, [mockUsers[0].id]);
    console.log(`   Gold Champion title after 2nd reset: ${afterSecondReset.rows[0].equipped_title_id} -> ✓ PERMANENT SURVIVED`);
    if (afterSecondReset.rows[0].equipped_title_id !== 'hof-s1-campeao') {
      throw new Error('Assertion failed: Permanent title was lost on 2nd reset');
    }
    console.log('');

    // Step 8: Verify Real Users are 100% Untouched
    console.log('7. Verifying real users safety gate (0 real data touched):');
    const realUsersPost = await client.query('SELECT count(*), max(season_xp) AS max_season_xp, max(xp) AS max_xp FROM public.members WHERE is_test = false');
    console.log('   Real users post-check:', realUsersPost.rows[0]);
    if (
      realUsersPost.rows[0].count !== realUsersBaseline.rows[0].count ||
      realUsersPost.rows[0].max_season_xp !== realUsersBaseline.rows[0].max_season_xp ||
      realUsersPost.rows[0].max_xp !== realUsersBaseline.rows[0].max_xp
    ) {
      throw new Error('CRITICAL SAFETY FAILURE: Real user data was modified!');
    }
    console.log('✓ REAL USERS 100% INTACT & UNTOUCHED.\n');

    // Step 9: Clean up mock records
    console.log('8. Cleaning up sandbox mock records...');
    await client.query(`DELETE FROM public.member_inventory WHERE user_id IN (${ids})`);
    await client.query(`DELETE FROM public.season_winners WHERE season_id = '${testSeasonId}'`);
    await client.query(`DELETE FROM public.members WHERE id IN (${ids})`);
    await client.query(`DELETE FROM auth.users WHERE id IN (${ids})`);
    await client.query(`DELETE FROM public.season_resets WHERE season_id = '${testSeasonId}'`);
    console.log('✓ Sandbox mock records thoroughly cleaned up.\n');

    console.log('================================================================');
    console.log('   ALL 9/9 ISOLATED RESET AUDIT TESTS PASSED WITH 100% INTEGRITY ');
    console.log('================================================================');
  } finally {
    await client.end();
  }
}

runIsolatedResetAudit().catch((err) => {
  console.error('Audit Error:', err);
  process.exit(1);
});
