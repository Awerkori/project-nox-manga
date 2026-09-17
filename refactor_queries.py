import re

with open('src/routes/u/[username]/+page.server.ts', 'r') as f:
    content = f.read()

def replace_all(content, old, new):
    if old not in content:
        print("NOT FOUND:", old[:50])
    return content.replace(old, new)

# 1. statsRes
content = replace_all(content, 
    "locals.db.rpc('member_public_profile_stats', { p_user: member.id })",
    "safeQuery(db.execute(sql`SELECT * FROM member_public_profile_stats(${member.id})`))")

# 2. followersCountRes
content = replace_all(content,
    "locals.db.from('user_follows').select('follower_id', { count: 'exact', head: true }).eq('following_id', member.id)",
    "safeQuerySingle(db.select({ count: count() }).from(schema.userFollows).where(eq(schema.userFollows.followingId, member.id)))")

# 3. followingCountRes
content = replace_all(content,
    "locals.db.from('user_follows').select('following_id', { count: 'exact', head: true }).eq('follower_id', member.id)",
    "safeQuerySingle(db.select({ count: count() }).from(schema.userFollows).where(eq(schema.userFollows.followerId, member.id)))")

# 4. achievementsRes
ach_old = """    canViewAchievements
      ? locals.db
          .from('member_achievements')
          .select(`
            unlocked_at,
            achievements!inner(
              id,
              title,
              description,
              icon,
              badge_color,
              category,
              rarity,
              xp_reward,
              is_secret
            )
          `)
          .eq('user_id', member.id)
          .order('unlocked_at', { ascending: false })
      : Promise.resolve({ data: [] }),"""
ach_new = """    canViewAchievements
      ? safeQuery(
          db.select({
            unlockedAt: schema.memberAchievements.unlockedAt,
            achievements: {
              id: schema.achievements.id,
              title: schema.achievements.title,
              description: schema.achievements.description,
              icon: schema.achievements.icon,
              badgeColor: schema.achievements.badgeColor,
              category: schema.achievements.category,
              rarity: schema.achievements.rarity,
              xpReward: schema.achievements.xpReward,
              isSecret: schema.achievements.isSecret
            }
          })
          .from(schema.memberAchievements)
          .innerJoin(schema.achievements, eq(schema.memberAchievements.achievementId, schema.achievements.id))
          .where(eq(schema.memberAchievements.userId, member.id))
          .orderBy(desc(schema.memberAchievements.unlockedAt))
        )
      : Promise.resolve({ data: [] }),"""
content = replace_all(content, ach_old, ach_new)

with open('src/routes/u/[username]/+page.server.ts', 'w') as f:
    f.write(content)
