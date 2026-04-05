import { test, expect } from './fixtures';

test.describe('Home page', () => {
	test('loads and shows the header', async ({ page }) => {
		await page.goto('/');

		// Header should be visible
		const header = page.locator('.app-header');
		await expect(header).toBeVisible();

		// Mode badge should be present (shows mode even without backend)
		const modeBadge = page.locator('.mode-badge');
		await expect(modeBadge).toBeVisible({ timeout: 10_000 });
	});

	test('theme switch buttons are interactive', async ({ page }) => {
		await page.goto('/');

		const themeButtons = page.locator('.theme-switch button');
		await expect(themeButtons).toHaveCount(3);

		// Click the dark theme button (3rd button)
		await themeButtons.nth(2).click();

		// Body class should change to themeDark
		await expect(page.locator('body')).toHaveClass(/themeDark/);

		// Click back to light (2nd button)
		await themeButtons.nth(1).click();
		await expect(page.locator('body')).toHaveClass(/themeLight/);
	});

	test('passes basic a11y checks', async ({ page, makeAxeBuilder }) => {
		await page.goto('/');

		// Wait for initial render
		await page.waitForLoadState('networkidle');

		const results = await makeAxeBuilder()
			.disableRules(['aria-hidden-focus', 'color-contrast'])
			.analyze();

		expect(results.violations).toEqual([]);
	});
});
