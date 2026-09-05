import js from '@eslint/js';
import ts from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
export default ts.config(
  js.configs.recommended,
  ...ts.configs.recommended,
  ...svelte.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    // The app is deployed at the domain root; no configurable SvelteKit base path is used.
    rules: {
      'svelte/no-navigation-without-resolve': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
    }
  },
  { files: ['**/*.svelte'], languageOptions: { parserOptions: { parser: ts.parser } } },
  {
    ignores: [
      '.svelte-kit/**',
      '.wrangler/**',
      'node_modules/**',
      'src/lib/database.types.ts',
      'artifacts/**'
    ]
  }
);
