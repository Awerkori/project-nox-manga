import re
with open('src/routes/scan/+page.server.ts', 'r') as f:
    lines = f.readlines()

new_lines = []
imports = []
in_actions = False

for line in lines:
    if line.startswith('import '):
        if line not in imports:
            imports.append(line)
    else:
        new_lines.append(line)

content = "".join(imports) + "".join(new_lines)
with open('src/routes/scan/+page.server.ts', 'w') as f:
    f.write(content)
