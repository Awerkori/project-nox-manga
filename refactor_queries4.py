import re

with open('src/routes/u/[username]/+page.server.ts', 'r') as f:
    content = f.read()

def replace_all(content, old, new):
    if old not in content:
        print("NOT FOUND:", old[:50])
    return content.replace(old, new)

scan_old = """    locals.db
      .from('scan_members')
      .select(`
        role,
        is_public,
        hidden_by_admin,
        created_at,
        scans!inner(
          id,
          name,
          slug,
          logo_id,
          is_official,
          status,
          description,
          display_preposition
        )
      `)
      .eq('user_id', member.id)
      .eq('scans.status', 'ACTIVE'),"""
scan_new = """    safeQuery(
      db.select({
        role: schema.scanMembers.role,
        isPublic: schema.scanMembers.isPublic,
        hiddenByAdmin: schema.scanMembers.hiddenByAdmin,
        createdAt: schema.scanMembers.createdAt,
        scans: {
          id: schema.scans.id,
          name: schema.scans.name,
          slug: schema.scans.slug,
          logoId: schema.scans.logoId,
          isOfficial: schema.scans.isOfficial,
          status: schema.scans.status,
          description: schema.scans.description,
          displayPreposition: schema.scans.displayPreposition
        }
      })
      .from(schema.scanMembers)
      .innerJoin(schema.scans, eq(schema.scanMembers.scanId, schema.scans.id))
      .where(and(eq(schema.scanMembers.userId, member.id), eq(schema.scans.status, 'ACTIVE')))
    ),"""
content = replace_all(content, scan_old, scan_new)

staff_old = """    locals.db
      .from('access_roles')
      .select('role')
      .eq('user_id', member.id)
      .eq('suspended', false)
      .maybeSingle(),"""
staff_new = """    safeQuerySingle(
      db.select({ role: schema.accessRoles.role })
      .from(schema.accessRoles)
      .where(and(eq(schema.accessRoles.userId, member.id), eq(schema.accessRoles.suspended, false)))
    ),"""
content = replace_all(content, staff_old, staff_new)

pos_old = """    locals.db
      .from('scan_member_positions')
      .select(`
        scan_id,
        is_primary,
        is_public,
        hidden_by_admin,
        created_at,
        scan_positions!inner(
          id,
          name,
          icon
        )
      `)
      .eq('user_id', member.id)"""
pos_new = """    safeQuery(
      db.select({
        scanId: schema.scanMemberPositions.scanId,
        isPrimary: schema.scanMemberPositions.isPrimary,
        isPublic: schema.scanMemberPositions.isPublic,
        hiddenByAdmin: schema.scanMemberPositions.hiddenByAdmin,
        createdAt: schema.scanMemberPositions.createdAt,
        scan_positions: {
          id: schema.scanPositions.id,
          name: schema.scanPositions.name,
          icon: schema.scanPositions.icon
        }
      })
      .from(schema.scanMemberPositions)
      .innerJoin(schema.scanPositions, eq(schema.scanMemberPositions.positionId, schema.scanPositions.id))
      .where(eq(schema.scanMemberPositions.userId, member.id))
    )"""
content = replace_all(content, pos_old, pos_new)

with open('src/routes/u/[username]/+page.server.ts', 'w') as f:
    f.write(content)
