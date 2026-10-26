import { json, error } from '@sveltejs/kit';
import { invalidateRankingCache } from '$lib/server/ranking-cache';
import { getLevelFromXp } from '$lib/levels';

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

  // Find active season
  const { data: activeSeason } = await locals.db
    .from('seasons')
    .select('*')
    .eq('is_active', true)
    .order('number', { ascending: false })
    .limit(1)
    .maybeSingle();

  const seasonId = activeSeason?.id || 'season_1';
  const seasonNum = activeSeason?.number || 1;

  // Find top 3 winners to immortalize in Hall of Fame
  const { data: topContenders } = await locals.db
    .from('members')
    .select('id, username, display_name, season_xp, lifetime_xp, avatar_id, avatar_crop, avatar_frame_id, name_color, equipped_title_id')
    .gt('season_xp', 0)
    .eq('is_test', false)
    .order('season_xp', { ascending: false })
    .limit(3);

  // Archive top 3 winners
  if (topContenders && topContenders.length > 0) {
    for (let i = 0; i < topContenders.length; i++) {
      const winner = topContenders[i];
      await locals.db.from('season_winners').upsert(
        {
          season_id: seasonId,
          place: i + 1,
          user_id: winner.id,
          username: winner.username,
          display_name: winner.display_name,
          avatar_id: winner.avatar_id,
          avatar_crop: winner.avatar_crop,
          avatar_frame_id: winner.avatar_frame_id,
          name_color: winner.name_color,
          season_xp: winner.season_xp,
          final_level: getLevelFromXp(winner.lifetime_xp || 0),
          equipped_title: winner.equipped_title_id || 'Mestre da Leitura'
        },
        { onConflict: 'season_id,place' }
      );
    }
  }

  // Count members affected and sum of season XP
  const { data: affectedMembers } = await locals.db
    .from('members')
    .select('season_xp')
    .gt('season_xp', 0)
    .eq('is_test', false);

  const totalMembersReset = affectedMembers?.length || 0;
  const totalSeasonXpReset = (affectedMembers || []).reduce(
    (acc: number, curr: any) => acc + (curr.season_xp || 0),
    0
  );

  // Record audit log
  await locals.db.from('season_resets').insert({
    season_id: seasonId,
    admin_user_id: locals.user?.id,
    admin_email: locals.user?.email || 'admin@nox.internal',
    total_members_reset: totalMembersReset,
    total_season_xp_reset: totalSeasonXpReset,
    notes: `Reset da ${activeSeason?.name || seasonId} executado via painel administrativo.`
  });

  // Reset Season XP to 0 (Preserving lifetime_xp and shop balance xp!)
  await locals.db
    .from('members')
    .update({ season_xp: 0 })
    .gt('season_xp', 0);

  // Close previous season and launch next 90-day season
  if (activeSeason) {
    await locals.db.from('seasons').update({ is_active: false }).eq('id', activeSeason.id);
  }

  const nextNumber = seasonNum + 1;
  const nextSeasonId = `season_${nextNumber}`;
  const startsAt = new Date().toISOString();
  const endsAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

  await locals.db.from('seasons').insert({
    id: nextSeasonId,
    name: `Temporada ${nextNumber} — O Despertar das Estrelas`,
    number: nextNumber,
    starts_at: startsAt,
    ends_at: endsAt,
    is_active: true
  });

  invalidateRankingCache();

  return json({
    ok: true,
    season_reset: seasonId,
    next_season: nextSeasonId,
    total_members_reset: totalMembersReset,
    total_season_xp_reset: totalSeasonXpReset
  });
};
