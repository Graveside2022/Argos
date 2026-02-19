import { expect, test } from '@playwright/test';

test.describe('TAK Integration Verification', () => {
	test('Verify Map Layers (Sidebar)', async ({ page }) => {
		await page.goto('http://100.120.210.5:5173/dashboard');
		await expect(page.locator('.map-container')).toBeVisible({ timeout: 10000 });

		const mapSettingsBtn = page.locator('.map-settings-ctrl .settings-btn');
		await expect(mapSettingsBtn).not.toBeVisible();

		const layersBtn = page.locator('button[aria-label="Layers"]');
		await expect(layersBtn).toBeVisible();
		await layersBtn.click();

		await expect(page.locator('.section-label', { hasText: 'MAP PROVIDER' })).toBeVisible();

		const satOption = page.locator('.provider-btn', { hasText: 'Satellite' });
		await expect(satOption).toBeVisible();
		await satOption.click();

		await expect(
			page.locator('.section-label', { hasText: 'VISIBILITY FILTER' })
		).toBeVisible();

		await expect(page.locator('.vis-btn', { hasText: 'Dynamic' })).toBeVisible();
		await expect(page.locator('.vis-btn', { hasText: 'All' })).toBeVisible();
		await expect(page.locator('.vis-btn', { hasText: 'Manual' })).toBeVisible();
	});

	test('Verify TAK Settings UI in Dashboard', async ({ page }) => {
		await page.goto('http://100.120.210.5:5173/dashboard');
		await expect(page.locator('.map-container')).toBeVisible({ timeout: 10000 });

		// Open Settings panel and click TAK Server to load inline config
		const settingsBtn = page.locator('button[aria-label="Settings"]');
		await expect(settingsBtn).toBeVisible();
		await settingsBtn.click();

		const takLink = page.getByText('TAK Server');
		await expect(takLink).toBeVisible();
		await takLink.click();

		// Verify ToolViewWrapper header with TAK title
		await expect(
			page.locator('.tool-view-title', { hasText: 'TAK Server Configuration' })
		).toBeVisible();

		// Verify configuration form fields
		await expect(page.locator('input[placeholder="Unit TAK Server"]')).toBeVisible();
		await expect(page.locator('input[placeholder="192.168.1.100"]')).toBeVisible();
		await expect(page.locator('input[placeholder="8089"]')).toBeVisible();

		// Verify authentication method radio buttons
		await expect(page.getByText('Import Certificate (.p12)')).toBeVisible();
		await expect(page.getByText('Enroll for Certificate')).toBeVisible();

		// Verify Save button
		await expect(page.getByRole('button', { name: 'Save Configuration' })).toBeVisible();

		// Verify Back button returns to map
		const backBtn = page.getByRole('button', { name: /Back/ });
		await expect(backBtn).toBeVisible();
	});
});
