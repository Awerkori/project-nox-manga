import { executeYugabyteSql } from '$lib/server/yugabyte';
import {
  adminAuxPanelCache,
  adminAuxPanelFlights,
  withSingleFlightCache
} from '$lib/server/admin-cache';

export const load = async ({ platform }: any) => {
  return withSingleFlightCache(
    adminAuxPanelCache,
    adminAuxPanelFlights,
    'admin:gestao',
    20_000,
    async () => {
      const [membersRes, commentsRes, invitesRes] = await Promise.all([
        executeYugabyteSql(`
          SELECT m.id, m.username, m.display_name,
                 json_build_object('role', ar.role, 'suspended', COALESCE(ar.suspended, false)) AS access_roles
          FROM members m
          LEFT JOIN access_roles ar ON ar.user_id = m.id
          ORDER BY m.created_at DESC
          LIMIT 200;
        `, [], platform?.env),
        executeYugabyteSql(`
          SELECT c.id, c.body, c.removed, c.created_at,
                 json_build_object('display_name', m.display_name) AS members,
                 json_build_object('title', w.title) AS works
          FROM comments c
          LEFT JOIN members m ON m.id = c.user_id
          LEFT JOIN works w ON w.id = c.work_id
          ORDER BY c.created_at DESC
          LIMIT 100;
        `, [], platform?.env),
        executeYugabyteSql(`
          SELECT email, created_at
          FROM editor_invites
          ORDER BY created_at DESC
          LIMIT 200;
        `, [], platform?.env).catch(() => ({ rows: [] }))
      ]);

      return {
        members: membersRes.rows || [],
        comments: commentsRes.rows || [],
        invites: invitesRes.rows || []
      };
    }
  );
};
