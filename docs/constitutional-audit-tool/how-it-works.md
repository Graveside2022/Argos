# How the Constitutional Audit Tool Works

## Overview

The constitutional audit tool is a static analysis system that scans the Argos codebase for violations of the project's constitutional principles. It uses AST (Abstract Syntax Tree) analysis, pattern matching, and coverage data to detect violations.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Constitutional Audit System               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Auditor (src/lib/constitution/auditor.ts)                  │
│  - Orchestrates the audit process                            │
│  - Loads constitution from .specify/memory/constitution.md   │
│  - Invokes validators for each article                       │
│  - Calculates trends and compliance scores                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Constitution Parser (constitution-parser.ts)                │
│  - Parses constitution.md markdown file                      │
│  - Extracts articles, sections, and forbidden patterns       │
│  - Validates structure with Zod schemas                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  12 Article Validators (validators/*.ts)                     │
│  - Article I: Comprehension (placeholder)                    │
│  - Article II: Code Quality (AST analysis)                   │
│  - Article III: Testing (coverage analysis)                  │
│  - Article IV: UX Consistency (placeholder)                  │
│  - Article V: Performance (placeholder)                      │
│  - Article VI: Dependencies (placeholder)                    │
│  - Article VII: Debugging (placeholder)                      │
│  - Article VIII: Verification (placeholder)                  │
│  - Article IX: Security (AST + pattern matching)             │
│  - Article X: Governance (placeholder)                       │
│  - Article XI: Spec-Kit (placeholder)                        │
│  - Article XII: Git Workflow (placeholder)                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Violation Collection & Categorization                       │
│  - Git categorizer: Determines if violation is pre-existing  │
│  - Severity classifier: Assigns CRITICAL/HIGH/MEDIUM/LOW     │
│  - Exemption parser: Processes @constitutional-exemption     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Report Generation (report-generator.ts)                     │
│  - JSON format (machine-readable, full data)                 │
│  - Markdown format (human-readable documentation)            │
│  - Terminal format (colorized CLI output)                    │
│  - Saved to: docs/reports/audit-YYYY-MM-DD-HH-MM-SS.*        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Trend Tracking (trend-tracker.ts)                           │
│  - Compares to previous audit reports                        │
│  - Calculates compliance trends (improving/degrading/stable) │
│  - Tracks article-level trends                               │
└─────────────────────────────────────────────────────────────┘
```

## Key Components

### 1. Constitution Parser

**File**: `src/lib/constitution/constitution-parser.ts`

Parses `.specify/memory/constitution.md` which contains:

- 12 articles (Article I through XII)
- Sections within each article (e.g., §2.1, §2.7)
- Forbidden patterns (specific anti-patterns to detect)

Uses regex to extract markdown structure, then validates with Zod schemas.

### 2. Article Validators

**Directory**: `src/lib/constitution/validators/`

Each validator implements detection logic for one article:

#### Article II: Code Quality (Most Complete)

**File**: `article-ii-code-quality.ts`

Uses TypeScript Compiler API for AST analysis:

- Detects `any` type usage
- Finds `@ts-ignore` without issue references
- Identifies type assertions without justification
- Detects hardcoded hex colors (regex)
- Checks for service layer pattern (file path matching)
- Detects barrel files (index.ts with only re-exports)
- Finds catch-all utility files (utils.ts, helpers.ts, etc.)

**Example Detection:**

```typescript
// Detected violation
function parseData(input: any) {  // ← `any` type detected by AST traversal
  return JSON.parse(input);
}

// AST detection code
if (node.kind === ts.SyntaxKind.AnyKeyword) {
  violations.push(createViolation(...));
}
```

#### Article III: Testing Standards

**File**: `article-iii-testing.ts`

Uses Istanbul coverage reports:

- Reads `coverage/coverage-final.json`
- Extracts line, branch, function, statement coverage
- Flags files with <80% coverage as violations

#### Article IX: Security

**File**: `article-ix-security.ts`

Pattern matching and AST analysis:

- Detects hardcoded secrets (API_KEY, PASSWORD, TOKEN in variable names)
- Finds `eval()` usage
- Detects unsafe patterns (`innerHTML`, `new Function()`)
- Identifies weak crypto patterns

### 3. Git Categorization

**File**: `src/lib/constitution/git-categorizer.ts`

Determines if violations are pre-existing:

- Runs `git blame` to get commit date for each violation
- Compares to constitution ratification date (2026-02-13)
- Marks violations as "pre-existing" if older than ratification
- Falls back to file mtime if git unavailable

### 4. Severity Classification

**File**: `src/lib/constitution/severity-classifier.ts`

Assigns severity levels:

- **CRITICAL**: Article IX (Security), service layer pattern, eval usage
- **HIGH**: any types, @ts-ignore, missing tests, security issues
- **MEDIUM**: Hardcoded colors, UX inconsistencies
- **LOW**: Style issues, minor deviations

### 5. Exemption System

**File**: `src/lib/constitution/exemption-parser.ts`

Processes exemption annotations in code:

```typescript
// @constitutional-exemption: Article II §2.1 issue:#123
// Legacy code - planned refactor in Q2
function legacyFunction(data: any) {
	// ...
}
```

Exempted violations are:

- Still reported in the audit
- Marked with `exemptionStatus: 'approved'`
- Can be filtered from compliance calculations

### 6. Trend Tracking

**File**: `src/lib/constitution/trend-tracker.ts`

Compares to previous audit reports:

- Loads most recent report from `docs/reports/`
- Calculates overall trend (improving/degrading/stable/baseline)
- Calculates per-article trends
- First audit is always marked "baseline"

**Trend Logic:**

- **Improving**: Compliance % increased
- **Degrading**: Compliance % decreased
- **Stable**: Compliance % unchanged
- **Baseline**: First audit (no previous data)

### 7. Report Generation

**File**: `src/lib/constitution/report-generator.ts`

Generates three report formats:

**JSON** (`audit-YYYY-MM-DD-HH-MM-SS.json`):

- Full machine-readable data
- All violations with complete metadata
- Can be parsed by CI/CD tools

**Markdown** (`audit-YYYY-MM-DD-HH-MM-SS.md`):

- Human-readable documentation
- Summary tables
- Violation listings with context
- Good for archival/review

**Terminal** (stdout):

- Colorized CLI output
- Real-time feedback during audit
- Summary statistics
- First 5 CRITICAL violations highlighted

## Execution Flow

```
1. Load constitution.md
   ↓
2. Parse articles and forbidden patterns
   ↓
3. Scan codebase (src/**/*.{ts,tsx,svelte})
   ↓
4. Run validators (12 articles)
   ↓
5. Collect violations
   ↓
6. Categorize (pre-existing vs new)
   ↓
7. Apply exemptions
   ↓
8. Calculate compliance scores
   ↓
9. Compare to previous audit (trends)
   ↓
10. Generate reports (JSON, Markdown, Terminal)
    ↓
11. Save to docs/reports/
```

## Detection Strategies

### AST Analysis (TypeScript Compiler API)

Used for structural code analysis:

- Type usage (`any` detection)
- Function calls (`eval()`, `alert()`)
- Import statements
- Class/interface definitions

**Pros**: Precise, understands code structure
**Cons**: Complex, slower, TypeScript-only

### Pattern Matching (Regex)

Used for simple text patterns:

- Hardcoded hex colors (`#[0-9a-fA-F]{6}`)
- Secret keywords (API_KEY, PASSWORD)
- Comment patterns

**Pros**: Fast, simple, works on any text
**Cons**: Can have false positives

### File Path Matching (Glob)

Used for architectural patterns:

- Service layer detection (`src/lib/services/**/*.ts`)
- Barrel file detection (`**/index.ts`)
- Catch-all utils (`**/utils.ts`)

**Pros**: Very fast, simple
**Cons**: Only checks file names/paths

### Coverage Analysis

Used for test compliance:

- Reads Istanbul coverage data
- Calculates per-file coverage percentages

**Pros**: Accurate test coverage metrics
**Cons**: Requires tests to be run first

## Extending the Audit System

### Adding a New Validator

1. Create new validator file:

```typescript
// src/lib/constitution/validators/article-xiii-new.ts
import { type Violation } from '../types.js';

export async function validateArticleXIII(projectRoot: string): Promise<Violation[]> {
	const violations: Violation[] = [];

	// Detection logic here

	return violations;
}
```

2. Register in auditor:

```typescript
// src/lib/constitution/auditor.ts
import { validateArticleXIII } from './validators/article-xiii-new.js';

violations.push(...(await validateArticleXIII(projectRoot)));
```

3. Add to constitution:

```markdown
## Article XIII — New Principle

### 13.1 New Rule

Description of the rule...
```

### Adding a New Forbidden Pattern

Just add to constitution.md:

```markdown
### 2.7 Forbidden Patterns

- **New pattern.** Description of why it's forbidden
```

The parser will automatically extract it, but you need to implement detection logic in the appropriate validator.

## Performance Considerations

- **Typical execution time**: 20-30 seconds for Argos codebase (~150 files)
- **Bottlenecks**:
    - AST parsing (TypeScript Compiler API)
    - Git blame for categorization
    - File I/O for large codebases
- **Optimizations**:
    - Cached AST parsing
    - Parallel file processing (could be added)
    - Incremental audits (only changed files)

## Testing the Audit System

Tests located in `tests/constitution/`:

- `auditor.test.ts` - Integration tests
- `constitution-parser.test.ts` - Parser unit tests
- `trend-tracker.test.ts` - Trend calculation tests
- `validators/*.test.ts` - Validator-specific tests

Run with: `npm run test tests/constitution/`
