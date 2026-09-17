with open('src/routes/admin/importer/+page.server.ts', 'r') as f:
    content = f.read()
content = content.replace("aliases: ''", "aliases: []")
content = content.replace("aliases: '',", "aliases: [],")
with open('src/routes/admin/importer/+page.server.ts', 'w') as f:
    f.write(content)
