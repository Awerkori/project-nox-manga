import fs from 'fs';
let content = fs.readFileSync('.github/workflows/quality.yml', 'utf-8');
const replacement = `      - name: Get changed files
        id: changed-files
        uses: tj-actions/changed-files@v44
        with:
          files: |
            **/*.js
            **/*.ts
            **/*.svelte
            **/*.mjs
      - name: Run ESLint on changed files
        if: steps.changed-files.outputs.any_changed == 'true'
        run: npx eslint \${{ steps.changed-files.outputs.all_changed_files }}`;

content = content.replace("      - run: npm run lint", replacement);
fs.writeFileSync('.github/workflows/quality.yml', content);
