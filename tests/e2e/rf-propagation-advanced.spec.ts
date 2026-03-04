/**
 * E2E test for RF Propagation Advanced Controls panel.
 *
 * Navigation: Dashboard → Map Settings (icon rail) → RF Propagation (hub card)
 *
 * Validates that the ADVANCED section renders, expands, and displays
 * correct defaults for all 5 advanced CloudRF parameters.
 * Also verifies parameter changes and compute button behavior.
 */

import { expect, test } from '@playwright/test';

/** Navigate from dashboard root into the RF Propagation subview */
async function navigateToRFPropagation(page: import('@playwright/test').Page) {
	await page.goto('/dashboard', { waitUntil: 'load' });

	// Wait for initial async renders (hardware scan, system status) to settle
	await page.waitForLoadState('networkidle');

	// 1. Click "Map Settings" in the icon rail and wait for the hub to appear
	const mapSettingsBtn = page.locator('button.rail-btn[aria-label="Map Settings"]');
	await expect(mapSettingsBtn).toBeVisible({ timeout: 15_000 });
	await mapSettingsBtn.click();
	await expect(page.locator('.panel-title:has-text("MAP SETTINGS")')).toBeVisible({
		timeout: 10_000
	});

	// 2. Click the "RF Propagation" hub card — retry on DOM detachment from Svelte re-renders
	const rfPanelTitle = page.locator('.panel-title:has-text("RF PROPAGATION")');
	for (let attempt = 0; attempt < 3; attempt++) {
		const rfCard = page.locator('button.hub-card:has-text("RF Propagation")');
		await expect(rfCard).toBeVisible({ timeout: 5_000 });
		await rfCard.click();
		try {
			await expect(rfPanelTitle).toBeVisible({ timeout: 5_000 });
			return; // Success — subview loaded
		} catch {
			// Hub card was detached mid-click; wait briefly and retry
			await page.waitForTimeout(500);
		}
	}

	// Final attempt — let it throw if still failing
	await expect(rfPanelTitle).toBeVisible({ timeout: 10_000 });
}

test.describe('RF Propagation — Advanced Controls', () => {
	test.setTimeout(60_000);

	test.beforeEach(async ({ page }) => {
		await navigateToRFPropagation(page);
	});

	test('ADVANCED section exists and is collapsed by default', async ({ page }) => {
		const advancedToggle = page.locator('button.section-toggle:has-text("ADVANCED")');
		await expect(advancedToggle).toBeVisible({ timeout: 5_000 });

		// The advanced body should NOT be visible when collapsed
		const advancedBody = page.locator('.advanced-body');
		await expect(advancedBody).not.toBeVisible();
	});

	test('expands to show all 5 controls with correct defaults', async ({ page }) => {
		const advancedToggle = page.locator('button.section-toggle:has-text("ADVANCED")');
		await advancedToggle.click();

		const advancedBody = page.locator('.advanced-body');
		await expect(advancedBody).toBeVisible();

		// 1. TX POWER — default 5 W
		const txPowerInput = advancedBody.locator('input[type="number"]').first();
		await expect(txPowerInput).toBeVisible();
		await expect(txPowerInput).toHaveValue('5');

		// 2. RX SENSITIVITY — default -90 dBm
		const rxSensInput = advancedBody.locator('input[type="number"]').nth(1);
		await expect(rxSensInput).toBeVisible();
		await expect(rxSensInput).toHaveValue('-90');

		// 3. ENVIRONMENT select — default Minimal.clt
		const envSelect = advancedBody.locator('select').first();
		await expect(envSelect).toBeVisible();
		await expect(envSelect).toHaveValue('Minimal.clt');

		// 4. RELIABILITY select — default 95
		const reliabilitySelect = advancedBody.locator('select').nth(1);
		await expect(reliabilitySelect).toBeVisible();
		await expect(reliabilitySelect).toHaveValue('95');

		// 5. PROP MODEL select — default Auto
		const propModelSelect = advancedBody.locator('select').nth(2);
		await expect(propModelSelect).toBeVisible();
		await expect(propModelSelect).toHaveValue('auto');
	});

	test('can change all advanced parameter values', async ({ page }) => {
		await page.locator('button.section-toggle:has-text("ADVANCED")').click();
		const advancedBody = page.locator('.advanced-body');
		await expect(advancedBody).toBeVisible();

		// Change TX Power to 10 W
		const txPowerInput = advancedBody.locator('input[type="number"]').first();
		await txPowerInput.fill('10');
		await txPowerInput.dispatchEvent('change');
		await expect(txPowerInput).toHaveValue('10');

		// Change RX Sensitivity to -100 dBm
		const rxSensInput = advancedBody.locator('input[type="number"]').nth(1);
		await rxSensInput.fill('-100');
		await rxSensInput.dispatchEvent('change');
		await expect(rxSensInput).toHaveValue('-100');

		// Change Environment to Temperate
		const envSelect = advancedBody.locator('select').first();
		await envSelect.selectOption('Temperate.clt');
		await expect(envSelect).toHaveValue('Temperate.clt');

		// Change Reliability to 90%
		const reliabilitySelect = advancedBody.locator('select').nth(1);
		await reliabilitySelect.selectOption('90');
		await expect(reliabilitySelect).toHaveValue('90');

		// Change Prop Model to COST-Hata (id: 6)
		const propModelSelect = advancedBody.locator('select').nth(2);
		await propModelSelect.selectOption('6');
		await expect(propModelSelect).toHaveValue('6');
	});

	test('COMPUTE COVERAGE button renders correctly', async ({ page }) => {
		const computeBtn = page.locator('button.compute-btn');
		await expect(computeBtn).toBeVisible({ timeout: 5_000 });
		await expect(computeBtn).toContainText('COMPUTE COVERAGE');

		// Button state depends on GPS fix availability:
		// - Disabled + "Awaiting GPS fix..." when no GPS
		// - Enabled + radius hint when GPS is available
		const isDisabled = await computeBtn.isDisabled();
		if (isDisabled) {
			const gpsHint = page.locator('.compute-hint--warn');
			await expect(gpsHint).toContainText('GPS fix');
		} else {
			// GPS fix is available — button is enabled and shows radius hint
			const hint = page.locator('.compute-hint:not(.compute-hint--warn)');
			await expect(hint).toBeVisible();
		}
	});

	test('propagation model dropdown includes Free Space (ITU-R P.525)', async ({ page }) => {
		await page.locator('button.section-toggle:has-text("ADVANCED")').click();
		const advancedBody = page.locator('.advanced-body');
		await expect(advancedBody).toBeVisible();

		const propModelSelect = advancedBody.locator('select').nth(2);
		const options = propModelSelect.locator('option');

		// Should have Auto + 5 models = 6 options
		await expect(options).toHaveCount(6);

		// Verify the Free Space option has the corrected label with ITU-R P.525
		const freeSpaceOption = propModelSelect.locator('option:has-text("Free Space")');
		await expect(freeSpaceOption).toContainText('ITU-R P.525');

		// Verify the Free Space option value is 7, not 9
		await expect(freeSpaceOption).toHaveAttribute('value', '7');
	});

	test('no console errors during interaction', async ({ page }) => {
		const consoleErrors: string[] = [];
		page.on('console', (msg) => {
			if (msg.type() === 'error') consoleErrors.push(msg.text());
		});

		// Use a helper to always get a fresh toggle reference (avoids detached DOM issues)
		const getToggle = () => page.locator('button.section-toggle:has-text("ADVANCED")');
		const advancedBody = page.locator('.advanced-body');

		// Expand
		await getToggle().click();
		await expect(advancedBody).toBeVisible();

		// Interact with controls
		const txPowerInput = advancedBody.locator('input[type="number"]').first();
		await txPowerInput.fill('20');
		await txPowerInput.dispatchEvent('change');

		const envSelect = advancedBody.locator('select').first();
		await envSelect.selectOption('Urban.clt');

		// Collapse and re-expand (re-query toggle each time)
		await getToggle().click();
		await expect(advancedBody).not.toBeVisible();
		await getToggle().click();
		await expect(advancedBody).toBeVisible();

		// Filter out expected non-critical errors (WebSocket, rate limits, GPS, Zod background)
		const ignoredPatterns = [
			'WebSocket',
			'ERR_CONNECTION_REFUSED',
			'429',
			'GPS',
			'Zod',
			'gps-service'
		];
		const criticalErrors = consoleErrors.filter(
			(e) => !ignoredPatterns.some((p) => e.includes(p))
		);
		expect(criticalErrors).toHaveLength(0);
	});
});
