# Phase 5.5.3 -- Critical Route Handler Decomposition

| Field                | Value                                                                      |
| -------------------- | -------------------------------------------------------------------------- |
| **Document ID**      | ARGOS-AUDIT-P5.5.3                                                         |
| **Phase**            | 5.5.3                                                                      |
| **Title**            | Critical Route Handler Decomposition (CRITICAL-04, CRITICAL-06)            |
| **Risk Level**       | LOW -- internal refactors with no public API changes                       |
| **Prerequisites**    | Phase 5.5.0 (Assessment) complete                                          |
| **Estimated Effort** | 1.5 hours                                                                  |
| **Files Touched**    | 2 existing files refactored, 1-2 new helper files created                  |
| **Standards**        | MISRA C:2023 Rule 1.1 (60-line limit), NASA/JPL Rule 2.4, Barr C Section 7 |
| **Audit Date**       | 2026-02-08                                                                 |
| **Auditor**          | Alex Thompson, Principal Quantum Software Architect                        |
| **Classification**   | UNCLASSIFIED // FOR OFFICIAL USE ONLY                                      |

---

## 1. Objective

Decompose two CRITICAL functions that define route handlers with inline business logic:

1. `setupRoutes` (193 lines) -- Express-style route registration with 8-10 inline handlers
2. `performHealthCheck` (182 lines) -- API route health-check with 6-8 inline diagnostic checks

Both share the same root cause: multiple independent operations implemented as inline closures within a single function body.

---

## 2. Function Inventory

| ID          | Lines | File                                        | Line Start | Function             | Pattern to Apply |
| ----------- | ----- | ------------------------------------------- | ---------- | -------------------- | ---------------- |
| CRITICAL-04 | 193   | `src/lib/services/gsm-evil/server.ts`       | 37         | `setupRoutes`        | Extract-and-Name |
| CRITICAL-06 | 182   | `src/routes/api/gsm-evil/health/+server.ts` | 6          | `performHealthCheck` | Extract-and-Name |

---

## 3. CRITICAL-04: `setupRoutes` (193 lines)

**Location**: `src/lib/services/gsm-evil/server.ts:37`
**Current size**: 193 lines
**Root cause**: Express-style route registration function defines 8-10 route handlers inline. Each handler contains request parsing, business logic, and response formatting. This violates the Single Responsibility Principle at the function level.

### 3.1 Decomposition Strategy

Extract each route handler to an individual named function. The `setupRoutes` function retains only the route registration calls (one line per route).

### 3.2 New Functions

New functions in `src/lib/services/gsm-evil/server.ts` or extracted to `src/lib/services/gsm-evil/handlers/`:

| Function Name                    | Estimated Lines | Route            |
| -------------------------------- | --------------- | ---------------- |
| `handleStartScan(req, res)`      | 20-30           | POST /scan/start |
| `handleStopScan(req, res)`       | 10-15           | POST /scan/stop  |
| `handleGetStatus(req, res)`      | 15-20           | GET /status      |
| `handleGetIMSIs(req, res)`       | 15-25           | GET /imsis       |
| `handleSetFrequency(req, res)`   | 15-20           | POST /frequency  |
| `handleHealthCheck(req, res)`    | 15-20           | GET /health      |
| `handleGetConfig(req, res)`      | 10-15           | GET /config      |
| `handleUpdateConfig(req, res)`   | 15-20           | PUT /config      |
| `handleGetScanHistory(req, res)` | 15-20           | GET /history     |

### 3.3 Before/After Structure

**Before** (193 lines):

```typescript
export function setupRoutes(app: Express): void {
	app.post('/scan/start', async (req, res) => {
		// 25 lines of request parsing + business logic + response
	});
	app.post('/scan/stop', async (req, res) => {
		// 12 lines
	});
	app.get('/status', async (req, res) => {
		// 18 lines
	});
	// ... 6 more inline handlers ...
}
```

**After** (15-25 lines):

```typescript
export function setupRoutes(app: Express): void {
	app.post('/scan/start', handleStartScan);
	app.post('/scan/stop', handleStopScan);
	app.get('/status', handleGetStatus);
	app.get('/imsis', handleGetIMSIs);
	app.post('/frequency', handleSetFrequency);
	app.get('/health', handleHealthCheck);
	app.get('/config', handleGetConfig);
	app.put('/config', handleUpdateConfig);
	app.get('/history', handleGetScanHistory);
}
```

### 3.4 Post-Decomposition

**`setupRoutes` target size**: 15-25 lines (pure route registration, one `app.METHOD(path, handler)` call per line).

### 3.5 Cross-Phase Notes

- **Phase 2.1.2 (Shell Injection)**: Several GSM Evil handlers may invoke shell commands. During extraction, audit each handler for command injection vectors per Phase 2.1.2 findings.
- **Phase 2.2.4 (JSON Parse Validation)**: Extracted handlers that call `req.body` or `request.json()` must validate input. Document as technical debt if not validated now.

### 3.6 Verification

```bash
python3 scripts/audit-function-sizes-v2.py src/lib/services/gsm-evil/server.ts
# TARGET: 0 functions >60 lines

npm run build && npm run typecheck
```

### 3.7 Test Requirements

| Extracted Function   | Test Cases Required                                        | Coverage Target      |
| -------------------- | ---------------------------------------------------------- | -------------------- |
| `handleStartScan`    | Valid request, missing frequency, already scanning         | 90% line coverage    |
| `handleStopScan`     | Active scan, no active scan                                | 80% line coverage    |
| `handleGetStatus`    | Service running, service stopped, error state              | 100% branch coverage |
| `handleSetFrequency` | Valid frequency, out-of-range frequency, non-numeric input | 100% branch coverage |

Test file: `tests/unit/decomposition/gsm-evil/handlers.test.ts`

---

## 4. CRITICAL-06: `performHealthCheck` (182 lines)

**Location**: `src/routes/api/gsm-evil/health/+server.ts:6`
**Current size**: 182 lines
**Root cause**: Single health-check function performs 6-8 independent diagnostic checks sequentially: process status, database connectivity, hardware presence, frequency lock, scan history recency, disk space, and error rate. Each check is 15-25 lines of independent logic jammed into one function.

### 4.1 Decomposition Strategy

Extract each diagnostic check into a named function. The `performHealthCheck` function becomes a coordinator that calls each checker and aggregates results.

### 4.2 New Functions

New functions in same file or extracted to `src/lib/services/gsm-evil/healthCheckers.ts`:

| Function Name                                   | Estimated Lines | Check                                                |
| ----------------------------------------------- | --------------- | ---------------------------------------------------- |
| `checkGSMProcess()`                             | 15-20           | Verify grgsm_livemon or gsm_evil process is running  |
| `checkDatabaseConnection()`                     | 10-15           | Test SQLite database read/write                      |
| `checkHardwarePresence()`                       | 15-20           | Detect RTL-SDR or HackRF device on USB bus           |
| `checkFrequencyLock()`                          | 10-15           | Verify SDR is locked to target frequency             |
| `checkScanRecency()`                            | 10-15           | Verify last scan result is within acceptable age     |
| `checkDiskSpace()`                              | 10-15           | Verify sufficient disk space for capture files       |
| `checkErrorRate()`                              | 10-15           | Evaluate error rate over sliding window              |
| `aggregateHealthResults(checks: HealthCheck[])` | 15-20           | Combine individual check results into overall status |

### 4.3 Before/After Structure

**Before** (182 lines):

```typescript
export async function GET({ request }): Promise<Response> {
    const results: HealthCheck[] = [];

    // Check 1: Process status (20 lines)
    try {
        const { stdout } = await execAsync('pgrep -f grgsm_livemon');
        results.push({ name: 'process', status: 'ok', ... });
    } catch { /* ... */ }

    // Check 2: Database (15 lines)
    // ... 15 lines ...

    // Check 3: Hardware (18 lines)
    // ... 18 lines ...

    // ... 5 more checks ...

    // Aggregate (20 lines)
    const overall = results.every(r => r.status === 'ok') ? 'healthy' : 'degraded';
    return json({ status: overall, checks: results });
}
```

**After** (25-35 lines):

```typescript
export async function GET({ request }): Promise<Response> {
	const checks = await Promise.all([
		checkGSMProcess(),
		checkDatabaseConnection(),
		checkHardwarePresence(),
		checkFrequencyLock(),
		checkScanRecency(),
		checkDiskSpace(),
		checkErrorRate()
	]);
	const result = aggregateHealthResults(checks);
	return json(result);
}
```

### 4.4 Post-Decomposition

**`performHealthCheck` (GET handler) target size**: 25-35 lines (call each checker, pass results to aggregator, return).

Note: Using `Promise.all()` enables parallel execution of independent health checks, which is faster than the original sequential approach.

### 4.5 Cross-Phase Notes

- **Phase 2.1.2 (Shell Injection)**: `checkGSMProcess` may use `execAsync('pgrep ...')`. Ensure the process name is hardcoded, not user-supplied.
- **Phase 5.5.4**: The decomposition pattern here (independent checkers + aggregator) is identical to the pattern used for `getSystemInfo` (CRITICAL-09). Share knowledge between the two decompositions.

### 4.6 Verification

```bash
python3 scripts/audit-function-sizes-v2.py src/routes/api/gsm-evil/health/+server.ts
# TARGET: 0 functions >60 lines

npm run build && npm run typecheck
```

### 4.7 Test Requirements

| Extracted Function       | Test Cases Required                                 | Coverage Target      |
| ------------------------ | --------------------------------------------------- | -------------------- |
| `checkGSMProcess`        | Process running, process stopped, pgrep error       | 100% branch coverage |
| `checkHardwarePresence`  | Device found, device not found, USB bus error       | 100% branch coverage |
| `checkDiskSpace`         | Sufficient space, low space, error reading disk     | 100% branch coverage |
| `aggregateHealthResults` | All ok, one degraded, multiple failures, empty list | 100% branch coverage |

Test file: `tests/unit/decomposition/gsm-evil/healthCheckers.test.ts`

---

## 5. Execution Order

1. Decompose `setupRoutes` (CRITICAL-04) -- handlers are independent
2. Decompose `performHealthCheck` (CRITICAL-06) -- independent
3. Run full verification suite

**Commit strategy**: One commit per function decomposition (2 commits total).

```
refactor(phase-5.5): decompose setupRoutes in gsm-evil/server.ts (193 -> 20 lines)
refactor(phase-5.5): decompose performHealthCheck in gsm-evil/health (182 -> 30 lines)
```

---

## 6. Risk Mitigations

### 6.1 Error-Handling Semantics Preservation

Both functions contain inline `try/catch` blocks around each operation. When extracting each operation to a named function:

1. Each checker function should catch its own errors and return a `HealthCheck` result with `status: 'error'` rather than throwing.
2. Each route handler should catch its own errors and return appropriate HTTP status codes.
3. The orchestrator should NOT wrap calls in a top-level try/catch that swallows individual check failures.

### 6.2 Request/Response Object Passing

When extracting Express-style handlers, the `req` and `res` objects (or SvelteKit `event` object) must be passed as parameters. Verify that extracted handlers do not accidentally reference closure variables from the parent scope.

---

**END OF DOCUMENT**
