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
 */
function checkAnyTypes(file: string, sourceFile: ts.SourceFile): Violation[] {
	const violations: Violation[] = [];

	function visit(node: ts.Node) {
		// Check for explicit any type
		if (ts.isTypeReferenceNode(node) && node.typeName.getText() === 'any') {
			violations.push(createViolation(file, node, 'any-type-usage', 'No `any` type usage'));
		}

		// Check for any keyword
		if (node.kind === ts.SyntaxKind.AnyKeyword) {
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
function checkTsIgnore(file: string, sourceFile: ts.SourceFile, content: string): Violation[] {
	const violations: Violation[] = [];
	const lines = content.split('\n');

	lines.forEach((line, index) => {
		if (line.includes('@ts-ignore')) {
			// Check if next line has issue reference
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
 */
function checkTypeAssertions(file: string, sourceFile: ts.SourceFile): Violation[] {
	const violations: Violation[] = [];

	function visit(node: ts.Node) {
		if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
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
 */
function checkHardcodedColors(file: string, content: string): Violation[] {
	const violations: Violation[] = [];
	const lines = content.split('\n');
	const hexColorRegex = /#[0-9A-Fa-f]{6}\b/g;

	lines.forEach((line, index) => {
		const matches = line.matchAll(hexColorRegex);
		for (const match of matches) {
			// Skip comments and imports
			if (line.trim().startsWith('//') || line.trim().startsWith('import')) {
				continue;
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
		const files = await glob(`src/**/${pattern}`, { cwd: projectRoot });
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

	return commentRanges !== undefined && commentRanges.length > 0;
}

function extractScriptFromSvelte(content: string): string {
	const scriptMatch = content.match(/<script[^>]*>([\s\S]*?)<\/script>/);
	return scriptMatch ? scriptMatch[1] : '';
}
