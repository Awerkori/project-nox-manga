import re

for filepath in ['src/routes/api/scan/production/files/[id]/+server.ts', 'src/routes/api/scan/production/upload/+server.ts']:
    with open(filepath, 'r') as f:
        content = f.read()

    # Revert my bad comment
    content = content.replace("const staffDb = (null as any); // createClient(", "const staffDb = (null as any); /* createClient(")
    content = content.replace("env.STAFF_SUPABASE_SERVICE_ROLE_KEY || ''\n      );", "env.STAFF_SUPABASE_SERVICE_ROLE_KEY || ''\n      );*/")
    
    with open(filepath, 'w') as f:
        f.write(content)

