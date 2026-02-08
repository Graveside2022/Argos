# Phase 4.4: Catch Block Migration and Runtime Validation

| Field            | Value                                                 |
| ---------------- | ----------------------------------------------------- |
| Phase            | 4.4                                                   |
| Title            | Catch Block Migration and Runtime Validation          |
| Status           | PLANNED                                               |
| Author           | Alex Thompson (Quantum Software Architect)            |
| Date             | 2026-02-08                                            |
| Risk Level       | LOW (mechanical transformation, no behavioral change) |
| Estimated Effort | 8-12 hours                                            |
| Dependencies     | None (standalone)                                     |

---

## 1. Current State Assessment

### 1.1 Catch Block Inventory (verified 2026-02-08)

| Category                         | Count | Percentage |
| -------------------------------- | ----- | ---------- |
| Total try-catch blocks           | 711   | 100%       |
| Already typed `: unknown`        | 273   | 38.4%      |
| Untyped (implicit `any`)         | 402   | 56.5%      |
| Parameterless `catch {}`         | 35    | 4.9%       |
| Typed `: any` (explicit)         | 1     | 0.1%       |
| `.catch()` inline (out of scope) | 104   | --         |

Verification:

```bash
# Total catch blocks with params
grep -rn 'catch\s*(\s*\w\+' --include='*.ts' --include='*.svelte' src/ | wc -l
# Result: 676

# Parameterless catch
grep -rn 'catch\s*{' --include='*.ts' --include='*.svelte' src/ | wc -l
# Result: 35

# Already typed : unknown
grep -rn 'catch\s*(\s*\w\+\s*:\s*unknown' --include='*.ts' --include='*.svelte' src/ | wc -l
# Result: 273

# Typed : any
grep -rn 'catch\s*(\s*\w\+\s*:\s*any' --include='*.ts' --include='*.svelte' src/ | wc -l
# Result: 1 (src/routes/api/gsm-evil/scan/+server.ts:54)
```

### 1.2 Untyped Catch Distribution by Batch

| Batch | Scope                               | Untyped Catches | Files | Priority |
| ----- | ----------------------------------- | --------------- | ----- | -------- |
| 1     | src/lib/server/                     | 143             | 47    | P0       |
| 2     | src/lib/services/                   | 95              | 25    | P0       |
| 3     | src/routes/api/                     | 80              | 51    | P1       |
| 4     | src/routes/\*.svelte                | 38              | 13    | P2       |
| 5     | src/lib/components/                 | 27              | 18    | P2       |
| 6     | src/lib/stores/                     | 13              | 8     | P2       |
| 7     | src/lib/database/                   | 3               | 2     | P2       |
| 8     | Other (utils, hardware, routes .ts) | 3               | 3     | P2       |
| Total |                                     | 402             | 167   |          |

### 1.3 Existing Error Infrastructure

File: `src/lib/types/errors.ts` (185 lines)

Already provides:

- Interfaces: BaseError, DatabaseError, ApiError, WebSocketError, ValidationError
- Type guards: isDatabaseError(), isApiError(), isWebSocketError(), isValidationError()
- Factory functions: createDatabaseError(), createApiError(), createWebSocketError(), createValidationError()
- Utilities: getErrorProperty(), toError()
- Total exported functions: **10** (verified 2026-02-08)

Missing (required by this plan):

- `getErrorMessage(error: unknown): string` -- safe message extraction
- `isBaseError(error: unknown): error is BaseError` -- general type guard
- `getErrorStack(error: unknown): string | undefined` -- safe stack extraction

### 1.4 Error Access Patterns in Existing Catch Blocks

Analysis of the 402 untyped catch blocks reveals these access patterns:

| Pattern                        | Occurrences | Migration Strategy               |
| ------------------------------ | ----------- | -------------------------------- |
| `instanceof Error` check       | 88          | Keep as-is (valid on unknown)    |
| `.message` property access     | 69          | Replace with getErrorMessage()   |
| `as Error` cast                | 85          | Replace with type guard          |
| String interpolation `${err}`  | 4           | Replace with getErrorMessage()   |
| Pass-through (rethrow/log obj) | 156         | Add `: unknown`, no other change |

### 1.5 JSON.parse Inventory (verified 2026-02-08)

| Category                 | Count |
| ------------------------ | ----- |
| Total JSON.parse calls   | 49    |
| Inside try-catch         | 31    |
| Outside try-catch        | 18    |
| With `as Type` cast only | 19    |
| No validation at all     | 30    |
| Zod-validated            | 0     |

Zod status: installed (v3.25.76), imported in 1 file (`src/lib/server/env.ts`), validates 3 env vars.

### 1.6 Rationale for Explicit `: unknown` Annotation

TypeScript strict mode (`useUnknownInCatchVariables: true`) is enabled in `tsconfig.json`. The
compiler already treats catch variables as `unknown` internally. However, explicit annotation is
required for:

1. **MISRA C++ compliance analog**: Intent must be unambiguous in safety-critical code. Implicit
   compiler behavior is insufficient for audit trail.
2. **Code review clarity**: Reviewers must see the type at the catch site without consulting
   tsconfig.json to understand the variable's type.
3. **Defense in depth**: If tsconfig changes, explicit annotations prevent silent regression to `any`.
4. **Grep-ability**: `catch (error: unknown)` is searchable; implicit typing is invisible.

---

## 2. Execution Order

```
Task 4.4.1  Fix the : any catch block                    [5 min]
Task 4.4.2  Extend errors.ts with getErrorMessage()      [30 min]
Task 4.4.3  Batch 1: Server-side (143 catches, 47 files) [2.5 hr]
Task 4.4.4  Batch 2: Services (95 catches, 25 files)     [2 hr]
Task 4.4.5  Batch 3: API routes (80 catches, 51 files)   [1.5 hr]
Task 4.4.6  Batch 4: Page components (38 catches, 13 files) [1 hr]
Task 4.4.7  Batch 5: UI components (27 catches, 18 files)   [45 min]
           Batch 6: Stores (13 catches, 8 files)           [30 min]
           Batch 7: Database (3 catches, 2 files)          [10 min]
           Batch 8: Other (3 catches, 3 files)             [10 min]
Task 4.4.8  Zod schemas for JSON.parse (49 sites)        [2 hr]
```

Dependencies: Task 4.4.2 must complete before Batches 1-8. Task 4.4.1 is independent.
Task 4.4.8 is independent of all other tasks. Batches 6-8 handle the 19 catches
previously listed as "Other" with no batch assignment (see Section 9B).

---

## 3. Task 4.4.1: Fix the Explicit `: any` Catch Block

**Scope**: 1 occurrence in 1 file.

**File**: `src/routes/api/gsm-evil/scan/+server.ts`
**Line**: 54

### Current Code (lines 50-56)

```typescript
try {
	const testResult = await hostExec(`timeout 4 ${baseCommand}`);
	gsmTestOutput = testResult.stdout + testResult.stderr;
	console.log(`GRGSM test output: ${gsmTestOutput.substring(0, 300)}`);
} catch (testError: any) {
	gsmTestOutput = (testError.stdout || '') + (testError.stderr || '');
}
```

### Target Code

```typescript
try {
	const testResult = await hostExec(`timeout 4 ${baseCommand}`);
	gsmTestOutput = testResult.stdout + testResult.stderr;
	console.log(`GRGSM test output: ${gsmTestOutput.substring(0, 300)}`);
} catch (testError: unknown) {
	const execErr = testError as { stdout?: string; stderr?: string };
	gsmTestOutput = (execErr.stdout || '') + (execErr.stderr || '');
}
```

Note: The `hostExec` rejection object from child_process.exec includes `stdout` and `stderr`
properties. The `as` cast is narrowed to only the properties accessed, not the full Error type.
A more defensive approach would use `instanceof` + property checks, but `hostExec` is an internal
function with a known rejection shape.

### Verification

```bash
# Confirm no : any catch blocks remain
grep -rn 'catch\s*(\s*\w\+\s*:\s*any' --include='*.ts' --include='*.svelte' src/
# Expected: 0 results

# Type check
npx tsc --noEmit --pretty 2>&1 | grep -c 'error TS'
```

---

## 4. Task 4.4.2: Extend errors.ts with getErrorMessage()

**File**: `src/lib/types/errors.ts` (185 lines)
**Action**: Append new utilities after line 185. Do NOT create a new file.

### Additions

```typescript
/**
 * Extract a human-readable error message from an unknown catch variable.
 * Handles Error instances, strings, objects with .message, and fallback to String().
 *
 * Usage in catch blocks:
 *   } catch (error: unknown) {
 *       console.error('Operation failed:', getErrorMessage(error));
 *   }
 */
export function getErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}
	if (typeof error === 'string') {
		return error;
	}
	if (
		typeof error === 'object' &&
		error !== null &&
		'message' in error &&
		typeof (error as { message: unknown }).message === 'string'
	) {
		return (error as { message: string }).message;
	}
	return String(error);
}

/**
 * Type guard for BaseError (Error with optional code/statusCode/details).
 */
export function isBaseError(error: unknown): error is BaseError {
	return error instanceof Error;
}

/**
 * Safely extract stack trace from an unknown error.
 * Returns undefined if the value is not an Error or has no stack.
 */
export function getErrorStack(error: unknown): string | undefined {
	if (error instanceof Error) {
		return error.stack;
	}
	return undefined;
}

/**
 * Type guard for exec/spawn rejection objects with stdout/stderr.
 * Used in catch blocks handling child_process errors.
 */
export function isExecError(error: unknown): error is Error & { stdout: string; stderr: string } {
	return (
		error instanceof Error &&
		'stdout' in error &&
		'stderr' in error &&
		typeof (error as Error & { stdout: unknown }).stdout === 'string' &&
		typeof (error as Error & { stderr: unknown }).stderr === 'string'
	);
}
```

### Relationship to Existing toError()

The existing `toError()` function (line 171) converts unknown to Error objects. The new
`getErrorMessage()` serves a different purpose: it extracts the message string without creating
an Error instance. Both are needed:

- `getErrorMessage(error)` -- for logging and string interpolation
- `toError(error)` -- for rethrowing or passing to error handlers expecting Error
- `isExecError(error)` -- for child_process catch blocks accessing .stdout/.stderr

### Verification

```bash
# Confirm errors.ts compiles
npx tsc --noEmit src/lib/types/errors.ts 2>&1 | head -5

# Confirm exports are accessible
grep -c 'export function' src/lib/types/errors.ts
# Expected: 14 (was 10, now 14 with 4 new)
```

---

## 5. Task 4.4.3: Batch 1 -- Server-side Catch Blocks

**Scope**: 143 untyped catches across 47 files in `src/lib/server/`

### 5.1 Processing Order (descending by catch count)

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

### 5.2 Mechanical Transformation Patterns

Each untyped catch block falls into one of five transformation patterns. Apply the matching
pattern based on how the error variable is used in the catch body.

#### Pattern A: Pass-through (rethrow or log object directly) -- 156 occurrences across all batches

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

Rationale: No property access on `error`. Adding `: unknown` is the only change needed.
`logError` accepts `unknown` via `{ error }` object wrapping.

#### Pattern B: .message access -- 69 occurrences across all batches

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

Decision: Use option 1 (getErrorMessage) when the file already imports from `$lib/types/errors`
or has 3+ catch blocks needing message access. Use option 2 for isolated single-use cases where
adding an import is disproportionate.

#### Pattern C: `as Error` cast -- 85 occurrences across all batches

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

Rationale: Every `(error as Error).message` is an unsafe cast. Replace with `getErrorMessage()`
which handles non-Error throws safely. If additional Error properties beyond `.message` are
accessed (e.g., `.stack`, `.code`), use `toError()` to convert first.

#### Pattern D: String interpolation -- 4 occurrences across all batches

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

Rationale: `${error}` calls `.toString()` on any type, which works at runtime but TypeScript
complains about `unknown` in template literals. `getErrorMessage()` is explicit and returns
the `.message` for Error instances instead of the less useful `Error: <message>` format
from `.toString()`.

#### Pattern E: instanceof check already present -- 88 occurrences across all batches

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

### 5.3 Per-File Verification

After modifying each file, run:

```bash
# Verify no untyped catches remain in this file
grep -n 'catch\s*(\s*[a-zA-Z_][a-zA-Z0-9_]*\s*)' FILE | grep -v ': unknown'
# Expected: 0 results

# Type check the file (fast, single-file)
npx tsc --noEmit --pretty 2>&1 | grep FILE
# Expected: 0 errors referencing this file
```

### 5.4 Batch Completion Verification

```bash
# Confirm 0 untyped catches in src/lib/server/
grep -rn 'catch\s*(\s*[a-zA-Z_][a-zA-Z0-9_]*\s*)' --include='*.ts' src/lib/server/ \
  | grep -v ': unknown' | grep -v ': any' | wc -l
# Expected: 0

# Full type check
npx tsc --noEmit 2>&1 | tail -5
```

---

## 6. Task 4.4.4: Batch 2 -- Service Layer

**Scope**: 95 untyped catches across 25 files in `src/lib/services/`

### 6.1 Processing Order

| Order | File                                                            | Catches |
| ----- | --------------------------------------------------------------- | ------- |
| 1     | src/lib/services/kismet/kismetService.ts                        | 15      |
| 2     | src/lib/services/hackrf/hackrfService.ts                        | 11      |
| 3     | src/lib/services/wigletotak/wigleService.ts                     | 10      |
| 4     | src/lib/services/usrp/sweep-manager/process/ProcessManager.ts   | 6       |
| 5     | src/lib/services/hackrf/sweep-manager/process/ProcessManager.ts | 6       |
| 6     | src/lib/services/websocket/base.ts                              | 5       |
| 7     | src/lib/services/monitoring/systemHealth.ts                     | 5       |
| 8     | src/lib/services/usrp/api.ts                                    | 4       |
| 9     | src/lib/services/api/example-usage.ts                           | 4       |
| 10    | src/lib/services/usrp/sweep-manager/buffer/BufferManager.ts     | 3       |
| 11    | src/lib/services/map/kismetRSSIService.ts                       | 3       |
| 12    | src/lib/services/tactical-map/kismetService.ts                  | 2       |
| 13    | src/lib/services/streaming/dataStreamManager.ts                 | 2       |
| 14    | src/lib/services/serviceInitializer.ts                          | 2       |
| 15    | src/lib/services/recovery/errorRecovery.ts                      | 2       |
| 16    | src/lib/services/map/heatmapService.ts                          | 2       |
| 17    | src/lib/services/localization/coral/CoralAccelerator.v2.ts      | 2       |
| 18    | src/lib/services/localization/coral/CoralAccelerator.ts         | 2       |
| 19    | src/lib/services/hackrf/sweep-manager/buffer/BufferManager.ts   | 2       |
| 20    | src/lib/services/hackrfsweep/controlService.ts                  | 2       |
| 21    | src/lib/services/tactical-map/gpsService.ts                     | 1       |
| 22    | src/lib/services/map/gridProcessor.ts                           | 1       |
| 23    | src/lib/services/localization/HybridRSSILocalizer.ts            | 1       |
| 24    | src/lib/services/gsm-evil/server.ts                             | 1       |
| 25    | src/lib/services/api/config.ts                                  | 1       |

### 6.2 Special Attention: Duplicate File Names

Two files are named `kismetService.ts`:

- `src/lib/services/kismet/kismetService.ts` (15 catches) -- primary Kismet service
- `src/lib/services/tactical-map/kismetService.ts` (2 catches) -- tactical map Kismet adapter

Both must be migrated. When running verification, use full paths, not just filenames.

### 6.3 Batch Completion Verification

```bash
grep -rn 'catch\s*(\s*[a-zA-Z_][a-zA-Z0-9_]*\s*)' --include='*.ts' src/lib/services/ \
  | grep -v ': unknown' | grep -v ': any' | wc -l
# Expected: 0
```

---

## 7. Task 4.4.5: Batch 3 -- API Routes

**Scope**: 80 untyped catches across 51 files in `src/routes/api/`

### 7.1 Processing Order

| Order | File                                                       | Catches |
| ----- | ---------------------------------------------------------- | ------- |
| 1     | src/routes/api/rtl-433/control/+server.ts                  | 7       |
| 2     | src/routes/api/agent/tools/+server.ts                      | 7       |
| 3     | src/routes/api/rf/status/+server.ts                        | 3       |
| 4     | src/routes/api/gsm-evil/intelligent-scan-stream/+server.ts | 3       |
| 5     | src/routes/api/droneid/+server.ts                          | 3       |
| 6     | src/routes/api/tools/execute/+server.ts                    | 2       |
| 7     | src/routes/api/rtl-433/stream/+server.ts                   | 2       |
| 8     | src/routes/api/rf/data-stream/+server.ts                   | 2       |
| 9     | src/routes/api/kismet/stop/+server.ts                      | 2       |
| 10    | src/routes/api/kismet/status/+server.ts                    | 2       |
| 11    | src/routes/api/kismet/start/+server.ts                     | 2       |
| 12    | src/routes/api/hackrf/[...path]/+server.ts                 | 2       |
| 13    | src/routes/api/gsm-evil/tower-location/+server.ts          | 2       |
| 14    | src/routes/api/gsm-evil/health/+server.ts                  | 2       |
| 15    | src/routes/api/cell-towers/nearby/+server.ts               | 2       |
| 16    | src/routes/api/agent/stream/+server.ts                     | 2       |
| 17-51 | (35 files with 1 catch each)                               | 35      |

The 35 single-catch files (in alphabetical order):

- src/routes/api/bettercap/control/+server.ts
- src/routes/api/bettercap/devices/+server.ts
- src/routes/api/bettercap/status/+server.ts
- src/routes/api/btle/control/+server.ts
- src/routes/api/companion/[app]/control/+server.ts
- src/routes/api/debug/spectrum-data/+server.ts
- src/routes/api/gnuradio/status/+server.ts
- src/routes/api/gsm-evil/imsi-data/+server.ts
- src/routes/api/gsm-evil/scan/+server.ts
- src/routes/api/hardware/acquire/+server.ts
- src/routes/api/hardware/force-release/+server.ts
- src/routes/api/hardware/release/+server.ts
- src/routes/api/hardware/scan/+server.ts
- src/routes/api/hardware/status/[hardwareId]/+server.ts
- src/routes/api/kismet/devices/list/+server.ts
- src/routes/api/kismet/devices/stats/+server.ts
- src/routes/api/kismet/interfaces/+server.ts
- src/routes/api/kismet/start-safe/+server.ts
- src/routes/api/kismet/start-with-adapter/+server.ts
- src/routes/api/mcp/+server.ts
- src/routes/api/pagermon/control/+server.ts
- src/routes/api/rf/usrp-power/+server.ts
- src/routes/api/rtl-433/protocols/+server.ts
- src/routes/api/rtl-433/status/+server.ts
- src/routes/api/system/stats/+server.ts
- src/routes/api/terminal/shells/+server.ts
- src/routes/api/tools/scan/+server.ts
- src/routes/api/tools/status/[toolId]/+server.ts
- src/routes/api/wifite/control/+server.ts
- src/routes/api/wifite/targets/+server.ts
- src/routes/api/wireshark/interfaces/+server.ts
- src/routes/api/wireshark/start/+server.ts
- src/routes/api/wireshark/status/+server.ts
- src/routes/api/wireshark/stop/+server.ts
- src/routes/api/ws/+server.ts

### 7.2 API Route Pattern

Most API routes follow this pattern:

BEFORE:

```typescript
export const GET: RequestHandler = async () => {
	try {
		const data = await someOperation();
		return json({ success: true, data });
	} catch (error) {
		console.error('Failed:', error);
		return json({ success: false, error: (error as Error).message }, { status: 500 });
	}
};
```

AFTER:

```typescript
import { getErrorMessage } from '$lib/types/errors';

export const GET: RequestHandler = async () => {
	try {
		const data = await someOperation();
		return json({ success: true, data });
	} catch (error: unknown) {
		console.error('Failed:', error);
		return json({ success: false, error: getErrorMessage(error) }, { status: 500 });
	}
};
```

### 7.3 Batch Completion Verification

```bash
grep -rn 'catch\s*(\s*[a-zA-Z_][a-zA-Z0-9_]*\s*)' --include='*.ts' src/routes/api/ \
  | grep -v ': unknown' | grep -v ': any' | wc -l
# Expected: 0
```

---

## 8. Task 4.4.6: Batch 4 -- Page Components

**Scope**: 38 untyped catches across 13 Svelte files in `src/routes/`

### 8.1 Processing Order

| Order | File                                                      | Catches |
| ----- | --------------------------------------------------------- | ------- |
| 1     | src/routes/tactical-map-simple/+page.svelte               | 8       |
| 2     | src/routes/gsm-evil/+page.svelte                          | 7       |
| 3     | src/routes/rtl-433/+page.svelte                           | 5       |
| 4     | src/routes/rfsweep/+page.svelte                           | 4       |
| 5     | src/routes/viewspectrum/+page.svelte                      | 3       |
| 6     | src/routes/droneid/+page.svelte                           | 3       |
| 7     | src/routes/hackrfsweep/+page.svelte                       | 2       |
| 8     | src/routes/test-db-client/+page.svelte                    | 1       |
| 9     | src/routes/tactical-map-simple/integration-example.svelte | 1       |
| 10    | src/routes/kismet/+page.svelte                            | 1       |
| 11    | src/routes/kismet-dashboard/+page.svelte                  | 1       |
| 12    | src/routes/hackrf/+page.svelte                            | 1       |
| 13    | src/routes/gsm-evil/LocalIMSIDisplay.svelte               | 1       |

### 8.2 Svelte-Specific Considerations

In `.svelte` files, TypeScript runs in the `<script lang="ts">` block. The import path uses
`$lib/types/errors` (SvelteKit alias). Catch blocks inside reactive statements (`$:`) and
event handlers follow the same transformation patterns as TypeScript files.

### 8.3 Batch Completion Verification

```bash
grep -rn 'catch\s*(\s*[a-zA-Z_][a-zA-Z0-9_]*\s*)' --include='*.svelte' src/routes/ \
  | grep -v ': unknown' | grep -v ': any' | wc -l
# Expected: 0
```

---

## 9. Task 4.4.7: Batch 5 -- UI Components

**Scope**: 27 untyped catches across 18 files in `src/lib/components/`

### 9.1 Processing Order

| Order | File                                                              | Catches |
| ----- | ----------------------------------------------------------------- | ------- |
| 1     | src/lib/components/wigletotak/directory/DirectoryCard.svelte      | 3       |
| 2     | src/lib/components/tactical-map/map/MarkerManager.svelte          | 3       |
| 3     | src/lib/components/hackrf/SweepControl.svelte                     | 3       |
| 4     | src/lib/components/wigletotak/settings/TAKSettingsCard.svelte     | 2       |
| 5     | src/lib/components/wigletotak/settings/AntennaSettingsCard.svelte | 2       |
| 6     | src/lib/components/hackrfsweep/control/SweepControls.svelte       | 2       |
| 7     | src/lib/components/wigletotak/settings/AnalysisModeCard.svelte    | 1       |
| 8     | src/lib/components/wigletotak/filter/WhitelistCard.svelte         | 1       |
| 9     | src/lib/components/wigletotak/filter/BlacklistCard.svelte         | 1       |
| 10    | src/lib/components/tactical-map/system/SystemInfoPopup.svelte     | 1       |
| 11    | src/lib/components/tactical-map/map/MapContainer.svelte           | 1       |
| 12    | src/lib/components/map/KismetDashboardOverlay.svelte              | 1       |
| 13    | src/lib/components/map/AirSignalOverlay.svelte                    | 1       |
| 14    | src/lib/components/kismet/DataSourceModal.svelte                  | 1       |
| 15    | src/lib/components/hackrf/ConnectionStatus.svelte                 | 1       |
| 16    | src/lib/components/hackrf/AnalysisTools.svelte                    | 1       |
| 17    | src/lib/components/dashboard/frontendToolExecutor.ts              | 1       |
| 18    | src/lib/components/dashboard/AgentChatPanel.svelte                | 1       |

### 9.2 Batch Completion Verification

```bash
grep -rn 'catch\s*(\s*[a-zA-Z_][a-zA-Z0-9_]*\s*)' --include='*.ts' --include='*.svelte' \
  src/lib/components/ | grep -v ': unknown' | grep -v ': any' | wc -l
# Expected: 0
```

---

## 9B. Batches 6-8: Remaining 19 Untyped Catches (Stores, Database, Other)

**Added by verification audit 2026-02-08 (MEDIUM-3 resolution)**

The original plan's 5 batches accounted for 383 of 402 untyped catches. The remaining
19 catches in "Other" locations were unassigned. These are now assigned to 3 additional
batches.

### Batch 6: src/lib/stores/ (13 catches across 8 files)

| Order | File                             | Catches | Lines         |
| ----- | -------------------------------- | :-----: | ------------- |
| 1     | src/lib/stores/hardwareStore.ts  |    3    | 101, 121, 140 |
| 2     | src/lib/stores/companionStore.ts |    2    | 66, 86        |
| 3     | src/lib/stores/rtl433Store.ts    |    2    | 86, 104       |
| 4     | src/lib/stores/gsmEvilStore.ts   |    2    | 95, 113       |
| 5     | src/lib/stores/pagermonStore.ts  |    1    | 89            |
| 6     | src/lib/stores/btleStore.ts      |    1    | 82            |
| 7     | src/lib/stores/wifiteStore.ts    |    1    | 155           |
| 8     | src/lib/stores/bettercapStore.ts |    1    | 95            |

All store catch blocks follow Pattern A (pass-through) or Pattern B (.message access).
Apply the same transformation as Batches 1-5.

**Batch Verification**:

```bash
grep -rn 'catch\s*(\s*[a-zA-Z_][a-zA-Z0-9_]*\s*)' --include='*.ts' src/lib/stores/ \
  | grep -v ': unknown' | grep -v ': any' | wc -l
# Expected: 0
```

### Batch 7: src/lib/database/ (3 catches across 2 files)

| Order | File                           | Catches | Lines  |
| ----- | ------------------------------ | :-----: | ------ |
| 1     | src/lib/database/dal.ts        |    1    | 102    |
| 2     | src/lib/database/migrations.ts |    2    | 43, 65 |

### Batch 8: Other locations (3 catches across 3 files)

| Order | File                                               | Catches | Lines |
| ----- | -------------------------------------------------- | :-----: | ----- |
| 1     | src/lib/utils/mgrsConverter.ts                     |    1    | 24    |
| 2     | src/lib/hardware/usrp-verification.ts              |    1    | 23    |
| 3     | src/routes/tactical-map-simple/rssi-integration.ts |    1    | 143   |

### Batch 6-8 Completion Verification

```bash
# Confirm 0 untyped catches remain ANYWHERE in src/
grep -rn 'catch\s*(\s*[a-zA-Z_][a-zA-Z0-9_]*\s*)' --include='*.ts' --include='*.svelte' src/ \
  | grep -v ': unknown' | grep -v ': any' | wc -l
# MUST BE: 0
```

---

## 10. Task 4.4.8: Zod Schemas for JSON.parse Validation

**Scope**: 49 JSON.parse call sites, 0 currently validated with Zod.

### 10.1 Schema Directory Structure

Create `src/lib/schemas/` with domain-specific schema files:

```
src/lib/schemas/
  index.ts              -- barrel re-exports
  websocket.ts          -- WebSocket message schemas
  hackrf.ts             -- HackRF data/status/config schemas
  usrp.ts               -- USRP data schemas
  kismet.ts             -- Kismet message schemas
  gsm.ts                -- GSM/IMSI data schemas
  gps.ts                -- GPS position schemas
  rtl433.ts             -- RTL-433 signal schemas
  system.ts             -- System stats, hardware details
  agent.ts              -- Agent event schemas
```

### 10.2 Priority Tiers

**Tier 1 -- Security-Critical (parse external/user-influenced data)**

These JSON.parse calls process data from external sources (network, hardware, child processes)
where malformed input could crash the application or cause undefined behavior.

| #   | File                                                              | Line | Source             | Schema Needed      |
| --- | ----------------------------------------------------------------- | ---- | ------------------ | ------------------ |
| 1   | src/lib/server/websocket-server.ts                                | 71   | WebSocket client   | WebSocketMessage   |
| 2   | src/lib/server/kismet/webSocketManager.ts                         | 409  | WebSocket client   | ClientMessage      |
| 3   | src/lib/server/kismet/api_client.ts                               | 268  | Kismet SSE stream  | KismetEventData    |
| 4   | src/lib/server/websockets.ts                                      | 71   | WebSocket client   | WebSocketEvent     |
| 5   | src/lib/server/wireshark.ts                                       | 248  | tshark stdout      | PacketArray        |
| 6   | src/lib/server/wireshark.ts                                       | 299  | tshark stdout      | PacketData         |
| 7   | src/routes/api/gps/position/+server.ts                            | 300  | gpsd stream        | GpsdMessage        |
| 8   | src/routes/api/gsm-evil/imsi/+server.ts                           | 42   | shell exec stdout  | ImsiResult         |
| 9   | src/routes/api/gsm-evil/imsi-data/+server.ts                      | 37   | shell exec stdout  | ImsiDataResult     |
| 10  | src/routes/api/tactical-map/cell-towers/+server.ts                | 95   | shell exec stdout  | CellTowerResult    |
| 11  | src/routes/api/hardware/details/+server.ts                        | 269  | lsusb/lspci stdout | HardwareDetailLine |
| 12  | src/lib/server/bettercap/apiClient.ts                             | 32   | shell exec stdout  | BettercapResponse  |
| 13  | src/lib/server/agent/runtime.ts                                   | 154  | SSE stream         | AgentEvent         |
| 14  | src/lib/server/agent/tool-execution/adapters/websocket-adapter.ts | 164  | WS response        | ToolResponse       |
| 15  | src/lib/server/agent/tool-execution/adapters/mcp-adapter.ts       | 158  | MCP response       | McpResult          |

**Tier 2 -- Application-Critical (parse SSE/EventSource data in frontend)**

| #   | File                                                       | Line | Source         | Schema Needed       |
| --- | ---------------------------------------------------------- | ---- | -------------- | ------------------- |
| 1   | src/routes/gsm-evil/+page.svelte                           | 1125 | SSE stream     | GsmScanEvent        |
| 2   | src/routes/rtl-433/+page.svelte                            | 206  | SSE stream     | Rtl433Signal        |
| 3   | src/routes/droneid/+page.svelte                            | 91   | SSE stream     | DroneIdEvent        |
| 4   | src/routes/tactical-map-simple/+page.svelte                | 906  | fetch response | SystemInfo          |
| 5   | src/lib/services/usrp/api.ts                               | 41   | SSE stream     | UsrpSweepData       |
| 6   | src/lib/services/usrp/api.ts                               | 55   | WebSocket msg  | UsrpSweepData       |
| 7   | src/lib/services/usrp/api.ts                               | 65   | SSE stream     | UsrpSweepData       |
| 8   | src/lib/services/hackrf/api.ts                             | 129  | SSE stream     | HackrfSweepData     |
| 9   | src/lib/services/hackrf/api.ts                             | 171  | SSE stream     | HackrfStatus        |
| 10  | src/lib/services/hackrf/api.ts                             | 213  | SSE stream     | HackrfConfig        |
| 11  | src/lib/services/hackrf/api.ts                             | 221  | SSE stream     | HackrfConfigChange  |
| 12  | src/lib/services/hackrf/api.ts                             | 238  | SSE stream     | HackrfRawData       |
| 13  | src/lib/services/hackrf/api.ts                             | 250  | SSE stream     | HackrfRecoveryData  |
| 14  | src/lib/services/gsm-evil/server.ts                        | 136  | SSE stream     | GsmScanEvent        |
| 15  | src/lib/services/websocket/base.ts                         | 222  | WebSocket msg  | Generic (z.unknown) |
| 16  | src/lib/services/localization/coral/CoralAccelerator.v2.ts | 96   | child stdout   | CoralMessage        |
| 17  | src/lib/services/localization/coral/CoralAccelerator.ts    | 43   | child stdout   | CoralMessage        |
| 18  | src/lib/components/dashboard/AgentChatPanel.svelte         | 169  | SSE stream     | AgentChatEvent      |
| 19  | src/lib/components/dashboard/TerminalTabContent.svelte     | 120  | WebSocket msg  | TerminalMessage     |

**Tier 3 -- Low Risk (parse localStorage/config)**

| #   | File                                                        | Line | Source       | Schema Needed       |
| --- | ----------------------------------------------------------- | ---- | ------------ | ------------------- |
| 1   | src/lib/stores/rtl433Store.ts                               | 73   | localStorage | Rtl433StoreState    |
| 2   | src/lib/stores/gsmEvilStore.ts                              | 82   | localStorage | GsmStoreState       |
| 3   | src/lib/stores/dashboard/terminalStore.ts                   | 29   | localStorage | TerminalStoreState  |
| 4   | src/lib/stores/dashboard/toolsStore.ts                      | 14   | localStorage | z.array(z.string()) |
| 5   | src/lib/stores/dashboard/toolsStore.ts                      | 29   | localStorage | z.array(z.string()) |
| 6   | src/lib/server/mcp/config-generator.ts                      | 137  | fs.readFile  | MCPConfiguration    |
| 7   | src/lib/server/db/geo.ts                                    | 78   | DB column    | z.record(z.unknown) |
| 8   | src/lib/server/db/geo.ts                                    | 90   | DB column    | z.record(z.unknown) |
| 9   | src/lib/services/usrp/sweep-manager/buffer/BufferManager.ts | 227  | child stdout | UsrpBufferLine      |

**Note**: 6 entries in `src/lib/services/hackrf/usrp-api.ts` (lines 141, 170, 213, 221, 238, 250)
are exact duplicates of the patterns in `src/lib/services/hackrf/api.ts`. They share the same
schemas once created.

### 10.3 Implementation Pattern

#### Creating a Zod Schema

Example for `src/lib/schemas/websocket.ts`:

```typescript
import { z } from 'zod';

export const WebSocketMessageSchema = z.object({
	type: z.string(),
	data: z.unknown().optional(),
	id: z.string().optional(),
	timestamp: z.number().optional()
});

export type WebSocketMessage = z.infer<typeof WebSocketMessageSchema>;
```

#### Applying at a JSON.parse Site

BEFORE (`src/lib/server/websocket-server.ts:71`):

```typescript
const message = JSON.parse(data.toString()) as WebSocketMessage;
```

AFTER:

```typescript
import { WebSocketMessageSchema } from '$lib/schemas/websocket';

const parsed = JSON.parse(data.toString());
const result = WebSocketMessageSchema.safeParse(parsed);
if (!result.success) {
	console.warn('Invalid WebSocket message:', result.error.format());
	return;
}
const message = result.data;
```

Key rules:

1. Always use `safeParse()`, never `parse()` -- crash-free validation.
2. Log validation failures at `warn` level with `result.error.format()`.
3. Handle the failure path explicitly (return, continue, or use a default value).
4. Replace the `as Type` cast with `result.data` which is fully typed.

#### For Sites Already Inside try-catch

When JSON.parse is already wrapped in try-catch, the Zod validation replaces the `as` cast
but the try-catch remains for the JSON.parse SyntaxError:

```typescript
try {
	const parsed = JSON.parse(data.toString());
	const result = MySchema.safeParse(parsed);
	if (!result.success) {
		console.warn('Invalid data shape:', result.error.format());
		return;
	}
	const message = result.data;
	// ... use message
} catch (error: unknown) {
	console.error('JSON parse failed:', getErrorMessage(error));
}
```

### 10.4 Sites NOT Requiring try-catch Wrapping

The 18 JSON.parse calls currently outside try-catch need wrapping. For each:

1. Wrap the JSON.parse + safeParse in a try-catch with `(error: unknown)`.
2. Handle both JSON.parse SyntaxError and Zod validation failure.

### 10.5 Batch Completion Verification

```bash
# Confirm Zod import count increased from 1
grep -rn "from 'zod'" --include='*.ts' --include='*.svelte' src/ | wc -l
# Expected: >= 10 (schema files + env.ts)

# Confirm schemas directory exists
ls src/lib/schemas/

# Confirm no unguarded JSON.parse with 'as' cast remains
grep -rn 'JSON\.parse.*\bas\b' --include='*.ts' --include='*.svelte' src/ \
  | grep -v 'safeParse' | wc -l
# Expected: 0

# Type check
npx tsc --noEmit 2>&1 | tail -5
```

---

## 11. Risk Assessment

### 11.1 Risk Matrix

| Risk                                                     | Likelihood | Impact | Mitigation                                                                      |
| -------------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------- |
| Type error from adding `: unknown`                       | LOW        | LOW    | Pattern-based transformation; tsc validates                                     |
| Runtime behavior change                                  | NONE       | --     | `: unknown` is annotation-only; no codegen                                      |
| getErrorMessage() returns different string than .message | LOW        | LOW    | toError() preserves .message for Error instances                                |
| Zod schema too strict (rejects valid data)               | MEDIUM     | MEDIUM | Use safeParse + warn, not throw; test with real data                            |
| Zod schema too loose (accepts invalid data)              | LOW        | LOW    | Progressive tightening; start with z.object + z.unknown() for unverified fields |
| Import cycle from errors.ts                              | NONE       | --     | errors.ts has zero imports from project files                                   |
| Performance impact of Zod validation                     | LOW        | LOW    | safeParse adds ~1-5 microseconds per call; negligible vs JSON.parse             |

### 11.2 What This Phase Does NOT Change

- `.catch()` inline callbacks (104 occurrences) -- separate scope
- Parameterless `catch {}` blocks (35 occurrences) -- intentionally error-swallowing, legitimate pattern
- Error handling logic (what happens after catch) -- no behavioral change
- Error classes or factory functions in errors.ts -- only additions
- Runtime behavior of any existing code path -- annotation-only for catch blocks

---

## 12. Verification Checklist

Run each command and confirm the expected output after all tasks are complete.

### 12.1 Zero Untyped Catches

```bash
# Total untyped catch blocks across entire src/
grep -rn 'catch\s*(\s*[a-zA-Z_][a-zA-Z0-9_]*\s*)' --include='*.ts' --include='*.svelte' src/ \
  | grep -v ': unknown' | wc -l
# MUST BE: 0
```

### 12.2 Zero `: any` Catches

```bash
grep -rn 'catch\s*(\s*\w\+\s*:\s*any' --include='*.ts' --include='*.svelte' src/ | wc -l
# MUST BE: 0
```

### 12.3 TypeScript Compiles Clean

```bash
npx tsc --noEmit 2>&1 | grep -c 'error TS'
# MUST BE: 0 (or same as baseline before this phase)
```

### 12.4 getErrorMessage() Exported

```bash
grep 'export function getErrorMessage' src/lib/types/errors.ts
# MUST MATCH: export function getErrorMessage(error: unknown): string
```

### 12.5 Zod Schema Coverage

```bash
# Schema files exist
ls src/lib/schemas/*.ts | wc -l
# MUST BE: >= 10

# JSON.parse sites with 'as' cast (unvalidated) should be 0
grep -rn 'JSON\.parse.*) as ' --include='*.ts' --include='*.svelte' src/ \
  | grep -v node_modules | grep -v safeParse | wc -l
# MUST BE: 0
```

### 12.6 No Regressions

```bash
# Run existing tests
npm run test:unit 2>&1 | tail -10

# Run type checker
npm run typecheck 2>&1 | tail -5

# Lint check (no new warnings from error handling)
npm run lint 2>&1 | grep -c 'error'
```

### 12.7 Catch Block Census (Post-Migration)

```bash
echo "=== Post-Migration Census ==="
echo -n "Total catch with params: "
grep -rn 'catch\s*(\s*\w\+' --include='*.ts' --include='*.svelte' src/ | wc -l
echo -n "Typed : unknown: "
grep -rn 'catch\s*(\s*\w\+\s*:\s*unknown' --include='*.ts' --include='*.svelte' src/ | wc -l
echo -n "Parameterless catch {}: "
grep -rn 'catch\s*{' --include='*.ts' --include='*.svelte' src/ | wc -l
echo -n "Untyped (MUST BE 0): "
grep -rn 'catch\s*(\s*[a-zA-Z_][a-zA-Z0-9_]*\s*)' --include='*.ts' --include='*.svelte' src/ \
  | grep -v ': unknown' | wc -l
# Expected: 676 total, 676 typed unknown, 35 parameterless, 0 untyped
```

---

## 13. Rollback Strategy

### 13.1 Git-Based Rollback

Each batch should be committed as a separate atomic commit:

```
fix: annotate server catch blocks with : unknown (batch 1/5)
fix: annotate service catch blocks with : unknown (batch 2/5)
fix: annotate API route catch blocks with : unknown (batch 3/5)
fix: annotate page component catch blocks with : unknown (batch 4/5)
fix: annotate UI component catch blocks with : unknown (batch 5/5)
feat: add getErrorMessage/isBaseError utilities to errors.ts
feat: add Zod runtime validation schemas for JSON.parse sites
```

To rollback any batch: `git revert <commit-sha>` -- each batch is independent.

### 13.2 Partial Rollback

If a specific file causes issues after migration:

1. `git diff HEAD~1 -- path/to/file.ts` to see exactly what changed
2. `git checkout HEAD~1 -- path/to/file.ts` to restore the single file
3. The file will revert to untyped catches, which is valid TypeScript (just not compliant)

### 13.3 Zod Schema Rollback

If Zod schemas are too strict and reject valid data in production:

1. Replace `safeParse` with `JSON.parse` + `as Type` cast (the previous state)
2. Fix the schema to accept the valid data shape
3. Re-apply the validated version

No data loss is possible because `safeParse` never throws -- it returns `{ success: false }`.

---

## Appendix A: File Count Summary

| Location                      | Untyped Catches | Unique Files | Already Typed | Parameterless |
| ----------------------------- | --------------- | ------------ | ------------- | ------------- |
| src/lib/server/               | 143             | 47           | (n/a)         | (n/a)         |
| src/lib/services/             | 95              | 25           | (n/a)         | (n/a)         |
| src/routes/api/               | 80              | 51           | (n/a)         | (n/a)         |
| src/routes/\*.svelte          | 38              | 13           | (n/a)         | (n/a)         |
| src/lib/components/           | 27              | 18           | (n/a)         | (n/a)         |
| src/lib/stores/               | 13              | 8            | (n/a)         | (n/a)         |
| src/lib/database/             | 3               | 2            | (n/a)         | (n/a)         |
| Other (utils, hw, routes .ts) | 3               | 3            | (n/a)         | (n/a)         |
| **TOTAL**                     | **402**         | **167**      | **273**       | **35**        |

## Appendix B: JSON.parse Site Inventory (49 total)

All 49 sites listed in Section 10.2 across three tiers:

- Tier 1 (Security-Critical): 15 sites
- Tier 2 (Application-Critical): 19 sites
- Tier 3 (Low Risk): 9 sites
- Covered by duplicate schemas (usrp-api.ts mirrors api.ts): 6 sites

Total: 15 + 19 + 9 + 6 = 49

## Appendix C: Parameterless Catch Blocks (35 total, NOT in scope)

These blocks intentionally swallow errors (e.g., "try to parse, ignore failure"). They are
valid TypeScript and do not require migration. Listed for completeness:

```
src/routes/api/agent/status/+server.ts:23,37
src/routes/api/terminal/shells/+server.ts:32
src/lib/stores/dashboard/terminalStore.ts:57
src/lib/stores/dashboard/dashboardStore.ts:15,35
src/lib/server/agent/runtime.ts:82,96,196
src/lib/server/agent/tool-execution/detection/docker-detector.ts:77,102,114
src/lib/server/agent/tool-execution/detection/service-detector.ts:127,139
src/lib/server/agent/tool-execution/detection/binary-detector.ts:35,59,101,116,129
src/lib/server/agent/tool-execution/adapters/websocket-adapter.ts:165
src/lib/server/agent/tool-execution/adapters/mcp-adapter.ts:159
src/lib/server/mcp/dynamic-server.ts:249,352,374
src/lib/server/hardware/detection/usb-detector.ts:279,328
src/lib/server/hardware/detection/serial-detector.ts:95,205
src/lib/components/dashboard/panels/ToolsNavigationView.svelte:97,136
src/lib/components/dashboard/AgentChatPanel.svelte:46,179
src/lib/components/dashboard/TerminalPanel.svelte:35
src/lib/components/dashboard/TerminalTabContent.svelte:90,177
```
