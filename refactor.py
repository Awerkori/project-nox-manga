import re

with open('src/routes/u/[username]/+page.server.ts', 'r') as f:
    content = f.read()

# Add imports
if "import { db" not in content:
    content = content.replace(
        "import { error, fail } from '@sveltejs/kit';",
        "import { error, fail } from '@sveltejs/kit';\nimport { db, schema, safeQuery, safeQuerySingle } from '$lib/server/db';\nimport { eq, or, and, isNull, isNotNull, gt, lt, desc, asc, inArray, sql, count } from 'drizzle-orm';"
    )

# member
member_old = """  const { data: member } = await locals.db
    .from('members')
    .select(`
      id,
      username,
      display_name,
      bio,
      xp,
      avatar_id,
      banner_id,
      equipped_banner_id,
      avatar_frame_id,
      name_color,
      equipped_title_id,
      equipped_badge_id,
      featured_achievement_id,
      privacy_show_achievements,
      privacy_show_cosmetics,
      privacy_show_favorites,
      privacy_show_reading_history,
      privacy_show_scans,
      privacy_scan_mode,
      admin_hide_scan_badges,
      avatar_crop,
      banner_crop,
      created_at
    `)
    .eq('username', params.username)
    .maybeSingle();"""

member_new = """  const { data: member } = await safeQuerySingle(
    db.select({
      id: schema.members.id,
      username: schema.members.username,
      displayName: schema.members.displayName,
      bio: schema.members.bio,
      xp: schema.members.xp,
      avatarId: schema.members.avatarId,
      bannerId: schema.members.bannerId,
      equippedBannerId: schema.members.equippedBannerId,
      avatarFrameId: schema.members.avatarFrameId,
      nameColor: schema.members.nameColor,
      equippedTitleId: schema.members.equippedTitleId,
      equippedBadgeId: schema.members.equippedBadgeId,
      featuredAchievementId: schema.members.featuredAchievementId,
      privacyShowAchievements: schema.members.privacyShowAchievements,
      privacyShowCosmetics: schema.members.privacyShowCosmetics,
      privacyShowFavorites: schema.members.privacyShowFavorites,
      privacyShowReadingHistory: schema.members.privacyShowReadingHistory,
      privacyShowScans: schema.members.privacyShowScans,
      privacyScanMode: schema.members.privacyScanMode,
      adminHideScanBadges: schema.members.adminHideScanBadges,
      avatarCrop: schema.members.avatarCrop,
      bannerCrop: schema.members.bannerCrop,
      createdAt: schema.members.createdAt
    })
    .from(schema.members)
    .where(eq(schema.members.username, params.username))
  );"""
content = content.replace(member_old, member_new)

with open('src/routes/u/[username]/+page.server.ts', 'w') as f:
    f.write(content)
