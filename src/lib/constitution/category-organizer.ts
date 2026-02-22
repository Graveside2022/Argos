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

/** Category metadata without violations (used for matching rules) */
interface CategoryDefinition {
	id: string;
	name: string;
	priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
	folderName: string;
	description: string;
	impact: string;
	estimatedTimelineWeeks: string;
	filter: (v: Violation) => boolean;
}

/**
 * Organize violations into categories for analysis
 */
export function organizeViolations(violations: Violation[]): ViolationCategory[] {
	const definitions = getCategoryDefinitions();
	const categories = buildCategoriesFromDefinitions(violations, definitions);
	const withCatchall = appendUncategorizedViolations(violations, categories);
	return sortCategoriesByPriority(withCatchall);
}

/** Build the ordered list of category definitions with their filter predicates */
function getCategoryDefinitions(): CategoryDefinition[] {
	return [...getCodeQualityCategoryDefinitions(), ...getOperationalCategoryDefinitions()];
}

/** Category definitions for code quality concerns (UI, architecture, types, components) */
function getCodeQualityCategoryDefinitions(): CategoryDefinition[] {
	return [{
		id: '01',
		name: 'UI Modernization',
		priority: 'MEDIUM',
		folderName: '01-ui-modernization',
		description: 'Hardcoded hex colors instead of Tailwind theme classes',
		impact: 'Visual inconsistency, maintenance burden, no design system',
		estimatedTimelineWeeks: '1-2',
		filter: (v) =>
			v.ruleViolated === 'No hardcoded hex colors' || v.articleReference === 'Article II §2.7'
	}, {
		id: '02',
		name: 'Service Layer Violations',
		priority: 'CRITICAL',
		folderName: '02-service-layer-violations',
		description: 'Service layer pattern forbidden - should use feature-based organization',
		impact: 'Architectural anti-pattern, violates feature-based organization',
		estimatedTimelineWeeks: '1-2',
		filter: (v) =>
			v.ruleViolated === 'No service layer pattern' || v.filePath.includes('src/lib/services/')
	}, {
		id: '03',
		name: 'Type Safety Violations',
		priority: 'HIGH',
		folderName: '03-type-safety-violations',
		description: 'Type assertions without justification comments',
		impact: 'Potential runtime errors, unclear type assumptions, maintainability issues',
		estimatedTimelineWeeks: '1-2',
		filter: (v) =>
			v.ruleViolated === 'Type assertion without justification comment' ||
			v.articleReference === 'Article II §2.1'
	}, {
		id: '04',
		name: 'Component Reuse',
		priority: 'LOW',
		folderName: '04-component-reuse',
		description: 'Button patterns duplicated across components',
		impact: 'Minor duplication, opportunity for component extraction',
		estimatedTimelineWeeks: '1',
		filter: (v) =>
			v.ruleViolated === 'Reuse existing components before creating new ones' ||
			v.articleReference === 'Article IV §4.2'
	}];
}

/** Category definitions for operational concerns (testing, security, performance) */
function getOperationalCategoryDefinitions(): CategoryDefinition[] {
	return [
		{
			id: '05',
			name: 'Test Coverage',
			priority: 'HIGH',
			folderName: '05-test-coverage',
			description: 'Missing or insufficient test coverage',
			impact: 'Reduced confidence in code changes, potential regressions',
			estimatedTimelineWeeks: '2-3',
			filter: (v) =>
				v.articleReference.startsWith('Article III') || v.ruleViolated.includes('test')
		},
		{
			id: '06',
			name: 'Security Issues',
			priority: 'CRITICAL',
			folderName: '06-security-issues',
			description: 'Security vulnerabilities or missing security controls',
			impact: 'Potential security breaches, data exposure, unauthorized access',
			estimatedTimelineWeeks: '1',
			filter: (v) =>
				v.articleReference.startsWith('Article IX') || v.ruleViolated.includes('security')
		},
		{
			id: '07',
			name: 'Performance Issues',
			priority: 'MEDIUM',
			folderName: '07-performance-issues',
			description: 'Performance degradation or inefficient code',
			impact: 'Slow response times, resource waste, poor user experience',
			estimatedTimelineWeeks: '1-2',
			filter: (v) =>
				v.articleReference.startsWith('Article V') || v.ruleViolated.includes('performance')
		}
	];
}

/** Apply each category definition's filter to produce populated ViolationCategory entries */
function buildCategoriesFromDefinitions(
	violations: Violation[],
	definitions: CategoryDefinition[]
): ViolationCategory[] {
	const categories: ViolationCategory[] = [];

	for (const def of definitions) {
		const matched = violations.filter(def.filter);
		if (matched.length > 0) {
			categories.push({
				id: def.id,
				name: def.name,
				priority: def.priority,
				violations: matched,
				folderName: def.folderName,
				description: def.description,
				impact: def.impact,
				estimatedTimelineWeeks: def.estimatedTimelineWeeks
			});
		}
	}

	return categories;
}

/** Collect violations not matched by any defined category into a catchall entry */
function appendUncategorizedViolations(
	violations: Violation[],
	categories: ViolationCategory[]
): ViolationCategory[] {
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

	return categories;
}

/** Sort categories by severity: CRITICAL > HIGH > MEDIUM > LOW */
function sortCategoriesByPriority(categories: ViolationCategory[]): ViolationCategory[] {
	const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
	return categories.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
}

/** Derive the most severe priority from a list of violations */
function getMostSeverePriority(violations: Violation[]): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
	const priorities = violations.map((v) => v.severity);

	if (priorities.includes('CRITICAL')) return 'CRITICAL';
	if (priorities.includes('HIGH')) return 'HIGH';
	if (priorities.includes('MEDIUM')) return 'MEDIUM';
	return 'LOW';
}
