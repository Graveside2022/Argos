# Phase 2.2.14: AST-Based Validation Enforcement (ESLint Security Rules)

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: CERT Secure Coding (ERR33-C, STR02-C), OWASP A03:2021 (Injection), Verification Quality Improvement
**Review Panel**: US Cyber Command Engineering Review Board
**Origin**: NEW from regrade C5

---

## Purpose

Add custom ESLint rules to `config/eslint.config.js` that enforce security patterns at the AST (Abstract Syntax Tree) level. Grep-based verification is insufficient for security claims because it cannot reliably detect multi-line template literals, nested function calls, or context-dependent patterns. AST analysis operates on the parsed syntax tree and catches patterns that grep misses. This task creates three security-focused ESLint rules that prevent introduction of new injection vectors, unguarded JSON parsing, and debug logging in production routes.

## Execution Constraints

| Constraint    | Value                                                                                          |
| ------------- | ---------------------------------------------------------------------------------------------- |
| Risk Level    | LOW -- ESLint rules do not modify application code; they only flag violations                  |
| Severity      | LOW (verification quality improvement, not a direct vulnerability fix)                         |
| Prerequisites | Phase 2.1 complete (authentication middleware and input sanitization library must be in place) |
| Files Touched | 1 (`config/eslint.config.js`)                                                                  |
| Blocks        | Nothing (rules enforce patterns established by other Phase 2 tasks)                            |
| Blocked By    | Phase 2.2.1 (swallowed errors), Phase 2.2.4 (JSON.parse), Phase 2.1.2 (injection fixes)        |

## Threat Context

The independent security audit of the Argos codebase identified multiple categories of security-critical code patterns:

1. **Command injection via template literals** -- 3 CRITICAL and 4 HIGH command injection vectors were found where user-controlled input is interpolated into shell commands via template literals. Phase 2.1 Task 2.1.2 fixes these specific instances, but without AST enforcement, new developers (or AI agents generating code) can reintroduce the same patterns.

2. **Unguarded JSON.parse** -- 49 instances of `JSON.parse()` were found, 18 without try-catch wrapping. Phase 2.2.4 wraps all existing instances, but new `JSON.parse()` calls can be introduced without protection.

3. **Console.log in production routes** -- 753 console statements exist across 172 files. While `no-console` is currently set to `warn`, security-sensitive routes (API endpoints) should enforce `error` level to prevent debug logging that may leak sensitive information in production.

Grep-based verification fails for these patterns because:

- Template literals can span multiple lines, defeating single-line grep
- `JSON.parse` inside a function that is inside a try-catch is not caught by grep scanning for adjacent lines
- `no-console` enforcement requires understanding import context (e.g., logger vs console)

AST selectors operate on the parsed JavaScript/TypeScript syntax tree and match structural patterns regardless of formatting, line breaks, or nesting depth.

## Current State Assessment

| Metric                                | Value                     | Verification Command                                             |
| ------------------------------------- | ------------------------- | ---------------------------------------------------------------- |
| ESLint config file                    | `config/eslint.config.js` | `ls config/eslint.config.js`                                     |
| Current `no-console` setting          | `warn`                    | `grep "no-console" config/eslint.config.js`                      |
| Current `no-restricted-syntax` rules  | **0 security rules**      | `grep "no-restricted-syntax" config/eslint.config.js \| wc -l`   |
| Template literals in exec/spawn calls | Fixed by Phase 2.1.2      | Post-Phase 2.1.2 count should be 0                               |
| Unguarded JSON.parse calls            | Fixed by Phase 2.2.4      | Post-Phase 2.2.4 count should be 0                               |
| Console statements in API routes      | **225** in api/ .ts       | `grep -rn "console\." src/routes/api/ --include="*.ts" \| wc -l` |
| ESLint config format                  | Flat config (ESM)         | ESLint 9.x flat config format                                    |

### Current ESLint `no-console` Rule (line 77)

```javascript
'no-console': ['warn', { allow: ['warn', 'error'] }]
```

This warns but does not error on `console.log` and `console.info`. For security-sensitive API routes, this must be escalated to `error` level after the Phase 3 Logger migration is complete.

## Implementation Plan

### Subtask 2.2.14.1: Custom ESLint Security Rules

**File**: `config/eslint.config.js`

Add the following rules to the existing ESLint configuration. These rules use ESLint's `no-restricted-syntax` with AST selectors to enforce security patterns.

#### Rule 1: Prevent Template Literals in Shell Execution Functions

This rule prevents template literal interpolation in `hostExec()`, `exec()`, `execSync()`, `execAsync()`, and similar shell-executing functions. Template literals in shell commands are the primary injection vector identified in the security audit.

**AST Selector**:

```javascript
{
    selector: 'CallExpression[callee.name=/^(hostExec|exec|execSync|execAsync|execFile)$/] > TemplateLiteral',
    message: 'SECURITY: Do not use template literals in shell commands (injection risk). Use execFile() with array arguments, or validate all interpolated values through the input sanitization library. Reference: Phase 2.1 Task 2.1.2, CERT STR02-C.'
}
```

**What this catches**:

```typescript
// FLAGGED by rule -- template literal in hostExec()
await hostExec(`sudo python3 /tmp/cell_query.py ${lat} ${lon}`);

// FLAGGED by rule -- template literal in exec()
exec(`hackrf_sweep -f ${startFreq}:${endFreq}`);

// FLAGGED by rule -- multi-line template literal
await hostExec(`
    sudo grgsm_livemon
    -f ${frequency}
    --args=rtl=${deviceIndex}
`);
```

**What this does NOT catch** (acceptable patterns):

```typescript
// NOT FLAGGED -- static string (no interpolation risk)
await hostExec('sudo pkill -f GsmEvil');

// NOT FLAGGED -- execFile with array args (safe by design)
execFile('hackrf_sweep', ['-f', `${startFreq}:${endFreq}`]);

// NOT FLAGGED -- validated input through sanitization library
const safeFreq = validateNumericParam(freq, 'frequency', 70e6, 6e9);
await hostExec(`hackrf_sweep -f ${safeFreq}:${safeFreq + 1e6}`);
// NOTE: This is still flagged. The developer must use execFile() or
// add an eslint-disable comment with justification.
```

#### Rule 2: Flag JSON.parse Without try-catch Wrapper

This rule flags `JSON.parse()` calls that are not inside a `TryStatement` (try-catch block). This is an approximation -- AST selectors cannot perfectly detect all ancestor contexts -- but it catches the most common pattern of unprotected JSON parsing.

**AST Selector**:

```javascript
{
    selector: 'CallExpression[callee.object.name="JSON"][callee.property.name="parse"]',
    message: 'SECURITY: JSON.parse() should be wrapped in try-catch or use safeJsonParse(). Malformed input causes unhandled exceptions. Reference: Phase 2.2 Task 2.2.4, CERT ERR33-C.'
}
```

**NOTE**: This selector flags ALL `JSON.parse()` calls, including those already wrapped in try-catch. This is intentional -- it serves as a speed bump that forces the developer to either:

1. Use `safeJsonParse()` (preferred -- no lint error)
2. Add an `// eslint-disable-next-line no-restricted-syntax` comment with justification (acceptable if inside try-catch)

The `safeJsonParse()` function (created in Phase 2.2.4) is not flagged because it does not call `JSON.parse` directly at the call site.

**What this catches**:

```typescript
// FLAGGED -- bare JSON.parse without safety
const data = JSON.parse(rawInput);

// FLAGGED -- JSON.parse in expression (even if try-catch is ancestor)
try {
	const data = JSON.parse(rawInput); // Still flagged -- add disable comment
} catch {
	/* ... */
}
```

**What this does NOT catch** (preferred pattern):

```typescript
// NOT FLAGGED -- uses safeJsonParse (Phase 2.2.4)
const result = safeJsonParse(rawInput, mySchema, 'gps-position');
```

#### Rule 3: Enforce no-console in Production API Routes

Upgrade `no-console` from `warn` to `error` for API route files. This prevents debug logging in production endpoints that may leak sensitive information (request bodies, database query results, hardware state).

**Implementation approach**: Use ESLint's flat config file-specific overrides to apply `error` level only to API routes:

```javascript
// In config/eslint.config.js, add a file-specific override:
{
    files: ['src/routes/api/**/*.ts'],
    rules: {
        'no-console': ['error', { allow: ['warn', 'error'] }]
    }
}
```

This allows `console.warn()` and `console.error()` (which are appropriate for production logging) but errors on `console.log()`, `console.info()`, `console.debug()`, and `console.trace()`.

**NOTE**: This rule should be enabled AFTER Phase 3 (Logger service migration). Until Phase 3 is complete, the 225 existing console statements in API routes would cause 225 ESLint errors. The recommended deployment sequence is:

1. **Phase 2.2.14**: Add the rule as `warn` (current state -- already configured)
2. **Phase 3**: Migrate console.log to logger/emitLog in API routes
3. **Post-Phase 3**: Upgrade to `error` (no existing violations remain)

#### Complete Configuration Addition

Add the following to `config/eslint.config.js`:

**BEFORE** (current eslint.config.js security-relevant rules):

```javascript
rules: {
    'no-console': ['warn', { allow: ['warn', 'error'] }]
    // No security-specific AST rules
}
```

**AFTER** (with security AST rules):

```javascript
rules: {
    'no-console': ['warn', { allow: ['warn', 'error'] }],

    // SECURITY: AST-based injection prevention (Phase 2.2.14)
    // Reference: Codebase Audit 2026-02-07, Regrade C5
    'no-restricted-syntax': ['error',
        {
            selector: 'CallExpression[callee.name=/^(hostExec|exec|execSync|execAsync|execFile)$/] > TemplateLiteral',
            message: 'SECURITY: Do not use template literals in shell commands (injection risk). Use execFile() with array arguments, or validate all interpolated values through the input sanitization library. Reference: Phase 2.1 Task 2.1.2, CERT STR02-C.'
        },
        {
            selector: 'CallExpression[callee.object.name="JSON"][callee.property.name="parse"]',
            message: 'SECURITY: JSON.parse() should be wrapped in try-catch or use safeJsonParse(). Malformed input causes unhandled exceptions. Reference: Phase 2.2 Task 2.2.4, CERT ERR33-C.'
        }
    ]
}
```

And add a file-specific override block for API routes (for future `no-console` escalation):

```javascript
// API route-specific overrides (Phase 2.2.14)
{
    files: ['src/routes/api/**/*.ts'],
    rules: {
        // Upgrade to 'error' after Phase 3 Logger migration
        'no-console': ['warn', { allow: ['warn', 'error'] }]
    }
}
```

### Subtask 2.2.14.2: Verification

#### Test 1: ESLint runs without configuration errors

```bash
npx eslint src/routes/api/ --config config/eslint.config.js --max-warnings 999 2>&1 | tail -5
# Expected: ESLint runs successfully (may have warnings but no config errors)
```

#### Test 2: Security rules are active (template literal rule)

Create a temporary test file to verify the rule catches injection patterns:

```bash
# Create a temporary test file
cat > /tmp/eslint-security-test.ts << 'EOF'
async function testInjection(userInput: string) {
    await hostExec(`echo ${userInput}`);
}
EOF

# Run ESLint on the test file
npx eslint /tmp/eslint-security-test.ts --config config/eslint.config.js 2>&1 | grep "SECURITY"
# Expected: "SECURITY: Do not use template literals in shell commands"

# Clean up
rm -f /tmp/eslint-security-test.ts
```

#### Test 3: Security rules are active (JSON.parse rule)

```bash
cat > /tmp/eslint-json-test.ts << 'EOF'
function testParse(raw: string) {
    const data = JSON.parse(raw);
    return data;
}
EOF

npx eslint /tmp/eslint-json-test.ts --config config/eslint.config.js 2>&1 | grep "SECURITY"
# Expected: "SECURITY: JSON.parse() should be wrapped in try-catch"

rm -f /tmp/eslint-json-test.ts
```

#### Test 4: Existing codebase passes ESLint (after Phase 2.1/2.2 fixes)

```bash
# Count security-rule errors (should be 0 after all Phase 2 fixes applied)
npx eslint src/routes/api/ --config config/eslint.config.js 2>&1 | grep -c "no-restricted-syntax.*error"
# Expected: 0 (all injection and JSON.parse patterns fixed in earlier tasks)

# Note: This may show warnings (no-console at warn level) which is acceptable
# until Phase 3 migration is complete
```

#### Test 5: Verify rule definitions are in config

```bash
grep -c "no-restricted-syntax" config/eslint.config.js
# Expected: >= 1

grep -c "hostExec.*TemplateLiteral" config/eslint.config.js
# Expected: 1

grep -c "JSON.*parse" config/eslint.config.js
# Expected: >= 1
```

## Verification Checklist

1. **ESLint runs without configuration errors**

    ```bash
    npx eslint src/routes/api/ --config config/eslint.config.js --max-warnings 999 2>&1 | tail -5
    # Expected: ESLint runs successfully (no config errors)
    ```

2. **Template literal injection rule is active**

    ```bash
    cat > /tmp/eslint-security-test.ts << 'EOF'
    async function testInjection(userInput: string) {
        await hostExec(`echo ${userInput}`);
    }
    EOF
    npx eslint /tmp/eslint-security-test.ts --config config/eslint.config.js 2>&1 | grep "SECURITY"
    # Expected: "SECURITY: Do not use template literals in shell commands"
    rm -f /tmp/eslint-security-test.ts
    ```

3. **JSON.parse rule is active**

    ```bash
    cat > /tmp/eslint-json-test.ts << 'EOF'
    function testParse(raw: string) {
        const data = JSON.parse(raw);
        return data;
    }
    EOF
    npx eslint /tmp/eslint-json-test.ts --config config/eslint.config.js 2>&1 | grep "SECURITY"
    # Expected: "SECURITY: JSON.parse() should be wrapped in try-catch"
    rm -f /tmp/eslint-json-test.ts
    ```

4. **Existing codebase passes after Phase 2 fixes**

    ```bash
    npx eslint src/routes/api/ --config config/eslint.config.js 2>&1 | grep -c "no-restricted-syntax.*error"
    # Expected: 0
    ```

5. **Rule definitions present in config file**
    ```bash
    grep -c "no-restricted-syntax" config/eslint.config.js
    # Expected: >= 1
    grep -c "hostExec.*TemplateLiteral" config/eslint.config.js
    # Expected: 1
    grep -c "JSON.*parse" config/eslint.config.js
    # Expected: >= 1
    ```

## Commit Strategy

```
security(phase2.2.14): add AST-based ESLint security rules (injection + JSON.parse)

Phase 2.2 Task 14: AST Validation Enforcement (CERT STR02-C, ERR33-C)
- no-restricted-syntax: flag template literals in exec/hostExec calls
- no-restricted-syntax: flag bare JSON.parse (require safeJsonParse or try-catch)
- no-console override prepared for API routes (warn now, error post-Phase 3)
Verified: eslint runs clean on src/routes/api/, security test files flagged correctly

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

## Rollback Strategy

```bash
# Revert this single commit (only config/eslint.config.js changed)
git reset --soft HEAD~1

# Or manually: remove the no-restricted-syntax rules from config/eslint.config.js
# The application behavior is unaffected -- ESLint rules are development-time only
```

## Risk Assessment

| Risk                                          | Level  | Mitigation                                                                               |
| --------------------------------------------- | ------ | ---------------------------------------------------------------------------------------- |
| False positives from JSON.parse rule          | MEDIUM | eslint-disable with justification is acceptable for try-catch wrapped calls              |
| Template literal rule too aggressive          | LOW    | Only fires on specific function names; static strings are not flagged                    |
| Developers bypass with eslint-disable         | MEDIUM | Code review must verify eslint-disable comments include justification                    |
| no-console escalation breaks CI               | LOW    | Kept at `warn` until Phase 3 migration; escalation is post-Phase 3                       |
| AST selector does not match all call patterns | MEDIUM | Selector covers direct calls; method chains like `util.exec()` need additional selectors |
| ESLint performance degradation                | LOW    | AST selectors add negligible overhead to ESLint analysis time                            |

### Known Limitations of AST Selectors

| Pattern                                       | Detected | Notes                                                   |
| --------------------------------------------- | -------- | ------------------------------------------------------- |
| `hostExec(\`cmd ${input}\`)`                  | YES      | Direct call with template literal                       |
| `await hostExec(\`cmd ${input}\`)`            | YES      | Await expression, template literal is child             |
| `const cmd = \`cmd ${input}\`; hostExec(cmd)` | NO       | Template literal assigned to variable first             |
| `exec('sh', ['-c', \`cmd ${input}\`])`        | PARTIAL  | Template literal in array arg, not direct child of exec |
| `hostExec(buildCommand(input))`               | NO       | Injection hidden behind function call                   |

For patterns not caught by AST selectors, the code review process and Phase 2.1 input sanitization library provide additional protection layers.

## Standards Traceability

| Standard       | Control  | Requirement                                       | How This Task Satisfies It                                    |
| -------------- | -------- | ------------------------------------------------- | ------------------------------------------------------------- |
| CERT           | STR02-C  | Sanitize data passed to complex subsystems        | AST rule prevents template literals in shell commands         |
| CERT           | ERR33-C  | Detect and handle standard library errors         | AST rule flags unguarded JSON.parse                           |
| OWASP Top 10   | A03:2021 | Injection                                         | Compile-time detection of injection patterns                  |
| NIST SP 800-53 | SA-11    | Developer Security Testing                        | ESLint enforces security patterns during development          |
| NIST SP 800-53 | SA-11(1) | Static Code Analysis                              | AST-based analysis is a form of static code analysis          |
| NASA/JPL       | Rule 3   | All code must be checked by static analysis tools | ESLint with security rules satisfies this for TypeScript code |

## Execution Tracking

| Subtask  | Description                                                    | Status  | Started | Completed | Verified By |
| -------- | -------------------------------------------------------------- | ------- | ------- | --------- | ----------- |
| 2.2.14.1 | Custom ESLint rules (template literal injection + JSON.parse)  | PENDING | --      | --        | --          |
| 2.2.14.2 | Verification (eslint runs clean, test files flagged correctly) | PENDING | --      | --        | --          |
