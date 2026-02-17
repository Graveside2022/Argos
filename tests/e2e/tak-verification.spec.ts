import { expect, test } from '@playwright/test';

test.describe('TAK Integration Verification', () => {
	test('Verify Map Layers (Sidebar)', async ({ page }) => {
		// 1. Navigate to dashboard using absolute URL
		await page.goto('http://100.120.210.5:5173/dashboard');

		// Wait for map container to ensure page load
		await expect(page.locator('.map-container')).toBeVisible({ timeout: 10000 });

		// 2. Overview: Verify Map Settings button is GONE from the map
		const mapSettingsBtn = page.locator('.map-settings-ctrl .settings-btn');
		await expect(mapSettingsBtn).not.toBeVisible();

		// 3. Open Layers Panel from Sidebar
		// Find button by aria-label "Layers"
		const layersBtn = page.locator('button[aria-label="Layers"]');
		await expect(layersBtn).toBeVisible();
		await layersBtn.click();

		// 4. Verify Map Provider Section
		await expect(page.locator('.section-label', { hasText: 'MAP PROVIDER' })).toBeVisible();

		// 5. Verify "Satellite" option is present and clic k it
		const satOption = page.locator('.provider-btn', { hasText: 'Satellite' });
		await expect(satOption).toBeVisible();
		await satOption.click();

		// 6. Verify Visibility Filter Section
		await expect(
			page.locator('.section-label', { hasText: 'VISIBILITY FILTER' })
		).toBeVisible();

		// 7. Verify Visibility Options
		await expect(page.locator('.vis-btn', { hasText: 'Dynamic' })).toBeVisible();
		await expect(page.locator('.vis-btn', { hasText: 'All' })).toBeVisible();
		await expect(page.locator('.vis-btn', { hasText: 'Manual' })).toBeVisible();
	});

	test('Verify TAK Settings UI', async ({ page }) => {
		// 1. Navigate to TAK settings using absolute URL
		await page.goto('http://100.120.210.5:5173/settings/tak');

		// 2. Verify Header
		await expect(page.locator('h1', { hasText: 'TAK Integration' })).toBeVisible();

		// 3. Verify Configuration Form Fields
		await expect(page.locator('input[placeholder="My TAK Server"]')).toBeVisible(); // Server Name
		await expect(page.locator('input[placeholder="192.168.1.10"]')).toBeVisible(); // Hostname
		await expect(page.locator('input[placeholder="8087"]')).toBeVisible(); // Port

		// 4. Verify Protocol Selection
		const protocolSelect = page.locator('select');
		await expect(protocolSelect).toBeVisible();
		await expect(protocolSelect).toHaveValue('tcp'); // Default

		// 5. Verify Certificate Section
		await expect(page.locator('h2', { hasText: 'Certificates (.p12)' })).toBeVisible();
		await expect(page.locator('input[type="file"][accept=".p12"]')).toBeVisible();
		await expect(page.locator('button', { hasText: 'Upload & Extract' })).toBeVisible();

		// 6. Verify Connection Status Indicator
		await expect(page.locator('.status-indicator')).toBeVisible();
		await expect(page.locator('.status-indicator .text')).toBeVisible();
	});
});
