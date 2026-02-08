# Phase 5.6.7: Security Enforcement Rollout

| Attribute            | Value                                                                |
| -------------------- | -------------------------------------------------------------------- |
| **Document ID**      | ARGOS-AUDIT-P5.6.7                                                   |
| **Phase**            | 5.6 -- ESLint Enforcement Gates                                      |
| **Risk Level**       | MEDIUM                                                               |
| **Prerequisites**    | Tasks 5.6.1-5.6.4 COMPLETE; npm install available                    |
| **Estimated Effort** | 30 minutes                                                           |
| **Standards**        | MISRA C:2023 Rule 1.1, OWASP Secure Coding Practices, CERT C MSC41-C |
| **Classification**   | UNCLASSIFIED // FOR OFFICIAL USE ONLY                                |
| **Author**           | Claude Opus 4.6 (Lead Audit Agent)                                   |
| **Date**             | 2026-02-08                                                           |
| **Origin**           | REGRADE ADDITION -- Phase 5 Final Audit Report deficiency 1          |

---

## 1. Objective

Extend the ESLint enforcement gates beyond size rules to include security-focused static analysis via `eslint-plugin-security`, and escalate existing TypeScript type safety rules. This addresses the Phase 5 Final Audit Report finding that enforcement gates should cover security patterns, not just size.

This sub-task also defines a THREE-PHASE ROLLOUT STRATEGY (A/B/C) to prevent the enforcement gates from blocking all development if violations exist in legacy code.

> **REGRADE CORRECTION (2026-02-08)**: Per Phase 5 Final Audit Report, the enforcement
> gates should include security rules, not just size rules. This section adds
> `eslint-plugin-security` and escalates existing type safety rules.

---

## 2. Install eslint-plugin-security

```bash
npm install --save-dev eslint-plugin-security
```

### Verification

```bash
# Verify installation
npm ls eslint-plugin-security
# EXPECTED: eslint-plugin-security@<version>

# Verify peer compatibility with ESLint 9.x
npx eslint --version
# EXPECTED: v9.30.1 (compatible with eslint-plugin-security)
```

---

## 3. ESLint Security Rules Configuration

Add to `config/eslint.config.js`:

```javascript
import security from 'eslint-plugin-security';

// In the rules array:
{
    plugins: { security },
    rules: {
        // CRITICAL: Detect child_process usage without validation
        'security/detect-child-process': 'error',
        // CRITICAL: Detect non-literal fs filenames (path traversal risk)
        'security/detect-non-literal-fs-filename': 'warn',
        // HIGH: Detect eval-like patterns
        'security/detect-eval-with-expression': 'error',
        // HIGH: Detect non-literal require (code injection risk)
        'security/detect-non-literal-require': 'error',
        // MEDIUM: Detect potential RegExp DoS
        'security/detect-unsafe-regex': 'warn',
        // Detect SQL injection patterns
        'security/detect-sql-injection': 'warn',
    }
}
```

### Rule Severity Rationale

| Rule                                      | Severity | Rationale                                                             |
| ----------------------------------------- | -------- | --------------------------------------------------------------------- |
| `security/detect-child-process`           | error    | Shell injection is the #1 attack vector in this codebase              |
| `security/detect-non-literal-fs-filename` | warn     | Path traversal risk; warn because some legitimate dynamic paths exist |
| `security/detect-eval-with-expression`    | error    | eval() is never acceptable in production code                         |
| `security/detect-non-literal-require`     | error    | Dynamic require enables code injection                                |
| `security/detect-unsafe-regex`            | warn     | ReDoS is a availability concern; warn to surface without blocking     |
| `security/detect-sql-injection`           | warn     | SQLite with prepared statements mitigates; warn to catch regressions  |

---

## 4. Type Safety Escalations

```javascript
// Escalate existing rules:
'@typescript-eslint/no-explicit-any': 'error',  // was 'warn'
// Enable floating promise detection (catches unhandled async errors):
'@typescript-eslint/no-floating-promises': 'error',  // requires parserOptions.project
```

### Escalation Rationale

| Rule                                      | From   | To      | Rationale                                                          |
| ----------------------------------------- | ------ | ------- | ------------------------------------------------------------------ |
| `@typescript-eslint/no-explicit-any`      | `warn` | `error` | Phase 4 eliminates all `any` types; escalation prevents regression |
| `@typescript-eslint/no-floating-promises` | N/A    | `error` | Unhandled promise rejections crash Node.js silently                |

### no-floating-promises Prerequisites

The `no-floating-promises` rule requires `parserOptions.project` to be set for type-checked linting. If not already configured:

```javascript
// In the TypeScript config object:
languageOptions: {
    parserOptions: {
        project: './tsconfig.json',
    }
}
```

**Warning**: Type-checked linting is significantly slower (~3-5x). If this is not already configured, defer `no-floating-promises` to a separate task. The security rules and `no-explicit-any` escalation can proceed independently.

---

## 5. Three-Phase Rollout Strategy

> **REGRADE CORRECTION (2026-02-08)**: Per Phase 5 Final Audit Report deficiency 1,
> the enforcement gates need a phased rollout. Enabling all rules at once would block
> all commits if any file or function is still oversized.

### Phase A: Warning Mode

**When**: Enable immediately, BEFORE Phase 5.1 begins.

```javascript
'max-lines': ['warn', { max: 300, skipBlankLines: true, skipComments: true }],
'max-lines-per-function': ['warn', { max: 60, skipBlankLines: true, skipComments: true }],
'security/detect-child-process': 'warn',
```

**Behavior**:

- Pre-commit hook runs but does NOT block commits
- Developers see warnings and violation counts
- Track violation count trend weekly

**Verification**:

```bash
# Count current violations (expected: many, this is the baseline)
npx eslint src/ --config config/eslint.config.js 2>&1 \
  | grep -cE "max-lines|max-lines-per-function|security/"
```

**Purpose**: Establishes awareness. Developers see the rules, understand what will be enforced, and can proactively address violations during normal development.

### Phase B: Partial Enforcement

**When**: After Phases 5.1-5.4 complete (all files decomposed to <300 lines).

```javascript
// Enforce ONLY on already-clean directories:
// config/eslint.config.js overrides per directory
{
    files: ['src/lib/services/sdr-common/**/*.ts'],
    rules: { 'max-lines': 'error', 'max-lines-per-function': 'error' }
}
```

**Behavior**:

- Enforce on newly created code (sdr-common, extracted modules)
- Legacy code remains warning-only
- Add `eslint-disable max-lines` to remaining oversized files

**Verification**:

```bash
# Verify enforcement on clean directories
npx eslint src/lib/services/sdr-common/ --config config/eslint.config.js 2>&1 \
  | grep -cE "max-lines"
# EXPECTED: 0 violations

# Verify legacy code is warning-only (not error)
npx eslint src/ --config config/eslint.config.js 2>&1 \
  | grep "error.*max-lines" \
  | grep -v "sdr-common" \
  | wc -l
# EXPECTED: 0 (legacy violations are warnings, not errors)
```

**Purpose**: Prevents regression in already-cleaned code while allowing ongoing decomposition work in legacy areas.

### Phase C: Full Enforcement

**When**: After Phase 5.5 complete (all functions <60 lines).

```javascript
'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
'max-lines-per-function': ['error', { max: 60, skipBlankLines: true, skipComments: true }],
'security/detect-child-process': 'error',
```

**Behavior**:

- Pre-commit hook blocks ALL oversized commits
- CI/CD gate rejects PRs with violations
- Zero tolerance from this point forward

**Verification**:

```bash
# MUST return 0 violations
npx eslint src/ --config config/eslint.config.js 2>&1 \
  | grep -cE "error.*(max-lines|max-lines-per-function)"
# EXPECTED: 0

# MUST return 0 remaining eslint-disable markers
grep -r "eslint-disable max-lines" src/ | grep -v "gsmLookupTables\|kismet/types" | wc -l
# EXPECTED: 0 (only exempted files retain the disable comment)
```

**Purpose**: Locks the codebase into permanent compliance. All decomposition work is complete; enforcement prevents regression.

---

## 6. Transition Inline Disables

During Phase B, remaining oversized files receive:

```typescript
/* eslint-disable max-lines -- Phase 5.5 will decompose this file */
```

These comments serve as tracking markers. Phase 5.5 removes them as each function is decomposed. When Phase C begins, `grep "eslint-disable max-lines" src/` MUST return ONLY the approved exemptions from Task 5.6.2 (gsmLookupTables.ts and kismet/types.ts).

### Tracking Command

```bash
# Count remaining transition disables (should decrease over time)
grep -rl "eslint-disable max-lines" src/ \
  | grep -v "gsmLookupTables\|kismet/types" \
  | wc -l
# Track this number weekly; must reach 0 before Phase C
```

---

## 7. Verification Commands

### Security Plugin Verification

```bash
# Verify security rules are loaded
npx eslint --print-config src/lib/stores/hackrf.ts 2>&1 \
  | grep "security/"
# EXPECTED: Shows security rules configured

# Run security rules scan
npx eslint src/ --config config/eslint.config.js 2>&1 \
  | grep "security/" \
  | tee /tmp/security-violations.txt

echo "Security violations: $(wc -l < /tmp/security-violations.txt)"
```

### Type Safety Verification

```bash
# Verify no-explicit-any is error level
npx eslint --print-config src/lib/stores/hackrf.ts 2>&1 \
  | grep "no-explicit-any"
# EXPECTED: Shows "error" severity
```

### Rollout Phase Verification

```bash
# Determine current rollout phase
CONFIG_SEVERITY=$(npx eslint --print-config src/lib/stores/hackrf.ts 2>&1 \
  | grep -A1 "max-lines[^-]" | grep -oE "warn|error")

echo "Current max-lines severity: $CONFIG_SEVERITY"

case "$CONFIG_SEVERITY" in
    "warn") echo "Rollout Phase: A (Warning Mode)" ;;
    "error") echo "Rollout Phase: B or C (Enforcement)" ;;
    *) echo "ERROR: max-lines rule not configured" ;;
esac
```

---

## 8. Risk Mitigations

| Risk                                                | Impact | Mitigation                                                                      |
| --------------------------------------------------- | ------ | ------------------------------------------------------------------------------- |
| eslint-plugin-security false positives              | MEDIUM | `warn` severity for uncertain patterns; `error` only for definite violations    |
| Security rules conflict with existing code patterns | MEDIUM | Phase A warning mode surfaces issues before they block commits                  |
| no-floating-promises requires type-checked linting  | MEDIUM | Deferred if parserOptions.project not configured; documented prerequisite       |
| Phase B directory overrides add config complexity   | LOW    | Overrides removed in Phase C; temporary complexity for controlled rollout       |
| Developers add eslint-disable for security rules    | HIGH   | Code review must flag security rule disables; treat as exemption per Task 5.6.2 |

---

## 9. Rollback Strategy

### Rollback eslint-plugin-security

```bash
# Remove from config (manual edit: remove security import and rules object)
# Then uninstall
npm uninstall eslint-plugin-security
```

### Rollback Type Safety Escalations

```javascript
// Revert in config/eslint.config.js:
'@typescript-eslint/no-explicit-any': 'warn',  // back to warn
// Remove no-floating-promises rule
```

### Rollback Phased Rollout

```bash
# Revert to whichever phase was last stable
git checkout HEAD~1 -- config/eslint.config.js
```

---

## 10. Standards Compliance

| Standard                      | Requirement                                | Resolution                                              |
| ----------------------------- | ------------------------------------------ | ------------------------------------------------------- |
| MISRA C:2023 Rule 1.1         | All code shall conform to coding standards | Security rules extend the coding standard               |
| OWASP Secure Coding Practices | Input validation, injection prevention     | detect-child-process, detect-eval catch injection       |
| CERT C MSC41-C                | Never hard-code sizes                      | Security rules prevent hard-coded security bypasses     |
| NASA/JPL Rule 31              | Static analysis tools shall be applied     | eslint-plugin-security is an additional static analyzer |

---

**END OF DOCUMENT**
