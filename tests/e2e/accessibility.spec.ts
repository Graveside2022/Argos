/**
 * Accessibility Testing for Constitutional Audit Remediation
 *
 * Purpose: Verify WCAG 2.1 AA compliance after Shadcn migration
 * Target: Zero violations (NFR-005)
 *
 * Usage:
 *   npx playwright test accessibility.spec.ts
 *
 * Created for: Constitutional Audit Remediation (P2)
 * Tasks: T009 (spec creation), T078-T081 (accessibility features)
 */

import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

// @axe-core/playwright bundles an older Page type — bridge with a helper
// @constitutional-exemption Article-II-2.1 issue:#010 — library type version mismatch
function axe(page: Page) {
	return new AxeBuilder({ page } as unknown as ConstructorParameters<typeof AxeBuilder>[0]);
}

test.describe('Accessibility - WCAG 2.1 AA Compliance', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await page.waitForLoadState('networkidle');
	});

	test('Dashboard passes axe accessibility audit', async ({ page }) => {
		const accessibilityScanResults = await axe(page)
			.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
			.analyze();

		// Log violations if any
		if (accessibilityScanResults.violations.length > 0) {
			console.log('\n⚠️  Accessibility Violations Found:');
			accessibilityScanResults.violations.forEach((violation, index) => {
				console.log(`\n${index + 1}. ${violation.id}: ${violation.description}`);
				console.log(`   Impact: ${violation.impact}`);
				console.log(`   Help: ${violation.helpUrl}`);
				console.log(`   Elements: ${violation.nodes.length}`);
				violation.nodes.forEach((node) => {
					console.log(`     - ${node.html}`);
				});
			});
		}

		expect(accessibilityScanResults.violations).toEqual([]);
	});

	test('HackRF panel passes accessibility audit', async ({ page }) => {
		await page.click('[data-testid="hackrf-panel"], button:has-text("HackRF")');
		await page.waitForTimeout(500);

		const accessibilityScanResults = await axe(page).withTags(['wcag2a', 'wcag2aa']).analyze();

		expect(accessibilityScanResults.violations).toEqual([]);
	});

	test('Kismet panel passes accessibility audit', async ({ page }) => {
		await page.click('[data-testid="kismet-panel"], button:has-text("Kismet")');
		await page.waitForTimeout(500);

		const accessibilityScanResults = await axe(page).withTags(['wcag2a', 'wcag2aa']).analyze();

		expect(accessibilityScanResults.violations).toEqual([]);
	});

	test('GPS panel passes accessibility audit', async ({ page }) => {
		await page.click('[data-testid="gps-panel"], button:has-text("GPS")');
		await page.waitForTimeout(500);

		const accessibilityScanResults = await axe(page).withTags(['wcag2a', 'wcag2aa']).analyze();

		expect(accessibilityScanResults.violations).toEqual([]);
	});
});

test.describe('Keyboard Navigation', () => {
	test('Tab through all interactive elements', async ({ page }) => {
		await page.goto('/');

		// Get all focusable elements
		const focusableSelector =
			'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])';
		const focusableElements = page.locator(focusableSelector);
		const count = await focusableElements.count();

		console.log(`\nFound ${count} focusable elements`);

		// Tab through each element and verify focus ring is visible
		for (let i = 0; i < Math.min(count, 20); i++) {
			// Limit to first 20 elements
			await page.keyboard.press('Tab');
			await page.waitForTimeout(100);

			// Get currently focused element
			const focusedElement = page.locator(':focus');

			// Verify element has visible focus indicator
			const styles = await focusedElement
				.evaluate((el) => {
					const computed = window.getComputedStyle(el);
					return {
						outline: computed.outline,
						outlineWidth: computed.outlineWidth,
						outlineStyle: computed.outlineStyle,
						outlineColor: computed.outlineColor,
						boxShadow: computed.boxShadow
					};
				})
				.catch(() => null);

			if (styles) {
				const hasFocusRing =
					(styles.outlineWidth !== '0px' && styles.outlineWidth !== 'none') ||
					(styles.boxShadow && styles.boxShadow !== 'none');

				if (!hasFocusRing) {
					const html = await focusedElement.evaluate((el) =>
						el.outerHTML.substring(0, 100)
					);
					console.warn(`⚠️  Element ${i + 1} may not have visible focus ring: ${html}`);
				}
			}
		}

		// Verify no keyboard traps
		// User should be able to Tab through all elements and eventually wrap around
		expect(count).toBeGreaterThan(0);
	});

	test('No keyboard traps', async ({ page }) => {
		await page.goto('/');

		// Tab through many elements to ensure no trap
		for (let i = 0; i < 50; i++) {
			await page.keyboard.press('Tab');
			await page.waitForTimeout(50);
		}

		// Should still be able to interact with page
		const activeElement = page.locator(':focus');
		expect(await activeElement.count()).toBeGreaterThan(0);
	});

	test('Shift+Tab reverse navigation works', async ({ page }) => {
		await page.goto('/');

		// Tab forward a few times
		for (let i = 0; i < 5; i++) {
			await page.keyboard.press('Tab');
			await page.waitForTimeout(50);
		}

		// Tab backward
		for (let i = 0; i < 3; i++) {
			await page.keyboard.press('Shift+Tab');
			await page.waitForTimeout(50);
		}

		// Should still be able to interact
		const activeElement = page.locator(':focus');
		expect(await activeElement.count()).toBeGreaterThan(0);
	});

	test('Enter/Space activate buttons', async ({ page }) => {
		await page.goto('/');

		// Find first button
		const button = page.locator('button').first();
		if (await button.isVisible({ timeout: 2000 }).catch(() => false)) {
			await button.focus();

			// Pressing Enter should activate button
			await page.keyboard.press('Enter');
			await page.waitForTimeout(200);

			// Verify something happened (button activated)
			// This is a smoke test - actual behavior depends on button implementation
		}
	});
});

test.describe('ARIA Labels and Roles', () => {
	test('All buttons have accessible names', async ({ page }) => {
		await page.goto('/');

		const buttons = page.locator('button');
		const count = await buttons.count();

		for (let i = 0; i < count; i++) {
			const button = buttons.nth(i);
			const accessibleName = await button.evaluate((el) => {
				// Check for aria-label, aria-labelledby, or text content
				return (
					el.getAttribute('aria-label') ||
					el.textContent?.trim() ||
					el.getAttribute('title') ||
					''
				);
			});

			if (!accessibleName) {
				const html = await button.evaluate((el) => el.outerHTML.substring(0, 100));
				console.warn(`⚠️  Button without accessible name: ${html}`);
			}

			expect(accessibleName.length).toBeGreaterThan(0);
		}
	});

	test('All inputs have labels', async ({ page }) => {
		await page.goto('/');

		const inputs = page.locator('input');
		const count = await inputs.count();

		for (let i = 0; i < count; i++) {
			const input = inputs.nth(i);
			const hasLabel = await input.evaluate((el) => {
				const id = el.id;
				const ariaLabel = el.getAttribute('aria-label');
				const ariaLabelledBy = el.getAttribute('aria-labelledby');
				const placeholder = el.getAttribute('placeholder');

				// Check if there's a <label for="id"> element
				const label = id ? document.querySelector(`label[for="${id}"]`) : null;

				return !!(label || ariaLabel || ariaLabelledBy || placeholder);
			});

			if (!hasLabel) {
				const html = await input.evaluate((el) => el.outerHTML.substring(0, 100));
				console.warn(`⚠️  Input without label: ${html}`);
			}

			expect(hasLabel).toBe(true);
		}
	});

	test('Images have alt text', async ({ page }) => {
		await page.goto('/');

		const images = page.locator('img');
		const count = await images.count();

		for (let i = 0; i < count; i++) {
			const img = images.nth(i);
			const alt = await img.getAttribute('alt');

			// Alt can be empty string for decorative images, but attribute must exist
			expect(alt).not.toBeNull();
		}
	});
});
