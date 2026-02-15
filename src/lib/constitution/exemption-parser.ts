import { randomUUID } from 'crypto';
import { readFile } from 'fs/promises';
import { glob } from 'glob';

import { type ExemptionAnnotation, type Violation } from './types.js';

/**
 * Parse @constitutional-exemption annotations from source files
 * Format: // @constitutional-exemption Article-{ROMAN}-{SECTION} issue:#{NUM} — {JUSTIFICATION}
 *
 * @param projectRoot - Absolute path to project root
 * @returns Promise<ExemptionAnnotation[]> - All parsed exemptions
 */
export async function parseExemptions(projectRoot: string): Promise<ExemptionAnnotation[]> {
	const exemptions: ExemptionAnnotation[] = [];

	// Find all source files
	const files = await glob('src/**/*.{ts,tsx,svelte}', {
		cwd: projectRoot,
		ignore: ['**/node_modules/**']
	});

	for (const file of files) {
		const content = await readFile(`${projectRoot}/${file}`, 'utf-8');
		const lines = content.split('\n');

		lines.forEach((line, index) => {
			const exemption = parseExemptionLine(line, file, index + 1);
			if (exemption) {
				exemptions.push(exemption);
			}
		});
	}

	return exemptions;
}

/**
 * Parse single line for exemption annotation
 */
function parseExemptionLine(
	line: string,
	filePath: string,
	lineNumber: number
): ExemptionAnnotation | null {
	// Match: @constitutional-exemption Article-{ROMAN}-{SECTION} issue:#{NUM} — {JUSTIFICATION}
	const exemptionRegex =
		/@constitutional-exemption\s+(Article-[IVX]+-\d+\.\d+)\s+issue:(#\d+)\s+—\s+(.+)/;
	const match = line.match(exemptionRegex);

	if (!match) return null;

	const [, articleReference, issueNumber, justification] = match;

	return {
		id: randomUUID(),
		filePath,
		lineNumber,
		articleReference,
		issueNumber,
		justification: justification.trim(),
		parsedAt: new Date().toISOString()
	};
}

/**
 * Apply exemptions to violations (filter out exempted violations)
 *
 * @param violations - All detected violations
 * @param exemptions - All parsed exemptions
 * @returns Violation[] - Violations with exemption status updated
 */
export function applyExemptions(
	violations: Violation[],
	exemptions: ExemptionAnnotation[]
): Violation[] {
	return violations.map((violation) => {
		// Find matching exemption (same file, nearby line, matching article)
		const matchingExemption = exemptions.find((ex) => {
			const sameFile = ex.filePath === violation.filePath;
			const nearbyLine = Math.abs(ex.lineNumber - violation.lineNumber) <= 3;
			const sameArticle =
				ex.articleReference.replace(/-/g, ' ').replace('Article ', 'Article ') ===
				violation.articleReference.replace('§', '');

			return sameFile && nearbyLine && sameArticle;
		});

		if (matchingExemption) {
			return {
				...violation,
				exemptionStatus: 'approved',
				exemptionJustification: matchingExemption.justification,
				exemptionIssueNumber: matchingExemption.issueNumber
			};
		}

		return violation;
	});
}

/**
 * Filter out exempted violations from report
 *
 * @param violations - Violations with exemption status
 * @returns Violation[] - Only non-exempted violations
 */
export function filterExemptedViolations(violations: Violation[]): Violation[] {
	return violations.filter((v) => v.exemptionStatus !== 'approved');
}
