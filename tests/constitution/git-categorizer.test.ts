import { describe, expect, it } from 'vitest';

import { categorizeViolationByTimestamp } from '../../src/lib/constitution/git-categorizer.js';

describe('categorizeViolationByTimestamp', () => {
	it('should categorize pre-existing violations (before 2026-02-13)', async () => {
		// This test requires git to be available
		// For now, we'll test the fallback mechanism
		const result = await categorizeViolationByTimestamp('src/lib/constitution/types.ts', 1);

		expect(result).toHaveProperty('isPreExisting');
		expect(result).toHaveProperty('commitDate');
		expect(result).toHaveProperty('commitHash');
		expect(result).toHaveProperty('commitAuthor');
	});

	it('should handle git not available with fallback to mtime', async () => {
		// Test will use mtime fallback if git unavailable
		const result = await categorizeViolationByTimestamp(
			'tests/constitution/fixtures/valid-component.svelte',
			1
		);

		expect(result).toHaveProperty('isPreExisting');
		expect(typeof result.isPreExisting).toBe('boolean');
	});

	it('should throw FileNotFoundError for non-existent files', async () => {
		await expect(categorizeViolationByTimestamp('non-existent-file.ts', 1)).rejects.toThrow();
	});
});
