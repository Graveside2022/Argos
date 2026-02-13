# Data Model: Constitutional Code Quality Audit

**Feature**: `001-constitution-audit` | **Date**: 2026-02-13
**Phase**: 1 (Design & Contracts)

## Overview

This document defines the core entities, their relationships, validation rules, and state transitions for the constitutional compliance auditing system. All entities derive from functional requirements in spec.md.

---

## Entity Definitions

### 1. ConstitutionalArticle

**Purpose**: Represents a single article from `.specify/memory/constitution.md`

**Fields**:

| Field               | Type                                        | Required | Validation                                     | Source                                                          |
| ------------------- | ------------------------------------------- | -------- | ---------------------------------------------- | --------------------------------------------------------------- |
| `id`                | `string`                                    | ✓        | Format: `"I"` through `"XII"` (Roman numerals) | Constitution markdown headers                                   |
| `number`            | `number`                                    | ✓        | Range: 1-12                                    | Derived from Roman numeral                                      |
| `title`             | `string`                                    | ✓        | Min length: 5                                  | Constitution `## Article X — Title` pattern                     |
| `sections`          | `ConstitutionalSection[]`                   | ✓        | Min length: 1                                  | Parsed from `### X.Y` subsections                               |
| `forbiddenPatterns` | `ForbiddenPattern[]`                        | ○        | -                                              | Parsed from `### X.Y Forbidden Patterns`                        |
| `priority`          | `'CRITICAL' \| 'HIGH' \| 'MEDIUM' \| 'LOW'` | ✓        | Enum                                           | Derived from article topic (IX = CRITICAL, II/III = HIGH, etc.) |

**Relationships**:

- Has many `ConstitutionalSection`
- Has many `ForbiddenPattern` (optional, not all articles have forbidden patterns)

**Validation Rules**:

- Article number must match section number prefix (e.g., Article II has sections 2.1, 2.2, etc.)
- Title cannot be empty or generic ("Article II" alone is invalid; must include description)

**State Transitions**: Immutable (loaded from constitution.md, not modified by audit)

---

### 2. ConstitutionalSection

**Purpose**: Represents a subsection within an article (e.g., Article II §2.1)

**Fields**:

| Field       | Type            | Required | Validation                                | Source                         |
| ----------- | --------------- | -------- | ----------------------------------------- | ------------------------------ |
| `id`        | `string`        | ✓        | Format: `"N.N"` (e.g., "2.1", "4.3")      | Constitution `### N.N` headers |
| `articleId` | `string`        | ✓        | Foreign key to `ConstitutionalArticle.id` | Parent article                 |
| `title`     | `string`        | ✓        | Min length: 3                             | Section title from markdown    |
| `rules`     | `string[]`      | ○        | -                                         | Bullet points under section    |
| `examples`  | `CodeExample[]` | ○        | -                                         | Code blocks within section     |

**Relationships**:

- Belongs to one `ConstitutionalArticle`

**Validation Rules**:

- Section ID must start with article number (e.g., section "2.7" belongs to Article II)
- Rules array can be empty (some sections are purely explanatory)

**State Transitions**: Immutable

---

### 3. ForbiddenPattern

**Purpose**: Represents a specific forbidden code pattern from Articles II-XII

**Fields**:

| Field               | Type                                        | Required | Validation                    | Source                                        |
| ------------------- | ------------------------------------------- | -------- | ----------------------------- | --------------------------------------------- |
| `id`                | `string`                                    | ✓        | UUID v4                       | Generated                                     |
| `articleId`         | `string`                                    | ✓        | Format: `"N.N"` (e.g., "2.7") | Section containing pattern                    |
| `patternName`       | `string`                                    | ✓        | Min length: 5                 | Extracted from bold text: `**Pattern name.**` |
| `description`       | `string`                                    | ✓        | Min length: 20                | Full description after pattern name           |
| `examples`          | `string[]`                                  | ○        | -                             | Code snippets showing violation               |
| `severity`          | `'CRITICAL' \| 'HIGH' \| 'MEDIUM' \| 'LOW'` | ✓        | Enum                          | Derived from article + pattern type           |
| `detectionStrategy` | `'glob' \| 'regex' \| 'ast' \| 'manual'`    | ✓        | Enum                          | How to detect this pattern (from R3 research) |

**Relationships**:

- Belongs to one `ConstitutionalSection` (via articleId)

**Validation Rules** (per spec.md FR-002, FR-007):

- Pattern name must be unique within article
- Severity assignment follows rules:
    - Article IX (security) → CRITICAL
    - Article II §2.7 (forbidden patterns) → CRITICAL or HIGH
    - Article XII (git) force-push → CRITICAL
    - Others → MEDIUM or LOW based on impact

**State Transitions**: Immutable

**Severity Classification Logic** (from R5 research + spec.md):

```typescript
function determineSeverity(articleId: string, patternName: string): Severity {
	// Security violations are always CRITICAL
	if (articleId.startsWith('9.')) return 'CRITICAL';

	// Code quality forbidden patterns
	if (articleId === '2.7') {
		if (/service layer|barrel file|eval|any type/.test(patternName)) return 'CRITICAL';
		return 'HIGH';
	}

	// Git workflow violations
	if (articleId.startsWith('12.')) {
		if (/force-push|WIP commit/.test(patternName)) return 'CRITICAL';
		return 'HIGH';
	}

	return 'MEDIUM'; // Default for other patterns
}
```

---

### 4. Violation

**Purpose**: Represents a single detected violation of a constitutional rule

**Fields**:

| Field                    | Type                                        | Required | Validation                      | Source                                                    |
| ------------------------ | ------------------------------------------- | -------- | ------------------------------- | --------------------------------------------------------- |
| `id`                     | `string`                                    | ✓        | UUID v4                         | Generated during audit                                    |
| `severity`               | `'CRITICAL' \| 'HIGH' \| 'MEDIUM' \| 'LOW'` | ✓        | Enum                            | From `ForbiddenPattern.severity` or derived               |
| `articleReference`       | `string`                                    | ✓        | Format: `"Article X §X.Y"`      | E.g., "Article II §2.7"                                   |
| `ruleViolated`           | `string`                                    | ✓        | -                               | Human-readable rule description                           |
| `filePath`               | `string`                                    | ✓        | Relative path from project root | E.g., "src/lib/utils.ts"                                  |
| `lineNumber`             | `number`                                    | ✓        | Min: 1                          | Line where violation occurs                               |
| `columnNumber`           | `number`                                    | ○        | Min: 1                          | Column (if available from AST)                            |
| `violationType`          | `string`                                    | ✓        | -                               | E.g., "any-type-usage", "forbidden-pattern-service-layer" |
| `codeSnippet`            | `string`                                    | ○        | Max 200 chars                   | Code context around violation                             |
| `suggestedFix`           | `string`                                    | ○        | -                               | Actionable fix recommendation                             |
| `isPreExisting`          | `boolean`                                   | ✓        | -                               | True if committed before 2026-02-13 (from R4 git blame)   |
| `commitDate`             | `string`                                    | ○        | ISO 8601                        | When violation was introduced                             |
| `commitHash`             | `string`                                    | ○        | SHA-1                           | Commit that introduced violation                          |
| `exemptionStatus`        | `'none' \| 'requested' \| 'approved'`       | ✓        | Enum                            | For @constitutional-exemption annotations                 |
| `exemptionJustification` | `string`                                    | ○        | Min 20 chars                    | Required if exemptionStatus !== 'none'                    |
| `exemptionIssueNumber`   | `string`                                    | ○        | Format: `#NNN`                  | GitHub issue tracking exemption                           |

**Relationships**:

- Belongs to one `AuditReport`
- References one `ForbiddenPattern` or `ConstitutionalArticle` (depending on violation type)

**Validation Rules** (per spec.md FR-008, FR-015):

- filePath must exist in project
- lineNumber must be valid for file (cannot exceed file length)
- If exemptionStatus !== 'none', must have exemptionJustification AND exemptionIssueNumber
- isPreExisting determined by git blame against CONSTITUTION_UNIX=1770947581

**State Transitions**:

```
NEW → (exemption requested) → EXEMPTION_REQUESTED → (approved) → EXEMPTED
NEW → (fixed) → RESOLVED
```

---

### 5. AuditReport

**Purpose**: Aggregates all audit results for a single execution, persisted as JSON

**Fields**:

| Field                      | Type                                                   | Required | Validation          | Source                                                |
| -------------------------- | ------------------------------------------------------ | -------- | ------------------- | ----------------------------------------------------- |
| `id`                       | `string`                                               | ✓        | UUID v4             | Generated                                             |
| `timestamp`                | `string`                                               | ✓        | ISO 8601            | Execution start time                                  |
| `constitutionVersion`      | `string`                                               | ✓        | Semver format       | From constitution metadata                            |
| `executionDurationMs`      | `number`                                               | ✓        | Min: 0, Max: 120000 | Must complete in <60s (SC-001)                        |
| `overallCompliancePercent` | `number`                                               | ✓        | Range: 0-100        | `(passing articles / total articles) × 100`           |
| `totalViolations`          | `number`                                               | ✓        | Min: 0              | Count of all violations                               |
| `criticalViolations`       | `number`                                               | ✓        | Min: 0              | Count where severity=CRITICAL                         |
| `highViolations`           | `number`                                               | ✓        | Min: 0              | Count where severity=HIGH                             |
| `mediumViolations`         | `number`                                               | ✓        | Min: 0              | Count where severity=MEDIUM                           |
| `lowViolations`            | `number`                                               | ✓        | Min: 0              | Count where severity=LOW                              |
| `articleScores`            | `ComplianceScore[]`                                    | ✓        | Length: 12          | One per constitutional article                        |
| `violations`               | `Violation[]`                                          | ✓        | -                   | All detected violations                               |
| `filesScanned`             | `number`                                               | ✓        | Min: 0              | Count of files analyzed                               |
| `scope`                    | `'full' \| 'incremental' \| 'directory' \| 'article'`  | ✓        | Enum                | Audit scope (from FR-009)                             |
| `scopeFilter`              | `string`                                               | ○        | -                   | E.g., "src/lib/", "Article II", "changed-files"       |
| `trendDirection`           | `'improving' \| 'stable' \| 'degrading' \| 'baseline'` | ✓        | Enum                | Compared to previous report (from R11 trend tracking) |

**Relationships**:

- Has many `Violation`
- Has many `ComplianceScore`

**Validation Rules** (per spec.md SC-001, FR-008, FR-011):

- executionDurationMs must be < 60000 (60 seconds per SC-001)
- overallCompliancePercent = (articlesWithScore100 / 12) × 100
- totalViolations = criticalViolations + highViolations + mediumViolations + lowViolations
- articleScores length must equal 12 (one per Article I-XII)

**State Transitions**: Immutable once generated (reports are append-only historical records)

**Persistence**:

- Stored as: `.specify/audit-reports/audit-{ISO_TIMESTAMP}.json`
- Format: JSON (pretty-printed for human readability)
- Retention: Unlimited (all reports kept for trend tracking)

**Example Filename**: `audit-2026-02-13-145523.json`

---

### 6. ComplianceScore

**Purpose**: Quantifies adherence to a specific constitutional article

**Fields**:

| Field                  | Type                                                   | Required | Validation                  | Source                                        |
| ---------------------- | ------------------------------------------------------ | -------- | --------------------------- | --------------------------------------------- |
| `articleId`            | `string`                                               | ✓        | Format: Roman numeral I-XII | Article identifier                            |
| `articleTitle`         | `string`                                               | ✓        | -                           | For report readability                        |
| `totalChecks`          | `number`                                               | ✓        | Min: 0                      | Number of rules audited                       |
| `passingChecks`        | `number`                                               | ✓        | Min: 0, Max: totalChecks    | Rules with zero violations                    |
| `failingChecks`        | `number`                                               | ✓        | -                           | `totalChecks - passingChecks`                 |
| `scorePercent`         | `number`                                               | ✓        | Range: 0-100                | `(passingChecks / totalChecks) × 100`         |
| `violationCount`       | `number`                                               | ✓        | Min: 0                      | Total violations for this article             |
| `trendDirection`       | `'improving' \| 'stable' \| 'degrading' \| 'baseline'` | ✓        | Enum                        | Compared to previous audit                    |
| `previousScorePercent` | `number`                                               | ○        | Range: 0-100                | Score from last audit (for trend calculation) |

**Relationships**:

- Belongs to one `AuditReport`
- References one `ConstitutionalArticle`

**Validation Rules** (per spec.md SC-009, FR-008):

- scorePercent = (passingChecks / totalChecks) × 100
- failingChecks = totalChecks - passingChecks
- trendDirection logic:
    - If no previous report → 'baseline'
    - If scorePercent > previousScorePercent → 'improving'
    - If scorePercent === previousScorePercent → 'stable'
    - If scorePercent < previousScorePercent → 'degrading'

**State Transitions**: Immutable

---

### 7. ExemptionAnnotation

**Purpose**: Represents a @constitutional-exemption comment in code

**Fields**:

| Field              | Type     | Required | Validation            | Source                                    |
| ------------------ | -------- | -------- | --------------------- | ----------------------------------------- |
| `id`               | `string` | ✓        | UUID v4               | Generated                                 |
| `filePath`         | `string` | ✓        | Relative path         | File containing annotation                |
| `lineNumber`       | `number` | ✓        | Min: 1                | Line of @constitutional-exemption comment |
| `articleReference` | `string` | ✓        | Format: `Article-X-Y` | E.g., "Article-II-2.1"                    |
| `issueNumber`      | `string` | ✓        | Format: `#NNN`        | GitHub issue tracking exemption           |
| `justification`    | `string` | ✓        | Min 20 chars          | Why exemption is necessary                |
| `expirationDate`   | `string` | ○        | ISO 8601 date         | When exemption should be reviewed         |
| `parsedAt`         | `string` | ✓        | ISO 8601              | When annotation was detected              |

**Annotation Format** (from spec.md FR-014):

```typescript
// @constitutional-exemption Article-II-2.1 issue:#123 — Type assertion required for vendor library compatibility
const config = vendorLib.getConfig() as VendorConfig;
```

**Validation Rules**:

- articleReference must match pattern `Article-[I-XII]-\d+\.\d+`
- issueNumber must reference existing GitHub issue (validated at parse time with warning if not found)
- justification must be substantive (not generic like "temporary workaround")

**State Transitions**: Immutable (exemptions are point-in-time snapshots)

---

## Entity Relationships Diagram

```
ConstitutionalArticle (1) ──┬─< (M) ConstitutionalSection
                             │
                             └─< (M) ForbiddenPattern

AuditReport (1) ──┬─< (M) Violation
                  │
                  └─< (12) ComplianceScore ──> (1) ConstitutionalArticle

Violation (1) ───> (1) ForbiddenPattern (optional reference)

ExemptionAnnotation (1) ───> (1) Violation (suppresses violation reporting)
```

**Key**:

- `(1) ──> (M)` = one-to-many
- `(1) ───> (1)` = one-to-one reference

---

## Derived Calculations

### Overall Compliance Percentage (AuditReport.overallCompliancePercent)

```typescript
function calculateOverallCompliance(articleScores: ComplianceScore[]): number {
	const passingArticles = articleScores.filter((score) => score.scorePercent === 100).length;
	return Math.round((passingArticles / 12) * 100);
}
```

**Logic**: An article is "passing" only if it has 100% compliance (zero violations). Partial compliance counts as failure per strict interpretation of constitution.

### Article Compliance Score (ComplianceScore.scorePercent)

```typescript
function calculateArticleScore(article: ConstitutionalArticle, violations: Violation[]): number {
	const totalRules = article.sections.reduce((sum, s) => sum + s.rules.length, 0);
	const violatedRules = new Set(violations.map((v) => v.ruleViolated)).size;
	const passingRules = totalRules - violatedRules;
	return Math.round((passingRules / totalRules) * 100);
}
```

### Trend Direction (ComplianceScore.trendDirection)

```typescript
function determineTrend(current: number, previous: number | null): TrendDirection {
	if (previous === null) return 'baseline';
	if (current > previous) return 'improving';
	if (current === previous) return 'stable';
	return 'degrading';
}
```

---

## Validation Schemas (Zod)

**Defined in**: `src/lib/constitution/types.ts`

```typescript
import { z } from 'zod';

export const SeveritySchema = z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']);

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
	exemptionStatus: z.enum(['none', 'requested', 'approved']),
	exemptionJustification: z.string().min(20).optional(),
	exemptionIssueNumber: z
		.string()
		.regex(/^#\d+$/)
		.optional()
});

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
	scope: z.enum(['full', 'incremental', 'directory', 'article']),
	scopeFilter: z.string().optional(),
	trendDirection: z.enum(['improving', 'stable', 'degrading', 'baseline'])
});

export type Violation = z.infer<typeof ViolationSchema>;
export type AuditReport = z.infer<typeof AuditReportSchema>;
// ... (additional type exports)
```

---

## File Persistence Format

**Audit Report JSON Structure**:

```json
{
	"id": "550e8400-e29b-41d4-a716-446655440000",
	"timestamp": "2026-02-13T14:55:23.123Z",
	"constitutionVersion": "2.0.0",
	"executionDurationMs": 3521,
	"overallCompliancePercent": 67,
	"totalViolations": 42,
	"criticalViolations": 3,
	"highViolations": 15,
	"mediumViolations": 18,
	"lowViolations": 6,
	"articleScores": [
		{
			"articleId": "II",
			"articleTitle": "Code Quality Standards",
			"totalChecks": 25,
			"passingChecks": 18,
			"failingChecks": 7,
			"scorePercent": 72,
			"violationCount": 15,
			"trendDirection": "degrading",
			"previousScorePercent": 80
		}
		// ... (11 more articles)
	],
	"violations": [
		{
			"id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
			"severity": "HIGH",
			"articleReference": "Article II §2.1",
			"ruleViolated": "No `any` type",
			"filePath": "src/lib/utils/legacy-parser.ts",
			"lineNumber": 42,
			"columnNumber": 15,
			"violationType": "any-type-usage",
			"codeSnippet": "function parseData(input: any) {",
			"suggestedFix": "Replace `any` with `unknown` and add type guard",
			"isPreExisting": true,
			"commitDate": "2025-11-20T10:30:00Z",
			"commitHash": "abc123def456...",
			"exemptionStatus": "none"
		}
		// ... (41 more violations)
	],
	"filesScanned": 87,
	"scope": "full",
	"trendDirection": "degrading"
}
```

---

## Implementation Notes

1. **Zod Validation**: All entities use Zod schemas (reuses existing pattern from `src/lib/server/env.ts` per R5 research).

2. **Immutability**: Constitutional entities (Article, Section, ForbiddenPattern) are immutable. AuditReport and Violation are append-only.

3. **Performance**: Entity instantiation must be lightweight (avoid heavy parsing in constructors). Pre-compute derived fields during report generation, not on access.

4. **Type Safety**: TypeScript strict mode enforced. No `any` types allowed (per Article II §2.1).

5. **Reuse**: Leverages existing validation patterns from `src/lib/types/validation.ts` and `src/lib/server/security/input-sanitizer.ts` (per R6 research).
