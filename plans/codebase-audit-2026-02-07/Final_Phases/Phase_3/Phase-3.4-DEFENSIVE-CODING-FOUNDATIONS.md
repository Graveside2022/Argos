# Phase 3.4: Defensive Coding Foundations

**Added**: 2026-02-08 (Corrective Action CA-06 from adversarial audit)
**Risk Level**: LOW-MEDIUM -- Adding validation and assertions, no behavior changes to happy paths
**Prerequisites**: Phase 3.1 (Logger -- assertions log via structured logger), Phase 3.2 (Constants -- validation uses named constants for bounds)
**Estimated Files Touched**: ~60
**Blocks**: Phase 4 (Type Safety), Phase 5 (Architecture Decomposition)
**Standards**: NASA/JPL Rule 5 (runtime assertions), CERT ERR00-C (consistent error handling), MISRA Rule 21.8 (no undefined behavior from invalid input), BARR-C Rule 8.4 (validate all external input)

---

## Rationale

The Phase 3 adversarial audit (2026-02-08) identified two CRITICAL standards gaps that Phase 3.1-3.3 do not address:

1. **Zero runtime assertions in the entire codebase** (NASA/JPL Rule 5 violation). Functions that process GPS coordinates, RF frequencies, and IMSI data accept any value without range validation. Garbage input produces garbage output silently.

2. **Zero schema validation on 38 API route handlers**. Zod is installed as a dependency and used in exactly 1 file. The remaining 37 API routes accept `request.json()` and `url.searchParams` without any validation. 96 of 126 `parseInt`/`parseFloat` calls have no `isNaN` guard.

Additionally, a HIGH-severity gap was identified:

3. **68 `.catch(() => {})` silent error swallowing points** were invisible to Phase 3.3.2's scope (which only targeted `catch(variable)` blocks). These are addressed in the Phase 3.3.2 addendum but the defensive coding policy that prevents future instances belongs here.

These gaps would be the first items flagged in a US Cyber Command code review. A SIGINT system that processes IMSI numbers, GPS coordinates, and RF spectrum data with zero input validation and zero assertions is operating on faith that every upstream data source provides well-formed data.

---

## Current State Assessment (Verified 2026-02-08)

| Metric                                     | Verified Value    | Target                                            | Verification Command                                            |
| ------------------------------------------ | ----------------- | ------------------------------------------------- | --------------------------------------------------------------- |
| `import.*assert` in src/\*.ts              | 0                 | 1 (assertion utility)                             | `grep -rn "import.*assert" src/ --include="*.ts" \| wc -l`      |
| `assert(` calls in src/\*.ts               | 0                 | 50+ (critical functions)                          | `grep -rn "assert(" src/ --include="*.ts" \| wc -l`             |
| API routes with Zod schemas                | 1                 | 38 (all routes with request.json)                 | `grep -rl "z\.\|zod" src/routes/api/ --include="*.ts" \| wc -l` |
| `parseInt`/`parseFloat` with `isNaN` guard | 30 of 126         | 126 of 126                                        | Cross-reference grep results                                    |
| `(error as Error).message` unsafe casts    | ~40               | 0                                                 | `grep -rn "(error as Error)" src/ --include="*.ts" \| wc -l`    |
| `@param` tags on exported functions        | 20 across 5 files | All exported functions in server/ and routes/api/ | `grep -rn "@param" src/ --include="*.ts" \| wc -l`              |
| Formal logging level policy                | Does not exist    | `docs/LOGGING-POLICY.md`                          | `test -f docs/LOGGING-POLICY.md`                                |

---

## Execution Order

```
Task 3.4.1: Create Runtime Assertion Utility
    |
    v
Task 3.4.2: Add Assertions to Critical Data Processing Functions
    |
    v
Task 3.4.3: Create Logging Level Policy Document (PII Handling)
    |
    v
Task 3.4.4: Add Zod Schema Validation to Highest-Risk API Routes (10 routes)
    |
    v
Task 3.4.5: Guard All parseInt/parseFloat Calls with isNaN Checks
    |
    v
Task 3.4.6: Fix Unsafe (error as Error).message Cast Pattern
```

---

## Task 3.4.1: Create Runtime Assertion Utility

**File to create**: `src/lib/utils/assert.ts`

The assertion utility must:

1. Log the assertion failure via the structured logger (Phase 3.1) before throwing
2. Include the assertion expression and context in the error message
3. Be tree-shakeable in production builds if desired (but default to always-on for military deployment)
4. Follow NASA/JPL Rule 5: assertions check conditions that should never be false

```typescript
import { logError } from '$lib/utils/logger';

/**
 * Runtime assertion for conditions that must be true.
 * Logs via structured logger before throwing to ensure
 * assertion failures are captured in log output.
 *
 * NASA/JPL Rule 5: "Use a minimum of two runtime assertions per function."
 *
 * @param condition - The condition that must be true
 * @param message - Description of what was expected
 * @param context - Optional structured context for logging
 * @throws AssertionError if condition is false
 */
export function assert(
	condition: unknown,
	message: string,
	context?: Record<string, unknown>
): asserts condition {
	if (!condition) {
		const error = new Error(`Assertion failed: ${message}`);
		error.name = 'AssertionError';
		logError(`Assertion failed: ${message}`, context);
		throw error;
	}
}

/**
 * Assert that a value is not null or undefined.
 * Returns the value with a narrowed type.
 */
export function assertDefined<T>(value: T | null | undefined, name: string): T {
	assert(value != null, `${name} must not be null or undefined`, { name, value });
	return value;
}

/**
 * Assert that a numeric value is within a specified range.
 * Used for coordinate validation, frequency bounds, port numbers, etc.
 */
export function assertRange(value: number, min: number, max: number, name: string): void {
	assert(
		!isNaN(value) && value >= min && value <= max,
		`${name} must be between ${min} and ${max}, got ${value}`,
		{ name, value, min, max }
	);
}

/**
 * Assert that a value is a finite number (not NaN, not Infinity).
 * Used after parseInt/parseFloat calls.
 */
export function assertFiniteNumber(value: number, name: string): void {
	assert(Number.isFinite(value), `${name} must be a finite number, got ${value}`, {
		name,
		value
	});
}
```

### Commit

```
feat(assert): create runtime assertion utility for defensive coding (NASA/JPL Rule 5)
```

### Verification

```bash
npm run typecheck  # Must pass
npm run test:unit  # Must pass
grep -c "export function assert" src/lib/utils/assert.ts
# Expected: 4 (assert, assertDefined, assertRange, assertFiniteNumber)
```

---

## Task 3.4.2: Add Assertions to Critical Data Processing Functions

Add assertions to functions that process GPS coordinates, RF frequencies, and other domain-critical numeric data. These are the functions where garbage input produces silently corrupt intelligence output.

### Priority 1: Geospatial Functions (src/lib/server/db/geo.ts)

| Function                                    | Assertions to Add                                                                   |
| ------------------------------------------- | ----------------------------------------------------------------------------------- |
| `calculateDistance(lat1, lon1, lat2, lon2)` | `assertRange(lat1, -90, 90, 'lat1')`, same for lat2, lon1/lon2 with -180..180       |
| `convertRadiusToGrid(lat, lon, radius)`     | `assertRange(lat, -90, 90, 'lat')`, `assert(radius > 0, 'radius must be positive')` |
| `detectDeviceType(frequency)`               | `assertFiniteNumber(frequency, 'frequency')`                                        |

### Priority 2: Sweep Manager State Transitions

| File                                    | Assertion                                                                                                                    |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/server/hackrf/sweepManager.ts` | Assert state machine transitions: only Idle->Running, Running->Stopping, Stopping->Idle. Log and reject invalid transitions. |
| `src/lib/server/usrp/sweepManager.ts`   | Same assertions as HackRF sweep manager                                                                                      |

### Priority 3: Signal Processing Functions

| File                                      | Function                 | Assertions                                              |
| ----------------------------------------- | ------------------------ | ------------------------------------------------------- |
| `src/lib/services/map/signalFiltering.ts` | `filterByFrequencyRange` | `assertRange` on min/max frequency                      |
| `src/lib/services/map/droneDetection.ts`  | `detectDrone`            | `assertFiniteNumber` on frequency                       |
| `src/lib/server/db/signalRepository.ts`   | `insertSignal`           | `assertRange` on lat/lon, `assertFiniteNumber` on power |

### Commit

```
feat(assert): add runtime assertions to geospatial, sweep, and signal processing functions
```

### Verification

```bash
grep -rn "assert" src/lib/server/db/geo.ts | wc -l
# Expected: 6+ (at least 2 per function per NASA/JPL Rule 5)
grep -rn "assert" src/lib/server/hackrf/sweepManager.ts | wc -l
# Expected: 3+ (state transition guards)
npm run typecheck  # Must pass
npm run test:unit  # Must pass
```

---

## Task 3.4.3: Create Logging Level Policy Document

**File to create**: `docs/LOGGING-POLICY.md`

This document is required before the Phase 3.1.4 batch migration proceeds. Without it, the migration is a mechanical exercise that may inadvertently log PII.

### Required Sections

1. **Log Level Definitions**

| Level | Definition                                                       | Examples                                                                  |
| ----- | ---------------------------------------------------------------- | ------------------------------------------------------------------------- |
| ERROR | Conditions requiring human intervention or indicating data loss  | Database write failure, hardware communication timeout, assertion failure |
| WARN  | Degraded operation that is self-recovering or requires attention | Service reconnection, fallback to default config, deprecated API usage    |
| INFO  | Significant state transitions visible to operators               | Service start/stop, sweep start/complete, device connected/disconnected   |
| DEBUG | Detailed operational data for troubleshooting (dev only)         | Request/response payloads, intermediate calculation steps, timing data    |

2. **PII Handling Rules**

This system processes the following sensitive data categories:

| Data Category                     | Classification                       | Logging Rule                                                                           |
| --------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------- |
| IMSI numbers                      | SENSITIVE -- personally identifiable | NEVER log raw IMSI. Log truncated form only: `IMSI:***1234` (last 4 digits)            |
| GPS coordinates (of targets)      | SENSITIVE -- location intelligence   | Log at DEBUG level only. Never at INFO or above. Truncate to 2 decimal places in logs. |
| GPS coordinates (of own platform) | INTERNAL                             | May log at INFO level for operational awareness                                        |
| MAC addresses                     | SENSITIVE -- device fingerprint      | Log truncated form: `AA:BB:CC:XX:XX:XX` (first 3 octets only for OUI identification)   |
| SSIDs                             | LOW SENSITIVITY                      | May log at INFO level                                                                  |
| Cell tower IDs (MCC/MNC/LAC/CID)  | PUBLIC                               | May log freely (public infrastructure data)                                            |
| API keys / credentials            | SECRET                               | NEVER log. Use `[REDACTED]` placeholder.                                               |
| RF frequency data                 | LOW SENSITIVITY                      | May log freely (operational parameter)                                                 |

3. **Structured Logging Format**

All log calls must use the structured logger's context parameter for machine-parseable fields:

```typescript
// CORRECT:
logInfo('Device detected', { mac: truncateMac(device.mac), frequency: device.freq });

// WRONG:
logInfo(`Device ${device.mac} detected at ${device.freq} MHz`);
```

4. **Log Retention**

- Production: 7 days, then automatic rotation
- Debug level: disabled in production unless explicitly enabled via `LOG_LEVEL=debug`
- Sensitive data categories: 24-hour retention maximum when logged at DEBUG level

### Commit

```
docs(logging): create logging level policy with PII handling rules for DoD compliance
```

### Verification

```bash
test -f docs/LOGGING-POLICY.md && echo EXISTS || echo MISSING
# Expected: EXISTS
grep -c "NEVER" docs/LOGGING-POLICY.md
# Expected: 2+ (IMSI and credentials rules)
```

---

## Task 3.4.4: Add Zod Schema Validation to Highest-Risk API Routes

Zod is already installed (`package.json` dependency). It is used in exactly 1 file. Add Zod schemas to the 10 highest-risk API routes -- those that control hardware or process sensitive data.

### Priority Routes (Hardware Control + Sensitive Data)

| #   | Route                                              | Risk                                             | Schema Elements                                                                                                                                                |
| --- | -------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `src/routes/api/hackrf/start-sweep/+server.ts`     | HackRF hardware control                          | `frequencies: z.array(z.object({ start: z.number().min(1).max(6000), end: z.number() })), cycleTime: z.number().int().min(1).max(300)`                         |
| 2   | `src/routes/api/gsm-evil/control/+server.ts`       | GSM hardware control, shell command construction | `action: z.enum(['start', 'stop']), frequency: z.string().regex(/^\d+(\.\d+)?$/), gain: z.number().int().min(0).max(100)`                                      |
| 3   | `src/routes/api/droneid/+server.ts`                | Bettercap process control                        | `action: z.enum(['start', 'stop', 'status'])`                                                                                                                  |
| 4   | `src/routes/api/kismet/control/+server.ts`         | Kismet service control                           | `action: z.enum(['start', 'stop', 'restart'])`                                                                                                                 |
| 5   | `src/routes/api/signals/+server.ts`                | Spatial database query                           | `lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180), radiusMeters: z.number().min(1).max(100000), limit: z.number().int().min(1).max(10000)` |
| 6   | `src/routes/api/rf/start-sweep/+server.ts`         | RF sweep control                                 | Same as #1                                                                                                                                                     |
| 7   | `src/routes/api/gsm-evil/scan/+server.ts`          | GSM scan initiation                              | `startFrequency: z.number(), endFrequency: z.number(), gain: z.number().int()`                                                                                 |
| 8   | `src/routes/api/bettercap/control/+server.ts`      | Bettercap network control                        | `action: z.enum(['start', 'stop', 'status']), interface: z.string().regex(/^[a-zA-Z0-9]+$/)`                                                                   |
| 9   | `src/routes/api/kismet/scripts/execute/+server.ts` | Script execution                                 | `scriptPath: z.string(), args: z.array(z.string()).optional()` -- PLUS path traversal validation                                                               |
| 10  | `src/routes/api/agent/stream/+server.ts`           | AI agent query                                   | `message: z.string().max(4096), model: z.string().optional()`                                                                                                  |

### Schema Application Pattern

```typescript
import { z } from 'zod';

const StartSweepSchema = z.object({
	frequencies: z
		.array(
			z.object({
				start: z.number().min(1).max(6000),
				end: z.number().min(1).max(6000)
			})
		)
		.min(1)
		.max(10),
	cycleTime: z.number().int().min(1).max(300).default(10)
});

export const POST: RequestHandler = async ({ request }) => {
	const raw = await request.json();
	const result = StartSweepSchema.safeParse(raw);
	if (!result.success) {
		return json(
			{
				success: false,
				error: 'Invalid request parameters',
				details: result.error.flatten().fieldErrors
			},
			{ status: 400 }
		);
	}
	const { frequencies, cycleTime } = result.data;
	// ... proceed with validated data
};
```

### Commit

```
feat(validation): add Zod schema validation to 10 highest-risk API routes
```

### Verification

```bash
grep -rl "z\.\|zod\|Schema" src/routes/api/ --include="*.ts" | wc -l
# Expected: 10+
npm run typecheck  # Must pass
npm run test:unit  # Must pass
```

---

## Task 3.4.5: Guard All parseInt/parseFloat Calls with isNaN Checks

96 of 126 `parseInt`/`parseFloat` calls across 46 files lack `isNaN` guards. When the input is not a valid number, `NaN` propagates silently through arithmetic and into database queries, producing corrupt data.

### Strategy

For each unguarded `parseInt`/`parseFloat` call:

1. **If the value has a sensible default**: Use `assertFiniteNumber` or a fallback:

    ```typescript
    // BEFORE:
    const limit = parseInt(url.searchParams.get('limit') || '1000');

    // AFTER:
    const rawLimit = parseInt(url.searchParams.get('limit') || '1000', 10);
    const limit = Number.isFinite(rawLimit) ? rawLimit : BUFFER_LIMITS.DB_QUERY_LIMIT_DEFAULT;
    ```

2. **If NaN should be an error**: Use `assertFiniteNumber`:

    ```typescript
    const freq = parseFloat(body.frequency);
    assertFiniteNumber(freq, 'frequency');
    ```

3. **Always specify radix 10** for `parseInt` calls (CERT INT09-C):
    ```typescript
    // WRONG:
    parseInt(value);
    // CORRECT:
    parseInt(value, 10);
    ```

### Commit

```
fix(validation): add isNaN guards to 96 unguarded parseInt/parseFloat calls across 46 files
```

### Verification

```bash
# Count parseInt calls without radix parameter (CERT INT09-C):
grep -Prn 'parseInt\([^,)]+\)' src/ --include="*.ts" | grep -v ', 10' | grep -v ', 16' | wc -l
# Target: 0

npm run typecheck  # Must pass
```

---

## Task 3.4.6: Fix Unsafe `(error as Error).message` Cast Pattern

Approximately 40 API route catch blocks use `(error as Error).message`. If the thrown value is not an Error (string, null, undefined), `.message` returns `undefined`, silently losing the error.

### Fix Pattern

```typescript
// BEFORE:
} catch (error) {
    return json({ success: false, error: (error as Error).message }, { status: 500 });
}

// AFTER:
} catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError('Operation failed', { error: message });
    return json({ success: false, error: message }, { status: 500 });
}
```

### Commit

```
fix(error-handling): replace unsafe (error as Error).message casts with instanceof checks
```

### Verification

```bash
grep -rn "(error as Error)" src/ --include="*.ts" | wc -l
# Target: 0
npm run typecheck  # Must pass
```

---

## Verification Checklist (Phase 3.4 Complete)

| #   | Check                      | Command                                                                           | Expected |
| --- | -------------------------- | --------------------------------------------------------------------------------- | -------- |
| 1   | assert.ts exists           | `test -f src/lib/utils/assert.ts && echo EXISTS`                                  | EXISTS   |
| 2   | Assertions in geo.ts       | `grep -c "assert" src/lib/server/db/geo.ts`                                       | 6+       |
| 3   | Assertions in sweepManager | `grep -c "assert" src/lib/server/hackrf/sweepManager.ts`                          | 3+       |
| 4   | Logging policy exists      | `test -f docs/LOGGING-POLICY.md && echo EXISTS`                                   | EXISTS   |
| 5   | PII rules documented       | `grep -c "NEVER" docs/LOGGING-POLICY.md`                                          | 2+       |
| 6   | Zod schemas in API routes  | `grep -rl "z\.\|zod" src/routes/api/ --include="*.ts" \| wc -l`                   | 10+      |
| 7   | No unguarded parseInt      | `grep -Prn 'parseInt\([^,)]+\)' src/ --include="*.ts" \| grep -v ', 10' \| wc -l` | 0        |
| 8   | No unsafe error casts      | `grep -rn "(error as Error)" src/ --include="*.ts" \| wc -l`                      | 0        |
| 9   | TypeScript compiles        | `npm run typecheck`                                                               | Exit 0   |
| 10  | Build succeeds             | `npm run build`                                                                   | Exit 0   |
| 11  | Unit tests pass            | `npm run test:unit`                                                               | Exit 0   |

---

## Risk Assessment

| Risk                                             | Likelihood | Impact | Mitigation                                                                                                                                                           |
| ------------------------------------------------ | ---------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Assertion throws in production for edge case     | MEDIUM     | MEDIUM | Assertions are for "should never happen" conditions; catching real bugs is the intended outcome. Log before throw ensures the failure is recorded.                   |
| Zod validation rejects previously-accepted input | MEDIUM     | LOW    | Schemas use `.default()` for optional fields. Existing valid input will continue to work. Invalid input that previously silently corrupted data will now return 400. |
| parseInt radix change alters parsing             | VERY LOW   | LOW    | Specifying radix 10 only affects strings with leading zeros (e.g., "010"). No frequency or port values in this system have leading zeros.                            |
| PII logging policy too restrictive for debugging | LOW        | LOW    | DEBUG level is exempt from truncation. Policy only restricts INFO and above.                                                                                         |
| error instanceof Error misses cross-realm errors | VERY LOW   | LOW    | All errors in this system are thrown within the same V8 isolate. Cross-realm Error objects are not a concern.                                                        |

---

## Dependencies

- **Phase 3.1**: Must be complete (assertions use structured logger for failure reporting)
- **Phase 3.2**: Must be complete (assertions reference named constants for range bounds, e.g., RF_BANDS.WIFI_2G_MIN)
- **Phase 3.3**: Runs in parallel with Phase 3.3.2 addendum (catch-related fixes)
- **Phase 4**: Type safety improvements benefit from Zod schemas (runtime validation + compile-time types via `z.infer<>`)
- **Phase 2**: Security hardening benefits from input validation (Zod schemas prevent injection at the validation boundary)
