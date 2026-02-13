import { randomUUID } from 'crypto';
import { readFile } from 'fs/promises';

import {
	type ConstitutionalArticle,
	ConstitutionalArticleSchema,
	type ConstitutionalSection,
	ConstitutionParseError,
	ConstitutionValidationError,
	type ForbiddenPattern,
	type Severity
} from './types.js';

/**
 * Parse constitution.md into structured ConstitutionalArticle array
 * Uses regex-based parsing with Zod validation (per R5 research)
 *
 * @param constitutionPath - Absolute path to constitution.md file
 * @returns Promise<ConstitutionalArticle[]> - Array of 12 articles
 * @throws ConstitutionParseError if file cannot be read
 * @throws ConstitutionValidationError if parsed structure fails Zod validation
 */
export async function parseConstitution(
	constitutionPath: string
): Promise<ConstitutionalArticle[]> {
	try {
		const content = await readFile(constitutionPath, 'utf-8');
		return parseConstitutionContent(content);
	} catch (error) {
		if (error instanceof ConstitutionValidationError) {
			throw error;
		}
		throw new ConstitutionParseError(
			constitutionPath,
			error instanceof Error ? error : new Error(String(error))
		);
	}
}

/**
 * Parse constitution markdown content into structured articles
 * Separated for testing purposes
 */
export function parseConstitutionContent(content: string): ConstitutionalArticle[] {
	const articles: ConstitutionalArticle[] = [];

	// Extract version from metadata
	const versionMatch = content.match(/^Version:\s*(\d+\.\d+\.\d+)/m);
	const _constitutionVersion = versionMatch ? versionMatch[1] : '2.0.0';

	// Extract articles (## Article I — Title through ## Article XII — Title)
	// Two patterns: intermediate articles stop at next marker, last article goes to end
	const articleMatches: Array<{ roman: string; title: string; content: string }> = [];

	// Pattern 1: Articles followed by another article or separator
	const intermediateArticleRegex =
		/^## Article ([IVX]+) — (.+?)\n([\s\S]*?)(?=^## Article|^---$)/gm;
	let match: RegExpExecArray | null;

	while ((match = intermediateArticleRegex.exec(content)) !== null) {
		articleMatches.push({
			roman: match[1],
			title: match[2],
			content: match[3]
		});
	}

	// Pattern 2: Last article (goes to end of string)
	const lastArticleRegex = /^## Article ([IVX]+) — (.+?)\n([\s\S]*)$/gm;
	const allArticlePositions: number[] = [];
	const posRegex = /^## Article [IVX]+ — /gm;
	while ((match = posRegex.exec(content)) !== null) {
		allArticlePositions.push(match.index);
	}

	if (allArticlePositions.length > 0) {
		const lastArticlePos = allArticlePositions[allArticlePositions.length - 1];
		const lastArticleContent = content.substring(lastArticlePos);
		const lastMatch = lastArticleRegex.exec(lastArticleContent);
		if (lastMatch && !articleMatches.some((a) => a.roman === lastMatch[1])) {
			articleMatches.push({
				roman: lastMatch[1],
				title: lastMatch[2],
				content: lastMatch[3]
			});
		}
	}

	// Process all matched articles
	for (const articleMatch of articleMatches) {
		const { roman: romanNumeral, title, content: articleContent } = articleMatch;
		const articleNumber = romanToNumber(romanNumeral);

		// Extract sections (### N.N Title)
		const sections = extractSections(articleNumber, romanNumeral, articleContent);

		// Extract forbidden patterns (### N.N Forbidden Patterns)
		const forbiddenPatterns = extractForbiddenPatterns(articleNumber, articleContent);

		// Determine article priority based on content
		const priority = determineArticlePriority(articleNumber, articleContent);

		const article: ConstitutionalArticle = {
			id: romanNumeral,
			number: articleNumber,
			title,
			sections,
			forbiddenPatterns,
			priority
		};

		// Validate with Zod
		const validation = ConstitutionalArticleSchema.safeParse(article);
		if (!validation.success) {
			const errors = validation.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
			throw new ConstitutionValidationError(errors);
		}

		articles.push(validation.data);
	}

	if (articles.length !== 12) {
		throw new ConstitutionValidationError([
			`Expected 12 articles, found ${articles.length}. Constitution may be malformed.`
		]);
	}

	return articles;
}

/**
 * Extract sections from article content
 */
function extractSections(
	articleNumber: number,
	articleId: string,
	content: string
): ConstitutionalSection[] {
	const sections: ConstitutionalSection[] = [];
	// Two patterns: intermediate sections and last section
	const intermediateSectionRegex = /^### (\d+\.\d+)\s+(.+?)\n([\s\S]*?)(?=^###|^##)/gm;
	const lastSectionRegex = /^### (\d+\.\d+)\s+(.+?)\n([\s\S]*)$/gm;

	const sectionMatches: Array<{ id: string; title: string; content: string }> = [];
	let sectionMatch;

	// Match intermediate sections
	while ((sectionMatch = intermediateSectionRegex.exec(content)) !== null) {
		sectionMatches.push({
			id: sectionMatch[1],
			title: sectionMatch[2],
			content: sectionMatch[3]
		});
	}

	// Match last section if not already matched
	const lastMatch = lastSectionRegex.exec(content);
	if (lastMatch && !sectionMatches.some((s) => s.id === lastMatch[1])) {
		sectionMatches.push({
			id: lastMatch[1],
			title: lastMatch[2],
			content: lastMatch[3]
		});
	}

	for (const match of sectionMatches) {
		const { id: sectionId, title: sectionTitle, content: sectionContent } = match;

		// Skip "Forbidden Patterns" sections (handled separately)
		if (sectionTitle.includes('Forbidden Patterns')) {
			continue;
		}

		// Extract rules (bullet points)
		const rules = extractRules(sectionContent);

		// Extract examples (code blocks)
		const examples = extractExamples(sectionContent);

		sections.push({
			id: sectionId,
			articleId,
			title: sectionTitle,
			rules,
			examples
		});
	}

	return sections;
}

/**
 * Extract rules (bullet points) from section content
 */
function extractRules(content: string): string[] {
	const rules: string[] = [];
	const bulletRegex = /^[\s]*[-*]\s+(.+?)$/gm;
	let bulletMatch;

	while ((bulletMatch = bulletRegex.exec(content)) !== null) {
		const rule = bulletMatch[1].trim();
		// Skip empty bullets and code fence markers
		if (rule && !rule.startsWith('```')) {
			rules.push(rule);
		}
	}

	return rules;
}

/**
 * Extract code examples from section content
 */
function extractExamples(content: string): Array<{ language: string; code: string }> {
	const examples: Array<{ language: string; code: string }> = [];
	const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
	let codeMatch;

	while ((codeMatch = codeBlockRegex.exec(content)) !== null) {
		const [, language = 'text', code] = codeMatch;
		examples.push({ language, code: code.trim() });
	}

	return examples;
}

/**
 * Extract forbidden patterns from article content
 */
function extractForbiddenPatterns(articleNumber: number, content: string): ForbiddenPattern[] {
	const patterns: ForbiddenPattern[] = [];

	// Find "Forbidden Patterns" section
	// Two patterns: intermediate sections and last section
	const intermediateForbiddenRegex =
		/### ([\d.]+) Forbidden Patterns[^\n]*\n+([\s\S]*?)(?=^###|^##)/gm;
	const lastForbiddenRegex = /### ([\d.]+) Forbidden Patterns[^\n]*\n+([\s\S]*)$/gm;

	const forbiddenMatches: Array<{ id: string; content: string }> = [];
	let sectionMatch;

	// Match intermediate forbidden patterns sections
	while ((sectionMatch = intermediateForbiddenRegex.exec(content)) !== null) {
		forbiddenMatches.push({ id: sectionMatch[1], content: sectionMatch[2] });
	}

	// Match last forbidden patterns section if not already matched
	const lastMatch = lastForbiddenRegex.exec(content);
	if (lastMatch && !forbiddenMatches.some((m) => m.id === lastMatch[1])) {
		forbiddenMatches.push({ id: lastMatch[1], content: lastMatch[2] });
	}

	for (const match of forbiddenMatches) {
		const { id: sectionId, content: sectionContent } = match;

		// Extract individual patterns (**Pattern name.** Description)
		// Note: Period is INSIDE the bold text: **Name.** not **Name**.
		const itemRegex = /[-*]\s+\*\*(.+?)\.\*\*\s+([^\n]+)/g;
		let itemMatch;

		while ((itemMatch = itemRegex.exec(sectionContent)) !== null) {
			const [, patternName, description] = itemMatch;

			patterns.push({
				id: randomUUID(),
				articleId: sectionId,
				patternName: patternName.trim(),
				description: description.trim(),
				examples: [],
				severity: determineSeverityForPattern(articleNumber, patternName),
				detectionStrategy: determineDetectionStrategy(patternName)
			});
		}
	}

	return patterns;
}

/**
 * Determine article priority based on article number and content
 */
function determineArticlePriority(articleNumber: number, _content: string): Severity {
	// Article IX (Security) is always CRITICAL
	if (articleNumber === 9) return 'CRITICAL';

	// Article II, III (Code Quality, Testing) are HIGH
	if (articleNumber === 2 || articleNumber === 3) return 'HIGH';

	// Article VI, XII (Dependencies, Git) are HIGH
	if (articleNumber === 6 || articleNumber === 12) return 'HIGH';

	// Article IV (UX) is MEDIUM
	if (articleNumber === 4) return 'MEDIUM';

	// Others are LOW by default
	return 'LOW';
}

/**
 * Determine severity for a specific forbidden pattern
 */
function determineSeverityForPattern(articleNumber: number, patternName: string): Severity {
	// Security violations are always CRITICAL
	if (articleNumber === 9) return 'CRITICAL';

	// Article II §2.7 forbidden patterns
	if (articleNumber === 2) {
		const criticalPatterns = /eval|any type|service layer|barrel file/i;
		if (criticalPatterns.test(patternName)) return 'CRITICAL';
		return 'HIGH';
	}

	// Git workflow violations
	if (articleNumber === 12) {
		const criticalPatterns = /force-push|WIP commit/i;
		if (criticalPatterns.test(patternName)) return 'CRITICAL';
		return 'HIGH';
	}

	return 'MEDIUM';
}

/**
 * Determine detection strategy based on pattern name
 */
function determineDetectionStrategy(patternName: string): 'glob' | 'regex' | 'ast' | 'manual' {
	const lowerName = patternName.toLowerCase();

	// File path patterns
	if (
		lowerName.includes('service layer') ||
		lowerName.includes('barrel file') ||
		lowerName.includes('utils')
	) {
		return 'glob';
	}

	// Simple text patterns
	if (
		lowerName.includes('hardcoded') ||
		lowerName.includes('hex color') ||
		lowerName.includes('secret')
	) {
		return 'regex';
	}

	// Code structure patterns
	if (
		lowerName.includes('any type') ||
		lowerName.includes('@ts-ignore') ||
		lowerName.includes('eval') ||
		lowerName.includes('alert')
	) {
		return 'ast';
	}

	// Default to manual review
	return 'manual';
}

/**
 * Convert Roman numeral to number
 */
function romanToNumber(roman: string): number {
	const romanNumerals: Record<string, number> = {
		I: 1,
		II: 2,
		III: 3,
		IV: 4,
		V: 5,
		VI: 6,
		VII: 7,
		VIII: 8,
		IX: 9,
		X: 10,
		XI: 11,
		XII: 12
	};
	return romanNumerals[roman] || 0;
}
