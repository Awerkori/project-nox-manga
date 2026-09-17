import re

with open('src/routes/u/[username]/+page.server.ts', 'r') as f:
    content = f.read()

# Fix db.get -> db.all for safeQuerySingle
content = content.replace("safeQuerySingle(db.get(sql`SELECT * FROM member_public_profile_stats(${member.id})`))", "safeQuerySingle(db.all(sql`SELECT * FROM member_public_profile_stats(${member.id})`))")
content = content.replace("safeQuerySingle(\n      db.get(sql`SELECT toggle_user_scan_privacy(${showScans}, ${mode})`)\n    );", "safeQuerySingle(\n      db.all(sql`SELECT toggle_user_scan_privacy(${showScans}, ${mode})`)\n    );")
content = content.replace("safeQuerySingle(\n      db.get(sql`SELECT admin_moderate_user_scans(${targetUserId}, ${hideBadges})`)\n    );", "safeQuerySingle(\n      db.all(sql`SELECT admin_moderate_user_scans(${targetUserId}, ${hideBadges})`)\n    );")

# Fix deeply nested object in reading history
read_old = """            chapters: {
              id: schema.chapters.id,
              number: schema.chapters.number,
              title: schema.chapters.title,
              workId: schema.chapters.workId,
              works: {
                id: schema.works.id,
                slug: schema.works.slug,
                title: schema.works.title,
                coverId: schema.works.coverId,
                kind: schema.works.kind,
                status: schema.works.status,
                contentRating: schema.works.contentRating
              }
            }"""
read_new = """            chapters: {
              id: schema.chapters.id,
              number: schema.chapters.number,
              title: schema.chapters.title,
              workId: schema.chapters.workId
            },
            works: {
              id: schema.works.id,
              slug: schema.works.slug,
              title: schema.works.title,
              coverId: schema.works.coverId,
              kind: schema.works.kind,
              status: schema.works.status,
              contentRating: schema.works.contentRating
            }"""
content = content.replace(read_old, read_new)

# Fix reading loop to match flat structure
loop_old = """    const ch = r.chapters;
    if (!ch || !ch.works) continue;
    const wid = ch.workId || ch.works.id;
    if (!readingMap.has(wid)) {
      readingMap.set(wid, {
        workId: wid,
        workTitle: ch.works.title,
        workSlug: ch.works.slug,
        coverId: ch.works.coverId,
        contentRating: ch.works.contentRating,
        kind: ch.works.kind,"""
loop_new = """    const ch = r.chapters;
    const w = r.works;
    if (!ch || !w) continue;
    const wid = ch.workId || w.id;
    if (!readingMap.has(wid)) {
      readingMap.set(wid, {
        workId: wid,
        workTitle: w.title,
        workSlug: w.slug,
        coverId: w.coverId,
        contentRating: w.contentRating,
        kind: w.kind,"""
content = content.replace(loop_old, loop_new)

# Map rawMember to member to fix boolean columns
member_old = """  const { data: member } = await safeQuerySingle(
    db.select({"""
member_new = """  const { data: rawMember } = await safeQuerySingle(
    db.select({"""
content = content.replace(member_old, member_new)

member_check_old = """  if (!member) {
    error(404, 'Perfil não encontrado');
  }"""
member_check_new = """  if (!rawMember) {
    error(404, 'Perfil não encontrado');
  }

  const member = {
    ...rawMember,
    privacyShowAchievements: Boolean(rawMember.privacyShowAchievements),
    privacyShowCosmetics: Boolean(rawMember.privacyShowCosmetics),
    privacyShowFavorites: Boolean(rawMember.privacyShowFavorites),
    privacyShowReadingHistory: Boolean(rawMember.privacyShowReadingHistory),
    privacyShowScans: Boolean(rawMember.privacyShowScans),
    adminHideScanBadges: Boolean(rawMember.adminHideScanBadges)
  };"""
content = content.replace(member_check_old, member_check_new)

with open('src/routes/u/[username]/+page.server.ts', 'w') as f:
    f.write(content)
