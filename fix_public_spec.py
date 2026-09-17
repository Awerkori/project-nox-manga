import re

with open('tests/e2e/public.spec.ts', 'r') as f:
    content = f.read()

# Replace test.skip(!work) with an assertion
content = content.replace("test.skip(!work, 'No published work available for the content-dependent smoke test');", "expect(work).toBeDefined();\n  expect(catalog.data.length).toBeGreaterThan(0);")

# Change a[href="/catalogo"] to something robust
content = content.replace("await page.locator('a[href=\"/catalogo\"]').first().click();", "await page.goto('/catalogo');")

# Add a check in navigation test that Home is not empty!
content = content.replace("await expect(page.locator('h1, h2, h3').first()).toBeVisible();", "await expect(page.locator('h1, h2, h3').first()).toBeVisible();\n    await expect(page.locator('.work-card, .chapter-item, a[href^=\"/obra/\"]')).not.toHaveCount(0);")

with open('tests/e2e/public.spec.ts', 'w') as f:
    f.write(content)

print("Tests fixed!")
