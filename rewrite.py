import re

with open("src/routes/scans/[slug]/+page.server.ts", "r") as f:
    content = f.read()

# Just a quick check of what we need to replace
print("Length:", len(content))
