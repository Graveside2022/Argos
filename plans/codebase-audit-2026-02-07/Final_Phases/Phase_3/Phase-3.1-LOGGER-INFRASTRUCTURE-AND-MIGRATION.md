# Phase 3.1: Logger Infrastructure Repair and Migration

**Risk Level**: LOW -- Mechanical replacements after infrastructure fix, no behavior changes
**Prerequisites**: Phase 0 (Code Organization), Phase 1 (Zero-Risk Cleanup)
**Estimated Files Touched**: 172
**Blocks**: Phase 3.2 (Constants), Phase 3.3 (ESLint Enforcement), Phase 4 (Type Safety)
**Standards**: BARR-C Rule 8.7 (no side effects in debug code), NASA/JPL Rule 14 (check return values), CERT ERR00-C (adopt consistent error handling)

---

## Current State Assessment (Verified 2026-02-07)

| Metric                                            | Verified Value                                                                         | Target                                                                     | Verification Command                                                                                                                    |
| ------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Total `console.*` statements (.ts + .svelte)      | 752 across 170 files (corrected 2026-02-08)                                            | 0 in production code (4 permitted in `logger.ts`, 12 in `validate-env.js`) | `grep -rn "console\.\(log\|warn\|error\|info\|debug\|trace\)" src/ --include="*.ts" --include="*.svelte" \| wc -l`                      |
| Active (non-commented) `console.*`                | 717 (corrected 2026-02-08)                                                             | 0                                                                          | Same grep, pipe through `grep -v '^\s*//'`                                                                                              |
| Commented-out `console.*`                         | 35 (19 commented in test-connection.ts; 2 active in same file) (corrected 2026-02-08)  | 0 (delete, do not migrate)                                                 | `grep -rn --include="*.ts" --include="*.svelte" -E '^\s*//' src/ \| grep -E 'console\.(log\|warn\|error\|info\|debug\|trace)' \| wc -l` |
| `console.log` count                               | 285 (corrected 2026-02-08)                                                             | 0                                                                          | `grep -rn "console\.log" src/ --include="*.ts" --include="*.svelte" \| wc -l`                                                           |
| `console.error` count                             | 310 (corrected 2026-02-08)                                                             | 0                                                                          | `grep -rn "console\.error" src/ --include="*.ts" --include="*.svelte" \| wc -l`                                                         |
| `console.warn` count                              | 127                                                                                    | 0                                                                          | `grep -rn "console\.warn" src/ --include="*.ts" --include="*.svelte" \| wc -l`                                                          |
| `console.info` count                              | 31                                                                                     | 0                                                                          | `grep -rn "console\.info" src/ --include="*.ts" --include="*.svelte" \| wc -l`                                                          |
| `console.debug` count                             | 0                                                                                      | 0                                                                          | Already clean                                                                                                                           |
| `console.trace` count                             | 0                                                                                      | 0                                                                          | Already clean                                                                                                                           |
| Files importing logger (static)                   | 43 unique files                                                                        | 170 files                                                                  | `grep -rn "from.*logger" src/ --include="*.ts" --include="*.svelte" \| cut -d: -f1 \| sort -u \| wc -l`                                 |
| Files importing logger (dynamic `await import()`) | 4 Svelte files (DirectoryCard, AnalysisModeCard, AntennaSettingsCard, TAKSettingsCard) | Include in migration scope                                                 | `grep -rn "await import.*logger" src/ --include="*.svelte" \| wc -l`                                                                    |
| Files with logger AND console.\* (incomplete)     | 6 files, 23 statements                                                                 | 0                                                                          | See Subtask 3.1.4                                                                                                                       |
| Logger singleton HMR safety                       | UNSAFE (module-scoped static)                                                          | Safe (globalThis-guarded)                                                  | Manual inspection of `src/lib/utils/logger.ts`                                                                                          |
| `configureLogging()` call sites                   | 0 (dead function)                                                                      | 1 (app init) or removed                                                    | `grep -rn "configureLogging" src/ --include="*.ts" \| wc -l`                                                                            |

---

## Execution Order

```
Subtask 3.1.1: Fix Logger Infrastructure Defects (MUST be first)
    |
    v
Subtask 3.1.2: Delete Commented-Out Console Statements (36 lines)
    |
    v
Subtask 3.1.3: Fix 6 Incomplete Migration Files (23 statements)
    |
    v
Subtask 3.1.4: Batch Migration -- 7 Batches (714 remaining statements)
    |
    v
Subtask 3.1.5: Enable ESLint `no-console: error`
```

---

## Subtask 3.1.1: Fix Logger Infrastructure Defects

**CRITICAL**: The logger at `src/lib/utils/logger.ts` has 6 defects that MUST be fixed before migration begins. Migrating 170 files to a broken logger would propagate defects at scale.

### Defect 1: HMR Singleton Memory Leak

**File**: `src/lib/utils/logger.ts`
**Root Cause**: `Logger.instance` is a static class property at module scope. During Vite HMR, the module re-evaluates, creating a NEW Logger instance with a NEW `setInterval` (line 74). The old interval is never cleared.
**Evidence**: This exact pattern was fixed in other singletons (sweepManager uses `globalThis.__sweepManager`). The logger was missed.

**Fix**: Replace the static singleton pattern with a `globalThis`-guarded singleton.

```typescript
// BEFORE (defective):
class Logger {
	private static instance: Logger;
	static getInstance(): Logger {
		if (!Logger.instance) {
			Logger.instance = new Logger();
		}
		return Logger.instance;
	}
}

// AFTER (HMR-safe):
const LOGGER_KEY = '__argos_logger_singleton__';

class Logger {
	static getInstance(): Logger {
		if (!(globalThis as Record<string, unknown>)[LOGGER_KEY]) {
			(globalThis as Record<string, unknown>)[LOGGER_KEY] = new Logger();
		}
		return (globalThis as Record<string, unknown>)[LOGGER_KEY] as Logger;
	}
}
```

**Verification**: Restart dev server, make a source change to trigger HMR, confirm only 1 `setInterval` timer exists for the logger (inspect with `process._getActiveHandles()` in Node.js REPL).

### Defect 2: All Non-Error Levels Route to `console.warn`

**File**: `src/lib/utils/logger.ts`, lines 144-159
**Root Cause**: The internal `log()` method's switch statement sends INFO and DEBUG to `console.warn()` instead of `console.log()` and `console.debug()` respectively.
**Impact**: Browser DevTools filtering is broken -- all log output appears as warnings. Server-side log aggregation tools cannot distinguish levels.

**Fix**: Route each level to its correct console method:

```typescript
// BEFORE:
case LogLevel.INFO:  console.warn(formatted); break;
case LogLevel.DEBUG: if (this.isDevelopment) console.warn(formatted); break;

// AFTER:
case LogLevel.INFO:  console.log(formatted); break;
case LogLevel.DEBUG: if (this.isDevelopment) console.debug(formatted); break;
```

**Post-fix ESLint impact**: After this change, the logger itself will use `console.log` and `console.debug`, which will trigger `no-console` warnings. Add `// eslint-disable-next-line no-console` above each `console.*` call inside the `log()` method's switch statement (4 total: error, warn, log, debug). This is the ONLY file where eslint-disable for no-console is permitted.

### Defect 3: `getStats().totalLogged` Counter Is Incorrect

**File**: `src/lib/utils/logger.ts`, approximately line 50
**Root Cause**: When the circular buffer wraps, the formula adds `this.maxSize` to `this.buffer.length`, but `buffer.length === maxSize` at that point, always yielding `2 * maxSize` (2000).
**Fix**: Add a dedicated `totalLogged` counter incremented in every `log()` call, independent of buffer state.

```typescript
private totalLogged = 0;

private log(...) {
    this.totalLogged++;
    // ... existing logic
}

getStats() {
    return {
        totalLogged: this.totalLogged,
        // ... rest unchanged
    };
}
```

### Defect 4: `configureLogging()` Is Never Called

**File**: `src/lib/config/logging.ts`
**Root Cause**: The function `configureLogging()` reads `process.env.LOG_LEVEL` and configures the logger, but grep confirms zero call sites exist. The logger falls back to its constructor defaults.
**Fix**: Either (a) call `configureLogging()` from `src/hooks.server.ts` at startup, or (b) move the environment-reading logic into the Logger constructor itself. Option (b) is simpler and eliminates the dead `logging.ts` file.

**Recommended**: Option (b). Move the 3-line env check into the Logger constructor, delete `src/lib/config/logging.ts`.

### Defect 5: No Cleanup/Dispose Method

**Root Cause**: The `setInterval` on line 74 (rate-limit map cleanup, every 60s) runs indefinitely. There is no `dispose()` or `destroy()` method to clear it. During testing or if the logger needs to be replaced, intervals leak.
**Fix**: Add a `dispose()` method:

```typescript
private cleanupTimer: ReturnType<typeof setInterval> | null = null;

constructor() {
    this.cleanupTimer = setInterval(() => this.rateLimitMap.clear(), 60000);
}

dispose(): void {
    if (this.cleanupTimer) {
        clearInterval(this.cleanupTimer);
        this.cleanupTimer = null;
    }
}
```

### Defect 6: `getRecent()` Returns Wrong Chronological Order After Buffer Wrap

**File**: `src/lib/utils/logger.ts`, approximately lines 38-41
**Root Cause**: `getRecent()` does `[...this.buffer].slice(-count)`. After the circular buffer wraps, `this.buffer[0]` through `this.buffer[pointer-1]` are the NEWEST entries (overwritten in circular fashion), but `slice(-count)` returns the last N elements of array order. This gives entries in the wrong chronological order -- the most recent entries are near the beginning of the array, but `slice(-count)` returns entries near the end.

**Fix**: Reorder the buffer correctly before slicing:

```typescript
getRecent(count: number = 50): LogEntry[] {
    if (this.buffer.length < this.maxSize) {
        // Buffer has not wrapped yet -- array order is chronological
        return [...this.buffer].slice(-count);
    }
    // Buffer has wrapped -- reconstruct chronological order:
    // pointer..end are OLDER, 0..pointer-1 are NEWER
    const ordered = [
        ...this.buffer.slice(this.pointer),
        ...this.buffer.slice(0, this.pointer)
    ];
    return ordered.slice(-count);
}
```

**Verification**: Write a unit test that logs `maxSize + 10` entries, then calls `getRecent(5)`. The returned entries should be the last 5 logged, in chronological order.

### Commit for Subtask 3.1.1

```
fix(logging): repair 6 logger infrastructure defects before migration

- Fix HMR singleton leak using globalThis guard
- Route INFO->console.log, DEBUG->console.debug (was all console.warn)
- Fix totalLogged counter (was always reporting 2*maxSize)
- Integrate configureLogging into constructor, delete dead logging.ts
- Add dispose() method for interval cleanup
- Fix getRecent() chronological ordering after circular buffer wrap

```

**Verification**:

```bash
npm run typecheck   # Must pass
npm run test:unit   # Must pass
```

---

## Subtask 3.1.2: Delete Commented-Out Console Statements

36 commented-out `console.*` lines across 8 files. These are dead code, not documentation. Delete them entirely.

### Complete Inventory

**`src/lib/services/websocket/test-connection.ts`** -- 21 lines (lines 12, 15, 24, 25, 33, 37, 44, 53, 54, 57, 60, 69, 73, 82, 83, 84, 88, 94, 100):

- All are `// console.info(...)` debug logging for WebSocket connection tests. The entire file is a test harness that appears unused (0 import references). **Candidate for Phase 0 deletion**. If Phase 0 deletes this file, skip these 21 lines.

**`src/lib/services/websocket/base.ts`** -- 4 lines (lines 58, 176, 204, 277):

- `// console.info(...)` connection lifecycle logging.

**`src/lib/services/websocket/hackrf.ts`** -- 2 lines (lines 158, 176):

- `// console.info(...)` connection/disconnection logging.

**`src/lib/services/websocket/kismet.ts`** -- 2 lines (lines 93, 110):

- `// console.info(...)` connection/disconnection logging.

**`src/lib/services/kismet/kismetService.ts`** -- 4 lines (lines 398, 412, 447, 538):

- `// console.info(...)` reconnection and restart logging.

**`src/lib/server/hackrf/sweepManager.ts`** -- 1 line (line 599):

- `// Handle stdout data -- NO console.log in this hot path` (explanatory comment, NOT a commented-out call -- **KEEP this line**).

**`src/lib/components/kismet/GPSStatusButton.svelte`** -- 3 lines (lines 19, 20, 44):

- `// $: console.warn(...)` debug reactivity logging.

**`src/routes/gsm-evil/+page.svelte`** -- 1 line (line 859):

- `// console.log('scanResults updated:', ...)` debug logging.

### Action

Delete all 35 commented-out console.\* lines (the 1 line in sweepManager.ts is an explanatory comment, not a commented-out call; keep it).

### Commit

```
refactor(logging): delete 35 commented-out console.* lines across 7 files
```

**Verification**:

```bash
grep -rn --include="*.ts" --include="*.svelte" -E '^\s*//' src/ | grep -E 'console\.(log|warn|error|info|debug|trace)' | wc -l
# Expected: 0 (the sweepManager comment does not match this pattern because it's prose, not a commented call)
```

---

## Subtask 3.1.3: Fix 6 Incomplete Migration Files

These 6 files already import the logger but still contain 23 raw `console.*` statements. Fix these first to establish a clean baseline before batch migration.

| #   | File                                         | console.\* Count            | Action                                                                                             |
| --- | -------------------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------- |
| 1   | `src/lib/config/logging.ts`                  | 1 (`console.warn`)          | Deleted by Subtask 3.1.1 Defect 4                                                                  |
| 2   | `src/lib/server/hackrf/sweepManager.ts`      | 1 (`console.error`)         | Replace with `logError`                                                                            |
| 3   | `src/lib/server/hardware/resourceManager.ts` | 7 (4 error, 2 warn, 1 log)  | Replace: 4x`logError`, 2x`logWarn`, 1x`logInfo`                                                    |
| 4   | `src/lib/services/hackrf/hackrfService.ts`   | 1 (`console.error`)         | Replace with `logError`                                                                            |
| 5   | `src/routes/api/gsm-evil/status/+server.ts`  | 1 (`console.error`)         | Replace with `logError`                                                                            |
| 6   | `src/routes/api/kismet/start/+server.ts`     | 12 (8 error, 3 log, 1 warn) | Replace: 8x`logError`, 1x`logWarn`, 3x`logInfo` (review: 3 `console.log` calls may be error-level) |

**Total**: 22 statements (1 eliminated by file deletion in Subtask 3.1.1).

### Commit

```
fix(logging): complete logger migration in 5 partially-migrated files
```

**Verification**:

```bash
# Confirm no file imports logger AND uses console.*
for f in $(grep -rl "from.*logger" src/ --include="*.ts" --include="*.svelte"); do
    if grep -q "console\.\(log\|warn\|error\|info\|debug\|trace\)" "$f"; then
        echo "INCOMPLETE: $f"
    fi
done
# Expected: no output
```

---

## Subtask 3.1.4: Batch Migration -- 7 Batches

After Subtasks 3.1.1-3.1.3, the remaining count is:

- Total console.\* in .ts/.svelte: 752 (corrected 2026-02-08)
- Minus commented-out (deleted): -35
- Minus logger.ts (excluded): -4
- Minus validate-env.js (excluded, .js not .ts): 0 (already excluded from .ts count)
- Minus incomplete files (fixed in 3.1.3): -22
- Minus logging.ts (deleted in 3.1.1): -1
- **Remaining to migrate**: ~690 statements across ~164 files

### Semantic Log Level Mapping Rule

**CRITICAL**: Do NOT mechanically map `console.log` to `logInfo`. Review each statement and apply the correct semantic level:

| Pattern in Code                                              | Correct Logger Level | Rationale                               |
| ------------------------------------------------------------ | -------------------- | --------------------------------------- |
| `console.log('Error ...')` or `console.log('Failed ...')`    | `logError`           | Error condition reported at wrong level |
| `console.log('Warning: ...')` or `console.log('[WARN] ...')` | `logWarn`            | Warning reported at wrong level         |
| `console.log('Starting ...')` or informational               | `logInfo`            | Correct mapping                         |
| `console.error(...)`                                         | `logError`           | Direct mapping                          |
| `console.warn(...)`                                          | `logWarn`            | Direct mapping                          |
| `console.info(...)`                                          | `logInfo`            | Direct mapping                          |

**Verified misleveled calls requiring manual correction (9 instances)**:

| #   | File                                                   | Line | Current                                               | Correct Level |
| --- | ------------------------------------------------------ | ---- | ----------------------------------------------------- | ------------- |
| 1   | `src/routes/api/cell-towers/nearby/+server.ts`         | 89   | `console.log('Cell tower DB...failed:')`              | `logError`    |
| 2   | `src/routes/api/gsm-evil/scan/+server.ts`              | 156  | `console.log('Both log analysis and tcpdump failed')` | `logError`    |
| 3   | `src/routes/api/gsm-evil/scan/+server.ts`              | 249  | `console.log('Error testing...')`                     | `logError`    |
| 4   | `src/routes/api/gsm-evil/scan/+server.ts`              | 259  | `console.log('Warning: Failed to clean up')`          | `logWarn`     |
| 5   | `src/routes/api/gsm-evil/tower-location/+server.ts`    | 64   | `console.log('OpenCellID API error:')`                | `logError`    |
| 6   | `src/lib/server/wireshark.ts`                          | 212  | `console.log('Error checking...')`                    | `logError`    |
| 7   | `src/lib/server/wireshark.ts`                          | 270  | `console.log('[WARN] Array parse error:')`            | `logWarn`     |
| 8   | `src/lib/server/wireshark.ts`                          | 311  | `console.log('[WARN] JSON parse error:')`             | `logWarn`     |
| 9   | `src/lib/server/hardware/detection/serial-detector.ts` | 71   | `console.log('Could not read...')`                    | `logWarn`     |

### Batch 1: `src/lib/server/` (.ts only) -- 36 files, 200 statements

After Subtask 3.1.3 fixes 2 files (sweepManager, resourceManager), 34 files remain with 192 statements.

| #   | File                                                                | Count | Methods                 |
| --- | ------------------------------------------------------------------- | ----- | ----------------------- |
| 1   | `src/lib/server/wireshark.ts`                                       | 30    | 18 log, 9 error, 3 warn |
| 2   | `src/lib/server/wifite/processManager.ts`                           | 21    | 7 log, 11 error, 3 warn |
| 3   | `src/lib/server/agent/tool-execution/init.ts`                       | 18    | 11 log, 5 error, 2 warn |
| 4   | `src/lib/server/hardware/detection/hardware-detector.ts`            | 15    | 10 log, 3 error, 2 warn |
| 5   | `src/lib/server/mcp/registry-integration.ts`                        | 14    | 5 log, 6 error, 3 warn  |
| 6   | `src/lib/server/agent/tool-execution/router.ts`                     | 10    | 4 log, 4 error, 2 warn  |
| 7   | `src/lib/server/agent/tool-execution/detection/detector.ts`         | 9     | 5 log, 3 error, 1 warn  |
| 8   | `src/lib/server/agent/tool-execution/adapters/mcp-adapter.ts`       | 9     | 3 log, 4 error, 2 warn  |
| 9   | `src/lib/server/websockets.ts`                                      | 7     | 3 log, 3 error, 1 warn  |
| 10  | `src/lib/server/hardware/detection/serial-detector.ts`              | 7     | 4 log, 2 error, 1 warn  |
| 11  | `src/lib/server/agent/tool-execution/executor.ts`                   | 7     | 2 log, 3 error, 2 warn  |
| 12  | `src/lib/server/kismet/serviceManager.ts`                           | 6     | 3 log, 2 error, 1 warn  |
| 13  | `src/lib/server/db/migrations/runMigrations.ts`                     | 6     | 4 log, 2 error          |
| 14  | `src/lib/server/websocket-server.ts`                                | 5     | 2 log, 2 error, 1 warn  |
| 15  | `src/lib/server/gsm-database-path.ts`                               | 5     | 3 log, 2 error          |
| 16  | `src/lib/server/mcp/dynamic-server.ts`                              | 4     | 2 log, 1 error, 1 warn  |
| 17  | `src/lib/server/agent/tool-execution/adapters/internal-adapter.ts`  | 4     | 1 log, 2 error, 1 warn  |
| 18  | `src/lib/server/mcp/config-generator.ts`                            | 3     | 2 log, 1 error          |
| 19  | `src/lib/server/hardware/hardware-registry.ts`                      | 3     | 2 log, 1 error          |
| 20  | `src/lib/server/agent/tool-execution/registry.ts`                   | 3     | 2 log, 1 error          |
| 21  | `src/lib/server/agent/tool-execution/detection/docker-detector.ts`  | 3     | 2 log, 1 error          |
| 22  | `src/lib/server/agent/tool-execution/adapters/websocket-adapter.ts` | 3     | 1 log, 1 error, 1 warn  |
| 23  | `src/lib/server/agent/tool-execution/adapters/http-adapter.ts`      | 3     | 1 log, 1 error, 1 warn  |
| 24  | `src/lib/server/agent/tool-execution/adapters/cli-adapter.ts`       | 3     | 1 log, 1 error, 1 warn  |
| 25  | `src/lib/server/mcp/server.ts`                                      | 2     | 1 log, 1 error          |
| 26  | `src/lib/server/kismet/scriptManager.ts`                            | 2     | 1 log, 1 error          |
| 27  | `src/lib/server/kismet/kismetProxy.ts`                              | 2     | 1 error, 1 warn         |
| 28  | `src/lib/server/hardware/detection/usb-detector.ts`                 | 2     | 1 log, 1 error          |
| 29  | `src/lib/server/hardware/detection/network-detector.ts`             | 2     | 1 error, 1 warn         |
| 30  | `src/lib/server/gnuradio/spectrum_analyzer.ts`                      | 2     | 1 log, 1 error          |
| 31  | `src/lib/server/agent/tool-execution/detection/service-detector.ts` | 2     | 1 log, 1 error          |
| 32  | `src/lib/server/agent/tool-execution/detection/tool-mapper.ts`      | 1     | 1 error                 |
| 33  | `src/lib/server/agent/tool-execution/detection/binary-detector.ts`  | 1     | 1 log                   |
| 34  | `src/lib/server/agent/runtime.ts`                                   | 1     | 1 error                 |

**Commit**: `fix(logging): migrate console.* to structured logger -- batch 1 (server core, 34 files)`

**Verification**:

```bash
grep -rn "console\.\(log\|warn\|error\|info\|debug\|trace\)" src/lib/server/ --include="*.ts" | grep -v logger.ts | wc -l
# Expected: 0
```

### Batch 2: `src/routes/api/` (.ts only) -- 75 files, 225 statements

| #   | File                                   | Count | #     | File                             | Count |
| --- | -------------------------------------- | ----- | ----- | -------------------------------- | ----- |
| 1   | `gsm-evil/scan/+server.ts`             | 17    | 26    | `hardware/scan/+server.ts`       | 2     |
| 2   | `gsm-evil/control/+server.ts`          | 14    | 27    | `hackrf/[...path]/+server.ts`    | 2     |
| 3   | `kismet/start/+server.ts`              | 12    | 28    | `hackrf/cleanup/+server.ts`      | 2     |
| 4   | `rf/start-sweep/+server.ts`            | 10    | 29    | `db/cleanup/+server.ts`          | 2     |
| 5   | `kismet/control/+server.ts`            | 10    | 30    | `cell-towers/nearby/+server.ts`  | 2     |
| 6   | `hackrf/start-sweep/+server.ts`        | 10    | 31-75 | (41 files with 1 statement each) | 41    |
| 7   | `kismet/stop/+server.ts`               | 9     |       |                                  |       |
| 8   | `hackrf/debug-start/+server.ts`        | 9     |       |                                  |       |
| 9   | `gsm-evil/tower-location/+server.ts`   | 8     |       |                                  |       |
| 10  | `signals/+server.ts`                   | 7     |       |                                  |       |
| 11  | `hackrf/test-sweep/+server.ts`         | 7     |       |                                  |       |
| 12  | `rf/usrp-power/+server.ts`             | 6     |       |                                  |       |
| 13  | `droneid/+server.ts`                   | 5     |       |                                  |       |
| 14  | `agent/stream/+server.ts`              | 5     |       |                                  |       |
| 15  | `system/info/+server.ts`               | 4     |       |                                  |       |
| 16  | `rtl-433/control/+server.ts`           | 4     |       |                                  |       |
| 17  | `kismet/proxy/[...path]/+server.ts`    | 4     |       |                                  |       |
| 18  | `hackrf/test-device/+server.ts`        | 4     |       |                                  |       |
| 19  | `gsm-evil/intelligent-scan/+server.ts` | 4     |       |                                  |       |
| 20  | `agent/tools/+server.ts`               | 4     |       |                                  |       |
| 21  | `tools/execute/+server.ts`             | 3     |       |                                  |       |
| 22  | `signals/batch/+server.ts`             | 3     |       |                                  |       |
| 23  | `gsm-evil/health/+server.ts`           | 3     |       |                                  |       |
| 24  | `tools/scan/+server.ts`                | 2     |       |                                  |       |
| 25  | `rf/data-stream/+server.ts`            | 2     |       |                                  |       |

**Commit**: `fix(logging): migrate console.* to structured logger -- batch 2 (API routes, 75 files)`

**Verification**:

```bash
grep -rn "console\.\(log\|warn\|error\|info\|debug\|trace\)" src/routes/api/ --include="*.ts" | wc -l
# Expected: 0
```

### Batch 3: `src/lib/services/` (.ts only) -- 23 files, 124 statements

| #   | File                                        | Count |
| --- | ------------------------------------------- | ----- |
| 1   | `websocket/test-connection.ts`              | 21    |
| 2   | `usrp/api.ts`                               | 16    |
| 3   | `localization/coral/CoralAccelerator.v2.ts` | 13    |
| 4   | `kismet/kismetService.ts`                   | 13    |
| 5   | `websocket/base.ts`                         | 12    |
| 6   | `websocket/hackrf.ts`                       | 10    |
| 7   | `localization/coral/CoralAccelerator.ts`    | 5     |
| 8   | `websocket/kismet.ts`                       | 4     |
| 9   | `tactical-map/kismetService.ts`             | 4     |
| 10  | `map/kismetRSSIService.ts`                  | 4     |
| 11  | `map/gridProcessor.ts`                      | 3     |
| 12  | `localization/HybridRSSILocalizer.ts`       | 3     |
| 13  | `tactical-map/systemService.ts`             | 2     |
| 14  | `streaming/dataStreamManager.ts`            | 2     |
| 15  | `monitoring/systemHealth.ts`                | 2     |
| 16  | `map/heatmapService.ts`                     | 2     |
| 17  | `localization/coral/integration-example.ts` | 2     |
| 18  | `tactical-map/hackrfService.ts`             | 1     |
| 19  | `tactical-map/gpsService.ts`                | 1     |
| 20  | `map/webglHeatmapRenderer.ts`               | 1     |
| 21  | `map/signalInterpolation.ts`                | 1     |
| 22  | `hackrf/hackrfService.ts`                   | 1     |
| 23  | `gsm-evil/server.ts`                        | 1     |

**Note**: `websocket/test-connection.ts` has 21 statements but may be deleted in Phase 0 (orphaned file). If it survives Phase 0, migrate it. If deleted, batch count drops to 103.

**Commit**: `fix(logging): migrate console.* to structured logger -- batch 3 (services, 23 files)`

### Batch 4: `src/lib/stores/` (.ts only) -- 4 files, 10 statements

| #   | File                         | Count |
| --- | ---------------------------- | ----- |
| 1   | `rtl433Store.ts`             | 4     |
| 2   | `gsmEvilStore.ts`            | 4     |
| 3   | `usrp.ts`                    | 1     |
| 4   | `dashboard/terminalStore.ts` | 1     |

**Commit**: `fix(logging): migrate console.* to structured logger -- batch 4 (stores, 4 files)`

### Batch 5: `src/lib/components/` (.svelte + .ts) -- 14 files, 46 statements

| #   | File                                         | Count |
| --- | -------------------------------------------- | ----- |
| 1   | `map/AirSignalOverlay.svelte`                | 21    |
| 2   | `tactical-map/map/MarkerManager.svelte`      | 3     |
| 3   | `kismet/ServiceControl.svelte`               | 3     |
| 4   | `kismet/GPSStatusButton.svelte`              | 3     |
| 5   | `hackrf/SweepControl.svelte`                 | 3     |
| 6   | `dashboard/TerminalTabContent.svelte`        | 3     |
| 7   | `kismet/DataSourceModal.svelte`              | 2     |
| 8   | `dashboard/frontendToolExecutor.ts`          | 2     |
| 9   | `tactical-map/system/SystemInfoPopup.svelte` | 1     |
| 10  | `tactical-map/map/MapContainer.svelte`       | 1     |
| 11  | `map/KismetDashboardOverlay.svelte`          | 1     |
| 12  | `hackrf/TimeWindowControl.svelte`            | 1     |
| 13  | `hackrf/ConnectionStatus.svelte`             | 1     |
| 14  | `hackrf/AnalysisTools.svelte`                | 1     |

**Note on Svelte imports**: In `.svelte` files, use the same `$lib/utils/logger` import path. The logger works in both SSR and CSR contexts after the Defect 2 fix.

**Commit**: `fix(logging): migrate console.* to structured logger -- batch 5 (components, 14 files)`

### Batch 6: `src/routes/` pages (non-API, .svelte + .ts) -- 15 files, 107 statements

| #   | File                                             | Count |
| --- | ------------------------------------------------ | ----- |
| 1   | `rfsweep/+page.svelte`                           | 21    |
| 2   | `tactical-map-simple/+page.svelte`               | 20    |
| 3   | `kismet/+page.svelte`                            | 17    |
| 4   | `gsm-evil/+page.svelte`                          | 17    |
| 5   | `droneid/+page.svelte`                           | 10    |
| 6   | `rtl-433/+page.svelte`                           | 7     |
| 7   | `redesign/+page.svelte`                          | 4     |
| 8   | `tactical-map-simple/rssi-integration.ts`        | 3     |
| 9   | `gsm-evil/LocalIMSIDisplay.svelte`               | 2     |
| 10  | `viewspectrum/+page.svelte`                      | 1     |
| 11  | `test-hackrf-stop/+page.svelte`                  | 1     |
| 12  | `test-db-client/+page.svelte`                    | 1     |
| 13  | `tactical-map-simple/integration-example.svelte` | 1     |
| 14  | `kismet-dashboard/+page.svelte`                  | 1     |
| 15  | `hackrfsweep/+page.svelte`                       | 1     |

**Commit**: `fix(logging): migrate console.* to structured logger -- batch 6 (pages, 15 files)`

### Batch 7: Remaining -- 1 file, 1 statement

| #   | File                                    | Count |
| --- | --------------------------------------- | ----- |
| 1   | `src/lib/hardware/usrp-verification.ts` | 1     |

**Note**: `src/lib/config/logging.ts` (1 statement) is deleted in Subtask 3.1.1. `src/lib/utils/logger.ts` (4 statements) is excluded.

**Commit**: `fix(logging): migrate console.* to structured logger -- batch 7 (remaining, 1 file)`

### Per-Batch Procedure (Applies to ALL 7 Batches)

1. For each file in the batch:
   a. Add `import { logInfo, logError, logWarn, logDebug } from '$lib/utils/logger';` (import only used functions)
   b. Replace each `console.*` call per the Semantic Log Level Mapping Rule above
   c. For `console.error('msg', err)` patterns, use `logError('msg', { error: String(err) })`
   d. For `console.log('msg', data)` patterns, use `logInfo('msg', { data })` (or `logError` if the message indicates failure)
2. Run `npm run typecheck` -- must pass
3. Run `npm run lint` -- must pass
4. Run `npm run test:unit` -- must pass (if tests exist for affected files)
5. Commit the batch

---

## Subtask 3.1.5: Enable ESLint `no-console: error`

**After ALL 7 batches are complete and verified.**

**File**: `config/eslint.config.js`, line 77

**Change**:

```javascript
// BEFORE:
'no-console': ['warn', { allow: ['warn', 'error'] }]

// AFTER:
'no-console': ['error', { allow: [] }]
```

**Exception handling for `validate-env.js`**: This file is `.js` (not `.ts`) and is in Block 2 of the ESLint config which does NOT have the `no-console` rule. It is naturally excluded. Verify:

```bash
npx eslint --no-eslintrc -c config/eslint.config.js src/lib/server/validate-env.js 2>&1 | grep "no-console"
# Expected: no output (rule doesn't apply to .js files in this config)
```

**Exception handling for `logger.ts`**: After Defect 2 fix, logger.ts uses `console.log`, `console.debug`, `console.error`, `console.warn`. Each call needs `// eslint-disable-next-line no-console` (4 inline disables total).

**Commit**: `build(eslint): escalate no-console from warn to error with zero exemptions`

**Verification**:

```bash
npm run lint 2>&1 | grep "no-console" | wc -l
# Expected: 0
```

---

## Verification Checklist (Phase 3.1 Complete)

| #   | Check                                | Command                                                                                                                                      | Expected                                 |
| --- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| 1   | Logger uses globalThis singleton     | `grep -n "globalThis" src/lib/utils/logger.ts \| wc -l`                                                                                      | 2+                                       |
| 2   | Logger routes INFO to console.log    | `grep -n "console\.log" src/lib/utils/logger.ts \| wc -l`                                                                                    | 1                                        |
| 3   | Logger routes DEBUG to console.debug | `grep -n "console\.debug" src/lib/utils/logger.ts \| wc -l`                                                                                  | 1                                        |
| 4   | No console.\* in server code         | `grep -rn "console\.\(log\|warn\|error\|info\|debug\|trace\)" src/lib/server/ --include="*.ts" \| grep -v logger.ts \| wc -l`                | 0                                        |
| 5   | No console.\* in API routes          | `grep -rn "console\.\(log\|warn\|error\|info\|debug\|trace\)" src/routes/api/ --include="*.ts" \| wc -l`                                     | 0                                        |
| 6   | No console.\* in services            | `grep -rn "console\.\(log\|warn\|error\|info\|debug\|trace\)" src/lib/services/ --include="*.ts" \| wc -l`                                   | 0                                        |
| 7   | No console.\* in stores              | `grep -rn "console\.\(log\|warn\|error\|info\|debug\|trace\)" src/lib/stores/ --include="*.ts" \| wc -l`                                     | 0                                        |
| 8   | No console.\* in components          | `grep -rn "console\.\(log\|warn\|error\|info\|debug\|trace\)" src/lib/components/ --include="*.ts" --include="*.svelte" \| wc -l`            | 0                                        |
| 9   | No console.\* in pages               | `grep -rn "console\.\(log\|warn\|error\|info\|debug\|trace\)" src/routes/ --include="*.svelte" --include="*.ts" \| grep -v "/api/" \| wc -l` | 0                                        |
| 10  | ESLint no-console is error           | `grep "no-console" config/eslint.config.js`                                                                                                  | `'no-console': ['error', { allow: [] }]` |
| 11  | No commented-out console.\*          | `grep -rn --include="*.ts" --include="*.svelte" -E '^\s*//' src/ \| grep -E 'console\.(log\|warn\|error\|info\|debug\|trace)' \| wc -l`      | 0                                        |
| 12  | TypeScript compiles                  | `npm run typecheck`                                                                                                                          | Exit 0                                   |
| 13  | Build succeeds                       | `npm run build`                                                                                                                              | Exit 0                                   |
| 14  | Unit tests pass                      | `npm run test:unit`                                                                                                                          | Exit 0                                   |
| 15  | Lint passes                          | `npm run lint`                                                                                                                               | Exit 0, 0 errors                         |
| 16  | logging.ts deleted                   | `test -f src/lib/config/logging.ts && echo EXISTS \|\| echo DELETED`                                                                         | DELETED                                  |

---

## Risk Assessment

| Risk                                               | Likelihood | Impact | Mitigation                                                    |
| -------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------- |
| Logger globalThis change breaks tests              | LOW        | LOW    | All tests use the same global; singleton behavior unchanged   |
| console.log routing change alters browser output   | LOW        | LOW    | Output content identical; only console level changes          |
| Svelte SSR context lacks console.debug             | VERY LOW   | LOW    | All browsers and Node.js support console.debug                |
| Misleveled migration (logInfo for error condition) | MEDIUM     | MEDIUM | Semantic mapping rule + 9 known mislevels identified          |
| validate-env.js triggers lint errors               | LOW        | LOW    | .js files excluded from no-console rule in current config     |
| Phase 0 deletes files listed here                  | LOW        | LOW    | Only test-connection.ts is a candidate; batch 3 count adjusts |

---

## Dependencies

- **Phase 0**: May delete `src/lib/services/websocket/test-connection.ts` (21 console.\* calls). If deleted before Phase 3.1, batch 3 count drops from 124 to 103.
- **Phase 1**: May remove dead code containing some console.\* calls, reducing batch counts slightly.
- **Phase 3.2**: Depends on logger migration being complete (constants referenced in log messages should use named constants).
- **Phase 3.3**: Depends on ESLint no-console escalation being in place before adding additional rules.
