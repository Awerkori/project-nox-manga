import re
import sys
from collections import defaultdict

filename = sys.argv[1]
errors = []

pattern = re.compile(r'ERROR "(.*?)" (\d+:\d+) "(.*?)"')

with open(filename, 'r') as f:
    for line in f:
        match = pattern.search(line)
        if match:
            file_path, pos, msg = match.groups()
            errors.append({
                "file": file_path,
                "msg": msg
            })

stats = {
    "total": len(errors),
    "in_svelte_kit": 0,
    "in_node_modules": 0,
    "in_src": 0,
    "$$renderer": 0,
    "$$props": 0,
    "locals": 0,
    "request": 0,
    "types_module": 0,
    "other_src": defaultdict(int),
    "by_file": defaultdict(int),
    "by_msg": defaultdict(int)
}

for e in errors:
    f = e["file"]
    m = e["msg"]
    
    stats["by_msg"][m] += 1
    stats["by_file"][f] += 1
    
    if ".svelte-kit" in f:
        stats["in_svelte_kit"] += 1
    elif "node_modules" in f:
        stats["in_node_modules"] += 1
    elif "src/" in f:
        stats["in_src"] += 1
        if "$$renderer" in m:
            stats["$$renderer"] += 1
        elif "$$props" in m:
            stats["$$props"] += 1
        elif "locals" in m:
            stats["locals"] += 1
        elif "request" in m:
            stats["request"] += 1
        elif "Cannot find module 'types'" in m:
            stats["types_module"] += 1
        else:
            stats["other_src"][m] += 1

print(f"Total Errors: {stats['total']}")
print(f"In .svelte-kit: {stats['in_svelte_kit']}")
print(f"In node_modules: {stats['in_node_modules']}")
print(f"In src: {stats['in_src']}")
print(f"  - $$renderer implicitly has any: {stats['$$renderer']}")
print(f"  - $$props implicitly has any: {stats['$$props']}")
print(f"  - locals implicitly has any: {stats['locals']}")
print(f"  - request implicitly has any: {stats['request']}")
print(f"  - Cannot find module 'types': {stats['types_module']}")
print(f"  - Other errors in src: {sum(stats['other_src'].values())}")
print("\nTop 20 other errors in src:")
sorted_other = sorted(stats['other_src'].items(), key=lambda x: x[1], reverse=True)
for msg, count in sorted_other[:20]:
    print(f"  {count}x: {msg}")
