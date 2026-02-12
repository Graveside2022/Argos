/**
 * Argos Application Integration Tests
 *
 * Requires: Running dev server at localhost:5173, Playwright chromium browser
 * Skips gracefully when environment is not available.
 */

import { describe, it, afterAll } from 'vitest';
import { isServerAvailable, restoreRealFetch } from '../helpers/server-check';

restoreRealFetch();

let browser: import('@playwright/test').Browser | null = null;
let page: import('@playwright/test').Page | null = null;
let canRun = false;

try {
	// Check if Playwright is available
	const { chromium } = await import('@playwright/test');
	const serverUp = await isServerAvailable();

	if (serverUp) {
		try {
			browser = await chromium.launch();
			page = await browser.newPage();
			canRun = true;
		} catch {
			// Chromium binary not available
			canRun = false;
		}
	}
} catch {
	// Playwright not installed or chromium not available
	canRun = false;
}

const { expect } = await import('@playwright/test');

describe.runIf(canRun)('Argos Application Integration', () => {
	afterAll(async () => {
		if (browser) {
			await browser.close();
		}
	});

	it('should load the home page', async () => {
		await page!.goto('http://localhost:5173');
		await expect(page!).toHaveTitle(/Argos/);
	});

	it('should navigate to HackRF page', async () => {
		await page!.goto('http://localhost:5173');
		await page!.click('a[href="/hackrf"]');
		await expect(page!).toHaveURL(/.*\/hackrf/);
	});

	it('should navigate to Kismet page', async () => {
		await page!.goto('http://localhost:5173');
		await page!.click('a[href="/kismet"]');
		await expect(page!).toHaveURL(/.*\/kismet/);
	});

	it('should navigate to TAK page', async () => {
		await page!.goto('http://localhost:5173');
		await page!.click('a[href="/tak"]');
		await expect(page!).toHaveURL(/.*\/tak/);
	});
});
