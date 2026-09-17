import os
import glob
import re

for file in glob.glob("tests/*.test.ts"):
    with open(file, "r") as f:
        content = f.read()

    # Just fixing the vitest imports was done, but let's see how many tests use locals.db.
    if 'locals: {' in content and 'db' in content:
        print(f"File uses locals.db: {file}")

