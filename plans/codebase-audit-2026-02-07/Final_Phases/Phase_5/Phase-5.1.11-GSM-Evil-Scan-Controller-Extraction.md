# Phase 5.1.11 -- GSM Evil: Extract Scan Controller

| Field             | Value                                                                 |
| ----------------- | --------------------------------------------------------------------- |
| **Phase**         | 5.1.11                                                                |
| **Title**         | GSM Evil: Extract Scan Controller                                     |
| **Risk Level**    | MEDIUM                                                                |
| **Prerequisites** | Phase 5.1.10 complete (lookup tables extracted)                       |
| **Files Touched** | 2 (1 modified, 1 created)                                             |
| **Standards**     | MISRA C:2023 Rule 1.1, CERT C ERR00-C, NASA/JPL Rule 15, Barr C Ch. 8 |
| **Audit Date**    | 2026-02-08                                                            |
| **Auditor**       | Alex Thompson, Principal Quantum Software Architect                   |

---

## 1. Objective

Extract the scan controller functions from the GSM Evil god page into a dedicated
service module. The `scanFrequencies` function at 189 lines is the most complex
function in the file -- it mixes SSE parsing, store updates, DOM manipulation, and
error handling -- and EXCEEDS the 60-LOC NASA/JPL Rule 15 limit. It must be decomposed
into 4 sub-functions.

---

## 2. Current State

**Source file**: `src/routes/gsm-evil/+page.svelte` (2,591 lines)

| Function                      | Location    | Lines | Side Effects           | >60 LOC? |
| ----------------------------- | ----------- | ----- | ---------------------- | -------- |
| `handleScanButton()`          | L998-L1028  | 31    | State                  | No       |
| `scanFrequencies()`           | L1073-L1261 | 189   | SSE stream, store, DOM | **YES**  |
| `startIMSICapture(frequency)` | L1039-L1072 | 34    | API call, store        | No       |

**Total lines to extract**: 264

---

## 3. Decomposition of scanFrequencies (189 lines)

This function currently handles 9 responsibilities:

1. Initialize scan via store (~5 lines)
2. Set up abort controller and timeout (~10 lines)
3. Fetch SSE streaming endpoint (~10 lines)
4. ReadableStream reader loop (~15 lines)
5. Parse SSE `data:` lines (~10 lines)
6. Handle `frequency_result` events with auto-select logic (~40 lines)
7. Handle `scan_complete` events with final processing (~50 lines)
8. Error handling with network vs process differentiation (~25 lines)
9. Cleanup in finally block (~5 lines)

### 3.1 Split into 4 Functions

**Function 1**: `parseScanSSELine(line: string): ScanEvent | null`

- Pure function, parses a single SSE line into a typed event object (~15 lines)
- Returns null for non-data lines (comments, empty lines)

**Function 2**: `handleFrequencyResult(event: FrequencyResultEvent, store: GsmEvilStore): void`

- Processes a single frequency result, updates store (~30 lines)
- Implements auto-select logic for strongest frequency

**Function 3**: `handleScanComplete(event: ScanCompleteEvent, store: GsmEvilStore, startCapture: Function): void`

- Processes final scan results, auto-starts IMSI capture (~40 lines)
- Selects optimal frequency and invokes IMSI capture if configured

**Function 4**: `scanFrequencies(store: GsmEvilStore, startCapture: Function): Promise<void>`

- Orchestrator: setup, stream, delegate to parsers, cleanup (~50 lines)
- Accepts `AbortController` as parameter for lifecycle management

**Post-split max function length**: ~50 lines

---

## 4. Implementation Steps

### Step 1: Create the Service File

Create `src/lib/services/gsm-evil/scanController.ts`:

```typescript
// src/lib/services/gsm-evil/scanController.ts

import type { GsmEvilStore } from '$lib/stores/gsmEvilStore';

// --- Event types ---

interface ScanEvent {
	type: 'frequency_result' | 'scan_complete' | 'error';
	data: unknown;
}

interface FrequencyResultEvent {
	frequency: number;
	power: number;
	// ... additional fields
}

interface ScanCompleteEvent {
	results: FrequencyResultEvent[];
	bestFrequency: number;
	// ... additional fields
}

// --- Pure functions ---

export function parseScanSSELine(line: string): ScanEvent | null {
	// Parse SSE data: line into typed event (~15 lines)
}

export function handleFrequencyResult(event: FrequencyResultEvent, store: GsmEvilStore): void {
	// Process single frequency result (~30 lines)
}

export function handleScanComplete(
	event: ScanCompleteEvent,
	store: GsmEvilStore,
	startCapture: (frequency: number) => Promise<void>
): void {
	// Process final scan results (~40 lines)
}

// --- Main orchestrator ---

export async function scanFrequencies(
	store: GsmEvilStore,
	startCapture: (frequency: number) => Promise<void>,
	abortController?: AbortController
): Promise<void> {
	// Orchestrator: setup, stream, delegate, cleanup (~50 lines)
}

// --- Supporting functions ---

export function handleScanButton(store: GsmEvilStore, scanFn: () => Promise<void>): void {
	// Extracted from handleScanButton() L998-L1028 (~31 lines)
}

export async function startIMSICapture(frequency: number, store: GsmEvilStore): Promise<void> {
	// Extracted from startIMSICapture() L1039-L1072 (~34 lines)
}
```

### Step 2: Update the God Page

1. Remove `handleScanButton()`, `scanFrequencies()`, `startIMSICapture()` from `+page.svelte`
2. Add import:

```typescript
import {
	handleScanButton,
	scanFrequencies,
	startIMSICapture
} from '$lib/services/gsm-evil/scanController';
```

3. Update call sites to pass required parameters (store, abort controller)

### Step 3: SSE Lifecycle Management

**CRITICAL**: The component creates and owns the `AbortController`. The component's
`onDestroy` calls `controller.abort()`. The service function's `finally` block calls
`store.completeScan()` regardless of abort state.

This maintains the cleanup guarantee documented in the Memory Leak Audit (2026-02-07,
fix F1: ReadableStream cancel() is the cleanup hook, not start() return).

```svelte
<script>
	let scanAbortController: AbortController | null = null;

	async function onScanClick() {
		scanAbortController = new AbortController();
		await scanFrequencies(gsmStore, startIMSICapture, scanAbortController);
	}

	onDestroy(() => {
		scanAbortController?.abort();
	});
</script>
```

### Step 4: Type Check and Build

```bash
npm run typecheck
npm run build
```

---

## 5. Verification Commands

```bash
# Verify function definitions removed from god page:
grep -c 'function scanFrequencies\|function handleScanButton\|function startIMSICapture' \
  src/routes/gsm-evil/+page.svelte
# Expected: 0

# Verify service file exists and has expected size:
wc -l src/lib/services/gsm-evil/scanController.ts
# Expected: ~280

# Verify no function in service file exceeds 60 LOC:
python3 scripts/audit-function-sizes-v2.py src/lib/services/gsm-evil/scanController.ts
# Expected: 0 functions >60 LOC

# Verify import wired in page:
grep 'scanController' src/routes/gsm-evil/+page.svelte
# Expected: >= 1 match

# Build verification:
npm run typecheck
npm run build
```

---

## 6. Risk Assessment

| Risk                                            | Severity | Likelihood | Mitigation                                                          |
| ----------------------------------------------- | -------- | ---------- | ------------------------------------------------------------------- |
| SSE stream lifecycle broken                     | HIGH     | MEDIUM     | AbortController owned by component; passed to service as parameter  |
| ReadableStream memory leak on abort             | HIGH     | LOW        | finally block calls store.completeScan() (per Memory Leak Audit F1) |
| Store reference invalid after component destroy | MEDIUM   | LOW        | AbortController.abort() cancels stream before store becomes stale   |
| Network vs process error differentiation lost   | MEDIUM   | LOW        | Error handling logic preserved in extracted function                |

**Overall risk**: MEDIUM. The SSE ReadableStream lifecycle is the primary concern.
The mitigation (AbortController owned by component, passed as parameter) follows the
established pattern from the Memory Leak Audit (2026-02-07, fix F1).

---

## 7. Standards Compliance

| Standard              | Requirement                                | How This Sub-Task Satisfies It                                            |
| --------------------- | ------------------------------------------ | ------------------------------------------------------------------------- |
| MISRA C:2023 Rule 1.1 | Code shall conform to standard syntax      | All extracted TypeScript passes `npm run typecheck`                       |
| CERT C ERR00-C        | Adopt consistent error handling            | Error handling split by type (network/process/abort) in typed handlers    |
| NASA/JPL Rule 15      | Functions shall be no longer than 60 lines | 189-line scanFrequencies split into 4 functions (max ~50 lines each)      |
| NASA/JPL Rule 14      | Minimize function complexity               | SSE parsing separated from event handling; each has single responsibility |
| Barr C Ch. 8          | Each module shall have a header            | `scanController.ts` exports typed public interface                        |

---

## 8. Rollback Strategy

```bash
# Revert to pre-extraction state:
git checkout -- src/routes/gsm-evil/+page.svelte
rm -f src/lib/services/gsm-evil/scanController.ts
# If directory is empty:
rmdir src/lib/services/gsm-evil/ 2>/dev/null
```

Single commit, single revert.

---

_Phase 5.1.11 -- GSM Evil: Extract Scan Controller_
_Execution priority: 16 of 19 (see Phase-5.1.20 for full execution order)_
_Estimated LOC change: -264 lines from god page_
