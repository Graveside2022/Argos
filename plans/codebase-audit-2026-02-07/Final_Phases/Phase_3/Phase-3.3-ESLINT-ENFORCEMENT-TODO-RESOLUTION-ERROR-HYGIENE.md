# Phase 3.3: ESLint Enforcement, TODO Resolution, and Error Hygiene

**Risk Level**: LOW -- Configuration changes, comment resolution, naming conventions
**Prerequisites**: Phase 3.1 (Logger), Phase 3.2 (Constants)
**Estimated Files Touched**: ~85
**Blocks**: Phase 4 (Type Safety), Phase 5 (Architecture)
**Standards**: MISRA Rule 3.1 (no commented-out code), CERT ERR00-C (consistent error handling), NASA/JPL Rule 31 (no dead code), BARR-C Rule 1.7 (resolve all warnings)

---

## Current State Assessment (Verified 2026-02-07)

### ESLint Configuration

| Metric                                              | Current State                                                                                                           | Target State                          |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `no-console` rule                                   | `warn`, allows `warn` and `error`                                                                                       | `error`, allows nothing               |
| `no-magic-numbers` rule                             | NOT CONFIGURED                                                                                                          | `warn` initially, escalate to `error` |
| `prefer-template` rule                              | NOT CONFIGURED                                                                                                          | `error`                               |
| `complexity` rule                                   | NOT CONFIGURED                                                                                                          | `warn` at threshold 20                |
| `max-depth` rule                                    | NOT CONFIGURED                                                                                                          | `warn` at threshold 4                 |
| `@typescript-eslint/no-explicit-any`                | `warn`                                                                                                                  | `error` (Phase 4)                     |
| `@typescript-eslint/no-non-null-assertion`          | `warn`                                                                                                                  | `error` (Phase 4)                     |
| `@typescript-eslint/explicit-module-boundary-types` | `off`                                                                                                                   | `warn`                                |
| `project` (type-aware linting)                      | `false`                                                                                                                 | Remains `false` (performance)         |
| `eslint-disable` comments in codebase               | 18                                                                                                                      | Audit each for legitimacy             |
| lint-staged config location                         | `config/.lintstagedrc.json` (root symlink exists, cosmiconfig FINDS it -- original "broken" claim retracted 2026-02-08) | Current setup is functional           |

### TODO/FIXME Markers

| Metric                     | Value                                                  |
| -------------------------- | ------------------------------------------------------ |
| TODO comments              | 15 across 11 files (corrected 2026-02-08; was 9 files) |
| FIXME comments             | 0                                                      |
| WORKAROUND comments        | 1 (legitimate, in api/agent/stream)                    |
| HACK/KLUDGE/BROKEN/BUG/XXX | 0                                                      |

### Error Handling Hygiene

| Metric                                        | Value                                                                                    |
| --------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Total `catch(variable)` blocks in codebase    | 677                                                                                      |
| `_`-prefixed (intentionally unused)           | 197 (29.1%)                                                                              |
| Named var, actually used in body              | ~2 (0.3%)                                                                                |
| Named var, NOT used in body                   | 480 (corrected 2026-02-08; 197+480=677)                                                  |
| Parameterless `catch {}` blocks (no variable) | 35 (added 2026-02-08 -- previously omitted)                                              |
| Promise `.catch()` chain swallowing           | 68 `.catch(() => {})` instances across 23 files (added 2026-02-08 -- previously omitted) |
| Promise `.catch()` chains (total)             | 104 (added 2026-02-08 -- previously omitted)                                             |
| Commented-out code blocks (3+ lines)          | 48 blocks across 30 files, ~173 lines (corrected 2026-02-08; was 19/12/68)               |
| eslint-disable comments                       | 18                                                                                       |

---

## Execution Order

```
Task 3.3.1: Fix lint-staged Configuration (pre-commit hooks broken)
    |
    v
Task 3.3.2: Error Variable Hygiene (478 catch blocks)
    |
    v
Task 3.3.3: Commented-Out Code Removal (19 blocks)
    |
    v
Task 3.3.4: TODO/FIXME Resolution (15 markers)
    |
    v
Task 3.3.5: eslint-disable Audit (18 comments)
    |
    v
Task 3.3.6: ESLint Rule Additions (no-magic-numbers, prefer-template, complexity, max-depth)
    |
    v
Task 3.3.7: ESLint Rule Escalation (explicit-module-boundary-types to warn)
```

---

## Task 3.3.1: Verify lint-staged Configuration (CORRECTED 2026-02-08)

**CORRECTION**: The original plan stated that the pre-commit hook "silently does nothing" because cosmiconfig cannot find the lint-staged config at `config/.lintstagedrc.json`. **This claim was false.**

**Verified state**: A git-tracked symlink exists at the project root:

```
.lintstagedrc.json -> config/.lintstagedrc.json
```

cosmiconfig discovers this symlink during its root-directory search. `npx lint-staged --debug` confirms "Configuration found." The pre-commit hook is functional.

**Original claim retracted**: The pre-commit hook is NOT broken. No fix is required.

### Revised Task Scope

This task is reduced to a **verification-only step**:

1. Confirm the root symlink `.lintstagedrc.json` exists and is valid: `ls -la .lintstagedrc.json`
2. Confirm lint-staged discovers the config: `npx lint-staged --debug 2>&1 | head -20`
3. Confirm the pre-commit hook fires on staged changes:

```bash
echo "// test" >> src/lib/utils/logger.ts
git add src/lib/utils/logger.ts
git commit --dry-run 2>&1 | head -5
git checkout -- src/lib/utils/logger.ts
```

### Optional Improvement (NOT a defect fix)

If the team prefers the config inline in `package.json` for discoverability, that is a valid preference -- but it is not fixing a broken system. Document the decision either way.

### Commit

No commit required -- this is a verification step, not a code change.

---

## Task 3.3.2: Error Variable Hygiene

478 catch blocks capture a named error variable but never reference it in the body. This is the dominant pattern in the codebase (70.6% of all catch blocks).

**Standards violation**: CERT ERR00-C requires errors to be either handled or explicitly marked as intentionally ignored. The current pattern (naming the variable but not using it) is ambiguous -- a reviewer cannot tell if the developer forgot to handle the error or intentionally ignored it.

### Strategy

For each of the 478 catch blocks:

1. **If the body has a comment explaining why the error is ignored**: Rename the variable to `_error` (or `_e`, `_err` matching the existing convention). This makes the intent explicit.

2. **If the body has NO comment**: Add a one-line comment explaining why the error is safely ignored, then rename to `_error`.

3. **If the error SHOULD be logged**: Replace with `logWarn('context', { error: String(error) })` or `logError(...)`. Keep the named variable.

### Scope -- Top 14 Files (28 instances, highest concentration)

These files account for the most egregious instances and should be fixed first:

| #   | File                                                              | Catch Blocks | Action                                                                                              |
| --- | ----------------------------------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------- |
| 1   | `src/routes/tactical-map-simple/+page.svelte`                     | 10           | Most are fetch failures -- rename to `_error`, add comment "Network request failed, using fallback" |
| 2   | `src/routes/rtl-433/+page.svelte`                                 | 5            | API call failures -- rename to `_error`                                                             |
| 3   | `src/lib/server/wireshark.ts`                                     | 3            | JSON parse and process cleanup -- rename to `_error`                                                |
| 4   | `src/routes/test-hackrf-stop/+page.svelte`                        | 2            | Test page -- rename to `_error`                                                                     |
| 5   | `src/routes/test/+page.svelte`                                    | 2            | Test page -- rename to `_error`                                                                     |
| 6   | `src/routes/hackrf/+page.svelte`                                  | 1            | Rename to `_error`                                                                                  |
| 7   | `src/routes/test-simple/+page.svelte`                             | 1            | Rename to `_error`                                                                                  |
| 8   | `src/routes/gsm-evil/+page.svelte`                                | 1            | Rename to `_error`                                                                                  |
| 9   | `src/routes/tactical-map-simple/rssi-integration.ts`              | 1            | Rename to `_error`                                                                                  |
| 10  | `src/routes/tactical-map-simple/integration-example.svelte`       | 1            | Rename to `_error`                                                                                  |
| 11  | `src/lib/server/db/migrations/runMigrations.ts`                   | 1            | Should log the error -- replace with `logWarn`                                                      |
| 12  | `src/lib/services/hackrf/sweep-manager/process/ProcessManager.ts` | 1            | Process cleanup -- rename to `_error`                                                               |
| 13  | `src/lib/services/usrp/sweep-manager/process/ProcessManager.ts`   | 1            | Process cleanup -- rename to `_error`                                                               |
| 14  | `src/routes/api/kismet/start-with-adapter/+server.ts`             | 1            | Should log -- replace with `logWarn`                                                                |

### Remaining ~448 Catch Blocks (corrected from 450)

The remaining catch blocks with unused error variables are spread across ~60 files. Execute the same triage:

- If the catch body already has a descriptive comment: prefix with `_`
- If the catch body is empty or has only a generic comment: add specific comment, prefix with `_`
- If the error genuinely should be logged: add logger call

### ADDED 2026-02-08: Promise Chain `.catch(() => {})` Silent Swallowing (68 instances)

**Root Cause**: Phase 3.3.2's original scope only targeted `catch(variable)` blocks. The syntactically distinct pattern `.catch(() => {})` (promise-chain error swallowing) was invisible to the regex and was completely omitted. These 68 instances across 23 files represent **fire-and-forget error suppression** -- the most dangerous form of error swallowing because there is no variable to even inspect.

**Most dangerous instances requiring explicit handling (not just renaming)**:

| #    | File                                          | Count | Risk                                                                           | Required Action                                                              |
| ---- | --------------------------------------------- | ----- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| 1    | `src/routes/api/openwebrx/control/+server.ts` | 8     | Docker operations silently fail -- container leaks invisible to UI             | Replace with `logWarn('Docker operation failed', { error: String(_e) })`     |
| 2    | `src/lib/server/wifite/processManager.ts`     | 7     | airmon-ng cleanup failures leave WiFi adapter in monitor mode                  | Replace with `logWarn('WiFi adapter cleanup failed', { error: String(_e) })` |
| 3    | `src/routes/api/gsm-evil/control/+server.ts`  | 4     | `sudo pkill` failures leave old process running, new process fights for HackRF | Replace with `logWarn('Process cleanup failed', { error: String(_e) })`      |
| 4    | `src/lib/server/bettercap/apiClient.ts`       | 3     | Docker stop/rm swallowed -- container leak                                     | Replace with `logWarn`                                                       |
| 5    | `src/routes/api/droneid/+server.ts`           | 2     | PID file and process cleanup failures                                          | Replace with `logWarn`                                                       |
| 6-23 | (18 additional files)                         | 44    | Various cleanup operations                                                     | Triage per standard rules below                                              |

**Triage rules for `.catch(() => {})` instances**:

1. **If failure changes system state** (process still running, adapter still in monitor mode, container still alive): Replace with explicit error handling that at minimum logs at WARN level.
2. **If failure is truly inconsequential** (optional telemetry, non-critical UI update): Replace with `.catch((_e) => { /* intentional: <specific reason> */ })` to document the decision.
3. **Never leave `.catch(() => {})` as-is** -- every instance must either log or document why logging is unnecessary.

**Additional commit**:

```
refactor(error-handling): replace 68 silent .catch(() => {}) with explicit handling or documented silence
```

**Verification**:

```bash
grep -rn '\.catch\s*(\s*(\(\s*\)|\(\s*_\w*\s*\))\s*=>\s*{\s*})' src/ --include="*.ts" --include="*.svelte" | wc -l
# Target: 0
```

### ADDED 2026-02-08: Unsafe Error Cast Pattern `(error as Error).message`

Nearly every API route catch block uses:

```typescript
} catch (error) {
    return json({ success: false, error: (error as Error).message }, { status: 500 });
}
```

If the thrown value is not an Error (string, null, undefined), `(error as Error).message` returns `undefined`. The response becomes `{ success: false, error: undefined }` -- losing the error entirely.

**Correct pattern**:

```typescript
error: error instanceof Error ? error.message : String(error);
```

This fix should be applied during the batch migration of catch blocks.

### ESLint Enforcement

The existing `@typescript-eslint/no-unused-vars` rule already has `caughtErrorsIgnorePattern: '^_'`. After renaming, ESLint will enforce that:

- Named error variables (`error`, `err`, `e`) MUST be used in the catch body
- Underscore-prefixed variables (`_error`, `_err`, `_e`) are explicitly ignored

### Commit Strategy

Split into 5 commits of ~95 files each:

```
refactor(error-handling): normalize unused catch variables to _error prefix -- batch 1 (server)
refactor(error-handling): normalize unused catch variables to _error prefix -- batch 2 (API routes)
refactor(error-handling): normalize unused catch variables to _error prefix -- batch 3 (services)
refactor(error-handling): normalize unused catch variables to _error prefix -- batch 4 (stores/components)
refactor(error-handling): normalize unused catch variables to _error prefix -- batch 5 (pages)
```

### Verification

```bash
# After completion, no named error vars should be unused:
npx eslint --no-eslintrc -c config/eslint.config.js src/ 2>&1 | grep "no-unused-vars" | grep -i "catch" | wc -l
# Expected: 0
```

---

## Task 3.3.3: Commented-Out Code Removal (CORRECTED 2026-02-08)

**CORRECTION**: The original inventory identified 19 blocks across 12 files (68 lines). Adversarial re-verification found **48 blocks across 30 files (~173 lines)**. The original inventory used an overly restrictive definition of "commented-out code" that missed blocks without obvious code keywords. The corrected inventory below includes the original 19 items plus 29 additional blocks discovered during re-verification.

48 blocks of commented-out code (3+ consecutive lines) across 30 files. Per MISRA Rule 3.1 and NASA/JPL Rule 31, commented-out code is dead code and must be removed.

### Complete Inventory

| #   | File                                                         | Lines   | Size    | Description                | Action |
| --- | ------------------------------------------------------------ | ------- | ------- | -------------------------- | ------ |
| 1   | `src/lib/components/dashboard/DashboardMap.svelte`           | 28-34   | 7 lines | Old import block           | DELETE |
| 2   | `src/routes/api/bettercap/control/+server.ts`                | 17-22   | 6 lines | Commented bettercap config | DELETE |
| 3   | `src/routes/api/hackrf/data-stream/+server.ts`               | 44-47   | 4 lines | Old data handler           | DELETE |
| 4   | `src/routes/api/hackrf/data-stream/+server.ts`               | 197-200 | 4 lines | Old cleanup code           | DELETE |
| 5   | `src/routes/api/gsm-evil/intelligent-scan-stream/+server.ts` | 154-157 | 4 lines | Old stream logic           | DELETE |
| 6   | `src/routes/api/rf/data-stream/+server.ts`                   | 156-159 | 4 lines | Old RF handler             | DELETE |
| 7   | `src/lib/server/wifite/processManager.ts`                    | 296-299 | 4 lines | Dead wifite code           | DELETE |
| 8   | `src/lib/server/wifite/processManager.ts`                    | 118-120 | 3 lines | Alternate iw command       | DELETE |
| 9   | `src/lib/server/kismet/kismet_controller.ts`                 | 552-555 | 4 lines | Old controller logic       | DELETE |
| 10  | `src/lib/server/bettercap/apiClient.ts`                      | 81-83   | 3 lines | Old API client code        | DELETE |
| 11  | `src/hooks.server.ts`                                        | 157-159 | 3 lines | Error handler remnant      | DELETE |
| 12  | `src/routes/gsm-evil/+page.svelte`                           | 987-989 | 3 lines | Old GSM UI code            | DELETE |
| 13  | `src/routes/gsm-evil/+page.svelte`                           | 994-996 | 3 lines | Old GSM UI code            | DELETE |
| 14  | `src/routes/api/hackrf/start-sweep/+server.ts`               | 24-26   | 3 lines | Old sweep start            | DELETE |
| 15  | `src/routes/api/rf/start-sweep/+server.ts`                   | 31-33   | 3 lines | Duplicate of #14           | DELETE |
| 16  | `src/lib/stores/dashboard/agentContextStore.ts`              | 114-116 | 3 lines | Old store logic            | DELETE |
| 17  | `src/lib/services/websocket/test-connection.ts`              | 82-84   | 3 lines | Dead test code             | DELETE |
| 18  | `src/lib/services/localization/coral/integration-example.ts` | 8-10    | 3 lines | Dead example code          | DELETE |
| 19  | `src/lib/components/dashboard/DashboardMap.svelte`           | 354-356 | 3 lines | Old map code               | DELETE |

**Subtotal (original inventory)**: 68 lines of dead code across 12 files.

**Additional blocks discovered 2026-02-08**: ~29 additional blocks across ~18 additional files (~105 lines). These blocks were missed by the original inventory because they contained commented-out logic without obvious code keywords (e.g., commented HTML, commented CSS-in-JS, commented configuration objects). The executing agent MUST re-run the verification grep at execution time to produce the complete inventory:

```bash
# Find all blocks of 3+ consecutive // comment lines:
grep -Prn '(^\s*//.*\n){3,}' src/ --include="*.ts" --include="*.svelte" | head -100
```

Each discovered block must be triaged: if it contains executable code (imports, function calls, variable declarations, control flow), DELETE. If it is purely documentary (design notes, algorithm explanations), KEEP.

**Total (corrected)**: ~173 lines of dead code across ~30 files.

### Commit

```
refactor(cleanup): remove 48 commented-out code blocks (~173 lines) across 30 files
```

### Verification

```bash
# Heuristic check: no blocks of 3+ consecutive comment lines containing code-like patterns
# (This is a manual review step; automated detection is imprecise)
npm run typecheck  # Must pass
npm run build      # Must pass
```

---

## Task 3.3.4: TODO/FIXME Resolution

15 TODO markers across 9 files. Each must be resolved: implemented, converted to a GitHub issue, or deleted if the containing file is dead code.

### Resolution Plan

#### Implement Directly (3 items -- trivial, can be done with logger)

| #   | File                                            | Line | TODO                                     | Implementation                                                     |
| --- | ----------------------------------------------- | ---- | ---------------------------------------- | ------------------------------------------------------------------ |
| 8   | `src/routes/tactical-map-simple/+page.svelte`   | 1440 | `TODO: Add connection status logging`    | Replace with `logInfo('WebSocket connected', { url })`             |
| 9   | `src/routes/tactical-map-simple/+page.svelte`   | 1455 | `TODO: Add disconnection status logging` | Replace with `logWarn('WebSocket disconnected', { code, reason })` |
| 10  | `src/routes/api/hackrf/cycle-status/+server.ts` | 8    | `TODO: Call sweepManager.getStatus()`    | Implement the status call (sweepManager is imported)               |

#### Convert to GitHub Issue (9 items -- require design or external dependencies)

| #   | File                                          | Line    | TODO                                                | Issue Title                                                                                                 |
| --- | --------------------------------------------- | ------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 1   | `src/lib/components/kismet/MapView.svelte`    | 44      | `TODO: Implement GPS centering logic`               | "MapView: Implement GPS centering for Kismet map"                                                           |
| 2   | `src/lib/server/websockets.ts`                | 47      | `TODO: Add GNU Radio and Kismet event listeners`    | "WebSocket: Add GNU Radio and Kismet event listener integration"                                            |
| 3   | `src/lib/server/db/networkRepository.ts`      | 33      | `TODO: Implement network detection`                 | "DB: Implement network detection in networkRepository"                                                      |
| 4   | `src/lib/server/db/deviceService.ts`          | 73      | `TODO: OUI lookup`                                  | "DB: Implement OUI manufacturer lookup for device MAC addresses"                                            |
| 5   | `src/lib/server/db/cleanupService.ts`         | 178     | `TODO: Calculate actual movement`                   | "DB: Calculate actual GPS movement distance in cleanup aggregation"                                         |
| 6   | `src/routes/wigletotak/+page.svelte`          | 22      | `TODO: Implement connection status logic`           | "WigleToTAK: Implement connection status indicator"                                                         |
| 7   | `src/routes/tactical-map-simple/+page.svelte` | 478     | `TODO: Implement multi-frequency search`            | "Tactical Map: Implement multi-frequency signal search"                                                     |
| 11  | `src/lib/services/map/networkAnalyzer.ts`     | 153-154 | `TODO: Extract SSID` / `TODO: Extract manufacturer` | "NetworkAnalyzer: Extract SSID and manufacturer from signal data" (consolidates 2 TODOs, #12 duplicates #4) |
| 13  | `src/lib/services/db/dataAccessLayer.ts`      | 201     | `TODO: Calculate from signals`                      | "DAL: Calculate average power from signal readings"                                                         |

#### Delete with File (2 items -- in example/dead code files)

| #   | File                                                         | Line | TODO                             | Action                                                   |
| --- | ------------------------------------------------------------ | ---- | -------------------------------- | -------------------------------------------------------- |
| 14  | `src/lib/services/localization/coral/integration-example.ts` | 61   | `TODO: Implement heatMapService` | Delete if file deleted in Phase 0; else convert to issue |
| 15  | `src/lib/services/localization/coral/integration-example.ts` | 70   | `TODO: Implement localizer`      | Same as #14                                              |

### Post-Resolution Comment Format

For items converted to issues, update the comment:

```typescript
// See GitHub issue #NNN -- [brief description]
```

### Commit

```
fix(todos): resolve 15 TODO markers -- implement 3, file 9 issues, conditionally delete 2
```

### Verification

```bash
grep -rn "TODO\|FIXME" src/ --include="*.ts" --include="*.svelte" | grep -v node_modules | grep -v "HACKRF\|HackRF" | grep -v "issue #" | wc -l
# Target: 0 (all resolved or converted to issue references)
```

---

## Task 3.3.5: eslint-disable Audit

18 `eslint-disable` comments exist in the codebase. Each must be justified or eliminated.

### Complete Inventory and Verdict

| #   | File                                                           | Line | Rule Disabled                           | Verdict                                                                                         |
| --- | -------------------------------------------------------------- | ---- | --------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 1   | `src/lib/server/mcp/dynamic-server.ts`                         | 9    | `no-undef`                              | **LEGITIMATE** -- standalone MCP server runs outside SvelteKit, `process` may not be recognized |
| 2   | `src/lib/server/mcp/registry-integration.ts`                   | 55   | `@typescript-eslint/no-require-imports` | **LEGITIMATE** -- dynamic require for optional dependency                                       |
| 3   | `src/lib/server/mcp/registry-integration.ts`                   | 84   | `@typescript-eslint/no-require-imports` | **LEGITIMATE** -- same as #2                                                                    |
| 4   | `src/lib/server/agent/tool-execution/adapters/http-adapter.ts` | 7    | `no-undef`                              | **REVIEW** -- may be fixable with proper type declarations                                      |
| 5   | `src/lib/server/wifite/processManager.ts`                      | 28   | `no-control-regex`                      | **LEGITIMATE** -- ANSI escape sequence stripping requires control chars                         |
| 6   | `src/lib/services/websocket/base.ts`                           | 70   | `@typescript-eslint/no-explicit-any`    | **ELIMINATE** -- type the WebSocket constructor properly                                        |
| 7   | `src/lib/services/hackrf/usrp-api.ts`                          | 140  | `@typescript-eslint/no-explicit-any`    | **ELIMINATE** -- type the parsed JSON                                                           |
| 8   | `src/lib/services/tactical-map/cellTowerService.ts`            | 5    | `@typescript-eslint/no-explicit-any`    | **ELIMINATE** -- define CellTower interface                                                     |
| 9   | `src/lib/services/tactical-map/cellTowerService.ts`            | 24   | `@typescript-eslint/no-explicit-any`    | **ELIMINATE** -- same file, same fix                                                            |
| 10  | `src/lib/services/tactical-map/cellTowerService.ts`            | 26   | `@typescript-eslint/no-explicit-any`    | **ELIMINATE** -- same file, same fix                                                            |
| 11  | `src/lib/services/tactical-map/cellTowerService.ts`            | 28   | `@typescript-eslint/no-explicit-any`    | **ELIMINATE** -- same file, same fix                                                            |
| 12  | `src/routes/hackrfsweep/+page.svelte`                          | 59   | `no-unreachable`                        | **INVESTIGATE** -- unreachable code should be deleted, not suppressed                           |
| 13  | `src/routes/rtl-433/+page.svelte`                              | 8    | `@typescript-eslint/no-unused-vars`     | **ELIMINATE** -- remove unused variable `isLoading`                                             |
| 14  | `src/routes/rtl-433/+page.svelte`                              | 9    | `@typescript-eslint/no-unused-vars`     | **ELIMINATE** -- remove unused variable `hasError`                                              |
| 15  | `src/routes/rtl-433/+page.svelte`                              | 10   | `@typescript-eslint/no-unused-vars`     | **ELIMINATE** -- remove unused variable `errorMessage`                                          |
| 16  | `src/routes/rtl-433/+page.svelte`                              | 11   | `@typescript-eslint/no-explicit-any`    | **ELIMINATE** -- type `capturedSignals` properly                                                |
| 17  | `src/routes/rtl-433/+page.svelte`                              | 17   | `@typescript-eslint/no-unused-vars`     | **ELIMINATE** -- remove unused `availableProtocols`                                             |
| 18  | `src/routes/rtl-433/+page.svelte`                              | 302  | `@typescript-eslint/no-explicit-any`    | **ELIMINATE** -- type the variable                                                              |

### Summary

| Category                             | Count              |
| ------------------------------------ | ------------------ |
| LEGITIMATE (keep)                    | 4 (#1, #2, #3, #5) |
| REVIEW (may be fixable)              | 1 (#4)             |
| INVESTIGATE (suspicious)             | 1 (#12)            |
| ELIMINATE (fix the underlying issue) | 12 (#6-11, #13-18) |

### Commit

```
refactor(eslint): eliminate 12 eslint-disable comments by fixing underlying issues
```

### Verification

```bash
grep -rn "eslint-disable" src/ --include="*.ts" --include="*.svelte" | wc -l
# Target: 4-5 (only legitimate disables remain)
```

---

## Task 3.3.6: ESLint Rule Additions

After Phase 3.1 (no-console to error) and Phase 3.2 (constants centralized), add rules to prevent regression.

### New Rules to Add

**File**: `config/eslint.config.js`, Block 3 (TypeScript rules)

```javascript
// Add after existing rules:

// Prevent magic numbers (regression guard for Phase 3.2)
'no-magic-numbers': ['warn', {
    ignore: [0, 1, -1, 2, 100, 1000, 1e6],
    ignoreArrayIndexes: true,
    ignoreDefaultValues: true,
    enforceConst: true,
    detectObjects: false
}],

// Enforce template literals over string concatenation (50-54 violations found, corrected 2026-02-08)
'prefer-template': 'error',

// Enforce complexity limits (26 files with depth >= 8)
'complexity': ['warn', { max: 20 }],
'max-depth': ['warn', { max: 5 }],

// Enforce explicit return types on exported functions (66 missing)
'@typescript-eslint/explicit-module-boundary-types': ['warn', {
    allowArgumentsExplicitlyTypedAsAny: false,
    allowDirectConstAssertionInArrowFunctions: true,
    allowHigherOrderFunctions: true,
    allowTypedFunctionExpressions: true,
}],

// ADDED 2026-02-08: Prevent unreachable code (currently suppressed in hackrfsweep/+page.svelte:59)
'no-unreachable': 'error',

// ADDED 2026-02-08: Prevent constant conditions (if(true), while(1))
'no-constant-condition': 'error',

// ADDED 2026-02-08: Enforce naming conventions (9 snake_case files coexist with camelCase)
'@typescript-eslint/naming-convention': ['warn',
    // Variables and functions: camelCase
    { selector: 'variableLike', format: ['camelCase', 'UPPER_CASE', 'PascalCase'], leadingUnderscore: 'allow' },
    // Types, interfaces, classes, enums: PascalCase
    { selector: 'typeLike', format: ['PascalCase'] },
    // Enum members: UPPER_CASE or PascalCase
    { selector: 'enumMember', format: ['UPPER_CASE', 'PascalCase'] },
],
```

### Rationale for `warn` vs `error`

- `no-magic-numbers`: `warn` because Phase 3.2 may not catch every magic number. Escalate to `error` after a full warning-elimination pass.
- `complexity` and `max-depth`: `warn` because 26 files exceed depth 4. These are addressed in Phase 5 (Architecture). Setting to `error` would block builds.
- `explicit-module-boundary-types`: `warn` because 66 functions lack return types. These should be added incrementally.
- `prefer-template`: `error` because all ~52 violations (corrected 2026-02-08; was 47) are straightforward fixes.
- `no-unreachable`: `error` because unreachable code should be deleted, not suppressed. The existing `eslint-disable no-unreachable` in hackrfsweep/+page.svelte must be resolved by deleting the dead code.
- `no-constant-condition`: `error` because constant conditions indicate dead branches.
- `naming-convention`: `warn` because 9+ snake_case files coexist with camelCase. This enforces variable-level naming; file-level naming is Phase 0.2 scope.

### Fix ~52 String Concatenation Violations (corrected from 47)

Before enabling `prefer-template: error`, fix all ~52 instances:

**Server-side (11 instances)**:
| # | File | Line |
|---|------|------|
| 1 | `src/lib/server/bettercap/apiClient.ts` | 93-94 |
| 2 | `src/routes/api/hardware/details/+server.ts` | 240 |
| 3 | `src/lib/services/map/webglHeatmapRenderer.ts` | 128 |
| 4 | `src/lib/services/map/mapUtils.ts` | 197 |
| 5 | `src/lib/services/map/altitudeLayerManager.ts` | 306, 308 |
| 6 | `src/lib/services/gsm-evil/server.ts` | 120 |
| 7 | `src/lib/services/monitoring/systemHealth.ts` | 170 |
| 8 | `src/lib/services/hackrfsweep/signalService.ts` | 120, 126 |

**Client-side (36 instances)**: hackrfsweep/+page.svelte (12), rfsweep/+page.svelte (11), redesign/+page.svelte (2), kismet/+page.svelte (2), SweepControls.svelte (4), SignalAnalyzer.svelte (2), OverviewPanel.svelte (1), TopStatusBar.svelte (1), rtl-433/+page.svelte (1).

### Commit Strategy

```
refactor(style): replace 47 string concatenations with template literals
build(eslint): add no-magic-numbers, prefer-template, complexity, max-depth rules
```

---

## Task 3.3.7: WORKAROUND Comment Documentation

1 WORKAROUND comment found:

| File                                     | Line | Comment                                                           |
| ---------------------------------------- | ---- | ----------------------------------------------------------------- |
| `src/routes/api/agent/stream/+server.ts` | 37   | `// WORKAROUND: Fetch Ollama response BEFORE starting SSE stream` |

**Action**: This is a legitimate architectural workaround documenting a known constraint. Keep it, but enhance the comment to reference why it exists:

```typescript
// WORKAROUND: Fetch Ollama response BEFORE starting SSE stream.
// SvelteKit's streaming response API requires the Response to be returned
// synchronously. Ollama's streaming API cannot be piped directly into SSE
// because the fetch must complete before the Response constructor returns.
// See: https://github.com/sveltejs/kit/issues/NNNN (if applicable)
```

### Commit

```
docs(agent): expand WORKAROUND comment with architectural rationale
```

---

## Verification Checklist (Phase 3.3 Complete)

| #   | Check                                                | Command                                                                                                               | Expected                                                     |
| --- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 1   | lint-staged config found                             | `npx lint-staged --debug 2>&1 \| grep -i "config"`                                                                    | "Configuration found"                                        |
| 2   | No unnamed unused catch vars                         | `npm run lint 2>&1 \| grep "no-unused-vars" \| grep -i "catch" \| wc -l`                                              | 0                                                            |
| 3   | No commented-out code blocks                         | Manual review                                                                                                         | 0 blocks of 3+ consecutive commented lines                   |
| 4   | No TODO/FIXME without issue ref                      | `grep -rn "TODO\|FIXME" src/ --include="*.ts" --include="*.svelte" \| grep -v "issue #" \| grep -v "HACKRF" \| wc -l` | 0                                                            |
| 5   | eslint-disable count reduced                         | `grep -rn "eslint-disable" src/ --include="*.ts" --include="*.svelte" \| wc -l`                                       | 4-5 (legitimate only)                                        |
| 6   | no-magic-numbers rule active                         | `grep "no-magic-numbers" config/eslint.config.js \| wc -l`                                                            | 1                                                            |
| 7   | prefer-template rule active                          | `grep "prefer-template" config/eslint.config.js \| wc -l`                                                             | 1                                                            |
| 8   | No string concatenation violations                   | `npm run lint 2>&1 \| grep "prefer-template" \| wc -l`                                                                | 0                                                            |
| 9   | complexity rule active                               | `grep "complexity" config/eslint.config.js \| wc -l`                                                                  | 1                                                            |
| 10  | max-depth rule active                                | `grep "max-depth" config/eslint.config.js \| wc -l`                                                                   | 1                                                            |
| 11  | no-unreachable rule active (added 2026-02-08)        | `grep "no-unreachable" config/eslint.config.js \| wc -l`                                                              | 1                                                            |
| 12  | no-constant-condition rule active (added 2026-02-08) | `grep "no-constant-condition" config/eslint.config.js \| wc -l`                                                       | 1                                                            |
| 13  | naming-convention rule active (added 2026-02-08)     | `grep "naming-convention" config/eslint.config.js \| wc -l`                                                           | 1                                                            |
| 14  | No silent .catch(() => {}) (added 2026-02-08)        | `grep -rn '\.catch\s*(\s*() =>' src/ --include="*.ts" --include="*.svelte" \| wc -l`                                  | 0                                                            |
| 15  | TypeScript compiles                                  | `npm run typecheck`                                                                                                   | Exit 0                                                       |
| 12  | Build succeeds                                       | `npm run build`                                                                                                       | Exit 0                                                       |
| 13  | Unit tests pass                                      | `npm run test:unit`                                                                                                   | Exit 0                                                       |
| 14  | Lint passes (warnings OK)                            | `npm run lint`                                                                                                        | Exit 0 (no errors; warnings acceptable for warn-level rules) |

---

## Risk Assessment

| Risk                                                     | Likelihood | Impact | Mitigation                                                     |
| -------------------------------------------------------- | ---------- | ------ | -------------------------------------------------------------- |
| no-magic-numbers generates excessive warnings            | HIGH       | LOW    | Set to `warn`, not `error`; liberal ignore list                |
| prefer-template breaks template literal in Svelte markup | LOW        | MEDIUM | Rule only applies to JS/TS expressions, not HTML attributes    |
| complexity/max-depth warnings flood lint output          | MEDIUM     | LOW    | Set to `warn`; addressed structurally in Phase 5               |
| Removing eslint-disable exposes new lint errors          | MEDIUM     | LOW    | Fix underlying issue before removing disable comment           |
| Deleting commented code removes useful reference         | LOW        | LOW    | Code is in git history; comments are not documentation         |
| GitHub issue creation requires repo access               | LOW        | LOW    | Issues can be created after Phase 3.3; use placeholder numbers |

---

## Dependencies

- **Phase 3.1**: no-console must be escalated to `error` before 3.3.6 adds more rules.
- **Phase 3.2**: Constants must be centralized before no-magic-numbers is meaningful.
- **Phase 4**: `@typescript-eslint/no-explicit-any` escalation from `warn` to `error` happens in Phase 4, not here.
- **Phase 5**: `complexity` and `max-depth` warnings are resolved by architecture decomposition, not by raising thresholds.
