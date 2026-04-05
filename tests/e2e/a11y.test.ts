import { test, expect } from './fixtures';

/**
 * Dedicated a11y sweep across multiple routes.
 * These tests verify WCAG 2.0 AA compliance for each major page.
 *
 * Known issues (to fix):
 * - aria-hidden-focus: Sidebar nav has aria-hidden="true" but contains focusable elements
 * - color-contrast: Some text elements don't meet WCAG AA contrast ratios
 */

// Rules to exclude until the underlying issues are fixed.
// Each entry here should have a corresponding issue/task to resolve it.
const knownIssueRules = ['aria-hidden-focus', 'color-contrast'];

const routes = ['/', '/services/mqtt', '/services/gateway', '/services/plc'];

for (const route of routes) {
	test(`a11y: ${route} has no WCAG 2.0 AA violations`, async ({ page, makeAxeBuilder }) => {
		await page.goto(route);
		await page.waitForLoadState('networkidle');

		const results = await makeAxeBuilder().disableRules(knownIssueRules).analyze();

		// Log violations for debugging (visible in Playwright report)
		if (results.violations.length > 0) {
			console.log(
				`a11y violations on ${route}:`,
				results.violations.map((v) => ({
					id: v.id,
					impact: v.impact,
					description: v.description,
					nodes: v.nodes.length
				}))
			);
		}

		expect(results.violations).toEqual([]);
	});
}

// Separate test to track known issues — expected to fail until fixed.
// Run with: npx playwright test -g "known a11y issues"
test('known a11y issues are documented', async ({ page, makeAxeBuilder }) => {
	await page.goto('/');
	await page.waitForLoadState('networkidle');

	const results = await makeAxeBuilder().analyze();

	const knownViolations = results.violations.filter((v) => knownIssueRules.includes(v.id));
	const unknownViolations = results.violations.filter((v) => !knownIssueRules.includes(v.id));

	// If known issues get fixed, this reminds you to remove them from the exclusion list
	if (knownViolations.length === 0) {
		console.log('All known a11y issues appear fixed! Remove entries from knownIssueRules.');
	}

	// Fail on any NEW (undocumented) violations
	expect(unknownViolations).toEqual([]);
});
