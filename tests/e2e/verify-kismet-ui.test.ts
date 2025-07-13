import { test, expect } from '@playwright/test';

test('Kismet page displays with proper glass panel styling', async ({ page }) => {
	// Navigate to Kismet page
	await page.goto('/kismet');

	// Wait for page to load
	await page.waitForLoadState('networkidle');

	// Check that glass-panel classes exist and have proper styling
	const glassPanel = await page.locator('.glass-panel').first();

	// Verify glass panel exists
	await expect(glassPanel).toBeVisible();

	// Take a screenshot for visual verification
	await page.screenshot({
		path: 'tests/visual/screenshots/kismet-ui-fixed.png',
		fullPage: true
	});

	// Check specific CSS properties are applied
	const backgroundColor = await glassPanel.evaluate(
		(el) => window.getComputedStyle(el).backgroundColor
	);

	// Should have semi-transparent background (rgba with alpha < 1)
	expect(backgroundColor).toMatch(/rgba?\(.+,.+,.+,.+\)/);

	// Check backdrop filter is applied
	const backdropFilter = await glassPanel.evaluate(
		(el) => window.getComputedStyle(el).backdropFilter
	);

	expect(backdropFilter).toContain('blur');

	console.error('Glass panel styling verified:');
	console.error('- Background color:', backgroundColor);
	console.error('- Backdrop filter:', backdropFilter);
});
