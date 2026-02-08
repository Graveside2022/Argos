# Phase 5.2.6: Service Layer Execution Order & Verification

| Field         | Value                                                                      |
| ------------- | -------------------------------------------------------------------------- |
| Document ID   | ARGOS-AUDIT-P5.2.6-2026-02-08                                              |
| Phase         | 5.2 -- Service Layer Refactoring                                           |
| Title         | Execution Order, Verification Checklist, Risk Mitigations & Type Contracts |
| Risk Level    | LOW (governance document, no code changes)                                 |
| Prerequisites | All Phase 5.2 sub-task documents (5.2.0 through 5.2.5) finalized           |
| Files Touched | 0 (governance/verification only)                                           |
| Standards     | MISRA C:2012 Dir 4.4, CERT MEM50-CPP, NASA/JPL Rule 31, Barr Ch.8          |
| Audit Date    | 2026-02-08                                                                 |

---

## 1. Objective

Define the mandatory execution order for Phase 5.2 tasks, the complete verification
checklist that must pass before the phase is considered complete, comprehensive risk
mitigations for all identified hazards, and the shared type contracts that bind the
decomposed modules together.

This document is the governance framework for Phase 5.2 execution. It contains no code
changes itself but defines the rules under which all code changes must be validated.

---

## 2. Execution Order and Dependencies

Tasks MUST be executed in the order specified below. Each task depends on the successful
completion of its predecessors due to shared type definitions and import graph changes.

```
Phase 3 (Store Isolation) ----+
                               |
Phase 4 (Dead Code Removal) --+--> Task 5.2.1 (API Dedup)
                                        |
                                        +--> Task 5.2.2 (BufferManager Dedup)
                                        |         |
                                        |         +--> Task 5.2.3 (ProcessManager Dedup)
                                        |
                                        +--> Task 5.2.4 (sweepManager Decomposition)
                                        |         |
                                        |         +--> Step 1: HealthMonitor
                                        |         +--> Step 2: ErrorHandler
                                        |         +--> Step 3: DataProcessor
                                        |         +--> Step 4: Slim orchestrator
                                        |
                                        +--> Task 5.2.5 (API Route Unification)
                                                  |
                                                  +--> Unified api/sdr/[device]/ tree
                                                  +--> Backward-compat redirects
                                                  +--> Frontend caller updates
                                                  +--> Old route deletion
```

### 2.1 Dependency Rationale

| Dependency             | Reason                                                                                             |
| ---------------------- | -------------------------------------------------------------------------------------------------- |
| Phase 3 before 5.2.1   | Store isolation ensures clean store import boundaries before API dedup changes store references.   |
| Phase 4 before 5.2.1   | Dead code removal eliminates unused API methods that would pollute the base class.                 |
| 5.2.1 before 5.2.2     | The `sdr-common/types.ts` created in 5.2.1 is consumed by `BaseBufferManager` in 5.2.2.            |
| 5.2.2 before 5.2.3     | ProcessManager subclasses may reference BufferManager; the refactored import paths must be stable. |
| 5.2.1 before 5.2.4     | sweepManager decomposition uses shared types from `sdr-common/types.ts`.                           |
| 5.2.4 Steps sequential | Each step modifies sweepManager.ts; concurrent edits would cause merge conflicts.                  |
| 5.2.1 before 5.2.5     | API route unification requires the `BaseSdrApi` subclasses and device registry from 5.2.1.         |
| 5.2.4 before 5.2.5     | sweepManager decomposition must be complete so route handlers delegate to stable APIs.             |

### 2.2 Commit Strategy

One atomic commit per task (5 total). Each commit must pass `npm run typecheck && npm run lint`
before proceeding to the next task. If a commit fails type checking, the failure is resolved
within that task's scope before advancing.

| Task  | Commit Message Pattern                                            | Gate                                |
| ----- | ----------------------------------------------------------------- | ----------------------------------- |
| 5.2.1 | `refactor(sdr): extract BaseSdrApi, fix USRP store bug`           | `npm run typecheck && npm run lint` |
| 5.2.2 | `refactor(sdr): extract BaseBufferManager`                        | `npm run typecheck && npm run lint` |
| 5.2.3 | `refactor(sdr): extract BaseProcessManager`                       | `npm run typecheck && npm run lint` |
| 5.2.4 | `refactor(hackrf): decompose sweepManager into health/error/data` | `npm run typecheck && npm run lint` |
| 5.2.5 | `refactor(api): unify hackrf/usrp routes under api/sdr/[device]`  | `npm run typecheck && npm run lint` |

---

## 3. Verification Checklist

Every item in this checklist MUST pass before the phase is considered complete. Partial
completion is not acceptable. Each item includes the exact command to run and the
expected output.

### 3.1 Structural Verification

| #   | Check                                 | Command                                                               | Expected                                                                              |
| --- | ------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| S1  | sdr-common directory exists           | `ls -la src/lib/services/sdr-common/`                                 | Contains `BaseSdrApi.ts`, `BaseBufferManager.ts`, `BaseProcessManager.ts`, `types.ts` |
| S2  | No direct HackRF/USRP API duplication | `diff <(grep -c "fetch(" src/lib/services/hackrf/api.ts) <(echo "2")` | Files match (HackRF subclass has minimal fetch calls, base handles the rest)          |
| S3  | USRP store bug resolved               | `grep -rn "stores/hackrf" src/lib/services/usrp/ --include="*.ts"`    | 0 matches                                                                             |
| S4  | sweepManager line count               | `wc -l < src/lib/server/hackrf/sweepManager.ts`                       | Less than 300                                                                         |
| S5  | No function > 60 lines                | `python3 scripts/audit-function-sizes-v2.py src/lib/server/hackrf/`   | All functions <= 60 lines                                                             |
| S6  | Health check decomposition            | `ls src/lib/server/hackrf/health/`                                    | Contains `HealthMonitor.ts`, `HealthCheckPipeline.ts`                                 |
| S7  | Error handler extraction              | `ls src/lib/server/hackrf/error/`                                     | Contains `SweepErrorHandler.ts`                                                       |
| S8  | Data processor extraction             | `ls src/lib/server/hackrf/data/`                                      | Contains `DataProcessor.ts`                                                           |

### 3.2 Correctness Verification

| #   | Check                                   | Command                                                                                               | Expected                                                                                                |
| --- | --------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| C1  | TypeScript compilation                  | `npm run typecheck`                                                                                   | Exit 0, no errors                                                                                       |
| C2  | ESLint                                  | `npm run lint`                                                                                        | Exit 0, no errors                                                                                       |
| C3  | No orphaned imports                     | `grep -rn "from.*sweep-manager/buffer/BufferManager" src/ --include="*.ts" \| grep -v "node_modules"` | All imports resolve to refactored subclasses                                                            |
| C4  | No circular dependencies                | `npx madge --circular src/lib/services/sdr-common/`                                                   | No circular dependencies                                                                                |
| C5  | Base class abstract methods implemented | `grep -c "abstract" src/lib/services/sdr-common/BaseSdrApi.ts`                                        | Count matches number of abstract members (4: deviceType, baseUrl/endpoints, updateStore, parseResponse) |
| C6  | Unit tests pass                         | `npm run test:unit`                                                                                   | Exit 0                                                                                                  |
| C7  | Integration tests pass                  | `npm run test:integration`                                                                            | Exit 0                                                                                                  |

### 3.3 Regression Verification

| #   | Check                         | Command                                                                                                                           | Expected                         |
| --- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| R1  | HackRF sweep start API        | `curl -s http://localhost:8092/api/status \| jq .`                                                                                | Valid JSON response              |
| R2  | sweepManager singleton stable | `grep -n "globalThis.*sweepManager" src/lib/server/hackrf/sweepManager.ts`                                                        | globalThis pattern present       |
| R3  | SSE endpoints unchanged       | `grep -rn "new ReadableStream" src/routes/api/hackrf/ --include="*.ts" -l`                                                        | Same files as before refactoring |
| R4  | No console.log in hot paths   | `grep -n "console\\.log" src/lib/server/hackrf/sweepManager.ts src/lib/server/hackrf/health/*.ts src/lib/server/hackrf/data/*.ts` | 0 matches in production code     |

### 3.4 Test Coverage Requirements

| Module                  | Test File                                                     | Test Type   | Minimum Tests | Coverage |
| ----------------------- | ------------------------------------------------------------- | ----------- | ------------- | -------- |
| `BaseSdrApi`            | `tests/unit/services/sdr-common/BaseSdrApi.test.ts`           | Unit        | 8             | 80%      |
| `HackRFApi` (subclass)  | `tests/unit/services/hackrf/HackRFApi.test.ts`                | Unit        | 5             | 60%      |
| `UsrpApi` (subclass)    | `tests/unit/services/usrp/UsrpApi.test.ts`                    | Unit        | 5             | 60%      |
| `BaseBufferManager`     | `tests/unit/services/sdr-common/BaseBufferManager.test.ts`    | Unit        | 6             | 80%      |
| `BaseProcessManager`    | `tests/unit/services/sdr-common/BaseProcessManager.test.ts`   | Unit        | 6             | 80%      |
| `HealthCheckPipeline`   | `tests/unit/server/hackrf/health/HealthCheckPipeline.test.ts` | Unit        | 10            | 80%      |
| `DataProcessor`         | `tests/unit/server/hackrf/data/DataProcessor.test.ts`         | Unit        | 8             | 80%      |
| `SweepErrorHandler`     | `tests/unit/server/hackrf/error/SweepErrorHandler.test.ts`    | Unit        | 6             | 60%      |
| SDR API Integration     | `tests/integration/services/sdr-api-integration.test.ts`      | Integration | 4             | N/A      |
| SweepManager regression | `tests/integration/server/sweepManager-regression.test.ts`    | Integration | 6             | N/A      |
| API Route Unification   | `tests/integration/routes/sdr-routes.test.ts`                 | Integration | 5             | N/A      |

**Existing broken tests**: The 15 failing test files (especially `hackrfService.test.ts`
which makes real HTTP calls) should be fixed BEFORE Phase 5.2 execution to establish a
clean regression baseline. Mislabeled unit tests that make network calls must be moved
to `tests/integration/` or mocked.

---

## 4. Risk Mitigations

### 4.1 Base Class Extraction Order Risk

**Risk**: Extracting base classes in the wrong order creates cascading type errors that
are difficult to diagnose.

**Mitigation**: The execution order in Section 2 is designed so that each base class
is complete and compiling before any dependent class is modified. The `sdr-common/types.ts`
file is created first (in 5.2.1) and serves as the shared type foundation for all
subsequent extractions. Each task ends with `npm run typecheck` to confirm clean
compilation before proceeding.

**Rollback**: Each task produces one Git commit. If a task introduces type errors that
cannot be resolved, `git revert <commit>` cleanly undoes that task without affecting
prior tasks.

### 4.2 Store Callback Migration Risk

**Risk**: The USRP store bug fix (5.2.1) changes which store receives spectrum data
updates. If any UI component reads from the HackRF store expecting USRP data (a
compensating workaround for the bug), the fix will break that component.

**Mitigation**: Before applying the fix, audit all USRP-related Svelte components to
determine if any read from `hackrfStore`:

```bash
# Find all files that import hackrfStore AND reference USRP:
grep -rl "hackrfStore" src/lib/components/ src/routes/ --include="*.svelte" | \
    xargs grep -l -i "usrp" 2>/dev/null
```

If any files are found, they must be updated to read from `usrpStore` as part of the
same commit that fixes `usrp-api.ts`. This ensures atomicity: the store write and store
read are corrected together.

### 4.3 sweepManager Public API Stability Risk

**Risk**: The sweepManager decomposition (5.2.4) could inadvertently change the public
API surface, breaking API route handlers and SSE endpoints.

**Mitigation**: Before starting 5.2.4, capture the current public API surface:

```bash
# List all public methods of SweepManager class:
grep -E "^\s+(public|async)\s+\w+" src/lib/server/hackrf/sweepManager.ts | \
    grep -v "private\|protected\|_" > /tmp/sweep-api-before.txt
```

After completing 5.2.4, repeat and diff:

```bash
grep -E "^\s+(public|async)\s+\w+" src/lib/server/hackrf/sweepManager.ts | \
    grep -v "private\|protected\|_" > /tmp/sweep-api-after.txt
diff /tmp/sweep-api-before.txt /tmp/sweep-api-after.txt
# Expected: identical output (no public API changes)
```

Additionally, all API routes that import `sweepManager` must be identified and verified:

```bash
grep -rn "sweepManager" src/routes/api/ --include="*.ts" -l
# Every listed file must compile without changes.
```

### 4.4 USRP Bug Fix Side Effects

**Risk**: Fixing the USRP store import may expose latent bugs in USRP-specific
functionality that was previously untestable (because data was going to the wrong store).

**Mitigation**: The USRP store fix is a correctness improvement. Any bugs exposed by
the fix are pre-existing bugs that were hidden by the store cross-contamination. These
should be tracked as separate issues, not blockers for this phase.

After applying the fix, verify USRP store receives data:

```bash
# Start a USRP sweep (if hardware available) and check store:
# This is a manual verification step requiring USRP hardware.
# If hardware is unavailable, verify via unit test mock.
```

### 4.5 Backward Compatibility for Existing Imports

**Risk**: Files that directly import from `services/hackrf/api.ts` using named exports
may break if the export names change during the subclass refactoring.

**Mitigation**: The subclass files (`api.ts` and `usrp-api.ts`) MUST export the same
names as the originals. Specifically:

- `services/hackrf/api.ts` currently exports `hackrfApi` (or similar singleton).
  The refactored file MUST export the same name: `export const hackrfApi = new HackRFApi();`
- `services/usrp/usrp-api.ts` currently exports `usrpApi` (or similar singleton).
  The refactored file MUST export the same name: `export const usrpApi = new USRPApi();`

Verification:

```bash
# Before refactoring, capture exports:
grep "^export" src/lib/services/hackrf/api.ts > /tmp/hackrf-exports-before.txt
grep "^export" src/lib/services/usrp/usrp-api.ts > /tmp/usrp-exports-before.txt

# After refactoring, verify same exports exist:
grep "^export" src/lib/services/hackrf/api.ts > /tmp/hackrf-exports-after.txt
grep "^export" src/lib/services/usrp/usrp-api.ts > /tmp/usrp-exports-after.txt

# Diff must show no removed exports (additions are acceptable):
diff /tmp/hackrf-exports-before.txt /tmp/hackrf-exports-after.txt
diff /tmp/usrp-exports-before.txt /tmp/usrp-exports-after.txt
```

### 4.6 HackRF-Only Module Import Stability

**Risk**: The HackRF-only modules (`ErrorTracker.ts`, `FrequencyCycler.ts`) import from
sibling paths within `services/hackrf/sweep-manager/`. The base class extraction changes
the directory structure, potentially breaking these imports.

**Mitigation**: The base class extraction DOES NOT move HackRF-specific files. The
`services/hackrf/sweep-manager/` directory structure is preserved. Only the
`buffer/BufferManager.ts` and `process/ProcessManager.ts` files within that directory
are modified (to extend base classes). Their file paths remain identical.

The `ErrorTracker.ts` and `FrequencyCycler.ts` files import from their siblings via
relative paths (e.g., `../buffer/BufferManager`). These relative imports continue to
resolve correctly because the files are not moved.

Verification:

```bash
# Check ErrorTracker and FrequencyCycler imports resolve:
grep -n "from.*\.\./" src/lib/services/hackrf/sweep-manager/error/ErrorTracker.ts
grep -n "from.*\.\./" src/lib/services/hackrf/sweep-manager/frequency/FrequencyCycler.ts
# All listed imports must correspond to files that exist post-refactoring.
```

---

## 5. Appendix: Type Contracts

### 5.1 Shared Types (sdr-common/types.ts)

This file is created in Task 5.2.1 and consumed by all subsequent tasks. It defines the
canonical type vocabulary for SDR operations across both HackRF and USRP.

```typescript
// src/lib/services/sdr-common/types.ts

/**
 * Canonical SDR type definitions.
 *
 * These types define the shared vocabulary between HackRF and USRP
 * implementations. All device-specific variations are normalized
 * to these types at the boundary (API response parsing, store writes).
 *
 * NAMING CONVENTION (per Type Duplicate Audit):
 * - Raw* prefix: types matching external API response schemas
 * - *Row suffix: types matching database row schemas
 * - No prefix/suffix: domain types used within application logic
 */

/** Device type discriminator. Used in logging, error messages, and type guards. */
export type SdrDeviceType = 'hackrf' | 'usrp';

/**
 * Normalized spectrum data point.
 *
 * Represents a single frequency/power measurement from any SDR device.
 * Device-specific response formats are normalized to this type by
 * the parseResponse() method of each BaseSdrApi subclass.
 */
export interface SpectrumDataPoint {
	/** Center frequency of the measurement bin, in Hz. */
	frequency: number;

	/** Measured power level in dBm. Clamped to [-150, +20]. */
	power: number;

	/** Unix epoch milliseconds when this measurement was recorded. */
	timestamp: number;
}

/**
 * Sweep configuration parameters.
 *
 * Shared between HackRF and USRP sweep initiation.
 * Device-specific parameters (e.g., HackRF LNA gain, USRP subdevice spec)
 * are defined in device-specific extension interfaces.
 */
export interface SweepConfig {
	/** Start frequency in Hz. Must be >= 1 MHz. */
	freqStartHz: number;

	/** End frequency in Hz. Must be <= 6 GHz for HackRF, <= 6 GHz for USRP B200. */
	freqEndHz: number;

	/** FFT bin width in Hz. Determines spectral resolution. */
	binWidthHz?: number;

	/** Overall gain in dB. Interpretation is device-specific. */
	gainDb?: number;

	/** HackRF-specific: LNA gain in dB [0, 40]. Ignored by USRP. */
	lnaGainDb?: number;

	/** HackRF-specific: VGA gain in dB [0, 62]. Ignored by USRP. */
	vgaGainDb?: number;

	/** USRP-specific: Sample rate in Hz. Ignored by HackRF. */
	sampleRate?: number;
}

/**
 * Device status snapshot.
 *
 * Returned by the getStatus() API call. Fields are device-specific
 * but the top-level structure is shared.
 */
export interface DeviceStatus {
	/** Whether the device is currently performing a sweep. */
	sweeping: boolean;

	/** Device type identifier. */
	device: SdrDeviceType;

	/** Human-readable status message. */
	message: string;

	/** Uptime in milliseconds since last sweep start. */
	uptimeMs: number;

	/** Number of spectrum data points collected in current sweep. */
	dataPointCount: number;
}
```

### 5.2 Type Migration Checklist

When migrating existing code to use the shared types, follow this checklist for each file:

1. Replace any local `SpectrumDataPoint` type alias with the import from `sdr-common/types`.
2. Replace any local `SweepConfig` or equivalent configuration type with the shared type.
3. If the local type has additional fields not in the shared type, extend the shared type
   in a device-specific interface (e.g., `interface HackRFSweepConfig extends SweepConfig`).
4. Run `npm run typecheck` after each file migration.
5. Do NOT remove the old type definition until all importers have been migrated. Migration
   is file-by-file, not all-at-once, to minimize blast radius.

### 5.3 Module Interface Contracts

Each extracted module exposes a defined interface contract to the sweepManager orchestrator:

| Module              | Constructor Dependencies                                             | Public API Surface                                                                                                           |
| ------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| HealthMonitor       | `onRecoveryNeeded: (decision) => void`                               | `startMonitoring()`, `stopMonitoring()`, `recordDataReceived()`, `recordError()`, `reset()`, `destroy()`                     |
| SweepErrorHandler   | `onRecovery: (action) => Promise<void>`, `onAbort: (reason) => void` | `handleSweepError()`, `handleProcessExit()`, `isCriticalStartupError()`, `isCriticalError()`, `resetTracking()`, `destroy()` |
| DataProcessor       | None (stateless construction)                                        | `processLine()`, `parseHackrfOutput()`, `normalizeSignalStrength()`                                                          |
| HealthCheckPipeline | N/A (pure functions, no class)                                       | `checkProcessLiveness()`, `checkDataFreshness()`, `checkSystemMemory()`, `evaluateErrorRate()`, `decideRecoveryAction()`     |

---

## 6. Phase Completion Criteria

Phase 5.2 is considered COMPLETE when ALL of the following are true:

1. All 5 task commits (5.2.1 through 5.2.5) are merged.
2. Every item in the Structural Verification checklist (S1-S8) passes.
3. Every item in the Correctness Verification checklist (C1-C7) passes.
4. Every item in the Regression Verification checklist (R1-R4) passes.
5. All test files in Section 3.4 exist and their tests pass.
6. No function in any modified or created file exceeds 60 lines.
7. The USRP store cross-contamination bug is verified fixed.
8. The sweepManager public API surface is verified unchanged.

**Phase 5.2 is NOT complete if any of the above criteria are unmet.**

---

## 7. Overall Risk Summary

| Risk ID | Description                         | Severity | Task    | Mitigation Section |
| ------- | ----------------------------------- | -------- | ------- | ------------------ |
| R1      | Base class extraction order cascade | HIGH     | 5.2.1-3 | 4.1                |
| R2      | Store callback cross-contamination  | MEDIUM   | 5.2.1   | 4.2                |
| R3      | sweepManager public API breakage    | HIGH     | 5.2.4   | 4.3                |
| R4      | USRP bug fix exposes latent issues  | MEDIUM   | 5.2.1   | 4.4                |
| R5      | Import name backward compatibility  | LOW      | 5.2.1   | 4.5                |
| R6      | HackRF-only module import stability | LOW      | 5.2.2-3 | 4.6                |

---

## 8. Standards Compliance Summary

| Standard             | Requirement               | Phase 5.2 Compliance                                    |
| -------------------- | ------------------------- | ------------------------------------------------------- |
| MISRA C:2012 Dir 4.1 | Functions <= 60 lines     | 356-line monolith eliminated; all functions <= 60 lines |
| MISRA C:2012 Dir 4.4 | No dead/duplicated code   | ~4,493 duplicated lines deduplicated via base classes   |
| CERT ERR50-CPP       | Structured error handling | SdrApiError, SweepErrorHandler provide typed error flow |
| CERT POS54-C         | Proper signal handling    | SIGTERM->SIGKILL escalation in BaseProcessManager       |
| NASA/JPL Rule 14     | Bounded memory            | Ring buffers fixed-capacity; error arrays capped        |
| NASA/JPL Rule 25     | Resource deallocation     | All modules implement destroy() for cleanup             |
| NASA/JPL Rule 31     | Single responsibility     | Each module has one well-defined responsibility         |
| Barr Ch.8            | Resource management       | Intervals, processes, buffers all have explicit cleanup |
| Barr Ch.9            | Process safety            | At-most-one process invariant; orphan detection         |

---

## 9. Rollback Strategy (Phase-Level)

If the entire Phase 5.2 must be rolled back (not just individual tasks):

```bash
# Identify all Phase 5.2 commits
git log --oneline --grep="refactor(sdr)\|refactor(hackrf)\|refactor(api)" | head -5

# Revert in reverse order (last commit first)
git revert <commit-5.2.5>
git revert <commit-5.2.4>
git revert <commit-5.2.3>
git revert <commit-5.2.2>
git revert <commit-5.2.1>
```

Each revert is independently safe because tasks were committed atomically. Reverting
in reverse order ensures no import graph breakage during the rollback sequence.

---

## End of Document

| Field          | Value                                  |
| -------------- | -------------------------------------- |
| Author         | AI Engineering Agent (Claude Opus 4.6) |
| Reviewed By    | Pending human review                   |
| Classification | UNCLASSIFIED // FOUO                   |
| Distribution   | Limited to Argos development team      |
| Version        | 1.0                                    |
| Date           | 2026-02-08                             |
