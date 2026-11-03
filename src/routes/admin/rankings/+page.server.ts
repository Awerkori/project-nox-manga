import { error } from '@sveltejs/kit';
import {
  adminAuxPanelCache,
  adminAuxPanelFlights,
  withSingleFlightCache
} from '$lib/server/admin-cache';
import { executeYugabyteSql } from '$lib/server/yugabyte';

export const load = async ({ locals, platform }: any) => {
  if (locals.role !== 'ADMIN') {
    error(403, 'Acesso restrito a administradores.');
  }

  return withSingleFlightCache(
    adminAuxPanelCache,
    adminAuxPanelFlights,
    'admin:rankings',
    30_000,
    async () => {
      const [metricsRes, contendersRes, inventoryRes] = await Promise.all([
        executeYugabyteSql(
          `SELECT count(*)::int AS active_count, coalesce(sum(xp), 0)::bigint AS total_xp
           FROM members
           WHERE xp > 0 AND (is_test IS NULL OR is_test = false);`,
          [],
          platform?.env
        ).catch(() => ({ rows: [{ active_count: 0, total_xp: 0 }] })),

        executeYugabyteSql(
          `SELECT id, username, display_name, xp AS season_xp, xp AS lifetime_xp, avatar_id, avatar_crop, avatar_frame_id, name_color, equipped_title_id
           FROM members
           WHERE xp > 0 AND (is_test IS NULL OR is_test = false)
           ORDER BY xp DESC
           LIMIT 5;`,
          [],
          platform?.env
        ).catch(() => ({ rows: [] })),

        executeYugabyteSql(
          `SELECT count(*)::int AS inventory_count FROM member_inventory;`,
          [],
          platform?.env
        ).catch(() => ({ rows: [{ inventory_count: 0 }] }))
      ]);

      const m = metricsRes.rows[0] || { active_count: 0, total_xp: 0 };
      const topContenders = contendersRes.rows || [];
      const totalInventory = inventoryRes.rows[0]?.inventory_count ?? 0;

      return {
        season: {
          id: 'season_1',
          name: 'Temporada 1 — Despertar Cósmico',
          number: 1,
          starts_at: '2026-10-01T00:00:00.000Z',
          ends_at: '2026-12-31T23:59:59.000Z',
          is_active: true
        },
        resets: [],
        metrics: {
          activeSeasonalMembers: m.active_count ?? 0,
          totalSeasonXp: Number(m.total_xp) || 0,
          topContenders,
          totalLifetimeXp: Number(m.total_xp) || 0,
          totalInventoryItems: totalInventory
        }
      };
    }
  );
};
