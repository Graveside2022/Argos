import { randomUUID } from 'crypto';
import { readFile } from 'fs/promises';
import { glob } from 'glob';

import { type Violation } from '../types.js';

/**
 * Validate Article IX — Security
 * Checks for: dynamic code execution, innerHTML, hardcoded secrets, unsanitized HTML directives
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
 * Check if a line or the preceding lines (up to 3 lines back) contain an exemption comment
 * for the specified article section.
 */
function isExempted(lines: string[], index: number, articleSection: string): boolean {
	const exemptionPattern = /@constitutional-exemption\s+Article-[IVX]+-/;
	const line = lines[index];
	// Check current line for inline exemption
	if (exemptionPattern.test(line) && line.includes(articleSection)) {
		return true;
	}
	// Check up to 3 preceding lines for exemption comments above the violation
	for (let i = 1; i <= 3 && index - i >= 0; i++) {
		const prevLine = lines[index - i];
		if (exemptionPattern.test(prevLine) && prevLine.includes(articleSection)) {
			return true;
		}
	}
	return false;
}

/**
 * Check if a line is a comment (JS/TS/JSDoc/HTML comment)
 */
function isCommentLine(line: string): boolean {
	const trimmed = line.trim();
	return (
		trimmed.startsWith('//') ||
		trimmed.startsWith('*') ||
		trimmed.startsWith('/*') ||
		trimmed.startsWith('<!--')
	);
}

/**
 * Check for eval() and new Function() usage (§9.4)
 * Skips comment lines and exempted lines to avoid false positives.
 */
function checkEvalUsage(file: string, content: string): Violation[] {
	const violations: Violation[] = [];
	const lines = content.split('\n');

	lines.forEach((line, index) => {
		// Skip comment lines — mentions of eval() in docs/comments are not violations
		if (isCommentLine(line)) return;

		// Skip lines with exemption annotations
		if (isExempted(lines, index, '9.4')) return;

		// Match actual eval() or new Function() calls, not string literals containing the text
		const trimmed = line.trim();
		// Skip lines where eval appears only inside a string literal
		if (isInsideStringLiteral(trimmed, 'eval')) return;

		if (/\beval\s*\(/.test(line) || /new\s+Function\s*\(/.test(line)) {
			violations.push({
				id: randomUUID(),
				severity: 'CRITICAL',
				articleReference: 'Article IX §9.4',
				ruleViolated: 'No eval() or new Function() — dynamic code execution forbidden',
				filePath: file,
				lineNumber: index + 1,
				violationType: 'eval-usage',
				codeSnippet: trimmed.substring(0, 200),
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
 * Heuristic: check if a keyword appears only inside a string literal on this line.
 * Returns true if ALL occurrences of the keyword are inside quotes.
 */
function isInsideStringLiteral(line: string, keyword: string): boolean {
	// Remove string literals and check if keyword still exists
	const withoutStrings = line.replace(/(['"`])(?:(?!\1|\\).|\\.)*\1/g, '');
	return !new RegExp(`\\b${keyword}\\s*\\(`).test(withoutStrings);
}

/**
 * Check for innerHTML usage (§9.4)
 */
function checkInnerHTMLUsage(file: string, content: string): Violation[] {
	const violations: Violation[] = [];
	const lines = content.split('\n');

	lines.forEach((line, index) => {
		if (isCommentLine(line)) return;
		if (isExempted(lines, index, '9.4')) return;

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
		if (isExempted(lines, index, '9.4')) return;

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
		if (isCommentLine(line) || line.trim().startsWith('import')) {
			return;
		}

		// Skip exempted lines
		if (isExempted(lines, index, '9.1')) return;

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
