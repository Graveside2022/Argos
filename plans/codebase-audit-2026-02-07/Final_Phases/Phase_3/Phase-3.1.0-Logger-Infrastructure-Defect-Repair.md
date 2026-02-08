# Phase 3.1.0: Logger Infrastructure Defect Repair

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: BARR-C Rule 8.7 (no side effects in debug code), NASA/JPL Rule 14 (check return values), CERT ERR00-C (adopt consistent error handling)
**Review Panel**: US Cyber Command Engineering Review Board

---

**Phase**: 3 -- Code Quality, Constants, Linting, and Defensive Coding
**Sub-Phase**: 3.1 -- Logger Infrastructure Repair and Migration
**Task ID**: 3.1.0
**Risk Level**: MEDIUM -- Infrastructure defects in the logger must be fixed before any migration begins
**Prerequisites**: Phase 0 (Code Organization) complete, Phase 1 (Zero-Risk Cleanup) complete
**Blocks**: ALL other Phase 3.1 tasks (3.1.1 through 3.1.8)
**Estimated Files Touched**: 2 (`src/lib/utils/logger.ts`, `src/lib/config/logging.ts` -- deleted)
**Standards**: BARR-C Rule 8.7 (no side effects in debug code), NASA/JPL Rule 14 (check return values), CERT ERR00-C (consistent error handling)

---

## Objective

Repair 6 verified defects in the logger at `src/lib/utils/logger.ts` before migrating 170 files to use it. Migrating at scale to a broken logger would propagate defects across the entire codebase.

## Current State Assessment

| Metric                          | Verified Value                | Target                    | Verification Command                                                                                    |
| ------------------------------- | ----------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------- |
| Logger singleton HMR safety     | UNSAFE (module-scoped static) | Safe (globalThis-guarded) | Manual inspection of `src/lib/utils/logger.ts`                                                          |
| `configureLogging()` call sites | 0 (dead function)             | 1 (app init) or removed   | `grep -rn "configureLogging" src/ --include="*.ts" \| wc -l`                                            |
| Files importing logger (static) | 43 unique files               | 170 files                 | `grep -rn "from.*logger" src/ --include="*.ts" --include="*.svelte" \| cut -d: -f1 \| sort -u \| wc -l` |

## Scope

This task covers exactly 6 defects in `src/lib/utils/logger.ts` and the deletion of one dead file (`src/lib/config/logging.ts`). No other files are modified. No console statements are migrated in this task -- that begins in Phase 3.1.1.

---

## Execution Steps

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

---

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

---

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

---

### Defect 4: `configureLogging()` Is Never Called

**File**: `src/lib/config/logging.ts`
**Root Cause**: The function `configureLogging()` reads `process.env.LOG_LEVEL` and configures the logger, but grep confirms zero call sites exist. The logger falls back to its constructor defaults.
**Fix**: Either (a) call `configureLogging()` from `src/hooks.server.ts` at startup, or (b) move the environment-reading logic into the Logger constructor itself. Option (b) is simpler and eliminates the dead `logging.ts` file.

**Recommended**: Option (b). Move the 3-line env check into the Logger constructor, delete `src/lib/config/logging.ts`.

**Action**:

1. Copy the `process.env.LOG_LEVEL` reading logic from `logging.ts` into the Logger constructor in `logger.ts`
2. Delete `src/lib/config/logging.ts`
3. Verify no imports reference the deleted file: `grep -rn "from.*config/logging" src/ --include="*.ts" | wc -l` -- expected: 0

---

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

---

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

---

## Commit Message

```
fix(logging): repair 6 logger infrastructure defects before migration

- Fix HMR singleton leak using globalThis guard
- Route INFO->console.log, DEBUG->console.debug (was all console.warn)
- Fix totalLogged counter (was always reporting 2*maxSize)
- Integrate configureLogging into constructor, delete dead logging.ts
- Add dispose() method for interval cleanup
- Fix getRecent() chronological ordering after circular buffer wrap

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

## Verification

```bash
# 1. TypeScript compiles
npm run typecheck   # Must exit 0

# 2. Unit tests pass
npm run test:unit   # Must exit 0

# 3. globalThis singleton is in place
grep -n "globalThis" src/lib/utils/logger.ts | wc -l
# Expected: 2+

# 4. INFO routes to console.log
grep -n "console\.log" src/lib/utils/logger.ts | wc -l
# Expected: 1

# 5. DEBUG routes to console.debug
grep -n "console\.debug" src/lib/utils/logger.ts | wc -l
# Expected: 1

# 6. logging.ts deleted
test -f src/lib/config/logging.ts && echo EXISTS || echo DELETED
# Expected: DELETED

# 7. No imports reference deleted file
grep -rn "from.*config/logging" src/ --include="*.ts" | wc -l
# Expected: 0

# 8. dispose() method exists
grep -n "dispose" src/lib/utils/logger.ts | wc -l
# Expected: 1+

# 9. ESLint inline disables present for logger console calls
grep -c "eslint-disable-next-line no-console" src/lib/utils/logger.ts
# Expected: 4
```

## Risk Assessment

| Risk                                             | Likelihood | Impact | Mitigation                                                  |
| ------------------------------------------------ | ---------- | ------ | ----------------------------------------------------------- |
| Logger globalThis change breaks tests            | LOW        | LOW    | All tests use the same global; singleton behavior unchanged |
| console.log routing change alters browser output | LOW        | LOW    | Output content identical; only console level changes        |
| Svelte SSR context lacks console.debug           | VERY LOW   | LOW    | All browsers and Node.js support console.debug              |
| Deleting logging.ts breaks an unknown import     | VERY LOW   | LOW    | Verified 0 import references exist                          |

## Success Criteria

- All 6 defects repaired in `src/lib/utils/logger.ts`
- `src/lib/config/logging.ts` deleted with zero broken imports
- `npm run typecheck` exits 0
- `npm run test:unit` exits 0
- Logger singleton uses `globalThis` pattern
- 4 `eslint-disable-next-line no-console` directives in logger.ts (one per console method)
- `dispose()` method clears the cleanup interval

## Execution Tracking

| Defect | Description                            | Status  | Started | Completed | Verified By |
| ------ | -------------------------------------- | ------- | ------- | --------- | ----------- |
| 1      | HMR Singleton Memory Leak              | PENDING | --      | --        | --          |
| 2      | Non-Error Levels Route to console.warn | PENDING | --      | --        | --          |
| 3      | totalLogged Counter Incorrect          | PENDING | --      | --        | --          |
| 4      | configureLogging() Never Called        | PENDING | --      | --        | --          |
| 5      | No Cleanup/Dispose Method              | PENDING | --      | --        | --          |
| 6      | getRecent() Wrong Order After Wrap     | PENDING | --      | --        | --          |

## Cross-References

- **Blocks**: [Phase 3.1.1](Phase-3.1.1-Commented-Console-Statement-Deletion.md) -- Cannot delete commented console lines until logger is fixed
- **Blocks**: [Phase 3.1.2](Phase-3.1.2-Incomplete-Logger-Migration-Completion.md) -- Cannot complete partial migrations until logger is fixed
- **Blocks**: [Phase 3.1.3](Phase-3.1.3-Batch-Migration-Server-Core.md) through [Phase 3.1.7](Phase-3.1.7-Batch-Migration-Pages-Remaining.md) -- All batch migrations depend on this
- **Blocks**: [Phase 3.1.8](Phase-3.1.8-ESLint-No-Console-Escalation.md) -- ESLint escalation cannot happen until all migrations complete
- **Source**: [Phase 3.1 Master](Phase-3.1-LOGGER-INFRASTRUCTURE-AND-MIGRATION.md) -- Subtask 3.1.1
- **Related**: Phase 1 Memory Leak Fixes -- globalThis singleton pattern established there (sweepManager, WebSocketManager)
