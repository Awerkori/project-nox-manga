import re
import glob

files = glob.glob('src/**/*.ts', recursive=True)
for filepath in files:
    with open(filepath, 'r') as f:
        content = f.read()

    lines = content.split('\n')
    new_lines = []
    imports = set()
    for line in lines:
        if line.startswith("import { db, schema, safeQuery, safeQuerySingle } from '$lib/server/db';"):
            if "import_safeQuerySingle" in imports:
                continue
            imports.add("import_safeQuerySingle")
        elif line.startswith("import { db as dbClient, safeQuerySingle } from '$lib/server/db';"):
            if "import_dbClient" in imports:
                continue
            imports.add("import_dbClient")
        elif line.startswith("import { eq, and } from 'drizzle-orm';"):
            if "import_eq_and" in imports:
                continue
            imports.add("import_eq_and")
        new_lines.append(line)
    
    new_content = '\n'.join(new_lines)
    if new_content != content:
        with open(filepath, 'w') as f:
            f.write(new_content)
