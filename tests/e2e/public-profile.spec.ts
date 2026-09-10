import { test, expect } from '@playwright/test';

test.describe('Public Profile: Conquistas & Cosméticos', () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([
      {
        name: 'nox-age-status',
        value: 'ADULT',
        url: 'http://127.0.0.1:5173'
      },
      {
        name: 'nox-blur-nsfw',
        value: 'false',
        url: 'http://127.0.0.1:5173'
      }
    ]);
  });

  async function ensureAgeGateDismissed(page: any) {
    const ageModal = page.locator('.age-gate-backdrop');
    if (await ageModal.isVisible().catch(() => false)) {
      const adultBtn = page.getByRole('button', { name: /Tenho 18 anos/i });
      if (await adultBtn.isVisible().catch(() => false)) {
        await adultBtn.click().catch(() => {});
      }
    }
  }

  test('displays real achievements (X / Y) and cosmetics count in stats grid', async ({ page }) => {
    await page.goto('/u/kiritsuguxs', { waitUntil: 'networkidle' });
    await ensureAgeGateDismissed(page);

    // Verify profile identity
    await expect(page.locator('.display-name')).toBeVisible();

    // Verify stats grid exists with 5 cards
    const statsGrid = page.locator('#stats-summary');
    await expect(statsGrid).toBeVisible();

    // 1. Capítulos Lidos
    await expect(statsGrid.getByText('Capítulos Lidos')).toBeVisible();

    // 2. Obras na Coleção
    await expect(statsGrid.getByText('Obras na Coleção')).toBeVisible();

    // 3. Conquistas in format "X / Y"
    const conquistasCard = statsGrid.locator('button.stat-card-interactive').filter({ hasText: 'Conquistas' });
    await expect(conquistasCard).toBeVisible();
    await expect(conquistasCard.locator('.stat-num-achievement')).toBeVisible();
    const conquistasText = await conquistasCard.locator('.stat-num-achievement').innerText();
    // Must match format: "<unlocked> / <total>"
    expect(conquistasText).toMatch(/\d+\s*\/\s*\d+/);

    // 4. Cosméticos
    const cosmeticosCard = statsGrid.locator('button.stat-card-interactive').filter({ hasText: 'Cosméticos' });
    await expect(cosmeticosCard).toBeVisible();
    const cosmeticosText = await cosmeticosCard.locator('.stat-card-num').innerText();
    expect(Number(cosmeticosText)).toBeGreaterThanOrEqual(0);

    // 5. Seguidores
    await expect(statsGrid.getByText(/Seguidor(es)?/)).toBeVisible();
  });

  test('clicking Conquistas card activates public achievements tab without redirecting to /me', async ({ page }) => {
    await page.goto('/u/kiritsuguxs', { waitUntil: 'networkidle' });
    await ensureAgeGateDismissed(page);

    // Click the Conquistas stat card
    const conquistasCard = page.locator('button.stat-card-interactive').filter({ hasText: 'Conquistas' });
    await conquistasCard.click();

    // Ensure we did NOT navigate to /me
    expect(page.url()).toContain('/u/kiritsuguxs');
    expect(page.url()).not.toContain('/me');

    // Conquistas tab must be active
    const achievementsTabBtn = page.locator('.profile-tab-btn').filter({ hasText: 'Conquistas' });
    await expect(achievementsTabBtn).toHaveClass(/active/);
    await expect(page.locator('.achievements-pane')).toBeVisible();
  });

  test('clicking Cosméticos card activates public cosmetics collection tab without redirecting to /me', async ({ page }) => {
    await page.goto('/u/kiritsuguxs', { waitUntil: 'networkidle' });
    await ensureAgeGateDismissed(page);

    // Click the Cosméticos stat card
    const cosmeticosCard = page.locator('button.stat-card-interactive').filter({ hasText: 'Cosméticos' });
    await cosmeticosCard.click();

    // Ensure we did NOT navigate to /me
    expect(page.url()).toContain('/u/kiritsuguxs');
    expect(page.url()).not.toContain('/me');

    // Cosméticos tab must be active
    const cosmeticsTabBtn = page.locator('.profile-tab-btn').filter({ hasText: 'Coleção Cosmética' });
    await expect(cosmeticsTabBtn).toHaveClass(/active/);
    await expect(page.locator('.cosmetics-pane')).toBeVisible();

    // Filter pills must be present
    await expect(page.locator('.filter-pill').filter({ hasText: 'Todos' })).toBeVisible();
    await expect(page.locator('.filter-pill').filter({ hasText: 'Molduras' })).toBeVisible();
    await expect(page.locator('.filter-pill').filter({ hasText: 'Títulos' })).toBeVisible();
  });

  test('renders properly on mobile viewport without line breakage in stats', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/u/kiritsuguxs', { waitUntil: 'networkidle' });
    await ensureAgeGateDismissed(page);

    // Stats grid must be visible
    const statsGrid = page.locator('#stats-summary');
    await expect(statsGrid).toBeVisible();

    // Conquistas card must span nicely and not overflow
    const conquistasCard = statsGrid.locator('button.stat-card-interactive').filter({ hasText: 'Conquistas' });
    await expect(conquistasCard).toBeVisible();

    const achievementNum = conquistasCard.locator('.stat-num-achievement');
    await expect(achievementNum).toBeVisible();
    const text = await achievementNum.innerText();
    expect(text).toMatch(/\d+\s*\/\s*\d+/);

    // Verify horizontal scrolling does not occur inside profile page
    const profilePage = page.locator('.profile-page');
    const profileScrollWidth = await profilePage.evaluate((el) => el.scrollWidth);
    const profileClientWidth = await profilePage.evaluate((el) => el.clientWidth);
    expect(profileScrollWidth).toBeLessThanOrEqual(profileClientWidth + 1);
  });

  test('direct tab navigation via query parameter (?tab=cosmeticos)', async ({ page }) => {
    await page.goto('/u/kiritsuguxs?tab=cosmeticos', { waitUntil: 'networkidle' });
    await ensureAgeGateDismissed(page);

    const cosmeticsTabBtn = page.locator('.profile-tab-btn').filter({ hasText: 'Coleção Cosmética' });
    await expect(cosmeticsTabBtn).toHaveClass(/active/);
    await expect(page.locator('.cosmetics-pane')).toBeVisible();
  });

  test('captures desktop and mobile screenshots for visual verification', async ({ page }) => {
    // Desktop View
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/u/kiritsuguxs', { waitUntil: 'networkidle' });
    await ensureAgeGateDismissed(page);
    await page.screenshot({
      path: '/home/awerkori/.gemini/antigravity-cli/brain/77ca9c93-730c-4572-bdd3-2f5c6d80e854/screenshots/public_profile_desktop.png',
      fullPage: true
    });

    // Switch to cosmetics
    const cosmeticosCard = page.locator('button.stat-card-interactive').filter({ hasText: 'Cosméticos' });
    await cosmeticosCard.click();
    await page.waitForTimeout(300);
    await page.screenshot({
      path: '/home/awerkori/.gemini/antigravity-cli/brain/77ca9c93-730c-4572-bdd3-2f5c6d80e854/screenshots/public_profile_desktop_cosmetics.png',
      fullPage: true
    });

    // Mobile View
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/u/kiritsuguxs', { waitUntil: 'networkidle' });
    await ensureAgeGateDismissed(page);
    await page.screenshot({
      path: '/home/awerkori/.gemini/antigravity-cli/brain/77ca9c93-730c-4572-bdd3-2f5c6d80e854/screenshots/public_profile_mobile.png',
      fullPage: true
    });
  });
});
