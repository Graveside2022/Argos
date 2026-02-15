import { describe, expect, it } from 'vitest';

import { validateArticleII } from '../../../src/lib/constitution/validators/article-ii-code-quality.js';

describe('validateArticleII - Code Quality', () => {
	it('should return array of violations', async () => {
		const violations = await validateArticleII(process.cwd());

		expect(Array.isArray(violations)).toBe(true);
		violations.forEach((v) => {
			expect(v).toHaveProperty('severity');
			expect(v).toHaveProperty('articleReference');
			expect(v).toHaveProperty('filePath');
			expect(v).toHaveProperty('lineNumber');
			expect(v.articleReference).toContain('Article II');
		});
	});
});
