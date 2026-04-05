import { test as base, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Extended Playwright test fixture that includes a11y scanning via axe-core.
 *
 * Usage:
 *   import { test, expect } from './fixtures';
 *
 *   test('my page passes a11y', async ({ page, makeAxeBuilder }) => {
 *     await page.goto('/');
 *     const results = await makeAxeBuilder().analyze();
 *     expect(results.violations).toEqual([]);
 *   });
 */
export const test = base.extend<{ makeAxeBuilder: () => AxeBuilder }>({
	makeAxeBuilder: async ({ page }, use) => {
		await use(() =>
			new AxeBuilder({ page })
				.withTags(['wcag2a', 'wcag2aa'])
				// D3 SVGs often have a11y issues that are hard to fix without
				// breaking the visualization. Exclude them from automated scans
				// and audit them separately with manual review.
				.exclude('.topology-svg')
				.exclude('.sunburst-svg')
				.exclude('.radial-tree-svg')
		);
	}
});

export { expect };
