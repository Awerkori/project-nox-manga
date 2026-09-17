import os
import glob
import re

for file in glob.glob("tests/*.test.ts"):
    with open(file, "r") as f:
        content = f.read()
    
    # Replace vi.mock('$lib/server/db' with vi.mock('../src/lib/server/db'
    content = content.replace("vi.mock('$lib/server/db',", "vi.mock('../src/lib/server/db',")
    content = content.replace("typeof import('$lib/server/db')", "typeof import('../src/lib/server/db')")
    
    with open(file, "w") as f:
        f.write(content)
