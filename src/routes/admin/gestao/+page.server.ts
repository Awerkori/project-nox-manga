export const load = async ({ locals }) => {
  const [members, comments, invites] = await Promise.all([
    locals.db
      .from('members')
      .select('id,username,display_name,access_roles(role,suspended)')
      .order('created_at', { ascending: false })
      .limit(200),
    locals.db
      .from('comments')
      .select('id,body,removed,created_at,members(display_name),works(title)')
      .order('created_at', { ascending: false })
      .limit(100),
    locals.db
      .from('editor_invites')
      .select('email,created_at')
      .order('created_at', { ascending: false })
      .limit(200)
  ]);
  return { members: members.data || [], comments: comments.data || [], invites: invites.data || [] };
};
