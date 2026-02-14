/**
 * CSS Loading Utilities
 * Helps prevent FOUC (Flash of Unstyled Content) and optimize CSS loading
 */

export interface CSSLoadOptions {
	preload?: boolean;
	media?: string;
	priority?: 'high' | 'low';
}

/**
 * Dynamically loads CSS with preloading support
 * @param href - Path to CSS file
 * @param options - Loading options
 * @returns Promise that resolves when CSS is loaded
 */
export function loadCSS(href: string, options: CSSLoadOptions = {}): Promise<void> {
	return new Promise((resolve, reject) => {
		// Check if already loaded
		const existing = document.querySelector(`link[href="${href}"]`);
		if (existing) {
			resolve();
			return;
		}

		const link = document.createElement('link');
		link.rel = options.preload ? 'preload' : 'stylesheet';
		link.href = href;
		link.media = options.media || 'all';

		if (options.preload) {
			link.as = 'style';
			link.onload = () => {
				// Convert preload to stylesheet
				link.rel = 'stylesheet';
				resolve();
			};
		} else {
			link.onload = () => resolve();
		}

		link.onerror = () => reject(new Error(`Failed to load CSS: ${href}`));

		// Add priority hint if supported
		if (options.priority && 'fetchPriority' in link) {
		// Safe: HTMLLinkElement extended with optional fetchPriority property for resource loading priority hints
			(link as HTMLLinkElement & { fetchPriority?: 'high' | 'low' }).fetchPriority =
				options.priority;
		}

		document.head.appendChild(link);
	});
}

/**
 * Preloads multiple CSS files in parallel
 * @param cssFiles - Array of CSS file paths
 * @returns Promise that resolves when all CSS is loaded
 */
export function preloadCSS(cssFiles: string[]): Promise<void[]> {
	return Promise.all(cssFiles.map((href) => loadCSS(href, { preload: true, priority: 'high' })));
}

/**
 * Checks if critical CSS has been applied by testing a CSS custom property
 * @returns boolean indicating if critical CSS is active
 */
export function isCriticalCSSLoaded(): boolean {
	if (typeof window === 'undefined') return false;

	const testElement = document.createElement('div');
	testElement.style.display = 'none';
	document.body.appendChild(testElement);

	const bgPrimary = getComputedStyle(testElement).getPropertyValue('--bg-primary');
	document.body.removeChild(testElement);

	return bgPrimary.trim() === '#0a0a0a';
}

/**
 * Waits for critical CSS to be applied before showing content
 * @param maxWaitTime - Maximum time to wait in milliseconds (default: 100ms)
 * @returns Promise that resolves when critical CSS is ready
 */
export function waitForCriticalCSS(maxWaitTime: number = 100): Promise<void> {
	return new Promise((resolve) => {
		const startTime = Date.now();

		const checkCSS = () => {
			if (isCriticalCSSLoaded() || Date.now() - startTime >= maxWaitTime) {
				resolve();
			} else {
				requestAnimationFrame(checkCSS);
			}
		};

		checkCSS();
	});
}

/**
 * Adds css-loaded class to body when all stylesheets are ready
 * Should be called from the main layout component
 */
export function markCSSLoaded(): void {
	if (typeof window === 'undefined') return;

	// Wait for critical CSS and then mark as loaded
	waitForCriticalCSS().then(() => {
		requestAnimationFrame(() => {
			document.body.classList.add('css-loaded');
		});
	});
}
