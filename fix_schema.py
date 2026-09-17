import json
import re

with open('turso_schema.json', 'r') as f:
    turso_schema = json.load(f)

def to_snake_case(name):
    s1 = re.sub('(.)([A-Z][a-z]+)', r'\1_\2', name)
    return re.sub('([a-z0-9])([A-Z])', r'\1_\2', s1).lower()

with open('src/lib/server/db/schema.ts', 'r') as f:
    content = f.read()

# Parse the schema file to map properties accurately per table.
# We'll split the file by table blocks.

table_blocks = re.split(r'export const (\w+) = sqliteTable\(', content)
# table_blocks[0] is the header.
# then pairs of (tableName, block_content)

new_content = table_blocks[0]

for i in range(1, len(table_blocks), 2):
    var_name = table_blocks[i]
    block = table_blocks[i+1]
    
    # Extract the table name from the block: `"table_name", {`
    table_name_match = re.search(r'^[\'"]([^\'"]+)[\'"]\s*,\s*\{', block)
    if not table_name_match:
        new_content += f"export const {var_name} = sqliteTable({block}"
        continue
        
    db_table_name = table_name_match.group(1)
    
    # Get columns for this table
    valid_cols = []
    if db_table_name in turso_schema:
        valid_cols = [c['name'] for c in turso_schema[db_table_name]]
    else:
        # Better Auth creates tables that might be named differently? No, they should match.
        pass
        
    def repl(m):
        propName = m.group(1)
        colType = m.group(2)
        args = m.group(3)

        snake = to_snake_case(propName)
        
        target_col = None
        if propName in valid_cols:
            target_col = propName
        elif snake in valid_cols:
            target_col = snake

        if target_col:
            args = args.strip()
            if args == "":
                args = f"'{target_col}'"
            elif args.startswith("'") or args.startswith('"'):
                args = re.sub(r'^[\'"][^\'"]+[\'"]', f"'{target_col}'", args)
            elif args.startswith("{"):
                args = f"'{target_col}', " + args
                
            return f"{propName}: {colType}({args})"
        
        return m.group(0)

    new_block = re.sub(r'([a-zA-Z0-9_]+)\s*:\s*(text|integer|real|blob|numeric)\(([^)]*)\)', repl, block)
    
    new_content += f"export const {var_name} = sqliteTable({new_block}"

with open('src/lib/server/db/schema.ts', 'w') as f:
    f.write(new_content)

print("Done")
