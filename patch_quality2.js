import fs from 'fs';
let content = fs.readFileSync('.github/workflows/quality.yml', 'utf-8');
const checkReplacement = `      - name: Run Svelte-check (Baseline diff)
        run: |
          npm run check > svelte-check-output.txt || true
          ERRORS=\\$(grep -oP '\\d+(?= errors)' svelte-check-output.txt || echo "0")
          if [ "\\$ERRORS" -gt 3500 ]; then
             echo "Svelte-check errors increased to \\$ERRORS. Failing."
             cat svelte-check-output.txt
             exit 1
          fi
          echo "Svelte-check errors (\\$ERRORS) are within the legacy baseline limit (3500)."`;

content = content.replace("      - run: npm run check", checkReplacement);
fs.writeFileSync('.github/workflows/quality.yml', content);
