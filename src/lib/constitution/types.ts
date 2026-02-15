import { z } from 'zod';

// ============================================================================
// ENUMS AND BASIC TYPES
// ============================================================================

export const SeveritySchema = z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']);
export type Severity = z.infer<typeof SeveritySchema>;

export const TrendDirectionSchema = z.enum(['improving', 'stable', 'degrading', 'baseline']);
export type TrendDirection = z.infer<typeof TrendDirectionSchema>;

export const AuditScopeSchema = z.enum(['full', 'incremental', 'directory', 'article']);
export type AuditScope = z.infer<typeof AuditScopeSchema>;

export const ExemptionStatusSchema = z.enum(['none', 'requested', 'approved']);
export type ExemptionStatus = z.infer<typeof ExemptionStatusSchema>;

export const DetectionStrategySchema = z.enum(['glob', 'regex', 'ast', 'manual']);
export type DetectionStrategy = z.infer<typeof DetectionStrategySchema>;

export const ReportFormatSchema = z.enum(['json', 'markdown', 'terminal']);
export type ReportFormat = z.infer<typeof ReportFormatSchema>;

// ============================================================================
// CONSTITUTIONAL ENTITIES
// ============================================================================

export const CodeExampleSchema = z.object({
	language: z.string(),
	code: z.string(),
	caption: z.string().optional()
});
export type CodeExample = z.infer<typeof CodeExampleSchema>;

export const ConstitutionalSectionSchema = z.object({
	id: z.string().regex(/^\d+\.\d+$/),
	articleId: z.string().regex(/^[IVX]+$/),
	title: z.string().min(3),
	rules: z.array(z.string()).optional().default([]),
	examples: z.array(CodeExampleSchema).optional().default([])
});
export type ConstitutionalSection = z.infer<typeof ConstitutionalSectionSchema>;

export const ForbiddenPatternSchema = z.object({
	id: z.string().uuid(),
	articleId: z.string().regex(/^\d+\.\d+$/),
	patternName: z.string().min(5),
	description: z.string().min(20),
	examples: z.array(z.string()).optional().default([]),
	severity: SeveritySchema,
	detectionStrategy: DetectionStrategySchema
});
export type ForbiddenPattern = z.infer<typeof ForbiddenPatternSchema>;

export const ConstitutionalArticleSchema = z.object({
	id: z.string().regex(/^[IVX]+$/),
	number: z.number().int().min(1).max(12),
	title: z.string().min(5),
	sections: z.array(ConstitutionalSectionSchema).min(1),
	forbiddenPatterns: z.array(ForbiddenPatternSchema).optional().default([]),
	priority: SeveritySchema
});
export type ConstitutionalArticle = z.infer<typeof ConstitutionalArticleSchema>;

// ============================================================================
// VIOLATION ENTITIES
// ============================================================================

export const ViolationSchema = z.object({
	id: z.string().uuid(),
	severity: SeveritySchema,
	articleReference: z.string().regex(/^Article [IVX]+ §\d+\.\d+$/),
	ruleViolated: z.string().min(10),
	filePath: z.string().min(1),
	lineNumber: z.number().int().positive(),
	columnNumber: z.number().int().positive().optional(),
	violationType: z.string().min(3),
	codeSnippet: z.string().max(200).optional(),
	suggestedFix: z.string().optional(),
	isPreExisting: z.boolean(),
	commitDate: z.string().datetime().optional(),
	commitHash: z
		.string()
		.regex(/^[0-9a-f]{40}$/)
		.optional(),
	exemptionStatus: ExemptionStatusSchema,
	exemptionJustification: z.string().min(20).optional(),
	exemptionIssueNumber: z
		.string()
		.regex(/^#\d+$/)
		.optional()
});
export type Violation = z.infer<typeof ViolationSchema>;

export const ComplianceScoreSchema = z.object({
	articleId: z.string().regex(/^[IVX]+$/),
	articleTitle: z.string().min(5),
	totalChecks: z.number().int().min(0),
	passingChecks: z.number().int().min(0),
	failingChecks: z.number().int().min(0),
	scorePercent: z.number().int().min(0).max(100),
	violationCount: z.number().int().min(0),
	trendDirection: TrendDirectionSchema,
	previousScorePercent: z.number().int().min(0).max(100).optional()
});
export type ComplianceScore = z.infer<typeof ComplianceScoreSchema>;

export const AuditReportSchema = z.object({
	id: z.string().uuid(),
	timestamp: z.string().datetime(),
	constitutionVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
	executionDurationMs: z.number().int().min(0).max(120000),
	overallCompliancePercent: z.number().int().min(0).max(100),
	totalViolations: z.number().int().min(0),
	criticalViolations: z.number().int().min(0),
	highViolations: z.number().int().min(0),
	mediumViolations: z.number().int().min(0),
	lowViolations: z.number().int().min(0),
	articleScores: z.array(ComplianceScoreSchema).length(12),
	violations: z.array(ViolationSchema),
	filesScanned: z.number().int().min(0),
	scope: AuditScopeSchema,
	scopeFilter: z.string().optional(),
	trendDirection: TrendDirectionSchema
});
export type AuditReport = z.infer<typeof AuditReportSchema>;

export const ExemptionAnnotationSchema = z.object({
	id: z.string().uuid(),
	filePath: z.string().min(1),
	lineNumber: z.number().int().positive(),
	articleReference: z.string().regex(/^Article-[IVX]+-\d+\.\d+$/),
	issueNumber: z.string().regex(/^#\d+$/),
	justification: z.string().min(20),
	expirationDate: z.string().datetime().optional(),
	parsedAt: z.string().datetime()
});
export type ExemptionAnnotation = z.infer<typeof ExemptionAnnotationSchema>;

// ============================================================================
// API OPTIONS AND RESULTS
// ============================================================================

export const AuditOptionsSchema = z.object({
	scope: AuditScopeSchema,
	scopeFilter: z.string().optional(),
	projectRoot: z.string().optional(),
	constitutionPath: z.string().optional(),
	reportOutputDir: z.string().optional(),
	outputFormats: z.array(ReportFormatSchema).min(1),
	timeoutMs: z.number().int().min(1000).max(120000).optional().default(60000),
	verbose: z.boolean().optional().default(false)
});
export type AuditOptions = z.infer<typeof AuditOptionsSchema>;

export const ViolationCategorySchema = z.object({
	isPreExisting: z.boolean(),
	commitDate: z.string().datetime(),
	commitHash: z.string().regex(/^[0-9a-f]{40}$/),
	commitAuthor: z.string()
});
export type ViolationCategory = z.infer<typeof ViolationCategorySchema>;

export const FileCoverageSchema = z.object({
	filePath: z.string(),
	linesPct: z.number().min(0).max(100),
	statementsPct: z.number().min(0).max(100),
	functionsPct: z.number().min(0).max(100),
	branchesPct: z.number().min(0).max(100),
	meetsThreshold: z.boolean()
});
export type FileCoverage = z.infer<typeof FileCoverageSchema>;

export const CoverageSummarySchema = z.object({
	globalCoveragePercent: z.number().min(0).max(100),
	totalFilesAnalyzed: z.number().int().min(0),
	filesPassing: z.number().int().min(0),
	filesFailing: z.number().int().min(0),
	details: z.array(FileCoverageSchema)
});
export type CoverageSummary = z.infer<typeof CoverageSummarySchema>;

export const ValidationResultSchema = z.object({
	valid: z.boolean(),
	errors: z.array(z.string()).optional()
});
export type ValidationResult = z.infer<typeof ValidationResultSchema>;

// ============================================================================
// ERROR CLASSES
// ============================================================================

export class ConstitutionalAuditError extends Error {
	constructor(
		message: string,
		public code: string,
		public details?: unknown
	) {
		super(message);
		this.name = 'ConstitutionalAuditError';
		Error.captureStackTrace(this, this.constructor);
	}
}

export class AuditTimeoutError extends ConstitutionalAuditError {
	constructor(timeoutMs: number) {
		super(`Audit exceeded timeout of ${timeoutMs}ms`, 'AUDIT_TIMEOUT', { timeoutMs });
		this.name = 'AuditTimeoutError';
	}
}

export class ConstitutionParseError extends ConstitutionalAuditError {
	constructor(filePath: string, parseError: Error) {
		super(`Failed to parse constitution: ${parseError.message}`, 'CONSTITUTION_PARSE_ERROR', {
			filePath,
			parseError
		});
		this.name = 'ConstitutionParseError';
	}
}

export class ConstitutionValidationError extends ConstitutionalAuditError {
	constructor(validationErrors: string[]) {
		super(
			`Constitution validation failed: ${validationErrors.join(', ')}`,
			'CONSTITUTION_VALIDATION_ERROR',
			{ validationErrors }
		);
		this.name = 'ConstitutionValidationError';
	}
}

export class InvalidScopeError extends ConstitutionalAuditError {
	constructor(scope: string, filter?: string) {
		super(
			`Invalid audit scope: ${scope}${filter ? ` with filter "${filter}"` : ''}`,
			'INVALID_SCOPE',
			{ scope, filter }
		);
		this.name = 'InvalidScopeError';
	}
}

export class GitNotAvailableError extends ConstitutionalAuditError {
	constructor() {
		super('Git is not available or this is not a git repository', 'GIT_NOT_AVAILABLE');
		this.name = 'GitNotAvailableError';
	}
}

export class FileNotFoundError extends ConstitutionalAuditError {
	constructor(filePath: string) {
		super(`File not found: ${filePath}`, 'FILE_NOT_FOUND', { filePath });
		this.name = 'FileNotFoundError';
	}
}

export class CoverageNotFoundError extends ConstitutionalAuditError {
	constructor(coveragePath: string) {
		super(
			`Coverage file not found: ${coveragePath}. Run tests with coverage first.`,
			'COVERAGE_NOT_FOUND',
			{ coveragePath }
		);
		this.name = 'CoverageNotFoundError';
	}
}

export class VitestNotConfiguredError extends ConstitutionalAuditError {
	constructor() {
		super(
			'Vitest coverage not configured. Add coverage.reporter: ["json"] to vitest.config.ts',
			'VITEST_NOT_CONFIGURED'
		);
		this.name = 'VitestNotConfiguredError';
	}
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

export function validateViolation(violation: unknown): ValidationResult {
	const result = ViolationSchema.safeParse(violation);
	if (result.success) {
		return { valid: true };
	}
	return {
		valid: false,
		errors: result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`)
	};
}

export function validateAuditReport(report: unknown): ValidationResult {
	const result = AuditReportSchema.safeParse(report);
	if (result.success) {
		return { valid: true };
	}
	return {
		valid: false,
		errors: result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`)
	};
}

export function validateAuditOptions(options: unknown): ValidationResult {
	const result = AuditOptionsSchema.safeParse(options);
	if (result.success) {
		return { valid: true };
	}
	return {
		valid: false,
		errors: result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`)
	};
}
