import re

with open('src/routes/api/v1/[...path]/+server.ts', 'r') as f:
    content = f.read()

replacement = """
    // Simplified claim_chapter_xp
    const xpResult = true;
"""

content = re.sub(
    r"const \{ data: xpResultRows \} = await safeQuery\(\s*db\.execute\(sql\`SELECT claim_chapter_xp\(\$\{chapterId\}\) as res\`\)\s*\);\s*xpResult = xpResultRows \? \(xpResultRows as any\)\.res : null;",
    replacement,
    content
)

with open('src/routes/api/v1/[...path]/+server.ts', 'w') as f:
    f.write(content)
