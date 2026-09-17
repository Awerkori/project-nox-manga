import re
import json

changes = {}

with open('check.machine', 'r') as f:
    for line in f:
        match = re.search(r'ERROR "(.*?)" (\d+):(\d+) ".*?Property \'([a-z0-9_]+)\' does not exist on type .*?Did you mean \'([a-zA-Z0-9]+)\'', line)
        if match:
            file_path, line_num, col_num, old_prop, new_prop = match.groups()
            line_num = int(line_num) - 1
            col_num = int(col_num) - 1
            
            if file_path not in changes:
                changes[file_path] = []
            changes[file_path].append((line_num, col_num, old_prop, new_prop))

print(f"Found {sum(len(v) for v in changes.values())} safe fixes to apply from svelte-check.")

for file_path, file_changes in changes.items():
    if not file_path.startswith("src/"):
        continue
    
    with open(file_path, 'r') as f:
        lines = f.readlines()
        
    # Sort changes by line (descending) and column (descending) to avoid offset issues
    file_changes.sort(key=lambda x: (x[0], x[1]), reverse=True)
    
    for line_num, col_num, old_prop, new_prop in file_changes:
        if 0 <= line_num < len(lines):
            line_str = lines[line_num]
            # Verify the old property is actually at the column (or near it)
            # Sometimes svelte-check column is a bit off for Svelte files due to preprocessors.
            # We'll just replace the FIRST occurrence of \b{old_prop}\b starting from the column, or if that fails, just in the line.
            
            # Since Svelte source maps can be slightly off, let's just do a whole line regex replace 
            # BUT only if it is NOT inside a string.
            # A simpler way: we know it's a type error for a property access. So it's safe to just replace it in the line!
            lines[line_num] = re.sub(r'\b' + re.escape(old_prop) + r'\b', new_prop, line_str)
            
    with open(file_path, 'w') as f:
        f.writelines(lines)
