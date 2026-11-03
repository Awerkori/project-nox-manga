import { json, error } from '@sveltejs/kit';
import { invalidateRankingCache } from '$lib/server/ranking-cache';
import { getLevelFromXp, NOX_HALL_OF_FAME_TITLES } from '$lib/levels';
import { executeYugabyteSql } from '$lib/server/yugabyte';

export const POST = async ({ request, locals, platform }: any) => {
  if (locals.role !== 'ADMIN') {
    error(403, 'Acesso restrito a administradores.');
  }

  const body = await request.json().catch(() => ({}));
  const confirmation = String(body.confirmation || '').trim();

  if (confirmation !== 'RESETAR XP') {
    error(400, 'Confirmação incorreta. Você deve digitar exatamente "RESETAR XP".');
  }

  // Safety guard: Automated and live resets are locked by default
  const isResetAllowed =
    platform?.env?.SEASON_RESET_ENABLED === 'true' ||
    process.env.SEASON_RESET_ENABLED === 'true';

  if (!isResetAllowed) {
    return json(
      {
        ok: false,
        error:
          'SEGURANÇA ATIVA: O reset real de XP está bloqueado no ambiente (SEASON_RESET_ENABLED=false). Nenhuma alteração foi realizada no banco.'
      },
      { status: 403 }
    );
  }

  const platformEnv = platform?.env;

  // Find active season
  const activeSeasonRes = await executeYugabyteSql(
    `SELECT * FROM public.seasons WHERE is_active = true ORDER BY number DESC LIMIT 1;`,
    [],
    platformEnv
  );
  const activeSeason = activeSeasonRes.rows[0] || null;
  const seasonId = activeSeason?.id || 'season_1';
  const seasonNum = activeSeason?.number || 1;

  // Find top 3 winners to immortalize in Hall of Fame
  const topContendersRes = await executeYugabyteSql(
    `SELECT id, username, display_name, season_xp, avatar_id, avatar_crop, avatar_frame_id, name_color, equipped_title_id
     FROM public.members
     WHERE season_xp > 0 AND is_test = false
     ORDER BY season_xp DESC
     LIMIT 3;`,
    [],
    platformEnv
  );
  const topContenders = topContendersRes.rows || [];

  // Archive top 3 winners and award exclusive permanent titles
  for (let i = 0; i < topContenders.length; i++) {
    const winner = topContenders[i];
    const place = i + 1;
    const titleObj = NOX_HALL_OF_FAME_TITLES[i] || NOX_HALL_OF_FAME_TITLES[0];

    await executeYugabyteSql(
      `INSERT INTO public.season_winners (
        season_id, place, user_id, username, display_name, avatar_id, avatar_crop,
        avatar_frame_id, name_color, season_xp, final_level, equipped_title
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (season_id, place) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        username = EXCLUDED.username,
        display_name = EXCLUDED.display_name,
        season_xp = EXCLUDED.season_xp;`,
      [
        seasonId,
        place,
        winner.id,
        winner.username,
        winner.display_name,
        winner.avatar_id,
        JSON.stringify(winner.avatar_crop || {}),
        winner.avatar_frame_id,
        winner.name_color,
        winner.season_xp,
        getLevelFromXp(winner.season_xp || 0),
        titleObj.name
      ],
      platformEnv
    );

    // Award exclusive permanent title to inventory
    await executeYugabyteSql(
      `INSERT INTO public.member_inventory (user_id, item_id, origin, acquired_at)
       VALUES ($1, $2, 'EVENT', now())
       ON CONFLICT (user_id, item_id) DO NOTHING;`,
      [winner.id, titleObj.id],
      platformEnv
    );

    // Equip permanent title
    await executeYugabyteSql(
      `UPDATE public.members SET equipped_title_id = $1 WHERE id = $2;`,
      [titleObj.id, winner.id],
      platformEnv
    );
  }

  // Count members affected and sum of season XP
  const affectedRes = await executeYugabyteSql(
    `SELECT count(*)::int AS cnt, coalesce(sum(season_xp), 0)::bigint AS total_xp
     FROM public.members
     WHERE season_xp > 0 AND is_test = false;`,
    [],
    platformEnv
  );
  const totalMembersReset = affectedRes.rows[0]?.cnt || 0;
  const totalSeasonXpReset = Number(affectedRes.rows[0]?.total_xp || 0);

  // Record audit log in season_resets
  await executeYugabyteSql(
    `INSERT INTO public.season_resets (
      season_id, admin_user_id, admin_email, total_members_reset, total_season_xp_reset, notes
    ) VALUES ($1, $2, $3, $4, $5, $6);`,
    [
      seasonId,
      locals.user?.id,
      locals.user?.email || 'admin@nox.internal',
      totalMembersReset,
      totalSeasonXpReset,
      `Reset da ${activeSeason?.name || seasonId} executado. Níveis e XP zerados para o novo ciclo.`
    ],
    platformEnv
  );

  // Unequip temporary milestone titles
  await executeYugabyteSql(
    `UPDATE public.members SET equipped_title_id = NULL WHERE equipped_title_id LIKE 'titulo-nv%';`,
    [],
    platformEnv
  );

  // Reset Season XP AND spendable XP to 0
  await executeYugabyteSql(
    `UPDATE public.members SET xp = 0, season_xp = 0 WHERE xp > 0 OR season_xp > 0;`,
    [],
    platformEnv
  );

  // Close previous season and launch next 90-day season
  if (activeSeason) {
    await executeYugabyteSql(
      `UPDATE public.seasons SET is_active = false WHERE id = $1;`,
      [activeSeason.id],
      platformEnv
    );
  }

  const nextNumber = seasonNum + 1;
  const nextSeasonId = `season_${nextNumber}`;
  const startsAt = new Date().toISOString();
  const endsAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

  await executeYugabyteSql(
    `INSERT INTO public.seasons (id, name, number, starts_at, ends_at, is_active, rules_text)
     VALUES ($1, $2, $3, $4, $5, true, $6);`,
    [
      nextSeasonId,
      `Temporada ${nextNumber} — O Despertar das Estrelas`,
      nextNumber,
      startsAt,
      endsAt,
      'Pontos de Temporada, Nível e saldo de XP são zerados a cada ciclo trimestral (90 dias). Cosméticos comprados na Loja Cósmica e títulos exclusivos do Hall da Fama são permanentes.'
    ],
    platformEnv
  );

  invalidateRankingCache();

  return json({
    ok: true,
    season_reset: seasonId,
    next_season: nextSeasonId,
    total_members_reset: totalMembersReset,
    total_season_xp_reset: totalSeasonXpReset
  });
};
