import { test, expect } from '@playwright/test';

test.describe('Smoke Test - Happy Path Navigation', () => {
	test('should navigate from console to tactical map and load core components', async ({
		page
	}) => {
		// Navigate to the main console page
		await page.goto('/');

		// Verify console title is present
		await expect(page.locator('h1.console-title')).toBeVisible();

		// Click on the tactical map mission card
		await page.locator('.mission-card.mission-location').click();

		// Wait for navigation to tactical map
		await page.waitForURL('/tactical-map-simple');

		// Verify map container is present
		await expect(page.locator('.map-container')).toBeVisible();

		// Verify signal info section with kismet title is present
		await expect(page.locator('.signal-info .kismet-title')).toBeVisible();

		// Additional smoke check - verify page loaded successfully
		await expect(page).toHaveTitle(/Argos/);
	});
});
