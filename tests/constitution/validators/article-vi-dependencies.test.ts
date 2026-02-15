import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { validateArticleVI } from '../../../src/lib/constitution/validators/article-vi-dependencies.js';

describe('validateArticleVI - Dependency Management', () => {
	const fixtureRoot = join(process.cwd(), 'tests/constitution/fixtures/temp-deps');

	beforeEach(() => {
		mkdirSync(fixtureRoot, { recursive: true });
	});

	afterEach(() => {
		rmSync(fixtureRoot, { recursive: true, force: true });
	});

	it('should return array of violations for real project', async () => {
		const violations = await validateArticleVI(process.cwd());

		expect(Array.isArray(violations)).toBe(true);
		violations.forEach((v) => {
			expect(v).toHaveProperty('severity');
			expect(v).toHaveProperty('articleReference');
			expect(v.articleReference).toContain('Article VI');
		});
	});

	it('should detect forbidden ORM dependencies', async () => {
		writeFileSync(
			join(fixtureRoot, 'package.json'),
			JSON.stringify({
				dependencies: {
					prisma: '5.0.0',
					svelte: '5.35.5'
				},
				devDependencies: {}
			})
		);

		const violations = await validateArticleVI(fixtureRoot);

		const ormViolations = violations.filter(
			(v) => v.violationType === 'forbidden-dependency' && v.codeSnippet?.includes('prisma')
		);
		expect(ormViolations).toHaveLength(1);
		expect(ormViolations[0].severity).toBe('CRITICAL');
		expect(ormViolations[0].articleReference).toBe('Article VI §6.3');
		expect(ormViolations[0].ruleViolated).toContain('ORM');
	});

	it('should detect forbidden state management libraries', async () => {
		writeFileSync(
			join(fixtureRoot, 'package.json'),
			JSON.stringify({
				dependencies: {
					redux: '5.0.0',
					zustand: '4.0.0'
				},
				devDependencies: {}
			})
		);

		const violations = await validateArticleVI(fixtureRoot);

		const stateViolations = violations.filter(
			(v) => v.violationType === 'forbidden-dependency'
		);
		expect(stateViolations).toHaveLength(2);
		stateViolations.forEach((v) => {
			expect(v.severity).toBe('CRITICAL');
			expect(v.ruleViolated).toContain('State Management');
		});
	});

	it('should detect forbidden HTTP client libraries', async () => {
		writeFileSync(
			join(fixtureRoot, 'package.json'),
			JSON.stringify({
				dependencies: {
					axios: '1.6.0'
				},
				devDependencies: {
					got: '14.0.0'
				}
			})
		);

		const violations = await validateArticleVI(fixtureRoot);

		const httpViolations = violations.filter((v) => v.violationType === 'forbidden-dependency');
		expect(httpViolations).toHaveLength(2);
		httpViolations.forEach((v) => {
			expect(v.ruleViolated).toContain('HTTP Client');
		});
	});

	it('should detect all ORM variants', async () => {
		writeFileSync(
			join(fixtureRoot, 'package.json'),
			JSON.stringify({
				dependencies: {
					typeorm: '0.3.0',
					sequelize: '6.0.0',
					mongoose: '8.0.0'
				},
				devDependencies: {}
			})
		);

		const violations = await validateArticleVI(fixtureRoot);

		const forbiddenViolations = violations.filter(
			(v) => v.violationType === 'forbidden-dependency'
		);
		expect(forbiddenViolations).toHaveLength(3);
	});

	it('should detect unpinned caret versions', async () => {
		writeFileSync(
			join(fixtureRoot, 'package.json'),
			JSON.stringify({
				dependencies: {
					svelte: '^5.35.5',
					vite: '^7.0.0'
				},
				devDependencies: {}
			})
		);

		const violations = await validateArticleVI(fixtureRoot);

		const unpinnedViolations = violations.filter(
			(v) => v.violationType === 'unpinned-dependency-version'
		);
		expect(unpinnedViolations).toHaveLength(2);
		unpinnedViolations.forEach((v) => {
			expect(v.severity).toBe('MEDIUM');
			expect(v.articleReference).toBe('Article VI §6.1');
		});
	});

	it('should detect unpinned tilde versions', async () => {
		writeFileSync(
			join(fixtureRoot, 'package.json'),
			JSON.stringify({
				dependencies: {
					typescript: '~5.8.3'
				},
				devDependencies: {}
			})
		);

		const violations = await validateArticleVI(fixtureRoot);

		const unpinnedViolations = violations.filter(
			(v) => v.violationType === 'unpinned-dependency-version'
		);
		expect(unpinnedViolations).toHaveLength(1);
		expect(unpinnedViolations[0].codeSnippet).toContain('~5.8.3');
	});

	it('should suggest exact version in fix for unpinned deps', async () => {
		writeFileSync(
			join(fixtureRoot, 'package.json'),
			JSON.stringify({
				dependencies: {
					svelte: '^5.35.5'
				},
				devDependencies: {}
			})
		);

		const violations = await validateArticleVI(fixtureRoot);

		const unpinned = violations.find((v) => v.violationType === 'unpinned-dependency-version');
		expect(unpinned?.suggestedFix).toContain('5.35.5');
		expect(unpinned?.suggestedFix).not.toContain('^');
	});

	it('should not flag pinned versions', async () => {
		writeFileSync(
			join(fixtureRoot, 'package.json'),
			JSON.stringify({
				dependencies: {
					svelte: '5.35.5',
					vite: '7.0.0'
				},
				devDependencies: {}
			})
		);

		const violations = await validateArticleVI(fixtureRoot);

		const unpinnedViolations = violations.filter(
			(v) => v.violationType === 'unpinned-dependency-version'
		);
		expect(unpinnedViolations).toHaveLength(0);
	});

	it('should not flag allowed dependencies', async () => {
		writeFileSync(
			join(fixtureRoot, 'package.json'),
			JSON.stringify({
				dependencies: {
					svelte: '5.35.5',
					'better-sqlite3': '11.0.0',
					zod: '3.23.0'
				},
				devDependencies: {}
			})
		);

		const violations = await validateArticleVI(fixtureRoot);

		const forbiddenViolations = violations.filter(
			(v) => v.violationType === 'forbidden-dependency'
		);
		expect(forbiddenViolations).toHaveLength(0);
	});

	it('should handle package.json with no dependencies', async () => {
		writeFileSync(
			join(fixtureRoot, 'package.json'),
			JSON.stringify({
				name: 'test-project'
			})
		);

		const violations = await validateArticleVI(fixtureRoot);

		expect(violations).toEqual([]);
	});

	it('should check devDependencies for forbidden packages', async () => {
		writeFileSync(
			join(fixtureRoot, 'package.json'),
			JSON.stringify({
				dependencies: {},
				devDependencies: {
					prisma: '5.0.0'
				}
			})
		);

		const violations = await validateArticleVI(fixtureRoot);

		const forbiddenViolations = violations.filter(
			(v) => v.violationType === 'forbidden-dependency'
		);
		expect(forbiddenViolations).toHaveLength(1);
	});

	it('should return violations with proper structure', async () => {
		writeFileSync(
			join(fixtureRoot, 'package.json'),
			JSON.stringify({
				dependencies: {
					axios: '^1.6.0'
				},
				devDependencies: {}
			})
		);

		const violations = await validateArticleVI(fixtureRoot);

		violations.forEach((v) => {
			expect(v.id).toBeDefined();
			expect(v.severity).toMatch(/^(CRITICAL|HIGH|MEDIUM|LOW)$/);
			expect(v.articleReference).toMatch(/^Article VI §6\.\d+$/);
			expect(v.filePath).toBe('package.json');
			expect(v.lineNumber).toBe(1);
			expect(v.violationType).toBeDefined();
			expect(v.isPreExisting).toBe(false);
			expect(v.exemptionStatus).toBe('none');
		});
	});
});
