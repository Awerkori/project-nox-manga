const { execSync } = require('child_process');

try {
  console.log("Running svelte-check...");
  execSync('npx svelte-check --output machine > check_final_real.txt', { stdio: 'inherit' });
  console.log("Svelte check passed.");
} catch (e) {
  console.log("Svelte check failed.");
}

try {
  console.log("Running lint...");
  execSync('npm run lint', { stdio: 'inherit' });
  console.log("Lint passed.");
} catch (e) {
  console.log("Lint failed.");
}

try {
  console.log("Running tests...");
  execSync('npx vitest run --passWithNoTests', { stdio: 'inherit' });
  console.log("Tests passed.");
} catch (e) {
  console.log("Tests failed.");
}
