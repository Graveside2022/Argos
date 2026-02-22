import { randomUUID } from 'crypto';
import { readFile } from 'fs/promises';
import { glob } from 'glob';
import * as ts from 'typescript';

import { type Violation } from '../types.js';

/**
 * Validate Article II — Code Quality Standards
 * Detects: any types, @ts-ignore, type assertions, forbidden patterns
 * Uses TypeScript Compiler API for AST analysis (per R1/R3 research)
 */
export async function validateArticleII(projectRoot: string): Promise<Violation[]> {
	const violations: Violation[] = [];

	// Find all TypeScript and Svelte files
	const files = await glob('src/**/*.{ts,tsx,svelte}', {
		cwd: projectRoot,
		ignore: ['**/*.test.ts', '**/*.spec.ts', '**/node_modules/**']
	});

	for (const file of files) {
		const filePath = `${projectRoot}/${file}`;
		const content = await readFile(filePath, 'utf-8');

		// Extract TypeScript content from Svelte files
		const tsContent = file.endsWith('.svelte') ? extractScriptFromSvelte(content) : content;

		// Create source file for AST analysis
		const sourceFile = ts.createSourceFile(
			file,
			tsContent,
			ts.ScriptTarget.Latest,
			true,
			ts.ScriptKind.TS
		);

		// Check for violations
		violations.push(...checkAnyTypes(file, sourceFile));
		violations.push(...checkTsIgnore(file, sourceFile, content));
		violations.push(...checkTypeAssertions(file, sourceFile));
		violations.push(...checkHardcodedColors(file, content));
		violations.push(...checkBrowserAlerts(file, sourceFile));
	}

	// Check for forbidden file patterns
	violations.push(...(await checkServiceLayerFiles(projectRoot)));
	violations.push(...(await checkBarrelFiles(projectRoot)));
	violations.push(...(await checkCatchAllUtils(projectRoot)));

	return violations;
}

/**
 * Check for `any` type usage (Article II §2.1)
 * Skips exempted lines and lines with justification comments
 */
function checkAnyTypes(file: string, sourceFile: ts.SourceFile): Violation[] {
	const violations: Violation[] = [];
	const fullText = sourceFile.getFullText();
	const lines = fullText.split('\n');

	function visit(node: ts.Node) {
		const isAnyType =
			(ts.isTypeReferenceNode(node) && node.typeName.getText() === 'any') ||
			node.kind === ts.SyntaxKind.AnyKeyword;

		if (isAnyType) {
			// Check for exemption annotation nearby
			const lineNum = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line;
			if (isExemptedLine(lines, lineNum, '2.1')) return;

			// Check for justification comment on same or preceding line
			if (hasLeadingComment(node, sourceFile)) return;

			violations.push(createViolation(file, node, 'any-type-usage', 'No `any` type usage'));
		}

		ts.forEachChild(node, visit);
	}

	visit(sourceFile);
	return violations;
}

/**
 * Check for @ts-ignore without issue reference (Article II §2.1)
 */
function checkTsIgnore(file: string, _sourceFile: ts.SourceFile, content: string): Violation[] {
	const violations: Violation[] = [];

	// Skip constitution infrastructure — references @ts-ignore as a detection target, not usage
	if (file.includes('/constitution/')) return violations;

	const lines = content.split('\n');

	lines.forEach((line, index) => {
		if (line.includes('@ts-ignore')) {
			// Skip comment lines that discuss @ts-ignore (documentation, not usage)
			const trimmed = line.trim();
			if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
				return;
			}

			// Check for exemption annotation nearby
			if (isExemptedLine(lines, index, '2.1')) return;

			// Check if line has issue reference
			const hasIssueRef = line.includes('issue:#') || line.includes('issue: #');

			if (!hasIssueRef) {
				violations.push({
					id: randomUUID(),
					// Safe: String literal narrowed to const for severity enum type
					severity: 'HIGH' as const,
					articleReference: 'Article II §2.1',
					ruleViolated: 'No @ts-ignore without issue reference',
					filePath: file,
					lineNumber: index + 1,
					violationType: 'ts-ignore-without-issue',
					codeSnippet: line.trim().substring(0, 200),
					suggestedFix: 'Add issue reference: // @ts-ignore issue:#NNN — justification',
					isPreExisting: false,
					// Safe: String literal narrowed to const for exemption status enum type
					exemptionStatus: 'none' as const
				});
			}
		}
	});

	return violations;
}

/**
 * Check for type assertions without justification (Article II §2.1)
 * Skips safe patterns: `as const` (type narrowing), assertions with nearby comments
 * Skips files that inherently process external/dynamic data (MCP servers, API routes)
 */
function checkTypeAssertions(file: string, sourceFile: ts.SourceFile): Violation[] {
	const violations: Violation[] = [];

	// Skip MCP server files — diagnostic tools with dynamic JSON responses
	if (file.includes('/server/mcp/')) return violations;

	// Skip API route handlers — process external request/response data
	if (file.includes('/routes/api/') && file.endsWith('+server.ts')) return violations;

	// Skip service files — interact with external APIs (Kismet, GPS, hardware)
	if (file.includes('/server/services/')) return violations;

	const fullText = sourceFile.getFullText();
	const lines = fullText.split('\n');

	// Safe assertion target types that are basic type narrowing (no information loss risk)
	const safeNarrowingTypes = new Set([
		'const',
		'string',
		'number',
		'boolean',
		'unknown',
		'never',
		'void',
		'undefined',
		'null'
	]);

	function visit(node: ts.Node) {
		if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
			// Get the assertion target type text
			const targetType = ts.isAsExpression(node)
				? node.type.getText(sourceFile)
				: node.type.getText(sourceFile);

			// Skip safe type narrowing patterns (as const, as string, as number, etc.)
			if (safeNarrowingTypes.has(targetType)) return;

			// Check for exemption annotation nearby
			const lineNum = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line;
			if (isExemptedLine(lines, lineNum, '2.1')) return;

			// Check for preceding comment with justification
			const hasJustification = hasLeadingComment(node, sourceFile);

			if (!hasJustification) {
				violations.push(
					createViolation(
						file,
						node,
						'type-assertion-without-justification',
						'Type assertion without justification comment'
					)
				);
			}
		}

		ts.forEachChild(node, visit);
	}

	visit(sourceFile);
	return violations;
}

/**
 * Check for hardcoded hex colors (Article II §2.7)
 * Only flags hex colors in TypeScript logic — Svelte templates, CSS, and
 * data visualization utilities are excluded (UI concern, not code quality)
 */
function checkHardcodedColors(file: string, content: string): Violation[] {
	const violations: Violation[] = [];

	// Skip Svelte files — hex colors in templates/CSS are a UI modernization concern (Article IV)
	if (file.endsWith('.svelte')) {
		return violations;
	}

	// Skip known data visualization files where hex colors define signal/status mappings
	const dataVizPaths = ['/utils/', '/spectrum', '/map-utils', '/signal-utils', '/chart'];
	if (dataVizPaths.some((p) => file.includes(p))) {
		return violations;
	}

	const lines = content.split('\n');
	const hexColorRegex = /#[0-9A-Fa-f]{6}\b/g;

	lines.forEach((line, index) => {
		const matches = line.matchAll(hexColorRegex);
		for (const match of matches) {
			// Skip comments, imports, and exempted lines
			if (line.trim().startsWith('//') || line.trim().startsWith('import')) {
				continue;
			}
			if (isExemptedLine(lines, index, '2.7')) {
				continue;
			}

			// Skip hex colors used as CSS var() fallback values: var(--token, #hex)
			if (match.index !== undefined) {
				const textBefore = line.substring(0, match.index);
				if (/var\(\s*--[\w-]+\s*,\s*$/.test(textBefore)) {
					continue;
				}
			}

			violations.push({
				id: randomUUID(),
				// Safe: String literal narrowed to const for severity enum type
				severity: 'MEDIUM' as const,
				articleReference: 'Article II §2.7',
				ruleViolated: 'No hardcoded hex colors — use Tailwind theme',
				filePath: file,
				lineNumber: index + 1,
				violationType: 'hardcoded-hex-color',
				codeSnippet: line.trim().substring(0, 200),
				suggestedFix: `Replace ${match[0]} with Tailwind color class`,
				isPreExisting: false,
				// Safe: String literal narrowed to const for exemption status enum type
				exemptionStatus: 'none' as const
			});
		}
	});

	return violations;
}

/**
 * Check for browser alert usage (Article II §2.7)
 */
function checkBrowserAlerts(file: string, sourceFile: ts.SourceFile): Violation[] {
	const violations: Violation[] = [];

	function visit(node: ts.Node) {
		if (ts.isCallExpression(node)) {
			const expression = node.expression.getText();
			if (
				[
					'alert',
					'window.alert',
					'confirm',
					'window.confirm',
					'prompt',
					'window.prompt'
				].includes(expression)
			) {
				violations.push({
					id: randomUUID(),
					// Safe: String literal narrowed to const for severity enum type
					severity: 'HIGH' as const,
					articleReference: 'Article II §2.7',
					ruleViolated: 'No browser alert/confirm/prompt',
					filePath: file,
					lineNumber: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
					violationType: 'browser-alert-usage',
					codeSnippet: node.getText().substring(0, 200),
					suggestedFix: 'Use custom modal component instead',
					isPreExisting: false,
					// Safe: String literal narrowed to const for exemption status enum type
					exemptionStatus: 'none' as const
				});
			}
		}

		ts.forEachChild(node, visit);
	}

	visit(sourceFile);
	return violations;
}

/**
 * Check for service layer files (Article II §2.7)
 */
async function checkServiceLayerFiles(projectRoot: string): Promise<Violation[]> {
	const files = await glob('src/lib/services/**/*.ts', { cwd: projectRoot });

	return files.map((file) => ({
		id: randomUUID(),
		severity: 'CRITICAL',
		articleReference: 'Article II §2.7',
		ruleViolated: 'No service layer pattern',
		filePath: file,
		lineNumber: 1,
		violationType: 'forbidden-pattern-service-layer',
		suggestedFix: 'Move logic to appropriate feature module in src/lib/',
		isPreExisting: false,
		exemptionStatus: 'none'
	}));
}

/**
 * Check for barrel files (Article II §2.7)
 */
async function checkBarrelFiles(projectRoot: string): Promise<Violation[]> {
	const files = await glob('src/**/index.ts', { cwd: projectRoot });
	const violations: Violation[] = [];

	for (const file of files) {
		const content = await readFile(`${projectRoot}/${file}`, 'utf-8');

		// Check if file is primarily re-exports
		const hasOnlyExports = /^export\s+{\s*[\w\s,]+\s*}\s+from/.test(content.trim());

		if (hasOnlyExports) {
			violations.push({
				id: randomUUID(),
				// Safe: String literal narrowed to const for severity enum type
				severity: 'HIGH' as const,
				articleReference: 'Article II §2.7',
				ruleViolated: 'No barrel files (index.ts with only re-exports)',
				filePath: file,
				lineNumber: 1,
				violationType: 'forbidden-pattern-barrel-file',
				suggestedFix: 'Import directly from source files instead',
				isPreExisting: false,
				// Safe: String literal narrowed to const for exemption status enum type
				exemptionStatus: 'none' as const
			});
		}
	}

	return violations;
}

/**
 * Check for catch-all utility files (Article II §2.7)
 */
async function checkCatchAllUtils(projectRoot: string): Promise<Violation[]> {
	const patterns = ['utils.ts', 'helpers.ts', 'common.ts', 'shared.ts'];
	const violations: Violation[] = [];

	for (const pattern of patterns) {
		const files = await glob(`src/**/${pattern}`, {
			cwd: projectRoot,
			// Exclude type definition directories — type files named shared.ts are expected
			ignore: ['**/types/**', '**/node_modules/**']
		});
		violations.push(
			...files.map((file) => ({
				id: randomUUID(),
				// Safe: String literal narrowed to const for severity enum type
				severity: 'HIGH' as const,
				articleReference: 'Article II §2.7',
				ruleViolated: 'No catch-all utility files',
				filePath: file,
				lineNumber: 1,
				violationType: 'forbidden-pattern-catch-all-utils',
				suggestedFix: 'Create specific modules with clear responsibilities',
				isPreExisting: false,
				// Safe: String literal narrowed to const for exemption status enum type
				exemptionStatus: 'none' as const
			}))
		);
	}

	return violations;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if a line or up to 3 preceding lines contain an exemption annotation
 * for the specified article section. Mirrors Article IX pattern.
 */
function isExemptedLine(lines: string[], lineIndex: number, articleSection: string): boolean {
	const exemptionPattern = /@constitutional-exemption\s+Article-[IVX]+-/;
	for (let i = 0; i <= 3 && lineIndex - i >= 0; i++) {
		const line = lines[lineIndex - i];
		if (exemptionPattern.test(line) && line.includes(articleSection)) {
			return true;
		}
	}
	return false;
}

function createViolation(
	file: string,
	node: ts.Node,
	violationType: string,
	ruleViolated: string
): Violation {
	const sourceFile = node.getSourceFile();
	const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());

	return {
		id: randomUUID(),
		// Safe: String literal narrowed to const for severity enum type
		severity: 'HIGH' as const,
		articleReference: 'Article II §2.1',
		ruleViolated,
		filePath: file,
		lineNumber: line + 1,
		columnNumber: character + 1,
		violationType,
		codeSnippet: node.getText().substring(0, 200),
		suggestedFix: getSuggestedFix(violationType),
		isPreExisting: false,
		// Safe: String literal narrowed to const for exemption status enum type
		exemptionStatus: 'none' as const
	};
}

function getSuggestedFix(violationType: string): string {
	const fixes: Record<string, string> = {
		'any-type-usage': 'Replace `any` with `unknown` and add type guard',
		'type-assertion-without-justification': 'Add comment explaining why assertion is safe'
	};
	return fixes[violationType] || 'Review and fix according to Article II';
}

function hasLeadingComment(node: ts.Node, sourceFile: ts.SourceFile): boolean {
	const fullText = sourceFile.getFullText();
	const nodePos = node.getFullStart();
	const commentRanges = ts.getLeadingCommentRanges(fullText, nodePos);

	// Check for attached comments (same line or immediately preceding)
	if (commentRanges !== undefined && commentRanges.length > 0) {
		return true;
	}

	// Check for trailing comment on the same line as the assertion
	const nodeStart = node.getStart();
	const lineAndChar = sourceFile.getLineAndCharacterOfPosition(nodeStart);
	const lines = fullText.split('\n');
	const currentLine = lines[lineAndChar.line];
	if (currentLine && /\/\/\s*.+/.test(currentLine)) {
		return true;
	}

	// Check preceding line for any comment (serves as justification)
	const lineNumber = lineAndChar.line;
	if (lineNumber > 0) {
		const previousLine = lines[lineNumber - 1];
		if (
			previousLine &&
			(previousLine.trim().startsWith('//') ||
				previousLine.trim().startsWith('/*') ||
				previousLine.trim().startsWith('*') ||
				previousLine.trim().startsWith('<!--'))
		) {
			return true;
		}
	}

	return false;
}

function extractScriptFromSvelte(content: string): string {
	const scriptMatch = content.match(/<script[^>]*>([\s\S]*?)<\/script>/);
	return scriptMatch ? scriptMatch[1] : '';
}
