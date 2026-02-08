# Phase 6.3.07: CI/CD Pipeline Repair

**Document ID**: ARGOS-AUDIT-P6.3.07
**Parent Document**: Phase-6.3-SYSTEMD-PATHS-AND-DEPLOYMENT-PIPELINE.md
**Original Task ID**: 6.3.7
**Version**: 1.0
**Date**: 2026-02-08
**Author**: Claude Opus 4.6 (Lead Audit Agent)
**Classification**: UNCLASSIFIED // FOR OFFICIAL USE ONLY
**Risk Level**: HIGH
**Review Standard**: DISA STIG, NIST SP 800-123, CIS Benchmarks

---

## 1. Objective / Problem Statement

The CI pipeline (`.github/workflows/ci.yml`) has never passed. Every run on the `main` branch has failed. Five root causes have been identified, each requiring a distinct fix:

1. **ESLint exits non-zero**: 580 problems on src/ (25 errors, 555 warnings). The CI step `npm run lint` exits with code 1 due to 25 real code errors.
2. **validate:env blocks build**: `npm run build` calls `npm run validate:env` first (line 18 of package.json). The Zod schema in `src/lib/server/validate-env.js` requires `KISMET_API_URL` as a non-optional URL. This variable is not available on GitHub Actions runners.
3. **adapter-auto cannot produce a standalone server**: `svelte.config.js` uses `@sveltejs/adapter-auto`, which auto-detects the deployment platform. On a bare GitHub Actions ubuntu-latest runner with no platform detected, it falls back to a static build. The `npm run preview` command in `argos-final.service` depends on Vite's preview server, not a standalone Node.js server.
4. **25 ESLint errors require individual code fixes**: All 25 errors are real code issues (22 unused vars, 1 undef, 1 async-promise-executor, 1 useless-escape) that cannot be resolved by config changes.
5. **release.yml has ZERO quality gates**: The release workflow builds and publishes without running lint, typecheck, or tests. A tagged release can ship broken code.

### Audit Corrections (from Section 1.1)

**ESLint Error Count Correction**: Prior audit documents stated "63 errors." Current verified count (2026-02-08):

```bash
npx eslint . --config config/eslint.config.js 2>&1 | grep "problems"
# Result (src/ only): 580 problems (25 errors, 555 warnings)
# Result (full project): 676 problems (61 errors, 615 warnings)
```

The 25 error count (src/ scope) is the CI-blocking number. The prior "63 errors" figure was stale.

**CORRECTION (Independent Audit 2026-02-08):** The original claim that "~85 of 100 errors are config-only fixable by a single config change" was **FALSE**. The ESLint flat config at `config/eslint.config.js` ALREADY includes `globals.browser`, `globals.node`, and `globals.es2022` via the `globals` npm package. There is no missing env configuration. All 25 errors are real code issues requiring individual fixes.

### Current State vs Desired State

| Metric                      | Current                             | Target                                   |
| --------------------------- | ----------------------------------- | ---------------------------------------- |
| CI pipeline status          | FAILING (never passed)              | PASSING                                  |
| ESLint errors (src/ scope)  | 25                                  | 0                                        |
| validate:env behavior in CI | Fails without KISMET_API_URL        | Passes with default                      |
| SvelteKit adapter           | adapter-auto (no standalone output) | adapter-node (standalone Node.js server) |
| release.yml quality gates   | 0                                   | 3 (lint, typecheck, test:unit)           |
| ARM architecture CI testing | None (x86_64 only)                  | Documented gap with workaround           |

---

## 2. Prerequisites

- None. This task is independent and can begin immediately (Track C).
- ESLint fix (Fix 4) should be done after all other Phase 6.3 code changes to avoid conflicts.

---

## 3. Dependencies

- **Upstream**: None (independent task on Track C)
- **Downstream**: Task 6.3.8 (Security Tooling) depends on working CI
- **Downstream**: Task 6.3.9 (Branch Protection) depends on CI passing
- **Downstream**: Task 6.3.10 (Build Automation) depends on adapter-node from Fix 3

---

## 4. Rollback Strategy

```bash
git checkout HEAD -- .github/workflows/ci.yml .github/workflows/release.yml package.json svelte.config.js src/lib/server/validate-env.js
```

Additionally, if adapter-node was installed:

```bash
npm remove @sveltejs/adapter-node
npm install --save-dev @sveltejs/adapter-auto
```

---

## 5. Current State / Inventory

### 5.1 CI Workflow Current State

File: `.github/workflows/ci.yml`

The CI workflow currently runs:

1. Checkout
2. Setup Node.js
3. npm ci
4. `npm run lint` (exits non-zero due to 25 errors)
5. `npm run format:check`
6. `npm run typecheck`
7. `npm run build` (fails due to validate:env)

Steps 4 and 7 both fail, making the entire pipeline permanently broken.

### 5.2 Release Workflow Current State

File: `.github/workflows/release.yml`

The release workflow runs:

1. Checkout
2. Setup Node.js
3. npm ci
4. npm run build
5. Package into tarball
6. Upload to GitHub Releases

**Missing**: No lint, no typecheck, no tests. If a developer tags and pushes `v1.0.0`, a broken release is published automatically.

### 5.3 ESLint Error Breakdown

| Error Rule                          | Count | Root Cause                       | Fix                              |
| ----------------------------------- | ----- | -------------------------------- | -------------------------------- |
| `@typescript-eslint/no-unused-vars` | 22    | Unused variables/imports in code | Remove or prefix with underscore |
| `no-undef`                          | 1     | Genuinely undefined variable     | Define or import it              |
| `no-async-promise-executor`         | 1     | Async function in Promise()      | Refactor to async/await          |
| `no-useless-escape`                 | 1     | Unnecessary escape character     | Remove backslash                 |

The `no-console` rule is configured as `warn` (not `error`), so the ~271 console statements generate **warnings**, not errors. They do not block CI.

### 5.4 validate-env.js Current State

File: `src/lib/server/validate-env.js`

Line 15 (approximate):

```javascript
KISMET_API_URL: z.string().url({ message: "Invalid KISMET_API_URL - must be a valid URL" }),
```

This requires `KISMET_API_URL` unconditionally. In CI, no hardware services are available.

### 5.5 SvelteKit Adapter Current State

File: `svelte.config.js`

```javascript
import adapter from '@sveltejs/adapter-auto';
```

`adapter-auto` auto-detects the deployment platform (Vercel, Netlify, Cloudflare). On a bare GitHub Actions ubuntu-latest runner, it falls back to static output. Argos deploys to a bare RPi 5 with Node.js, requiring `adapter-node`.

---

## 6. Actions / Changes

### 6.1 Fix 1: Make ESLint Non-Blocking in CI (Immediate)

Replace the combined lint/format/typecheck step in `.github/workflows/ci.yml`:

**Before:**

```yaml
- name: 'Run Linting, Formatting, and Type Checks'
  run: |
      npm run lint
      npm run format:check
      npm run typecheck
```

**After:**

```yaml
- name: 'Run Linting (non-blocking)'
  run: npm run lint || true
  continue-on-error: true

- name: 'Check Formatting'
  run: npm run format:check

- name: 'Run TypeScript Type Checks'
  run: npm run typecheck
```

**Rationale**: `format:check` and `typecheck` should be blocking. Lint errors are being tracked in Phase 3.3 and will be resolved incrementally. Once Phase 3.3 is complete, remove the `|| true` and `continue-on-error`.

### 6.2 Fix 2: Make validate:env CI-Aware

**Option A (recommended):** Make `KISMET_API_URL` optional with a default in `src/lib/server/validate-env.js`.

Change line 15 from:

```javascript
KISMET_API_URL: z.string().url({ message: "Invalid KISMET_API_URL - must be a valid URL" }),
```

To:

```javascript
KISMET_API_URL: z.string().url({ message: "Invalid KISMET_API_URL - must be a valid URL" }).default('http://localhost:2501'),
```

This preserves validation (must be a URL if set) while providing a safe default when the variable is absent.

**Option B (if Option A is rejected):** Set the variable in CI:

```yaml
- name: 'Verify Production Build'
  run: npm run build
  env:
      KISMET_API_URL: http://localhost:2501
      DATABASE_PATH: ./rf_signals.db
```

Option A is preferred because it also fixes local development for new developers who clone the repo without a `.env` file.

### 6.3 Fix 3: Switch to adapter-node

**Step 1**: Install adapter-node:

```bash
npm install --save-dev @sveltejs/adapter-node
```

**Step 2**: Remove adapter-auto:

```bash
npm remove @sveltejs/adapter-auto
```

**Step 3**: Update `svelte.config.js`:

Before:

```javascript
import adapter from '@sveltejs/adapter-auto';
```

After:

```javascript
import adapter from '@sveltejs/adapter-node';
```

**Step 4**: Update `argos-final.service` template to use standalone server instead of Vite preview:

Before:

```ini
ExecStart=/usr/bin/npm run preview
```

After:

```ini
ExecStart=/usr/bin/node @@ARGOS_DIR@@/build
```

**Step 5**: Update `release.yml` to package the `build/` directory which now contains a runnable server.

### 6.4 Fix 4: Fix All 25 ESLint Errors

The 25 ESLint errors must be fixed individually. They cannot be resolved by config changes.

**Category A: `@typescript-eslint/no-unused-vars` (22 errors)**

Detection:

```bash
npx eslint src/ --config config/eslint.config.js -f json 2>/dev/null | \
  python3 -c "
import json, sys
data = json.load(sys.stdin)
for f in data:
    for m in f.get('messages', []):
        if m.get('severity') == 2 and m.get('ruleId') == '@typescript-eslint/no-unused-vars':
            print(f\"{f['filePath']}:{m['line']}:{m['column']} - {m['message']}\")
"
```

Fix: For each hit, either:

1. Remove the unused import/variable line entirely, OR
2. Prefix with underscore (`_unusedVar`) if it is a required function parameter (e.g., `(_req, res) => ...`)

**Category B: `no-undef` (1 error)**

A variable is referenced that is not defined in scope. This is a genuine bug or missing import.

Detection:

```bash
npx eslint src/ --config config/eslint.config.js -f json 2>/dev/null | \
  python3 -c "
import json, sys
data = json.load(sys.stdin)
for f in data:
    for m in f.get('messages', []):
        if m.get('severity') == 2 and m.get('ruleId') == 'no-undef':
            print(f\"{f['filePath']}:{m['line']}:{m['column']} - {m['message']}\")
"
```

Fix: Add the missing import or declare the variable.

**Category C: `no-async-promise-executor` (1 error)**

An async function is used as the executor of `new Promise()`. This is an anti-pattern because errors thrown inside an async executor are silently swallowed.

Fix: Refactor from `new Promise(async (resolve, reject) => { ... })` to a plain `async function` that directly returns or throws.

**Category D: `no-useless-escape` (1 error)**

An unnecessary backslash escape in a string or regex.

Fix: Remove the backslash.

**Effort**: 1-2 hours for all 25 errors. Each fix is mechanical but must be verified to not break functionality.

### 6.5 Fix 5: Add Quality Gates to release.yml

Add quality gate steps BEFORE the build step in `.github/workflows/release.yml`:

```yaml
# === Quality Gates (must pass before build) ===
- name: 'Quality Gate: Lint'
  run: npm run lint

- name: 'Quality Gate: TypeScript Type Check'
  run: npm run typecheck

- name: 'Quality Gate: Unit Tests'
  run: npm run test:unit
```

These three steps must be inserted between the `npm ci` step and the `npm run build` step. If any gate fails, the release is not published.

**Updated release.yml** (showing only the jobs section):

```yaml
jobs:
    build-and-release:
        name: 'Build and Package Application'
        runs-on: ubuntu-latest

        steps:
            - name: 'Checkout Code'
              uses: actions/checkout@v4

            - name: 'Setup Node.js v20'
              uses: actions/setup-node@v4
              with:
                  node-version: '20.x'
                  cache: 'npm'

            - name: 'Install All Dependencies for Build'
              run: npm ci

            # === Quality Gates (must pass before build) ===
            - name: 'Quality Gate: Lint'
              run: npm run lint

            - name: 'Quality Gate: TypeScript Type Check'
              run: npm run typecheck

            - name: 'Quality Gate: Unit Tests'
              run: npm run test:unit

            # === Build and Package ===
            - name: 'Build Application for Production'
              run: npm run build

            - name: 'Assemble Clean Production Package'
              run: |
                  mkdir release
                  cp -r build/ release/
                  cp package.json release/
                  cp package-lock.json release/
                  cp -r deployment/templates/ release/deployment/templates/
                  cp deployment/generate-services.sh release/deployment/
                  cd release
                  npm ci --omit=dev
                  cd ..

            - name: 'Create Compressed Release Tarball'
              run: tar -czvf argos-final-${{ github.ref_name }}.tar.gz release

            - name: 'Create GitHub Release and Upload Artifact'
              uses: softprops/action-gh-release@v1
              with:
                  files: argos-final-${{ github.ref_name }}.tar.gz
              env:
                  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### 6.6 ARM Architecture Testing: Documented Gap

**Current state**: Both `ci.yml` and `release.yml` use `runs-on: ubuntu-latest` (x86_64). The deployment target is RPi 5 (aarch64/ARM Cortex-A76).

**What this means in practice:**

- `better-sqlite3` compiles native C++ addons via node-gyp. The x86_64 `.node` binary produced in CI will NOT run on aarch64.
- The release tarball contains x86_64 native modules that crash on the RPi 5 with `Error: ... invalid ELF header`.
- Any architecture-specific behavior (memory layout, endianness edge cases) is untested.

**Why the current release.yml tarball is broken on RPi 5:**
The `npm ci --omit=dev` step inside the release workflow compiles `better-sqlite3` for x86_64. When this tarball is deployed to the RPi 5, Node.js cannot load the native module.

**Remediation options (future work, not in this phase):**

1. **QEMU emulation** (recommended first step):

    ```yaml
    - uses: docker/setup-qemu-action@v3
      with:
          platforms: arm64
    - uses: docker/setup-buildx-action@v3
    # Then run build in an arm64 container
    ```

2. **Self-hosted ARM runner** (recommended long-term): Register the RPi 5 itself (or a spare RPi) as a GitHub Actions self-hosted runner. This provides native ARM compilation and accurate testing.

3. **Cross-compilation workaround** (interim): Skip native module compilation in CI; require `npm ci` on the RPi 5 after tarball extraction. This is what `deploy-to-pi.sh` already does (`npm ci --omit=dev` runs on the Pi).

**For this phase**: Document the gap. The deployment script (`deploy-to-pi.sh` from Task 6.3.10) runs `npm ci` on the Pi, which correctly compiles native modules for aarch64. The release tarball should include `package.json` and `package-lock.json` but NOT `node_modules/`, allowing the Pi to compile its own native modules.

---

## 7. Verification Commands

```bash
# Fix 1: ESLint non-blocking in CI
grep 'continue-on-error' .github/workflows/ci.yml
# Expected: found (at least 1 match)

# Fix 2: validate:env has default
grep 'default.*localhost:2501' src/lib/server/validate-env.js
# Expected: found

# Fix 3: adapter-node
grep 'adapter-node' package.json
# Expected: "@sveltejs/adapter-node" in devDependencies

grep 'adapter-auto' package.json
# Expected: no output (removed)

grep 'adapter-node' svelte.config.js
# Expected: import adapter from '@sveltejs/adapter-node';

# Fix 3: Build produces standalone server
npm run build && test -f build/index.js && echo "PASS" || echo "FAIL"
# Expected: PASS

# Fix 2: validate:env succeeds without KISMET_API_URL
(unset KISMET_API_URL && node src/lib/server/validate-env.js)
# Expected: exit 0 (uses default)

# Fix 4: ESLint errors resolved
npx eslint src/ --config config/eslint.config.js 2>&1 | grep "problems"
# Expected: "X problems (0 errors, Y warnings)" -- zero errors

# Fix 5: release.yml quality gates
grep -c 'Quality Gate' .github/workflows/release.yml
# Expected: 3

grep 'npm run lint' .github/workflows/release.yml
# Expected: found

grep 'npm run typecheck' .github/workflows/release.yml
# Expected: found

grep 'npm run test:unit' .github/workflows/release.yml
# Expected: found
```

---

## 8. Acceptance Criteria

From parent Section 13 verification checklist:

| #   | Check                                       | Command                                                                    | Expected  |
| --- | ------------------------------------------- | -------------------------------------------------------------------------- | --------- |
| 11  | ESLint non-blocking in CI                   | `grep 'continue-on-error' .github/workflows/ci.yml`                        | Found     |
| 12  | validate:env has default for KISMET_API_URL | `grep 'default.*localhost:2501' src/lib/server/validate-env.js`            | Found     |
| 13  | adapter-node installed                      | `grep 'adapter-node' package.json`                                         | Found     |
| 14  | adapter-auto removed                        | `grep 'adapter-auto' package.json`                                         | No output |
| 15  | Build produces index.js                     | `test -f build/index.js`                                                   | Exit 0    |
| 25  | Typecheck passes                            | `npm run typecheck`                                                        | Exit 0    |
| 30  | release.yml has quality gates               | `grep -c 'Quality Gate' .github/workflows/release.yml`                     | 3         |
| 31  | ESLint errors = 0 (src/ scope)              | `npx eslint src/ --config config/eslint.config.js 2>&1 \| grep '0 errors'` | Found     |

### Additional Pass/Fail Criteria

1. CI workflow splits lint (non-blocking), format:check (blocking), and typecheck (blocking) into separate steps.
2. `KISMET_API_URL` has a default value of `http://localhost:2501` in the Zod schema.
3. `@sveltejs/adapter-node` is in `devDependencies`; `@sveltejs/adapter-auto` is not.
4. `svelte.config.js` imports from `@sveltejs/adapter-node`.
5. `npm run build` produces `build/index.js` (standalone Node.js server).
6. All 25 ESLint errors are resolved (0 errors in src/ scope).
7. `release.yml` has 3 quality gate steps (lint, typecheck, test:unit) before the build step.
8. ARM architecture gap is documented but not resolved (deferred to future phase).

---

## 9. Traceability

| Finding                                               | Task                                            | Status  |
| ----------------------------------------------------- | ----------------------------------------------- | ------- |
| CI will fail: 25 ESLint errors cause exit code 1      | 6.3.7 Fix 1 (non-blocking) + Fix 4 (fix errors) | PLANNED |
| validate:env requires KISMET_API_URL                  | 6.3.7 Fix 2                                     | PLANNED |
| adapter-auto cannot produce standalone server         | 6.3.7 Fix 3                                     | PLANNED |
| argos-final.service runs npm preview (not production) | 6.3.7 Fix 3 (Step 4)                            | PLANNED |
| release.yml has ZERO quality gates                    | 6.3.7 Fix 5                                     | PLANNED |
| 25 ESLint errors require individual code fixes        | 6.3.7 Fix 4 (per-category breakdown)            | PLANNED |
| ARM arch mismatch (x86_64 CI vs aarch64 target)       | 6.3.7 Section 6.6 (documented gap)              | PLANNED |

### Risk Assessment

| Risk                                                     | Likelihood | Impact | Mitigation                                                                                          |
| -------------------------------------------------------- | ---------- | ------ | --------------------------------------------------------------------------------------------------- |
| adapter-node build fails due to native dependencies      | Medium     | High   | Test `npm run build` locally on RPi 5 before merging; better-sqlite3 requires matching architecture |
| ESLint `continue-on-error` permanently masks regressions | Medium     | Medium | Phase 3.3 tracks error count to zero; remove flag when complete                                     |
| validate:env default bypasses legitimate missing config  | Low        | Low    | Only KISMET_API_URL gets a default; other env vars remain required when used                        |
| ESLint error fixes break runtime functionality           | Low        | Medium | Each fix verified individually; `npm run typecheck` confirms type safety                            |

---

## 10. Execution Order Notes

This task runs on **Track C** (CI/CD pipeline -- independent of Tracks A and B).

**Position in execution chain:**

- After: None (can begin immediately)
- Before: Tasks 6.3.8, 6.3.9, 6.3.10 (all depend on working CI or adapter-node)

**Recommended execution within this task:**

1. Fix 1 (ESLint non-blocking) -- unblocks CI immediately.
2. Fix 2 (validate:env default) -- unblocks build step.
3. Fix 3 (adapter-node) -- enables standalone production server.
4. Fix 5 (release.yml quality gates) -- prevents broken releases.
5. Fix 4 (ESLint errors) -- do LAST to avoid conflicts with other code changes in Phase 6.3. After all other tasks modify source files, fix remaining ESLint errors as a final cleanup pass.

**Critical path**: 6.3.7 (CI repair) -> 6.3.8 (security tooling) -> 6.3.9 (branch protection)

---

END OF DOCUMENT
