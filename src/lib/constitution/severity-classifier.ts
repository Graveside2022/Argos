import { type Severity } from './types.js';

/**
 * Determine severity for a violation
 * Classification logic per data-model.md severity rules
 *
 * @param articleId - Article identifier (e.g., "II", "IX")
 * @param sectionId - Section ID (e.g., "2.1", "9.4")
 * @param patternName - Pattern name or violation type
 * @returns Severity level
 */
export function determineSeverity(
	articleId: string,
	sectionId: string,
	patternName: string
): Severity {
	// Security violations are always CRITICAL (Article IX)
	if (articleId === 'IX') {
		return 'CRITICAL';
	}

	// Article II §2.7 forbidden patterns
	if (articleId === 'II' && sectionId === '2.7') {
		const criticalPatterns = /eval|any type|service layer|barrel file|secret/i;
		if (criticalPatterns.test(patternName)) {
			return 'CRITICAL';
		}
		return 'HIGH';
	}

	// Article II §2.1 type safety
	if (articleId === 'II' && sectionId === '2.1') {
		return 'HIGH';
	}

	// Article III testing violations
	if (articleId === 'III') {
		if (patternName.includes('coverage')) {
			return 'HIGH';
		}
		return 'MEDIUM';
	}

	// Article VI dependency violations
	if (articleId === 'VI') {
		if (patternName.includes('forbidden')) {
			return 'CRITICAL';
		}
		return 'MEDIUM';
	}

	// Article XII git workflow violations
	if (articleId === 'XII') {
		const criticalPatterns = /force-push|WIP commit/i;
		if (criticalPatterns.test(patternName)) {
			return 'CRITICAL';
		}
		return 'HIGH';
	}

	// Article IV UX violations (generally medium)
	if (articleId === 'IV') {
		return 'MEDIUM';
	}

	// Default for other patterns
	return 'LOW';
}

/**
 * Get severity level numeric weight (for sorting)
 */
export function getSeverityWeight(severity: Severity): number {
	const weights: Record<Severity, number> = {
		CRITICAL: 4,
		HIGH: 3,
		MEDIUM: 2,
		LOW: 1
	};
	return weights[severity];
}

/**
 * Sort violations by severity (CRITICAL first)
 */
export function sortBySeverity<T extends { severity: Severity }>(violations: T[]): T[] {
	return violations.sort((a, b) => getSeverityWeight(b.severity) - getSeverityWeight(a.severity));
}
