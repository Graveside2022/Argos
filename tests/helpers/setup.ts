import { beforeAll, afterEach, afterAll, vi } from 'vitest';
import '@testing-library/jest-dom';

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
	writable: true,
	value: vi.fn().mockImplementation((query: string) => ({
		matches: false,
		media: query,
		onchange: null,
		addListener: vi.fn(),
		removeListener: vi.fn(),
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		dispatchEvent: vi.fn()
	}))
});

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
	observe: vi.fn(),
	disconnect: vi.fn(),
	unobserve: vi.fn()
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
	observe: vi.fn(),
	disconnect: vi.fn(),
	unobserve: vi.fn()
}));

// Clean up after each test
afterEach(() => {
	vi.clearAllMocks();
});

// Performance monitoring
let performanceEntries: PerformanceEntry[] = [];

beforeAll(() => {
	// Start performance monitoring
	if (typeof window !== 'undefined' && window.performance) {
		const observer = new PerformanceObserver((list) => {
			performanceEntries.push(...list.getEntries());
		});
		observer.observe({ entryTypes: ['measure', 'navigation'] });
	}
});

afterAll(() => {
	// Report performance metrics
	if (performanceEntries.length > 0) {
		console.error('\n=== Performance Metrics ===');
		performanceEntries.forEach((entry) => {
			console.error(`${entry.name}: ${entry.duration.toFixed(2)}ms`);
		});
	}
});

// Global test utilities
export const testUtils = {
	async waitForElement(selector: string, timeout = 5000): Promise<Element> {
		const startTime = Date.now();
		while (Date.now() - startTime < timeout) {
			const element = document.querySelector(selector);
			if (element) return element;
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
		throw new Error(`Element ${selector} not found within ${timeout}ms`);
	},

	async waitForWebSocket(url: string, timeout = 5000): Promise<import('ws').default> {
		const WebSocket = (await import('ws')).default;
		return new Promise((resolve, reject) => {
			const ws = new WebSocket(url);
			const timer = setTimeout(() => {
				ws.close();
				reject(new Error(`WebSocket connection to ${url} timed out`));
			}, timeout);

			ws.on('open', () => {
				clearTimeout(timer);
				resolve(ws);
			});

			ws.on('error', () => {
				clearTimeout(timer);
				reject(new Error(`WebSocket connection to ${url} failed`));
			});
		});
	},

	measurePerformance(name: string, fn: () => void | Promise<void>) {
		return async () => {
			performance.mark(`${name}-start`);
			await fn();
			performance.mark(`${name}-end`);
			performance.measure(name, `${name}-start`, `${name}-end`);
		};
	}
};
