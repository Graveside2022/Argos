/**
 * Visual Regression Testing for Constitutional Audit Remediation
 *
 * Purpose: Capture before/after screenshots to verify UI changes are intentional
 * Phases: P2 (UI Modernization) - baseline captured before migration
 *
 * Usage:
 *   - Before P2: npx playwright test visual-regression.spec.ts --update-snapshots
 *   - After P2:  npx playwright test visual-regression.spec.ts (compare)
 *
 * Created for: Constitutional Audit Remediation
 * Tasks: T008, T012 (baseline), T082-T083 (comparison)
 */

import { expect, test } from '@playwright/test';

test.describe('Visual Regression - Constitutional Audit Remediation', () => {
	test.beforeEach(async ({ page }) => {
		// Navigate to dashboard
		await page.goto('/');

		// Wait for initial render
		await page.waitForLoadState('networkidle');
	});

	test('Dashboard default state', async ({ page }) => {
		// Capture dashboard in default/idle state
		await expect(page).toHaveScreenshot('dashboard-default.png', {
			fullPage: true,
			timeout: 10000
		});
	});

	test('HackRF panel active', async ({ page }) => {
		// Click HackRF panel to activate
		await page.click('[data-testid="hackrf-panel"], button:has-text("HackRF")');
		await page.waitForTimeout(500); // Wait for panel animation

		await expect(page).toHaveScreenshot('dashboard-hackrf-active.png', {
			fullPage: true,
			timeout: 10000
		});
	});

	test('Kismet panel active', async ({ page }) => {
		// Click Kismet panel to activate
		await page.click('[data-testid="kismet-panel"], button:has-text("Kismet")');
		await page.waitForTimeout(500);

		await expect(page).toHaveScreenshot('dashboard-kismet-active.png', {
			fullPage: true,
			timeout: 10000
		});
	});

	test('GPS panel active', async ({ page }) => {
		// Click GPS panel to activate
		await page.click('[data-testid="gps-panel"], button:has-text("GPS")');
		await page.waitForTimeout(500);

		await expect(page).toHaveScreenshot('dashboard-gps-active.png', {
			fullPage: true,
			timeout: 10000
		});
	});

	test('Tactical Map panel active', async ({ page }) => {
		// Click Tactical Map panel to activate
		await page.click(
			'[data-testid="map-panel"], button:has-text("Tactical Map"), button:has-text("Map")'
		);
		await page.waitForTimeout(500);

		await expect(page).toHaveScreenshot('dashboard-tactical-map-active.png', {
			fullPage: true,
			timeout: 10000
		});
	});

	test('Multiple panels active', async ({ page }) => {
		// Activate multiple panels simultaneously
		await page.click('[data-testid="hackrf-panel"], button:has-text("HackRF")');
		await page.waitForTimeout(300);
		await page.click('[data-testid="gps-panel"], button:has-text("GPS")');
		await page.waitForTimeout(300);

		await expect(page).toHaveScreenshot('dashboard-multi-panel-active.png', {
			fullPage: true,
			timeout: 10000
		});
	});

	test('Error state simulation', async ({ page }) => {
		// This test may require mocking API failures
		// For now, capture any visible error states

		// Attempt to trigger validation error (invalid frequency)
		const frequencyInput = page
			.locator('input[name="startFreq"], input[placeholder*="frequency"]')
			.first();
		if (await frequencyInput.isVisible({ timeout: 2000 }).catch(() => false)) {
			await frequencyInput.fill('-100');
			await page.click('button:has-text("Start"), button:has-text("Scan")').catch(() => {});
			await page.waitForTimeout(500);
		}

		await expect(page).toHaveScreenshot('dashboard-error-state.png', {
			fullPage: true,
			timeout: 10000
		});
	});

	test('Responsive view (if applicable)', async ({ page }) => {
		// Set viewport to tablet/mobile size
		await page.setViewportSize({ width: 768, height: 1024 });
		await page.waitForTimeout(500);

		await expect(page).toHaveScreenshot('dashboard-responsive.png', {
			fullPage: true,
			timeout: 10000
		});
	});
});

test.describe('Visual Regression - Component Migration', () => {
	// These tests will be used in P2 to verify Shadcn component styling

	test('Button components', async ({ page }) => {
		await page.goto('/');

		// Focus on button elements
		const buttons = page.locator('button');
		const count = await buttons.count();

		console.log(`Found ${count} button elements to verify`);

		await expect(page).toHaveScreenshot('components-buttons.png', {
			fullPage: true,
			timeout: 10000
		});
	});

	test('Input components', async ({ page }) => {
		await page.goto('/');

		// Focus on input elements
		const inputs = page.locator('input');
		const count = await inputs.count();

		console.log(`Found ${count} input elements to verify`);

		await expect(page).toHaveScreenshot('components-inputs.png', {
			fullPage: true,
			timeout: 10000
		});
	});

	test('Card components', async ({ page }) => {
		await page.goto('/');

		// Card-like containers
		await expect(page).toHaveScreenshot('components-cards.png', {
			fullPage: true,
			timeout: 10000
		});
	});
});
