import { describe, expect, it } from 'vitest';

import { validateArticleIII } from '../../../src/lib/constitution/validators/article-iii-testing.js';

describe('validateArticleIII - Testing', () => {
	it('should return array of violations', async () => {
		const violations = await validateArticleIII(process.cwd());

		expect(Array.isArray(violations)).toBe(true);
		violations.forEach((v) => {
			expect(v.articleReference).toContain('Article III');
		});
	});
});
