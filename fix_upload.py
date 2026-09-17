import re

with open('src/routes/api/scan/production/upload/+server.ts', 'r') as f:
    content = f.read()

# Replace the details object with JSON.stringify(...)
content = re.sub(
    r'details:\s*\{([^}]+)\}',
    r'details: JSON.stringify({\1})',
    content
)

with open('src/routes/api/scan/production/upload/+server.ts', 'w') as f:
    f.write(content)
