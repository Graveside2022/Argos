import { randomUUID } from 'crypto';
import { readFile } from 'fs/promises';
import { glob } from 'glob';

import { type Violation } from '../types.js';

// @constitutional-exemption Article-IX-9.4 issue:#TBD — False positives: validator code contains security patterns it's checking for
/**
 * Validate Article IX — Security
 * Detects: eval(), new Function(), innerHTML, hardcoded secrets
 */
export async function validateArticleIX(projectRoot: string): Promise<Violation[]> {
	const violations: Violation[] = [];

	// Find all source files
	const files = await glob('src/**/*.{ts,tsx,svelte}', {
		cwd: projectRoot,
		ignore: ['**/*.test.ts', '**/*.spec.ts', '**/node_modules/**']
	});

	for (const file of files) {
		const content = await readFile(`${projectRoot}/${file}`, 'utf-8');

		// Check for forbidden patterns (§9.4)
		violations.push(...checkEvalUsage(file, content));
		violations.push(...checkInnerHTMLUsage(file, content));
		violations.push(...checkHtmlDirective(file, content));

		// Check for hardcoded secrets (§9.1)
		violations.push(...checkHardcodedSecrets(file, content));
	}

	return violations;
}

/**
 * Check for eval() and new Function() usage (§9.4)
 */
function checkEvalUsage(file: string, content: string): Violation[] {
	const violations: Violation[] = [];
	const lines = content.split('\n');

	lines.forEach((line, index) => {
		if (/\beval\s*\(/.test(line) || /new\s+Function\s*\(/.test(line)) {
			violations.push({
				id: randomUUID(),
				severity: 'CRITICAL',
				articleReference: 'Article IX §9.4',
				ruleViolated: 'No eval() or new Function() — dynamic code execution forbidden',
				filePath: file,
				lineNumber: index + 1,
				violationType: 'eval-usage',
				codeSnippet: line.trim().substring(0, 200),
				suggestedFix:
					'Refactor to use safe alternatives (JSON.parse, template strings, etc.)',
				isPreExisting: false,
				exemptionStatus: 'none'
			});
		}
	});

	return violations;
}

/**
 * Check for innerHTML usage (§9.4)
 */
function checkInnerHTMLUsage(file: string, content: string): Violation[] {
	const violations: Violation[] = [];
	const lines = content.split('\n');

	lines.forEach((line, index) => {
		if (/\.innerHTML\s*=/.test(line)) {
			violations.push({
				id: randomUUID(),
				severity: 'CRITICAL',
				articleReference: 'Article IX §9.4',
				ruleViolated: 'No innerHTML assignment — XSS vulnerability',
				filePath: file,
				lineNumber: index + 1,
				violationType: 'innerhtml-usage',
				codeSnippet: line.trim().substring(0, 200),
				suggestedFix: 'Use textContent, createElement, or sanitize HTML with DOMPurify',
				isPreExisting: false,
				exemptionStatus: 'none'
			});
		}
	});

	return violations;
}

/**
 * Check for {@html} directive in Svelte (§9.4)
 */
function checkHtmlDirective(file: string, content: string): Violation[] {
	const violations: Violation[] = [];

	if (!file.endsWith('.svelte')) return violations;

	const lines = content.split('\n');
	lines.forEach((line, index) => {
		if (/{@html\s+/.test(line)) {
			violations.push({
				id: randomUUID(),
				severity: 'CRITICAL',
				articleReference: 'Article IX §9.4',
				ruleViolated: 'No {@html} without sanitization — XSS vulnerability',
				filePath: file,
				lineNumber: index + 1,
				violationType: 'svelte-html-directive',
				codeSnippet: line.trim().substring(0, 200),
				suggestedFix: 'Sanitize HTML with DOMPurify before {@html} or use {@text}',
				isPreExisting: false,
				exemptionStatus: 'none'
			});
		}
	});

	return violations;
}

/**
 * Check for hardcoded secrets (§9.1)
 */
function checkHardcodedSecrets(file: string, content: string): Violation[] {
	const violations: Violation[] = [];
	const lines = content.split('\n');

	const secretPatterns = [
		{ pattern: /(?:api[_-]?key|apikey)\s*=\s*['"`][^'"`]+['"`]/i, type: 'API key' },
		{ pattern: /(?:password|passwd|pwd)\s*=\s*['"`][^'"`]+['"`]/i, type: 'Password' },
		{ pattern: /(?:secret|token)\s*=\s*['"`][^'"`]+['"`]/i, type: 'Secret/Token' },
		{ pattern: /sk-[a-zA-Z0-9]{32,}/, type: 'Secret key' }
	];

	lines.forEach((line, index) => {
		// Skip comments and imports
		if (line.trim().startsWith('//') || line.trim().startsWith('import')) {
			return;
		}

		for (const { pattern, type } of secretPatterns) {
			if (pattern.test(line)) {
				violations.push({
					id: randomUUID(),
					severity: 'CRITICAL',
					articleReference: 'Article IX §9.1',
					ruleViolated: 'No hardcoded secrets',
					filePath: file,
					lineNumber: index + 1,
					violationType: 'hardcoded-secret',
					codeSnippet: line.trim().substring(0, 200),
					suggestedFix: `Move ${type} to .env file and access via process.env`,
					isPreExisting: false,
					exemptionStatus: 'none'
				});
			}
		}
	});

	return violations;
}
