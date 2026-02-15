import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resolveThemeColor } from '../../src/lib/utils/theme-colors';

describe('resolveThemeColor', () => {
	describe('SSR context (no document)', () => {
		it('returns default fallback when document is undefined', () => {
			const originalDocument = globalThis.document;
			// @ts-expect-error - intentionally removing document for SSR test
			delete globalThis.document;

			expect(resolveThemeColor('--signal-critical')).toBe('#000000');

			globalThis.document = originalDocument;
		});

		it('returns custom fallback when document is undefined', () => {
			const originalDocument = globalThis.document;
			// @ts-expect-error - intentionally removing document for SSR test
			delete globalThis.document;

			expect(resolveThemeColor('--signal-critical', '#ff0000')).toBe('#ff0000');

			globalThis.document = originalDocument;
		});
	});

	describe('prefix normalization', () => {
		beforeEach(() => {
			// Mock getComputedStyle to return a known value
			vi.spyOn(window, 'getComputedStyle').mockReturnValue({
				getPropertyValue: vi.fn((prop: string) => {
					if (prop === '--signal-critical') return '#dc2626';
					return '';
				}),
				color: ''
			} as unknown as CSSStyleDeclaration);
		});

		it('handles --prefixed variable names', () => {
			const result = resolveThemeColor('--signal-critical');
			expect(result).toBe('#dc2626');
		});

		it('handles bare variable names without --', () => {
			const result = resolveThemeColor('signal-critical');
			expect(result).toBe('#dc2626');
		});
	});

	describe('missing/invalid variable', () => {
		beforeEach(() => {
			vi.spyOn(window, 'getComputedStyle').mockReturnValue({
				getPropertyValue: vi.fn(() => ''),
				color: ''
			} as unknown as CSSStyleDeclaration);
		});

		it('returns default fallback for missing variable', () => {
			expect(resolveThemeColor('--nonexistent')).toBe('#000000');
		});

		it('returns custom fallback for missing variable', () => {
			expect(resolveThemeColor('--nonexistent', '#abcdef')).toBe('#abcdef');
		});
	});
});
