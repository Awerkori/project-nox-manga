import { check } from '$lib/server/db';
export const load = async ({ locals }) => {
  const [members, comments, invites] = await Promise.all([
    locals.db
      .from('members')
      .select('id,username,display_name,access_roles(role,suspended)')
      .order('created_at', { ascending: false })
      .limit(200),
    locals.db
      .from('comments')
      .select('id,body,removed,created_at,members!comments_user_id_fkey(display_name),works(title)')
      .order('created_at', { ascending: false })
      .limit(100),
    locals.db
      .from('editor_invites')
      .select('email,created_at')
      .order('created_at', { ascending: false })
      .limit(200)
  ]);
  check(comments);
  return { members: members.data || [], comments: comments.data || [], invites: invites.data || [] };
};
