import { describe, it, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser, type Page, expect } from '@playwright/test';

describe('Argos Application Integration', () => {
	let browser: Browser;
	let page: Page;

	beforeAll(async () => {
		browser = await chromium.launch();
		page = await browser.newPage();
	});

	afterAll(async () => {
		await browser.close();
	});

	it('should load the home page', async () => {
		await page.goto('http://localhost:5173');
		await expect(page).toHaveTitle(/Argos/);
	});

	it('should navigate to HackRF page', async () => {
		await page.goto('http://localhost:5173');
		await page.click('a[href="/hackrf"]');
		await expect(page).toHaveURL(/.*\/hackrf/);
	});

	it('should navigate to Kismet page', async () => {
		await page.goto('http://localhost:5173');
		await page.click('a[href="/kismet"]');
		await expect(page).toHaveURL(/.*\/kismet/);
	});

	it('should navigate to TAK page', async () => {
		await page.goto('http://localhost:5173');
		await page.click('a[href="/tak"]');
		await expect(page).toHaveURL(/.*\/tak/);
	});
});
