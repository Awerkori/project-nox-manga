import re

changes = {}

with open('check.machine', 'r') as f:
    for line in f:
        # Machine format: "START /path/to/file.svelte:line:column: ERROR: Property 'user_id' does not exist on type 'X'. Did you mean 'userId'?"
        # Wait, svelte-check machine format has quotes or no quotes?
        # Let's match the "Did you mean '...'" 
        match = re.search(r'"([^"]+)"\s*:\s*(\d+):(\d+).*?Property \'([a-z_]+)\' does not exist on type .*?Did you mean \'([a-zA-Z0-9]+)\'', line)
        if match:
            file_path, line_num, col_num, old_prop, new_prop = match.groups()
            line_num = int(line_num) - 1 # 0-indexed
            
            if file_path not in changes:
                changes[file_path] = []
            changes[file_path].append((line_num, old_prop, new_prop))

print(f"Found {sum(len(v) for v in changes.values())} fixes to apply.")
