# Quickstart: Constitutional Code Quality Audit

**Feature**: `001-constitution-audit` | **Date**: 2026-02-13
**For**: Developers, code reviewers, AI agents

---

## 30-Second Quickstart

```bash
# Run a full constitutional compliance audit
/speckit.code_check

# View the generated report
cat .specify/audit-reports/audit-*.json | jq '.overallCompliancePercent'
```

**That's it!** The audit will:

1. Scan your entire `src/` directory
2. Detect violations of all 12 constitutional articles
3. Generate a JSON report in `.specify/audit-reports/`
4. Display a terminal summary with colorized output

---

## What Gets Audited?

The constitutional audit validates your codebase against **12 Articles** from `.specify/memory/constitution.md`:

| Article  | Checks                         | Example Violations                                                                        |
| -------- | ------------------------------ | ----------------------------------------------------------------------------------------- |
| **I**    | Comprehension before action    | (Placeholder — manual review only in v1)                                                  |
| **II**   | Code quality standards         | `any` types, `@ts-ignore`, barrel files, service layers, hardcoded colors, browser alerts |
| **III**  | Testing standards              | Test coverage < 80%, missing component tests                                              |
| **IV**   | UX consistency                 | Missing states (empty, loading, error), duplicate implementations                         |
| **V**    | Performance requirements       | (Placeholder — manual benchmarking in v1)                                                 |
| **VI**   | Dependency management          | Forbidden packages (ORMs, state libs), unpinned versions                                  |
| **VII**  | Debugging practices            | (Placeholder — manual review only in v1)                                                  |
| **VIII** | Verification before completion | (Enforced by workflow, not automated checks)                                              |
| **IX**   | Security                       | `eval()`, `new Function()`, `innerHTML`, hardcoded secrets                                |
| **X**    | Governance                     | (Constitution meta-rules, not code checks)                                                |
| **XI**   | Spec-Kit workflow              | (Workflow compliance, not code checks)                                                    |
| **XII**  | Git workflow                   | WIP commits, mega commits, force-push (Placeholder in v1)                                 |

**MVP (v1) Coverage**: Articles II, III, IV, VI, IX are fully automated. Others are placeholders for future versions.

---

## Command Reference

### Full Codebase Audit (Default)

```bash
/speckit.code_check
# or explicitly:
/speckit.code_check full
```

**What it does:**

- Scans all files in `src/` directory
- Validates against all 12 constitutional articles
- Generates timestamped JSON report
- Displays colorized terminal summary
- **Runtime**: ~45-60 seconds for ~100 files

**Exit codes:**

- `0` = No CRITICAL violations
- `1` = One or more CRITICAL violations found (blocks CI)

---

### Incremental Audit (Changed Files Only)

```bash
/speckit.code_check incremental
```

**What it does:**

- Uses `git diff` to identify changed files since last audit
- Only audits files with uncommitted changes or new commits
- Useful during active development

**Runtime**: ~5-10 seconds

**Example output:**

```
✓ Scanning 7 changed files...
✗ Found 3 violations (2 HIGH, 1 MEDIUM)
  src/lib/new-feature.ts:42 — Article II §2.1: No `any` type
  src/lib/new-feature.ts:58 — Article II §2.7: Hardcoded hex color
  src/routes/api/endpoint/+server.ts:15 — Article IX §9.4: Missing input validation
```

---

### Directory-Specific Audit

```bash
/speckit.code_check directory src/lib/
/speckit.code_check directory src/routes/api/
```

**What it does:**

- Audits only files within specified directory
- Useful for focused refactoring work

**Runtime**: ~10-30 seconds depending on directory size

---

### Article-Specific Audit

```bash
/speckit.code_check article "Article II"
/speckit.code_check article "Article III"
```

**What it does:**

- Runs ONLY the validators for the specified article
- Scans full codebase but checks only one article's rules
- Useful for targeted compliance verification

**Runtime**: ~20-30 seconds

**Example: Verify Article III (Testing) compliance only**

```bash
/speckit.code_check article "Article III"

✓ Scanning src/ for Article III violations...
✗ Article III §3.2 violated: 12 files below 80% coverage
  src/lib/signal-processing.ts: 65% coverage
  src/lib/frequency-math.ts: 72% coverage
  ...
```

---

## Understanding the Report

### Terminal Output (Colorized)

```
🔍 Constitutional Compliance Audit — 2026-02-13 14:55:23

📊 Overall Compliance: 67% (8/12 articles passing)
⏱  Execution Time: 3.5 seconds
📁 Files Scanned: 87

🔴 CRITICAL Violations: 3
🟠 HIGH Violations: 15
🟡 MEDIUM Violations: 18
⚪ LOW Violations: 6

━━━ Article II — Code Quality Standards (72% compliant) ━━━
  🔴 CRITICAL [src/lib/services/auth.ts:12]
      Article II §2.7: Forbidden pattern — service layer
      Fix: Move logic to src/lib/auth.ts

  🟠 HIGH [src/lib/utils/legacy-parser.ts:42]
      Article II §2.1: `any` type usage
      Fix: Replace `any` with `unknown` and add type guard

━━━ Article III — Testing Standards (58% compliant) ━━━
  🟠 HIGH [src/lib/signal-processing.ts]
      Article III §3.2: Test coverage 65% (requires 80%)
      Fix: Add unit tests for uncovered functions

━━━ Trend Analysis ━━━
  📈 Improving: Articles IV, VI (from last audit)
  📉 Degrading: Articles II, III (from last audit)
  ➡️  Stable: Articles IX, XII

📄 Full report saved: .specify/audit-reports/audit-2026-02-13-145523.json
```

### JSON Report Structure

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
			"scorePercent": 72,
			"violationCount": 15,
			"trendDirection": "degrading"
		}
		// ... 11 more articles
	],
	"violations": [
		{
			"severity": "CRITICAL",
			"articleReference": "Article II §2.7",
			"ruleViolated": "No service layer pattern",
			"filePath": "src/lib/services/auth.ts",
			"lineNumber": 12,
			"violationType": "forbidden-pattern-service-layer",
			"suggestedFix": "Move logic to src/lib/auth.ts",
			"isPreExisting": false,
			"commitDate": "2026-02-10T15:30:00Z"
		}
		// ... 41 more violations
	],
	"scope": "full",
	"trendDirection": "degrading"
}
```

**Key Fields:**

- `overallCompliancePercent`: Percentage of articles with 100% compliance (strict grading)
- `trendDirection`: Compared to previous audit (`improving` | `stable` | `degrading` | `baseline`)
- `isPreExisting`: `true` if violation committed before 2026-02-13 (constitution ratification)
- `suggestedFix`: Actionable remediation guidance

---

## Interpreting Violations

### Severity Levels

| Severity     | Meaning                                                                     | Action Required                        |
| ------------ | --------------------------------------------------------------------------- | -------------------------------------- |
| **CRITICAL** | Security vulnerability, forbidden pattern, or permission violation          | **Immediate fix required** — blocks CI |
| **HIGH**     | Type safety issue, missing error handling, or significant quality violation | Fix before merge                       |
| **MEDIUM**   | Naming convention, accessibility issue, or minor quality violation          | Fix in this sprint                     |
| **LOW**      | Formatting, comment style, or cosmetic issue                                | Fix when convenient                    |

**CI Behavior:**

- `CRITICAL` violations cause `/speckit.code_check` to exit with code `1` (fails CI)
- Other severities exit with code `0` (pass CI, but violations still reported)

### Pre-existing vs. New Violations

Violations are tagged as **pre-existing** if they were committed **before 2026-02-13** (constitution ratification date).

**Strategy:**

1. **Pre-existing violations**: Address gradually via dedicated refactoring sprints
2. **New violations**: Fix immediately (introduced after constitution ratification, so developer should have known better)

**Example report filtering:**

```bash
# Show only NEW violations (introduced after constitution)
cat .specify/audit-reports/audit-*.json | jq '.violations[] | select(.isPreExisting == false)'

# Count pre-existing vs. new
cat .specify/audit-reports/audit-*.json | jq '[.violations[] | .isPreExisting] | group_by(.) | map({key: .[0], count: length})'
```

---

## Constitutional Exemptions

If a violation is **justified and unavoidable** (e.g., vendor library compatibility), you can request an exemption:

### Adding an Exemption Annotation

```typescript
// @constitutional-exemption Article-II-2.1 issue:#123 — Type assertion required for vendor library compatibility
const config = vendorLib.getConfig() as VendorConfig;
```

**Format:**

```
// @constitutional-exemption Article-{ROMAN}-{SECTION} issue:#{ISSUE_NUM} — {JUSTIFICATION}
```

**Requirements:**

1. `Article-{ROMAN}-{SECTION}`: Article reference (e.g., `Article-II-2.1`)
2. `issue:#{NUM}`: GitHub issue number documenting the exemption
3. `{JUSTIFICATION}`: Plain-language reason (min 20 characters, must be substantive)

**Example GitHub issue (#123):**

```markdown
Title: Constitutional Exemption: Type Assertion for Vendor Library

## Justification

The `vendorLib.getConfig()` method returns `unknown` due to incorrect type definitions
in the vendor package. We cannot fix their types, and the library is critical for
production functionality.

## Exemption Scope

- File: src/lib/config-loader.ts
- Line: 42
- Article: Article II §2.1 (Type Safety)

## Expiration

Review this exemption when upgrading to vendorLib v3.0 (ETA: Q3 2026).
```

**Effect:**

- Violation is detected but **excluded from compliance scoring**
- Exemption is logged in audit report for transparency
- Must be reviewed periodically (recommended: quarterly)

---

## Trend Tracking

The audit compares current results against the **most recent previous audit** to calculate trends:

### Article-Level Trends

```bash
# View trend for Article II across all audits
cat .specify/audit-reports/*.json | jq '[.articleScores[] | select(.articleId == "II") | {timestamp: .timestamp, score: .scorePercent}]'
```

**Output:**

```json
[
	{ "timestamp": "2026-02-10T10:00:00Z", "score": 80 },
	{ "timestamp": "2026-02-13T14:55:23Z", "score": 72 }
]
```

**Interpretation**: Article II degraded from 80% → 72% (7 new violations introduced)

### Overall Compliance Trends

```bash
# Plot compliance over time
cat .specify/audit-reports/*.json | jq '[{timestamp, overallCompliancePercent}]'
```

**Example trend visualization** (manual or via script):

```
2026-02-05: 75% ████████████████████████████████████████████████████████████████████████████
2026-02-08: 70% ████████████████████████████████████████████████████████████████████
2026-02-10: 72% ██████████████████████████████████████████████████████████████████████
2026-02-13: 67% ████████████████████████████████████████████████████████████████
```

**Action:** If trend is **degrading** for 3+ consecutive audits, schedule a refactoring sprint.

---

## Integration with CI/CD

### Pre-commit Hook (Recommended)

Add to `.husky/pre-commit` or `.git/hooks/pre-commit`:

```bash
#!/bin/bash
# Run incremental constitutional audit before commit

echo "Running constitutional audit on changed files..."
/speckit.code_check incremental

if [ $? -ne 0 ]; then
  echo "❌ CRITICAL constitutional violations detected. Fix before committing."
  exit 1
fi

echo "✅ Constitutional audit passed."
```

**Effect**: Blocks commits with CRITICAL violations.

### GitHub Actions (Full Audit on PR)

Add to `.github/workflows/constitution-audit.yml`:

```yaml
name: Constitutional Compliance Audit

on:
    pull_request:
        branches: [main]

jobs:
    audit:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v3
            - uses: actions/setup-node@v3
              with:
                  node-version: '20'

            - name: Install dependencies
              run: npm ci

            - name: Run constitutional audit
              run: /speckit.code_check full

            - name: Upload audit report
              if: always()
              uses: actions/upload-artifact@v3
              with:
                  name: constitution-audit-report
                  path: .specify/audit-reports/audit-*.json
```

**Effect**: Audit runs on every PR. CRITICAL violations fail the build.

---

## Troubleshooting

### "Coverage file not found" Error

**Error:**

```
CoverageNotFoundError: Coverage file not found: coverage/coverage-final.json
```

**Solution:**

```bash
# Run tests with coverage first
npm run test:coverage

# Then run audit
/speckit.code_check
```

**Why:** Article III validators require coverage data. The audit doesn't run tests automatically (performance optimization).

---

### "Audit exceeded timeout" Error

**Error:**

```
AuditTimeoutError: Audit exceeded timeout of 60000ms
```

**Solution:**

```bash
# Use incremental or directory scope instead of full
/speckit.code_check incremental
# or
/speckit.code_check directory src/lib/
```

**Why:** Full audit on very large codebases (>200 files) may exceed 60s budget. Incremental audits are much faster.

---

### "Git not available" Warning

**Warning:**

```
GitNotAvailableError: Git is not available or this is not a git repository
```

**Impact:** Violations cannot be categorized as pre-existing vs. new. All violations are treated as new.

**Solution:**

```bash
# Ensure you're in a git repository
git status

# If not, initialize git
git init
```

---

## Next Steps

1. **Run your first audit**: `/speckit.code_check`
2. **Review the report**: Check `.specify/audit-reports/audit-*.json`
3. **Fix CRITICAL violations first**: Search for `"severity": "CRITICAL"` in the report
4. **Set up pre-commit hooks**: Prevent new violations from being committed
5. **Track trends weekly**: Run audits regularly and monitor compliance percentages

**Questions?**

- See full API documentation: `specs/001-constitution-audit/contracts/audit-api.md`
- See data model: `specs/001-constitution-audit/data-model.md`
- Read the constitution: `.specify/memory/constitution.md`
