import re

with open('src/routes/scan/+page.server.ts', 'r') as f:
    content = f.read()

content = content.replace("  updateProfile: async", "export const actions = {\n  updateProfile: async")

with open('src/routes/scan/+page.server.ts', 'w') as f:
    f.write(content)
