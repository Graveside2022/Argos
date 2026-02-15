/**
 * Category Organizer for Constitutional Audit
 *
 * Analyzes violations and organizes them into logical categories
 * with folder structure and analysis documents.
 */

import { type Violation } from './types.js';

export interface ViolationCategory {
	id: string;
	name: string;
	priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
	violations: Violation[];
	folderName: string;
	description: string;
	impact: string;
	estimatedTimelineWeeks: string;
}

/**
 * Organize violations into categories for analysis
 */
export function organizeViolations(violations: Violation[]): ViolationCategory[] {
	const categories: ViolationCategory[] = [];

	// Category 1: UI Modernization (hardcoded colors)
	const hardcodedColors = violations.filter(
		(v) =>
			v.ruleViolated === 'No hardcoded hex colors' || v.articleReference === 'Article II §2.7'
	);

	if (hardcodedColors.length > 0) {
		categories.push({
			id: '01',
			name: 'UI Modernization',
			priority: 'MEDIUM',
			violations: hardcodedColors,
			folderName: '01-ui-modernization',
			description: 'Hardcoded hex colors instead of Tailwind theme classes',
			impact: 'Visual inconsistency, maintenance burden, no design system',
			estimatedTimelineWeeks: '1-2'
		});
	}

	// Category 2: Service Layer Violations (architectural anti-pattern)
	const serviceLayer = violations.filter(
		(v) =>
			v.ruleViolated === 'No service layer pattern' ||
			v.filePath.includes('src/lib/services/')
	);

	if (serviceLayer.length > 0) {
		categories.push({
			id: '02',
			name: 'Service Layer Violations',
			priority: 'CRITICAL',
			violations: serviceLayer,
			folderName: '02-service-layer-violations',
			description: 'Service layer pattern forbidden - should use feature-based organization',
			impact: 'Architectural anti-pattern, violates feature-based organization',
			estimatedTimelineWeeks: '1-2'
		});
	}

	// Category 3: Type Safety Violations (type assertions without justification)
	const typeAssertions = violations.filter(
		(v) =>
			v.ruleViolated === 'Type assertion without justification comment' ||
			v.articleReference === 'Article II §2.1'
	);

	if (typeAssertions.length > 0) {
		categories.push({
			id: '03',
			name: 'Type Safety Violations',
			priority: 'HIGH',
			violations: typeAssertions,
			folderName: '03-type-safety-violations',
			description: 'Type assertions without justification comments',
			impact: 'Potential runtime errors, unclear type assumptions, maintainability issues',
			estimatedTimelineWeeks: '1-2'
		});
	}

	// Category 4: Component Reuse (duplication opportunities)
	const componentReuse = violations.filter(
		(v) =>
			v.ruleViolated === 'Reuse existing components before creating new ones' ||
			v.articleReference === 'Article IV §4.2'
	);

	if (componentReuse.length > 0) {
		categories.push({
			id: '04',
			name: 'Component Reuse',
			priority: 'LOW',
			violations: componentReuse,
			folderName: '04-component-reuse',
			description: 'Button patterns duplicated across components',
			impact: 'Minor duplication, opportunity for component extraction',
			estimatedTimelineWeeks: '1'
		});
	}

	// Category 5: Test Coverage (missing tests)
	const testCoverage = violations.filter(
		(v) => v.articleReference.startsWith('Article III') || v.ruleViolated.includes('test')
	);

	if (testCoverage.length > 0) {
		categories.push({
			id: '05',
			name: 'Test Coverage',
			priority: 'HIGH',
			violations: testCoverage,
			folderName: '05-test-coverage',
			description: 'Missing or insufficient test coverage',
			impact: 'Reduced confidence in code changes, potential regressions',
			estimatedTimelineWeeks: '2-3'
		});
	}

	// Category 6: Security Issues
	const security = violations.filter(
		(v) => v.articleReference.startsWith('Article IX') || v.ruleViolated.includes('security')
	);

	if (security.length > 0) {
		categories.push({
			id: '06',
			name: 'Security Issues',
			priority: 'CRITICAL',
			violations: security,
			folderName: '06-security-issues',
			description: 'Security vulnerabilities or missing security controls',
			impact: 'Potential security breaches, data exposure, unauthorized access',
			estimatedTimelineWeeks: '1'
		});
	}

	// Category 7: Performance Issues
	const performance = violations.filter(
		(v) => v.articleReference.startsWith('Article V') || v.ruleViolated.includes('performance')
	);

	if (performance.length > 0) {
		categories.push({
			id: '07',
			name: 'Performance Issues',
			priority: 'MEDIUM',
			violations: performance,
			folderName: '07-performance-issues',
			description: 'Performance degradation or inefficient code',
			impact: 'Slow response times, resource waste, poor user experience',
			estimatedTimelineWeeks: '1-2'
		});
	}

	// Category 8: Other Violations (catchall)
	const categorizedViolations = categories.flatMap((c) => c.violations);
	const other = violations.filter((v) => !categorizedViolations.includes(v));

	if (other.length > 0) {
		categories.push({
			id: '99',
			name: 'Other Violations',
			priority: getMostSeverePriority(other),
			violations: other,
			folderName: '99-other-violations',
			description: 'Miscellaneous constitutional violations',
			impact: 'Various impacts - see individual violations',
			estimatedTimelineWeeks: '1-2'
		});
	}

	// Sort by priority (CRITICAL > HIGH > MEDIUM > LOW)
	return categories.sort((a, b) => {
		const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
		return priorityOrder[a.priority] - priorityOrder[b.priority];
	});
}

/**
 * Get most severe priority from a list of violations
 */
function getMostSeverePriority(violations: Violation[]): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
	const priorities = violations.map((v) => v.severity);

	if (priorities.includes('CRITICAL')) return 'CRITICAL';
	if (priorities.includes('HIGH')) return 'HIGH';
	if (priorities.includes('MEDIUM')) return 'MEDIUM';
	return 'LOW';
}
