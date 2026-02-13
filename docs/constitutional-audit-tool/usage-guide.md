# Constitutional Audit Tool - Usage Guide

## Quick Start

Run the audit:

```bash
npx tsx scripts/run-audit.ts
```

Reports are saved to: `docs/reports/audit-YYYY-MM-DD-HH-MM-SS.{json,md}`

## Understanding the Output

### Terminal Output

```
🔍 Constitutional Compliance Audit
2/13/2026, 4:15:05 PM

📊 Overall Compliance: 42% 🆕
⏱  Execution Time: 23.86s
📁 Files Scanned: 149

🔴 CRITICAL: 54
🟠 HIGH: 581
🟡 MEDIUM: 319
⚪ LOW: 4
```

**What this means:**

- **42% compliance**: Overall score across all articles
- **🆕 (baseline)**: First audit, no comparison to previous
- **Execution time**: How long the scan took
- **Files scanned**: Number of TypeScript/Svelte files analyzed

### Violation Output

```
🔴 [src/lib/services/websocket/kismet.ts:1]
   Article II §2.7: No service layer pattern
   Fix: Move logic to appropriate feature module in src/lib/
```

**Breakdown:**

- **🔴**: Severity (CRITICAL)
- **File:line**: Location of violation
- **Article reference**: Which constitutional article was violated
- **Rule**: What rule was broken
- **Fix suggestion**: How to resolve it

## Reading the Reports

### JSON Report (Machine-Readable)

**Location**: `docs/reports/audit-YYYY-MM-DD-HH-MM-SS.json`

Use for:

- Automated processing
- CI/CD integration (future)
- Data analysis/graphing
- Programmatic queries

Example structure:

```json
{
  "id": "uuid",
  "timestamp": "2026-02-13T15:15:05.000Z",
  "overallCompliancePercent": 42,
  "totalViolations": 958,
  "criticalViolations": 54,
  "violations": [
    {
      "id": "uuid",
      "severity": "CRITICAL",
      "articleReference": "Article II §2.7",
      "filePath": "src/lib/services/websocket/kismet.ts",
      "lineNumber": 1,
      "isPreExisting": true,
      "commitDate": "2025-07-13T..."
    }
  ],
  "articleScores": [...]
}
```

### Markdown Report (Human-Readable)

**Location**: `docs/reports/audit-YYYY-MM-DD-HH-MM-SS.md`

Use for:

- Code reviews
- Documentation
- Team discussions
- Archival

Contains:

- Executive summary
- Article compliance breakdown
- Full violation listings
- Trend comparisons

## Common Use Cases

### 1. Pre-Release Quality Check

**Before a major release**, run the audit to ensure code quality:

```bash
# Run full audit
npx tsx scripts/run-audit.ts

# Review CRITICAL violations
grep "CRITICAL" docs/reports/audit-*.md | head -20

# Decide: Fix, exempt, or document
```

### 2. Tracking Technical Debt

**Run audits periodically** to track technical debt trends:

```bash
# Run monthly audit
npx tsx scripts/run-audit.ts

# Compare to previous month
# Audit automatically calculates trends
```

**Trend indicators:**

- **Improving ↗**: Compliance increased (violations fixed)
- **Degrading ↘**: Compliance decreased (new violations)
- **Stable →**: No change
- **Baseline 🆕**: First audit (no comparison)

### 3. Refactoring Prioritization

**Use audit to identify** high-impact refactoring targets:

```bash
# Run audit
npx tsx scripts/run-audit.ts

# Review Article II (Code Quality) violations
# Focus on CRITICAL severity first
# Create refactoring backlog
```

### 4. Onboarding New Developers

**Show audit results** to new team members:

- Explains project standards
- Shows current technical debt
- Clarifies forbidden patterns

### 5. Code Review Focus

**Before code review**, run audit on the branch:

```bash
# Switch to feature branch
git checkout feature/new-feature

# Run audit
npx tsx scripts/run-audit.ts

# Compare violations to main branch baseline
```

## Interpreting Article Compliance

### Article Compliance Breakdown

```
| Article | Compliance | Violations |
|---------|------------|------------|
| II      | 0%         | 887        |
| III     | 90%        | 1          |
```

**What this means:**

- **0% (Article II)**: Significant violations, needs attention
- **90% (Article III)**: Good compliance, minor issues only
- **100%**: Perfect compliance (no violations)

### Severity Levels

**CRITICAL (🔴)**:

- Security vulnerabilities
- Architectural violations (service layers)
- `eval()` usage, hardcoded secrets
- **Action required**: Fix or explicitly exempt

**HIGH (🟠)**:

- `any` types
- Missing tests
- `@ts-ignore` without justification
- **Action recommended**: Fix when refactoring

**MEDIUM (🟡)**:

- Hardcoded colors
- Style inconsistencies
- **Action optional**: Fix as time permits

**LOW (⚪)**:

- Minor style issues
- **Action optional**: Cosmetic improvements

## Exempting Violations

### When to Exempt

Exempt violations when:

- **Legacy code** not worth refactoring now
- **Third-party patterns** required by external APIs
- **Temporary workarounds** with documented justification
- **False positives** that are actually correct

### How to Exempt

Add comment above violation:

```typescript
// @constitutional-exemption: Article II §2.7 issue:#123
// Justification: Legacy WebSocket service, planned refactor in Q2 2026
function legacyWebSocketService() {
	// ...
}
```

**Format:**

- Must include article reference (e.g., `Article II §2.7`)
- Must include issue reference (e.g., `issue:#123`)
- Should include justification

**Effect:**

- Violation still appears in report
- Marked as `exemptionStatus: 'approved'`
- Does not affect compliance score
- Tracked separately for review

## Compliance Score Calculation

```
Compliance % = (Total Checks - Violations) / Total Checks × 100
```

**Example:**

- Files scanned: 149
- Checks per file: ~13 (average)
- Total checks: ~1,937
- Violations: 958
- Compliance: (1937 - 958) / 1937 = 50.5%

**Note**: Actual calculation is per-article, then averaged.

## Best Practices

### DO:

- ✅ Run audits regularly (monthly or pre-release)
- ✅ Review CRITICAL violations immediately
- ✅ Use exemptions sparingly and document why
- ✅ Track trends over time
- ✅ Fix violations in new code before committing

### DON'T:

- ❌ Ignore CRITICAL violations (security!)
- ❌ Exempt everything (defeats the purpose)
- ❌ Run audit in CI/CD yet (too slow, needs optimization)
- ❌ Try to fix all violations at once (incremental improvement)

## Troubleshooting

### Audit Takes Too Long (>60 seconds)

**Possible causes:**

- Large codebase (>500 files)
- Slow disk I/O
- Git blame operations on large repositories

**Solutions:**

- Increase timeout: Edit `scripts/run-audit.ts`, change `timeoutMs`
- Skip git categorization: Edit validators to skip `categorizeViolationByTimestamp`

### False Positives

**If audit detects violations incorrectly:**

1. Check if pattern is actually forbidden
2. Add exemption with justification
3. Report bug if detector is wrong

### Report Not Generated

**Check:**

- `docs/reports/` directory exists (auto-created)
- Disk space available
- File permissions

### Audit Crashes

**Common causes:**

- Invalid constitution.md syntax
- Memory exhaustion (very large codebases)
- Missing dependencies

**Debug:**

```bash
# Run with verbose output
npx tsx scripts/run-audit.ts 2>&1 | tee audit.log
```

## Advanced Usage

### Running Specific Article Validators

**Not currently supported**, but can be added by modifying `scripts/run-audit.ts`:

```typescript
// Only validate Article II and III
const violations = [
	...(await validateArticleII(projectRoot)),
	...(await validateArticleIII(projectRoot))
];
```

### Custom Report Output Location

```typescript
// Edit scripts/run-audit.ts
const report = await runAudit({
	scope: 'full',
	reportOutputDir: '/custom/path/' // Custom location
	// ...
});
```

### Filtering Violations

**Not built-in**, but can parse JSON report:

```bash
# Extract only CRITICAL violations
jq '.violations[] | select(.severity == "CRITICAL")' docs/reports/audit-*.json
```

## Integration Ideas (Future)

### Pre-commit Hook (Local)

```bash
# .git/hooks/pre-commit
npx tsx scripts/run-audit.ts --fast --critical-only
```

### CI/CD Check (GitHub Actions)

```yaml
- name: Constitutional Audit
  run: npx tsx scripts/run-audit.ts
  continue-on-error: true # Don't block builds yet
```

### VS Code Extension

- Real-time violation highlighting
- Quick-fix suggestions
- Exemption annotation generator

## Support

For questions or issues:

- Check `docs/constitutional-audit-tool/how-it-works.md` for technical details
- Review `docs/constitutional-audit-tool/README.md` for overview
- File issue on GitHub if tool has bugs
