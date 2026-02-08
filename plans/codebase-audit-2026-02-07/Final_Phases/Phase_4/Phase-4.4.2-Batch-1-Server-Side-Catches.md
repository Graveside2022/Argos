# Phase 4.4.2: Batch 1 -- Server-Side Catch Block Migration

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: CERT ERR00-C, MISRA C++ Rule 15-3-4
**Review Panel**: US Cyber Command Engineering Review Board

---

| Field        | Value                                                          |
| ------------ | -------------------------------------------------------------- |
| Phase        | 4.4                                                            |
| Task         | 4.4.2                                                          |
| Title        | Batch 1 -- Server-Side Catch Block Migration                   |
| Status       | PLANNED                                                        |
| Risk Level   | LOW (mechanical transformation, no behavioral change)          |
| Duration     | 2.5 hours                                                      |
| Dependencies | Phase-4.4.1 (errors.ts extensions must be complete)            |
| Commit       | `fix: annotate server catch blocks with : unknown (batch 1/8)` |

---

## Objective

Migrate all 143 untyped catch blocks across 47 files in `src/lib/server/` to explicit `catch (error: unknown)` annotations, applying the appropriate transformation pattern based on error variable usage in each catch body.

## Current State Assessment

- **Untyped catches in scope**: 143
- **Files in scope**: 47
- **Priority**: P0 (server-side code processes external data, highest risk)

## Processing Order (descending by catch count)

| Order | File                                                              | Catches |
| ----- | ----------------------------------------------------------------- | ------- |
| 1     | src/lib/server/kismet/api_client.ts                               | 14      |
| 2     | src/lib/server/kismet/kismet_controller.ts                        | 12      |
| 3     | src/lib/server/kismet/serviceManager.ts                           | 8       |
| 4     | src/lib/server/wireshark.ts                                       | 7       |
| 5     | src/lib/server/hackrf/sweepManager.ts                             | 7       |
| 6     | src/lib/server/hardware/detection/serial-detector.ts              | 6       |
| 7     | src/lib/server/usrp/sweepManager.ts                               | 5       |
| 8     | src/lib/server/hardware/detection/usb-detector.ts                 | 5       |
| 9     | src/lib/server/kismet/wifi_adapter_detector.ts                    | 4       |
| 10    | src/lib/server/kismet/scriptManager.ts                            | 4       |
| 11    | src/lib/server/kismet/device_tracker.ts                           | 4       |
| 12    | src/lib/server/kismet/device_intelligence.ts                      | 4       |
| 13    | src/lib/server/hardware/detection/network-detector.ts             | 4       |
| 14    | src/lib/server/db/cleanupService.ts                               | 4       |
| 15    | src/lib/server/websockets.ts                                      | 3       |
| 16    | src/lib/server/kismet/webSocketManager.ts                         | 3       |
| 17    | src/lib/server/kismet/kismetProxy.ts                              | 3       |
| 18    | src/lib/server/db/signalRepository.ts                             | 3       |
| 19    | src/lib/server/db/migrations/runMigrations.ts                     | 3       |
| 20    | src/lib/server/db/database.ts                                     | 3       |
| 21    | src/lib/server/agent/tool-execution/adapters/mcp-adapter.ts       | 3       |
| 22    | src/lib/server/wifite/processManager.ts                           | 2       |
| 23    | src/lib/server/mcp/dynamic-server.ts                              | 2       |
| 24    | src/lib/server/kismet/security_analyzer.ts                        | 2       |
| 25    | src/lib/server/kismet/alfa_detector.ts                            | 2       |
| 26    | src/lib/server/gnuradio/spectrum_analyzer.ts                      | 2       |
| 27    | src/lib/server/agent/tool-execution/router.ts                     | 2       |
| 28    | src/lib/server/agent/tool-execution/adapters/websocket-adapter.ts | 2       |
| 29    | src/lib/server/agent/runtime.ts                                   | 2       |
| 30    | src/lib/server/websocket-server.ts                                | 1       |
| 31    | src/lib/server/services/kismet.service.ts                         | 1       |
| 32    | src/lib/server/pagermon/processManager.ts                         | 1       |
| 33    | src/lib/server/networkInterfaces.ts                               | 1       |
| 34    | src/lib/server/mcp/server.ts                                      | 1       |
| 35    | src/lib/server/mcp/registry-integration.ts                        | 1       |
| 36    | src/lib/server/mcp/config-generator.ts                            | 1       |
| 37    | src/lib/server/kismet/fusion_controller.ts                        | 1       |
| 38    | src/lib/server/hardware/resourceManager.ts                        | 1       |
| 39    | src/lib/server/db/dbOptimizer.ts                                  | 1       |
| 40    | src/lib/server/companion/launcher.ts                              | 1       |
| 41    | src/lib/server/btle/processManager.ts                             | 1       |
| 42    | src/lib/server/agent/tool-execution/init.ts                       | 1       |
| 43    | src/lib/server/agent/tool-execution/detection/service-detector.ts | 1       |
| 44    | src/lib/server/agent/tool-execution/detection/docker-detector.ts  | 1       |
| 45    | src/lib/server/agent/tool-execution/adapters/internal-adapter.ts  | 1       |
| 46    | src/lib/server/agent/tool-execution/adapters/http-adapter.ts      | 1       |
| 47    | src/lib/server/agent/tool-execution/adapters/cli-adapter.ts       | 1       |

## Mechanical Transformation Patterns

Each untyped catch block falls into one of five transformation patterns. Apply the matching pattern based on how the error variable is used in the catch body.

### Pattern A: Pass-through (rethrow or log object directly) -- 156 occurrences across all batches

BEFORE:

```typescript
} catch (error) {
    logError('Failed to start', { error });
    throw error;
}
```

AFTER:

```typescript
} catch (error: unknown) {
    logError('Failed to start', { error });
    throw error;
}
```

Rationale: No property access on `error`. Adding `: unknown` is the only change needed. `logError` accepts `unknown` via `{ error }` object wrapping.

### Pattern B: .message access -- 69 occurrences across all batches

BEFORE:

```typescript
} catch (error) {
    console.error(`Operation failed: ${error.message}`);
}
```

AFTER (option 1 -- import getErrorMessage):

```typescript
} catch (error: unknown) {
    console.error(`Operation failed: ${getErrorMessage(error)}`);
}
```

AFTER (option 2 -- inline instanceof guard):

```typescript
} catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Operation failed: ${message}`);
}
```

Decision: Use option 1 (getErrorMessage) when the file already imports from `$lib/types/errors` or has 3+ catch blocks needing message access. Use option 2 for isolated single-use cases where adding an import is disproportionate.

### Pattern C: `as Error` cast -- 85 occurrences across all batches

BEFORE:

```typescript
} catch (error) {
    console.log(`Error: ${(error as Error).message}`);
    if ((error as Error).message.includes('not found')) {
        return null;
    }
}
```

AFTER:

```typescript
} catch (error: unknown) {
    const msg = getErrorMessage(error);
    console.log(`Error: ${msg}`);
    if (msg.includes('not found')) {
        return null;
    }
}
```

Rationale: Every `(error as Error).message` is an unsafe cast. Replace with `getErrorMessage()` which handles non-Error throws safely. If additional Error properties beyond `.message` are accessed (e.g., `.stack`, `.code`), use `toError()` to convert first.

### Pattern D: String interpolation -- 4 occurrences across all batches

BEFORE:

```typescript
} catch (error) {
    this._emitError(`Failed to start sweep: ${error}`, 'start_error');
}
```

AFTER:

```typescript
} catch (error: unknown) {
    this._emitError(`Failed to start sweep: ${getErrorMessage(error)}`, 'start_error');
}
```

Rationale: `${error}` calls `.toString()` on any type, which works at runtime but TypeScript complains about `unknown` in template literals. `getErrorMessage()` is explicit and returns the `.message` for Error instances instead of the less useful `Error: <message>` format from `.toString()`.

### Pattern E: instanceof check already present -- 88 occurrences across all batches

BEFORE:

```typescript
} catch (error) {
    if (error instanceof Error) {
        console.error(error.message);
    }
}
```

AFTER:

```typescript
} catch (error: unknown) {
    if (error instanceof Error) {
        console.error(error.message);
    }
}
```

Rationale: `instanceof` checks are valid type narrowing on `unknown`. Only the annotation changes.

## Execution Steps

### Step 1: Verify Prerequisite

```bash
grep -c 'export function getErrorMessage' src/lib/types/errors.ts
# Expected: 1 (Phase-4.4.1 must be complete)
```

### Step 2: Process Each File

For each of the 47 files in processing order:

1. Open the file.
2. Locate each `catch (varName)` without `: unknown` or `: any`.
3. Determine the pattern (A through E) based on how `varName` is used in the body.
4. Apply the matching transformation.
5. Add `import { getErrorMessage } from '$lib/types/errors';` if Pattern B, C, or D is applied and the import does not already exist.
6. Save and proceed to the next file.

### Step 3: Per-File Verification

After modifying each file, run:

```bash
# Verify no untyped catches remain in this file
grep -n 'catch\s*(\s*[a-zA-Z_][a-zA-Z0-9_]*\s*)' FILE | grep -v ': unknown'
# Expected: 0 results

# Type check the file (fast, single-file)
npx tsc --noEmit --pretty 2>&1 | grep FILE
# Expected: 0 errors referencing this file
```

## Verification

### Batch Completion Verification

```bash
# Confirm 0 untyped catches in src/lib/server/
grep -rn 'catch\s*(\s*[a-zA-Z_][a-zA-Z0-9_]*\s*)' --include='*.ts' src/lib/server/ \
  | grep -v ': unknown' | grep -v ': any' | wc -l
# Expected: 0

# Full type check
npx tsc --noEmit 2>&1 | tail -5
```

| #   | Check                         | Command                                                                                                                                 | Expected  |
| --- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| 1   | Zero untyped in server/       | `grep -rn 'catch\s*(\s*[a-zA-Z_][a-zA-Z0-9_]*\s*)' --include='*.ts' src/lib/server/ \| grep -v ': unknown' \| grep -v ': any' \| wc -l` | 0         |
| 2   | TypeScript compiles           | `npx tsc --noEmit 2>&1 \| tail -5`                                                                                                      | No errors |
| 3   | getErrorMessage imports added | `grep -rn "from '\\$lib/types/errors'" --include='*.ts' src/lib/server/ \| wc -l`                                                       | >= 10     |

## Risk Assessment

| Risk                                                     | Likelihood | Impact | Mitigation                                               |
| -------------------------------------------------------- | ---------- | ------ | -------------------------------------------------------- |
| Type error from adding `: unknown`                       | LOW        | LOW    | Pattern-based transformation; tsc validates              |
| Runtime behavior change                                  | NONE       | --     | `: unknown` is annotation-only; no codegen               |
| getErrorMessage() returns different string than .message | LOW        | LOW    | getErrorMessage() preserves .message for Error instances |
| Import cycle from errors.ts                              | NONE       | --     | errors.ts has zero imports from project files            |

## Rollback Strategy

### Git-Based Rollback

```bash
# Revert the entire batch
git revert <batch-1-commit-sha>
```

Each batch is committed as a separate atomic commit: `fix: annotate server catch blocks with : unknown (batch 1/8)`

### Partial Rollback

If a specific file causes issues after migration:

1. `git diff HEAD~1 -- path/to/file.ts` to see exactly what changed
2. `git checkout HEAD~1 -- path/to/file.ts` to restore the single file
3. The file will revert to untyped catches, which is valid TypeScript (just not compliant)

## Out of Scope

The 35 parameterless `catch {}` blocks are intentionally error-swallowing and do NOT require migration. See Phase-4.4.6 Appendix for the full list.

## Cross-References

- **Depends on**: Phase-4.4.1 (errors.ts extensions)
- **Followed by**: Phase-4.4.3 (Batch 2: Services)
- **Related**: Phase 3.3.1 (Error Variable Catch Block Hygiene) -- addresses unused catch variables
- **Source**: Phase 4.4 monolithic plan, Section 5 (Task 4.4.3)
