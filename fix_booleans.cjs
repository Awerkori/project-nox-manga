const fs = require('fs');

let schema = fs.readFileSync('src/lib/server/db/schema.ts', 'utf8');

const booleanColumns = [
  'isSecret', 'isAnimated', 'isActive', 'revoked', 'emailVerified',
  'adminHideScanBadges', 'privacyShowScans', 'privacyShowReadingHistory',
  'privacyShowFavorites', 'privacyShowCosmetics', 'privacyShowAchievements',
  'isOnboarded', 'overflowAllowed', 'isPublic', 'hiddenByAdmin', 'isPinned',
  'isOfficial', 'pauseUploads', 'pauseRecruitment', 'emergencyMode',
  'requiresOutput', 'isPrivate', 'isArchived', 'isEdited', 'isResolved',
  'isRead', 'emailEnabled', 'isFavorite', 'isPublished', 'isCurrent',
  'isStale', 'isOverride', 'notifiedAvailable'
];

for (const col of booleanColumns) {
   // find `col: integer("xxx")` or `col: integer()` and add `{ mode: 'boolean' }`
   // Note: it might already have `.notNull()` or something
   const regex = new RegExp(`(\\b${col}:\\s*integer\\([^)]*\\))`, 'g');
   schema = schema.replace(regex, (match) => {
     if (match.includes('mode:')) return match;
     if (match.endsWith('()')) return match.replace('()', "({ mode: 'boolean' })");
     return match.replace(')', ", { mode: 'boolean' })");
   });
}

fs.writeFileSync('src/lib/server/db/schema.ts', schema);
