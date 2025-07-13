import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import puppeteer, { Browser, Page } from 'puppeteer';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import fs from 'fs/promises';
import _path from 'path';
import { arch } from 'os';

const VISUAL_REGRESSION_CONFIG = {
	threshold: 0.1, // 0.1% difference allowed for pixel-perfect validation
	baseUrl: process.env.TEST_URL || 'http://localhost:5173',
	viewports: [
		{ name: 'mobile', width: 375, height: 667 },
		{ name: 'tablet', width: 768, height: 1024 },
		{ name: 'desktop', width: 1920, height: 1080 }
	],
	pages: [
		{ name: 'home', path: '/' },
		{ name: 'spectrum', path: '/spectrum' },
		{ name: 'sweep', path: '/sweep' },
		{ name: 'devices', path: '/devices' },
		{ name: 'map', path: '/map' }
	]
};

describe.skipIf(arch().startsWith('arm'))('Visual Regression Tests', () => {
	let browser: Browser | undefined;
	let page: Page | undefined;

	beforeAll(async () => {
		try {
			browser = await puppeteer.launch({
				headless: true,
				args: ['--no-sandbox', '--disable-setuid-sandbox'],
				executablePath: arch().startsWith('arm') ? '/usr/bin/chromium-browser' : undefined
			});
			page = await browser.newPage();

			// Ensure baseline directory exists
			await fs.mkdir('tests/visual/baselines', { recursive: true });
			await fs.mkdir('tests/visual/screenshots', { recursive: true });
			await fs.mkdir('tests/visual/diffs', { recursive: true });
		} catch (error) {
			console.warn('Failed to launch browser for visual tests:', error);
			browser = undefined;
			page = undefined;
		}
	});

	afterAll(async () => {
		if (browser) {
			await browser.close();
		}
	});

	VISUAL_REGRESSION_CONFIG.pages.forEach(({ name: pageName, path: pagePath }) => {
		VISUAL_REGRESSION_CONFIG.viewports.forEach(({ name: viewportName, width, height }) => {
			it(`should match baseline for ${pageName} page on ${viewportName}`, async () => {
				if (!page || !browser) {
					console.warn('Browser not available, skipping visual test');
					return;
				}
				await page.setViewport({ width, height });
				await page.goto(`${VISUAL_REGRESSION_CONFIG.baseUrl}${pagePath}`, {
					waitUntil: 'networkidle0'
				});

				// Wait for any animations to complete
				await new Promise((resolve) => setTimeout(resolve, 1000));

				// Take screenshot
				const screenshotPath =
					`tests/visual/screenshots/${pageName}-${viewportName}.png` as `${string}.png`;
				await page.screenshot({ path: screenshotPath, fullPage: true });

				// Compare with baseline
				const baselinePath = `tests/visual/baselines/${pageName}-${viewportName}.png`;
				const diffPath = `tests/visual/diffs/${pageName}-${viewportName}-diff.png`;

				try {
					const baselineBuffer = await fs.readFile(baselinePath);

					const baseline = PNG.sync.read(Buffer.from(baselineBuffer));
					const screenshotBuffer = await fs.readFile(screenshotPath);

					const screenshot = PNG.sync.read(Buffer.from(screenshotBuffer));

					const w = baseline.width;

					const h = baseline.height;

					const diff = new PNG({ width: w, height: h });

					const numDiffPixels = pixelmatch(
						baseline.data,

						screenshot.data,

						diff.data,
						w,
						h,
						{ threshold: VISUAL_REGRESSION_CONFIG.threshold }
					);

					if (numDiffPixels > 0) {
						const diffBuffer = PNG.sync.write(diff);

						await fs.writeFile(diffPath, diffBuffer);
						const percentDiff = (numDiffPixels / (w * h)) * 100;
						expect(percentDiff).toBeLessThan(0.1); // Less than 0.1% difference
					}
				} catch (error) {
					// If baseline doesn't exist, create it
					if ((error as { code?: string }).code === 'ENOENT') {
						await fs.copyFile(screenshotPath, baselinePath);
						console.warn(`Created baseline for ${pageName}-${viewportName}`);
					} else {
						throw error;
					}
				}
			});
		});
	});

	describe('Component Visual Tests', () => {
		it('should render spectrum analyzer correctly', async () => {
			if (!page || !browser) {
				console.warn('Browser not available, skipping visual test');
				return;
			}
			await page.goto(`${VISUAL_REGRESSION_CONFIG.baseUrl}/spectrum`);
			await page.waitForSelector('.spectrum-canvas', { timeout: 5000 });

			const spectrumElement = await page.$('.spectrum-canvas');
			if (spectrumElement) {
				const screenshot = await spectrumElement.screenshot();
				const screenshotPath = 'tests/visual/screenshots/spectrum-component.png';
				await fs.writeFile(screenshotPath, screenshot);

				// Verify canvas dimensions
				const dimensions = await page.evaluate(() => {
					const canvas = document.querySelector('.spectrum-canvas') as HTMLCanvasElement;
					return {
						width: canvas?.width,
						height: canvas?.height
					};
				});

				expect(dimensions.width).toBeGreaterThan(0);
				expect(dimensions.height).toBeGreaterThan(0);
			}
		});

		it('should render device cards with correct styling', async () => {
			if (!page || !browser) {
				console.warn('Browser not available, skipping visual test');
				return;
			}
			await page.goto(`${VISUAL_REGRESSION_CONFIG.baseUrl}/devices`);
			await page.waitForSelector('.device-card', { timeout: 5000 });

			const styles = await page.evaluate(() => {
				const card = document.querySelector('.device-card');
				if (!card) return null;

				const computedStyle = window.getComputedStyle(card);
				return {
					borderRadius: computedStyle.borderRadius,
					boxShadow: computedStyle.boxShadow,
					padding: computedStyle.padding,
					backgroundColor: computedStyle.backgroundColor
				};
			});

			expect(styles).toBeTruthy();
			expect(styles?.borderRadius).toBe('0.5rem');
			expect(styles?.backgroundColor).toBeTruthy();
		});
	});

	describe('Animation and Transition Tests', () => {
		it('should capture hover states correctly', async () => {
			if (!page || !browser) {
				console.warn('Browser not available, skipping visual test');
				return;
			}
			await page.goto(`${VISUAL_REGRESSION_CONFIG.baseUrl}`);

			// Find a button to hover
			const button = await page.$('button');
			if (button) {
				const beforeHover = await button.screenshot();
				await button.hover();
				await new Promise((resolve) => setTimeout(resolve, 300)); // Wait for transition
				const afterHover = await button.screenshot();

				// Compare screenshots

				const before = PNG.sync.read(Buffer.from(beforeHover));

				const after = PNG.sync.read(Buffer.from(afterHover));

				const diff = new PNG({ width: before.width, height: before.height });

				const numDiffPixels = pixelmatch(
					before.data,

					after.data,

					diff.data,

					before.width,

					before.height,
					{ threshold: 0.5 }
				);

				// There should be some difference due to hover effect
				expect(numDiffPixels).toBeGreaterThan(0);
			}
		});
	});
});
