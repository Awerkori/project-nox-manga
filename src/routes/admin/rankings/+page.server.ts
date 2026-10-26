import { error } from '@sveltejs/kit';
import { safeDbQuery } from '$lib/server/resilience';

export const load = async ({ locals }: any) => {
  if (locals.role !== 'ADMIN') {
    error(403, 'Acesso restrito a administradores.');
  }

  // 1. Fetch active season
  const { data: season } = await locals.db
    .from('seasons')
    .select('*')
    .eq('is_active', true)
    .order('number', { ascending: false })
    .limit(1)
    .maybeSingle();

  // 2. Fetch past resets audit log
  const { data: resets } = await locals.db
    .from('season_resets')
    .select('*')
    .order('executed_at', { ascending: false })
    .limit(20);

  // 3. Current active season metrics
  const [activeMembersRes, totalSeasonXpRes, topContendersRes, totalLifetimeXpRes, inventoryRes] = await Promise.all([
    locals.db
      .from('members')
      .select('id', { count: 'exact', head: true })
      .gt('season_xp', 0)
      .eq('is_test', false),
    locals.db.rpc('sum_season_xp').then((r: any) => r.data).catch(async () => {
      // Fallback query if RPC not yet created
      const q = await locals.db.from('members').select('season_xp').gt('season_xp', 0).eq('is_test', false);
      return (q.data || []).reduce((acc: number, curr: any) => acc + (curr.season_xp || 0), 0);
    }),
    locals.db
      .from('members')
      .select('id, username, display_name, season_xp, lifetime_xp, avatar_id, avatar_crop, avatar_frame_id, name_color, equipped_title_id')
      .gt('season_xp', 0)
      .eq('is_test', false)
      .order('season_xp', { ascending: false })
      .limit(5),
    locals.db.from('members').select('lifetime_xp').eq('is_test', false).then((q: any) => {
      return (q.data || []).reduce((acc: number, curr: any) => acc + (curr.lifetime_xp || 0), 0);
    }),
    locals.db.from('member_inventory').select('user_id', { count: 'exact', head: true })
  ]);

  return {
    season: season || {
      id: 'season_1',
      name: 'Temporada 1 — Despertar Cósmico',
      number: 1,
      starts_at: '2026-10-01T00:00:00.000Z',
      ends_at: '2026-12-31T23:59:59.000Z',
      is_active: true
    },
    resets: resets || [],
    metrics: {
      activeSeasonalMembers: activeMembersRes.count ?? 0,
      totalSeasonXp: totalSeasonXpRes || 0,
      topContenders: topContendersRes.data || [],
      totalLifetimeXp: totalLifetimeXpRes || 0,
      totalInventoryItems: inventoryRes.count ?? 0
    }
  };
};
