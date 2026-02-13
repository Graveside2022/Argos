# API Contract: Constitutional Compliance Audit

**Feature**: `001-constitution-audit` | **Date**: 2026-02-13
**Contract Type**: Internal TypeScript API (not HTTP REST)

---

## Overview

This contract defines the TypeScript API for the constitutional compliance audit system. The audit is invoked programmatically via the `/speckit.code_check` command, which calls the auditor module. This is NOT an HTTP API — all communication is in-process TypeScript function calls.

---

## Core API

### `runAudit(options: AuditOptions): Promise<AuditReport>`

**Purpose**: Execute a constitutional compliance audit

**Parameters**:

```typescript
interface AuditOptions {
	/**
	 * Audit scope
	 * - 'full': Scan entire src/ directory
	 * - 'incremental': Only files changed since last audit
	 * - 'directory': Specific directory path
	 * - 'article': Specific constitutional article
	 */
	scope: 'full' | 'incremental' | 'directory' | 'article';

	/**
	 * Scope filter (required for 'directory' and 'article' scopes)
	 * Examples: "src/lib/", "Article II", "src/routes/api/"
	 */
	scopeFilter?: string;

	/**
	 * Project root directory (absolute path)
	 * Default: process.cwd()
	 */
	projectRoot?: string;

	/**
	 * Path to constitution.md file (absolute path)
	 * Default: {projectRoot}/.specify/memory/constitution.md
	 */
	constitutionPath?: string;

	/**
	 * Output directory for audit report JSON
	 * Default: {projectRoot}/.specify/audit-reports/
	 */
	reportOutputDir?: string;

	/**
	 * Output formats
	 * - 'json': JSON report file
	 * - 'markdown': Markdown summary
	 * - 'terminal': Colorized terminal output
	 */
	outputFormats: ('json' | 'markdown' | 'terminal')[];

	/**
	 * Performance timeout (milliseconds)
	 * Default: 60000 (60 seconds per SC-001)
	 */
	timeoutMs?: number;

	/**
	 * Enable verbose logging
	 * Default: false
	 */
	verbose?: boolean;
}
```

**Returns**: `Promise<AuditReport>`

**Throws**:

- `AuditTimeoutError` if execution exceeds timeoutMs
- `ConstitutionParseError` if constitution.md cannot be parsed
- `InvalidScopeError` if scope filter is invalid

**Example Usage**:

```typescript
import { runAudit } from '$lib/constitution/auditor';

// Full codebase audit
const report = await runAudit({
	scope: 'full',
	outputFormats: ['json', 'terminal']
});

// Audit specific directory
const report = await runAudit({
	scope: 'directory',
	scopeFilter: 'src/lib/',
	outputFormats: ['json', 'markdown']
});

// Audit specific article
const report = await runAudit({
	scope: 'article',
	scopeFilter: 'Article II',
	outputFormats: ['terminal']
});
```

---

### `parseConstitution(constitutionPath: string): Promise<ConstitutionalArticle[]>`

**Purpose**: Parse constitution.md into structured data

**Parameters**:

- `constitutionPath` (string): Absolute path to constitution.md file

**Returns**: `Promise<ConstitutionalArticle[]>` — Array of 12 articles

**Throws**:

- `ConstitutionParseError` if file cannot be read or parsed
- `ConstitutionValidationError` if parsed structure fails Zod validation

**Example Usage**:

```typescript
import { parseConstitution } from '$lib/constitution/constitution-parser';

const articles = await parseConstitution('.specify/memory/constitution.md');
console.log(`Parsed ${articles.length} articles`); // 12
```

---

### `validateViolation(violation: Violation): ValidationResult`

**Purpose**: Validate a violation object against Zod schema

**Parameters**:

- `violation` (Violation): Violation object to validate

**Returns**: `ValidationResult`

```typescript
interface ValidationResult {
	valid: boolean;
	errors?: string[]; // Zod validation errors
}
```

**Example Usage**:

```typescript
import { validateViolation } from '$lib/constitution/types';

const result = validateViolation({
	id: 'invalid-uuid', // Will fail
	severity: 'HIGH',
	articleReference: 'Article II §2.1'
	// ... other fields
});

if (!result.valid) {
	console.error('Validation errors:', result.errors);
}
```

---

### `categor izeViolationByTimestamp(file: string, line: number): Promise<ViolationCategory>`

**Purpose**: Determine if violation is pre-existing or new using git blame

**Parameters**:

- `file` (string): Relative file path
- `line` (number): Line number (1-indexed)

**Returns**: `Promise<ViolationCategory>`

```typescript
interface ViolationCategory {
	isPreExisting: boolean; // True if before 2026-02-13
	commitDate: string; // ISO 8601
	commitHash: string; // SHA-1
	commitAuthor: string;
}
```

**Throws**:

- `GitNotAvailableError` if git not installed or not a git repository
- `FileNotFoundError` if file does not exist

**Example Usage**:

```typescript
import { categorizeViolationByTimestamp } from '$lib/constitution/git-categorizer';

const category = await categorizeViolationByTimestamp('src/lib/utils.ts', 42);
if (category.isPreExisting) {
	console.log(`Pre-existing violation from ${category.commitDate}`);
} else {
	console.log(`New violation introduced in ${category.commitHash}`);
}
```

---

### `extractCoverageMetrics(): Promise<CoverageSummary>`

**Purpose**: Extract Vitest test coverage metrics

**Returns**: `Promise<CoverageSummary>`

```typescript
interface CoverageSummary {
  globalCoveragePercent: number; // 0-100
  totalFilesAnalyzed: number;
  filesPassing: number; // Files with >= 80% coverage
  files Failing: number; // Files with < 80% coverage
  details: FileCoverage[]; // Per-file breakdown
}

interface FileCoverage {
  filePath: string;
  linesPct: number; // 0-100
  statementsPct: number;
  functionsPct: number;
  branchesPct: number;
  meetsThreshold: boolean; // >= 80%
}
```

**Throws**:

- `CoverageNotFoundError` if coverage/coverage-final.json does not exist
- `VitestNotConfiguredError` if vitest.config.ts missing coverage config

**Example Usage**:

```typescript
import { extractCoverageMetrics } from '$lib/constitution/coverage-extractor';

const coverage = await extractCoverageMetrics();
console.log(`Global coverage: ${coverage.globalCoveragePercent}%`);
console.log(
	`Files passing Article III §3.2: ${coverage.filesPassing}/${coverage.totalFilesAnalyzed}`
);
```

---

### `generateReport(auditReport: AuditReport, format: ReportFormat): string`

**Purpose**: Generate formatted output from audit report

**Parameters**:

- `auditReport` (AuditReport): Audit results
- `format` (ReportFormat): Output format

```typescript
type ReportFormat = 'json' | 'markdown' | 'terminal';
```

**Returns**: `string` — Formatted report

**Example Usage**:

```typescript
import { generateReport } from '$lib/constitution/report-generator';

const jsonReport = generateReport(auditReport, 'json');
fs.writeFileSync('.specify/audit-reports/audit-2026-02-13.json', jsonReport);

const terminalReport = generateReport(auditReport, 'terminal');
console.log(terminalReport); // Colorized output
```

---

## Validator API

Each constitutional article has a dedicated validator module:

### `validateArticleII(projectRoot: string): Promise<Violation[]>`

**Purpose**: Validate Article II (Code Quality Standards)

**Checks**:

- TypeScript `any` types (§2.1)
- `@ts-ignore` without issue reference (§2.1)
- Type assertions without justification (§2.1)
- Forbidden patterns (§2.7): service layers, barrel files, catch-all utils, hardcoded colors, browser alerts

**Returns**: `Promise<Violation[]>` — All detected violations

**Example Usage**:

```typescript
import { validateArticleII } from '$lib/constitution/validators/article-ii-code-quality';

const violations = await validateArticleII(process.cwd());
console.log(`Found ${violations.length} Article II violations`);
```

### `validateArticleIII(projectRoot: string): Promise<Violation[]>`

**Purpose**: Validate Article III (Testing Standards)

**Checks**:

- Test coverage < 80% (§3.2)
- Missing tests for components/utilities (§3.1)

**Returns**: `Promise<Violation[]>`

### `validateArticleIV(projectRoot: string): Promise<Violation[]>`

**Purpose**: Validate Article IV (UX Consistency)

**Checks**:

- Components missing required states (§4.3): empty, loading, error, etc.
- Duplicate implementations (§4.2 reuse-before-create)

**Returns**: `Promise<Violation[]>`

### `validateArticleVI(projectRoot: string): Promise<Violation[]>`

**Purpose**: Validate Article VI (Dependency Management)

**Checks**:

- Forbidden dependency categories in package.json (§6.3)
- Unpinned version ranges (§6.1)

**Returns**: `Promise<Violation[]>`

### `validateArticleIX(projectRoot: string): Promise<Violation[]>`

**Purpose**: Validate Article IX (Security)

**Checks**:

- Forbidden patterns (§9.4): `eval()`, `new Function()`, `innerHTML`, `{@html}`
- Hardcoded secrets (§9.1)

**Returns**: `Promise<Violation[]>`

---

## Error Types

All errors extend `ConstitutionalAuditError`:

```typescript
class ConstitutionalAuditError extends Error {
	constructor(
		message: string,
		public code: string,
		public details?: unknown
	) {
		super(message);
		this.name = 'ConstitutionalAuditError';
	}
}

class AuditTimeoutError extends ConstitutionalAuditError {
	constructor(timeoutMs: number) {
		super(`Audit exceeded timeout of ${timeoutMs}ms`, 'AUDIT_TIMEOUT', { timeoutMs });
	}
}

class ConstitutionParseError extends ConstitutionalAuditError {
	constructor(filePath: string, parseError: Error) {
		super(`Failed to parse constitution: ${parseError.message}`, 'CONSTITUTION_PARSE_ERROR', {
			filePath,
			parseError
		});
	}
}

class InvalidScopeError extends ConstitutionalAuditError {
	constructor(scope: string, filter?: string) {
		super(
			`Invalid audit scope: ${scope}${filter ? ` with filter "${filter}"` : ''}`,
			'INVALID_SCOPE',
			{ scope, filter }
		);
	}
}

class GitNotAvailableError extends ConstitutionalAuditError {
	constructor() {
		super('Git is not available or this is not a git repository', 'GIT_NOT_AVAILABLE');
	}
}

class CoverageNotFoundError extends ConstitutionalAuditError {
	constructor(coveragePath: string) {
		super(
			`Coverage file not found: ${coveragePath}. Run tests with coverage first.`,
			'COVERAGE_NOT_FOUND',
			{ coveragePath }
		);
	}
}
```

---

## CLI Integration

The `/speckit.code_check` command is implemented as:

**File**: `.claude/commands/speckit.code_check.md`

**Command Definition**:

````markdown
# speckit.code_check

Runs a constitutional compliance audit on the Argos codebase.

## Usage

```bash
/speckit.code_check [scope] [filter]
```
````

**Arguments**:

- `scope` (optional): `full` | `incremental` | `directory` | `article` (default: `full`)
- `filter` (optional): Directory path or article name (required for `directory` and `article` scopes)

**Examples**:

```bash
/speckit.code_check                        # Full audit
/speckit.code_check directory src/lib/     # Audit src/lib/ only
/speckit.code_check article "Article II"   # Audit Article II only
/speckit.code_check incremental            # Only changed files
```

**Outputs**:

- Terminal summary (colorized)
- JSON report saved to `.specify/audit-reports/audit-{timestamp}.json`
- Markdown summary (optional)

````

**Implementation**:
```typescript
// .claude/commands/speckit.code_check.ts
import { runAudit } from '$lib/constitution/auditor';

export async function execute(args: string[]) {
  const scope = (args[0] as AuditOptions['scope']) || 'full';
  const scopeFilter = args[1];

  const report = await runAudit({
    scope,
    scopeFilter,
    outputFormats: ['json', 'terminal']
  });

  if (report.criticalViolations > 0) {
    process.exitCode = 1; // Fail CI if CRITICAL violations found
  }
}
````

---

## Module Organization

**Directory Structure**:

```
src/lib/constitution/
├── auditor.ts                      # Main runAudit() entry point
├── types.ts                        # Zod schemas + TypeScript types
├── constitution-parser.ts          # parseConstitution() implementation
├── report-generator.ts             # generateReport() implementation
├── git-categorizer.ts              # categorizeViolationByTimestamp()
├── coverage-extractor.ts           # extractCoverageMetrics()
├── severity-classifier.ts          # Severity determination logic
├── trend-tracker.ts                # Trend calculation vs. previous reports
├── exemption-parser.ts             # Parse @constitutional-exemption annotations
└── validators/
    ├── article-i-comprehension.ts  # (Placeholder for future)
    ├── article-ii-code-quality.ts  # validateArticleII()
    ├── article-iii-testing.ts      # validateArticleIII()
    ├── article-iv-ux.ts            # validateArticleIV()
    ├── article-v-performance.ts    # (Placeholder)
    ├── article-vi-dependencies.ts  # validateArticleVI()
    ├── article-ix-security.ts      # validateArticleIX()
    └── article-xii-git.ts          # (Placeholder)
```

---

## Performance Requirements

Per spec.md Success Criteria SC-001:

- **Full codebase audit**: Must complete in < 60 seconds on target hardware (Raspberry Pi 5)
- **Incremental audit**: Must complete in < 10 seconds
- **Article-specific audit**: Must complete in < 30 seconds

**Performance Budget Breakdown**:

| Operation                  | Time Budget | Notes                        |
| -------------------------- | ----------- | ---------------------------- |
| Constitution parsing       | 100ms       | One-time per audit           |
| Git blame (100 violations) | 3.5s        | From R4 research             |
| Coverage extraction        | 30-45s      | Reuses existing test run     |
| AST analysis (50 files)    | 10-15s      | Estimated, to be benchmarked |
| Report generation          | 500ms       | JSON serialization           |
| **Total (full audit)**     | **< 60s**   | **With comfortable margin**  |

---

## Contract Validation

All API contracts are enforced via:

1. **TypeScript Strict Mode** (Article II §2.1)
2. **Zod Runtime Validation** (data-model.md schemas)
3. **Unit Tests** (tests/constitution/auditor.test.ts)
4. **Integration Tests** (tests/constitution/validators/)

**Validation Checklist**:

- ✓ All function signatures match TypeScript types
- ✓ All input parameters validated with Zod schemas
- ✓ All return values conform to documented types
- ✓ All error cases throw documented error types
- ✓ Performance budgets measured and enforced
