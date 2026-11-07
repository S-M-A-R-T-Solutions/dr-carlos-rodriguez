import { expect, test } from '@playwright/test';

// Chromium exposes native summary as DisclosureTriangle in its AX tree.
// Playwright's synthetic button-role query does not include that native role.
test.beforeEach(async ({ page }) => {
  // Only the local static build is needed. Never load maps/fonts or submit data.
  await page.route('**/*', (route) =>
    new URL(route.request().url()).hostname === '127.0.0.1'
      ? route.continue()
      : route.abort(),
  );
});

for (const width of [320, 390, 768, 1024, 1279]) {
  test(`navigation is reachable and fits a ${width}px viewport`, async ({ page }) => {
    await page.setViewportSize({ width, height: 812 });
    await page.goto('/');
    const toggle = page.locator('summary[aria-label="Navigation menu"]');
    await expect(toggle).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Primary', exact: true })).toBeHidden();
    for (const control of [toggle, page.locator('[data-theme-toggle]'), page.locator('header > div > a')]) {
      const box = await control.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    }
    await toggle.click();
    const nav = page.getByRole('navigation', { name: 'Mobile primary' });
    await expect(nav).toBeVisible();
    for (const name of ['Home', 'About', 'Services', 'Locations', 'Contact']) {
      await expect(nav.getByRole('link', { name, exact: true })).toBeVisible();
    }
    const box = await nav.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
  });
}

test('keyboard opening, Escape and repeated toggles preserve focus', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 812 });
  await page.goto('/');
  const toggle = page.locator('summary[aria-label="Navigation menu"]');
  const nav = page.getByRole('navigation', { name: 'Mobile primary' });
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(nav).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(nav.getByRole('link', { name: 'Home', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(nav).toBeHidden();
  await expect(toggle).toBeFocused();
  await page.keyboard.press('Space');
  await expect(nav).toBeVisible();
  await toggle.click();
  await expect(nav).toBeHidden();
  await toggle.click();
  await expect(nav).toBeVisible();
});

test('every section link closes the disclosure and moves focus to its target', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 812 });
  await page.goto('/');
  for (const [label, id] of [['About', 'about'], ['Services', 'services'], ['Locations', 'locations'], ['Contact', 'contact'], ['Home', 'main-content']]) {
    await page.locator('summary[aria-label="Navigation menu"]').click();
    await page.getByRole('navigation', { name: 'Mobile primary' }).getByRole('link', { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`#${id}$`));
    await expect(page.locator('[data-mobile-navigation]')).not.toHaveAttribute('open', '');
    await expect(page.locator(`#${id}`)).toBeFocused();
  }
  await page.keyboard.press('Tab');
  await expect(page.locator('#main-content')).not.toHaveAttribute('tabindex');
});

test('desktop transition closes the mobile menu and transfers focus', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 812 });
  await page.goto('/');
  await page.locator('summary[aria-label="Navigation menu"]').click();
  await page.getByRole('navigation', { name: 'Mobile primary' }).getByRole('link', { name: 'Services', exact: true }).focus();
  await page.setViewportSize({ width: 1440, height: 900 });
  const desktop = page.getByRole('navigation', { name: 'Primary', exact: true });
  await expect(desktop).toBeVisible();
  await expect(desktop.getByRole('link', { name: 'Services', exact: true })).toBeFocused();
  await expect(page.getByRole('link', { name: 'Request Visit', exact: true })).toBeVisible();
  await expect(page.locator('[data-mobile-navigation]')).not.toHaveAttribute('open', '');
  await page.setViewportSize({ width: 390, height: 812 });
  await expect(page.getByRole('navigation', { name: 'Mobile primary' })).toBeHidden();
});

test('a focused closed toggle moves to visible desktop navigation on resize', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 812 });
  await page.goto('/');
  await page.locator('summary[aria-label="Navigation menu"]').focus();
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.getByRole('navigation', { name: 'Primary', exact: true }).getByRole('link', { name: 'Home', exact: true })).toBeFocused();
});

test('desktop links and visit CTA transfer focus to the closed mobile toggle', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Primary', exact: true }).getByRole('link', { name: 'Contact', exact: true }).focus();
  await page.setViewportSize({ width: 390, height: 812 });
  await expect(page.locator('summary[aria-label="Navigation menu"]')).toBeFocused();
  await expect(page.getByRole('navigation', { name: 'Mobile primary' })).toBeHidden();
  await page.setViewportSize({ width: 1440, height: 900 });
  // Wait for the first resize's focus transfer before starting another one.
  await expect(page.getByRole('navigation', { name: 'Primary', exact: true }).getByRole('link', { name: 'Home', exact: true })).toBeFocused();
  await page.getByRole('link', { name: 'Request Visit', exact: true }).focus();
  await page.setViewportSize({ width: 390, height: 812 });
  await expect(page.locator('summary[aria-label="Navigation menu"]')).toBeFocused();
});

test('repeated breakpoint changes keep focus on a visible navigation control', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 812 });
  await page.goto('/');
  const toggle = page.locator('summary[aria-label="Navigation menu"]');
  const desktop = page.getByRole('navigation', { name: 'Primary', exact: true });
  await toggle.focus();
  for (let iteration = 0; iteration < 8; iteration++) {
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(desktop.getByRole('link', { name: 'Home', exact: true })).toBeFocused();
    await desktop.getByRole('link', { name: 'Services', exact: true }).focus();
    await page.setViewportSize({ width: 390, height: 812 });
    await expect(toggle).toBeFocused();
  }
});

test('native fragment history remains usable after menu navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 812 });
  await page.goto('/');
  for (const label of ['Services', 'Locations']) {
    await page.locator('summary[aria-label="Navigation menu"]').click();
    await page.getByRole('navigation', { name: 'Mobile primary' }).getByRole('link', { name: label, exact: true }).click();
  }
  await page.goBack();
  await expect(page).toHaveURL(/#services$/);
  await page.goForward();
  await expect(page).toHaveURL(/#locations$/);
  await expect(page.getByRole('navigation', { name: 'Mobile primary' })).toBeHidden();
  await page.locator('summary[aria-label="Navigation menu"]').click();
  await expect(page.getByRole('navigation', { name: 'Mobile primary' })).toBeVisible();
});

test('native disclosure and section links work without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 812 } });
  const page = await context.newPage();
  await page.route('**/*', (route) => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.goto('http://127.0.0.1:4321');
  await page.locator('summary[aria-label="Navigation menu"]').click();
  const nav = page.getByRole('navigation', { name: 'Mobile primary' });
  await expect(nav).toBeVisible();
  await nav.getByRole('link', { name: 'Contact', exact: true }).click();
  await expect(page).toHaveURL(/#contact$/);
  await context.close();
});
