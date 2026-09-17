import re

with open('src/lib/server/db/schema.ts', 'r') as f:
    content = f.read()

# Fix the broken ones first
content = content.replace("mode: \\'boolean\\'", "mode: 'boolean'")

boolean_columns = [
    "removed", "systemGenerated", "suspended", "favorite", "following",
    "isPageProvider", "isGap", "isPrimary", "published", "featured",
    "cancelRequested", "isTest", "blurNsfw", "manualTitle", "manualBadge",
    "isOnboarded", "privacyShowAchievements", "privacyShowCosmetics",
    "privacyShowFavorites", "privacyShowReadingHistory", "privacyShowScans",
    "adminHideScanBadges", "overflowAllowed", "isActive", "isPublic",
    "hiddenByAdmin", "isPinned", "pinned", "isOfficial", "pauseUploads",
    "pauseRecruitment", "emergencyMode", "required", "requiresOutput",
    "isPrivate", "isArchived", "isEdited", "isResolved", "isRead",
    "emailEnabled", "isFavorite", "isPublished", "isCurrent", "isStale",
    "isOverride", "notifiedAvailable", "revoked", "storageReady"
]

for col in boolean_columns:
    # Match integer("snake_case")
    # Actually, we can just match `{col}: integer(` and then add `{ mode: 'boolean' }` inside it.
    
    # Let's match: colName: integer("col_name")
    content = re.sub(
        fr'({col}:\s*integer\("[^"]*"\))(?!\s*,\s*{{)', 
        r'\1, { mode: "boolean" }', 
        content
    )
    # Match: colName: integer()
    content = re.sub(
        fr'({col}:\s*integer\(\))(?!\s*{{)', 
        r'\1 { mode: "boolean" }',  # wait, integer() -> integer({ mode: "boolean" }) ? No, that requires replacing the parens
        content
    )
    content = re.sub(
        fr'{col}:\s*integer\(\)\s*', 
        f'{col}: integer({{ mode: "boolean" }}) ', 
        content
    )

# Fix double braces if any
content = content.replace("integer({ mode: \"boolean\" }) { mode: \"boolean\" }", "integer({ mode: \"boolean\" })")

with open('src/lib/server/db/schema.ts', 'w') as f:
    f.write(content)
