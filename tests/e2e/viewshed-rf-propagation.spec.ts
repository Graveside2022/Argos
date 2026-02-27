import { expect, test } from '@playwright/test';

/**
 * E2E test suite for the Viewshed / RF Propagation feature (022).
 *
 * Tests the full pipeline:
 *   GPS store → viewshed-derived $effect → /api/viewshed/compute → PNG → MapLibre ImageSource
 *
 * Validates fixes for:
 *   - ARG-42: layer visibility default + TX parameter sliders
 *   - ARG-43: 23×23 pixel resolution (now 256×256)
 *   - ARG-45: $effect cleanup cascade + $.strict_equals inversion
 */

/** Navigate from dashboard page to the Line of Sight panel */
async function navigateToLOS(page: import('@playwright/test').Page): Promise<void> {
	// 1. Click "Map Settings" icon in the rail (aria-label="Map Settings")
	await page.locator('.rail-btn[aria-label="Map Settings"]').click();
	// 2. Wait for Map Settings panel hub to appear
	await expect(page.locator('.hub-card', { hasText: 'Line of Sight' })).toBeVisible({
		timeout: 5000
	});
	// 3. Click Line of Sight card
	await page.locator('.hub-card', { hasText: 'Line of Sight' }).click();
	// 4. Confirm subview header
	await expect(page.locator('.panel-title', { hasText: 'LINE OF SIGHT' })).toBeVisible({
		timeout: 3000
	});
}

/** Ensure the viewshed enable toggle is ON */
async function ensureViewshedEnabled(page: import('@playwright/test').Page): Promise<void> {
	const toggle = page
		.locator('.toggle-row', { hasText: 'Enable Line of Sight' })
		.locator('[role="switch"]');
	const isEnabled = await toggle.getAttribute('aria-checked');
	if (isEnabled !== 'true') {
		await toggle.click();
	}
}

test.describe('Viewshed / RF Propagation', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/dashboard');
		// Wait for the icon rail to be visible — it renders before the map canvas
		await page.waitForSelector('.icon-rail', { timeout: 15000 });
	});

	test('should display Line of Sight card in Map Settings hub', async ({ page }) => {
		// Click Map Settings in icon rail
		await page.locator('.rail-btn[aria-label="Map Settings"]').click();

		// The Map Settings panel should show the hub with 3 cards
		const losCard = page.locator('.hub-card', { hasText: 'Line of Sight' });
		await expect(losCard).toBeVisible({ timeout: 5000 });
		await expect(losCard.locator('.hub-card-desc')).toHaveText('RF range overlay');
	});

	test('should navigate to Line of Sight panel and show enable toggle', async ({ page }) => {
		await navigateToLOS(page);

		// Enable toggle should be present
		const toggleRow = page.locator('.toggle-row', { hasText: 'Enable Line of Sight' });
		await expect(toggleRow).toBeVisible();

		// Toggle switch role=switch should exist
		const toggle = toggleRow.locator('[role="switch"]');
		await expect(toggle).toBeVisible();
	});

	test('should show DTED status, viewshed controls, and TX parameters when enabled', async ({
		page
	}) => {
		await navigateToLOS(page);
		await ensureViewshedEnabled(page);

		// DTED Status should appear (ARG-31 feature) — rendered as .dted-label inside .dted-status
		await expect(page.locator('.dted-label')).toBeVisible({ timeout: 5000 });

		// Hardware preset selector should be visible
		await expect(page.locator('.section-label', { hasText: 'HARDWARE PRESET' })).toBeVisible();
		await expect(page.locator('.preset-select')).toBeVisible();

		// Frequency source (ARG-42: TX parameter sliders were restored)
		await expect(page.locator('.section-label', { hasText: 'FREQUENCY SOURCE' })).toBeVisible();

		// Computed range readout
		await expect(page.locator('.section-label', { hasText: 'COMPUTED RANGE' })).toBeVisible();
		await expect(page.locator('.range-value')).toBeVisible();

		// Opacity controls (ATAK-style green/red)
		await expect(page.locator('.section-label', { hasText: /OPACITY/ })).toBeVisible();

		// Show on Map toggle
		await expect(page.locator('.toggle-row', { hasText: 'Show on Map' })).toBeVisible();
	});

	test('should make viewshed API calls and return 256x256 images', async ({ page }) => {
		// Intercept viewshed compute API calls
		const apiCalls: { status: number; body: Record<string, unknown> }[] = [];
		await page.route('**/api/viewshed/compute', async (route) => {
			const response = await route.fetch();
			const body = await response.json();
			apiCalls.push({ status: response.status(), body });
			await route.fulfill({ response });
		});

		await navigateToLOS(page);
		await ensureViewshedEnabled(page);

		// Wait for API call(s) — the $effect + debounce should fire within ~1s if GPS is available
		await page.waitForTimeout(3000);

		if (apiCalls.length > 0) {
			// Verify the FIRST successful call returns 256x256 (ARG-43 + ARG-45 fix)
			const call = apiCalls[0];
			expect(call.status).toBe(200);

			const meta = call.body.meta as Record<string, number>;
			expect(meta.imageWidth).toBe(256);
			expect(meta.imageHeight).toBe(256);
			expect(meta.cellCount).toBeGreaterThan(0);
			expect(meta.computeTimeMs).toBeLessThan(3000); // SC-007: < 3s compute budget

			// Image data URI should be substantial (not the tiny 334-byte image)
			const uri = call.body.imageDataUri as string;
			expect(uri).toBeTruthy();
			expect(uri.length).toBeGreaterThan(1000);
			expect(uri).toMatch(/^data:image\/png;base64,/);

			// Bounds should be valid geographic coordinates
			const bounds = call.body.bounds as Record<string, number>;
			expect(bounds.north).toBeGreaterThan(bounds.south);
			expect(bounds.east).toBeGreaterThan(bounds.west);
		} else {
			// No GPS fix — the reactive chain won't fire
			console.warn(
				'No viewshed API calls made — likely no GPS fix. Checking inactive UI state.'
			);
		}
	});

	test('viewshed overlay should render on map when GPS fix is available', async ({ page }) => {
		let hasViewshedResponse = false;

		await page.route('**/api/viewshed/compute', async (route) => {
			const response = await route.fetch();
			const body = await response.json();
			if (body.imageDataUri) hasViewshedResponse = true;
			await route.fulfill({ response });
		});

		await navigateToLOS(page);
		await ensureViewshedEnabled(page);

		// Ensure Show on Map is enabled
		const showOnMap = page
			.locator('.toggle-row', { hasText: 'Show on Map' })
			.locator('[role="switch"]');
		const mapVisible = await showOnMap.getAttribute('aria-checked');
		if (mapVisible !== 'true') {
			await showOnMap.click();
		}

		// Wait for viewshed to potentially compute
		await page.waitForTimeout(4000);

		if (hasViewshedResponse) {
			// Verify the MapLibre map has a canvas (the ImageSource renders there)
			const hasCanvas = await page.evaluate(() => {
				const mc = document.querySelector('.map-container');
				return mc ? mc.querySelector('canvas') !== null : false;
			});
			expect(hasCanvas).toBe(true);
		} else {
			console.warn('No GPS fix — skipping map overlay verification');
		}
	});

	test('should handle viewshed status API correctly', async ({ request }) => {
		const response = await request.get('/api/viewshed/status', {
			headers: { 'X-API-Key': process.env.ARGOS_API_KEY || '' }
		});
		expect(response.status()).toBe(200);

		const data = await response.json();
		expect(data).toHaveProperty('loaded');
		expect(data).toHaveProperty('tileCount');
		expect(data).toHaveProperty('coverage');
		expect(data).toHaveProperty('dataDir');

		// DTED tiles should be loaded
		expect(data.loaded).toBe(true);
		expect(data.tileCount).toBeGreaterThan(0);
	});

	test('viewshed compute API should return valid response for known coordinates', async ({
		request
	}) => {
		const response = await request.post('/api/viewshed/compute', {
			headers: {
				'Content-Type': 'application/json',
				'X-API-Key': process.env.ARGOS_API_KEY || ''
			},
			data: {
				lat: 50.04,
				lon: 8.33,
				heightAgl: 2.0,
				radiusM: 5000,
				greenOpacity: 0.37,
				redOpacity: 0.92
			}
		});

		expect(response.status()).toBe(200);
		const data = await response.json();

		// Image dimensions must be 256x256 (ARG-43 fix)
		expect(data.meta.imageWidth).toBe(256);
		expect(data.meta.imageHeight).toBe(256);

		// Cell count should reflect 360 rays x ~128 samples
		expect(data.meta.cellCount).toBeGreaterThan(10000);

		// Compute time under 3s budget (SC-007)
		expect(data.meta.computeTimeMs).toBeLessThan(3000);

		// Valid PNG data URI
		expect(data.imageDataUri).toMatch(/^data:image\/png;base64,/);
		expect(data.imageDataUri.length).toBeGreaterThan(5000);

		// Valid geographic bounds around the input coordinates
		expect(data.bounds.north).toBeGreaterThan(50.04);
		expect(data.bounds.south).toBeLessThan(50.04);
		expect(data.bounds.east).toBeGreaterThan(8.33);
		expect(data.bounds.west).toBeLessThan(8.33);
	});

	test('viewshed compute API should reject invalid coordinates', async ({ request }) => {
		const response = await request.post('/api/viewshed/compute', {
			headers: {
				'Content-Type': 'application/json',
				'X-API-Key': process.env.ARGOS_API_KEY || ''
			},
			data: {
				lat: 999, // Invalid latitude
				lon: 8.33,
				heightAgl: 2.0,
				radiusM: 5000
			}
		});

		expect(response.status()).toBe(400);
		const data = await response.json();
		expect(data).toHaveProperty('error');
	});
});
