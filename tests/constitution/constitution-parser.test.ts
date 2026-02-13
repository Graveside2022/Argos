import { describe, expect, it } from 'vitest';

import { parseConstitutionContent } from '../../src/lib/constitution/constitution-parser.js';
import { ConstitutionValidationError } from '../../src/lib/constitution/types.js';

describe('parseConstitution', () => {
	it('should parse valid constitution with 12 articles', () => {
		const validConstitution = `
Version: 2.0.0

## Article I — Comprehension Before Action

### 1.1 Problem Definition
Before implementing any solution, the problem must be clearly defined.

## Article II — Code Quality Standards

### 2.1 Type Safety
TypeScript strict mode must be enabled.

### 2.7 Forbidden Patterns
- **Service layer pattern.** No service layers are allowed.
- **Barrel files.** No index.ts files with re-exports.

## Article III — Testing Standards
### 3.1 Test Requirements
All code must have tests.

## Article IV — UX Consistency
### 4.1 Consistent Patterns
Maintain consistency.

## Article V — Performance Requirements
### 5.1 Performance Budgets
Meet performance budgets.

## Article VI — Dependency Management
### 6.1 Version Pinning
Pin dependency versions.

## Article VII — Debugging Practices
### 7.1 Error Handling
Handle errors properly.

## Article VIII — Verification Before Completion
### 8.1 Testing Requirements
Test before completion.

## Article IX — Security
### 9.1 No Hardcoded Secrets
No secrets in code.

## Article X — Governance
### 10.1 Constitution
Follow the constitution.

## Article XI — Spec-Kit Workflow
### 11.1 Specifications
Write specifications.

## Article XII — Git Workflow
### 12.1 Commit Messages
Write good commit messages.
`;

		const articles = parseConstitutionContent(validConstitution);

		expect(articles).toHaveLength(12);
		expect(articles[0].id).toBe('I');
		expect(articles[0].title).toBe('Comprehension Before Action');
		expect(articles[0].number).toBe(1);
		expect(articles[0].sections).toHaveLength(1);
		expect(articles[11].id).toBe('XII');
		expect(articles[11].number).toBe(12);
	});

	it('should extract forbidden patterns from sections', () => {
		const constitutionWithPatterns = `
## Article II — Code Quality

### 2.1 Type Safety
TypeScript strict mode required.

### 2.7 Forbidden Patterns
- **Service layer pattern.** No service layers allowed.
- **Barrel files.** No index.ts with re-exports.

## Article I — Other Article
### 1.1 Section
Content
## Article III — Testing Standards
### 3.1 Testing
Content
## Article IV — User Experience
### 4.1 Testing
Content
## Article V — Performance
### 5.1 Testing
Content
## Article VI — Dependencies
### 6.1 Testing
Content
## Article VII — Debugging
### 7.1 Testing
Content
## Article VIII — Verification
### 8.1 Testing
Content
## Article IX — Security
### 9.1 Testing
Content
## Article X — Governance
### 10.1 Testing
Content
## Article XI — Workflow
### 11.1 Testing
Content
## Article XII — Git Workflow
### 12.1 Testing
Content
`;

		const articles = parseConstitutionContent(constitutionWithPatterns);
		const articleII = articles.find((a) => a.id === 'II');

		expect(articleII?.forbiddenPatterns).toBeDefined();
		expect(articleII?.forbiddenPatterns?.length).toBeGreaterThan(0);
		expect(articleII?.forbiddenPatterns?.[0].patternName).toContain('Service layer');
	});

	it('should throw ConstitutionValidationError for invalid structure', () => {
		const invalidConstitution = `
## Article I — Test
### 1.1 Section
Content
`;

		expect(() => parseConstitutionContent(invalidConstitution)).toThrow(
			ConstitutionValidationError
		);
	});

	it('should handle articles without forbidden patterns', () => {
		const constitutionNoPatterns = `
## Article I — Comprehension
### 1.1 Section
Content
## Article II — Code Quality
### 2.1 Testing
Content
## Article III — Testing Standards
### 3.1 Testing
Content
## Article IV — User Experience
### 4.1 Testing
Content
## Article V — Performance
### 5.1 Testing
Content
## Article VI — Dependencies
### 6.1 Testing
Content
## Article VII — Debugging
### 7.1 Testing
Content
## Article VIII — Verification
### 8.1 Testing
Content
## Article IX — Security
### 9.1 Testing
Content
## Article X — Governance
### 10.1 Testing
Content
## Article XI — Workflow
### 11.1 Testing
Content
## Article XII — Git Workflow
### 12.1 Testing
Content
`;

		const articles = parseConstitutionContent(constitutionNoPatterns);

		expect(articles).toHaveLength(12);
		articles.forEach((article) => {
			expect(article.forbiddenPatterns).toEqual([]);
		});
	});

	it('should assign correct priority to security article', () => {
		const constitution = `
## Article IX — Security
### 9.1 Security Rules
Security first.
## Article I — Comprehension
### 1.1 Testing
Content
## Article II — Code Quality
### 2.1 Testing
Content
## Article III — Testing Standards
### 3.1 Testing
Content
## Article IV — User Experience
### 4.1 Testing
Content
## Article V — Performance
### 5.1 Testing
Content
## Article VI — Dependencies
### 6.1 Testing
Content
## Article VII — Debugging
### 7.1 Testing
Content
## Article VIII — Verification
### 8.1 Testing
Content
## Article X — Governance
### 10.1 Testing
Content
## Article XI — Workflow
### 11.1 Testing
Content
## Article XII — Git Workflow
### 12.1 Testing
Content
`;

		const articles = parseConstitutionContent(constitution);
		const articleIX = articles.find((a) => a.id === 'IX');

		expect(articleIX?.priority).toBe('CRITICAL');
	});
});
