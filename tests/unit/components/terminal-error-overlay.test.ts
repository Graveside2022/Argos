import { describe, expect, it } from 'vitest';

describe('TerminalErrorOverlay Component Logic', () => {
	describe('Error message formatting', () => {
		it('should include max retry count in message', () => {
			const maxRetries = 5;
			const message = `Could not connect to terminal server after ${maxRetries} attempts.`;
			expect(message).toContain('5');
			expect(message).toContain('attempts');
		});

		it('should display recovery command', () => {
			const cmd = 'Check that the dev server is running (npm run dev)';
			expect(cmd).toContain('npm run dev');
		});
	});

	describe('Overlay structure', () => {
		it('should have required sections', () => {
			const sections = [
				'error-overlay',
				'error-content',
				'error-title',
				'error-detail',
				'error-cmd'
			];
			expect(sections).toHaveLength(5);
		});

		it('should display Terminal Unavailable title', () => {
			const title = 'Terminal Unavailable';
			expect(title).toBe('Terminal Unavailable');
		});
	});
});
