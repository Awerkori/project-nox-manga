import re
import os

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    def repl(m):
        vars_str = m.group(1)
        # Split by comma, preserving newlines but mapping each variable
        vars_list = [v.strip() for v in vars_str.split(',')]
        new_vars = []
        for v in vars_list:
            if v:
                new_vars.append(f"{{ data: {v} }}")
        
        new_str = ',\n  '.join(new_vars)
        return f"const [\n  {new_str}\n] = await Promise.all"

    new_content = re.sub(r'const\s+\[([\s\S]*?)\]\s*=\s*await\s*Promise\.all', repl, content)
    
    if new_content != content:
        with open(filepath, 'w') as f:
            f.write(new_content)
        print(f"Fixed {filepath}")

for root, dirs, files in os.walk('src/'):
    for file in files:
        if file.endswith('.ts') or file.endswith('.js'):
            process_file(os.path.join(root, file))
