# Phase 2.2.6: Security Testing and NPM Audit Vulnerability Resolution

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: OWASP A06:2021 (Vulnerable and Outdated Components), NIST SP 800-53 SA-11 (Developer Security Testing), NIST SP 800-53 RA-5 (Vulnerability Scanning), CERT MSC17-C (Finish Every Set of Statements with a Break)
**Review Panel**: US Cyber Command Engineering Review Board

---

## Purpose

Resolve all 19 known npm audit vulnerabilities (14 high severity), establish a security regression test suite covering all Phase 2 hardening measures, and integrate property-based testing for input validation functions. This ensures that security controls are verifiable, that known vulnerabilities are remediated, and that future code changes cannot silently regress security posture.

## Execution Constraints

| Constraint    | Value                                                                                                                                                      |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Risk Level    | HIGH -- npm audit fix may introduce breaking changes; test suite validates security controls                                                               |
| Severity      | HIGH                                                                                                                                                       |
| Prerequisites | Phase 2.1 complete (authentication middleware and input sanitization library must be in place); Phase 2.2.1-2.2.5 complete (tests validate these controls) |
| Files Touched | ~12 files (package.json, package-lock.json, 8 test files, 1 CI config)                                                                                     |
| Blocks        | Production deployment (npm audit must be clean before deployment to field devices)                                                                         |
| Blocked By    | Phase 2.2.1-2.2.5 (security controls must exist before tests can validate them)                                                                            |

## Threat Context

The Argos system's dependency tree contains 19 known vulnerabilities, 14 of which are classified as high severity by the npm advisory database. In a military deployment context:

1. **Supply chain attack surface**: Every vulnerable dependency is a potential entry point. Known vulnerabilities have public exploit code.
2. **devalue prototype pollution (CRITICAL)**: The `devalue` package is SvelteKit's data serialization library -- it runs on **every single page load** where server data is passed to the client. A prototype pollution vulnerability in `devalue` means an attacker who can influence server-side data can potentially execute arbitrary code in the operator's browser.
3. **No existing security tests**: Zero security-focused test files exist in the test suite. This means security controls can be silently broken by any code change without detection.
4. **No CI gate**: No CI pipeline step checks for vulnerable dependencies. New vulnerabilities can be introduced silently.

Per OWASP A06:2021: "Vulnerable Components include software that is unsupported, out of date, or known to be vulnerable."

## Current State Assessment

**Verified 2026-02-08** against the live codebase.

```bash
# npm audit summary
npm audit 2>&1 | tail -5
# Result: 19 vulnerabilities (5 moderate, 14 high)

# Check for existing security tests
find tests/ -name "*security*" -o -name "*auth*" -o -name "*cors*" -o -name "*injection*" 2>/dev/null | wc -l
# Result: 0

# Check for existing property-based tests
grep -rn "fast-check\|fc.assert\|fc.property" tests/ --include="*.ts" | wc -l
# Result: 0
```

**Current state**:

| Metric                        | Value |
| ----------------------------- | ----- |
| npm audit vulnerabilities     | 19    |
| High severity vulnerabilities | 14    |
| Moderate vulnerabilities      | 5     |
| Security test files           | 0     |
| Property-based test files     | 0     |
| CI npm audit gate             | None  |

## Implementation Plan

### Subtask 2.2.6.1: Enumerate and Resolve npm Audit Vulnerabilities

**REGRADE FINDING (B3)**: The original plan mentioned `npm audit` as a CI check but did not enumerate or address the 19 existing vulnerabilities.

**CRITICAL**: The `devalue` package has a **prototype pollution vulnerability**. This package is the SvelteKit data serializer -- it processes all server-to-client data transfers. Every SvelteKit page load that uses `load()` functions is affected. This is the highest-priority vulnerability to resolve.

#### Resolution Procedure

```bash
# Step 1: Enumerate current vulnerabilities with full details
npm audit --json > /tmp/npm-audit-results.json
npm audit 2>&1 | tee /tmp/npm-audit-human.txt

# Step 2: Attempt non-breaking fixes first
npm audit fix
# This resolves vulnerabilities where a patched version exists within the
# current semver range. Zero behavioral changes expected.

# Step 3: Review remaining vulnerabilities
npm audit 2>&1 | tee /tmp/npm-audit-after-fix.txt

# Step 4: For remaining vulnerabilities, evaluate each:
#   - Is a major version bump required? (test thoroughly)
#   - Is this a dev-only dependency? (lower priority but still fix)
#   - Does a workaround exist? (package.json overrides)

# Step 5: For devalue specifically:
#   Check if SvelteKit has updated their pinned devalue version
npm ls devalue
#   If SvelteKit pins a vulnerable version, add an override:
#   package.json: "overrides": { "devalue": ">=4.3.3" }

# Step 6: Breaking changes (test thoroughly after each)
npm audit fix --force
# WARNING: This may bump major versions. Run full test suite after.
npm run typecheck && npm run build && npm run test:unit
```

#### Decision Matrix for Each Vulnerability

| Condition                                    | Action                                  | Risk Level |
| -------------------------------------------- | --------------------------------------- | ---------- |
| Patch available within semver range          | `npm audit fix` (automatic)             | ZERO       |
| Patch requires minor version bump            | `npm audit fix` (automatic)             | LOW        |
| Patch requires major version bump (dev dep)  | `npm audit fix --force` + test          | LOW        |
| Patch requires major version bump (prod dep) | Manual evaluation + integration test    | MEDIUM     |
| No patch available, dev-only dependency      | Accept risk, document, monitor          | LOW        |
| No patch available, prod dependency          | Override version or replace package     | HIGH       |
| `devalue` prototype pollution                | Override to patched version immediately | CRITICAL   |

**Acceptance criteria**: `npm audit --audit-level=high` exits with code 0 (zero high or critical vulnerabilities remaining).

### Subtask 2.2.6.2: CI Pipeline Integration

Add npm audit as a mandatory CI gate that blocks deployments with high or critical vulnerabilities.

**Add to CI pipeline** (`.github/workflows/ci.yml` or equivalent):

```yaml
security-audit:
    runs-on: ubuntu-latest
    steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-node@v4
          with:
              node-version: '22'
        - run: npm ci
        - run: npm audit --audit-level=high
          # Fails if any high or critical vulnerabilities exist
```

**Local pre-commit hook** (optional, for developer machines):

```bash
#!/usr/bin/env bash
# .git/hooks/pre-commit (or via husky)
npm audit --audit-level=high --json | jq '.metadata.vulnerabilities.high + .metadata.vulnerabilities.critical' | grep -q '^0$'
if [ $? -ne 0 ]; then
    echo "ERROR: npm audit found high/critical vulnerabilities. Run 'npm audit' for details."
    exit 1
fi
```

### Subtask 2.2.6.3: Create Security Regression Test Suite

**Create directory**: `tests/security/`

The following 8 test files validate every security control implemented in Phase 2.1 and Phase 2.2. Each test file is independent and can be run individually.

| #   | Test File            | Tests                                                                          | Validates            | Status           |
| --- | -------------------- | ------------------------------------------------------------------------------ | -------------------- | ---------------- |
| 1   | `auth.test.ts`       | Unauthenticated requests to protected endpoints return 401                     | Phase 2.1 Task 2.1.1 | NEW              |
| 2   | `ws-auth.test.ts`    | Unauthenticated WebSocket connections are rejected                             | Phase 2.1 Task 2.1.6 | NEW (Regrade A5) |
| 3   | `injection.test.ts`  | Shell metacharacters in parameters return 400, not 500                         | Phase 2.1 Task 2.1.2 | NEW              |
| 4   | `cors.test.ts`       | Unknown origins receive no CORS headers; known origins receive correct headers | Phase 2.2 Task 2.2.2 | NEW              |
| 5   | `headers.test.ts`    | CSP, X-Frame-Options, X-Content-Type-Options present on all responses          | Phase 2.2 Task 2.2.3 | NEW              |
| 6   | `validation.test.ts` | Invalid parameter types (string where number expected, etc.) return 400        | Phase 2.2 Task 2.2.4 | NEW              |
| 7   | `rate-limit.test.ts` | Burst requests to hardware endpoints return 429 after limit exceeded           | Phase 2.2 Task 2.2.5 | NEW              |
| 8   | `body-size.test.ts`  | Oversized request payloads (>1MB) return 413 Payload Too Large                 | Phase 2.1 Task 2.1.7 | NEW (Regrade A7) |

**Example test structure** (`tests/security/cors.test.ts`):

```typescript
import { describe, test, expect } from 'vitest';

describe('CORS Security', () => {
	test('known origin receives CORS headers', async () => {
		const response = await fetch('http://localhost:5173/api/rf/status', {
			headers: { Origin: 'http://localhost:5173' }
		});
		expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
	});

	test('unknown origin receives NO CORS headers', async () => {
		const response = await fetch('http://localhost:5173/api/rf/status', {
			headers: { Origin: 'http://evil.com' }
		});
		expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
	});

	test('no origin header receives NO CORS headers', async () => {
		const response = await fetch('http://localhost:5173/api/rf/status');
		expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
	});
});
```

**Example test structure** (`tests/security/rate-limit.test.ts`):

```typescript
import { describe, test, expect } from 'vitest';

describe('Rate Limiting', () => {
	test('hardware control endpoint returns 429 after 10 rapid requests', async () => {
		const results: number[] = [];
		for (let i = 0; i < 15; i++) {
			const response = await fetch('http://localhost:5173/api/hackrf/status', {
				headers: { 'X-API-Key': process.env.ARGOS_API_KEY || '' }
			});
			results.push(response.status);
		}
		// First 10 should be 200, remaining should be 429
		const allowed = results.filter((s) => s === 200).length;
		const blocked = results.filter((s) => s === 429).length;
		expect(allowed).toBe(10);
		expect(blocked).toBe(5);
	});
});
```

### Subtask 2.2.6.4: Property-Based Testing for Input Validators (REGRADE C6)

Property-based testing uses randomized input generation to verify that input validators correctly handle arbitrary inputs, not just hand-crafted test cases. This is critical for security validators that must reject all malicious inputs, not just the ones a developer anticipated.

**Install dependency**:

```bash
npm install -D fast-check
```

**Create file**: `tests/security/property-based.test.ts`

```typescript
import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import {
	validateNumericParam,
	validateMacAddress,
	validateInterfaceName
} from '$lib/server/security/input-sanitizer';

describe('Input validators (property-based)', () => {
	test('validateNumericParam rejects all non-numeric strings', () => {
		fc.assert(
			fc.property(
				fc.string().filter((s) => isNaN(Number(s))),
				(s) => {
					expect(() => validateNumericParam(s, 'test', 0, 100)).toThrow();
				}
			)
		);
	});

	test('validateNumericParam accepts all numbers in range', () => {
		fc.assert(
			fc.property(fc.double({ min: 0, max: 100, noNaN: true }), (n) => {
				expect(validateNumericParam(n, 'test', 0, 100)).toBe(n);
			})
		);
	});

	test('validateNumericParam rejects all numbers outside range', () => {
		fc.assert(
			fc.property(
				fc.oneof(
					fc.double({ min: -1e10, max: -0.001, noNaN: true }),
					fc.double({ min: 100.001, max: 1e10, noNaN: true })
				),
				(n) => {
					expect(() => validateNumericParam(n, 'test', 0, 100)).toThrow();
				}
			)
		);
	});

	test('validateMacAddress rejects all strings with shell metacharacters', () => {
		fc.assert(
			fc.property(
				fc.string().filter((s) => /[;&|`$(){}]/.test(s)),
				(s) => {
					expect(() => validateMacAddress(s)).toThrow();
				}
			)
		);
	});

	test('validateMacAddress accepts valid MAC address formats', () => {
		// Generate valid MAC addresses: XX:XX:XX:XX:XX:XX
		const hexByte = fc
			.integer({ min: 0, max: 255 })
			.map((n) => n.toString(16).padStart(2, '0').toUpperCase());
		fc.assert(
			fc.property(
				fc.tuple(hexByte, hexByte, hexByte, hexByte, hexByte, hexByte),
				([a, b, c, d, e, f]) => {
					const mac = `${a}:${b}:${c}:${d}:${e}:${f}`;
					expect(() => validateMacAddress(mac)).not.toThrow();
				}
			)
		);
	});

	test('validateInterfaceName rejects path traversal attempts', () => {
		fc.assert(
			fc.property(
				fc.string().filter((s) => s.includes('..') || s.includes('/')),
				(s) => {
					expect(() => validateInterfaceName(s)).toThrow();
				}
			)
		);
	});
});
```

**Why property-based testing matters for security**:

Traditional unit tests check specific inputs (e.g., `validateMacAddress("'; DROP TABLE --")`). Property-based testing generates **thousands** of random inputs per test run and verifies that invariants hold for all of them. This catches edge cases that hand-crafted tests miss:

- Unicode characters that bypass ASCII-only sanitization
- Empty strings, null bytes, and control characters
- Extremely long strings that cause regex catastrophic backtracking
- Numeric edge cases (NaN, Infinity, -0, MAX_SAFE_INTEGER+1)

### Subtask 2.2.6.5: Verification

```bash
# Run all security tests
npm run test -- tests/security/
# Expected: all tests pass (0 failures)

# Verify npm audit is clean
npm audit --audit-level=high
# Expected: exit code 0 (zero high or critical vulnerabilities)

# Verify property-based tests specifically
npm run test -- tests/security/property-based.test.ts
# Expected: all tests pass
```

## Verification Checklist

| #   | Command                                                 | Expected Result | Purpose                                     |
| --- | ------------------------------------------------------- | --------------- | ------------------------------------------- |
| 1   | `npm audit --audit-level=high`                          | Exit 0          | Zero high/critical npm vulnerabilities      |
| 2   | `npm run test -- tests/security/`                       | All pass        | Security regression tests green             |
| 3   | `npm run test -- tests/security/property-based.test.ts` | All pass        | Property-based input validation tests green |
| 4   | `find tests/security/ -name "*.test.ts" \| wc -l`       | >= 9            | All 8 security tests + 1 property-based     |
| 5   | `npm run typecheck`                                     | Exit 0          | No type regressions                         |
| 6   | `npm run build`                                         | Exit 0          | Build integrity preserved                   |

## Commit Strategy

This task produces two atomic commits:

**Commit 1** (npm audit resolution):

```
security(phase2.2.6a): resolve 19 npm audit vulnerabilities including devalue prototype pollution

Phase 2.2 Task 6a: npm Audit Resolution
- Resolved 19 vulnerabilities (14 high, 5 moderate)
- devalue prototype pollution: upgraded to patched version
- Added npm audit --audit-level=high to CI pipeline
Verified: npm audit --audit-level=high exits 0

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

**Commit 2** (security test suite):

```
security(phase2.2.6b): establish security regression test suite with property-based testing

Phase 2.2 Task 6b: Security Testing
- Created tests/security/ with 9 test files
- Tests cover: auth, ws-auth, injection, cors, headers, validation, rate-limit, body-size
- Property-based tests using fast-check for input validators
Verified: npm run test -- tests/security/ = all pass

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

## Rollback Strategy

**Commit 1 rollback** (npm audit):

```bash
git reset --soft HEAD~1
npm install  # Restore previous package-lock.json
npm audit    # Verify vulnerabilities return (confirming rollback)
```

**Commit 2 rollback** (test suite):

```bash
git reset --soft HEAD~1
# Tests are additive; rollback has zero impact on production code
```

**Warning**: Rolling back Commit 1 re-introduces 19 known vulnerabilities including the devalue prototype pollution. This should only be done if the npm audit fix introduced breaking changes that cannot be immediately resolved.

## Risk Assessment

| Risk                                                | Likelihood | Impact | Mitigation                                                            |
| --------------------------------------------------- | ---------- | ------ | --------------------------------------------------------------------- |
| `npm audit fix --force` introduces breaking changes | MEDIUM     | HIGH   | Run full test suite after each fix; rollback individual packages      |
| devalue override conflicts with SvelteKit version   | LOW        | HIGH   | Test SvelteKit data serialization thoroughly                          |
| Security tests produce false positives              | MEDIUM     | LOW    | Tests are deterministic; property-based tests use fixed seeds         |
| fast-check dependency introduces new vulnerability  | LOW        | LOW    | Dev-only dependency; not included in production builds                |
| CI gate blocks legitimate deployments               | LOW        | MEDIUM | `--audit-level=high` allows moderate vulns; manual override available |

## Standards Traceability

| Standard             | Requirement                                                  | Satisfied By                                              |
| -------------------- | ------------------------------------------------------------ | --------------------------------------------------------- |
| OWASP A06:2021       | Vulnerable and Outdated Components                           | npm audit resolution; CI gate prevents regressions        |
| NIST SP 800-53 SA-11 | Developer Security Testing and Evaluation                    | 9-file security test suite with property-based testing    |
| NIST SP 800-53 RA-5  | Vulnerability Scanning                                       | npm audit integrated into CI pipeline                     |
| NIST SP 800-53 CM-3  | Configuration Change Control                                 | Security tests prevent unauthorized behavior changes      |
| CWE-1395             | Dependency on Vulnerable Third-Party Component               | All 19 npm vulnerabilities addressed                      |
| DISA STIG V-222612   | Application must use supported and current software versions | All dependencies updated to patched versions              |
| CERT MSC17-C         | Finish Every Set of Statements                               | Property-based testing verifies complete input validation |

## Execution Tracking

| Subtask | Description                                     | Status  | Started | Completed | Verified By |
| ------- | ----------------------------------------------- | ------- | ------- | --------- | ----------- |
| 2.2.6.1 | Enumerate and resolve npm audit vulnerabilities | PENDING | --      | --        | --          |
| 2.2.6.2 | CI pipeline integration                         | PENDING | --      | --        | --          |
| 2.2.6.3 | Create security regression test suite (8 files) | PENDING | --      | --        | --          |
| 2.2.6.4 | Property-based testing with fast-check          | PENDING | --      | --        | --          |
| 2.2.6.5 | Verification (test suite + npm audit)           | PENDING | --      | --        | --          |
