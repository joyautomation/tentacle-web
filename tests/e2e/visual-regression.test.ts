import { test, expect } from '@playwright/test';

/**
 * Visual regression tests for D3 visualization components.
 *
 * These capture screenshots and compare against stored baselines.
 * On first run, screenshots are saved as the baseline.
 * On subsequent runs, they're compared pixel-by-pixel.
 *
 * Update baselines with: npx playwright test --update-snapshots
 *
 * Note: These tests require the app to be running with data.
 * In CI without a backend, the visualizations render in their
 * empty/disconnected state — which is still a valid baseline.
 */

test.describe('Visual regression', () => {
	test('home page topology renders consistently', async ({ page }) => {
		await page.goto('/');
		await page.waitForLoadState('networkidle');

		// Wait a bit for D3 animations to settle
		await page.waitForTimeout(1000);

		// Capture the topology area
		const topology = page.locator('.topology-container, .system-topology, main');
		await expect(topology.first()).toHaveScreenshot('home-topology.png', {
			maxDiffPixelRatio: 0.01, // Allow 1% pixel diff for anti-aliasing
			animations: 'disabled'
		});
	});

	test('full home page layout', async ({ page }) => {
		await page.goto('/');
		await page.waitForLoadState('networkidle');
		await page.waitForTimeout(500);

		await expect(page).toHaveScreenshot('home-full.png', {
			fullPage: true,
			maxDiffPixelRatio: 0.02,
			animations: 'disabled'
		});
	});

	test('service detail page layout', async ({ page }) => {
		await page.goto('/services/mqtt');
		await page.waitForLoadState('networkidle');
		await page.waitForTimeout(500);

		await expect(page).toHaveScreenshot('service-mqtt.png', {
			fullPage: true,
			maxDiffPixelRatio: 0.02,
			animations: 'disabled'
		});
	});
});
