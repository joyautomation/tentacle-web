import { test, expect } from './fixtures';

test.describe('Navigation', () => {
	test('sidebar navigation is accessible', async ({ page }) => {
		await page.goto('/');

		// Look for the nav sidebar or menu trigger
		const sidebar = page.locator('.nav-sidebar, nav');
		await expect(sidebar.first()).toBeVisible();
	});

	test('navigating to a service page shows service layout', async ({ page }) => {
		await page.goto('/services/mqtt');

		// Service layout should show navigation tabs
		const serviceNav = page.locator('.service-nav, .tab-nav');
		await expect(serviceNav.first()).toBeVisible({ timeout: 10_000 });
	});

	test('service page has back navigation', async ({ page }) => {
		await page.goto('/services/mqtt');

		// Should have a way to go back to topology
		const backLink = page.locator('a[href="/"], .back-link');
		await expect(backLink.first()).toBeVisible();
	});
});

test.describe('Navigation a11y', () => {
	test('service page passes a11y checks', async ({ page, makeAxeBuilder }) => {
		await page.goto('/services/mqtt');
		await page.waitForLoadState('networkidle');

		const results = await makeAxeBuilder()
			.disableRules(['aria-hidden-focus', 'color-contrast'])
			.analyze();
		expect(results.violations).toEqual([]);
	});
});
