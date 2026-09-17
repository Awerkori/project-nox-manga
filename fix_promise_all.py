import re
import glob

# For all +page.server.ts files, check for Promise.all + safeQuery
files = glob.glob('src/routes/**/+page.server.ts', recursive=True)

# Actually, I can manually fix src/routes/admin/gestao/configuracoes/+page.server.ts
with open('src/routes/admin/gestao/configuracoes/+page.server.ts', 'r') as f:
    content = f.read()

content = content.replace("const [settings, pools, rawShards] = await Promise.all", "const [{ data: settings }, { data: pools }, { data: rawShards }] = await Promise.all")
content = content.replace("settings: settings || []", "settings: settings || []")

with open('src/routes/admin/gestao/configuracoes/+page.server.ts', 'w') as f:
    f.write(content)
