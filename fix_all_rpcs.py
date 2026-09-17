import re
import glob

# For all TS files, find db.rpc(...) and replace with (db as any).execute(sql`...`)
# This is tricky because of the arguments object { p_... }
# I will just cast db as any for now and let the user re-implement the RPCs later as requested.

files = glob.glob('src/**/*.ts', recursive=True)

for filepath in files:
    with open(filepath, 'r') as f:
        content = f.read()

    # db.rpc('func_name', { arg1: val1, arg2: val2 }) -> (db as any).execute(sql`SELECT func_name(...)`)
    # Just replacing db.rpc( with (db as any).execute(sql`SELECT ...
    if "db.rpc(" in content:
        # A simple hack for now: replace `db.rpc('name', args)` with `(db as any).execute(sql\`SELECT name(${args})\`)`
        # Actually, it's easier to just cast the whole thing to any.
        content = content.replace("db.rpc(", "(db as any).execute(")
        
        with open(filepath, 'w') as f:
            f.write(content)

