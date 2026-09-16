import { db, schema, safeQuery, check } from '$lib/server/db';
import { eq, desc } from 'drizzle-orm';

export const load = async () => {
  const [members, comments, invites] = await Promise.all([
    safeQuery(db.select({
      id: schema.members.id,
      username: schema.members.username,
      displayName: schema.members.displayName,
      access_roles: {
        role: schema.accessRoles.role,
        suspended: schema.accessRoles.suspended
      }
    }).from(schema.members)
      .leftJoin(schema.accessRoles, eq(schema.members.id, schema.accessRoles.userId))
      .orderBy(desc(schema.members.createdAt))
      .limit(200)),
      
    safeQuery(db.select({
      id: schema.comments.id,
      body: schema.comments.body,
      removed: schema.comments.removed,
      createdAt: schema.comments.createdAt,
      members: {
        displayName: schema.members.displayName
      },
      works: {
        title: schema.works.title
      }
    }).from(schema.comments)
      .leftJoin(schema.members, eq(schema.comments.userId, schema.members.id))
      .leftJoin(schema.works, eq(schema.comments.workId, schema.works.id))
      .orderBy(desc(schema.comments.createdAt))
      .limit(100)),
      
    safeQuery(db.select({
      email: schema.editorInvites.email,
      createdAt: schema.editorInvites.createdAt
    }).from(schema.editorInvites)
      .orderBy(desc(schema.editorInvites.createdAt))
      .limit(200))
  ]);

  check(comments);

  return { 
    members: members.data || [], 
    comments: comments.data || [], 
    invites: invites.data || [] 
  };
};
