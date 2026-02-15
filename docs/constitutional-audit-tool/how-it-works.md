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
│  - Saved to: docs/reports/YYYY-MM-DD/audit-*.*              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Trend Tracking (trend-tracker.ts)                           │
│  - Compares to previous audit reports                        │
│  - Calculates compliance trends (improving/degrading/stable) │
│  - Tracks article-level trends                               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  🆕 Organized Report Writer (organized-report-writer.ts)     │
│  - Orchestrates automated analysis workflow                  │
│  - Creates dated folder: docs/reports/YYYY-MM-DD/           │
│  - Generates category subfolders with comprehensive READMEs  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  🆕 Category Organizer (category-organizer.ts)               │
│  - Groups violations by type (UI, Service, Type Safety, etc) │
│  - Assigns priorities (CRITICAL/HIGH/MEDIUM/LOW)             │
│  - Creates category metadata (impact, timeline, description) │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  🆕 Dependency Analyzer (dependency-analyzer.ts)             │
│  - Applies Dependency Verification Rulebook v2.0 (8 phases)  │
│  - Analyzes package.json for existing dependencies           │
│  - Calculates new dependencies per category                  │
│  - Estimates bundle size impact and risk level               │
│  - Generates install and verification commands               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  🆕 Analysis Generator (analysis-generator.ts)               │
│  - Generates comprehensive README for each category          │
│  - Includes: violations, dependencies, remediation options   │
│  - Risk assessment, recommendations, next steps              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  🆕 Master Report Generator (master-report-generator.ts)     │
│  - Creates top-level README with priority matrix             │
│  - Generates DEPENDENCY-INVESTIGATION-REPORT.md              │
│  - Provides implementation roadmap and compliance projections│
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
11. Save to docs/reports/YYYY-MM-DD/
    ↓
12. 🆕 Organize violations into categories
    ↓
13. 🆕 Analyze dependencies for each category (Rulebook v2.0)
    ↓
14. 🆕 Create dated folder with subfolders
    ↓
15. 🆕 Generate category READMEs with analysis
    ↓
16. 🆕 Generate master README and DEPENDENCY-INVESTIGATION-REPORT
    ↓
17. 🆕 Present organized analysis to user
```

## Automated Organized Analysis (NEW)

### Overview

The audit system now automatically generates organized, actionable reports with dependency analysis BEFORE presenting results to the user. This eliminates manual analysis steps and provides immediate implementation guidance.

### Category Organization

**File**: `src/lib/constitution/category-organizer.ts`

Violations are automatically grouped into logical categories:

1. **UI Modernization** - Hardcoded colors, inline styles, non-Tailwind patterns
2. **Service Layer Violations** - Files in `src/lib/services/` (Article II §2.7)
3. **Type Safety Violations** - `any` types, `@ts-ignore`, type assertions
4. **Component Reuse** - Duplicate component patterns
5. **Test Coverage** - Missing or low test coverage
6. **Security** - Article IX violations (secrets, eval, unsafe patterns)
7. **Performance** - Article V violations
8. **Other** - Violations not fitting other categories

Each category includes:

- Priority (CRITICAL/HIGH/MEDIUM/LOW)
- Impact description
- Estimated implementation timeline
- Folder name for organized reports

### Dependency Analysis (Rulebook v2.0)

**File**: `src/lib/constitution/dependency-analyzer.ts`

Applies the 8-phase Dependency Verification Rulebook methodology:

**Phase 1: Inventory** - Read package.json, list existing dependencies

**Phase 2: Concreteness** - Map each category to specific package requirements

- UI Modernization → clsx, tailwind-merge, tailwind-variants, lucide-svelte, shadcn-svelte
- Service Layer → ZERO (code reorganization only)
- Type Safety → ZERO (Zod already installed)

**Phase 3: Dependency Chains** - Check transitive dependencies (npm tree)

**Phase 4: Translation** - Generate exact install commands

```bash
npm install clsx@^2.1.1 tailwind-merge@^2.5.5 ...
```

**Phase 5: Completeness** - Verify prerequisites (Tailwind, TypeScript, SvelteKit)

**Phase 6: Proof** - Validate with verification commands

```bash
npm run typecheck && npm run build
```

**Phase 7: Challenge** - Identify ZERO-dependency categories (highest priority)

**Phase 8: Consistency** - Calculate bundle size impact and risk level

**Output**: `DependencyAnalysis` object per category with:

- New dependencies (name, version, size, license, purpose)
- Existing dependencies
- Bundle size impact (KB)
- Total cost (ZERO/LOW/MEDIUM/HIGH)
- Risk level (LOW/MEDIUM/HIGH/CRITICAL)
- Install commands
- Verification commands

### Category Analysis Generation

**File**: `src/lib/constitution/analysis-generator.ts`

Generates comprehensive README.md for each category with:

**Header Section**:

- Violation count, priority, impact
- Status (pre-existing vs new)

**Dependency Requirements**:

- If ZERO dependencies: Rationale for why (e.g., "Zod already installed")
- If new dependencies: List with versions, sizes, licenses, purposes
- Install commands (ready to copy-paste)
- Verification commands

**Detected Violations**:

- File paths and line numbers
- Rule violated
- Suggested fix
- Pre-existing status with commit dates

**Remediation Strategy**:

- **Option A**: Full remediation (fix all violations, estimated timeline)
- **Option B**: Incremental remediation (fix during normal development)
- **Option C**: Constitutional exemption (document and defer)

**Risk Assessment**:

- Overall risk level
- Dependency risks (if applicable)
- Mitigation strategies

**Recommendation**:

- Priority-based recommendation (CRITICAL → Option A or C, HIGH → Option A, MEDIUM → Option B, LOW → Option C)
- Cost-benefit analysis

**Next Steps**:

- Detailed checklist for proceeding with remediation
- Checklist for deferring with exemptions

### Master Report Generation

**File**: `src/lib/constitution/master-report-generator.ts`

Creates two top-level documents:

**1. README.md (Master Report)**:

- Quick summary (overall compliance, total violations)
- Breakdown by severity with category names
- Report structure (links to category folders)
- Priority matrix (CRITICAL → HIGH → MEDIUM → LOW)
- Recommended implementation order
- Compliance score projections
- How to use this report (strategic planning, implementation, tracking)
- Next actions (immediate, this week, next audit)

**2. DEPENDENCY-INVESTIGATION-REPORT.md**:

- Executive summary table (dependencies, bundle impact, cost, risk)
- Critical findings (ZERO dependencies vs dependencies required)
- Per-category analysis sections:
    - Required dependencies (with versions, sizes, licenses)
    - Installation commands
    - Prerequisites
    - Verification commands
- Methodology reference (Rulebook v2.0, 8 phases)

### Orchestration

**File**: `src/lib/constitution/organized-report-writer.ts`

Main orchestrator that executes the automated workflow:

```typescript
1. organizeViolations() → Create categories
2. analyzeDependencies() → Run Rulebook v2.0 analysis
3. Create dated folder: docs/reports/YYYY-MM-DD/
4. For each category:
   - Create subfolder
   - Generate README with analysis
5. Generate master README
6. Generate DEPENDENCY-INVESTIGATION-REPORT.md
7. Print summary to console with next steps
```

**Console Output**:

```
📁 Organizing violations into categories...
   Found 4 violation categories
📦 Analyzing dependencies for each category...
   Dependency analysis complete
   Created audit folder: 2026-02-13/
📝 Generating category analyses...
   ✓ 01-ui-modernization/README.md
   ✓ 02-service-layer-violations/README.md
   ✓ 03-type-safety-violations/README.md
   ✓ 04-component-reuse/README.md
📄 Generating master README...
   ✓ README.md (master report)
🔍 Generating dependency investigation report...
   ✓ DEPENDENCY-INVESTIGATION-REPORT.md

✅ Organized audit reports generated successfully!

📊 Summary:
   - 4 violation categories
   - 4 category READMEs
   - 1 master README
   - 1 dependency investigation report

📁 Location: docs/reports/2026-02-13

💡 Dependency Summary:

   ✅ ZERO dependencies needed for:
      - Service Layer Violations
      - Type Safety Violations

   ⚠️  Dependencies required for:
      - UI Modernization: 5 packages (+209KB)

📖 Next Steps:
   1. Review the master README in the dated folder
   2. Check DEPENDENCY-INVESTIGATION-REPORT.md for dependency details
   3. Read each category README for remediation options
   4. Choose your implementation approach
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
