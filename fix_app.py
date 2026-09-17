with open('src/app.d.ts', 'r') as f:
    content = f.read()

content = content.replace("unread: number;", "unread: number;\n      sessionCache?: any;")

with open('src/app.d.ts', 'w') as f:
    f.write(content)
