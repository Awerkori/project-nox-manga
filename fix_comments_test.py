with open('tests/comments.test.ts', 'r') as f:
    content = f.read()

content = content.replace("parent_id", "parentId").replace("created_at", "createdAt")

with open('tests/comments.test.ts', 'w') as f:
    f.write(content)
