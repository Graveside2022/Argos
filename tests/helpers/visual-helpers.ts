import fs from 'fs/promises';
import path from 'path';
import { PNG } from 'pngjs';
import type { PNG as PNGType } from 'pngjs';

// Type definition for pixelmatch library
interface PixelmatchOptions {
	threshold?: number;
	includeAA?: boolean;
	alpha?: number;
	aaColor?: [number, number, number];
	diffColor?: [number, number, number];
	diffColorAlt?: [number, number, number];
}

type PixelmatchFunction = (
	img1: Uint8Array | Buffer,
	img2: Uint8Array | Buffer,
	output: Uint8Array | Buffer | null,
	width: number,
	height: number,
	options?: PixelmatchOptions
) => number;

// Import pixelmatch with proper typing
import pixelmatchImport from 'pixelmatch';
const pixelmatch = pixelmatchImport as unknown as PixelmatchFunction;

// Type-safe PNG interface to avoid 'any' usage
interface PNGSync {
	read: (buffer: Buffer) => PNGType;
	write: (png: PNGType) => Buffer;
}

interface PNGConstructor {
	new (options: { width: number; height: number }): PNGType;
	sync: PNGSync;
}

interface SafePNGType extends PNGType {
	width: number;
	height: number;
	data: Buffer;
}

// Type guard for PNG constructor (unused but kept for potential future use)
function _isPNGConstructor(obj: unknown): obj is PNGConstructor {
	return typeof obj === 'function' && obj !== null && typeof obj === 'object';
}

export interface VisualComparisonResult {
	passed: boolean;
	diffPixels: number;
	diffPercentage: number;
	diffImagePath?: string;
}

export class VisualTestHelper {
	private baselineDir: string;
	private screenshotDir: string;
	private diffDir: string;

	constructor(testDir = 'tests/visual') {
		this.baselineDir = path.join(testDir, 'baselines');
		this.screenshotDir = path.join(testDir, 'screenshots');
		this.diffDir = path.join(testDir, 'diffs');
	}

	async ensureDirectories() {
		await fs.mkdir(this.baselineDir, { recursive: true });
		await fs.mkdir(this.screenshotDir, { recursive: true });
		await fs.mkdir(this.diffDir, { recursive: true });
	}

	async compareImages(imageName: string, threshold = 0.1): Promise<VisualComparisonResult> {
		const baselinePath = path.join(this.baselineDir, `${imageName}.png`);
		const screenshotPath = path.join(this.screenshotDir, `${imageName}.png`);
		const diffPath = path.join(this.diffDir, `${imageName}-diff.png`);

		try {
			const baselineBuffer = await fs.readFile(baselinePath);
			const screenshotBuffer = await fs.readFile(screenshotPath);

			// Use type assertion to safely access PNG functionality
			const PNGClass = PNG as unknown as PNGConstructor;
			const baseline = PNGClass.sync.read(baselineBuffer) as SafePNGType;
			const screenshot = PNGClass.sync.read(screenshotBuffer) as SafePNGType;

			if (baseline.width !== screenshot.width || baseline.height !== screenshot.height) {
				return {
					passed: false,
					diffPixels: -1,
					diffPercentage: 100,
					diffImagePath: undefined
				};
			}

			const { width, height } = baseline;
			const diff = new PNGClass({ width, height }) as SafePNGType;

			const diffPixels = pixelmatch(
				baseline.data,
				screenshot.data,
				diff.data,
				width,
				height,
				{ threshold }
			);

			const totalPixels = width * height;
			const diffPercentage = (diffPixels / totalPixels) * 100;

			if (diffPixels > 0) {
				const diffBuffer = PNGClass.sync.write(diff);
				await fs.writeFile(diffPath, diffBuffer);
			}

			return {
				passed: diffPercentage < 0.1, // Less than 0.1% difference for pixel-perfect
				diffPixels: diffPixels,
				diffPercentage,
				diffImagePath: diffPixels > 0 ? diffPath : undefined
			};
		} catch (error: unknown) {
			// If baseline doesn't exist, create it
			if (
				(error as { code?: string }).code === 'ENOENT' &&
				!(await this.fileExists(baselinePath))
			) {
				await fs.copyFile(screenshotPath, baselinePath);
				console.error(`Created baseline for ${imageName}`);
				return {
					passed: true,
					diffPixels: 0,
					diffPercentage: 0
				};
			}
			throw error;
		}
	}

	async generateBaseline(imageName: string, imageData: Buffer) {
		const baselinePath = path.join(this.baselineDir, `${imageName}.png`);
		await fs.writeFile(baselinePath, imageData);
	}

	async saveScreenshot(imageName: string, imageData: Buffer) {
		const screenshotPath = path.join(this.screenshotDir, `${imageName}.png`);
		await fs.writeFile(screenshotPath, imageData);
		return screenshotPath;
	}

	async cleanupDiffs() {
		const files = await fs.readdir(this.diffDir);
		await Promise.all(files.map((file) => fs.unlink(path.join(this.diffDir, file))));
	}

	private async fileExists(filePath: string): Promise<boolean> {
		try {
			await fs.access(filePath);
			return true;
		} catch {
			return false;
		}
	}

	// Helper for generating HTML report
	async generateReport(results: Map<string, VisualComparisonResult>) {
		const reportPath = path.join('tests/visual', 'report.html');

		const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Visual Regression Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .test { margin-bottom: 30px; border: 1px solid #ddd; padding: 15px; }
    .passed { background-color: #d4edda; }
    .failed { background-color: #f8d7da; }
    .images { display: flex; gap: 20px; margin-top: 15px; }
    .image-container { flex: 1; }
    img { max-width: 100%; border: 1px solid #ccc; }
    h3 { margin-top: 0; }
    .stats { margin: 10px 0; }
  </style>
</head>
<body>
  <h1>Visual Regression Test Report</h1>
  <p>Generated: ${new Date().toISOString()}</p>
  
  ${Array.from(results.entries())
		.map(
			([name, result]) => `
    <div class="test ${result.passed ? 'passed' : 'failed'}">
      <h3>${name}</h3>
      <div class="stats">
        <strong>Status:</strong> ${result.passed ? 'PASSED' : 'FAILED'}<br>
        <strong>Diff Pixels:</strong> ${result.diffPixels}<br>
        <strong>Diff Percentage:</strong> ${result.diffPercentage.toFixed(3)}%
      </div>
      ${
			!result.passed
				? `
        <div class="images">
          <div class="image-container">
            <h4>Baseline</h4>
            <img src="baselines/${name}.png" alt="Baseline">
          </div>
          <div class="image-container">
            <h4>Current</h4>
            <img src="screenshots/${name}.png" alt="Current">
          </div>
          ${
				result.diffImagePath
					? `
            <div class="image-container">
              <h4>Difference</h4>
              <img src="diffs/${name}-diff.png" alt="Difference">
            </div>
          `
					: ''
			}
        </div>
      `
				: ''
		}
    </div>
  `
		)
		.join('')}
</body>
</html>
    `;

		await fs.writeFile(reportPath, html);
		return reportPath;
	}
}

// CSS verification helper
export class CSSTestHelper {
	static async verifyCSSProperty(
		page: import('@playwright/test').Page,
		selector: string,
		property: string,
		expectedValue: string
	): Promise<boolean> {
		const actualValue = await page.evaluate(
			({ sel, prop }: { sel: string; prop: string }) => {
				const element = document.querySelector(sel);
				if (!element) return null;
				return window.getComputedStyle(element).getPropertyValue(prop);
			},
			{ sel: selector, prop: property }
		);

		return actualValue === expectedValue;
	}

	static async verifyLayout(
		page: import('@playwright/test').Page,
		selector: string,
		expectedLayout: {
			width?: number;
			height?: number;
			x?: number;
			y?: number;
		}
	): Promise<boolean> {
		const boundingBox = await page.locator(selector).boundingBox();
		if (!boundingBox) return false;

		let passed = true;
		if (expectedLayout.width !== undefined) {
			passed = passed && Math.abs(boundingBox.width - expectedLayout.width) < 1;
		}
		if (expectedLayout.height !== undefined) {
			passed = passed && Math.abs(boundingBox.height - expectedLayout.height) < 1;
		}
		if (expectedLayout.x !== undefined) {
			passed = passed && Math.abs(boundingBox.x - expectedLayout.x) < 1;
		}
		if (expectedLayout.y !== undefined) {
			passed = passed && Math.abs(boundingBox.y - expectedLayout.y) < 1;
		}

		return passed;
	}
}
