import re
from collections import Counter

def run():
    with open('svelte-check.log', 'r') as f:
        lines = f.readlines()
    
    counter = Counter()
    for line in lines:
        if line.startswith("Error: "):
            msg = line[7:].strip()
            # Normalize common error messages
            if "is not assignable to type" in msg:
                if "PageData" in msg or "LayoutData" in msg or "PageServerLoad" in msg:
                    counter["Type Mismatch (PageData/LayoutData)"] += 1
                else:
                    counter["Type Mismatch (Assignability)"] += 1
            elif "does not exist on type" in msg:
                if "Locals" in msg:
                    counter["Missing property on 'Locals'"] += 1
                elif "data" in msg:
                    counter["Missing property on 'data'"] += 1
                elif "InferAPI" in msg:
                    counter["Missing property on Auth/BetterAuth API"] += 1
                else:
                    counter["Missing property on type"] += 1
            elif "No overload matches this call" in msg:
                counter["No overload matches this call"] += 1
            elif "Cannot find module" in msg:
                counter["Cannot find module / missing import"] += 1
            elif "implicitly has an 'any' type" in msg:
                counter["Implicit 'any'"] += 1
            elif "Argument of type" in msg and "is not assignable to parameter of type" in msg:
                counter["Argument type mismatch"] += 1
            else:
                counter[msg[:80] + '...'] += 1
        elif line.startswith("Warn: "):
            msg = line[6:].strip()
            if "Unused CSS selector" in msg:
                counter["[Warn] Unused CSS selector"] += 1
            elif "A11y" in msg or "a11y" in msg or "aria" in msg or "interactive" in msg:
                counter["[Warn] A11y (Accessibility) Warning"] += 1
            else:
                counter["[Warn] " + msg[:80] + '...'] += 1
                
    print("=== SVELTE CHECK ERRORS CLASSIFICATION ===")
    for k, v in counter.most_common(20):
        print(f"{v:5d} : {k}")

run()
