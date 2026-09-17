with open('src/routes/scan/+page.server.ts', 'r') as f:
    content = f.read()

content = content.replace("import { fail } from '@sveltejs/kit';", "")
content = content.replace("declare const processPendingEmailOutbox: any;", "")
content = content.replace("export const actions = {", "")

with open('src/routes/scan/+page.server.ts', 'w') as f:
    f.write(content)
