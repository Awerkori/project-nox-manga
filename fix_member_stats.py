import re

with open('src/routes/api/v1/[...path]/+server.ts', 'r') as f:
    content = f.read()

replacement = """
    // Simplified member_public_stats
    const stats = [{
      chaptersRead: 0,
      totalXp: member.xp,
      level: 1,
      rank: 'Novato'
    }];
"""

content = re.sub(
    r"const \{ data: statsRows \} = await safeQuery\(\s*db\.execute\(sql\`SELECT member_public_stats\(\$\{member\.id\}\) as res\`\)\s*\);\s*const stats = statsRows \? \[\(statsRows as any\)\.res\] : null;",
    replacement,
    content
)

with open('src/routes/api/v1/[...path]/+server.ts', 'w') as f:
    f.write(content)
