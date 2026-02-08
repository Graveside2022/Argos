# Phase 3.2.2: Hardcoded Timeout and Interval Replacement

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: BARR-C Rule 8.1 (No Magic Numbers), MISRA Rule 7.1 (Octal/Hex Constants Defined), NASA/JPL Rule 20 (Named Constants for All Literals), CERT INT09-C (Define Numeric Constants)
**Review Panel**: US Cyber Command Engineering Review Board

---

**Phase**: 3 -- Code Quality, Constants, Linting, and Defensive Coding
**Sub-Phase**: 3.2 -- Constants Centralization and Magic Number Elimination
**Task ID**: 3.2.2
**Risk Level**: LOW-MEDIUM
**Prerequisites**: Phase 3.2.0 (Constants Infrastructure Extension -- TIMEOUTS must contain all new timeout constants)
**Blocks**: Phase 3.3 (ESLint `no-magic-numbers` rule)
**Estimated Files Touched**: ~50
**Standards**: BARR-C Rule 8.1, MISRA Rule 7.1, NASA/JPL Rule 20, CERT INT09-C

---

## Objective

Replace all 104 hardcoded timeout and interval literals across ~50 source files with named constants from the `TIMEOUTS` object defined in `src/lib/constants/limits.ts`. This covers `setTimeout`, `setInterval`, and `AbortSignal.timeout` calls that use raw numeric literals.

## Current State Assessment (CORRECTED per Verification Audit 2026-02-08)

| Metric                             | Original Plan | Corrected Value | Delta                    |
| ---------------------------------- | ------------- | --------------- | ------------------------ |
| setTimeout with hardcoded numeric  | 64            | **69**          | +5                       |
| setInterval with hardcoded numeric | 15            | **23**          | +8                       |
| AbortSignal.timeout with hardcoded | 12            | **12**          | MATCH                    |
| **TOTAL**                          | **91**        | **104**         | **+13 (14% undercount)** |

## Scope

### setTimeout Occurrences by Delay Value (69 total, CORRECTED from 64)

| Delay (ms) | Count | Constant to Use                       | Notes                                                 |
| ---------- | ----- | ------------------------------------- | ----------------------------------------------------- |
| 100        | 3     | `TIMEOUTS.TICK_MS` (new, value 100)   | Short UI ticks; semantic grouping required            |
| 300        | 1     | Inline acceptable (UI debounce)       | Single-use debounce; exception to no-magic-numbers    |
| 500        | 7     | `TIMEOUTS.GSM_CLEANUP_DELAY_MS`       | GSM cleanup delays                                    |
| 1000       | 18    | `TIMEOUTS.SHORT_DELAY_MS`             | General 1-second delays; verify semantic purpose each |
| 2000       | 18    | `TIMEOUTS.PROCESS_STARTUP_DELAY_MS`   | Process startup waits                                 |
| 3000       | 7     | `TIMEOUTS.CONTAINER_STARTUP_DELAY_MS` | Container and heavier startup waits                   |
| 5000       | 3     | `TIMEOUTS.KISMET_RECONNECT_DELAY_MS`  | Reconnection delays                                   |
| 600000     | 1     | `TIMEOUTS.RTL433_STREAM_CLEANUP_MS`   | 10-minute cleanup timer                               |

**CRITICAL EXECUTION NOTE**: Each replacement MUST be verified against the semantic meaning of the delay -- not all 1000ms delays serve the same purpose. When in doubt, create a new semantically-named constant rather than reusing an existing one. For example, a 1000ms clock update and a 1000ms retry delay are different concerns and may diverge in future tuning.

**Full file-level inventory**: The executor must grep for each delay value at execution time to produce the complete file-level replacement list. The counts above are aggregate; individual file assignments must be determined by running:

```bash
grep -Prn 'setTimeout\([^,]+,\s*1000\)' src/ --include="*.ts" --include="*.svelte" | grep -v limits.ts | grep -v node_modules
```

Repeat for each delay value (100, 300, 500, 1000, 2000, 3000, 5000, 600000).

### setInterval Occurrences (23 total, CORRECTED from 15)

| Interval (ms) | Count | Constant to Use                       | Notes                                        |
| ------------- | ----- | ------------------------------------- | -------------------------------------------- |
| 1000          | 2     | `TIMEOUTS.CLOCK_UPDATE_MS`            | Real-time clock/counter updates              |
| 2000          | 2     | `TIMEOUTS.KISMET_WS_POLL_INTERVAL_MS` | WebSocket polling (see Value Mismatch Alert) |
| 3000          | 1     | `TIMEOUTS.BTLE_POLL_INTERVAL_MS`      | BTLE device polling                          |
| 5000          | 5     | `TIMEOUTS.KISMET_POLL_INTERVAL_MS`    | General Kismet status polling                |
| 10000         | 2     | `TIMEOUTS.FETCH_ABORT_TIMEOUT_MS`     | Periodic data refresh                        |
| 30000         | 1     | `TIMEOUTS.HEALTH_CHECK_INTERVAL_MS`   | Health check cadence                         |
| Other         | 10    | Various TIMEOUTS constants            | Executor must classify at execution time     |

**Audit correction**: The original plan claimed 15 setInterval occurrences. The audit found 23, a +8 delta. The additional 8 are distributed across files not enumerated in the original plan. Executor must grep to find all:

```bash
grep -Prn 'setInterval\([^,]+,\s*\d+\)' src/ --include="*.ts" --include="*.svelte" | grep -v limits.ts | grep -v node_modules
```

### AbortSignal.timeout Occurrences (12 total -- MATCH)

| Timeout (ms) | Count | Constant to Use                    | Files                                                           |
| ------------ | ----- | ---------------------------------- | --------------------------------------------------------------- |
| 1000         | 2     | `TIMEOUTS.SHORT_DELAY_MS`          | runtime.ts:93, start/+server.ts:30                              |
| 2000         | 4     | `TIMEOUTS.AGENT_HEALTH_CHECK_MS`   | status/+server.ts:20, runtime.ts:79, network-detector.ts:88,129 |
| 10000        | 1     | `TIMEOUTS.FETCH_ABORT_TIMEOUT_MS`  | --                                                              |
| 15000        | 1     | `TIMEOUTS.MCP_FETCH_TIMEOUT_MS`    | --                                                              |
| 30000        | 1     | `TIMEOUTS.EXEC_TIMEOUT_MS`         | --                                                              |
| 120000       | 1     | `TIMEOUTS.AGENT_OLLAMA_TIMEOUT_MS` | --                                                              |

**Audit correction on AbortSignal value breakdowns**:

- Plan claimed 2x 1000ms: audit found **3** (runtime.ts:93, start/+server.ts:30, status/+server.ts:34). The third may be a 1000ms or 2000ms depending on exact line content -- executor must verify.
- Plan claimed 4x 2000ms: audit found **5** (status/+server.ts:20, runtime.ts:79, network-detector.ts:88, :129, :168). Total remains 12 because the distribution shifted between the 1000ms and 2000ms buckets while the sum stayed constant.

### Value Mismatch Alert

**IMPORTANT**: `src/lib/server/kismet/webSocketManager.ts` line 75 defines `POLL_INTERVAL = 2000` but the existing `TIMEOUTS.KISMET_POLL_INTERVAL_MS` is `5000`. These serve different purposes:

- `TIMEOUTS.KISMET_POLL_INTERVAL_MS: 5000` -- general status polling (dashboard, health checks)
- `TIMEOUTS.KISMET_WS_POLL_INTERVAL_MS: 2000` -- WebSocket real-time data polling (lower latency)

Both values are preserved under distinct constant names in Task 3.2.0. The executor must map the `webSocketManager.ts` POLL_INTERVAL to `KISMET_WS_POLL_INTERVAL_MS`, NOT to `KISMET_POLL_INTERVAL_MS`.

## Execution Steps

1. **Verify prerequisite**: Confirm Task 3.2.0 is complete -- `grep "TICK_MS" src/lib/constants/limits.ts` returns a match.
2. **Replace setTimeout with 100ms** (3 occurrences) using `TIMEOUTS.TICK_MS`. Run typecheck.
3. **Skip setTimeout with 300ms** (1 occurrence) -- document as accepted inline exception.
4. **Replace setTimeout with 500ms** (7 occurrences) using `TIMEOUTS.GSM_CLEANUP_DELAY_MS`. Run typecheck.
5. **Replace setTimeout with 1000ms** (18 occurrences) using `TIMEOUTS.SHORT_DELAY_MS`. Verify semantic intent of each. Run typecheck.
6. **Replace setTimeout with 2000ms** (18 occurrences) using `TIMEOUTS.PROCESS_STARTUP_DELAY_MS`. Run typecheck.
7. **Replace setTimeout with 3000ms** (7 occurrences) using `TIMEOUTS.CONTAINER_STARTUP_DELAY_MS`. Run typecheck.
8. **Replace setTimeout with 5000ms** (3 occurrences) using `TIMEOUTS.KISMET_RECONNECT_DELAY_MS`. Run typecheck.
9. **Replace setTimeout with 600000ms** (1 occurrence) using `TIMEOUTS.RTL433_STREAM_CLEANUP_MS`. Run typecheck.
10. **Replace all setInterval occurrences** (23 total) grouped by value. Run typecheck after each group.
11. **Replace all AbortSignal.timeout occurrences** (12 total). Run typecheck.
12. **Run final verification** (grep for remaining raw numeric literals in setTimeout/setInterval/AbortSignal).

**Procedure**: Replace in groups of 5 files. Run `npm run typecheck` after each group. This limits blast radius of any incorrect replacement.

## Commit Message

```
refactor(constants): replace 104 hardcoded timeout/interval literals with TIMEOUTS constants

Phase 3.2 Task 2: Hardcoded Timeout and Interval Replacement
- Replaced 69 setTimeout literals (corrected from 64)
- Replaced 23 setInterval literals (corrected from 15)
- Replaced 12 AbortSignal.timeout literals
- Added KISMET_WS_POLL_INTERVAL_MS (2000) distinct from KISMET_POLL_INTERVAL_MS (5000)
- Accepted 300ms UI debounce as single documented exception
Verified: grep for raw setTimeout/setInterval/AbortSignal.timeout numerics returns 0

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

## Verification

**Command 1 -- No raw setTimeout/setInterval with 4+ digit numeric literals**:

```bash
grep -Prn '(setTimeout|setInterval)\([^,]+,\s*\d{4,}\)' src/ --include="*.ts" --include="*.svelte" | grep -v limits.ts | wc -l
```

**Expected result**: `0`

**Command 2 -- No raw setTimeout/setInterval with 3-digit numeric literals (except 300ms exception)**:

```bash
grep -Prn '(setTimeout|setInterval)\([^,]+,\s*\d{3}\)' src/ --include="*.ts" --include="*.svelte" | grep -v limits.ts | grep -v "300" | wc -l
```

**Expected result**: `0`

**Command 3 -- No raw AbortSignal.timeout with numeric literals**:

```bash
grep -Prn 'AbortSignal\.timeout\(\d+\)' src/ --include="*.ts" | grep -v limits.ts | wc -l
```

**Expected result**: `0`

**Command 4 -- TypeScript compiles**:

```bash
npm run typecheck
```

**Expected result**: Exit 0.

**Command 5 -- Build succeeds**:

```bash
npm run build
```

**Expected result**: Exit 0.

## Audit Corrections Applied

| Original Claim               | Corrected Value  | Delta                | Source                                                               |
| ---------------------------- | ---------------- | -------------------- | -------------------------------------------------------------------- |
| 91 total timeouts            | **104**          | +13 (14% undercount) | Verification Audit Claim 3, rated 2/5                                |
| 64 setTimeout occurrences    | **69**           | +5                   | Audit found 5 additional setTimeout calls                            |
| 15 setInterval occurrences   | **23**           | +8                   | Audit found 8 additional setInterval calls                           |
| 2x AbortSignal.timeout(1000) | **3** (possibly) | +1                   | Audit found runtime.ts:93, start/+server.ts:30, status/+server.ts:34 |
| 4x AbortSignal.timeout(2000) | **5** (possibly) | +1                   | Audit found network-detector.ts has 3 not 2 occurrences              |

**Note**: AbortSignal sub-category counts shifted between 1000ms and 2000ms buckets but the total of 12 remained correct. The executor must verify exact values at each file location.

## Risk Assessment

| Risk                                                            | Likelihood | Impact | Mitigation                                                                        |
| --------------------------------------------------------------- | ---------- | ------ | --------------------------------------------------------------------------------- |
| Timeout value change alters behavior                            | NONE       | --     | Literal-for-literal replacement; no values changed during this phase              |
| Wrong semantic mapping (reusing constant for different purpose) | MEDIUM     | LOW    | Verify each replacement's semantic intent; create new constant if purpose differs |
| KISMET_POLL vs KISMET_WS_POLL confusion                         | MEDIUM     | MEDIUM | Value Mismatch Alert documented; executor must verify webSocketManager.ts mapping |
| Missing occurrences despite audit                               | LOW        | LOW    | Final grep verification catches any remaining literals                            |
| 300ms exception triggers no-magic-numbers lint                  | LOW        | LOW    | Add eslint-disable-next-line comment at the single 300ms site                     |

## Success Criteria

- `grep -Prn '(setTimeout|setInterval)\([^,]+,\s*\d{3,}\)' src/ --include="*.ts" --include="*.svelte" | grep -v limits.ts | grep -v "300" | wc -l` returns **0** (or **1** for the documented 300ms exception)
- `grep -Prn 'AbortSignal\.timeout\(\d+\)' src/ --include="*.ts" | grep -v limits.ts | wc -l` returns **0**
- `npm run typecheck` exits 0
- `npm run build` exits 0
- All 104 occurrences replaced (103 with constants, 1 documented exception at 300ms)
- No behavioral changes -- only identifiers changed, not values
- KISMET_WS_POLL_INTERVAL_MS (2000) correctly assigned to webSocketManager.ts

## Cross-References

- **Depends on**: Phase-3.2.0 (Constants Infrastructure Extension)
- **Independent of**: Phase-3.2.1 (Port Replacement -- can execute in parallel after 3.2.0)
- **Blocks**: Phase-3.3 (ESLint `no-magic-numbers` enforcement)
- **Related**: Phase-3.2.5 (Buffer/Retention Replacement -- some retention periods are time-based)

## Execution Tracking

| Subtask  | Description                            | Status  | Started | Completed | Verified By |
| -------- | -------------------------------------- | ------- | ------- | --------- | ----------- |
| 3.2.2.1  | Replace setTimeout 100ms (3 files)     | PENDING | --      | --        | --          |
| 3.2.2.2  | Document 300ms exception (1 file)      | PENDING | --      | --        | --          |
| 3.2.2.3  | Replace setTimeout 500ms (7 files)     | PENDING | --      | --        | --          |
| 3.2.2.4  | Replace setTimeout 1000ms (18 files)   | PENDING | --      | --        | --          |
| 3.2.2.5  | Replace setTimeout 2000ms (18 files)   | PENDING | --      | --        | --          |
| 3.2.2.6  | Replace setTimeout 3000ms (7 files)    | PENDING | --      | --        | --          |
| 3.2.2.7  | Replace setTimeout 5000ms (3 files)    | PENDING | --      | --        | --          |
| 3.2.2.8  | Replace setTimeout 600000ms (1 file)   | PENDING | --      | --        | --          |
| 3.2.2.9  | Replace setInterval (23 total)         | PENDING | --      | --        | --          |
| 3.2.2.10 | Replace AbortSignal.timeout (12 total) | PENDING | --      | --        | --          |
| 3.2.2.11 | Final verification grep                | PENDING | --      | --        | --          |
